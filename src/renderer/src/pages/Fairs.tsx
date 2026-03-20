import { useEffect, useState } from 'react'
import FairForm from '../components/fairs/FairForm'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Fair } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; fair: Fair }
  | { type: 'delete'; fair: Fair }

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function isFuture(dateStr: string): boolean {
  return dateStr >= new Date().toISOString().slice(0, 10)
}

export default function Fairs(): JSX.Element {
  const [fairs, setFairs] = useState<Fair[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadFairs(): Promise<void> {
    const data = await window.api.fairs.getAll()
    setFairs(data.slice().reverse())
    setLoading(false)
  }

  useEffect(() => {
    loadFairs()
  }, [])

  async function handleDelete(fair: Fair): Promise<void> {
    await window.api.fairs.delete(fair.id)
    await loadFairs()
  }

  const upcoming = fairs.filter((f) => isFuture(f.date))
  const past = fairs.filter((f) => !isFuture(f.date))

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
                    onEdit={() => setModal({ type: 'edit', fair })}
                    onDelete={() => setModal({ type: 'delete', fair })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {modal?.type === 'new' && (
        <FairForm onSave={loadFairs} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <FairForm fair={modal.fair} onSave={loadFairs} onClose={() => setModal(null)} />
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
  onEdit,
  onDelete
}: {
  fair: Fair
  upcoming: boolean
  onEdit: () => void
  onDelete: () => void
}): JSX.Element {
  function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-card px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 items-start">
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
          </div>

          {/* Info */}
          <div>
            <p className="font-medium text-gray-800 text-sm">{fair.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{fair.location}</p>
            {fair.organizer && (
              <p className="text-xs text-gray-400 mt-0.5">Org: {fair.organizer}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-gray-500">
                Inscrição:{' '}
                <span className="font-medium text-gray-700">
                  {fair.enrollmentCost > 0 ? formatCurrency(fair.enrollmentCost) : 'Gratuita'}
                </span>
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{formatDate(fair.date)}</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-1 shrink-0">
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
    </div>
  )
}
