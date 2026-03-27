import { useEffect, useMemo, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Settings, Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import ExpenseForm from '../components/cash/ExpenseForm'
import { useToast } from '../hooks/useToast'
import type { Sale, CashExpense, ExpenseCategory, PaymentMethod } from '../types'

type PeriodKey = 'mes' | '3meses' | '6meses' | 'ano' | 'tudo'

const PERIODS: { label: string; value: PeriodKey }[] = [
  { label: 'Este mês', value: 'mes' },
  { label: '3 meses', value: '3meses' },
  { label: '6 meses', value: '6meses' },
  { label: 'Este ano', value: 'ano' },
  { label: 'Tudo', value: 'tudo' }
]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito'
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function getPeriodDates(period: PeriodKey): { startDate: string; endDate: string } | null {
  if (period === 'tudo') return null
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  if (period === 'mes') {
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    return { startDate: start, endDate: today }
  }
  if (period === '3meses') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 3)
    return { startDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, endDate: today }
  }
  if (period === '6meses') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 6)
    return { startDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, endDate: today }
  }
  if (period === 'ano') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: today }
  }
  return null
}

type ExpenseModal =
  | { type: 'new' }
  | { type: 'edit'; expense: CashExpense }
  | { type: 'delete'; expense: CashExpense }

export default function Cash(): JSX.Element {
  const [period, setPeriod] = useState<PeriodKey>('mes')
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<CashExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const [expenseModal, setExpenseModal] = useState<ExpenseModal | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showOpeningBalance, setShowOpeningBalance] = useState(false)

  const [toastMsg, showToast, dismissToast] = useToast()
  const [errorMessage, setErrorMessage] = useState('')

  // ── Categorias modal state ───────────────────────────────────────────────
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null)
  const [categoryError, setCategoryError] = useState('')

  // ── Opening balance modal state ──────────────────────────────────────────
  const [balanceInput, setBalanceInput] = useState('')

  async function loadAll(): Promise<void> {
    const [allSales, allExpenses, allCategories, settings] = await Promise.all([
      window.api.sales.getAll(),
      window.api.cashExpenses.getAll(),
      window.api.expenseCategories.getAll(),
      window.api.cashSettings.get()
    ])
    setSales(allSales)
    setExpenses(allExpenses)
    setCategories(allCategories)
    setOpeningBalance(settings?.openingBalance ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ── Filtering ────────────────────────────────────────────────────────────
  const dateRange = getPeriodDates(period)

  const filteredSales = useMemo(() => {
    if (!dateRange) return sales
    return sales.filter((s) => {
      const d = s.soldAt.slice(0, 10)
      return d >= dateRange.startDate && d <= dateRange.endDate
    })
  }, [sales, dateRange])

  const filteredExpenses = useMemo(() => {
    if (!dateRange) return expenses
    return expenses.filter((e) => {
      return e.expenseDate >= dateRange.startDate && e.expenseDate <= dateRange.endDate
    })
  }, [expenses, dateRange])

  const totalIncome = filteredSales.reduce((s, sale) => s + sale.netAmount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const currentBalance = openingBalance + totalIncome - totalExpenses

  // ── Unified transaction list ─────────────────────────────────────────────
  type TransactionRow =
    | { kind: 'income'; id: number; date: string; label: string; sub: string; amount: number; netAmount: number; feeAmount: number; paymentMethod: PaymentMethod }
    | { kind: 'expense'; id: number; date: string; label: string; sub: string; amount: number; raw: CashExpense }

  const transactions = useMemo((): TransactionRow[] => {
    const incomeRows: TransactionRow[] = filteredSales.map((s) => ({
      kind: 'income',
      id: s.id,
      date: s.soldAt.slice(0, 10),
      label: s.items.length === 1
        ? `${s.items[0].productName} — ${s.items[0].variationIdentifier}`
        : `${s.items.length} itens vendidos`,
      sub: `${s.channel}${s.fairName ? ` · ${s.fairName}` : ''} · ${PAYMENT_LABELS[s.paymentMethod]}`,
      amount: s.totalAmount,
      netAmount: s.netAmount,
      feeAmount: s.feeAmount,
      paymentMethod: s.paymentMethod
    }))

    const expenseRows: TransactionRow[] = filteredExpenses.map((e) => ({
      kind: 'expense',
      id: e.id,
      date: e.expenseDate,
      label: e.description,
      sub: e.categoryName,
      amount: e.amount,
      raw: e
    }))

    return [...incomeRows, ...expenseRows].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return 0
    })
  }, [filteredSales, filteredExpenses])

  // ── Handlers: despesas ───────────────────────────────────────────────────
  async function handleDeleteExpense(expense: CashExpense): Promise<void> {
    try {
      await window.api.cashExpenses.delete(expense.id)
      await loadAll()
      showToast('Despesa excluída.')
    } catch {
      setErrorMessage('Erro ao excluir despesa.')
    }
  }

  // ── Handlers: categorias ─────────────────────────────────────────────────
  async function handleCreateCategory(): Promise<void> {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      await window.api.expenseCategories.create({ name })
      setNewCategoryName('')
      setCategoryError('')
      const updated = await window.api.expenseCategories.getAll()
      setCategories(updated)
    } catch {
      setCategoryError('Já existe uma categoria com esse nome.')
    }
  }

  async function handleUpdateCategory(): Promise<void> {
    if (!editingCategory) return
    const name = editCategoryName.trim()
    if (!name) return
    try {
      await window.api.expenseCategories.update({ id: editingCategory.id, name })
      setEditingCategory(null)
      setEditCategoryName('')
      setCategoryError('')
      const updated = await window.api.expenseCategories.getAll()
      setCategories(updated)
    } catch {
      setCategoryError('Já existe uma categoria com esse nome.')
    }
  }

  async function handleDeleteCategory(category: ExpenseCategory): Promise<void> {
    try {
      await window.api.expenseCategories.delete(category.id)
      setCategoryToDelete(null)
      const updated = await window.api.expenseCategories.getAll()
      setCategories(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir categoria.'
      setCategoryError(msg)
      setCategoryToDelete(null)
    }
  }

  // ── Handlers: saldo de abertura ──────────────────────────────────────────
  async function handleSaveOpeningBalance(): Promise<void> {
    const value = parseFloat(balanceInput.replace(',', '.'))
    if (isNaN(value) || value < 0) return
    await window.api.cashSettings.setOpeningBalance(value)
    setOpeningBalance(value)
    setShowOpeningBalance(false)
    showToast('Saldo de abertura atualizado.')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-semibold text-gray-800">Caixa</h2>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => { setShowOpeningBalance(true); setBalanceInput(openingBalance.toString()) }}
          >
            <Wallet size={14} />
            Saldo de abertura
          </button>
          <button
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => { setShowCategories(true); setCategoryError('') }}
          >
            <Settings size={14} />
            Categorias
          </button>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => setExpenseModal({ type: 'new' })}
          >
            <Plus size={14} />
            Nova despesa
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600 shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {/* Filtro de período */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              period === p.value
                ? 'bg-blush-500 text-white'
                : 'bg-white border border-cream-300 text-gray-600 hover:bg-cream-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo de abertura</p>
          <p className="font-display text-xl font-semibold text-gray-700">{formatCurrency(openingBalance)}</p>
          <button
            className="text-xs text-blush-500 hover:text-blush-700 mt-1 transition-colors"
            onClick={() => { setShowOpeningBalance(true); setBalanceInput(openingBalance.toString()) }}
          >
            Alterar
          </button>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <TrendingUp size={12} className="text-emerald-500" /> Entradas
          </p>
          <p className="font-display text-xl font-semibold text-emerald-600">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{filteredSales.length} venda{filteredSales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <TrendingDown size={12} className="text-rose-500" /> Saídas
          </p>
          <p className="font-display text-xl font-semibold text-rose-600">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={`card py-4 ${currentBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo atual</p>
          <p className={`font-display text-xl font-semibold ${currentBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(currentBalance)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">abertura + entradas − saídas</p>
        </div>
      </div>

      {/* Lista de movimentações */}
      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Nenhuma movimentação no período.</p>
          <button className="btn-primary mt-3" onClick={() => setExpenseModal({ type: 'new' })}>
            Registrar primeira despesa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx, idx) => (
            <div
              key={`${tx.kind}-${tx.id}-${idx}`}
              className="bg-white rounded-2xl border border-cream-200 shadow-card px-5 py-3.5 flex items-center gap-4"
            >
              {/* Indicador */}
              <div className={`w-1.5 h-10 rounded-full shrink-0 ${tx.kind === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />

              {/* Data */}
              <div className="text-xs text-gray-400 w-20 shrink-0">{formatDate(tx.date)}</div>

              {/* Descrição */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{tx.label}</p>
                <p className="text-xs text-gray-400 truncate">{tx.sub}</p>
              </div>

              {/* Valor */}
              <div className="text-right shrink-0">
                {tx.kind === 'income' ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-600">+ {formatCurrency(tx.netAmount)}</p>
                    {tx.feeAmount > 0 && (
                      <p className="text-xs text-gray-400">bruto {formatCurrency(tx.amount)}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-rose-600">− {formatCurrency(tx.amount)}</p>
                )}
              </div>

              {/* Ações (só despesas) */}
              {tx.kind === 'expense' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="p-1.5 text-gray-400 hover:text-blush-600 hover:bg-blush-50 rounded-lg transition-colors"
                    onClick={() => setExpenseModal({ type: 'edit', expense: tx.raw })}
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    onClick={() => setExpenseModal({ type: 'delete', expense: tx.raw })}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {/* Modal: nova/editar despesa */}
      {expenseModal?.type === 'new' && (
        <ExpenseForm
          categories={categories}
          onSave={() => { loadAll(); showToast('Despesa registrada!') }}
          onClose={() => setExpenseModal(null)}
        />
      )}
      {expenseModal?.type === 'edit' && (
        <ExpenseForm
          expense={expenseModal.expense}
          categories={categories}
          onSave={() => { loadAll(); showToast('Despesa atualizada!') }}
          onClose={() => setExpenseModal(null)}
        />
      )}
      {expenseModal?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir despesa"
          message={`Deseja excluir "${expenseModal.expense.description}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDeleteExpense(expenseModal.expense)}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {/* Modal: gerenciar categorias */}
      {showCategories && (
        <Modal title="Gerenciar categorias" onClose={() => { setShowCategories(false); setCategoryError(''); setEditingCategory(null) }}>
          <div className="space-y-4">
            {/* Nova categoria */}
            <div>
              <label className="label">Nova categoria</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory() } }}
                  maxLength={100}
                />
                <button
                  type="button"
                  className="btn-primary px-4"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                >
                  Adicionar
                </button>
              </div>
            </div>

            {categoryError && (
              <p className="text-sm text-rose-500">{categoryError}</p>
            )}

            {/* Lista de categorias */}
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma categoria cadastrada.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 p-2 rounded-xl bg-cream-50">
                    {editingCategory?.id === cat.id ? (
                      <>
                        <input
                          className="input flex-1 py-1 text-sm"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateCategory() } }}
                          autoFocus
                        />
                        <button className="text-xs text-blush-600 hover:text-blush-800 font-medium px-2" onClick={handleUpdateCategory}>
                          Salvar
                        </button>
                        <button className="text-xs text-gray-400 hover:text-gray-600 px-1" onClick={() => { setEditingCategory(null); setEditCategoryName('') }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                        <button
                          className="p-1 text-gray-400 hover:text-blush-600 rounded transition-colors"
                          onClick={() => { setEditingCategory(cat); setEditCategoryName(cat.name); setCategoryError('') }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                          onClick={() => setCategoryToDelete(cat)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm delete categoria */}
      {categoryToDelete && (
        <ConfirmDialog
          title="Excluir categoria"
          message={`Deseja excluir a categoria "${categoryToDelete.name}"?`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDeleteCategory(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
        />
      )}

      {/* Modal: saldo de abertura */}
      {showOpeningBalance && (
        <Modal title="Saldo de abertura" onClose={() => setShowOpeningBalance(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Informe o valor que você já possui em caixa antes de começar a registrar movimentações. Este valor será somado às entradas e descontado das saídas para calcular o saldo atual.
            </p>
            <div>
              <label className="label">Valor (R$)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowOpeningBalance(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveOpeningBalance}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
