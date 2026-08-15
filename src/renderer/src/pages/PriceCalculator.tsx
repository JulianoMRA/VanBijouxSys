import { useEffect, useRef, useState } from 'react'
import { calcSuggestedPrice } from '../utils/pricing'
import { formatCurrency } from '../utils/format'
import { estaArquivado, opcoesComSelecionados, variacoesAtivas } from '../utils/arquivamento'
import type { Insumo, Product } from '../types'

const LABOR_COST_KEY = 'pricing_default_labor_cost'
const FORMULA = 'teto((materiais × 3 + mão de obra) × 1,10 + 1,00)'

interface MaterialRow {
  id: string
  // Modo manual: nome e custo informados direto.
  name: string
  cost: string
  // Modo insumo (insumoId null = manual): quantidade sobre o custo unitário.
  insumoId: number | null
  quantity: string
}

function ApplyToVariation({
  suggestedPrice,
  products,
  habilitado,
  onApplied
}: {
  suggestedPrice: number
  products: Product[]
  habilitado: boolean
  onApplied: () => void
}): JSX.Element {
  const [productId, setProductId] = useState<number | ''>('')
  const [variationId, setVariationId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Aplicar preço a algo arquivado não faz sentido: se ela quiser, desarquiva.
  const produtosAtivos = products.filter((p) => !estaArquivado(p))
  const selectedProduct = produtosAtivos.find((p) => p.id === productId)
  const variations = selectedProduct ? variacoesAtivas(selectedProduct) : []
  const selectedVariation = variations.find((v) => v.id === variationId)

  const diferenca =
    selectedVariation && selectedVariation.salePrice > 0
      ? ((suggestedPrice - selectedVariation.salePrice) / selectedVariation.salePrice) * 100
      : null

  async function handleApply(): Promise<void> {
    if (!selectedVariation) return
    setSaving(true)
    try {
      await window.api.variations.update({
        id: selectedVariation.id,
        productId: selectedVariation.productId,
        identifier: selectedVariation.identifier,
        costPrice: selectedVariation.costPrice,
        salePrice: suggestedPrice,
        stockQuantity: selectedVariation.stockQuantity,
        minimumStock: selectedVariation.minimumStock,
        laborCost: selectedVariation.laborCost
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
    <div className="card">
      <p className="mb-3 text-sm font-semibold text-ink-900">Aplicar a uma variação</p>

      <div className="mb-3 flex gap-2">
        <select
          className="input flex-1"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value === '' ? '' : Number(e.target.value))
            setVariationId('')
          }}
        >
          <option value="">Produto…</option>
          {produtosAtivos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.categoryName})
            </option>
          ))}
        </select>
        <select
          className="input flex-1"
          value={variationId}
          disabled={productId === ''}
          onChange={(e) => setVariationId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Variação…</option>
          {variations.map((v) => (
            <option key={v.id} value={v.id}>
              {v.identifier}
            </option>
          ))}
        </select>
      </div>

      {selectedVariation && (
        <div className="mb-3 flex items-center gap-3 rounded-control bg-bone-200 px-3 py-2.5">
          <span className="text-aux text-ink-400">
            Preço atual{' '}
            <strong className="font-semibold text-ink-800 line-through decoration-ink-100">
              {formatCurrency(selectedVariation.salePrice)}
            </strong>
          </span>
          <span className="text-aux text-ink-200">→</span>
          <span className="text-aux text-ink-400">
            novo{' '}
            <strong className="font-semibold text-wine-500">
              {formatCurrency(suggestedPrice)}
            </strong>
          </span>
          {diferenca !== null && Math.abs(diferenca) >= 0.5 && (
            <span
              className={`ml-auto rounded-[5px] px-2 py-0.5 text-meta font-bold ${
                diferenca < 0 ? 'bg-honey-100 text-honey-500' : 'bg-sage-100 text-sage-500'
              }`}
            >
              {diferenca < 0 ? 'baixa' : 'alta'} de {Math.abs(diferenca).toFixed(0)}%
            </span>
          )}
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={handleApply}
        disabled={!habilitado || !selectedVariation || saving || success}
      >
        {success
          ? '✓ Preço aplicado!'
          : saving
            ? 'Aplicando…'
            : selectedVariation
              ? `Aplicar ${formatCurrency(suggestedPrice)} a ${selectedProduct?.name} — ${selectedVariation.identifier}`
              : 'Escolha o produto e a variação'}
      </button>
    </div>
  )
}

export default function PriceCalculator(): JSX.Element {
  const counter = useRef(0)
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { id: 'item-0', name: '', cost: '', insumoId: null, quantity: '' }
  ])
  const [laborCost, setLaborCost] = useState(() => localStorage.getItem(LABOR_COST_KEY) ?? '')
  const [products, setProducts] = useState<Product[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [laborSaved, setLaborSaved] = useState(false)

  async function loadData(): Promise<void> {
    const [prods, insms] = await Promise.all([
      window.api.products.getAll(),
      window.api.insumos.getAll()
    ])
    setProducts(prods)
    setInsumos(insms)
  }

  useEffect(() => {
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
      prev.map((m) => (m.id === id ? { ...m, insumoId, quantity: '', name: '', cost: '' } : m))
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

  // Insumo arquivado sai da lista, mas continua visível se já foi escolhido
  // numa linha aberta — trocar a opção embaixo do dedo dela seria pior.
  const insumosDisponiveis = opcoesComSelecionados(
    insumos,
    materials.map((m) => m.insumoId).filter((id): id is number => id !== null)
  )

  const totalMaterials = materials.reduce((sum, m) => sum + rowCost(m), 0)
  const labor = parseFloat(laborCost)
  const laborValue = isNaN(labor) ? 0 : labor

  const step1 = totalMaterials * 3
  const step2 = step1 + laborValue
  const step3 = step2 * 1.1
  const step4 = step3 + 1
  const finalPrice = calcSuggestedPrice(totalMaterials, laborValue)
  const hasResult = totalMaterials > 0 || laborValue > 0
  const custoTotal = totalMaterials + laborValue
  const margemSobreCusto = custoTotal > 0 ? ((finalPrice - custoTotal) / custoTotal) * 100 : null

  const passos = [
    { titulo: 'Materiais × 3', conta: `${formatCurrency(totalMaterials)} × 3`, valor: step1 },
    {
      titulo: '+ Mão de obra',
      conta: `${formatCurrency(step1)} + ${formatCurrency(laborValue)}`,
      valor: step2
    },
    { titulo: '× 1,10 (margem)', conta: `${formatCurrency(step2)} × 1,10`, valor: step3 },
    { titulo: '+ Embalagem', conta: `${formatCurrency(step3)} + R$ 1,00`, valor: step4 },
    {
      titulo: 'Arredondamento',
      conta: 'sempre para o real inteiro acima',
      valor: finalPrice,
      destaque: true
    }
  ]

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <p className="label mb-1">{FORMULA}</p>
        <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
          Precificação
        </h2>
      </div>

      <div className="grid grid-cols-[1.05fr_1fr] items-start gap-3.5 px-8 pt-[22px]">
        <div className="card">
          <div className="mb-3.5 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink-900">Materiais</p>
            <button
              onClick={addMaterial}
              className="text-aux font-semibold text-wine-500 transition-colors hover:text-wine-600"
            >
              + Adicionar material
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {materials.map((m, index) => {
              const insumo = m.insumoId !== null ? insumos.find((i) => i.id === m.insumoId) : null
              const unitLabel = insumo ? (insumo.unit === 'unidade' ? 'un.' : insumo.unit) : null
              const subtotal = rowCost(m)

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-[11px] border border-bone-400 bg-bone-100 p-3"
                >
                  <span
                    className="h-6 w-1.5 shrink-0 rounded-full"
                    style={{ background: insumo ? '#c9a15f' : '#d5c8c2' }}
                  />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <select
                      className="input py-1.5 text-aux"
                      value={m.insumoId ?? ''}
                      onChange={(e) =>
                        setMaterialInsumo(
                          m.id,
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    >
                      <option value="">Inserir manualmente…</option>
                      {insumosDisponiveis.length > 0 && (
                        <optgroup label="Insumos cadastrados">
                          {insumosDisponiveis.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit === 'unidade' ? 'un.' : i.unit} ·{' '}
                              {formatCurrency(i.costPerUnit)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {m.insumoId === null ? (
                      <input
                        className="input py-1.5 text-aux"
                        placeholder={`Nome do material ${index + 1}`}
                        value={m.name}
                        onChange={(e) => updateMaterial(m.id, 'name', e.target.value)}
                      />
                    ) : (
                      <p className="text-micro text-ink-300">
                        Insumo · {formatCurrency(insumo!.costPerUnit)}/{unitLabel}
                      </p>
                    )}
                  </div>

                  {m.insumoId === null ? (
                    <div className="relative w-[104px] shrink-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aux text-ink-300">
                        R$
                      </span>
                      <input
                        className="input py-1.5 pl-8 text-right text-aux tabular-nums"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={m.cost}
                        onChange={(e) => updateMaterial(m.id, 'cost', e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        className="input w-[68px] py-1.5 text-right text-aux tabular-nums"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Qtd."
                        value={m.quantity}
                        onChange={(e) => updateMaterial(m.id, 'quantity', e.target.value)}
                      />
                      <span className="w-7 text-aux text-ink-400">{unitLabel}</span>
                    </div>
                  )}

                  <span className="w-[82px] shrink-0 text-right text-body font-semibold tabular-nums text-ink-900">
                    {subtotal > 0 ? (
                      formatCurrency(subtotal)
                    ) : (
                      <span className="text-ink-100">—</span>
                    )}
                  </span>

                  {materials.length > 1 && (
                    <button
                      onClick={() => removeMaterial(m.id)}
                      className="shrink-0 text-lg leading-none text-ink-100 transition-colors hover:text-clay-500"
                      title="Remover material"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3.5 flex items-baseline justify-between border-t border-bone-300 pt-3">
            <span className="text-body text-ink-600">Total de materiais</span>
            <span className="text-base font-semibold tabular-nums text-ink-900">
              {formatCurrency(totalMaterials)}
            </span>
          </div>

          <div className="my-5 h-px bg-bone-300" />

          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-ink-900">Mão de obra</p>
            <button
              type="button"
              onClick={saveDefaultLaborCost}
              className="text-aux font-semibold text-wine-500 transition-colors hover:text-wine-600"
            >
              {laborSaved ? '✓ Salvo!' : 'Salvar como padrão'}
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-[150px] shrink-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-300">
                R$
              </span>
              <input
                className="input pl-9 font-semibold tabular-nums"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
              />
            </div>
            <p className="flex-1 text-aux text-ink-400">Seu tempo de confecção desta peça.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="card">
            <p className="label mb-1">Preço sugerido</p>
            <div className="flex items-end justify-between gap-4">
              <p
                className={`text-[46px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${
                  hasResult ? 'text-wine-500' : 'text-ink-100'
                }`}
              >
                {hasResult ? formatCurrency(finalPrice) : 'R$ —'}
              </p>
              {hasResult && margemSobreCusto !== null && (
                <div className="pb-1 text-right">
                  <p className="text-aux text-ink-400">margem sobre custo</p>
                  <p className="text-[15px] font-semibold tabular-nums text-sage-500">
                    {margemSobreCusto.toFixed(0)}%
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col">
              {passos.map((passo) => (
                <div
                  key={passo.titulo}
                  className="flex items-baseline justify-between gap-3 border-t border-bone-300 py-2.5"
                >
                  <div>
                    <p className="text-body font-medium text-ink-800">{passo.titulo}</p>
                    <p className="mt-px text-micro tabular-nums text-ink-300">{passo.conta}</p>
                  </div>
                  <span
                    className={`whitespace-nowrap text-body font-semibold tabular-nums ${
                      !hasResult
                        ? 'text-ink-100'
                        : passo.destaque
                          ? 'text-wine-500'
                          : 'text-ink-800'
                    }`}
                  >
                    {formatCurrency(passo.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {products.length > 0 && (
            <ApplyToVariation
              suggestedPrice={finalPrice}
              products={products}
              habilitado={hasResult}
              onApplied={loadData}
            />
          )}
        </div>
      </div>
    </div>
  )
}
