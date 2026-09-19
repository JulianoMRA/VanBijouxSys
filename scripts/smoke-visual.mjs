// Captura as sete telas do app de verdade, com dados semeados pelo IPC.
//
// Uso: npm run smoke:visual [-- <pasta-de-saida>]
//
// Abre o Electron compilado numa pasta de dados nova, cria um cenário pequeno e
// previsível pelo próprio window.api e fotografa cada tela. Nada toca o banco da
// máquina: a pasta de dados é temporária e some no fim, como nos testes de ponta
// a ponta.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from 'playwright'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SAIDA = resolve(process.argv[2] ?? join(RAIZ, 'smoke-visual'))
const LARGURA = Number(process.env.SMOKE_LARGURA ?? 1440)
const ALTURA = Number(process.env.SMOKE_ALTURA ?? 900)

const TELAS = [
  { rota: '/', arquivo: '1-painel.png', nome: 'Painel' },
  { rota: '/products', arquivo: '2-produtos.png', nome: 'Produtos' },
  { rota: '/price-calculator', arquivo: '3-precificacao.png', nome: 'Precificação' },
  { rota: '/stock', arquivo: '4-estoque.png', nome: 'Estoque' },
  { rota: '/sales', arquivo: '5-vendas.png', nome: 'Vendas' },
  { rota: '/fairs', arquivo: '6-feiras.png', nome: 'Feiras' },
  { rota: '/cash', arquivo: '7-caixa.png', nome: 'Caixa' }
]

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Cenário pequeno: dá para ver número em toda tela, sem virar um banco de
 * mentira grande. As datas são contadas a partir de hoje, senão o painel abre
 * no mês atual e mostra "nenhuma venda registrada".
 */
async function semear(janela) {
  const dia = (atras) => {
    const d = new Date()
    d.setDate(d.getDate() - atras)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const datas = {
    feira: dia(12),
    vendaDaFeira: dia(12),
    vendaWhatsapp: dia(6),
    vendaAReceber: dia(2),
    despesa: dia(15)
  }

  await janela.evaluate(async (datas) => {
    /** @type {any} */
    const api = (/** @type {any} */ (window)).api
    const fio = await api.insumos.create({
      name: 'Fio de nylon 0,4mm',
      unit: 'cm',
      costPerUnit: 0.02,
      stockQuantity: 1000,
      minimumStock: 200
    })
    const fecho = await api.insumos.create({
      name: 'Fecho lagosta dourado',
      unit: 'unidade',
      costPerUnit: 0.45,
      stockQuantity: 12,
      minimumStock: 50
    })

    const colar = await api.products.create({
      name: 'Colar Aurora',
      categoryId: 1,
      description: 'Banhado a ouro'
    })
    const rosa = await api.variations.create({
      productId: Number(colar.id),
      identifier: 'Rosa',
      costPrice: 3.5,
      salePrice: 25,
      stockQuantity: 6,
      motivoDoEstoqueInicial: 'producao',
      minimumStock: 2,
      laborCost: 10,
      insumos: [
        { insumoId: Number(fio.id), quantity: 12.5 },
        { insumoId: Number(fecho.id), quantity: 1 }
      ]
    })
    await api.variations.create({
      productId: Number(colar.id),
      identifier: 'Dourado',
      costPrice: 4,
      salePrice: 30,
      stockQuantity: 1,
      motivoDoEstoqueInicial: 'contagem',
      minimumStock: 3,
      laborCost: 10,
      insumos: [{ insumoId: Number(fio.id), quantity: 15 }]
    })

    const pulseira = await api.products.create({ name: 'Pulseira Luar', categoryId: 2 })
    const prata = await api.variations.create({
      productId: Number(pulseira.id),
      identifier: 'Prata',
      costPrice: 2,
      salePrice: 18,
      stockQuantity: 4,
      motivoDoEstoqueInicial: 'contagem',
      minimumStock: 1,
      laborCost: 8,
      insumos: []
    })

    const feira = await api.fairs.create({
      name: 'Feira do Bosque',
      location: 'Praça da República',
      organizer: 'Associação do Bairro',
      date: datas.feira,
      enrollmentCost: 50,
      additionalCosts: [{ description: 'Mesa', amount: 20 }]
    })

    await api.sales.create({
      channel: 'Feira',
      fairId: Number(feira.id),
      soldAt: datas.vendaDaFeira,
      paymentMethod: 'dinheiro',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 50,
      items: [{ variationId: Number(rosa.id), quantity: 2, unitPrice: 25, unitCost: 3.5 }]
    })
    await api.sales.create({
      channel: 'WhatsApp',
      soldAt: datas.vendaWhatsapp,
      paymentMethod: 'pix',
      feePercentage: 1.2,
      feeAmount: 0.22,
      netAmount: 17.78,
      items: [{ variationId: Number(prata.id), quantity: 1, unitPrice: 18, unitCost: 2 }]
    })
    await api.sales.create({
      channel: 'Instagram',
      soldAt: datas.vendaAReceber,
      paymentMethod: 'areceber',
      feePercentage: 0,
      feeAmount: 0,
      netAmount: 30,
      items: [{ variationId: Number(rosa.id), quantity: 1, unitPrice: 30, unitCost: 3.5 }]
    })

    const categoria = await api.expenseCategories.create({ name: 'Material' })
    await api.cashExpenses.create({
      categoryId: Number(categoria.id),
      description: 'Compra de fio e fechos',
      amount: 87.4,
      expenseDate: datas.despesa,
      notes: 'Fornecedor do centro'
    })
    await api.cashSettings.setOpeningBalance(150)
  }, datas)
}

const app = await _electron.launch({
  args: [RAIZ],
  env: { ...process.env, VANBIJOUX_USER_DATA: mkdtempSync(join(tmpdir(), 'van-bijoux-smoke-')) }
})
const pastaDeDados = await app.evaluate(({ app: eletron }) => eletron.getPath('userData'))
const janela = await app.firstWindow()

const erros = []
janela.on('console', (mensagem) => {
  if (mensagem.type() === 'error') erros.push(mensagem.text())
})
janela.on('pageerror', (erro) => erros.push(erro.message))

await janela.waitForSelector('text=Van Bijoux')
await app.evaluate(({ BrowserWindow }, tamanho) => {
  BrowserWindow.getAllWindows()[0].setSize(tamanho.largura, tamanho.altura)
}, { largura: LARGURA, altura: ALTURA })

await semear(janela)
// As telas buscam os dados ao montar: sem recarregar, a foto sai com o estado
// vazio que existia antes da semeadura.
await janela.reload()
await janela.waitForSelector('text=Van Bijoux')
await pausa(1200)

mkdirSync(SAIDA, { recursive: true })

for (const tela of TELAS) {
  await janela.evaluate((rota) => {
    window.location.hash = `#${rota}`
  }, tela.rota)
  // O painel monta gráficos com animação; sem a espera a foto sai pela metade.
  await pausa(1800)
  const caminho = join(SAIDA, tela.arquivo)
  await janela.screenshot({ path: caminho })
  console.log(`ok   ${tela.nome.padEnd(14)} ${caminho}`)
}

console.log(`\nerros de console: ${erros.length === 0 ? 'nenhum' : erros.join(' | ')}`)
console.log(`capturas em: ${SAIDA}`)

await app.close()
rmSync(pastaDeDados, { recursive: true, force: true })

if (erros.length > 0) process.exitCode = 1
