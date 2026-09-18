import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import {
  categories,
  insumos,
  products,
  productVariations,
  variationInsumos
} from '../database/schema'
import { ErroDeNegocio } from '../ipc/mensagens'
import { movimentarEstoqueDaVariacao, validarEstoqueDePecas } from './estoque'
import type {
  Category,
  itemDeReceitaSchema,
  novaVariacaoSchema,
  novoProdutoSchema,
  opcoesDeExclusaoSchema,
  Product,
  produtoAtualizadoSchema,
  variacaoAtualizadaSchema
} from '../../shared/ipc/produtos'

type NovoProduto = z.output<typeof novoProdutoSchema>
type ProdutoAtualizado = z.output<typeof produtoAtualizadoSchema>
type NovaVariacao = z.output<typeof novaVariacaoSchema>
type VariacaoAtualizada = z.output<typeof variacaoAtualizadaSchema>
type ItemDeReceita = z.output<typeof itemDeReceitaSchema>
type OpcoesDeExclusao = z.output<typeof opcoesDeExclusaoSchema>

export interface RepositorioDeProdutos {
  listarCategorias(): Category[]
  listarProdutos(): Product[]
  criarProduto(dados: NovoProduto): { id: number }
  atualizarProduto(dados: ProdutoAtualizado): void
  excluirProduto(id: number): void
  definirProdutoArquivado(id: number, arquivado: boolean): void
  criarVariacao(dados: NovaVariacao): { id: number }
  atualizarVariacao(dados: VariacaoAtualizada): void
  definirPrecoDeVenda(id: number, preco: number): void
  excluirVariacao(id: number, opcoes?: OpcoesDeExclusao): void
  definirVariacaoArquivada(id: number, arquivada: boolean): void
  adicionarPecas(id: number, quantidade: number): void
}

