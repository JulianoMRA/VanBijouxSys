import { useState } from 'react'
import Modal from '../ui/Modal'
import type { ProductVariation } from '../../types'

const LABOR_COST_KEY = 'pricing_default_labor_cost'

function loadDefaultLaborCost(): string {
  return localStorage.getItem(LABOR_COST_KEY) ?? ''
}

interface VariationFormProps {
  productId: number
  productName: string
  variation?: ProductVariation
  onSave: () => void
  onClose: () => void
}

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
  const [laborCost, setLaborCost] = useState(loadDefaultLaborCost)

  const isEditing = !!variation

  const materials = parseFloat(costPrice) || 0
  const labor = parseFloat(laborCost) || 0
  const suggestedPrice = Math.ceil((materials * 3 + labor) * 1.1 + 1)
  const hasCalcResult = materials > 0 || labor > 0

  function saveDefaultLaborCost(): void {
    localStorage.setItem(LABOR_COST_KEY, laborCost)
  }

  function useSuggestedPrice(): void {
    setSalePrice(suggestedPrice.toString())
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!identifier.trim()) {
      setError('O identificador é obrigatório (ex: Rosa, Dourado, Fimo unicórnio).')
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

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.variations.update({
          id: variation.id,
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock
        })
      } else {
        await window.api.variations.create({
          productId,
          identifier: identifier.trim(),
          costPrice: cost,
          salePrice: sale,
          stockQuantity: stock,
          minimumStock: minStock
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
          <p className="text-xs text-gray-400 mt-1">
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

        {/* Calculadora de preço */}
        <div className="border border-cream-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCalc((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-cream-50 hover:bg-cream-100 transition-colors text-sm"
          >
            <span className="font-medium text-gray-700">Calculadora de preço</span>
            <span className="text-gray-400 text-xs">{showCalc ? '▲ Fechar' : '▼ Abrir'}</span>
          </button>

          {showCalc && (
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-gray-400">
                O custo de materiais é o preço de custo acima. Informe a mão de obra para calcular o preço sugerido.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Mão de obra (R$)</label>
                  <button
                    type="button"
                    onClick={saveDefaultLaborCost}
                    className="text-xs text-blush-600 hover:text-blush-800 transition-colors"
                  >
                    Salvar como padrão
                  </button>
                </div>
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
              </div>

              {hasCalcResult && (
                <div className="bg-blush-50 rounded-xl p-3 space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Materiais × 3</span>
                    <span>{(materials * 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Mão de obra</span>
                    <span>{labor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>× 1,10 (margem)</span>
                    <span>{((materials * 3 + labor) * 1.1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Embalagem</span>
                    <span>R$ 1,00</span>
                  </div>
                  <div className="flex justify-between font-semibold text-blush-700 pt-1 border-t border-blush-200">
                    <span>Preço sugerido</span>
                    <span>{suggestedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              )}

              {hasCalcResult && (
                <button
                  type="button"
                  onClick={useSuggestedPrice}
                  className="btn-secondary w-full text-sm"
                >
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
            <p className="text-xs text-gray-400 mt-1">
              Alerta aparece quando estoque ficar abaixo deste valor.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar variação'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
