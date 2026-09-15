import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { criarInsumo } from '../helpers/estoque'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { name: 'Fio', unit: 'cm', stockQuantity: 100 })
})

const insumos = (): unknown[] => queryAll(ambiente.banco, 'SELECT * FROM insumos ORDER BY id')

/** Mesmo formato que o InsumoForm envia ao criar. */
const novo = {
  name: 'Fecho',
  unit: 'unidade',
  costPerUnit: 0.45,
  stockQuantity: 0,
  minimumStock: 10
}

async function recusaSemGravar(canal: string, ...args: unknown[]): Promise<void> {
  const antes = insumos()
  await expect(ambiente.chamar(canal, ...args)).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  expect(insumos()).toEqual(antes)
}

describe('insumos: payloads que o renderer envia continuam aceitos', () => {
  it('should_create_with_the_insumo_form_payload', async () => {
    await expect(ambiente.chamar('insumos:create', novo)).resolves.toMatchObject({ id: 2 })
  })

  it('should_update_keeping_a_negative_saved_stock', async () => {
    ambiente.banco.run('UPDATE insumos SET stock_quantity = -20 WHERE id = ?', [fio])

    await expect(
      ambiente.chamar('insumos:update', {
        id: fio,
        name: 'Fio',
        unit: 'cm',
        costPerUnit: 0.012,
        stockQuantity: -20,
        minimumStock: 0
      })
    ).resolves.toEqual({ success: true })
  })

  it('should_add_a_fractional_quantity_to_stock', async () => {
    await expect(ambiente.chamar('insumos:addStock', fio, 12.5)).resolves.toEqual({
      success: true
    })
  })

  it('should_archive_and_unarchive_with_a_boolean', async () => {
    await expect(ambiente.chamar('insumos:setArchived', fio, true)).resolves.toEqual({
      success: true
    })
    await expect(ambiente.chamar('insumos:setArchived', fio, false)).resolves.toEqual({
      success: true
    })
  })
})

describe('insumos: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_creating_with_an_unknown_unit', async () => {
    await recusaSemGravar('insumos:create', { ...novo, unit: 'kg' })
  })

  it('should_refuse_creating_with_a_number_sent_as_text', async () => {
    await recusaSemGravar('insumos:create', { ...novo, costPerUnit: '0,45' })
  })

  it('should_refuse_creating_with_a_blank_name', async () => {
    await recusaSemGravar('insumos:create', { ...novo, name: '   ' })
  })

  it('should_refuse_creating_with_negative_cost_or_minimum', async () => {
    await recusaSemGravar('insumos:create', { ...novo, costPerUnit: -1 })
    await recusaSemGravar('insumos:create', { ...novo, minimumStock: -1 })
  })

  it('should_refuse_creating_with_a_non_finite_number', async () => {
    await recusaSemGravar('insumos:create', { ...novo, stockQuantity: Number.POSITIVE_INFINITY })
  })

  it('should_refuse_updating_without_a_valid_id', async () => {
    await recusaSemGravar('insumos:update', { ...novo, id: String(fio) })
    await recusaSemGravar('insumos:update', { ...novo })
  })

  it('should_refuse_adding_zero_negative_or_missing_quantity', async () => {
    await recusaSemGravar('insumos:addStock', fio, 0)
    await recusaSemGravar('insumos:addStock', fio, -5)
    await recusaSemGravar('insumos:addStock', fio)
  })

  it('should_refuse_archiving_with_a_text_flag', async () => {
    await recusaSemGravar('insumos:setArchived', fio, 'true')
  })

  it('should_refuse_deleting_with_an_invalid_id', async () => {
    await recusaSemGravar('insumos:delete', 'todos')
    await recusaSemGravar('insumos:delete', 1.5)
  })

  it('should_refuse_exporting_without_content_or_file_name', async () => {
    await expect(ambiente.chamar('insumos:exportCsv', 'nome;estoque')).rejects.toThrow(
      MENSAGEM_PAYLOAD_INVALIDO
    )
    await expect(ambiente.chamar('insumos:exportCsv', 42, 'insumos.csv')).rejects.toThrow(
      MENSAGEM_PAYLOAD_INVALIDO
    )
  })
})

describe('insumos:exportCsv', () => {
  it('should_return_not_saved_when_the_user_cancels_the_dialog', async () => {
    await expect(
      ambiente.chamar('insumos:exportCsv', 'nome;estoque', 'insumos.csv')
    ).resolves.toEqual({ salvo: false })
  })

  it('should_write_the_csv_with_a_utf8_bom_where_the_user_chose', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'vanbijoux-csv-'))
    const caminho = join(pasta, 'insumos_todos.csv')
    const conteudo = ['Nome;Estoque', 'Miçanga;1000'].join('\n')
    try {
      const comDialogo = await prepararAmbienteIpc({ caminhoParaSalvar: caminho })

      await expect(
        comDialogo.chamar('insumos:exportCsv', conteudo, 'insumos_todos.csv')
      ).resolves.toEqual({ salvo: true, caminho })

      const bytes = readFileSync(caminho)
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      expect(bytes.subarray(3).toString('utf8')).toBe(conteudo)
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  })
})
