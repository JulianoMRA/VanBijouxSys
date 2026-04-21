import { useEffect, useState } from 'react'
import SaleForm from '../components/sales/SaleForm'
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
  credito: 'Crédito'
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

  useEffect(() => { loadSales() }, [])

  async function handleDelete(sale: Sale): Promise<void> {
    try {
      await window.api.sales.delete(sale.id)
      if (expandedSale === sale.id) setExpandedSale(null)
      await loadSales()
    } catch {
      setErrorMessage('Não foi possível excluir esta venda. Tente novamente.')
    }
  }

  const filtered = channelFilter === 'Todos'
    ? sales
    : sales.filter((s) => s.channel === channelFilter)

  const totalRevenue    = filtered.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalNetRevenue = filtered.reduce((s, sale) => s + sale.netAmount, 0)
  const totalProfit     = filtered.reduce((s, sale) => s + (sale.netAmount - sale.totalCost), 0)
  const avgTicket       = filtered.length > 0 ? totalRevenue / filtered.length : 0

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Histórico</div>
          <h1 className="page-title">Vendas</h1>
          {sales.length > 0 && (
            <div className="page-subtitle">
              {filtered.length} venda{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
          + Registrar venda
        </button>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Filtro de canal */}
      <div className="chips" style={{ marginBottom: 16 }}>
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setChannelFilter(f.value)}
            className={`chip${channelFilter === f.value ? ' active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      {filtered.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="kpi">
            <div className="kpi-label">Faturamento bruto</div>
            <div className="kpi-value">{formatCurrency(totalRevenue)}</div>
            <div className="kpi-sub">
              {filtered.length} venda{filtered.length !== 1 ? 's' : ''} · líquido {formatCurrency(totalNetRevenue)}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Lucro</div>
            <div className="kpi-value kpi-value-good">{formatCurrency(totalProfit)}</div>
            <div className="kpi-sub">
              {totalNetRevenue > 0 ? `${((totalProfit / totalNetRevenue) * 100).toFixed(1)}% de margem` : '—'}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Ticket médio</div>
            <div className="kpi-value">{formatCurrency(avgTicket)}</div>
            <div className="kpi-sub">por venda</div>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhuma venda encontrada</h3>
          {channelFilter === 'Todos' && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal({ type: 'new' })}>
              Registrar primeira venda
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((sale) => {
            const isExpanded = expandedSale === sale.id
            const profit = sale.netAmount - sale.totalCost

            return (
              <div key={sale.id} className="product-row" style={{ cursor: 'default' }}>
                <div
                  className="product-row-head"
                  onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Badge label={sale.channel} variant={channelVariant(sale.channel as SaleChannel)} />
                      {sale.fairName && (
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{sale.fairName}</span>
                      )}
                      <span className="badge">
                        {PAYMENT_LABELS[sale.paymentMethod]}
                        {sale.feePercentage > 0 ? ` (${sale.feePercentage}%)` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                      {formatDate(sale.soldAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="price-main">{formatCurrency(sale.totalAmount)}</div>
                    {sale.feeAmount > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>líq. {formatCurrency(sale.netAmount)}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--good)', fontWeight: 500 }}>
                      +{formatCurrency(profit)}
                    </div>
                  </div>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="btn btn-xs btn-ghost" onClick={() => setModal({ type: 'edit', sale })}>
                      Editar
                    </button>
                    <button
                      className="btn btn-xs btn-ghost"
                      style={{ color: 'var(--bad)', borderColor: 'transparent' }}
                      onClick={() => setModal({ type: 'delete', sale })}
                    >
                      Excluir
                    </button>
                  </div>

                  <span style={{ color: 'var(--ink-5)', fontSize: 12, marginLeft: 4 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {isExpanded && (
                  <div className="product-row-body">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Produto / Variação</th>
                          <th className="num">Qtd.</th>
                          <th className="num">Preço unit.</th>
                          <th className="num">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <span style={{ fontWeight: 500 }}>{item.productName}</span>
                              <span style={{ color: 'var(--ink-4)', marginLeft: 4 }}>— {item.variationIdentifier}</span>
                            </td>
                            <td className="num">{item.quantity}</td>
                            <td className="num">{formatCurrency(item.unitPrice)}</td>
                            <td className="num" style={{ fontWeight: 500 }}>
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} style={{ paddingTop: 10, fontSize: 11, color: 'var(--ink-4)' }}>
                            Custo total: {formatCurrency(sale.totalCost)}
                          </td>
                          <td className="num" style={{ paddingTop: 10, fontWeight: 600, color: 'var(--accent)' }}>
                            {formatCurrency(sale.totalAmount)}
                          </td>
                        </tr>
                        {sale.feeAmount > 0 && (
                          <>
                            <tr>
                              <td colSpan={3} style={{ fontSize: 11, color: 'var(--bad)' }}>
                                Taxa {PAYMENT_LABELS[sale.paymentMethod]} ({sale.feePercentage}%)
                              </td>
                              <td className="num" style={{ fontSize: 11, color: 'var(--bad)' }}>
                                − {formatCurrency(sale.feeAmount)}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={3} style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>
                                Valor líquido recebido
                              </td>
                              <td className="num" style={{ fontSize: 11, fontWeight: 600, color: 'var(--good)' }}>
                                {formatCurrency(sale.netAmount)}
                              </td>
                            </tr>
                          </>
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
    </div>
  )
}
