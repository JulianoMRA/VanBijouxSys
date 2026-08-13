import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SaleForm from '../components/sales/SaleForm'
import MarkReceivedModal from '../components/sales/MarkReceivedModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ActionMenu from '../components/ui/ActionMenu'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/format'
import type { Sale, SaleChannel, PaymentMethod } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; sale: Sale }
  | { type: 'delete'; sale: Sale }
  | { type: 'markReceived'; sale: Sale }
  | { type: 'unmarkReceived'; sale: Sale }

type ChannelFilter = SaleChannel | 'Todos' | 'areceber'

const CANAIS: SaleChannel[] = ['Feira', 'WhatsApp', 'Instagram', 'Outro']

const CANAL_CORES: Record<SaleChannel, string> = {
  Feira: 'bg-plum-100 text-plum-500',
  WhatsApp: 'bg-sage-100 text-sage-600',
  Instagram: 'bg-honey-100 text-honey-500',
  Outro: 'bg-bone-300 text-ink-600'
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  areceber: 'A receber'
}

function isPending(sale: Sale): boolean {
  return sale.paymentMethod === 'areceber'
}

/** "Crédito (3,49%) · taxa − R$ 8,72", "PIX · sem taxa", "A receber". */
function descricaoPagamento(sale: Sale): string {
  if (isPending(sale)) return 'A receber · ainda não entrou no caixa'

  const partes = [PAYMENT_LABELS[sale.paymentMethod]]
  if (sale.feePercentage > 0) {
    partes[0] += ` (${sale.feePercentage.toLocaleString('pt-BR')}%)`
    partes.push(`taxa − ${formatCurrency(sale.feeAmount)}`)
  } else {
    partes.push('sem taxa')
  }
  if (sale.receivedAt) partes.push(`recebido em ${formatDate(sale.receivedAt)}`)
  return partes.join(' · ')
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
      result = result.filter(isPending)
    } else if (channelFilter !== 'Todos') {
      result = result.filter((s) => s.channel === channelFilter)
    }

    const termo = search.trim().toLowerCase()
    if (termo) {
      result = result.filter(
        (s) =>
          (s.fairName ?? '').toLowerCase().includes(termo) ||
          s.items.some(
            (i) =>
              i.productName.toLowerCase().includes(termo) ||
              i.variationIdentifier.toLowerCase().includes(termo)
          )
      )
    }

    return result
  }, [sales, channelFilter, search])

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalNetRevenue = filtered.reduce((s, sale) => s + sale.netAmount, 0)
  const totalProfit = filtered.reduce((s, sale) => s + (sale.netAmount - sale.totalCost), 0)
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0
  const pendentes = sales.filter(isPending)
  const totalReceivable = pendentes.reduce((s, sale) => s + sale.netAmount, 0)
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
            placeholder="Buscar por produto ou feira…"
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
        {errorMessage && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-[11px] border border-bone-500 bg-clay-100 px-4 py-3">
            <p className="text-body text-clay-600">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="shrink-0 text-lg leading-none text-clay-500 hover:text-clay-600"
            >
              ×
            </button>
          </div>
        )}

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
                {margem !== null ? `margem ${margem.toFixed(1)}%` : '—'}
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
                {formatCurrency(totalReceivable)}
              </p>
              <p className="mt-1.5 text-aux text-honey-600">
                {pendentes.length === 0
                  ? 'nada pendente'
                  : `${pendentes.length} venda${pendentes.length !== 1 ? 's' : ''} pendente${pendentes.length !== 1 ? 's' : ''}`}
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
              const pendente = isPending(sale)
              const [ano, mes, dia] = sale.soldAt.split('-')

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
                      <p className="text-body font-semibold tabular-nums text-ink-900">
                        {dia}/{mes}
                      </p>
                      <p className="mt-px text-meta tabular-nums text-ink-300">{ano}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`shrink-0 rounded-[5px] px-2 py-0.5 text-meta font-bold tracking-[0.03em] ${CANAL_CORES[sale.channel]}`}
                        >
                          {sale.channel.toUpperCase()}
                        </span>
                        <span className="text-body font-medium text-ink-900">
                          {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                        </span>
                        {sale.fairName && (
                          <span className="truncate text-aux text-ink-300">{sale.fairName}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-aux text-ink-400">{descricaoPagamento(sale)}</p>
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
                          onClick={() => setModal({ type: 'markReceived', sale })}
                        >
                          ✓ Recebida
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

                      <div className="mt-3 flex flex-wrap gap-6 border-t border-bone-400 pt-2.5 text-aux text-ink-400">
                        <span>
                          Custo:{' '}
                          <strong className="font-semibold tabular-nums text-ink-800">
                            {formatCurrency(sale.totalCost)}
                          </strong>
                        </span>
                        {sale.feeAmount > 0 && (
                          <span>
                            Taxa {PAYMENT_LABELS[sale.paymentMethod].toLowerCase()}:{' '}
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
          message="Tem certeza? Os itens serão devolvidos ao estoque automaticamente."
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(modal.sale)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'markReceived' && (
        <MarkReceivedModal
          sale={modal.sale}
          onSave={() => {
            loadSales()
            showToast('Venda marcada como recebida!')
          }}
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
