import { useEffect, useMemo, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Settings, Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import ExpenseForm from '../components/cash/ExpenseForm'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/format'
import type { Sale, CashExpense, ExpenseCategory, Fair, PaymentMethod } from '../types'

type PeriodKey = 'mes' | '3meses' | '6meses' | 'ano' | 'tudo' | 'custom'

const PERIODS: { label: string; value: PeriodKey }[] = [
  { label: 'Este mês',     value: 'mes' },
  { label: '3 meses',      value: '3meses' },
  { label: '6 meses',      value: '6meses' },
  { label: 'Este ano',     value: 'ano' },
  { label: 'Tudo',         value: 'tudo' },
  { label: 'Personalizado',value: 'custom' }
]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito'
}

function getPeriodDates(period: PeriodKey): { startDate: string; endDate: string } | null {
  if (period === 'tudo') return null
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  if (period === 'mes') {
    return { startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, endDate: today }
  }
  if (period === '3meses') {
    const d = new Date(now); d.setMonth(d.getMonth() - 3)
    return { startDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, endDate: today }
  }
  if (period === '6meses') {
    const d = new Date(now); d.setMonth(d.getMonth() - 6)
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

function buildFairCostSub(fair: Fair): string {
  const parts: string[] = []
  if (fair.enrollmentCost > 0) {
    parts.push(`Inscrição ${fair.enrollmentCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
  }
  fair.additionalCosts.forEach((c) => {
    parts.push(`${c.description} ${c.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
  })
  return parts.join(' · ') || 'Sem detalhes'
}

export default function Cash(): JSX.Element {
  const [period, setPeriod]             = useState<PeriodKey>('mes')
  const [customStart, setCustomStart]   = useState('')
  const [customEnd, setCustomEnd]       = useState('')
  const [sales, setSales]               = useState<Sale[]>([])
  const [expenses, setExpenses]         = useState<CashExpense[]>([])
  const [categories, setCategories]     = useState<ExpenseCategory[]>([])
  const [fairs, setFairs]               = useState<Fair[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [loading, setLoading]           = useState(true)

  const [expenseModal, setExpenseModal]         = useState<ExpenseModal | null>(null)
  const [showCategories, setShowCategories]     = useState(false)
  const [showOpeningBalance, setShowOpeningBalance] = useState(false)

  const [toastMsg, showToast, dismissToast] = useToast()
  const [errorMessage, setErrorMessage]     = useState('')

  const [newCategoryName, setNewCategoryName]     = useState('')
  const [editingCategory, setEditingCategory]     = useState<ExpenseCategory | null>(null)
  const [editCategoryName, setEditCategoryName]   = useState('')
  const [categoryToDelete, setCategoryToDelete]   = useState<ExpenseCategory | null>(null)
  const [categoryError, setCategoryError]         = useState('')
  const [balanceInput, setBalanceInput]           = useState('')

  async function loadAll(): Promise<void> {
    try {
      const [allSales, allExpenses, allCategories, settings, allFairs] = await Promise.all([
        window.api.sales.getAll(),
        window.api.cashExpenses.getAll(),
        window.api.expenseCategories.getAll(),
        window.api.cashSettings.get(),
        window.api.fairs.getAll()
      ])
      setSales(allSales)
      setExpenses(allExpenses)
      setCategories(allCategories)
      setFairs(allFairs)
      setOpeningBalance(settings?.openingBalance ?? 0)
    } catch (err) {
      setErrorMessage('Erro ao carregar movimentações do caixa.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const dateRange = period === 'custom'
    ? (customStart && customEnd ? { startDate: customStart, endDate: customEnd } : null)
    : getPeriodDates(period)

  const filteredSales = useMemo(() => {
    if (!dateRange) return sales
    return sales.filter((s) => {
      const d = s.soldAt.slice(0, 10)
      return d >= dateRange.startDate && d <= dateRange.endDate
    })
  }, [sales, dateRange])

  const filteredExpenses = useMemo(() => {
    if (!dateRange) return expenses
    return expenses.filter((e) => e.expenseDate >= dateRange.startDate && e.expenseDate <= dateRange.endDate)
  }, [expenses, dateRange])

  const filteredFairExpenses = useMemo(() => {
    const rows = fairs.flatMap((f) => {
      const total = f.enrollmentCost + f.additionalCosts.reduce((s, c) => s + c.amount, 0)
      if (total === 0) return []
      return [{ fairId: f.id, date: f.date, label: f.name, sub: buildFairCostSub(f), amount: total }]
    })
    if (!dateRange) return rows
    return rows.filter((r) => r.date >= dateRange.startDate && r.date <= dateRange.endDate)
  }, [fairs, dateRange])

  const totalIncome   = filteredSales.reduce((s, sale) => s + sale.netAmount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0) + filteredFairExpenses.reduce((s, fe) => s + fe.amount, 0)
  const currentBalance = openingBalance + totalIncome - totalExpenses

  type TransactionRow =
    | { kind: 'income'; id: number; date: string; label: string; sub: string; amount: number; netAmount: number; feeAmount: number; paymentMethod: PaymentMethod }
    | { kind: 'expense'; id: number; date: string; label: string; sub: string; amount: number; raw: CashExpense }
    | { kind: 'fair-expense'; fairId: number; date: string; label: string; sub: string; amount: number }

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

    const fairExpenseRows: TransactionRow[] = filteredFairExpenses.map((fe) => ({
      kind: 'fair-expense',
      fairId: fe.fairId,
      date: fe.date,
      label: fe.label,
      sub: fe.sub,
      amount: fe.amount
    }))

    return [...incomeRows, ...expenseRows, ...fairExpenseRows].sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredSales, filteredExpenses, filteredFairExpenses])

  async function handleDeleteExpense(expense: CashExpense): Promise<void> {
    try {
      await window.api.cashExpenses.delete(expense.id)
      await loadAll()
      showToast('Despesa excluída.')
    } catch {
      setErrorMessage('Erro ao excluir despesa.')
    }
  }

  async function handleCreateCategory(): Promise<void> {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      await window.api.expenseCategories.create({ name })
      setNewCategoryName('')
      setCategoryError('')
      setCategories(await window.api.expenseCategories.getAll())
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
      setCategories(await window.api.expenseCategories.getAll())
    } catch {
      setCategoryError('Já existe uma categoria com esse nome.')
    }
  }

  async function handleDeleteCategory(category: ExpenseCategory): Promise<void> {
    try {
      await window.api.expenseCategories.delete(category.id)
      setCategoryToDelete(null)
      setCategories(await window.api.expenseCategories.getAll())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir categoria.'
      setCategoryError(msg)
      setCategoryToDelete(null)
    }
  }

  async function handleSaveOpeningBalance(): Promise<void> {
    const value = parseFloat(balanceInput.replace(',', '.'))
    if (isNaN(value) || value < 0) return
    try {
      await window.api.cashSettings.setOpeningBalance(value)
      setOpeningBalance(value)
      setShowOpeningBalance(false)
      showToast('Saldo de abertura atualizado.')
    } catch (err) {
      console.error(err)
      setErrorMessage('Erro ao atualizar saldo de abertura.')
      setShowOpeningBalance(false)
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Financeiro</div>
          <h1 className="page-title">Caixa</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => { setShowOpeningBalance(true); setBalanceInput(openingBalance.toString()) }}
          >
            <Wallet size={14} /> Saldo de abertura
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setShowCategories(true); setCategoryError('') }}
          >
            <Settings size={14} /> Categorias
          </button>
          <button className="btn btn-primary" onClick={() => setExpenseModal({ type: 'new' })}>
            <Plus size={14} /> Nova despesa
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Filtro de período */}
      <div style={{ marginBottom: 20 }}>
        <div className="chips">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`chip${period === p.value ? ' active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>até</span>
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Strip de métricas */}
      <div className="cash-strip">
        <div className="cash-strip-cell">
          <div className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Saldo de abertura
          </div>
          <div className="cash-strip-value">{formatCurrency(openingBalance)}</div>
          <div className="cash-strip-sub">
            <button
              style={{ color: 'var(--accent)', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
              onClick={() => { setShowOpeningBalance(true); setBalanceInput(openingBalance.toString()) }}
            >
              Alterar
            </button>
          </div>
        </div>
        <div className="cash-strip-cell good">
          <div className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={11} /> Entradas
          </div>
          <div className="cash-strip-value">{formatCurrency(totalIncome)}</div>
          <div className="cash-strip-sub">{filteredSales.length} venda{filteredSales.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="cash-strip-cell bad">
          <div className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingDown size={11} /> Saídas
          </div>
          <div className="cash-strip-value">{formatCurrency(totalExpenses)}</div>
          <div className="cash-strip-sub">
            {filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''}
            {filteredFairExpenses.length > 0 && ` · ${filteredFairExpenses.length} feira${filteredFairExpenses.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className={`cash-strip-cell emphasize${currentBalance >= 0 ? ' good' : ' bad'}`}>
          <div className="field-label">Saldo atual</div>
          <div className="cash-strip-value">{formatCurrency(currentBalance)}</div>
          <div className="cash-strip-sub">abertura + entradas − saídas</div>
        </div>
      </div>

      {/* Lista de movimentações */}
      {loading ? (
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhuma movimentação no período</h3>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setExpenseModal({ type: 'new' })}>
            Registrar primeira despesa
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transactions.map((tx, idx) => (
            <div
              key={`${tx.kind}-${'id' in tx ? tx.id : tx.fairId}-${idx}`}
              className="card"
              style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
            >
              {/* Indicador */}
              <div style={{
                width: 3,
                height: 36,
                borderRadius: 2,
                flexShrink: 0,
                background: tx.kind === 'income' ? 'var(--good)' : 'var(--bad)'
              }} />

              {/* Data */}
              <div style={{ fontSize: 11, color: 'var(--ink-4)', width: 76, flexShrink: 0 }}>
                {formatDate(tx.date)}
              </div>

              {/* Descrição */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.sub}
                </div>
              </div>

              {/* Valor */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {tx.kind === 'income' ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>
                      + {formatCurrency(tx.netAmount)}
                    </div>
                    {tx.feeAmount > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>bruto {formatCurrency(tx.amount)}</div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>
                    − {formatCurrency(tx.amount)}
                  </div>
                )}
              </div>

              {/* Ações */}
              {tx.kind === 'expense' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    className="icon-btn"
                    onClick={() => setExpenseModal({ type: 'edit', expense: tx.raw })}
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    style={{ color: 'var(--bad)' }}
                    onClick={() => setExpenseModal({ type: 'delete', expense: tx.raw })}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              {tx.kind === 'fair-expense' && (
                <div style={{ width: 56, flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)', fontStyle: 'italic' }}>feira</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

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

      {/* Modal: categorias */}
      {showCategories && (
        <Modal title="Gerenciar categorias" onClose={() => { setShowCategories(false); setCategoryError(''); setEditingCategory(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Nova categoria</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory() } }}
                  maxLength={100}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                >
                  Adicionar
                </button>
              </div>
            </div>

            {categoryError && (
              <p style={{ fontSize: 13, color: 'var(--bad)', margin: 0 }}>{categoryError}</p>
            )}

            {categories.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Nenhuma categoria cadastrada.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 256, overflowY: 'auto' }}>
                {categories.map((cat) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)' }}>
                    {editingCategory?.id === cat.id ? (
                      <>
                        <input
                          className="input"
                          style={{ flex: 1, height: 30, fontSize: 12 }}
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateCategory() } }}
                          autoFocus
                        />
                        <button className="btn btn-xs btn-primary" onClick={handleUpdateCategory}>Salvar</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => { setEditingCategory(null); setEditCategoryName('') }}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{cat.name}</span>
                        <button
                          className="icon-btn"
                          onClick={() => { setEditingCategory(cat); setEditCategoryName(cat.name); setCategoryError('') }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="icon-btn"
                          style={{ color: 'var(--bad)' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowOpeningBalance(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveOpeningBalance}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
