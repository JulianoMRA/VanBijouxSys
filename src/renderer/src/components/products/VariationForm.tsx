import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import InsumoForm from '../insumos/InsumoForm'
import type { Insumo, ProductVariation } from '../../types'

const LABOR_COST_KEY = 'pricing_default_labor_cost'

function loadDefaultLaborCost(): string {
  return localStorage.getItem(LABOR_COST_KEY) ?? ''
}

interface InsumoRow {
  key: number
  insumoId: number | ''
  quantity: string
}

interface VariationFormProps {
  productId: number
  productName: string
  variation?: ProductVariation
  onSave: () => void
  onClose: () => void
}

let rowKey = 0

export default function VariationForm({
  productId,
  productName,
  variation,
  onSave,
  onClose
}: VariationFormProps): JSX.Element {
  const [identifier, setIdentifier] = useState(variation?.identifier ?? '')
  const [costPrice, setCostPrice] = useState(variation?.costPrice.toString() ?? '')
  const [salePrice, setSalePrice] = useState(variation?.salePrice.toString() ?? '')
  const [stockQuantity, setStockQuantity] = useState(variation?.stockQuantity.toString() ?? '0')
  const [minimumStock, setMinimumStock] = useState(variation?.minimumStock.toString() ?? '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showCalc, setShowCalc] = useState(false)
  const [laborCost, setLaborCost] = useState(() =>
    variation?.laborCost ? variation.laborCost.toString() : loadDefaultLaborCost()
  )

  const [allInsumos, setAllInsumos] = useState<Insumo[]>([])
  const [insumoRows, setInsumoRows] = useState<InsumoRow[]>(
    variation?.insumos.map((vi) => ({
      key: rowKey++,
      insumoId: vi.insumoId,
      quantity: vi.quantity.toString()
    })) ?? []
  )
  const [showInsumoForm, setShowInsumoForm] = useState(false)
  const [pendingRowKey, setPendingRowKey] = useState<number | null>(null)

  const isEditing = !!variation

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        setAllInsumos(await window.api.insumos.getAll())
      } catch (err) {
        console.error(err)
        setError('Erro ao carregar insumos.')
      }
    }
    load()
  }, [])

  // Custo de materiais: prioridade para insumos se cadastrados, senão usa campo manual
  const insumosCost = insumoRows.reduce((sum, row) => {
    if (row.insumoId === '') return sum
    const insumo = allInsumos.find((i) => i.id === row.insumoId)
    const qty = parseFloat(row.quantity)
    if (!insumo || isNaN(qty)) return sum
    return sum + insumo.costPerUnit * qty
  }, 0)

  const hasInsumos = insumoRows.length > 0 && insumoRows.some((r) => r.insumoId !== '')
  const materialsForCalc = hasInsumos ? insumosCost : (parseFloat(costPrice) || 0)
  const labor = parseFloat(laborCost) || 0
  const suggestedPrice = Math.ceil((materialsForCalc * 3 + labor) * 1.1 + 1)
  const hasCalcResult = materialsForCalc > 0 || labor > 0

  function addInsumoRow(): void {
    setInsumoRows((prev) => [...prev, { key: rowKey++, insumoId: '', quantity: '' }])
  }

  function removeInsumoRow(key: number): void {
    setInsumoRows((prev) => prev.filter((r) => r.key !== key))
  }

  function updateRow(key: number, changes: Partial<InsumoRow>): void {
    setInsumoRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)))
  }

  function saveDefaultLaborCost(): void {
    localStorage.setItem(LABOR_COST_KEY, laborCost)
  }

  function useSuggestedPrice(): void {
    setSalePrice(suggestedPrice.toString())
  }

  function useInsumosCost(): void {
    setCostPrice(insumosCost.toFixed(2))
  }

  function handleInsumoSelect(key: number, value: string): void {
    if (value === '__new__') {
      setPendingRowKey(key)
      setShowInsumoForm(true)
    } else {
      updateRow(key, { insumoId: value === '' ? '' : Number(value) })
    }
  }

  function handleNewInsumoCreated(newInsumo: Insumo): void {
    setAllInsumos((prev) => [...prev, newInsumo].sort((a, b) => a.name.localeCompare(b.name)))
    if (pendingRowKey !== null) {
      updateRow(pendingRowKey, { insumoId: newInsumo.id })
      setPendingRowKey(null)
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!identifier.trim()) {
      setError('O identificador é obrigatório.')
      return
    }
    const cost = parseFloat(costPrice)
    const sale = parseFloat(salePrice)
    const stock = parseInt(stockQuantity)
    const minStock = parseInt(minimumStock)

    if (isNaN(cost) || cost < 0) { setError('Preço de custo inválido.'); return }
    if (isNaN(sale) || sale < 0) { setError('Preço de venda inválido.'); return }
    if (isNaN(stock) || stock < 0) { setError('Quantidade em estoque inválida.'); return }
    if (isNaN(minStock) || minStock < 0) { setError('Estoque mínimo inválido.'); return }

    for (const row of insumoRows) {
      if (row.insumoId === '') { setError('Selecione o insumo em todas as linhas ou remova as vazias.'); return }
      const qty = parseFloat(row.quantity)
      if (isNaN(qty) || qty <= 0) { setError('Informe a quantidade de cada insumo.'); return }
    }

    const parsedInsumos = insumoRows
      .filter((r) => r.insumoId !== '')
      .map((r) => ({ insumoId: r.insumoId as number, quantity: parseFloat(r.quantity) }))

    setSaving(true)
    try {
      const parsedLaborCost = parseFloat(laborCost) || 0

      if (isEditing) {
        await window.api.variations.update({
          id: variation.id,
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock,
          laborCost: parsedLaborCost,
          insumos: parsedInsumos
        })
      } else {
        await window.api.variations.create({
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock,
          laborCost: parsedLaborCost,
          insumos: parsedInsumos
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
    <>
      <Modal
        title={isEditing ? 'Editar Variação' : `Nova Variação — ${productName}`}
        onClose={onClose}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Identificador</label>
            <input
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ex: Rosa, Dourado, Fimo unicórnio, Cristal azul…"
              autoFocus
            />
            <p className="text-xs text-dim mt-1">
              Pode ser uma cor, material, tipo de fimo, ou qualquer diferencial desta variação.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Preço de custo (R$)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0,00"
              />
              {hasInsumos && (
                <p className="text-xs text-[var(--accent)] mt-1 cursor-pointer hover:underline" onClick={useInsumosCost}>
                  Calculado pelos insumos: R$ {insumosCost.toFixed(2)} — clique para usar
                </p>
              )}
            </div>
            <div>
              <label className="label">Preço de venda (R$)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Insumos utilizados */}
          <div className="border border-[var(--hairline)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface-alt)]">
              <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Insumos utilizados</span>
              <button
                type="button"
                onClick={addInsumoRow}
                className="text-xs text-[var(--accent)] hover:text-[var(--accent-2)] font-medium transition-colors"
              >
                + Adicionar insumo
              </button>
            </div>

            {insumoRows.length === 0 ? (
              <p className="text-xs text-dim px-4 py-3">
                Sem insumos vinculados. O custo de materiais será preenchido manualmente acima.
              </p>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {insumoRows.map((row) => {
                  const selectedInsumo = row.insumoId !== '' ? allInsumos.find((i) => i.id === row.insumoId) : null
                  const rowCost = selectedInsumo && parseFloat(row.quantity)
                    ? selectedInsumo.costPerUnit * parseFloat(row.quantity)
                    : null

                  return (
                    <div key={row.key} className="flex gap-2 items-center">
                      <select
                        className="input flex-1"
                        value={row.insumoId}
                        onChange={(e) => handleInsumoSelect(row.key, e.target.value)}
                      >
                        <option value="">Selecione o insumo…</option>
                        {allInsumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (R${i.costPerUnit.toFixed(4)}/{i.unit === 'unidade' ? 'un.' : i.unit})
                          </option>
                        ))}
                        <option value="__new__">+ Cadastrar novo insumo…</option>
                      </select>

                      <div className="relative w-28 shrink-0">
                        <input
                          className="input pr-8"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Qtd."
                          value={row.quantity}
                          onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        />
                        {selectedInsumo && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim text-xs pointer-events-none">
                            {selectedInsumo.unit === 'unidade' ? 'un.' : selectedInsumo.unit}
                          </span>
                        )}
                      </div>

                      {rowCost !== null && (
                        <span className="text-xs w-16 text-right shrink-0" style={{ color: 'var(--ink-3)' }}>
                          R$ {rowCost.toFixed(2)}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeInsumoRow(row.key)}
                        className="icon-btn shrink-0"
                        style={{ color: 'var(--bad)' }}
                        title="Remover"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}

                {hasInsumos && (
                  <div className="flex justify-between text-xs font-medium text-[var(--accent-2)] pt-1 border-t border-[var(--hairline)]">
                    <span>Custo total de materiais</span>
                    <span>R$ {insumosCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Calculadora de preço */}
          <div className="border border-[var(--hairline)] rounded-[var(--radius-md)] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCalc((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--surface-alt)] hover:bg-[var(--hairline-soft)] transition-colors text-sm"
            >
              <span className="font-medium" style={{ color: 'var(--ink-2)' }}>Calculadora de preço</span>
              <span className="text-dim text-xs">{showCalc ? '▲ Fechar' : '▼ Abrir'}</span>
            </button>

            {showCalc && (
              <div className="px-4 py-3 space-y-3">
                {hasInsumos && (
                  <p className="text-xs text-[var(--accent)]">
                    Usando custo calculado pelos insumos (R$ {insumosCost.toFixed(2)}) como base de materiais.
                  </p>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Mão de obra (R$)</label>
                    <button
                      type="button"
                      onClick={saveDefaultLaborCost}
                      className="text-xs text-[var(--accent)] hover:text-[var(--accent-2)] transition-colors"
                    >
                      Salvar como padrão
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-sm pointer-events-none">R$</span>
                    <input
                      className="input pl-8"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={laborCost}
                      onChange={(e) => setLaborCost(e.target.value)}
                    />
                  </div>
                </div>

                {hasCalcResult && (
                  <div className="bg-[var(--accent-wash)] rounded-[var(--radius-md)] p-3 space-y-1 text-xs text-[var(--ink-3)]">
                    <div className="flex justify-between">
                      <span>Materiais × 3</span>
                      <span>{(materialsForCalc * 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+ Mão de obra</span>
                      <span>{labor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>× 1,10 (margem)</span>
                      <span>{((materialsForCalc * 3 + labor) * 1.1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+ Embalagem</span>
                      <span>R$ 1,00</span>
                    </div>
                    <div className="flex justify-between font-semibold text-[var(--accent-2)] pt-1 border-t border-[var(--accent-soft)]">
                      <span>Preço sugerido</span>
                      <span>{suggestedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                )}

                {hasCalcResult && (
                  <button type="button" onClick={useSuggestedPrice} className="btn btn-ghost w-full text-sm">
                    Usar R$ {suggestedPrice},00 como preço de venda
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantidade em estoque</label>
              <input
                className="input"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Estoque mínimo</label>
              <input
                className="input"
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
              />
              <p className="text-xs text-dim mt-1">
                Alerta aparece quando estoque ficar abaixo deste valor.
              </p>
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar variação'}
            </button>
          </div>
        </form>
      </Modal>

      {showInsumoForm && (
        <InsumoForm
          onSave={handleNewInsumoCreated}
          onClose={() => { setShowInsumoForm(false); setPendingRowKey(null) }}
        />
      )}
    </>
  )
}
