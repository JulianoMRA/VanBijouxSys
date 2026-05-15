import { useEffect, useState } from 'react'
import SaleForm from '../components/sales/SaleForm'
import MarkReceivedModal from '../components/sales/MarkReceivedModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
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

const CHANNEL_FILTERS: { label: string; value: SaleChannel | 'Todos' }[] = [
  { label: 'Todos', value: 'Todos' },
  { label: 'Feira', value: 'Feira' },
  { label: 'WhatsApp', value: 'WhatsApp' },
  { label: 'Instagram', value: 'Instagram' },
  { label: 'Outro', value: 'Outro' }
]

function channelVariant(channel: SaleChannel): 'category' | 'success' | 'default' | 'warning' {
  if (channel === 'Feira') return 'category'
  if (channel === 'WhatsApp') return 'success'
  if (channel === 'Instagram') return 'warning'
  return 'default'
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  areceber: 'A receber'
}

export default function Sales(): JSX.Element {
  const [sales, setSales] = useState<Sale[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [expandedSale, setExpandedSale] = useState<number | null>(null)
  const [channelFilter, setChannelFilter] = useState<SaleChannel | 'Todos'>('Todos')
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

  function isPending(sale: Sale): boolean {
    return sale.paymentMethod === 'areceber'
  }

  const filtered = channelFilter === 'Todos'
    ? sales
    : sales.filter((s) => s.channel === channelFilter)

  const totalRevenue = filtered.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalNetRevenue = filtered.reduce((s, sale) => s + sale.netAmount, 0)
  const totalProfit = filtered.reduce((s, sale) => s + (sale.netAmount - sale.totalCost), 0)
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0
  const totalReceivable = filtered.filter(isPending).reduce((s, sale) => s + sale.netAmount, 0)
  const receivableCount = filtered.filter(isPending).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-semibold text-gray-800">Vendas</h2>
        <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
          + Registrar venda
        </button>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600 shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {/* Filtro de canal */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setChannelFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              channelFilter === f.value
                ? 'bg-blush-500 text-white'
                : 'bg-white border border-cream-300 text-gray-600 hover:bg-cream-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      {filtered.length > 0 && (
        <div className={`grid ${receivableCount > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-5`}>
          <div className="card py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Faturamento bruto</p>
            <p className="font-display text-xl font-semibold text-gray-800">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} venda{filtered.length !== 1 ? 's' : ''} · líquido {formatCurrency(totalNetRevenue)}
            </p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Lucro</p>
            <p className="font-display text-xl font-semibold text-emerald-600">{formatCurrency(totalProfit)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalNetRevenue > 0 ? `${((totalProfit / totalNetRevenue) * 100).toFixed(1)}% de margem` : '—'}
            </p>
          </div>
          <div className="card py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ticket médio</p>
            <p className="font-display text-xl font-semibold text-gray-800">{formatCurrency(avgTicket)}</p>
            <p className="text-xs text-gray-400 mt-0.5">por venda</p>
          </div>
          {receivableCount > 0 && (
            <div className="card py-4 bg-amber-50 border-amber-200">
              <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">A receber</p>
              <p className="font-display text-xl font-semibold text-amber-700">{formatCurrency(totalReceivable)}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {receivableCount} venda{receivableCount !== 1 ? 's' : ''} pendente{receivableCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Nenhuma venda encontrada.</p>
          {channelFilter === 'Todos' && (
            <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
              Registrar primeira venda
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sale) => {
            const isExpanded = expandedSale === sale.id
            const profit = sale.netAmount - sale.totalCost

            return (
              <div
                key={sale.id}
                className={`bg-white rounded-2xl border shadow-card overflow-hidden ${
                  isPending(sale) ? 'border-amber-200' : 'border-cream-200'
                }`}
              >
                <div
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                    isPending(sale) ? 'hover:bg-amber-50' : 'hover:bg-cream-50'
                  }`}
                  onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={sale.channel} variant={channelVariant(sale.channel as SaleChannel)} />
                      {sale.fairName && (
                        <span className="text-xs text-gray-400">{sale.fairName}</span>
                      )}
                      {isPending(sale) ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                          A receber · Pendente
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-cream-100 px-2 py-0.5 rounded-lg">
                          {PAYMENT_LABELS[sale.paymentMethod]}
                          {sale.feePercentage > 0 ? ` (${sale.feePercentage}%)` : ''}
                          {sale.receivedAt && ` · recebido em ${formatDate(sale.receivedAt)}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(sale.soldAt)}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(sale.totalAmount)}</p>
                    {sale.feeAmount > 0 && (
                      <p className="text-xs text-gray-400">líq. {formatCurrency(sale.netAmount)}</p>
                    )}
                    <p className={`text-xs ${isPending(sale) ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {isPending(sale) ? 'lucro estimado ' : '+'}
                      {formatCurrency(profit)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isPending(sale) && (
                      <button
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        onClick={() => setModal({ type: 'markReceived', sale })}
                      >
                        ✓ Marcar recebida
                      </button>
                    )}
                    {!isPending(sale) && sale.receivedAt && (
                      <button
                        className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                        onClick={() => setModal({ type: 'unmarkReceived', sale })}
                      >
                        ↶ Desfazer
                      </button>
                    )}
                    <button
                      className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
                      onClick={() => setModal({ type: 'edit', sale })}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      onClick={() => setModal({ type: 'delete', sale })}
                    >
                      Excluir
                    </button>
                  </div>

                  <span className="text-gray-300 text-sm ml-1">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div className="border-t border-cream-100 bg-cream-50 px-5 py-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase tracking-wide">
                          <th className="text-left pb-2 font-medium">Produto / Variação</th>
                          <th className="text-center pb-2 font-medium">Qtd.</th>
                          <th className="text-right pb-2 font-medium">Preço unit.</th>
                          <th className="text-right pb-2 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cream-200">
                        {sale.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 text-gray-700">
                              <span className="font-medium">{item.productName}</span>
                              <span className="text-gray-400 ml-1">— {item.variationIdentifier}</span>
                            </td>
                            <td className="py-2 text-center text-gray-500">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-2 text-right font-medium text-gray-800">
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-cream-300">
                          <td colSpan={3} className="pt-2 text-xs text-gray-400">Custo total: {formatCurrency(sale.totalCost)}</td>
                          <td className="pt-2 text-right font-semibold text-blush-700">
                            {formatCurrency(sale.totalAmount)}
                          </td>
                        </tr>
                        {sale.feeAmount > 0 && (
                          <tr>
                            <td colSpan={3} className="pt-1 text-xs text-rose-500">
                              Taxa {PAYMENT_LABELS[sale.paymentMethod]} ({sale.feePercentage}%)
                            </td>
                            <td className="pt-1 text-right text-xs text-rose-500">
                              − {formatCurrency(sale.feeAmount)}
                            </td>
                          </tr>
                        )}
                        {sale.feeAmount > 0 && (
                          <tr>
                            <td colSpan={3} className="text-xs text-gray-500 font-medium">Valor líquido recebido</td>
                            <td className="text-right text-xs font-semibold text-emerald-700">
                              {formatCurrency(sale.netAmount)}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <SaleForm onSave={() => { loadSales(); showToast('Venda registrada!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <SaleForm sale={modal.sale} onSave={() => { loadSales(); showToast('Venda atualizada!') }} onClose={() => setModal(null)} />
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
          onSave={() => { loadSales(); showToast('Venda marcada como recebida!') }}
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
