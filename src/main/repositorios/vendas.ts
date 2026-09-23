import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import {
  fairs,
  products,
  productVariations,
  saleItems,
  salePayments,
  sales
} from '../database/schema'
import { ErroDeNegocio } from '../ipc/mensagens'
import { movimentarEstoqueDaVariacao } from './estoque'
import { MENSAGEM_CLIENTE_OBRIGATORIA } from '../../shared/clientes'
import { emCentavos } from '../../shared/dinheiro'
import { RECUSAS_DE_PAGAMENTO } from '../../shared/recebimentos'
import type {
  itemDaVendaSchema,
  novaVendaSchema,
  pagamentoSchema,
  Sale,
  SalePayment,
  vendaAtualizadaSchema
} from '../../shared/ipc/vendas'

type NovaVenda = z.output<typeof novaVendaSchema>
type VendaAtualizada = z.output<typeof vendaAtualizadaSchema>
type Pagamento = z.output<typeof pagamentoSchema>
type ItemDaVenda = z.output<typeof itemDaVendaSchema>

export interface RepositorioDeVendas {
  listarVendas(): Sale[]
  criarVenda(dados: NovaVenda): { id: number }
  atualizarVenda(dados: VendaAtualizada): void
  excluirVenda(id: number): void
  registrarPagamento(dados: Pagamento): { id: number }
  excluirPagamento(id: number): void
  desmarcarRecebida(id: number): void
}

const totalDe = (itens: ItemDaVenda[], campo: 'unitPrice' | 'unitCost'): number =>
  itens.reduce((soma, item) => soma + item.quantity * item[campo], 0)

const somaDe = (pagamentos: SalePayment[], campo: 'amount' | 'feeAmount'): number =>
  pagamentos.reduce((soma, pagamento) => soma + pagamento[campo], 0)

/** RN-17. O que falta receber: total menos o que já foi pago. Fora do a receber, nada. */
function quantoFalta(
  venda: { paymentMethod: string; totalAmount: number },
  pagamentos: SalePayment[]
): number {
  if (venda.paymentMethod !== 'areceber') return 0
  return emCentavos(venda.totalAmount - somaDe(pagamentos, 'amount'))
}

