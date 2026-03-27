import { useEffect, useState } from 'react'
import FairForm from '../components/fairs/FairForm'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import type { Fair, Sale } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; fair: Fair }
  | { type: 'delete'; fair: Fair }

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function isFuture(fair: Fair): boolean {
  const lastDay = fair.endDate ?? fair.date
  return lastDay >= new Date().toISOString().slice(0, 10)
}

function formatDateRange(startDate: string, endDate: string | null): string {
  if (!endDate || endDate === startDate) return formatDate(startDate)
  const [sy, sm, sd] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  if (sy === ey && sm === em) return `${sd} a ${ed}/${em}/${sy}`
  return `${formatDate(startDate)} a ${formatDate(endDate)}`
}

export default function Fairs(): JSX.Element {
  const [fairs, setFairs] = useState<Fair[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function loadFairs(): Promise<void> {
    const [data, allSales] = await Promise.all([
      window.api.fairs.getAll(),
      window.api.sales.getAll()
    ])
    setFairs(data.slice().reverse())
    setSales(allSales)
    setLoading(false)
  }

  useEffect(() => {
    loadFairs()
  }, [])

  async function handleDelete(fair: Fair): Promise<void> {
    try {
      await window.api.fairs.delete(fair.id)
      await loadFairs()
    } catch {
      setErrorMessage(`"${fair.name}" não pode ser excluída pois possui vendas registradas.`)
    }
  }

  const upcoming = fairs.filter((f) => isFuture(f))
  const past = fairs.filter((f) => !isFuture(f))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-800">Feiras</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {fairs.length > 0
              ? `${upcoming.length} próxima${upcoming.length !== 1 ? 's' : ''} · ${past.length} realizada${past.length !== 1 ? 's' : ''}`
              : 'Nenhuma feira cadastrada'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
          + Nova feira
        </button>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600 shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : fairs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Nenhuma feira cadastrada ainda.</p>
          <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
            Cadastrar primeira feira
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Próximas feiras
              </h3>
              <div className="space-y-3">
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
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Feiras realizadas
              </h3>
              <div className="space-y-3">
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

  function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const additionalTotal = fair.additionalCosts.reduce((s, c) => s + c.amount, 0)
  const totalFairCost = fair.enrollmentCost + additionalTotal
  const totalRevenue = fairSales.reduce((s, sale) => s + sale.totalAmount, 0)
  const totalProfit = fairSales.reduce((s, sale) => s + (sale.totalAmount - sale.totalCost), 0)

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-card overflow-hidden">
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="flex gap-4 items-start flex-1 min-w-0">
          {/* Data */}
          <div
            className={`shrink-0 w-14 rounded-xl text-center py-2 ${
              upcoming ? 'bg-blush-50 text-blush-700' : 'bg-cream-100 text-gray-400'
            }`}
          >
            <p className="text-xs font-medium leading-none">
              {fair.date.slice(5, 7)}/{fair.date.slice(0, 4)}
            </p>
            <p className="text-2xl font-bold font-display leading-tight mt-0.5">
              {fair.date.slice(8, 10)}
            </p>
            {fair.endDate && fair.endDate !== fair.date && (
              <p className="text-xs font-medium leading-none mt-0.5">
                – {fair.endDate.slice(8, 10)}
              </p>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <p className="font-medium text-gray-800 text-sm">{fair.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{fair.location}</p>
            {fair.organizer && (
              <p className="text-xs text-gray-400 mt-0.5">Org: {fair.organizer}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-gray-500">
                Custo total:{' '}
                <span className="font-medium text-gray-700">
                  {totalFairCost > 0 ? formatCurrency(totalFairCost) : 'Gratuita'}
                </span>
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{formatDateRange(fair.date, fair.endDate)}</span>
              {!upcoming && fairSales.length > 0 && (
                <>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs font-medium text-emerald-600">
                    {formatCurrency(totalRevenue)} faturado
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-1 shrink-0 items-center">
          {!upcoming && fairSales.length > 0 && (
            <button
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-cream-100 transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              Vendas ({fairSales.length}) {expanded ? '▲' : '▼'}
            </button>
          )}
          <button
            className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
            onClick={onEdit}
          >
            Editar
          </button>
          <button
            className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
            onClick={onDelete}
          >
            Excluir
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-cream-100 bg-cream-50 px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left pb-2 font-medium">Data</th>
                <th className="text-left pb-2 font-medium">Itens</th>
                <th className="text-right pb-2 font-medium">Total</th>
                <th className="text-right pb-2 font-medium">Lucro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {fairSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="py-2 text-gray-500">{formatDate(sale.soldAt)}</td>
                  <td className="py-2 text-gray-500">
                    {sale.items.map((i) => `${i.productName} — ${i.variationIdentifier} (${i.quantity}x)`).join(', ')}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(sale.totalAmount)}</td>
                  <td className="py-2 text-right text-emerald-600">{formatCurrency(sale.totalAmount - sale.totalCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream-300">
                <td colSpan={2} className="pt-2 text-xs text-gray-400">
                  Lucro bruto: {formatCurrency(totalProfit)} · Custo da feira: {formatCurrency(totalFairCost)} · Lucro líquido: {formatCurrency(totalProfit - totalFairCost)}
                </td>
                <td className="pt-2 text-right font-semibold text-blush-700">{formatCurrency(totalRevenue)}</td>
                <td className="pt-2 text-right font-semibold text-emerald-600">{formatCurrency(totalProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
