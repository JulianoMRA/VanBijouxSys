import { useEffect, useState } from 'react'
import FairForm from '../components/fairs/FairForm'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate, formatDateRange } from '../utils/format'
import type { Fair, Sale } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; fair: Fair }
  | { type: 'delete'; fair: Fair }

function isFuture(fair: Fair): boolean {
  const lastDay = fair.endDate ?? fair.date
  return lastDay >= new Date().toISOString().slice(0, 10)
}

export default function Fairs(): JSX.Element {
  const [fairs, setFairs] = useState<Fair[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function loadFairs(): Promise<void> {
    try {
      const [data, allSales] = await Promise.all([
        window.api.fairs.getAll(),
        window.api.sales.getAll()
      ])
      setFairs(data.slice().reverse())
      setSales(allSales)
    } catch (err) {
      setErrorMessage('Erro ao carregar feiras.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFairs() }, [])

  async function handleDelete(fair: Fair): Promise<void> {
    try {
      await window.api.fairs.delete(fair.id)
      await loadFairs()
    } catch {
      setErrorMessage(`"${fair.name}" não pode ser excluída pois possui vendas registradas.`)
    }
  }

  const upcoming = fairs.filter((f) => isFuture(f))
  const past     = fairs.filter((f) => !isFuture(f))

  const subtitleText = fairs.length === 0
    ? 'Nenhuma feira cadastrada'
    : `${upcoming.length} próxima${upcoming.length !== 1 ? 's' : ''} · ${past.length} realizada${past.length !== 1 ? 's' : ''}`

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Eventos</div>
          <h1 className="page-title">Feiras</h1>
          <div className="page-subtitle">{subtitleText}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
          + Nova feira
        </button>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : fairs.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhuma feira cadastrada</h3>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal({ type: 'new' })}>
            Cadastrar primeira feira
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {upcoming.length > 0 && (
            <section>
              <div className="alerts-section-label">Próximas feiras</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcoming.map((fair) => (
                  <FairCard
                    key={fair.id}
                    fair={fair}
                    upcoming
                    fairSales={sales.filter((s) => s.fairId === fair.id)}
                    onEdit={() => setModal({ type: 'edit', fair })}
                    onDelete={() => setModal({ type: 'delete', fair })}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <div className="alerts-section-label">Feiras realizadas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.map((fair) => (
                  <FairCard
                    key={fair.id}
                    fair={fair}
                    upcoming={false}
                    fairSales={sales.filter((s) => s.fairId === fair.id)}
                    onEdit={() => setModal({ type: 'edit', fair })}
                    onDelete={() => setModal({ type: 'delete', fair })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <FairForm onSave={() => { loadFairs(); showToast('Feira salva!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <FairForm fair={modal.fair} onSave={() => { loadFairs(); showToast('Feira atualizada!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir feira"
          message={`Tem certeza que deseja excluir "${modal.fair.name}"?`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(modal.fair)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function FairCard({
  fair,
  upcoming,
  fairSales,
  onEdit,
  onDelete
}: {
  fair: Fair
  upcoming: boolean
  fairSales: Sale[]
  onEdit: () => void
  onDelete: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const additionalTotal  = fair.additionalCosts.reduce((s, c) => s + c.amount, 0)
  const totalFairCost    = fair.enrollmentCost + additionalTotal
  const totalRevenue     = fairSales.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalProfit      = fairSales.reduce((s, sale) => s + (sale.totalAmount - sale.totalCost), 0)

  return (
    <div className="product-row">
      <div className="product-row-head" style={{ cursor: 'default', alignItems: 'flex-start', background: 'transparent' }}>
        {/* Badge de data */}
        <div
          style={{
            flexShrink: 0,
            width: 52,
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            padding: '8px 0',
            background: upcoming ? 'var(--accent-wash)' : 'var(--surface-alt)',
            color: upcoming ? 'var(--accent-2)' : 'var(--ink-4)'
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>
            {fair.date.slice(5, 7)}/{fair.date.slice(0, 4)}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>
            {fair.date.slice(8, 10)}
          </div>
          {fair.endDate && fair.endDate !== fair.date && (
            <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1, marginTop: 2 }}>
              – {fair.endDate.slice(8, 10)}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="product-name">{fair.name}</div>
          <div className="product-desc">{fair.location}</div>
          {fair.organizer && (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>Org: {fair.organizer}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Custo:{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
                {totalFairCost > 0 ? formatCurrency(totalFairCost) : 'Gratuita'}
              </span>
            </span>
            <span style={{ color: 'var(--hairline)', fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{formatDateRange(fair.date, fair.endDate)}</span>
            {!upcoming && fairSales.length > 0 && (
              <>
                <span style={{ color: 'var(--hairline)', fontSize: 11 }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--good)' }}>
                  {formatCurrency(totalRevenue)} faturado
                </span>
              </>
            )}
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {!upcoming && fairSales.length > 0 && (
            <button className="btn btn-xs btn-ghost" onClick={() => setExpanded((v) => !v)}>
              Vendas ({fairSales.length}) {expanded ? '▲' : '▼'}
            </button>
          )}
          <button className="btn btn-xs btn-ghost" onClick={onEdit}>Editar</button>
          <button
            className="btn btn-xs btn-ghost"
            style={{ color: 'var(--bad)', borderColor: 'transparent' }}
            onClick={onDelete}
          >
            Excluir
          </button>
        </div>
      </div>

      {expanded && (
        <div className="product-row-body">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Itens</th>
                <th className="num">Total</th>
                <th className="num">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {fairSales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDate(sale.soldAt)}</td>
                  <td>
                    {sale.items.map((i) => `${i.productName} — ${i.variationIdentifier} (${i.quantity}x)`).join(', ')}
                  </td>
                  <td className="num" style={{ fontWeight: 500 }}>{formatCurrency(sale.totalAmount)}</td>
                  <td className="num" style={{ color: 'var(--good)', fontWeight: 500 }}>
                    {formatCurrency(sale.totalAmount - sale.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ paddingTop: 10, fontSize: 11, color: 'var(--ink-4)' }}>
                  Lucro bruto: {formatCurrency(totalProfit)} · Custo da feira: {formatCurrency(totalFairCost)} · Lucro líquido:{' '}
                  <span style={{ fontWeight: 600, color: totalProfit - totalFairCost >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                    {formatCurrency(totalProfit - totalFairCost)}
                  </span>
                </td>
                <td className="num" style={{ paddingTop: 10, fontWeight: 600, color: 'var(--accent)' }}>
                  {formatCurrency(totalRevenue)}
                </td>
                <td className="num" style={{ paddingTop: 10, fontWeight: 600, color: 'var(--good)' }}>
                  {formatCurrency(totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
