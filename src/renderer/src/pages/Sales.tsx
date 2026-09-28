import { useEffect, useMemo, useState } from 'react'
import AvisoDeErro from '../components/ui/AvisoDeErro'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SaleForm from '../components/sales/SaleForm'
import ReceberPagamentoModal from '../components/sales/ReceberPagamentoModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ActionMenu from '../components/ui/ActionMenu'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate, formatPercent, partesDaData, SEM_DATA } from '../utils/format'
import { PAYMENT_LABELS } from '../utils/formas-de-pagamento'
import { vendaCorrespondeABusca } from '../utils/busca-de-vendas'
import { nomesDeClientes } from '../utils/sugestoes-de-clientes'
import { descreverPagamento, estaPendente, somaDoQueFalta } from '../utils/recebimentos'
import type { Sale, SaleChannel, SalePayment } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; sale: Sale }
  | { type: 'delete'; sale: Sale }
  | { type: 'receber'; sale: Sale }
  | { type: 'deletePayment'; payment: SalePayment }
  | { type: 'unmarkReceived'; sale: Sale }

type ChannelFilter = SaleChannel | 'Todos' | 'areceber'

const CANAIS: SaleChannel[] = ['Feira', 'WhatsApp', 'Instagram', 'Outro']

const CANAL_CORES: Record<SaleChannel, string> = {
  Feira: 'bg-plum-100 text-plum-500',
  WhatsApp: 'bg-sage-100 text-sage-600',
  Instagram: 'bg-honey-100 text-honey-500',
  Outro: 'bg-bone-300 text-ink-600'
}

const TH = 'py-1.5 text-meta font-bold uppercase tracking-[0.1em] text-ink-200'

