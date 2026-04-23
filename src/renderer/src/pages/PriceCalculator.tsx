import { useEffect, useRef, useState } from 'react'
import { calcSuggestedPrice } from '../utils/pricing'
import { formatCurrency } from '../utils/format'
import type { Insumo, Product } from '../types'

const LABOR_COST_KEY = 'pricing_default_labor_cost'

interface MaterialRow {
  id: string
  name: string
  cost: string
  insumoId: number | null
  quantity: string
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
  const [productId, setProductId]   = useState<number | ''>('')
  const [variationId, setVariationId] = useState<number | ''>('')
  const [saving, setSaving]         = useState(false)
  const [success, setSuccess]       = useState(false)

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
        minimumStock: variation.minimumStock,
        laborCost: variation.laborCost
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
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--hairline-soft)' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 12 }}>
        Aplicar preço a uma variação
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <option key={p.id} value={p.id}>{p.name} ({p.categoryName})</option>
            ))}
          </select>
        </div>

        {productId !== '' && (
          <div>
            <label className="label">Variação</label>
            <select
              className="input"
              value={variationId}
              onChange={(e) => setVariationId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Selecione uma variação…</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>{v.identifier}</option>
              ))}
            </select>
          </div>
        )}

        {variationId !== '' && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
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
    { id: 'item-0', name: '', cost: '', insumoId: null, quantity: '' }
  ])
  const [laborCost, setLaborCost]   = useState(() => localStorage.getItem(LABOR_COST_KEY) ?? '')
  const [products, setProducts]     = useState<Product[]>([])
  const [insumos, setInsumos]       = useState<Insumo[]>([])
  const [showApply, setShowApply]   = useState(false)
  const [laborSaved, setLaborSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        const [prods, insms] = await Promise.all([
          window.api.products.getAll(),
          window.api.insumos.getAll()
        ])
        setProducts(prods)
        setInsumos(insms)
      } catch (err) {
        setErrorMessage('Erro ao carregar produtos e insumos.')
        console.error(err)
      }
    }
    loadData()
  }, [])

  function saveDefaultLaborCost(): void {
    localStorage.setItem(LABOR_COST_KEY, laborCost)
    setLaborSaved(true)
    setTimeout(() => setLaborSaved(false), 2000)
  }

  function addMaterial(): void {
    counter.current += 1
    setMaterials((prev) => [
      ...prev,
      { id: `item-${counter.current}`, name: '', cost: '', insumoId: null, quantity: '' }
    ])
  }

  function removeMaterial(id: string): void {
    setMaterials((prev) => prev.filter((m) => m.id !== id))
  }

  function updateMaterial(id: string, field: 'name' | 'cost' | 'quantity', value: string): void {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  function setMaterialInsumo(id: string, insumoId: number | null): void {
    setMaterials((prev) =>
      prev.map((m) => m.id === id ? { ...m, insumoId, quantity: '', name: '', cost: '' } : m)
    )
  }

  function rowCost(m: MaterialRow): number {
    if (m.insumoId !== null) {
      const insumo = insumos.find((i) => i.id === m.insumoId)
      if (!insumo) return 0
      const qty = parseFloat(m.quantity)
      return isNaN(qty) ? 0 : qty * insumo.costPerUnit
    }
    const val = parseFloat(m.cost)
    return isNaN(val) ? 0 : val
  }

  const totalMaterials = materials.reduce((sum, m) => sum + rowCost(m), 0)
  const labor          = parseFloat(laborCost)
  const laborValue     = isNaN(labor) ? 0 : labor

  const step1      = totalMaterials * 3
  const step2      = step1 + laborValue
  const step3      = step2 * 1.1
  const step4      = step3 + 1
  const finalPrice = calcSuggestedPrice(totalMaterials, laborValue)
  const hasResult  = totalMaterials > 0 || laborValue > 0

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Ferramentas</div>
          <h1 className="page-title">Calculadora de Preço</h1>
          <div className="page-subtitle">Insira os custos e veja o preço de venda sugerido.</div>
        </div>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Coluna de entrada */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Materiais */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>Materiais utilizados</span>
              <button
                onClick={addMaterial}
                style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
              >
                + Adicionar material
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {materials.map((m, index) => {
                const linkedInsumo = m.insumoId !== null ? insumos.find((i) => i.id === m.insumoId) : null
                const computedCost = linkedInsumo ? rowCost(m) : null
                const unitLabel    = linkedInsumo
                  ? (linkedInsumo.unit === 'unidade' ? 'un.' : linkedInsumo.unit)
                  : null

                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        className="input"
                        style={{ flex: 1 }}
                        value={m.insumoId ?? ''}
                        onChange={(e) =>
                          setMaterialInsumo(m.id, e.target.value === '' ? null : Number(e.target.value))
                        }
                      >
                        <option value="">Inserir manualmente…</option>
                        {insumos.length > 0 && (
                          <optgroup label="Insumos cadastrados">
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.unit === 'unidade' ? 'un.' : i.unit} · {formatCurrency(i.costPerUnit)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {materials.length > 1 && (
                        <button
                          onClick={() => removeMaterial(m.id)}
                          className="icon-btn"
                          style={{ color: 'var(--bad)', flexShrink: 0 }}
                          title="Remover"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {m.insumoId === null ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          placeholder={`Nome do material ${index + 1}`}
                          value={m.name}
                          onChange={(e) => updateMaterial(m.id, 'name', e.target.value)}
                        />
                        <div style={{ position: 'relative', width: 120, flexShrink: 0 }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', fontSize: 13, pointerEvents: 'none' }}>R$</span>
                          <input
                            className="input"
                            style={{ paddingLeft: 28 }}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            value={m.cost}
                            onChange={(e) => updateMaterial(m.id, 'cost', e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
                        <input
                          className="input"
                          style={{ width: 140, flexShrink: 0 }}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={`Qtd. em ${unitLabel}`}
                          value={m.quantity}
                          onChange={(e) => updateMaterial(m.id, 'quantity', e.target.value)}
                        />
                        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{unitLabel}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
                          {computedCost !== null && computedCost > 0
                            ? `= ${formatCurrency(computedCost)}`
                            : <span style={{ color: 'var(--ink-5)' }}>= R$ —</span>}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Total de materiais:{' '}
                <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{formatCurrency(totalMaterials)}</span>
              </span>
            </div>
          </div>

          {/* Mão de obra */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <label className="label" style={{ margin: 0 }}>Mão de obra (R$)</label>
              <button
                type="button"
                onClick={saveDefaultLaborCost}
                style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
              >
                {laborSaved ? '✓ Salvo!' : 'Salvar como padrão'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', fontSize: 13, pointerEvents: 'none' }}>R$</span>
              <input
                className="input"
                style={{ paddingLeft: 28 }}
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6, marginBottom: 0 }}>
              Valor cobrado pelo seu tempo e trabalho na confecção desta peça.
            </p>
          </div>
        </div>

        {/* Coluna de resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Breakdown da fórmula */}
          <div className="card">
            <div className="section-title">Cálculo passo a passo</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Materiais × 3', sub: `${formatCurrency(totalMaterials)} × 3`, value: step1 },
                { label: '+ Mão de obra', sub: `${formatCurrency(step1)} + ${formatCurrency(laborValue)}`, value: step2 },
                { label: '× 1,10 (margem)', sub: `${formatCurrency(step2)} × 1,10`, value: step3 },
                { label: '+ Embalagem', sub: `${formatCurrency(step3)} + R$ 1,00`, value: step4 },
                { label: 'Arredondamento', sub: 'Sempre para o R$ inteiro acima', value: hasResult ? finalPrice : 0 }
              ].map(({ label, sub, value }, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: i < 4 ? '1px solid var(--hairline-soft)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{sub}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: hasResult ? 'var(--ink)' : 'var(--ink-5)' }}>
                    {formatCurrency(value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Preço final */}
            <div
              style={{
                marginTop: 16,
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                textAlign: 'center',
                background: hasResult ? 'var(--accent-wash)' : 'var(--surface-alt)',
                transition: 'background 0.2s'
              }}
            >
              <div className="kpi-label">Preço sugerido</div>
              <div className="formula-result" style={{ fontSize: 40, margin: '8px 0' }}>
                {formatCurrency(finalPrice)}
              </div>
              {hasResult && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                  Margem sobre custo total:{' '}
                  {totalMaterials + laborValue > 0
                    ? `${(((finalPrice - (totalMaterials + laborValue)) / (totalMaterials + laborValue)) * 100).toFixed(0)}%`
                    : '—'}
                </div>
              )}
            </div>

            {/* Aplicar a variação */}
            {hasResult && products.length > 0 && (
              <>
                {!showApply ? (
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}
                    onClick={() => setShowApply(true)}
                  >
                    Aplicar preço a uma variação
                  </button>
                ) : (
                  <ApplyToVariation
                    suggestedPrice={finalPrice}
                    products={products}
                    onApplied={() => setShowApply(false)}
                  />
                )}
              </>
            )}
          </div>

          {/* Fórmula */}
          <div className="formula-display">
            <div className="field-label" style={{ marginBottom: 8 }}>Fórmula utilizada</div>
            teto((materiais × 3 + mão de obra) × 1,10 + 1,00)
          </div>
        </div>
      </div>
    </div>
  )
}
