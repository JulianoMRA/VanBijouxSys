import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import type { Fair, Product, ProductVariation, SaleChannel, CreateSaleItemInput } from '../../types'

interface SaleFormProps {
  onSave: () => void
  onClose: () => void
}

interface ItemRow {
  key: number
  productId: number | ''
  variationId: number | ''
  quantity: string
  unitPrice: string
}

const CHANNELS: SaleChannel[] = ['Feira', 'WhatsApp', 'Instagram', 'Outro']

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SaleForm({ onSave, onClose }: SaleFormProps): JSX.Element {
  const [channel, setChannel] = useState<SaleChannel>('Feira')
  const [fairId, setFairId] = useState<number | ''>('')
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<ItemRow[]>([{ key: 0, productId: '', variationId: '', quantity: '1', unitPrice: '' }])
  const [products, setProducts] = useState<Product[]>([])
  const [fairs, setFairs] = useState<Fair[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nextKey = { current: 1 }

  useEffect(() => {
    Promise.all([window.api.products.getAll(), window.api.fairs.getAll()]).then(
      ([prods, frs]) => {
        setProducts(prods)
        setFairs(frs)
      }
    )
  }, [])

  function getVariations(productId: number | ''): ProductVariation[] {
    if (productId === '') return []
    return products.find((p) => p.id === productId)?.variations ?? []
  }

  function updateItem(key: number, changes: Partial<ItemRow>): void {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const updated = { ...item, ...changes }
        if (changes.productId !== undefined) {
          updated.variationId = ''
          updated.unitPrice = ''
        }
        if (changes.variationId !== undefined && changes.variationId !== '') {
          const variations = getVariations(updated.productId)
          const variation = variations.find((v) => v.id === changes.variationId)
          if (variation) updated.unitPrice = variation.salePrice.toString()
        }
        return updated
      })
    )
  }

  function addItem(): void {
    setItems((prev) => [
      ...prev,
      { key: Date.now(), productId: '', variationId: '', quantity: '1', unitPrice: '' }
    ])
  }

  function removeItem(key: number): void {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function buildSaleItems(): CreateSaleItemInput[] | null {
    const result: CreateSaleItemInput[] = []
    for (const item of items) {
      if (item.variationId === '' || item.productId === '') return null
      const qty = parseInt(item.quantity)
      const price = parseFloat(item.unitPrice)
      if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) return null
      const variation = getVariations(item.productId).find((v) => v.id === item.variationId)
      if (!variation) return null
      result.push({
        variationId: variation.id,
        quantity: qty,
        unitPrice: price,
        unitCost: variation.costPrice
      })
    }
    return result
  }

  const saleItems = buildSaleItems()
  const totalAmount = saleItems?.reduce((s, i) => s + i.quantity * i.unitPrice, 0) ?? 0
  const totalCost = saleItems?.reduce((s, i) => s + i.quantity * i.unitCost, 0) ?? 0
  const profit = totalAmount - totalCost

  const selectedFair = channel === 'Feira' && fairId !== ''
    ? fairs.find((f) => f.id === fairId)
    : undefined

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (channel === 'Feira' && fairId === '') {
      setError('Selecione a feira correspondente.')
      return
    }
    if (items.length === 0) {
      setError('Adicione ao menos um item à venda.')
      return
    }
    const builtItems = buildSaleItems()
    if (!builtItems) {
      setError('Preencha todos os campos de cada item corretamente.')
      return
    }

    setSaving(true)
    try {
      await window.api.sales.create({
        channel,
        fairId: channel === 'Feira' && fairId !== '' ? fairId : undefined,
        soldAt,
        items: builtItems
      })
      onSave()
      onClose()
    } catch {
      setError('Erro ao registrar venda. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Registrar Venda" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Canal e data */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Canal de venda</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => { setChannel(ch); setFairId('') }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    channel === ch
                      ? 'bg-blush-500 text-white'
                      : 'bg-cream-100 text-gray-600 hover:bg-cream-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
            <div>
              <label className="label">Data da venda</label>
              <input
                className="input"
                type="date"
                value={soldAt}
                min={selectedFair ? selectedFair.date : undefined}
                max={selectedFair ? (selectedFair.endDate ?? selectedFair.date) : undefined}
                onChange={(e) => setSoldAt(e.target.value)}
              />
            </div>
        </div>

        {/* Feira */}
        {channel === 'Feira' && (
          <div>
            <label className="label">Feira</label>
            <select
              className="input"
              value={fairId}
              onChange={(e) => {
                const id = e.target.value === '' ? '' : Number(e.target.value)
                setFairId(id)
                if (id !== '') {
                  const fair = fairs.find((f) => f.id === id)
                  if (fair) setSoldAt(fair.date)
                }
              }}
            >
              <option value="">Selecione a feira…</option>
              {fairs.map((f) => {
                const start = `${f.date.slice(8, 10)}/${f.date.slice(5, 7)}/${f.date.slice(0, 4)}`
                const end = f.endDate && f.endDate !== f.date
                  ? ` a ${f.endDate.slice(8, 10)}/${f.endDate.slice(5, 7)}`
                  : ''
                return (
                  <option key={f.id} value={f.id}>
                    {f.name} — {start}{end}
                  </option>
                )
              })}
            </select>
            {selectedFair?.endDate && selectedFair.endDate !== selectedFair.date && (
              <p className="text-xs text-gray-400 mt-1">
                Escolha o dia da venda dentro do período da feira ({selectedFair.date.slice(8, 10)} a {selectedFair.endDate.slice(8, 10)}/{selectedFair.date.slice(5, 7)}).
              </p>
            )}
          </div>
        )}

        {/* Itens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Itens vendidos</label>
            <button
              type="button"
              onClick={addItem}
              className="text-xs text-blush-600 hover:text-blush-800 font-medium transition-colors"
            >
              + Adicionar item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const variations = getVariations(item.productId)
              const selectedVariation =
                item.variationId !== ''
                  ? variations.find((v) => v.id === item.variationId)
                  : undefined

              return (
                <div key={item.key} className="bg-cream-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Produto</label>
                      <select
                        className="input"
                        value={item.productId}
                        onChange={(e) =>
                          updateItem(item.key, {
                            productId: e.target.value === '' ? '' : Number(e.target.value)
                          })
                        }
                      >
                        <option value="">Selecione…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Variação</label>
                      <select
                        className="input"
                        value={item.variationId}
                        disabled={item.productId === ''}
                        onChange={(e) =>
                          updateItem(item.key, {
                            variationId: e.target.value === '' ? '' : Number(e.target.value)
                          })
                        }
                      >
                        <option value="">Selecione…</option>
                        {variations.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.identifier} (estoque: {v.stockQuantity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="label">Qtd.</label>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Preço unit. (R$)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                        placeholder={selectedVariation ? selectedVariation.salePrice.toString() : '0,00'}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      {item.unitPrice !== '' && item.quantity !== '' ? (
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(parseFloat(item.unitPrice || '0') * parseInt(item.quantity || '0'))}
                        </span>
                      ) : (
                        <span />
                      )}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="text-rose-400 hover:text-rose-600 text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedVariation &&
                    parseInt(item.quantity) > selectedVariation.stockQuantity && (
                      <p className="text-xs text-amber-600">
                        ⚠ Quantidade maior que o estoque disponível ({selectedVariation.stockQuantity} un.)
                      </p>
                    )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Resumo */}
        {saleItems && saleItems.length > 0 && (
          <div className="bg-blush-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total de itens</span>
              <span className="font-medium">{saleItems.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Custo total</span>
              <span className="font-medium">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-blush-200">
              <span>Total da venda</span>
              <span className="text-blush-700 text-base">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 text-xs">
              <span>Lucro estimado</span>
              <span className="font-medium">{formatCurrency(profit)}</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar venda'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
