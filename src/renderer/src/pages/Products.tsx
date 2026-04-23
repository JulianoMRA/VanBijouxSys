import { useEffect, useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../utils/format'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProductForm from '../components/products/ProductForm'
import VariationForm from '../components/products/VariationForm'
import VariationDetailsModal from '../components/products/VariationDetailsModal'
import AddStockForm from '../components/products/AddStockForm'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import type { Category, Product, ProductVariation } from '../types'
import { filterAndSortVariations } from '../utils/variation-filters'
import type { VariationSortOption, VariationStockFilter } from '../utils/variation-filters'

type SortOption = 'recente' | 'nome-az' | 'nome-za' | 'mais-variacoes' | 'menos-variacoes'

type Modal =
  | { type: 'newProduct' }
  | { type: 'editProduct'; product: Product }
  | { type: 'deleteProduct'; product: Product }
  | { type: 'newVariation'; product: Product }
  | { type: 'editVariation'; product: Product; variation: ProductVariation }
  | { type: 'deleteVariation'; product: Product; variation: ProductVariation }
  | { type: 'addStock'; product: Product; variation: ProductVariation }
  | { type: 'detailsVariation'; product: Product; variation: ProductVariation }

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
  const [sortBy, setSortBy] = useState<SortOption>('recente')
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [variationSearch, setVariationSearch] = useState('')
  const [variationStockFilter, setVariationStockFilter] = useState<VariationStockFilter>('todos')
  const [variationPriceMin, setVariationPriceMin] = useState('')
  const [variationPriceMax, setVariationPriceMax] = useState('')
  const [variationSortBy, setVariationSortBy] = useState<VariationSortOption>('recente')
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function loadData(): Promise<void> {
    try {
      const [prods, cats] = await Promise.all([
        window.api.products.getAll(),
        window.api.categories.getAll()
      ])
      setProducts(prods)
      setCategories(cats)
    } catch (err) {
      setErrorMessage('Erro ao carregar produtos.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === null || p.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nome-az': return a.name.localeCompare(b.name, 'pt-BR')
        case 'nome-za': return b.name.localeCompare(a.name, 'pt-BR')
        case 'mais-variacoes': return b.variations.length - a.variations.length
        case 'menos-variacoes': return a.variations.length - b.variations.length
        case 'recente': return b.id - a.id
        default: return 0
      }
    })
  }, [products, search, selectedCategory, sortBy])

  const lowStockCount = products.reduce(
    (acc, p) => acc + p.variations.filter((v) => v.stockQuantity < v.minimumStock).length,
    0
  )

  function resetVariationFilters(): void {
    setVariationSearch('')
    setVariationStockFilter('todos')
    setVariationPriceMin('')
    setVariationPriceMax('')
    setVariationSortBy('recente')
  }

  function toggleExpand(id: number): void {
    setExpandedProduct((prev) => {
      if (prev === id) return null
      resetVariationFilters()
      return id
    })
  }

  function getFilteredVariations(variations: ProductVariation[]): ProductVariation[] {
    return filterAndSortVariations(variations, {
      search: variationSearch,
      stockFilter: variationStockFilter,
      priceMin: variationPriceMin,
      priceMax: variationPriceMax,
      sortBy: variationSortBy
    })
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

  const subtitleText = products.length === 0
    ? 'Nenhum produto cadastrado'
    : (search || selectedCategory !== null)
      ? `${filtered.length} de ${products.length} produto${products.length !== 1 ? 's' : ''}`
      : `${products.length} produto${products.length !== 1 ? 's' : ''} cadastrado${products.length !== 1 ? 's' : ''}`

  return (
    <div>
      {/* Page header */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Catálogo</div>
          <h1 className="page-title">Produtos</h1>
          <div className="page-subtitle">
            {subtitleText}
            {lowStockCount > 0 && (
              <span style={{ marginLeft: 10, color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} />
                {lowStockCount} {lowStockCount > 1 ? 'variações' : 'variação'} com estoque baixo
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'newProduct' })}>
          + Novo produto
        </button>
      </div>

      {/* Erro de exclusão */}
      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
          <option value="recente">Último adicionado</option>
          <option value="nome-az">Nome A→Z</option>
          <option value="nome-za">Nome Z→A</option>
          <option value="mais-variacoes">Mais variações</option>
          <option value="menos-variacoes">Menos variações</option>
        </select>
        <div className="chips">
          <button className={`chip${selectedCategory === null ? ' active' : ''}`} onClick={() => setSelectedCategory(null)}>
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`chip${selectedCategory === cat.id ? ' active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum produto encontrado</h3>
          {search === '' && selectedCategory === null && (
            <button className="btn btn-primary mt-4" onClick={() => setModal({ type: 'newProduct' })}>
              Cadastrar primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((product) => {
            const isExpanded = expandedProduct === product.id
            const hasLowStock = product.variations.some((v) => v.stockQuantity < v.minimumStock)

            return (
              <div key={product.id} className={`product-row${isExpanded ? ' expanded' : ''}`}>
                {/* Linha do produto */}
                <div className="product-row-head" onClick={() => toggleExpand(product.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span className="product-name">{product.name}</span>
                      {hasLowStock && (
                        <span
                          className="dot"
                          style={{ background: 'var(--warn)' }}
                          title="Estoque baixo"
                        />
                      )}
                    </div>
                    {product.description && (
                      <div className="product-desc">{product.description}</div>
                    )}
                  </div>

                  <Badge label={product.categoryName} variant="category" />

                  <span style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                    {product.variations.length} {product.variations.length !== 1 ? 'variações' : 'variação'}
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-xs btn-ghost" onClick={() => setModal({ type: 'editProduct', product })}>
                      Editar
                    </button>
                    <button
                      className="btn btn-xs btn-ghost-danger"
                      onClick={() => setModal({ type: 'deleteProduct', product })}
                    >
                      Excluir
                    </button>
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => { setExpandedProduct(product.id); setModal({ type: 'newVariation', product }) }}
                    >
                      + Variação
                    </button>
                  </div>

                  <span style={{ color: 'var(--ink-5)', fontSize: 12, marginLeft: 4 }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                {/* Painel de variações */}
                {isExpanded && (
                  <div className="product-row-body">
                    {product.variations.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Nenhuma variação cadastrada.</span>
                        <button className="btn btn-xs btn-primary" onClick={() => setModal({ type: 'newVariation', product })}>
                          + Cadastrar variação
                        </button>
                      </div>
                    ) : (() => {
                      const filteredVariations = getFilteredVariations(product.variations)
                      const hasActiveFilters = variationSearch !== '' || variationStockFilter !== 'todos' || variationPriceMin !== '' || variationPriceMax !== ''

                      return (
                        <>
                          {/* Filtros de variações */}
                          <div className="flex gap-2 mb-3 flex-wrap items-center">
                            <input
                              className="input"
                              style={{ maxWidth: 180, height: 30, fontSize: 12 }}
                              placeholder="Buscar variação…"
                              value={variationSearch}
                              onChange={(e) => setVariationSearch(e.target.value)}
                            />
                            <select className="select select-sm" value={variationSortBy} onChange={(e) => setVariationSortBy(e.target.value as VariationSortOption)}>
                              <option value="recente">Mais recente</option>
                              <option value="nome-az">Nome A→Z</option>
                              <option value="nome-za">Nome Z→A</option>
                              <option value="preco-maior">Maior preço</option>
                              <option value="preco-menor">Menor preço</option>
                              <option value="estoque-maior">Maior estoque</option>
                              <option value="estoque-menor">Menor estoque</option>
                            </select>
                            <select className="select select-sm" value={variationStockFilter} onChange={(e) => setVariationStockFilter(e.target.value as VariationStockFilter)}>
                              <option value="todos">Todos os estoques</option>
                              <option value="sem-estoque">Sem estoque</option>
                              <option value="estoque-baixo">Estoque baixo</option>
                              <option value="normal">Estoque normal</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <input type="number" className="input" style={{ width: 90, height: 30, fontSize: 11 }} placeholder="Preço mín." value={variationPriceMin} onChange={(e) => setVariationPriceMin(e.target.value)} min="0" step="0.01" />
                              <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>—</span>
                              <input type="number" className="input" style={{ width: 90, height: 30, fontSize: 11 }} placeholder="Preço máx." value={variationPriceMax} onChange={(e) => setVariationPriceMax(e.target.value)} min="0" step="0.01" />
                            </div>
                            {hasActiveFilters && (
                              <button className="btn btn-xs btn-ghost" onClick={resetVariationFilters}>
                                Limpar filtros
                              </button>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 'auto' }}>
                              {hasActiveFilters
                                ? `${filteredVariations.length} de ${product.variations.length}`
                                : product.variations.length}{' '}
                              variação{product.variations.length !== 1 ? 'ões' : ''}
                            </span>
                          </div>

                          {filteredVariations.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0' }}>
                              Nenhuma variação encontrada com os filtros aplicados.
                            </p>
                          ) : (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Identificador</th>
                                  <th className="num">Custo</th>
                                  <th className="num">Venda</th>
                                  <th style={{ textAlign: 'center' }}>Estoque</th>
                                  <th style={{ textAlign: 'center' }}>Mín.</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {filteredVariations.map((v) => (
                                  <tr key={v.id}>
                                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{v.identifier}</td>
                                    <td className="num">
                                      <span className="price-sub">{formatCurrency(v.costPrice)}</span>
                                      {v.insumos.length > 0 && (() => {
                                        const insumosCost = v.insumos.reduce((s, i) => s + i.costPerUnit * i.quantity, 0)
                                        return (
                                          <span className="price-sub" style={{ display: 'block', fontSize: 10 }} title="Custo calculado pelos insumos">
                                            insumos: {formatCurrency(insumosCost)}
                                          </span>
                                        )
                                      })()}
                                    </td>
                                    <td className="num">
                                      <span className="price-main">{formatCurrency(v.salePrice)}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <Badge label={stockLabel(v)} variant={stockVariant(v)} />
                                    </td>
                                    <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>{v.minimumStock}</td>
                                    <td>
                                      <div className="flex justify-end gap-1">
                                        <button className="btn btn-xs btn-ghost" onClick={() => setModal({ type: 'detailsVariation', product, variation: v })}>
                                          Detalhes
                                        </button>
                                        <button
                                          className="btn btn-xs btn-ghost-good"
                                          onClick={() => setModal({ type: 'addStock', product, variation: v })}
                                        >
                                          + Estoque
                                        </button>
                                        <button className="btn btn-xs btn-ghost" onClick={() => setModal({ type: 'editVariation', product, variation: v })}>
                                          Editar
                                        </button>
                                        <button
                                          className="btn btn-xs btn-ghost-danger"
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
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'newProduct' && (
        <ProductForm categories={categories} onSave={() => { loadData(); showToast('Produto salvo!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editProduct' && (
        <ProductForm categories={categories} product={modal.product} onSave={() => { loadData(); showToast('Produto atualizado!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'deleteProduct' && (
        <ConfirmDialog title="Excluir produto" message={`Tem certeza que deseja excluir "${modal.product.name}"? Todas as variações também serão excluídas.`} confirmLabel="Excluir" danger onConfirm={() => handleDeleteProduct(modal.product)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'newVariation' && (
        <VariationForm productId={modal.product.id} productName={modal.product.name} onSave={() => { loadData(); showToast('Variação salva!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editVariation' && (
        <VariationForm productId={modal.product.id} productName={modal.product.name} variation={modal.variation} onSave={() => { loadData(); showToast('Variação atualizada!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'deleteVariation' && (
        <ConfirmDialog title="Excluir variação" message={`Excluir a variação "${modal.variation.identifier}" de "${modal.product.name}"?`} confirmLabel="Excluir" danger onConfirm={() => handleDeleteVariation(modal.variation)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'addStock' && (
        <AddStockForm variation={modal.variation} productName={modal.product.name} onSave={() => { loadData(); showToast('Estoque atualizado!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'detailsVariation' && (
        <VariationDetailsModal product={modal.product} variation={modal.variation} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