export default function Sales(): JSX.Element {
  const [sales, setSales] = useState<Sale[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [expandedSale, setExpandedSale] = useState<number | null>(null)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('Todos')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function loadSales(): Promise<void> {
    try {
      const data = await window.api.sales.getAll()
      setSales(data)
    } catch (err) {
      setErrorMessage('Erro ao carregar vendas.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [])

  async function handleDelete(sale: Sale): Promise<void> {
    try {
      await window.api.sales.delete(sale.id)
      if (expandedSale === sale.id) setExpandedSale(null)
      await loadSales()
    } catch {
      setErrorMessage('Não foi possível excluir esta venda. Tente novamente.')
    }
  }

  async function handleDeletePayment(payment: SalePayment): Promise<void> {
    try {
      await window.api.sales.deletePayment(payment.id)
      await loadSales()
      showToast('Pagamento excluído — o valor voltou para o que falta receber.')
    } catch {
      setErrorMessage('Não foi possível excluir o pagamento. Tente novamente.')
    }
  }

  async function handleUnmarkReceived(sale: Sale): Promise<void> {
    try {
      await window.api.sales.unmarkAsReceived(sale.id)
      await loadSales()
      showToast('Recebimento desfeito — venda voltou para "A receber".')
    } catch {
      setErrorMessage('Não foi possível desfazer o recebimento. Tente novamente.')
    }
  }

  const filtered = useMemo(() => {
    let result = sales

    if (channelFilter === 'areceber') {
      result = result.filter(estaPendente)
    } else if (channelFilter !== 'Todos') {
      result = result.filter((s) => s.channel === channelFilter)
    }

    return result.filter((s) => vendaCorrespondeABusca(s, search))
  }, [sales, channelFilter, search])

  const sugestoesDeClientes = useMemo(() => nomesDeClientes(sales), [sales])

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalNetRevenue = filtered.reduce((s, sale) => s + sale.netAmount, 0)
  const totalProfit = filtered.reduce((s, sale) => s + (sale.netAmount - sale.totalCost), 0)
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0
  // O botão do filtro soma tudo o que está pendente; o card segue a busca, como os
  // outros cards, para mostrar quanto a cliente procurada deve. Os dois contam só o
  // que falta receber (RN-17), não o total das vendas.
  const pendentes = sales.filter(estaPendente)
  const totalReceivable = somaDoQueFalta(pendentes)
  const pendentesFiltradas = filtered.filter(estaPendente)
  const totalReceivableFiltrado = somaDoQueFalta(pendentesFiltradas)
  const margem = totalNetRevenue > 0 ? (totalProfit / totalNetRevenue) * 100 : null
  const filtrando = channelFilter !== 'Todos' || search.trim() !== ''

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">
              {filtrando
                ? `${filtered.length} de ${sales.length} vendas`
                : `${sales.length} venda${sales.length !== 1 ? 's' : ''} registrada${sales.length !== 1 ? 's' : ''}`}
            </p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              Vendas
            </h2>
          </div>
          <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
            + Registrar venda
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-[260px]"
            placeholder="Buscar por cliente, produto ou feira…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mx-1 h-[22px] w-px bg-bone-500" />
          {(['Todos', ...CANAIS] as ChannelFilter[]).map((canal) => {
            const contagem =
              canal === 'Todos' ? sales.length : sales.filter((s) => s.channel === canal).length
            const ativo = channelFilter === canal
            // Canal sem nenhuma venda vira ruído no filtro.
            if (contagem === 0 && canal !== 'Todos' && !ativo) return null
            return (
              <button
                key={canal}
                onClick={() => setChannelFilter(canal)}
                className={`rounded-lg px-3 py-1.5 text-body transition-colors ${
                  ativo
                    ? 'bg-ink-900 font-semibold text-bone-50'
                    : 'font-medium text-ink-600 hover:bg-bone-300'
                }`}
              >
                {canal} <span className={ativo ? 'opacity-55' : 'text-ink-200'}>{contagem}</span>
              </button>
            )
          })}
          {pendentes.length > 0 && (
            <button
              onClick={() => setChannelFilter(channelFilter === 'areceber' ? 'Todos' : 'areceber')}
              className={`ml-auto rounded-lg px-3 py-1.5 text-aux font-semibold transition-colors ${
                channelFilter === 'areceber'
                  ? 'bg-honey-500 text-bone-50'
                  : 'bg-honey-100 text-honey-500 hover:bg-honey-200'
              }`}
            >
              {pendentes.length} a receber · {formatCurrency(totalReceivable)}
            </button>
          )}
        </div>
      </div>

      <div className="px-8 pt-5">
        <AvisoDeErro mensagem={errorMessage} onFechar={() => setErrorMessage('')} />

        {filtered.length > 0 && (
          <div className="mb-4 grid grid-cols-4 gap-3.5">
            <div className="card px-[22px] py-[18px]">
              <p className="label">Faturamento</p>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink-900">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="mt-1.5 text-aux text-ink-400">
                líquido {formatCurrency(totalNetRevenue)}
              </p>
            </div>
            <div className="card px-[22px] py-[18px]">
              <p className="label">Lucro</p>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink-900">
                {formatCurrency(totalProfit)}
              </p>
              <p className="mt-1.5 text-aux text-ink-400">
                {margem !== null ? `margem ${formatPercent(margem)}` : '—'}
              </p>
            </div>
            <div className="card px-[22px] py-[18px]">
              <p className="label">Ticket médio</p>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink-900">
                {formatCurrency(avgTicket)}
              </p>
              <p className="mt-1.5 text-aux text-ink-400">por venda</p>
            </div>
            <div className="rounded-card border border-honey-200 bg-honey-100 px-[22px] py-[18px]">
              <p className="label text-honey-500">A receber</p>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-honey-600">
                {formatCurrency(totalReceivableFiltrado)}
              </p>
              <p className="mt-1.5 text-aux text-honey-600">
                {pendentesFiltradas.length === 0
                  ? 'nada pendente'
                  : `${pendentesFiltradas.length} venda${pendentesFiltradas.length !== 1 ? 's' : ''} pendente${pendentesFiltradas.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card flex h-40 items-center justify-center">
            <p className="text-body text-ink-300">Carregando…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex h-48 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhuma venda encontrada.</p>
            {!filtrando && (
              <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
                Registrar primeira venda
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-bone-400 bg-bone-50">
            <div className="flex items-center gap-4 border-b border-bone-300 px-[22px] py-2.5 text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
              <span className="w-[74px] shrink-0">Data</span>
              <span className="flex-1">Venda</span>
              <span className="w-[120px] shrink-0 text-right">Total</span>
              <span className="w-[110px] shrink-0 text-right">Lucro</span>
              <span className="w-[128px] shrink-0" />
            </div>

            {filtered.map((sale) => {
              const isExpanded = expandedSale === sale.id
              const profit = sale.netAmount - sale.totalCost
              const pendente = estaPendente(sale)
              const data = partesDaData(sale.soldAt)

              const acoes = [
                ...(pendente
                  ? [
                      {
                        label: 'Editar venda',
                        onClick: () => setModal({ type: 'edit', sale })
                      }
                    ]
                  : []),
                ...(sale.receivedAt
                  ? [
                      {
                        label: 'Desfazer recebimento',
                        onClick: () => setModal({ type: 'unmarkReceived', sale })
                      }
                    ]
                  : []),
                {
                  label: 'Excluir venda',
                  danger: true,
                  onClick: () => setModal({ type: 'delete', sale })
                }
              ]

              return (
                <div
                  key={sale.id}
                  className={`border-b border-bone-300 last:border-b-0 ${
                    pendente ? 'bg-honey-100/60' : isExpanded ? 'bg-bone-100' : ''
                  }`}
                >
                  <div
                    className="flex cursor-pointer items-center gap-4 px-[22px] py-3.5 transition-colors hover:bg-bone-100"
                    onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                  >
                    <div className="w-[74px] shrink-0">
                      {data ? (
                        <>
                          <p className="text-body font-semibold tabular-nums text-ink-900">
                            {data.dia}/{data.mes}
                          </p>
                          <p className="mt-px text-meta tabular-nums text-ink-300">{data.ano}</p>
                        </>
                      ) : (
                        // Venda antiga gravada sem data: editar e informar o dia resolve.
                        <p className="text-aux font-semibold text-honey-500">{SEM_DATA}</p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`shrink-0 rounded-[5px] px-2 py-0.5 text-meta font-bold tracking-[0.03em] ${CANAL_CORES[sale.channel]}`}
                        >
                          {sale.channel.toUpperCase()}
                        </span>
                        {sale.customerName && (
                          <span className="truncate text-body font-semibold text-ink-900">
                            {sale.customerName}
                          </span>
                        )}
                        <span
                          className={`text-body ${
                            sale.customerName ? 'text-ink-500' : 'font-medium text-ink-900'
                          }`}
                        >
                          {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                        </span>
                        {sale.fairName && (
                          <span className="truncate text-aux text-ink-300">{sale.fairName}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-aux text-ink-400">{descreverPagamento(sale)}</p>
                    </div>

                    <div className="w-[120px] shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink-900">
                        {formatCurrency(sale.totalAmount)}
                      </p>
                      {sale.feeAmount > 0 && (
                        <p className="mt-px text-meta tabular-nums text-ink-300">
                          líq. {formatCurrency(sale.netAmount)}
                        </p>
                      )}
                    </div>

                    <div className="w-[110px] shrink-0 text-right">
                      <p
                        className={`text-body font-semibold tabular-nums ${
                          pendente ? 'text-honey-500' : 'text-sage-500'
                        }`}
                      >
                        {pendente ? 'est. ' : '+ '}
                        {formatCurrency(profit)}
                      </p>
                    </div>

                    <div
                      className="flex w-[128px] shrink-0 items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pendente ? (
                        <button
                          className="whitespace-nowrap text-aux font-semibold text-sage-600 hover:text-sage-500"
                          onClick={() => setModal({ type: 'receber', sale })}
                        >
                          Receber
                        </button>
                      ) : (
                        <button
                          className="whitespace-nowrap text-aux font-semibold text-wine-500 hover:text-wine-600"
                          onClick={() => setModal({ type: 'edit', sale })}
                        >
                          Editar
                        </button>
                      )}
                      <ActionMenu items={acoes} />
                      {isExpanded ? (
                        <ChevronUp size={15} className="text-ink-200" />
                      ) : (
                        <ChevronDown size={15} className="text-ink-200" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pb-4 pl-[112px] pr-[22px]">
                      <table className="w-full text-micro">
                        <thead>
                          <tr>
                            <th className={`${TH} text-left`}>Produto</th>
                            <th className={`${TH} text-center`}>Qtd.</th>
                            <th className={`${TH} text-right`}>Unit.</th>
                            <th className={`${TH} text-right`}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item) => (
                            <tr key={item.id} className="border-t border-bone-300">
                              <td className="py-2 text-ink-800">
                                <span className="font-medium text-ink-900">{item.productName}</span>{' '}
                                <span className="text-ink-300">— {item.variationIdentifier}</span>
                              </td>
                              <td className="py-2 text-center tabular-nums text-ink-600">
                                {item.quantity}
                              </td>
                              <td className="py-2 text-right tabular-nums text-ink-600">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="py-2 text-right font-semibold tabular-nums text-ink-900">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {sale.payments.length > 0 && (
                        <table className="mt-3 w-full text-micro">
                          <thead>
                            <tr>
                              <th className={`${TH} text-left`}>Pagamento</th>
                              <th className={`${TH} text-left`}>Forma</th>
                              <th className={`${TH} text-right`}>Valor</th>
                              <th className={`${TH} text-right`}>Taxa</th>
                              <th className={TH} />
                            </tr>
                          </thead>
                          <tbody>
                            {sale.payments.map((pagamento) => (
                              <tr key={pagamento.id} className="border-t border-bone-300">
                                <td className="py-2 tabular-nums text-ink-600">
                                  {formatDate(pagamento.receivedAt)}
                                </td>
                                <td className="py-2 text-ink-800">
                                  {PAYMENT_LABELS[pagamento.paymentMethod]}
                                </td>
                                <td className="py-2 text-right font-semibold tabular-nums text-ink-900">
                                  {formatCurrency(pagamento.amount)}
                                </td>
                                <td className="py-2 text-right tabular-nums text-ink-600">
                                  {pagamento.feeAmount > 0
                                    ? `− ${formatCurrency(pagamento.feeAmount)}`
                                    : '—'}
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    className="text-aux font-semibold text-clay-500 hover:text-clay-600"
                                    aria-label={`Excluir o pagamento de ${formatCurrency(pagamento.amount)} recebido em ${formatDate(pagamento.receivedAt)}`}
                                    onClick={() =>
                                      setModal({ type: 'deletePayment', payment: pagamento })
                                    }
                                  >
                                    Excluir
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div className="mt-3 flex flex-wrap gap-6 border-t border-bone-400 pt-2.5 text-aux text-ink-400">
                        <span>
                          Custo:{' '}
                          <strong className="font-semibold tabular-nums text-ink-800">
                            {formatCurrency(sale.totalCost)}
                          </strong>
                        </span>
                        {sale.feeAmount > 0 && (
                          <span>
                            {sale.payments.length > 0
                              ? 'Taxas dos pagamentos'
                              : `Taxa ${PAYMENT_LABELS[sale.paymentMethod].toLowerCase()}`}
                            :{' '}
                            <strong className="font-semibold tabular-nums text-clay-500">
                              − {formatCurrency(sale.feeAmount)}
                            </strong>
                          </span>
                        )}
                        <span>
                          Líquido:{' '}
                          <strong className="font-semibold tabular-nums text-ink-900">
                            {formatCurrency(sale.netAmount)}
                          </strong>
                        </span>
                        <span className="ml-auto">
                          Lucro:{' '}
                          <strong
                            className={`font-semibold tabular-nums ${pendente ? 'text-honey-500' : 'text-sage-500'}`}
                          >
                            {formatCurrency(profit)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <SaleForm
          sugestoesDeClientes={sugestoesDeClientes}
          onSave={() => {
            loadSales()
            showToast('Venda registrada!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <SaleForm
          sale={modal.sale}
          sugestoesDeClientes={sugestoesDeClientes}
          onSave={() => {
            loadSales()
            showToast('Venda atualizada!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir venda"
          message={
            modal.sale.payments.length > 0
              ? `Tem certeza? Os itens voltam ao estoque, e ${
                  modal.sale.payments.length === 1
                    ? 'o pagamento registrado sai'
                    : `os ${modal.sale.payments.length} pagamentos registrados saem`
                } do caixa.`
              : 'Tem certeza? Os itens serão devolvidos ao estoque automaticamente.'
          }
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(modal.sale)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'receber' && (
        <ReceberPagamentoModal
          sale={modal.sale}
          onSave={() => {
            loadSales()
            showToast('Pagamento registrado!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deletePayment' && (
        <ConfirmDialog
          title="Excluir pagamento"
          message={`O pagamento de ${formatCurrency(modal.payment.amount)} recebido em ${formatDate(modal.payment.receivedAt)} sai do caixa, e o valor volta a faltar na venda.`}
          confirmLabel="Excluir pagamento"
          danger
          onConfirm={() => handleDeletePayment(modal.payment)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'unmarkReceived' && (
        <ConfirmDialog
          title="Desfazer recebimento"
          message="A venda voltará ao status 'A receber' e sairá do caixa. Confirmar?"
          confirmLabel="Desfazer"
          onConfirm={() => handleUnmarkReceived(modal.sale)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
