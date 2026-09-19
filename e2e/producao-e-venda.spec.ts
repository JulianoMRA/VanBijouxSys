import { expect, irPara, pelaApi, test } from './app'

interface Insumo {
  id: number
  name: string
  stockQuantity: number
}

interface Variacao {
  id: number
  identifier: string
  stockQuantity: number
  salePrice: number
  insumos: Array<{ insumoId: number; quantity: number }>
}

interface Produto {
  id: number
  name: string
  variations: Variacao[]
}

/** Cenário: um insumo com 1000 cm e uma variação que usa 12,5 cm por peça. */
async function semear(janela: import('@playwright/test').Page): Promise<{
  fio: number
  produto: number
  variacao: number
}> {
  const fio = await pelaApi<{ id: number }>(janela, 'insumos.create', {
    name: 'Fio de nylon',
    unit: 'cm',
    costPerUnit: 0.02,
    stockQuantity: 1000,
    minimumStock: 0
  })
  const produto = await pelaApi<{ id: number }>(janela, 'products.create', {
    name: 'Colar Aurora',
    categoryId: 1
  })
  const variacao = await pelaApi<{ id: number }>(janela, 'variations.create', {
    productId: Number(produto.id),
    identifier: 'Rosa',
    costPrice: 3,
    salePrice: 25,
    stockQuantity: 0,
    motivoDoEstoqueInicial: 'contagem',
    minimumStock: 1,
    laborCost: 0,
    insumos: [{ insumoId: Number(fio.id), quantity: 12.5 }]
  })
  return { fio: Number(fio.id), produto: Number(produto.id), variacao: Number(variacao.id) }
}

const estoqueDoInsumo = async (
  janela: import('@playwright/test').Page,
  id: number
): Promise<number> =>
  (await pelaApi<Insumo[]>(janela, 'insumos.getAll')).find((i) => i.id === id)!.stockQuantity

const variacaoSalva = async (
  janela: import('@playwright/test').Page,
  id: number
): Promise<Variacao> =>
  (await pelaApi<Produto[]>(janela, 'products.getAll'))
    .flatMap((p) => p.variations)
    .find((v) => v.id === id)!

test('produzir peças pela tela baixa os insumos da receita', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux
  const { fio, variacao } = await semear(janela)

  await irPara(janela, 'Produtos')
  await janela.getByText('Colar Aurora').click()
  await janela.getByRole('button', { name: '+ Estoque' }).first().click()
  await janela.getByRole('spinbutton').or(janela.getByRole('textbox')).last().fill('4')
  await janela.getByRole('button', { name: /Adicionar/ }).click()

  await expect.poll(async () => (await variacaoSalva(janela, variacao)).stockQuantity).toBe(4)
  // 4 peças × 12,5 cm = 50 cm saem do fio.
  expect(await estoqueDoInsumo(janela, fio)).toBe(950)
  expect(errosDeConsole).toEqual([])
})

test('vender mais do que o estoque avisa e deixa o saldo negativo', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux
  const { variacao } = await semear(janela)
  await pelaApi(janela, 'variations.addStock', variacao, 2)

  await irPara(janela, 'Vendas')
  await janela.getByRole('button', { name: '+ Registrar venda' }).click()
  await janela.getByRole('button', { name: 'WhatsApp' }).click()
  await janela.getByLabel('Produto').selectOption({ label: 'Colar Aurora' })
  await janela.getByLabel('Variação').selectOption({ index: 1 })
  await janela.getByLabel('Qtd.').fill('5')

  await expect(janela.getByText(/O estoque registrado é 2 un\./)).toBeVisible()

  await janela.getByRole('button', { name: 'Registrar venda', exact: true }).last().click()

  await expect.poll(async () => (await variacaoSalva(janela, variacao)).stockQuantity).toBe(-3)
  expect(errosDeConsole).toEqual([])
})

test('aplicar preço pela Precificação mantém a receita da variação', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux
  const { variacao } = await semear(janela)

  await irPara(janela, 'Precificação')
  await janela.getByPlaceholder('0,00').last().fill('10')
  const seletorProduto = janela.getByRole('combobox').nth(1)
  await seletorProduto.selectOption({ index: 1 })
  await janela.getByRole('combobox').nth(2).selectOption({ index: 1 })
  await janela.getByRole('button', { name: /^Aplicar R\$/ }).click()

  await expect.poll(async () => (await variacaoSalva(janela, variacao)).salePrice).not.toBe(25)
  const depois = await variacaoSalva(janela, variacao)
  // O defeito da 1.11.0: aplicar preço apagava a receita da variação.
  expect(depois.insumos).toHaveLength(1)
  expect(depois.insumos[0].quantity).toBe(12.5)
  expect(errosDeConsole).toEqual([])
})

test('número com ponto de milhar é gravado como mil', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux

  await irPara(janela, 'Estoque')
  await janela.getByRole('button', { name: '+ Novo insumo' }).click()
  await janela.getByLabel('Nome do insumo').fill('Miçanga dourada')
  await janela.getByRole('button', { name: 'Un.' }).click()
  await janela.getByLabel(/Custo por/).fill('0,35')
  await janela.getByLabel(/Estoque atual/).fill('1.000')
  await janela.getByRole('button', { name: 'Cadastrar insumo' }).click()

  await expect
    .poll(async () => {
      const insumos = await pelaApi<Insumo[]>(janela, 'insumos.getAll')
      return insumos.find((i) => i.name === 'Miçanga dourada')?.stockQuantity
    })
    .toBe(1000)
  expect(errosDeConsole).toEqual([])
})

test('todas as telas abrem sem erro de console', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux
  await semear(janela)

  for (const tela of [
    'Dashboard',
    'Produtos',
    'Precificação',
    'Estoque',
    'Vendas',
    'Feiras',
    'Caixa'
  ]) {
    await irPara(janela, tela)
    await expect(janela.locator('h2')).toBeVisible()
  }

  expect(errosDeConsole).toEqual([])
})
