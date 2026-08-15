import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ActionMenu from '../components/ui/ActionMenu'
import Toast from '../components/ui/Toast'
import ExpenseForm from '../components/cash/ExpenseForm'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/format'
import {
  buildFairExpenses,
  buildTransactions,
  calcCashSummary,
  filterCashSales,
  filterExpenses,
  resolveDateRange
} from '../utils/cash-calculations'
import type { PeriodKey, TransactionRow } from '../utils/cash-calculations'
import type { Sale, CashExpense, ExpenseCategory, Fair } from '../types'

const PERIODS: { label: string; value: PeriodKey }[] = [
  { label: 'Mês', value: 'mes' },
  { label: '3M', value: '3meses' },
  { label: '6M', value: '6meses' },
  { label: 'Ano', value: 'ano' },
  { label: 'Tudo', value: 'tudo' },
  { label: 'Personalizado', value: 'custom' }
]

const PERIOD_CAPTIONS: Record<PeriodKey, string> = {
  mes: 'Este mês',
  '3meses': 'Últimos 3 meses',
  '6meses': 'Últimos 6 meses',
  ano: 'Este ano',
  tudo: 'Todo o período',
  custom: 'Período personalizado'
}

type ExpenseModal =
  | { type: 'new' }
  | { type: 'edit'; expense: CashExpense }
  | { type: 'delete'; expense: CashExpense }

/** Saldo depois de cada movimentação, da mais recente para a mais antiga. */
function saldosAcumulados(transactions: TransactionRow[], saldoFinal: number): number[] {
  let acc = saldoFinal
  return transactions.map((tx) => {
    const saldo = acc
    const delta = tx.kind === 'income' ? tx.netAmount : -tx.amount
    acc = acc - delta
    return saldo
  })
}

