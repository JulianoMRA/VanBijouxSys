import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import { eq, sql } from 'drizzle-orm'
import { getDb, getSqlite } from '../database'
import { insumos } from '../database/schema'
import { SQL_INSUMOS_COM_USO } from '../database/consultas-estoque'
import { saldoArredondado } from '../database/saldo'
import { ErroDeNegocio, handleIpc } from './handle'
import type { CreateInsumoInput, Insumo, UpdateInsumoInput } from '../../renderer/src/types'

/** Sem o BOM o Excel abre o CSV com a acentuação quebrada. */
const BOM_UTF8 = String.fromCharCode(0xfeff)

/**
 * Trocar a unidade não converte nada: 20 cm de fio na receita viram 20 g. Com
 * receita, a troca é recusada, porque as quantidades vivem em outra tela e
 * ninguém veria a mudança de sentido — conta até variação arquivada, que pode
 * voltar. Com saldo, a troca só vale junto com a contagem na unidade nova, que
 * o formulário mostra ao lado do campo.
 */
function validarTrocaDeUnidade(data: UpdateInsumoInput, estoqueSalvo: number): void {
  const { receitas } = getSqlite()
    .prepare(
      'SELECT COUNT(DISTINCT variation_id) AS receitas FROM variation_insumos WHERE insumo_id = ?'
    )
    .get(data.id) as { receitas: number }
  if (receitas > 0) {
    throw new ErroDeNegocio(
      `A unidade não pode mudar: este insumo está em ${receitas} receita${receitas !== 1 ? 's' : ''}, e as quantidades passariam a valer em outra unidade. Cadastre um insumo novo com a unidade certa.`
    )
  }
  if (estoqueSalvo !== 0 && data.stockQuantity === estoqueSalvo) {
    throw new ErroDeNegocio(
      'Para trocar a unidade, informe também o estoque atual na unidade nova.'
    )
  }
}

export function registerInsumoHandlers(): void {
  handleIpc('insumos:getAll', () => {
    return getSqlite().prepare(SQL_INSUMOS_COM_USO).all() as Insumo[]
  })

  handleIpc('insumos:create', (data: CreateInsumoInput) => {
    const db = getDb()
    const result = db
      .insert(insumos)
      .values({
        name: data.name,
        unit: data.unit,
        costPerUnit: data.costPerUnit,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .run()
    return { id: Number(result.lastInsertRowid) }
  })

  handleIpc('insumos:update', (data: UpdateInsumoInput) => {
    const db = getDb()
    const atual = db
      .select({ unit: insumos.unit, stockQuantity: insumos.stockQuantity })
      .from(insumos)
      .where(eq(insumos.id, data.id))
      .get()
    if (!atual) throw new ErroDeNegocio('Insumo não encontrado.')
    if (atual.unit !== data.unit) validarTrocaDeUnidade(data, atual.stockQuantity)

    db.update(insumos)
      .set({
        name: data.name,
        unit: data.unit,
        costPerUnit: data.costPerUnit,
        stockQuantity: data.stockQuantity,
        minimumStock: data.minimumStock
      })
      .where(eq(insumos.id, data.id))
      .run()
    return { success: true }
  })

  handleIpc('insumos:addStock', (id: number, quantity: number) => {
    const db = getDb()
    const resultado = db
      .update(insumos)
      .set({ stockQuantity: saldoArredondado(quantity) })
      .where(eq(insumos.id, id))
      .run()
    if (resultado.changes === 0) throw new ErroDeNegocio('Insumo não encontrado.')
    return { success: true }
  })

  handleIpc('insumos:delete', (id: number) => {
    const db = getDb()
    db.delete(insumos).where(eq(insumos.id, id)).run()
    return { success: true }
  })

  /**
   * Arquivar tira o insumo dos alertas, da lista e dos seletores de receita.
   * Não bloqueia se ele ainda for usado por variação ativa: a tela avisa e ela
   * decide. As receitas existentes continuam apontando para ele.
   */
  handleIpc('insumos:setArchived', (id: number, archived: boolean) => {
    const db = getDb()
    db.update(insumos)
      .set({ archivedAt: archived ? sql`CURRENT_TIMESTAMP` : null })
      .where(eq(insumos.id, id))
      .run()
    return { success: true }
  })

  handleIpc('insumos:exportCsv', async (csvContent: string, defaultFileName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return { salvo: false }

    writeFileSync(result.filePath, BOM_UTF8 + csvContent, 'utf8')
    return { salvo: true, caminho: result.filePath }
  })
}
