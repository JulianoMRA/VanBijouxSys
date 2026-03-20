import { useEffect, useRef, useState } from 'react'
import type { Product } from '../types'

interface MaterialRow {
  id: string
  name: string
  cost: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ApplyToVariation({
  suggestedPrice,
  products,
  onApplied
}: {
  suggestedPrice: number
  products: Product[]
  onApplied: () => void
}): JSX.Element {
  const [productId, setProductId] = useState<number | ''>('')
  const [variationId, setVariationId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)
  const variations = selectedProduct?.variations ?? []

  async function handleApply(): Promise<void> {
    if (!variationId) return
    setSaving(true)
    try {
      const variation = variations.find((v) => v.id === variationId)
      if (!variation) return
      await window.api.variations.update({
        id: variation.id,
        productId: variation.productId,
        identifier: variation.identifier,
        costPrice: variation.costPrice,
        salePrice: suggestedPrice,
        stockQuantity: variation.stockQuantity,
        minimumStock: variation.minimumStock
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setProductId('')
        setVariationId('')
        onApplied()
      }, 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-cream-200">
      <p className="text-sm font-medium text-gray-700 mb-3">Aplicar preço a uma variação</p>
      <div className="space-y-3">
        <div>
          <label className="label">Produto</label>
          <select
            className="input"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value === '' ? '' : Number(e.target.value))
              setVariationId('')
            }}
          >
            <option value="">Selecione um produto…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.categoryName})
              </option>
            ))}
          </select>
        </div>

        {productId !== '' && (
          <div>
            <label className="label">Variação</label>
            <select
              className="input"
              value={variationId}
              onChange={(e) =>
                setVariationId(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">Selecione uma variação…</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.identifier}
                </option>
              ))}
            </select>
          </div>
        )}

        {variationId !== '' && (
          <button
            className="btn-primary w-full"
            onClick={handleApply}
            disabled={saving || success}
          >
            {success ? '✓ Preço aplicado!' : saving ? 'Aplicando…' : `Aplicar ${formatCurrency(suggestedPrice)} a esta variação`}
          </button>
        )}
      </div>
    </div>
  )
}

export default function PriceCalculator(): JSX.Element {
  const counter = useRef(0)
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { id: 'item-0', name: '', cost: '' }
  ])
  const [laborCost, setLaborCost] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    window.api.products.getAll().then(setProducts)
  }, [])

  function addMaterial(): void {
    counter.current += 1
    setMaterials((prev) => [
      ...prev,
      { id: `item-${counter.current}`, name: '', cost: '' }
    ])
  }

  function removeMaterial(id: string): void {
    setMaterials((prev) => prev.filter((m) => m.id !== id))
  }

  function updateMaterial(id: string, field: 'name' | 'cost', value: string): void {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    )
  }

  const totalMaterials = materials.reduce((sum, m) => {
    const val = parseFloat(m.cost)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const labor = parseFloat(laborCost)
  const laborValue = isNaN(labor) ? 0 : labor

  const step1 = totalMaterials * 3
  const step2 = step1 + laborValue
  const step3 = step2 * 1.1
  const hasResult = totalMaterials > 0 || laborValue > 0

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-gray-800">Calculadora de Preço</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Insira os custos e veja o preço de venda sugerido automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Coluna de entrada */}
        <div className="card space-y-5">
          {/* Materiais */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Materiais utilizados</label>
              <button
                onClick={addMaterial}
                className="text-xs text-blush-600 hover:text-blush-800 font-medium transition-colors"
              >
                + Adicionar material
              </button>
            </div>

            <div className="space-y-2">
              {materials.map((m, index) => (
                <div key={m.id} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder={`Material ${index + 1} (ex: fio de nylon)`}
                    value={m.name}
                    onChange={(e) => updateMaterial(m.id, 'name', e.target.value)}
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
                      value={m.cost}
                      onChange={(e) => updateMaterial(m.id, 'cost', e.target.value)}
                    />
                  </div>
                  {materials.length > 1 && (
                    <button
                      onClick={() => removeMaterial(m.id)}
                      className="text-gray-300 hover:text-rose-400 transition-colors text-lg leading-none shrink-0"
                      title="Remover"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-end">
              <span className="text-sm text-gray-500">
                Total de materiais:{' '}
                <span className="font-medium text-gray-700">{formatCurrency(totalMaterials)}</span>
              </span>
            </div>
          </div>

          {/* Mão de obra */}
          <div>
            <label className="label">Mão de obra (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                R$
              </span>
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
            <p className="text-xs text-gray-400 mt-1">
              Valor cobrado pelo seu tempo e trabalho na confecção desta peça.
            </p>
          </div>
        </div>

        {/* Coluna de resultado */}
        <div className="space-y-4">
          {/* Breakdown da fórmula */}
          <div className="card">
            <h3 className="font-display text-base font-semibold text-gray-700 mb-4">
              Cálculo passo a passo
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2.5 border-b border-cream-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Materiais × 3</p>
                  <p className="text-xs text-gray-400">{formatCurrency(totalMaterials)} × 3</p>
                </div>
                <span className={`text-sm font-semibold ${hasResult ? 'text-gray-800' : 'text-gray-300'}`}>
                  {formatCurrency(step1)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-cream-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">+ Mão de obra</p>
                  <p className="text-xs text-gray-400">{formatCurrency(step1)} + {formatCurrency(laborValue)}</p>
                </div>
                <span className={`text-sm font-semibold ${hasResult ? 'text-gray-800' : 'text-gray-300'}`}>
                  {formatCurrency(step2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-cream-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">+ 10%</p>
                  <p className="text-xs text-gray-400">{formatCurrency(step2)} × 1,10</p>
                </div>
                <span className={`text-sm font-semibold ${hasResult ? 'text-gray-800' : 'text-gray-300'}`}>
                  {formatCurrency(step3)}
                </span>
              </div>
            </div>

            {/* Preço final */}
            <div className={`mt-4 rounded-xl p-4 text-center transition-all ${hasResult ? 'bg-blush-50' : 'bg-cream-100'}`}>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Preço sugerido</p>
              <p className={`font-display text-4xl font-bold transition-colors ${hasResult ? 'text-blush-600' : 'text-gray-300'}`}>
                {formatCurrency(step3)}
              </p>
              {hasResult && (
                <p className="text-xs text-gray-400 mt-1">
                  Margem sobre custo total:{' '}
                  {totalMaterials + laborValue > 0
                    ? `${(((step3 - (totalMaterials + laborValue)) / (totalMaterials + laborValue)) * 100).toFixed(0)}%`
                    : '—'}
                </p>
              )}
            </div>

            {/* Aplicar a variação */}
            {hasResult && products.length > 0 && (
              <>
                {!showApply ? (
                  <button
                    className="btn-secondary w-full mt-4"
                    onClick={() => setShowApply(true)}
                  >
                    Aplicar preço a uma variação
                  </button>
                ) : (
                  <ApplyToVariation
                    suggestedPrice={parseFloat(step3.toFixed(2))}
                    products={products}
                    onApplied={() => setShowApply(false)}
                  />
                )}
              </>
            )}
          </div>

          {/* Fórmula resumida */}
          <div className="bg-white rounded-2xl border border-cream-200 px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Fórmula utilizada</p>
            <p className="text-sm text-gray-600 font-mono leading-relaxed">
              (materiais × 3 + mão de obra) × 1,10
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