export function repositorioDeProdutos({ db, sqlite }: ConexaoBanco): RepositorioDeProdutos {
  function substituirReceita(variationId: number, receita: ItemDeReceita[]): void {
    db.delete(variationInsumos).where(eq(variationInsumos.variationId, variationId)).run()
    for (const item of receita) {
      db.insert(variationInsumos)
        .values({ variationId, insumoId: item.insumoId, quantity: item.quantity })
        .run()
    }
  }

  return {
    listarCategorias() {
      return db.select().from(categories).orderBy(categories.name).all()
    },

    listarProdutos() {
      const linhas = db
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
          categoryName: categories.name,
          description: products.description,
          createdAt: products.createdAt,
          archivedAt: products.archivedAt
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .orderBy(products.name)
        .all()

      return linhas.map((produto) => {
        const variacoes = db
          .select()
          .from(productVariations)
          .where(eq(productVariations.productId, produto.id))
          .all()
        const comReceita = variacoes.map((v) => {
          const receita = db
            .select({
              id: variationInsumos.id,
              variationId: variationInsumos.variationId,
              insumoId: variationInsumos.insumoId,
              insumoName: insumos.name,
              unit: insumos.unit,
              costPerUnit: insumos.costPerUnit,
              quantity: variationInsumos.quantity,
              // A tela marca as variações que dependem de insumo arquivado.
              archivedAt: insumos.archivedAt
            })
            .from(variationInsumos)
            .innerJoin(insumos, eq(variationInsumos.insumoId, insumos.id))
            .where(eq(variationInsumos.variationId, v.id))
            .all()
          return { ...v, insumos: receita }
        })
        return { ...produto, variations: comReceita }
      }) as Product[]
    },

    criarProduto(dados) {
      const resultado = db
        .insert(products)
        .values({
          name: dados.name,
          categoryId: dados.categoryId,
          description: dados.description ?? null
        })
        .run()
      return { id: Number(resultado.lastInsertRowid) }
    },

    atualizarProduto(dados) {
      db.update(products)
        .set({
          name: dados.name,
          categoryId: dados.categoryId,
          description: dados.description ?? null
        })
        .where(eq(products.id, dados.id))
        .run()
    },

    excluirProduto(id) {
      db.delete(products).where(eq(products.id, id)).run()
    },

    /**
     * Arquivar tira o produto dos alertas, das listas e dos seletores, mas não
     * toca no histórico: as vendas antigas continuam apontando para ele. As
     * variações não são escritas — quem lê deriva o estado a partir do produto.
     */
    definirProdutoArquivado(id, arquivado) {
      db.update(products)
        .set({ archivedAt: arquivado ? sql`CURRENT_TIMESTAMP` : null })
        .where(eq(products.id, id))
        .run()
    },

    criarVariacao(dados) {
      validarEstoqueDePecas(dados.stockQuantity)

      // Criar a variação e baixar os insumos precisa ser tudo ou nada: falhar no
      // meio deixaria estoque de insumo debitado para uma variação inexistente.
      const criar = sqlite.transaction(() => {
        const resultado = db
          .insert(productVariations)
          .values({
            productId: dados.productId,
            identifier: dados.identifier,
            costPrice: dados.costPrice,
            salePrice: dados.salePrice,
            stockQuantity: 0,
            minimumStock: dados.minimumStock,
            laborCost: dados.laborCost
          })
          .run()
        const variationId = Number(resultado.lastInsertRowid)

        substituirReceita(variationId, dados.insumos)
        movimentarEstoqueDaVariacao(
          db,
          variationId,
          dados.stockQuantity,
          dados.motivoDoEstoqueInicial === 'producao'
        )

        return { id: variationId }
      })

      return criar()
    },

    atualizarVariacao(dados) {
      if (dados.ajusteDeEstoque) validarEstoqueDePecas(dados.ajusteDeEstoque.novoEstoque)

      const atualizar = sqlite.transaction(() => {
        db.update(productVariations)
          .set({
            identifier: dados.identifier,
            costPrice: dados.costPrice,
            salePrice: dados.salePrice,
            minimumStock: dados.minimumStock,
            laborCost: dados.laborCost
          })
          .where(eq(productVariations.id, dados.id))
          .run()

        substituirReceita(dados.id, dados.insumos)

        const ajuste = dados.ajusteDeEstoque
        if (ajuste) {
          // A diferença é medida contra o banco, não contra o número que a tela
          // carregou: uma venda no meio do caminho não pode virar produção.
          const atual = db
            .select({ estoque: productVariations.stockQuantity })
            .from(productVariations)
            .where(eq(productVariations.id, dados.id))
            .get()
          if (!atual) throw new ErroDeNegocio('Variação não encontrada.')
          movimentarEstoqueDaVariacao(
            db,
            dados.id,
            ajuste.novoEstoque - atual.estoque,
            ajuste.motivo === 'producao'
          )
        }
      })

      atualizar()
    },

    /** Aplicar preço pela Precificação não tem por que regravar estoque nem receita. */
    definirPrecoDeVenda(id, preco) {
      if (preco < 0) throw new ErroDeNegocio('Preço de venda inválido.')
      const resultado = db
        .update(productVariations)
        .set({ salePrice: preco })
        .where(eq(productVariations.id, id))
        .run()
      if (resultado.changes === 0) throw new ErroDeNegocio('Variação não encontrada.')
    },

    /**
     * Devolver os insumos só faz sentido quando o cadastro foi um engano e as
     * peças nunca existiram. Tudo na mesma transação: se a exclusão for recusada
     * por já haver venda, a devolução é desfeita junto.
     */
    excluirVariacao(id, opcoes) {
      const excluir = sqlite.transaction(() => {
        if (opcoes?.devolverInsumos) {
          const variacao = db
            .select({ estoque: productVariations.stockQuantity })
            .from(productVariations)
            .where(eq(productVariations.id, id))
            .get()
          if (variacao && variacao.estoque > 0) {
            movimentarEstoqueDaVariacao(db, id, -variacao.estoque, true)
          }
        }
        db.delete(productVariations).where(eq(productVariations.id, id)).run()
      })

      excluir()
    },

    definirVariacaoArquivada(id, arquivada) {
      db.update(productVariations)
        .set({ archivedAt: arquivada ? sql`CURRENT_TIMESTAMP` : null })
        .where(eq(productVariations.id, id))
        .run()
    },

    adicionarPecas(id, quantidade) {
      const adicionar = sqlite.transaction(() => {
        const variacao = db
          .select({ id: productVariations.id })
          .from(productVariations)
          .where(eq(productVariations.id, id))
          .get()
        if (!variacao) throw new ErroDeNegocio('Variação não encontrada.')

        movimentarEstoqueDaVariacao(db, id, quantidade, true)
      })

      adicionar()
    }
  }
}
