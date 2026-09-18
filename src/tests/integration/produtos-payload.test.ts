import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararAmbienteIpc, type AmbienteIpc } from '../helpers/ambiente-ipc'
import { queryAll } from '../helpers/testDb'
import { criarInsumo, criarProduto, criarVariacao } from '../helpers/estoque'
import { MENSAGEM_PAYLOAD_INVALIDO } from '../../main/ipc/mensagens'

vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)

let ambiente: AmbienteIpc
let fio: number
let produto: number
let variacao: number

beforeEach(async () => {
  ambiente = await prepararAmbienteIpc()
  fio = await criarInsumo(ambiente, { stockQuantity: 1000 })
  produto = await criarProduto(ambiente, 'Colar')
  variacao = await criarVariacao(ambiente, {
    productId: produto,
    receita: [{ insumoId: fio, quantity: 10 }],
    stockQuantity: 4,
    motivoDoEstoqueInicial: 'producao'
  })
})

function estado(): unknown {
  return ['products', 'product_variations', 'variation_insumos', 'insumos'].map((t) =>
    queryAll(ambiente.banco, `SELECT * FROM ${t} ORDER BY id`)
  )
}

async function recusaSemGravar(canal: string, ...args: unknown[]): Promise<void> {
  const antes = estado()
  await expect(ambiente.chamar(canal, ...args)).rejects.toThrow(MENSAGEM_PAYLOAD_INVALIDO)
  expect(estado()).toEqual(antes)
}

/** Formato que o VariationForm envia ao cadastrar. */
const novaVariacao = (): Record<string, unknown> => ({
  productId: produto,
  identifier: 'Dourado',
  costPrice: 3.5,
  salePrice: 25,
  stockQuantity: 2,
  motivoDoEstoqueInicial: 'producao',
  minimumStock: 1,
  laborCost: 0,
  insumos: [{ insumoId: fio, quantity: 2.5 }]
})

/** Formato que o VariationForm envia ao editar sem mudar o estoque. */
const variacaoEditada = (): Record<string, unknown> => ({
  identifier: 'Rosa',
  costPrice: 3,
  salePrice: 27,
  minimumStock: 1,
  laborCost: 0,
  insumos: [{ insumoId: fio, quantity: 10 }],
  id: variacao,
  productId: produto,
  ajusteDeEstoque: undefined
})

describe('produtos e variações: payloads das telas continuam aceitos', () => {
  it('should_create_and_update_a_product_with_or_without_description', async () => {
    const { id } = await ambiente.chamar<{ id: number }>('products:create', {
      name: 'Pulseira',
      categoryId: 1,
      description: undefined
    })
    await expect(
      ambiente.chamar('products:update', {
        id: Number(id),
        name: 'Pulseira fina',
        categoryId: 2,
        description: 'banhada'
      })
    ).resolves.toEqual({ success: true })
  })

  it('should_create_a_variation_with_the_form_payload', async () => {
    await expect(ambiente.chamar('variations:create', novaVariacao())).resolves.toMatchObject({
      id: expect.any(Number)
    })
  })

  it('should_update_a_variation_without_and_with_a_stock_adjustment', async () => {
    await expect(ambiente.chamar('variations:update', variacaoEditada())).resolves.toEqual({
      success: true
    })
    await expect(
      ambiente.chamar('variations:update', {
        ...variacaoEditada(),
        ajusteDeEstoque: { novoEstoque: 6, motivo: 'contagem' }
      })
    ).resolves.toEqual({ success: true })
  })

  it('should_accept_stock_price_archive_and_delete_calls_from_the_screens', async () => {
    await expect(ambiente.chamar('variations:addStock', variacao, 3)).resolves.toEqual({
      success: true
    })
    await expect(ambiente.chamar('variations:setSalePrice', variacao, 31)).resolves.toEqual({
      success: true
    })
    await expect(ambiente.chamar('variations:setArchived', variacao, true)).resolves.toEqual({
      success: true
    })
    await expect(ambiente.chamar('products:setArchived', produto, false)).resolves.toEqual({
      success: true
    })
    const outra = await criarVariacao(ambiente, { productId: produto, receita: [] })
    await expect(
      ambiente.chamar('variations:delete', outra, { devolverInsumos: false })
    ).resolves.toEqual({ success: true })
  })
})

describe('produtos: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_a_blank_name_or_a_category_sent_as_text', async () => {
    await recusaSemGravar('products:create', { name: '   ', categoryId: 1 })
    await recusaSemGravar('products:create', { name: 'Anel', categoryId: '1' })
  })

  it('should_refuse_a_description_that_is_not_text', async () => {
    await recusaSemGravar('products:create', { name: 'Anel', categoryId: 1, description: 5 })
  })

  it('should_refuse_updating_without_an_id', async () => {
    await recusaSemGravar('products:update', { name: 'Anel', categoryId: 1 })
  })

  it('should_refuse_delete_and_archive_with_invalid_arguments', async () => {
    await recusaSemGravar('products:delete', 'todos')
    await recusaSemGravar('products:setArchived', produto, 1)
  })
})

describe('variações: payload fora do formato é recusado sem gravar', () => {
  it('should_refuse_creating_with_a_blank_identifier_or_text_prices', async () => {
    await recusaSemGravar('variations:create', { ...novaVariacao(), identifier: ' ' })
    await recusaSemGravar('variations:create', { ...novaVariacao(), costPrice: '3,50' })
  })

  it('should_refuse_an_unknown_stock_reason', async () => {
    await recusaSemGravar('variations:create', {
      ...novaVariacao(),
      motivoDoEstoqueInicial: 'compra'
    })
  })

  it('should_refuse_a_broken_recipe', async () => {
    await recusaSemGravar('variations:create', { ...novaVariacao(), insumos: 'fio' })
    await recusaSemGravar('variations:create', {
      ...novaVariacao(),
      insumos: [{ insumoId: fio, quantity: 0 }]
    })
    await recusaSemGravar('variations:create', {
      ...novaVariacao(),
      insumos: [{ insumoId: String(fio), quantity: 2 }]
    })
  })

  it('should_refuse_a_fractional_minimum_stock', async () => {
    await recusaSemGravar('variations:create', { ...novaVariacao(), minimumStock: 1.5 })
  })

  it('should_refuse_an_update_with_a_malformed_adjustment', async () => {
    await recusaSemGravar('variations:update', {
      ...variacaoEditada(),
      ajusteDeEstoque: { novoEstoque: 6, motivo: 'venda' }
    })
    await recusaSemGravar('variations:update', {
      ...variacaoEditada(),
      ajusteDeEstoque: { novoEstoque: '6', motivo: 'contagem' }
    })
  })

  it('should_refuse_delete_options_that_are_not_boolean', async () => {
    await recusaSemGravar('variations:delete', variacao, { devolverInsumos: 'sim' })
  })

  it('should_refuse_adding_fractional_zero_or_text_pieces', async () => {
    await recusaSemGravar('variations:addStock', variacao, 1.5)
    await recusaSemGravar('variations:addStock', variacao, 0)
    await recusaSemGravar('variations:addStock', variacao, '2')
  })

  it('should_refuse_a_price_sent_as_text_and_an_archive_flag_as_text', async () => {
    await recusaSemGravar('variations:setSalePrice', variacao, '27')
    await recusaSemGravar('variations:setArchived', variacao, 'false')
  })
})
