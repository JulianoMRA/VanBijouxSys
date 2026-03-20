import { useEffect, useState } from 'react'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProductForm from '../components/products/ProductForm'
import VariationForm from '../components/products/VariationForm'
import AddStockForm from '../components/products/AddStockForm'
import type { Category, Product, ProductVariation } from '../types'

type Modal =
  | { type: 'newProduct' }
  | { type: 'editProduct'; product: Product }
  | { type: 'deleteProduct'; product: Product }
  | { type: 'newVariation'; product: Product }
  | { type: 'editVariation'; product: Product; variation: ProductVariation }
  | { type: 'deleteVariation'; product: Product; variation: ProductVariation }
  | { type: 'addStock'; product: Product; variation: ProductVariation }

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function stockVariant(v: ProductVariation): 'success' | 'warning' | 'danger' {
  if (v.stockQuantity === 0) return 'danger'
  if (v.stockQuantity < v.minimumStock) return 'warning'
  return 'success'
}

function stockLabel(v: ProductVariation): string {
  if (v.stockQuantity === 0) return 'Sem estoque'
  if (v.stockQuantity < v.minimumStock) return `${v.stockQuantity} un. — baixo`
  return `${v.stockQuantity} un.`
}

export default function Products(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadData(): Promise<void> {
    const [prods, cats] = await Promise.all([
      window.api.products.getAll(),
      window.api.categories.getAll()
    ])
    setProducts(prods)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === null || p.categoryId === selectedCategory
    return matchesSearch && matchesCategory
  })

  const lowStockCount = products.reduce((acc, p) => {
    return acc + p.variations.filter((v) => v.stockQuantity < v.minimumStock).length
  }, 0)

  function toggleExpand(id: number): void {
    setExpandedProduct((prev) => (prev === id ? null : id))
  }

  async function handleDeleteProduct(product: Product): Promise<void> {
    try {
      await window.api.products.delete(product.id)
      if (expandedProduct === product.id) setExpandedProduct(null)
      await loadData()
    } catch {
      setErrorMessage(
        `"${product.name}" não pode ser excluído pois possui vendas registradas. O histórico de vendas seria perdido.`
      )
    }
  }

  async function handleDeleteVariation(variation: ProductVariation): Promise<void> {
    try {
      await window.api.variations.delete(variation.id)
      await loadData()
    } catch {
      setErrorMessage(
        `A variação "${variation.identifier}" não pode ser excluída pois está vinculada a vendas registradas.`
      )
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-800">Produtos</h2>
          {lowStockCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">
              ⚠ {lowStockCount} variação{lowStockCount > 1 ? 'ões' : ''} com estoque baixo
            </p>
          )}
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'newProduct' })}>
          + Novo produto
        </button>
      </div>

      {/* Erro de exclusão */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-400 hover:text-rose-600 shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === null
                ? 'bg-blush-500 text-white'
                : 'bg-white border border-cream-300 text-gray-600 hover:bg-cream-100'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blush-500 text-white'
                  : 'bg-white border border-cream-300 text-gray-600 hover:bg-cream-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-40 text-center">
          <p className="text-gray-500 text-sm">Nenhum produto encontrado.</p>
          {search === '' && selectedCategory === null && (
            <button
              className="btn-primary mt-3"
              onClick={() => setModal({ type: 'newProduct' })}
            >
              Cadastrar primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const isExpanded = expandedProduct === product.id
            const hasLowStock = product.variations.some(
              (v) => v.stockQuantity < v.minimumStock
            )

            return (
              <div key={product.id} className="bg-white rounded-2xl border border-cream-200 shadow-card overflow-hidden">
                {/* Linha do produto */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-cream-50 transition-colors"
                  onClick={() => toggleExpand(product.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{product.name}</span>
                      {hasLowStock && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Estoque baixo" />
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{product.description}</p>
                    )}
                  </div>

                  <Badge label={product.categoryName} variant="category" />

                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {product.variations.length} variação{product.variations.length !== 1 ? 'ões' : ''}
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
                      onClick={() => setModal({ type: 'editProduct', product })}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      onClick={() => setModal({ type: 'deleteProduct', product })}
                    >
                      Excluir
                    </button>
                    <button
                      className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
                      onClick={() => {
                        setExpandedProduct(product.id)
                        setModal({ type: 'newVariation', product })
                      }}
                    >
                      + Variação
                    </button>
                  </div>

                  <span className="text-gray-300 text-sm ml-1">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Painel de variações */}
                {isExpanded && (
                  <div className="border-t border-cream-100 bg-cream-50 px-5 py-4">
                    {product.variations.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400">Nenhuma variação cadastrada.</p>
                        <button
                          className="btn-primary text-xs"
                          onClick={() => setModal({ type: 'newVariation', product })}
                        >
                          + Cadastrar variação
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase tracking-wide">
                            <th className="text-left pb-2 font-medium">Identificador</th>
                            <th className="text-right pb-2 font-medium">Custo</th>
                            <th className="text-right pb-2 font-medium">Venda</th>
                            <th className="text-center pb-2 font-medium">Estoque</th>
                            <th className="text-center pb-2 font-medium">Mín.</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-200">
                          {product.variations.map((v) => (
                            <tr key={v.id} className="hover:bg-cream-100 transition-colors">
                              <td className="py-2.5 font-medium text-gray-700">{v.identifier}</td>
                              <td className="py-2.5 text-right text-gray-500">{formatCurrency(v.costPrice)}</td>
                              <td className="py-2.5 text-right text-gray-800 font-medium">{formatCurrency(v.salePrice)}</td>
                              <td className="py-2.5 text-center">
                                <Badge label={stockLabel(v)} variant={stockVariant(v)} />
                              </td>
                              <td className="py-2.5 text-center text-gray-400">{v.minimumStock}</td>
                              <td className="py-2.5">
                                <div className="flex justify-end gap-1">
                                  <button
                                    className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                                    onClick={() => setModal({ type: 'addStock', product, variation: v })}
                                  >
                                    + Estoque
                                  </button>
                                  <button
                                    className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
                                    onClick={() => setModal({ type: 'editVariation', product, variation: v })}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                                    onClick={() => setModal({ type: 'deleteVariation', product, variation: v })}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'newProduct' && (
        <ProductForm
          categories={categories}
          onSave={loadData}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editProduct' && (
        <ProductForm
          categories={categories}
          product={modal.product}
          onSave={loadData}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deleteProduct' && (
        <ConfirmDialog
          title="Excluir produto"
          message={`Tem certeza que deseja excluir "${modal.product.name}"? Todas as variações também serão excluídas.`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDeleteProduct(modal.product)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'newVariation' && (
        <VariationForm
          productId={modal.product.id}
          productName={modal.product.name}
          onSave={loadData}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editVariation' && (
        <VariationForm
          productId={modal.product.id}
          productName={modal.product.name}
          variation={modal.variation}
          onSave={loadData}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deleteVariation' && (
        <ConfirmDialog
          title="Excluir variação"
          message={`Excluir a variação "${modal.variation.identifier}" de "${modal.product.name}"?`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDeleteVariation(modal.variation)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'addStock' && (
        <AddStockForm
          variation={modal.variation}
          productName={modal.product.name}
          onSave={loadData}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
