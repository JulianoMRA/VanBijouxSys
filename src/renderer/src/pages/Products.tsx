import { useEffect, useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '../utils/format'
import {
  contarAlertasDeEstoque,
  estaArquivado,
  estoqueAtivo,
  variacoesAtivas
} from '../utils/arquivamento'
import ActionMenu from '../components/ui/ActionMenu'
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
  | { type: 'archiveProduct'; product: Product }
  | { type: 'archiveVariation'; product: Product; variation: ProductVariation }

interface EstoqueInfo {
  pct: number
  barra: string
  classeTexto: string
  valor: string
}

function estoqueInfo(v: ProductVariation): EstoqueInfo {
  if (v.stockQuantity === 0) {
    return { pct: 0, barra: '#b3413f', classeTexto: 'text-clay-500', valor: '0 un.' }
  }
  if (v.stockQuantity < v.minimumStock) {
    return {
      pct: v.minimumStock > 0 ? (v.stockQuantity / v.minimumStock) * 100 : 100,
      barra: '#c98b2e',
      classeTexto: 'text-honey-500',
      valor: `${v.stockQuantity} / ${v.minimumStock}`
    }
  }
  return {
    pct: 100,
    barra: '#5d8f76',
    classeTexto: 'text-ink-900',
    valor: `${v.stockQuantity} un.`
  }
}

function formatarMargem(v: ProductVariation): string {
  if (v.salePrice <= 0) return '—'
  const margem = ((v.salePrice - v.costPrice) / v.salePrice) * 100
  return `${margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function Tag({
  texto,
  tom
}: {
  texto: string
  tom: 'categoria' | 'alerta' | 'critico' | 'neutro'
}): JSX.Element {
  const estilos = {
    categoria: 'bg-plum-100 text-plum-500',
    alerta: 'bg-honey-100 text-honey-500',
    critico: 'bg-clay-100 text-clay-600',
    neutro: 'bg-bone-300 text-ink-400'
  }
  return (
    <span
      className={`shrink-0 rounded-[5px] px-2 py-0.5 text-meta font-bold tracking-[0.03em] ${estilos[tom]}`}
    >
      {texto}
    </span>
  )
}

const TH = 'px-3 py-2.5 text-meta font-bold uppercase tracking-[0.1em] text-ink-200'

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
  const [mostrandoArquivados, setMostrandoArquivados] = useState(false)
  const [mostrarVariacoesArquivadas, setMostrarVariacoesArquivadas] = useState(false)

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

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      // A aba de arquivados é excludente: ou se está trabalhando, ou se está
      // revisando o que saiu de circulação.
      if (estaArquivado(p) !== mostrandoArquivados) return false
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === null || p.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nome-az':
          return a.name.localeCompare(b.name, 'pt-BR')
        case 'nome-za':
          return b.name.localeCompare(a.name, 'pt-BR')
        case 'mais-variacoes':
          return b.variations.length - a.variations.length
        case 'menos-variacoes':
          return a.variations.length - b.variations.length
        case 'recente':
          return b.id - a.id
        default:
          return 0
      }
    })
  }, [products, search, selectedCategory, sortBy, mostrandoArquivados])

  const ativos = products.filter((p) => !estaArquivado(p))
  const arquivados = products.filter(estaArquivado)
  const totalVariacoes = ativos.reduce((acc, p) => acc + variacoesAtivas(p).length, 0)
  const { esgotadas: totalEsgotadas, abaixoDoMinimo: totalBaixas } =
    contarAlertasDeEstoque(products)
  const filtrando = search !== '' || selectedCategory !== null

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

  function getFilteredVariations(
    produto: Product,
    variations: ProductVariation[]
  ): ProductVariation[] {
    // Num produto arquivado tudo já está fora de circulação: esconder as
    // variações ali não ajudaria ninguém.
    const visiveis =
      estaArquivado(produto) || mostrarVariacoesArquivadas
        ? variations
        : variations.filter((v) => !estaArquivado(v))

    return filterAndSortVariations(visiveis, {
      search: variationSearch,
      stockFilter: variationStockFilter,
      priceMin: variationPriceMin,
      priceMax: variationPriceMax,
      sortBy: variationSortBy
    })
  }

  async function handleDeleteProduct(product: Product): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.products.delete(product.id)
      if (expandedProduct === product.id) setExpandedProduct(null)
      await loadData()
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `"${product.name}": ${err.message}`
          : `"${product.name}" não pode ser excluído.`
      )
    }
  }

  async function arquivarProduto(product: Product, arquivar: boolean): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.products.setArchived(product.id, arquivar)
      if (arquivar && expandedProduct === product.id) setExpandedProduct(null)
      await loadData()
      showToast(arquivar ? 'Produto arquivado.' : 'Produto desarquivado.')
    } catch {
      setErrorMessage(
        `Não foi possível ${arquivar ? 'arquivar' : 'desarquivar'} "${product.name}".`
      )
    }
  }

  async function arquivarVariacao(variation: ProductVariation, arquivar: boolean): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.variations.setArchived(variation.id, arquivar)
      await loadData()
      showToast(arquivar ? 'Variação arquivada.' : 'Variação desarquivada.')
    } catch {
      setErrorMessage(
        `Não foi possível ${arquivar ? 'arquivar' : 'desarquivar'} a variação "${variation.identifier}".`
      )
    }
  }

  async function handleDeleteVariation(variation: ProductVariation): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.variations.delete(variation.id)
      await loadData()
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Variação "${variation.identifier}": ${err.message}`
          : `A variação "${variation.identifier}" não pode ser excluída.`
      )
    }
  }

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">
              {mostrandoArquivados
                ? `${filtered.length} de ${arquivados.length} arquivados`
                : filtrando
                  ? `${filtered.length} de ${ativos.length} produtos`
                  : `${ativos.length} produto${ativos.length !== 1 ? 's' : ''} · ${totalVariacoes} variaç${totalVariacoes !== 1 ? 'ões' : 'ão'}`}
              {!mostrandoArquivados && totalEsgotadas > 0 && (
                <span className="text-clay-500">
                  {' '}
                  · {totalEsgotadas} esgotada{totalEsgotadas !== 1 ? 's' : ''}
                </span>
              )}
              {!mostrandoArquivados && totalBaixas > 0 && (
                <span className="text-honey-500"> · {totalBaixas} abaixo do mínimo</span>
              )}
            </p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              Produtos
            </h2>
          </div>
          <button className="btn-primary" onClick={() => setModal({ type: 'newProduct' })}>
            + Novo produto
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-[280px]"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mx-1 h-[22px] w-px bg-bone-500" />
          <button
            onClick={() => {
              setSelectedCategory(null)
              setMostrandoArquivados(false)
            }}
            className={`rounded-lg px-3 py-1.5 text-body transition-colors ${
              selectedCategory === null && !mostrandoArquivados
                ? 'bg-ink-900 font-semibold text-bone-50'
                : 'font-medium text-ink-600 hover:bg-bone-300'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-body transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-ink-900 font-semibold text-bone-50'
                  : 'font-medium text-ink-600 hover:bg-bone-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
          {arquivados.length > 0 && (
            <>
              <div className="mx-1 h-[22px] w-px bg-bone-500" />
              <button
                onClick={() => {
                  setMostrandoArquivados((v) => !v)
                  setExpandedProduct(null)
                }}
                className={`rounded-lg px-3 py-1.5 text-body transition-colors ${
                  mostrandoArquivados
                    ? 'bg-ink-900 font-semibold text-bone-50'
                    : 'font-medium text-ink-600 hover:bg-bone-300'
                }`}
              >
                Arquivados{' '}
                <span className={mostrandoArquivados ? 'opacity-55' : 'text-ink-200'}>
                  {arquivados.length}
                </span>
              </button>
            </>
          )}
          <label className="ml-auto flex items-center gap-1 text-aux text-ink-300">
            Ordenar:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="cursor-pointer bg-transparent font-semibold text-ink-800 outline-none"
            >
              <option value="recente">recentes</option>
              <option value="nome-az">nome A→Z</option>
              <option value="nome-za">nome Z→A</option>
              <option value="mais-variacoes">mais variações</option>
              <option value="menos-variacoes">menos variações</option>
            </select>
          </label>
        </div>
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

        {loading ? (
          <div className="card flex h-40 items-center justify-center">
            <p className="text-body text-ink-300">Carregando…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex h-40 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhum produto encontrado.</p>
            {!filtrando && (
              <button className="btn-primary mt-3" onClick={() => setModal({ type: 'newProduct' })}>
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => {
              const isExpanded = expandedProduct === product.id
              const arquivado = estaArquivado(product)
              const ativas = variacoesAtivas(product)
              const esgotadas = ativas.filter((v) => v.stockQuantity === 0).length
              const baixas = ativas.filter(
                (v) => v.stockQuantity > 0 && v.stockQuantity < v.minimumStock
              ).length
              const arquivadasNoProduto = product.variations.filter(estaArquivado).length

              return (
                <div
                  key={product.id}
                  className={`overflow-hidden rounded-card border border-bone-400 ${
                    arquivado ? 'bg-bone-100' : 'bg-bone-50'
                  }`}
                >
                  <div
                    className={`flex cursor-pointer items-center gap-4 px-[22px] py-4 transition-colors ${
                      isExpanded ? 'border-b border-bone-400 bg-bone-100' : 'hover:bg-bone-100'
                    }`}
                    onClick={() => toggleExpand(product.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`text-[15px] font-semibold ${
                            arquivado ? 'text-ink-500' : 'text-ink-900'
                          }`}
                        >
                          {product.name}
                        </span>
                        <Tag texto={product.categoryName.toUpperCase()} tom="categoria" />
                        {arquivado && <Tag texto="ARQUIVADO" tom="neutro" />}
                        {!arquivado && esgotadas > 0 && (
                          <Tag
                            texto={`${esgotadas} esgotada${esgotadas !== 1 ? 's' : ''}`}
                            tom="critico"
                          />
                        )}
                        {!arquivado && baixas > 0 && (
                          <Tag texto={`${baixas} abaixo do mínimo`} tom="alerta" />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-aux text-ink-300">
                        {product.description ? `${product.description} · ` : ''}
                        {arquivado ? product.variations.length : ativas.length} variaç
                        {(arquivado ? product.variations.length : ativas.length) !== 1
                          ? 'ões'
                          : 'ão'}
                        {!arquivado &&
                          arquivadasNoProduto > 0 &&
                          ` · ${arquivadasNoProduto} arquivada${arquivadasNoProduto !== 1 ? 's' : ''}`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="label mb-0">Estoque</p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          arquivado ? 'text-ink-400' : 'text-ink-900'
                        }`}
                      >
                        {arquivado
                          ? product.variations.reduce((s, v) => s + v.stockQuantity, 0)
                          : estoqueAtivo(product)}{' '}
                        un.
                      </p>
                    </div>

                    <div
                      className="flex shrink-0 items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {arquivado ? (
                        <button
                          className="btn-secondary px-2.5 py-1.5 text-aux"
                          onClick={() => arquivarProduto(product, false)}
                        >
                          Desarquivar
                        </button>
                      ) : (
                        <button
                          className="btn-secondary px-2.5 py-1.5 text-aux"
                          onClick={() => {
                            setExpandedProduct(product.id)
                            setModal({ type: 'newVariation', product })
                          }}
                        >
                          + Variação
                        </button>
                      )}
                      <ActionMenu
                        items={[
                          ...(arquivado
                            ? []
                            : [
                                {
                                  label: 'Editar produto',
                                  onClick: () => setModal({ type: 'editProduct', product })
                                },
                                {
                                  label: 'Arquivar produto',
                                  onClick: () =>
                                    estoqueAtivo(product) > 0
                                      ? setModal({ type: 'archiveProduct', product })
                                      : arquivarProduto(product, true)
                                }
                              ]),
                          {
                            label: 'Excluir produto',
                            danger: true,
                            onClick: () => setModal({ type: 'deleteProduct', product })
                          }
                        ]}
                      />
                      {isExpanded ? (
                        <ChevronUp size={15} className="text-ink-200" />
                      ) : (
                        <ChevronDown size={15} className="text-ink-200" />
                      )}
                    </div>
                  </div>

                  {isExpanded &&
                    (product.variations.length === 0 ? (
                      <div className="flex items-center justify-between px-[22px] py-4">
                        <p className="text-body text-ink-300">Nenhuma variação cadastrada.</p>
                        <button
                          className="btn-primary"
                          onClick={() => setModal({ type: 'newVariation', product })}
                        >
                          + Cadastrar variação
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const variacoes = getFilteredVariations(product, product.variations)
                        const filtrosAtivos =
                          variationSearch !== '' ||
                          variationStockFilter !== 'todos' ||
                          variationPriceMin !== '' ||
                          variationPriceMax !== ''

                        return (
                          <>
                            <div className="flex flex-wrap items-center gap-2 border-b border-bone-300 px-[22px] py-3">
                              <input
                                className="input w-[180px] py-1.5 text-aux"
                                placeholder="Buscar variação…"
                                value={variationSearch}
                                onChange={(e) => setVariationSearch(e.target.value)}
                              />
                              <select
                                value={variationSortBy}
                                onChange={(e) =>
                                  setVariationSortBy(e.target.value as VariationSortOption)
                                }
                                className="input w-auto py-1.5 text-aux"
                              >
                                <option value="recente">Mais recente</option>
                                <option value="nome-az">Nome A→Z</option>
                                <option value="nome-za">Nome Z→A</option>
                                <option value="preco-maior">Maior preço</option>
                                <option value="preco-menor">Menor preço</option>
                                <option value="estoque-maior">Maior estoque</option>
                                <option value="estoque-menor">Menor estoque</option>
                              </select>
                              <select
                                value={variationStockFilter}
                                onChange={(e) =>
                                  setVariationStockFilter(e.target.value as VariationStockFilter)
                                }
                                className="input w-auto py-1.5 text-aux"
                              >
                                <option value="todos">Todos os estoques</option>
                                <option value="sem-estoque">Sem estoque</option>
                                <option value="estoque-baixo">Estoque baixo</option>
                                <option value="normal">Estoque normal</option>
                              </select>
                              <input
                                type="number"
                                className="input w-28 py-1.5 text-aux"
                                placeholder="Preço mín."
                                value={variationPriceMin}
                                onChange={(e) => setVariationPriceMin(e.target.value)}
                                min="0"
                                step="0.01"
                              />
                              <span className="text-aux text-ink-300">—</span>
                              <input
                                type="number"
                                className="input w-28 py-1.5 text-aux"
                                placeholder="Preço máx."
                                value={variationPriceMax}
                                onChange={(e) => setVariationPriceMax(e.target.value)}
                                min="0"
                                step="0.01"
                              />
                              {filtrosAtivos && (
                                <button
                                  className="btn-ghost py-1.5 text-aux"
                                  onClick={resetVariationFilters}
                                >
                                  Limpar filtros
                                </button>
                              )}
                              {!arquivado && arquivadasNoProduto > 0 && (
                                <label className="flex cursor-pointer items-center gap-1.5 text-aux text-ink-400">
                                  <input
                                    type="checkbox"
                                    checked={mostrarVariacoesArquivadas}
                                    onChange={(e) =>
                                      setMostrarVariacoesArquivadas(e.target.checked)
                                    }
                                  />
                                  mostrar arquivadas ({arquivadasNoProduto})
                                </label>
                              )}
                              <span className="ml-auto text-aux text-ink-300">
                                {variacoes.length} variaç{variacoes.length !== 1 ? 'ões' : 'ão'}
                              </span>
                            </div>

                            {variacoes.length === 0 ? (
                              <p className="py-6 text-center text-body text-ink-300">
                                Nenhuma variação encontrada com os filtros aplicados.
                              </p>
                            ) : (
                              <table className="w-full text-body">
                                <thead>
                                  <tr>
                                    <th className={`${TH} pl-[22px] text-left`}>Variação</th>
                                    <th className={`${TH} text-left`}>Estoque</th>
                                    <th className={`${TH} text-right`}>Custo</th>
                                    <th className={`${TH} text-right`}>Venda</th>
                                    <th className={`${TH} text-right`}>Margem</th>
                                    <th className={`${TH} pr-[22px]`} />
                                  </tr>
                                </thead>
                                <tbody>
                                  {variacoes.map((v) => {
                                    const estoque = estoqueInfo(v)
                                    const variacaoArquivada = estaArquivado(v)
                                    const custoInsumos = v.insumos.reduce(
                                      (s, i) => s + i.costPerUnit * i.quantity,
                                      0
                                    )

                                    return (
                                      <tr
                                        key={v.id}
                                        className={`border-t border-bone-300 transition-colors hover:bg-bone-100 ${
                                          variacaoArquivada ? 'bg-bone-100/60' : ''
                                        }`}
                                      >
                                        <td className="py-3 pl-[22px] pr-3 font-medium text-ink-900">
                                          <span className={variacaoArquivada ? 'text-ink-400' : ''}>
                                            {v.identifier}
                                          </span>
                                          {variacaoArquivada && (
                                            <span className="ml-2">
                                              <Tag texto="ARQUIVADA" tom="neutro" />
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-3">
                                          <div
                                            className="flex items-center gap-2.5"
                                            title={`Mínimo: ${v.minimumStock} un.`}
                                          >
                                            <div className="h-[5px] w-[52px] overflow-hidden rounded-full bg-bone-300">
                                              <div
                                                className="h-full rounded-full"
                                                style={{
                                                  width: `${estoque.pct}%`,
                                                  background: estoque.barra
                                                }}
                                              />
                                            </div>
                                            <span
                                              className={`text-aux font-semibold tabular-nums ${estoque.classeTexto}`}
                                            >
                                              {estoque.valor}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-ink-400">
                                          {formatCurrency(v.costPrice)}
                                          {v.insumos.length > 0 && (
                                            <span
                                              className="block text-micro text-ink-200"
                                              title="Custo calculado pelos insumos"
                                            >
                                              insumos: {formatCurrency(custoInsumos)}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                                          {formatCurrency(v.salePrice)}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-ink-800">
                                          {formatarMargem(v)}
                                        </td>
                                        <td className="py-3 pl-3 pr-[22px]">
                                          <div className="flex items-center justify-end gap-2">
                                            {variacaoArquivada ? (
                                              <button
                                                className="text-aux font-semibold text-wine-500 hover:text-wine-600"
                                                onClick={() => arquivarVariacao(v, false)}
                                              >
                                                Desarquivar
                                              </button>
                                            ) : (
                                              <button
                                                className="text-aux font-semibold text-wine-500 hover:text-wine-600"
                                                onClick={() =>
                                                  setModal({
                                                    type: 'addStock',
                                                    product,
                                                    variation: v
                                                  })
                                                }
                                              >
                                                + Estoque
                                              </button>
                                            )}
                                            <ActionMenu
                                              items={[
                                                {
                                                  label: 'Ver detalhes',
                                                  onClick: () =>
                                                    setModal({
                                                      type: 'detailsVariation',
                                                      product,
                                                      variation: v
                                                    })
                                                },
                                                ...(variacaoArquivada
                                                  ? []
                                                  : [
                                                      {
                                                        label: 'Editar variação',
                                                        onClick: () =>
                                                          setModal({
                                                            type: 'editVariation' as const,
                                                            product,
                                                            variation: v
                                                          })
                                                      },
                                                      {
                                                        label: 'Arquivar variação',
                                                        onClick: () =>
                                                          v.stockQuantity > 0
                                                            ? setModal({
                                                                type: 'archiveVariation' as const,
                                                                product,
                                                                variation: v
                                                              })
                                                            : arquivarVariacao(v, true)
                                                      }
                                                    ]),
                                                {
                                                  label: 'Excluir variação',
                                                  danger: true,
                                                  onClick: () =>
                                                    setModal({
                                                      type: 'deleteVariation',
                                                      product,
                                                      variation: v
                                                    })
                                                }
                                              ]}
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </>
                        )
                      })()
                    ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'newProduct' && (
        <ProductForm
          categories={categories}
          onSave={() => {
            loadData()
            showToast('Produto salvo!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editProduct' && (
        <ProductForm
          categories={categories}
          product={modal.product}
          onSave={() => {
            loadData()
            showToast('Produto atualizado!')
          }}
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
          onSave={() => {
            loadData()
            showToast('Variação salva!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editVariation' && (
        <VariationForm
          productId={modal.product.id}
          productName={modal.product.name}
          variation={modal.variation}
          onSave={() => {
            loadData()
            showToast('Variação atualizada!')
          }}
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
          onSave={() => {
            loadData()
            showToast('Estoque atualizado!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'detailsVariation' && (
        <VariationDetailsModal
          product={modal.product}
          variation={modal.variation}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'archiveProduct' && (
        <ConfirmDialog
          title="Arquivar produto"
          message={`"${modal.product.name}" ainda tem ${estoqueAtivo(modal.product)} unidades em estoque. Arquivar tira ele dos avisos, das listas e do registro de vendas, mas não apaga nada — dá para desarquivar depois.`}
          confirmLabel="Arquivar"
          onConfirm={() => arquivarProduto(modal.product, true)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'archiveVariation' && (
        <ConfirmDialog
          title="Arquivar variação"
          message={`"${modal.variation.identifier}" ainda tem ${modal.variation.stockQuantity} unidades em estoque. Arquivar tira ela dos avisos e do registro de vendas, mas não apaga nada — dá para desarquivar depois.`}
          confirmLabel="Arquivar"
          onConfirm={() => arquivarVariacao(modal.variation, true)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
