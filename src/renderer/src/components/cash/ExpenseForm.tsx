import { useState } from 'react'
import Modal from '../ui/Modal'
import type { CashExpense, ExpenseCategory, CreateCashExpenseInput } from '../../types'

interface ExpenseFormProps {
  expense?: CashExpense
  categories: ExpenseCategory[]
  onSave: () => void
  onClose: () => void
}

export default function ExpenseForm({ expense, categories, onSave, onClose }: ExpenseFormProps): JSX.Element {
  const [categoryId, setCategoryId] = useState<number | ''>(expense?.categoryId ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? expense.amount.toString() : '')
  const [expenseDate, setExpenseDate] = useState(() => {
    if (expense) return expense.expenseDate
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (categoryId === '') {
      setError('Selecione uma categoria.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido.')
      return
    }
    if (!description.trim()) {
      setError('Informe uma descrição.')
      return
    }

    const data: CreateCashExpenseInput = {
      categoryId: categoryId as number,
      description: description.trim(),
      amount: parsedAmount,
      expenseDate,
      notes: notes.trim() || undefined
    }

    setSaving(true)
    try {
      if (expense) {
        await window.api.cashExpenses.update({ ...data, id: expense.id })
      } else {
        await window.api.cashExpenses.create(data)
      }
      onSave()
      onClose()
    } catch {
      setError('Erro ao salvar despesa. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar despesa' : 'Nova despesa'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Data</label>
            <input
              className="input"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Descrição</label>
          <input
            className="input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compra de correntes douradas — Fornecedor X"
            maxLength={200}
          />
        </div>

        <div>
          <label className="label">Valor (R$)</label>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div>
          <label className="label">Observações <span className="text-gray-400">(opcional)</span></label>
          <textarea
            className="input resize-none"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionais…"
            maxLength={500}
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : expense ? 'Salvar alterações' : 'Registrar despesa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
