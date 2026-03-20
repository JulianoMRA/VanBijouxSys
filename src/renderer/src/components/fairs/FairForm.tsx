import { useState } from 'react'
import Modal from '../ui/Modal'
import type { Fair } from '../../types'

interface FairFormProps {
  fair?: Fair
  onSave: () => void
  onClose: () => void
}

interface CostRow {
  key: number
  description: string
  amount: string
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function getDurationDays(startDate: string, endDate: string | null | undefined): number {
  if (!endDate || endDate === startDate) return 1
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return Math.min(Math.max(diff, 1), 4)
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

let costKeyCounter = 0

export default function FairForm({ fair, onSave, onClose }: FairFormProps): JSX.Element {
  const [name, setName] = useState(fair?.name ?? '')
  const [location, setLocation] = useState(fair?.location ?? '')
  const [organizer, setOrganizer] = useState(fair?.organizer ?? '')
  const [startDate, setStartDate] = useState(fair?.date ?? '')
  const [duration, setDuration] = useState(
    fair ? getDurationDays(fair.date, fair.endDate) : 1
  )
  const [enrollmentCost, setEnrollmentCost] = useState(fair?.enrollmentCost.toString() ?? '0')
  const [additionalCosts, setAdditionalCosts] = useState<CostRow[]>(
    fair?.additionalCosts.map((c) => ({
      key: costKeyCounter++,
      description: c.description,
      amount: c.amount.toString()
    })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!fair
  const endDate = startDate ? addDays(startDate, duration - 1) : ''

  function addCost(): void {
    setAdditionalCosts((prev) => [...prev, { key: costKeyCounter++, description: '', amount: '' }])
  }

  function removeCost(key: number): void {
    setAdditionalCosts((prev) => prev.filter((c) => c.key !== key))
  }

  function updateCost(key: number, field: 'description' | 'amount', value: string): void {
    setAdditionalCosts((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
    )
  }

  const enrollmentValue = parseFloat(enrollmentCost) || 0
  const additionalTotal = additionalCosts.reduce((sum, c) => {
    const val = parseFloat(c.amount)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)
  const totalFairCost = enrollmentValue + additionalTotal

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) { setError('O nome da feira é obrigatório.'); return }
    if (!location.trim()) { setError('O local é obrigatório.'); return }
    if (!startDate) { setError('A data de início é obrigatória.'); return }
    const cost = parseFloat(enrollmentCost)
    if (isNaN(cost) || cost < 0) { setError('Custo de inscrição inválido.'); return }

    for (const c of additionalCosts) {
      if (!c.description.trim()) { setError('Preencha a descrição de todos os custos adicionais.'); return }
      const val = parseFloat(c.amount)
      if (isNaN(val) || val < 0) { setError('Valor inválido em custos adicionais.'); return }
    }

    const parsedCosts = additionalCosts.map((c) => ({
      description: c.description.trim(),
      amount: parseFloat(c.amount)
    }))

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.fairs.update({
          id: fair.id,
          name: name.trim(),
          location: location.trim(),
          organizer: organizer.trim() || undefined,
          date: startDate,
          endDate: duration > 1 ? endDate : undefined,
          enrollmentCost: cost,
          additionalCosts: parsedCosts
        })
      } else {
        await window.api.fairs.create({
          name: name.trim(),
          location: location.trim(),
          organizer: organizer.trim() || undefined,
          date: startDate,
          endDate: duration > 1 ? endDate : undefined,
          enrollmentCost: cost,
          additionalCosts: parsedCosts
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
            <label className="label">Organizador <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              className="input"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="Nome do organizador"
            />
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Data de início</label>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Duração</label>
            <select
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={1}>1 dia</option>
              <option value={2}>2 dias</option>
              <option value={3}>3 dias</option>
              <option value={4}>4 dias</option>
            </select>
          </div>
        </div>

        {duration > 1 && startDate && (
          <p className="text-xs text-blush-600 -mt-2">
            Término: <span className="font-medium">{formatDate(endDate)}</span>
          </p>
        )}

        {/* Custo de inscrição */}
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

        {/* Custos adicionais */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Custos adicionais <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <button
              type="button"
              onClick={addCost}
              className="text-xs text-blush-600 hover:text-blush-800 font-medium transition-colors"
            >
              + Adicionar custo
            </button>
          </div>

          {additionalCosts.length === 0 ? (
            <p className="text-xs text-gray-400">
              Ex: combustível, alimentação, estacionamento…
            </p>
          ) : (
            <div className="space-y-2">
              {additionalCosts.map((cost) => (
                <div key={cost.key} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder="Ex: Combustível"
                    value={cost.description}
                    onChange={(e) => updateCost(cost.key, 'description', e.target.value)}
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                      R$
                    </span>
                    <input
                      className="input pl-8"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={cost.amount}
                      onChange={(e) => updateCost(cost.key, 'amount', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCost(cost.key)}
                    className="text-gray-300 hover:text-rose-400 transition-colors text-lg leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total de custos */}
        {(enrollmentValue > 0 || additionalTotal > 0) && (
          <div className="bg-cream-50 rounded-xl px-4 py-3 text-sm space-y-1">
            {enrollmentValue > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Inscrição</span>
                <span>{enrollmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            )}
            {additionalCosts.map((c) => {
              const val = parseFloat(c.amount)
              if (!c.description || isNaN(val)) return null
              return (
                <div key={c.key} className="flex justify-between text-gray-500">
                  <span>{c.description}</span>
                  <span>{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )
            })}
            <div className="flex justify-between font-semibold text-gray-700 pt-1 border-t border-cream-200">
              <span>Custo total da feira</span>
              <span>{totalFairCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          </div>
        )}

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
