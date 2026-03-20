import { useState } from 'react'
import Modal from '../ui/Modal'
import type { Fair } from '../../types'

interface FairFormProps {
  fair?: Fair
  onSave: () => void
  onClose: () => void
}

export default function FairForm({ fair, onSave, onClose }: FairFormProps): JSX.Element {
  const [name, setName] = useState(fair?.name ?? '')
  const [location, setLocation] = useState(fair?.location ?? '')
  const [organizer, setOrganizer] = useState(fair?.organizer ?? '')
  const [date, setDate] = useState(fair?.date ?? '')
  const [enrollmentCost, setEnrollmentCost] = useState(fair?.enrollmentCost.toString() ?? '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!fair

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) { setError('O nome da feira é obrigatório.'); return }
    if (!location.trim()) { setError('O local é obrigatório.'); return }
    if (!date) { setError('A data é obrigatória.'); return }
    const cost = parseFloat(enrollmentCost)
    if (isNaN(cost) || cost < 0) { setError('Custo de inscrição inválido.'); return }

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.fairs.update({
          id: fair.id,
          name: name.trim(),
          location: location.trim(),
          organizer: organizer.trim() || undefined,
          date,
          enrollmentCost: cost
        })
      } else {
        await window.api.fairs.create({
          name: name.trim(),
          location: location.trim(),
          organizer: organizer.trim() || undefined,
          date,
          enrollmentCost: cost
        })
      }
      onSave()
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Editar Feira' : 'Nova Feira'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nome da feira</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Feira de Artesanato do Centro"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Local</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Praça da República"
            />
          </div>
          <div>
            <label className="label">Data</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">
              Organizador <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              className="input"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="Nome do organizador"
            />
          </div>
          <div>
            <label className="label">Custo de inscrição (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                R$
              </span>
              <input
                className="input pl-8"
                type="number"
                min="0"
                step="0.01"
                value={enrollmentCost}
                onChange={(e) => setEnrollmentCost(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar feira'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
