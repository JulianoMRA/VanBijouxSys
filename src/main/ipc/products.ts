import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../database'
import {
  products,
  productVariations,
  categories,
  variationInsumos,
  insumos
} from '../database/schema'
import { sql } from 'drizzle-orm'
import { ErroDeNegocio, handleIpc } from './handle'
import { saldoArredondado } from '../database/saldo'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  DeleteVariationOptions,
  UpdateVariationInput
} from '../../renderer/src/types'

export function registerProductHandlers(): void {
  handleIpc('categories:getAll', () => {
    const db = getDb()
    return db.select().from(categories).orderBy(categories.name).all()
  })

  handleIpc('products:getAll', () => {
    const db = getDb()

    const rows = db
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

    return rows.map((product) => {
      const variations = db
        .select()
        .from(productVariations)
        .where(eq(productVariations.productId, product.id))
        .all()
      const variationsWithInsumos = variations.map((v) => {
        const recipe = db
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
        return { ...v, insumos: recipe }
      })
      return { ...product, variations: variationsWithInsumos }
    })
  })

  handleIpc('products:create', (data: CreateProductInput) => {
    const db = getDb()
    const result = db
      .insert(products)
      .values({
        name: data.name,
        categoryId: data.categoryId,
        description: data.description ?? null
      })
      .run()
    return { id: result.lastInsertRowid }
  })

  handleIpc('products:update', (data: UpdateProductInput) => {
    const db = getDb()
    db.update(products)
      .set({
        name: data.name,
        categoryId: data.categoryId,
        description: data.description ?? null
      })
      .where(eq(products.id, data.id))
      .run()
    return { success: true }
  })

  handleIpc('products:delete', (id: number) => {
    const db = getDb()
    db.delete(products).where(eq(products.id, id)).run()
    return { success: true }
  })

  /**
   * Arquivar tira o produto dos alertas, das listas e dos seletores, mas não
   * toca no histórico: as vendas antigas continuam apontando para ele. As
   * variações não são escritas — quem lê deriva o estado a partir do produto.
   */
  handleIpc('products:setArchived', (id: number, archived: boolean) => {
    const db = getDb()
    db.update(products)
      .set({ archivedAt: archived ? sql`CURRENT_TIMESTAMP` : null })
      .where(eq(products.id, id))
      .run()
    return { success: true }
  })

  handleIpc('variations:create', (data: CreateVariationInput) => {
    validarEstoqueDePecas(data.stockQuantity)
    const sqlite = getSqlite()
    const db = getDb()

    // Criar a variação e baixar os insumos precisa ser tudo ou nada: falhar no
    // meio deixaria estoque de insumo debitado para uma variação inexistente.
    const criar = sqlite.transaction(() => {
      const result = db
        .insert(productVariations)
        .values({
          productId: data.productId,
          identifier: data.identifier,
          costPrice: data.costPrice,
          salePrice: data.salePrice,
          stockQuantity: 0,
          minimumStock: data.minimumStock,
          laborCost: data.laborCost
        })
        .run()
      const variationId = Number(result.lastInsertRowid)

      substituirReceita(db, variationId, data.insumos)
      movimentarEstoqueDaVariacao(
        db,
        variationId,
        data.stockQuantity,
        data.motivoDoEstoqueInicial === 'producao'
      )

      return { id: variationId }
    })

    return criar()
  })

  handleIpc('variations:update', (data: UpdateVariationInput) => {
    // A receita é substituída inteira. Sem ela no payload, o update apagaria a
    // receita em silêncio e a produção seguinte deixaria de baixar insumos.
    if (!Array.isArray(data.insumos)) {
      throw new Error('variations:update recebido sem a receita; nada foi alterado')
    }
    if (data.ajusteDeEstoque) validarEstoqueDePecas(data.ajusteDeEstoque.novoEstoque)

    const sqlite = getSqlite()
    const db = getDb()

    const atualizar = sqlite.transaction(() => {
      db.update(productVariations)
        .set({
          identifier: data.identifier,
          costPrice: data.costPrice,
          salePrice: data.salePrice,
          minimumStock: data.minimumStock,
          laborCost: data.laborCost
        })
        .where(eq(productVariations.id, data.id))
        .run()

      substituirReceita(db, data.id, data.insumos)

      const ajuste = data.ajusteDeEstoque
      if (ajuste) {
        // A diferença é medida contra o banco, não contra o número que a tela
        // carregou: uma venda no meio do caminho não pode virar produção.
        const atual = db
          .select({ estoque: productVariations.stockQuantity })
          .from(productVariations)
          .where(eq(productVariations.id, data.id))
          .get()
        if (!atual) throw new ErroDeNegocio('Variação não encontrada.')
        movimentarEstoqueDaVariacao(
          db,
          data.id,
          ajuste.novoEstoque - atual.estoque,
          ajuste.motivo === 'producao'
        )
      }
    })

    atualizar()
    return { success: true }
  })

  /** Aplicar preço pela Precificação não tem por que regravar estoque nem receita. */
  handleIpc('variations:setSalePrice', (id: number, salePrice: number) => {
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      throw new ErroDeNegocio('Preço de venda inválido.')
    }
    const db = getDb()
    const resultado = db
      .update(productVariations)
      .set({ salePrice })
      .where(eq(productVariations.id, id))
      .run()
    if (resultado.changes === 0) throw new ErroDeNegocio('Variação não encontrada.')
    return { success: true }
  })

  /**
   * Devolver os insumos só faz sentido quando o cadastro foi um engano e as
   * peças nunca existiram. Tudo na mesma transação: se a exclusão for recusada
   * por já haver venda, a devolução é desfeita junto.
   */
  handleIpc('variations:delete', (id: number, opcoes?: DeleteVariationOptions) => {
    const sqlite = getSqlite()
    const db = getDb()

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
    return { success: true }
  })

  handleIpc('variations:setArchived', (id: number, archived: boolean) => {
    const db = getDb()
    db.update(productVariations)
      .set({ archivedAt: archived ? sql`CURRENT_TIMESTAMP` : null })
      .where(eq(productVariations.id, id))
      .run()
    return { success: true }
  })

  handleIpc('variations:addStock', (id: number, quantity: number) => {
    const sqlite = getSqlite()
    const db = getDb()

    const adicionar = sqlite.transaction(() => {
      const variation = db
        .select({ id: productVariations.id })
        .from(productVariations)
        .where(eq(productVariations.id, id))
        .get()
      if (!variation) throw new ErroDeNegocio('Variação não encontrada.')

      movimentarEstoqueDaVariacao(db, id, quantity, true)
      return { success: true }
    })

    return adicionar()
  })
}