export default function Cash(): JSX.Element {
  const [period, setPeriod] = useState<PeriodKey>('mes')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<CashExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [fairs, setFairs] = useState<Fair[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const [expenseModal, setExpenseModal] = useState<ExpenseModal | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showOpeningBalance, setShowOpeningBalance] = useState(false)

  const [toastMsg, showToast, dismissToast] = useToast()
  const [errorMessage, setErrorMessage] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null)
  const [categoryError, setCategoryError] = useState('')

  const [balanceInput, setBalanceInput] = useState('')

  async function loadAll(): Promise<void> {
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
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const dateRange = useMemo(
    () => resolveDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  const filteredSales = useMemo(() => filterCashSales(sales, dateRange), [sales, dateRange])
  const filteredExpenses = useMemo(() => filterExpenses(expenses, dateRange), [expenses, dateRange])
  const filteredFairExpenses = useMemo(
    () => buildFairExpenses(fairs, dateRange),
    [fairs, dateRange]
  )

  const { totalIncome, totalExpenses, currentBalance } = calcCashSummary({
    openingBalance,
    sales: filteredSales,
    expenses: filteredExpenses,
    fairExpenses: filteredFairExpenses
  })

  const transactions = useMemo(
    (): TransactionRow[] =>
      buildTransactions(filteredSales, filteredExpenses, filteredFairExpenses),
    [filteredSales, filteredExpenses, filteredFairExpenses]
  )

  const saldos = useMemo(
    () => saldosAcumulados(transactions, currentBalance),
    [transactions, currentBalance]
  )

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

  async function handleSaveOpeningBalance(): Promise<void> {
    const value = parseFloat(balanceInput.replace(',', '.'))
    if (isNaN(value) || value < 0) return
    await window.api.cashSettings.setOpeningBalance(value)
    setOpeningBalance(value)
    setShowOpeningBalance(false)
    showToast('Saldo de abertura atualizado.')
  }

  function abrirSaldoDeAbertura(): void {
    setShowOpeningBalance(true)
    setBalanceInput(openingBalance.toString())
  }

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">
              {PERIOD_CAPTIONS[period]} · {transactions.length} movimenta
              {transactions.length !== 1 ? 'ções' : 'ção'}
            </p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              Caixa
            </h2>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={abrirSaldoDeAbertura}>
              Saldo de abertura
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowCategories(true)
                setCategoryError('')
              }}
            >
              Categorias
            </button>
            <button className="btn-primary" onClick={() => setExpenseModal({ type: 'new' })}>
              + Nova despesa
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-control bg-bone-400 p-[3px]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-[7px] px-3 py-[5px] text-aux transition-colors ${
                  period === p.value
                    ? 'bg-bone-50 font-semibold text-ink-900 shadow-raised'
                    : 'font-medium text-ink-500 hover:text-ink-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="ml-auto text-aux text-ink-300">
            Entradas contam vendas <strong className="font-semibold text-ink-800">recebidas</strong>
            ; “a receber” fica fora
          </p>
        </div>

        {period === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              className="input w-auto"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-body text-ink-400">até</span>
            <input
              type="date"
              className="input w-auto"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="px-8 pt-5">
        {errorMessage && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-[11px] border border-bone-500 bg-clay-100 px-4 py-3">
            <p className="text-body text-clay-600">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="shrink-0 text-lg leading-none text-clay-500 hover:text-clay-600"
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-4 gap-3.5">
          <div className="card px-[22px] py-[18px]">
            <p className="label">Abertura</p>
            <p className="text-[22px] font-semibold tabular-nums text-ink-800">
              {formatCurrency(openingBalance)}
            </p>
            <button
              className="mt-1.5 text-aux font-semibold text-wine-500 hover:text-wine-600"
              onClick={abrirSaldoDeAbertura}
            >
              Alterar
            </button>
          </div>

          <div className="card px-[22px] py-[18px]">
            <p className="label">Entradas</p>
            <p className="text-[22px] font-semibold tabular-nums text-sage-500">
              + {formatCurrency(totalIncome)}
            </p>
            <p className="mt-1.5 text-aux text-ink-400">
              {filteredSales.length} venda{filteredSales.length !== 1 ? 's' : ''} recebida
              {filteredSales.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="card px-[22px] py-[18px]">
            <p className="label">Saídas</p>
            <p className="text-[22px] font-semibold tabular-nums text-clay-500">
              − {formatCurrency(totalExpenses)}
            </p>
            <p className="mt-1.5 text-aux text-ink-400">
              {filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''}
              {filteredFairExpenses.length > 0 &&
                ` · ${filteredFairExpenses.length} feira${filteredFairExpenses.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="rounded-card border border-ink-900 bg-ink-900 px-[22px] py-[18px]">
            <p className="label text-ink-100">Saldo atual</p>
            <p
              className={`text-[22px] font-semibold tabular-nums ${
                currentBalance >= 0 ? 'text-bone-50' : 'text-clay-100'
              }`}
            >
              {formatCurrency(currentBalance)}
            </p>
            <p className="mt-1.5 text-aux text-ink-100">abertura + entradas − saídas</p>
          </div>
        </div>

        {loading ? (
          <div className="card flex h-40 items-center justify-center">
            <p className="text-body text-ink-300">Carregando…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card flex h-48 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhuma movimentação no período.</p>
            <button className="btn-primary mt-3" onClick={() => setExpenseModal({ type: 'new' })}>
              Registrar primeira despesa
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-bone-400 bg-bone-50">
            <div className="flex items-center gap-4 border-b border-bone-300 px-[22px] py-2.5 text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
              <span className="w-[66px] shrink-0">Data</span>
              <span className="flex-1">Movimentação</span>
              <span className="w-[130px] shrink-0 text-right">Valor</span>
              <span className="w-[120px] shrink-0 text-right">Saldo</span>
              <span className="w-14 shrink-0" />
            </div>

            {transactions.map((tx, idx) => {
              const entrada = tx.kind === 'income'
              const cor = entrada ? '#5d8f76' : '#b3413f'

              return (
                <div
                  key={`${tx.kind}-${tx.kind === 'fair-expense' ? tx.fairId : tx.id}-${idx}`}
                  className="flex items-center gap-4 border-b border-bone-300 px-[22px] py-3 last:border-b-0 transition-colors hover:bg-bone-100"
                >
                  <span className="w-[66px] shrink-0 text-aux tabular-nums text-ink-400">
                    {formatDate(tx.date)}
                  </span>

                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="h-[26px] w-1 shrink-0 rounded-full"
                      style={{ background: cor }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-ink-900">{tx.label}</p>
                      <p className="mt-px truncate text-micro text-ink-300">{tx.sub}</p>
                    </div>
                    {tx.kind === 'fair-expense' && (
                      <span className="shrink-0 rounded-[5px] bg-plum-100 px-2 py-0.5 text-meta font-bold tracking-[0.03em] text-plum-500">
                        FEIRA
                      </span>
                    )}
                  </div>

                  <div className="w-[130px] shrink-0 text-right">
                    <p
                      className={`text-body font-semibold tabular-nums ${
                        entrada ? 'text-sage-500' : 'text-clay-500'
                      }`}
                    >
                      {entrada
                        ? `+ ${formatCurrency(tx.netAmount)}`
                        : `− ${formatCurrency(tx.amount)}`}
                    </p>
                    {tx.kind === 'income' && tx.feeAmount > 0 && (
                      <p className="mt-px text-meta tabular-nums text-ink-300">
                        bruto {formatCurrency(tx.amount)}
                      </p>
                    )}
                  </div>

                  <span className="w-[120px] shrink-0 text-right text-micro tabular-nums text-ink-600">
                    {formatCurrency(saldos[idx])}
                  </span>

                  <div className="flex w-14 shrink-0 justify-end">
                    {tx.kind === 'expense' && (
                      <ActionMenu
                        items={[
                          {
                            label: 'Editar despesa',
                            onClick: () => setExpenseModal({ type: 'edit', expense: tx.raw })
                          },
                          {
                            label: 'Excluir despesa',
                            danger: true,
                            onClick: () => setExpenseModal({ type: 'delete', expense: tx.raw })
                          }
                        ]}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {expenseModal?.type === 'new' && (
        <ExpenseForm
          categories={categories}
          onSave={() => {
            loadAll()
            showToast('Despesa registrada!')
          }}
          onClose={() => setExpenseModal(null)}
        />
      )}
      {expenseModal?.type === 'edit' && (
        <ExpenseForm
          expense={expenseModal.expense}
          categories={categories}
          onSave={() => {
            loadAll()
            showToast('Despesa atualizada!')
          }}
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

      {showCategories && (
        <Modal
          title="Gerenciar categorias"
          onClose={() => {
            setShowCategories(false)
            setCategoryError('')
            setEditingCategory(null)
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Nova categoria</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreateCategory()
                    }
                  }}
                  maxLength={100}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                >
                  Adicionar
                </button>
              </div>
            </div>

            {categoryError && <p className="text-body text-clay-500">{categoryError}</p>}

            {categories.length === 0 ? (
              <p className="py-4 text-center text-body text-ink-300">
                Nenhuma categoria cadastrada.
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 rounded-control bg-bone-200 p-2"
                  >
                    {editingCategory?.id === cat.id ? (
                      <>
                        <input
                          className="input flex-1 py-1"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleUpdateCategory()
                            }
                          }}
                          autoFocus
                        />
                        <button
                          className="px-2 text-aux font-semibold text-wine-500 hover:text-wine-600"
                          onClick={handleUpdateCategory}
                        >
                          Salvar
                        </button>
                        <button
                          className="px-1 text-aux text-ink-400 hover:text-ink-700"
                          onClick={() => {
                            setEditingCategory(null)
                            setEditCategoryName('')
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-body text-ink-800">{cat.name}</span>
                        <button
                          className="rounded p-1 text-ink-300 transition-colors hover:text-wine-500"
                          onClick={() => {
                            setEditingCategory(cat)
                            setEditCategoryName(cat.name)
                            setCategoryError('')
                          }}
                          title="Editar categoria"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="rounded p-1 text-ink-300 transition-colors hover:text-clay-500"
                          onClick={() => setCategoryToDelete(cat)}
                          title="Excluir categoria"
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

      {showOpeningBalance && (
        <Modal title="Saldo de abertura" onClose={() => setShowOpeningBalance(false)}>
          <div className="space-y-4">
            <p className="text-body text-ink-600">
              Informe o valor que você já possui em caixa antes de começar a registrar
              movimentações. Este valor será somado às entradas e descontado das saídas para
              calcular o saldo atual.
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
              <button className="btn-secondary" onClick={() => setShowOpeningBalance(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSaveOpeningBalance}>
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
