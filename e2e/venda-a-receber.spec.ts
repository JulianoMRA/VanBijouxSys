import { expect, irPara, pelaApi, test } from './app'

interface Venda {
  id: number
  customerName: string | null
  amountDue: number
  payments: Array<{ amount: number; paymentMethod: string }>
}

/** Uma peça de R$ 86,00 em estoque, para vender a receber pela tela. */
async function semear(janela: import('@playwright/test').Page): Promise<void> {
  const produto = await pelaApi<{ id: number }>(janela, 'products.create', {
    name: 'Colar Aurora',
    categoryId: 1
  })
  await pelaApi(janela, 'variations.create', {
    productId: Number(produto.id),
    identifier: 'Rosa',
    costPrice: 20,
    salePrice: 86,
    stockQuantity: 3,
    motivoDoEstoqueInicial: 'contagem',
    minimumStock: 1,
    laborCost: 0,
    insumos: []
  })
}

const vendas = (janela: import('@playwright/test').Page): Promise<Venda[]> =>
  pelaApi<Venda[]>(janela, 'sales.getAll')

test('venda a receber paga em duas vezes', async ({ vanBijoux }) => {
  const { janela, errosDeConsole } = vanBijoux
  await semear(janela)

  await irPara(janela, 'Vendas')
  await janela.getByRole('button', { name: '+ Registrar venda' }).click()
  await janela.getByRole('button', { name: 'WhatsApp' }).click()
  await janela.getByLabel('Cliente').fill('Maria')
  await janela.getByLabel('Produto').selectOption({ label: 'Colar Aurora' })
  await janela.getByLabel('Variação').selectOption({ index: 1 })
  await janela.getByRole('button', { name: 'A receber', exact: true }).click()
  await janela.getByRole('button', { name: 'Registrar venda', exact: true }).last().click()
  await expect.poll(async () => (await vendas(janela)).length).toBe(1)

  // Primeiro pagamento, parcial: R$ 50,00 no PIX.
  await janela.getByRole('button', { name: 'Receber', exact: true }).click()
  await janela.getByLabel('Valor recebido (R$)').fill('50')
  await janela.getByRole('button', { name: 'PIX', exact: true }).click()
  await janela.getByRole('button', { name: 'Confirmar recebimento' }).click()

  await expect(janela.getByText(/pago R\$\s50,00 · falta R\$\s36,00/)).toBeVisible()
  expect((await vendas(janela))[0]).toMatchObject({ customerName: 'Maria', amountDue: 36 })

  // Segundo pagamento: o que falta, que o Receber já sugere.
  await janela.getByRole('button', { name: 'Receber', exact: true }).click()
  await expect(janela.getByLabel('Valor recebido (R$)')).toHaveValue('36')
  await janela.getByRole('button', { name: 'Confirmar recebimento' }).click()

  await expect(janela.getByText(/Recebida em 2 pagamentos/)).toBeVisible()
  const [quitada] = await vendas(janela)
  expect(quitada.amountDue).toBe(0)
  expect(quitada.payments.map((p) => [p.amount, p.paymentMethod])).toEqual([
    [50, 'pix'],
    [36, 'dinheiro']
  ])
  expect(errosDeConsole).toEqual([])
})