type Db = ReturnType<typeof getDb>

function validarEstoqueDePecas(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new ErroDeNegocio('Quantidade em estoque inválida.')
  }
}

function substituirReceita(
  db: Db,
  variationId: number,
  receita: CreateVariationInput['insumos']
): void {
  db.delete(variationInsumos).where(eq(variationInsumos.variationId, variationId)).run()
  for (const item of receita) {
    db.insert(variationInsumos)
      .values({ variationId, insumoId: item.insumoId, quantity: item.quantity })
      .run()
  }
}

/**
 * Única escrita de estoque de peças fora das vendas. `pecas` negativo retira.
 * Com `acompanharInsumos`, a receita segue o movimento: peça a mais consome
 * insumo, peça a menos devolve. Precisa rodar dentro de uma transação.
 */
function movimentarEstoqueDaVariacao(
  db: Db,
  variationId: number,
  pecas: number,
  acompanharInsumos: boolean
): void {
  if (pecas === 0) return

  db.update(productVariations)
    .set({ stockQuantity: sql`stock_quantity + ${pecas}` })
    .where(eq(productVariations.id, variationId))
    .run()

  if (!acompanharInsumos) return

  const receita = db
    .select()
    .from(variationInsumos)
    .where(eq(variationInsumos.variationId, variationId))
    .all()
  for (const item of receita) {
    db.update(insumos)
      .set({ stockQuantity: saldoArredondado(-item.quantity * pecas) })
      .where(eq(insumos.id, item.insumoId))
      .run()
  }
}
