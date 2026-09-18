import { desc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import { fairs, products, productVariations, saleItems, sales } from '../database/schema'
import { movimentarEstoqueDaVariacao } from './estoque'
import type {
  itemDaVendaSchema,
  novaVendaSchema,
  recebimentoSchema,
  Sale,
  vendaAtualizadaSchema
} from '../../shared/ipc/vendas'

type NovaVenda = z.output<typeof novaVendaSchema>
type VendaAtualizada = z.output<typeof vendaAtualizadaSchema>
type Recebimento = z.output<typeof recebimentoSchema>
type ItemDaVenda = z.output<typeof itemDaVendaSchema>

export interface RepositorioDeVendas {
  listarVendas(): Sale[]
  criarVenda(dados: NovaVenda): { id: number }
  atualizarVenda(dados: VendaAtualizada): void
  excluirVenda(id: number): void
  marcarRecebida(dados: Recebimento): void
  desmarcarRecebida(id: number): void
}

const totalDe = (itens: ItemDaVenda[], campo: 'unitPrice' | 'unitCost'): number =>
  itens.reduce((soma, item) => soma + item.quantity * item[campo], 0)

export function repositorioDeVendas({ db, sqlite }: ConexaoBanco): RepositorioDeVendas {
  /** Baixa o estoque das peças vendidas. Insumo não entra: já saiu na produção. */
  function registrarItens(saleId: number, itens: ItemDaVenda[]): void {
    for (const item of itens) {
      db.insert(saleItems)
        .values({
          saleId,
          variationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost
        })
        .run()
      movimentarEstoqueDaVariacao(db, item.variationId, -item.quantity, false)
    }
  }

  /** Devolve às variações o que os itens gravados tinham tirado. */
  function desfazerItens(saleId: number): void {
    const itens = db
      .select({ variationId: saleItems.variationId, quantity: saleItems.quantity })
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))
      .all()
    for (const item of itens) {
      movimentarEstoqueDaVariacao(db, item.variationId, item.quantity, false)
    }
  }

  return {
    listarVendas() {
      const linhas = db
        .select({
          id: sales.id,
          channel: sales.channel,
          fairId: sales.fairId,
          fairName: fairs.name,
          totalAmount: sales.totalAmount,
          totalCost: sales.totalCost,
          paymentMethod: sales.paymentMethod,
          feePercentage: sales.feePercentage,
          feeAmount: sales.feeAmount,
          netAmount: sales.netAmount,
          soldAt: sales.soldAt,
          receivedAt: sales.receivedAt
        })
        .from(sales)
        .leftJoin(fairs, eq(sales.fairId, fairs.id))
        // Mais recente primeiro; o desempate por id mantém a ordem de lançamento
        // entre vendas do mesmo dia.
        .orderBy(desc(sales.soldAt), desc(sales.id))
        .all()

      return linhas.map((venda) => {
        const itens = db
          .select({
            id: saleItems.id,
            variationId: saleItems.variationId,
            variationIdentifier: productVariations.identifier,
            productName: products.name,
            quantity: saleItems.quantity,
            unitPrice: saleItems.unitPrice,
            unitCost: saleItems.unitCost
          })
          .from(saleItems)
          .innerJoin(productVariations, eq(saleItems.variationId, productVariations.id))
          .innerJoin(products, eq(productVariations.productId, products.id))
          .where(eq(saleItems.saleId, venda.id))
          .all()

        return { ...venda, items: itens }
      }) as Sale[]
    },

    /**
     * Venda e baixa de estoque são tudo ou nada: falhar no meio deixaria peça
     * baixada sem venda registrada.
     */
    criarVenda(dados) {
      const criar = sqlite.transaction(() => {
        const resultado = db
          .insert(sales)
          .values({
            channel: dados.channel,
            fairId: dados.fairId ?? null,
            totalAmount: totalDe(dados.items, 'unitPrice'),
            totalCost: totalDe(dados.items, 'unitCost'),
            paymentMethod: dados.paymentMethod,
            feePercentage: dados.feePercentage,
            feeAmount: dados.feeAmount,
            netAmount: dados.netAmount,
            soldAt: dados.soldAt
          })
          .run()
        const saleId = Number(resultado.lastInsertRowid)

        registrarItens(saleId, dados.items)

        return { id: saleId }
      })

      return criar()
    },

    /**
     * Editar devolve o estoque dos itens antigos antes de baixar os novos, para
     * o saldo bater mesmo quando a quantidade ou a variação mudam.
     */
    atualizarVenda(dados) {
      const atualizar = sqlite.transaction(() => {
        desfazerItens(dados.id)
        db.delete(saleItems).where(eq(saleItems.saleId, dados.id)).run()

        db.update(sales)
          .set({
            channel: dados.channel,
            fairId: dados.fairId ?? null,
            totalAmount: totalDe(dados.items, 'unitPrice'),
            totalCost: totalDe(dados.items, 'unitCost'),
            paymentMethod: dados.paymentMethod,
            feePercentage: dados.feePercentage,
            feeAmount: dados.feeAmount,
            netAmount: dados.netAmount,
            soldAt: dados.soldAt
          })
          .where(eq(sales.id, dados.id))
          .run()

        registrarItens(dados.id, dados.items)
      })

      atualizar()
    },

    excluirVenda(id) {
      const excluir = sqlite.transaction(() => {
        desfazerItens(id)
        db.delete(sales).where(eq(sales.id, id)).run()
      })

      excluir()
    },

    marcarRecebida(dados) {
      db.update(sales)
        .set({
          paymentMethod: dados.paymentMethod,
          feePercentage: dados.feePercentage,
          feeAmount: dados.feeAmount,
          netAmount: dados.netAmount,
          receivedAt: dados.receivedAt
        })
        .where(eq(sales.id, dados.id))
        .run()
    },

    /** Volta a venda para "a receber": sem taxa, líquido igual ao total. */
    desmarcarRecebida(id) {
      db.update(sales)
        .set({
          paymentMethod: 'areceber',
          feePercentage: 0,
          feeAmount: 0,
          netAmount: sql`total_amount`,
          receivedAt: null
        })
        .where(eq(sales.id, id))
        .run()
    }
  }
}