/** RN-16. A venda a receber é cobrada depois: sem o nome, não há de quem cobrar. */
function exigirClienteNoAReceber(dados: NovaVenda | VendaAtualizada): void {
  if (dados.paymentMethod === 'areceber' && !dados.customerName) {
    throw new ErroDeNegocio(MENSAGEM_CLIENTE_OBRIGATORIA)
  }
}

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

  /** Do mais antigo para o mais recente; no mesmo dia, na ordem de lançamento. */
  function pagamentosDa(saleId: number): SalePayment[] {
    return db
      .select({
        id: salePayments.id,
        amount: salePayments.amount,
        paymentMethod: salePayments.paymentMethod,
        feePercentage: salePayments.feePercentage,
        feeAmount: salePayments.feeAmount,
        netAmount: salePayments.netAmount,
        receivedAt: salePayments.receivedAt
      })
      .from(salePayments)
      .where(eq(salePayments.saleId, saleId))
      .orderBy(asc(salePayments.receivedAt), asc(salePayments.id))
      .all() as SalePayment[]
  }

  /**
   * RN-17. Na venda a receber, a taxa é a soma das taxas dos pagamentos e o líquido
   * é o total menos ela. Quem mexe nos pagamentos ou no total recalcula aqui, na
   * mesma transação: faturamento e lucro do Painel continuam lendo `net_amount`.
   */
  function recalcularLiquidoDaVendaAReceber(saleId: number): void {
    const venda = db
      .select({ total: sales.totalAmount })
      .from(sales)
      .where(eq(sales.id, saleId))
      .get()
    if (!venda) return

    const taxas = somaDe(pagamentosDa(saleId), 'feeAmount')
    db.update(sales)
      .set({ feePercentage: 0, feeAmount: taxas, netAmount: venda.total - taxas })
      .where(eq(sales.id, saleId))
      .run()
  }

  /**
   * RN-17. O que já entrou no caixa não pode ficar sem venda que o explique: com
   * pagamento registrado, a forma continua "a receber", o total não desce abaixo do
   * que foi pago e a venda não pode passar a ser posterior a um pagamento.
   */
  function conferirEdicaoComPagamentos(dados: VendaAtualizada): void {
    const pagamentos = pagamentosDa(dados.id)
    if (pagamentos.length === 0) return

    if (dados.paymentMethod !== 'areceber') {
      throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.formaTravada)
    }
    const pago = emCentavos(somaDe(pagamentos, 'amount'))
    if (emCentavos(totalDe(dados.items, 'unitPrice')) < pago) {
      throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.totalAbaixoDoPago(pago))
    }
    if (dados.soldAt.slice(0, 10) > pagamentos[0].receivedAt) {
      throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.vendaDepoisDoPagamento)
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
          customerName: sales.customerName,
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
        const pagamentos = pagamentosDa(venda.id)

        return {
          ...venda,
          items: itens,
          payments: pagamentos,
          amountDue: quantoFalta(venda, pagamentos)
        }
      }) as Sale[]
    },

    /**
     * Venda e baixa de estoque são tudo ou nada: falhar no meio deixaria peça
     * baixada sem venda registrada.
     */
    criarVenda(dados) {
      exigirClienteNoAReceber(dados)

      const criar = sqlite.transaction(() => {
        const resultado = db
          .insert(sales)
          .values({
            channel: dados.channel,
            fairId: dados.fairId ?? null,
            customerName: dados.customerName,
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
        if (dados.paymentMethod === 'areceber') recalcularLiquidoDaVendaAReceber(saleId)

        return { id: saleId }
      })

      return criar()
    },

    /**
     * Editar devolve o estoque dos itens antigos antes de baixar os novos, para
     * o saldo bater mesmo quando a quantidade ou a variação mudam.
     */
    atualizarVenda(dados) {
      exigirClienteNoAReceber(dados)

      const atualizar = sqlite.transaction(() => {
        conferirEdicaoComPagamentos(dados)
        desfazerItens(dados.id)
        db.delete(saleItems).where(eq(saleItems.saleId, dados.id)).run()

        db.update(sales)
          .set({
            channel: dados.channel,
            fairId: dados.fairId ?? null,
            customerName: dados.customerName,
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
        if (dados.paymentMethod === 'areceber') recalcularLiquidoDaVendaAReceber(dados.id)
      })

      atualizar()
    },

    /** Os pagamentos da venda saem junto, por cascata do próprio banco. */
    excluirVenda(id) {
      const excluir = sqlite.transaction(() => {
        desfazerItens(id)
        db.delete(sales).where(eq(sales.id, id)).run()
      })

      excluir()
    },

    /**
     * RN-17. Pagamento de venda a receber, parcial ou do que falta. O valor abate do
     * que falta receber; a taxa só diminui o que entra no caixa e o lucro.
     */
    registrarPagamento(dados) {
      const registrar = sqlite.transaction(() => {
        const venda = db
          .select({
            paymentMethod: sales.paymentMethod,
            totalAmount: sales.totalAmount,
            soldAt: sales.soldAt
          })
          .from(sales)
          .where(eq(sales.id, dados.saleId))
          .get()
        if (!venda) throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.vendaNaoEncontrada)
        if (venda.paymentMethod !== 'areceber') {
          throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.soVendaAReceber)
        }

        const falta = quantoFalta(venda, pagamentosDa(dados.saleId))
        if (falta <= 0) throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.vendaQuitada)

        const valor = emCentavos(dados.amount)
        if (valor <= 0) throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.valorZerado)
        if (valor > falta) throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.acimaDoQueFalta(falta))
        if (dados.receivedAt < venda.soldAt.slice(0, 10)) {
          throw new ErroDeNegocio(RECUSAS_DE_PAGAMENTO.antesDaVenda)
        }

        const taxa = (valor * dados.feePercentage) / 100
        const resultado = db
          .insert(salePayments)
          .values({
            saleId: dados.saleId,
            amount: valor,
            paymentMethod: dados.paymentMethod,
            feePercentage: dados.feePercentage,
            feeAmount: taxa,
            netAmount: valor - taxa,
            receivedAt: dados.receivedAt
          })
          .run()
        recalcularLiquidoDaVendaAReceber(dados.saleId)

        return { id: Number(resultado.lastInsertRowid) }
      })

      return registrar()
    },

    /** O valor volta para o que falta receber e sai do caixa. */
    excluirPagamento(id) {
      const excluir = sqlite.transaction(() => {
        const pagamento = db
          .select({ saleId: salePayments.saleId })
          .from(salePayments)
          .where(eq(salePayments.id, id))
          .get()
        if (!pagamento) return

        db.delete(salePayments).where(eq(salePayments.id, id)).run()
        recalcularLiquidoDaVendaAReceber(pagamento.saleId)
      })

      excluir()
    },

    /**
     * Desfaz o recebimento gravado na própria venda, como a 1.14 fazia: volta para "a
     * receber", sem taxa, com o líquido igual ao total. Venda cujo recebimento está em
     * pagamentos não tem `received_at` e fica como está; lá, desfazer é excluir o
     * pagamento, senão as taxas dele sumiriam do lucro.
     */
    desmarcarRecebida(id) {
      db.update(sales)
        .set({
          paymentMethod: 'areceber',
          feePercentage: 0,
          feeAmount: 0,
          netAmount: sql`total_amount`,
          receivedAt: null
        })
        .where(and(eq(sales.id, id), isNotNull(sales.receivedAt)))
        .run()
    }
  }
}
