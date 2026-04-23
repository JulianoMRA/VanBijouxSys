import { useEffect, useState, useMemo, useRef } from 'react'
import { formatCurrency } from '../utils/format'
import InsumoForm from '../components/insumos/InsumoForm'
import AddInsumoStockForm from '../components/insumos/AddInsumoStockForm'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import type { Insumo } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; insumo: Insumo }
  | { type: 'addStock'; insumo: Insumo }
  | { type: 'delete'; insumo: Insumo }

type StatusFilter = 'todos' | 'low' | 'out'
type SortOption = 'recente' | 'nome-az' | 'nome-za' | 'estoque-asc' | 'estoque-desc' | 'custo-asc' | 'custo-desc'

function stockStatus(insumo: Insumo): 'ok' | 'low' | 'out' {
  if (insumo.stockQuantity <= 0) return 'out'
  if (insumo.minimumStock > 0 && insumo.stockQuantity < insumo.minimumStock) return 'low'
  return 'ok'
}

export default function Stock(): JSX.Element {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sortBy, setSortBy] = useState<SortOption>('recente')
  const [lowStockExpanded, setLowStockExpanded] = useState(true)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  async function loadInsumos(): Promise<void> {
    try {
      const data = await window.api.insumos.getAll()
      setInsumos(data)
    } catch (err) {
      setErrorMessage('Erro ao carregar estoque.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInsumos() }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function unitLabel(unit: Insumo['unit']): string {
    return unit === 'unidade' ? 'un.' : unit
  }

  function buildCsv(rows: Insumo[]): string {
    const headers = ['Nome', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Déficit']
    const lines = rows.map((i) => {
      const ul = unitLabel(i.unit)
      const deficit =
        i.minimumStock > 0 && i.stockQuantity < i.minimumStock
          ? `${(i.minimumStock - i.stockQuantity).toLocaleString('pt-BR')} ${ul}`
          : '—'
      return [`"${i.name}"`, ul, `${i.stockQuantity.toLocaleString('pt-BR')} ${ul}`, i.minimumStock > 0 ? `${i.minimumStock.toLocaleString('pt-BR')} ${ul}` : '—', deficit].join(';')
    })
    return [headers.join(';'), ...lines].join('\r\n')
  }

  async function handleExport(mode: 'todos' | 'baixo' | 'atual'): Promise<void> {
    setExportMenuOpen(false)
    let rows: Insumo[]
    let fileName: string
    if (mode === 'todos') { rows = insumos; fileName = 'insumos_todos.csv' }
    else if (mode === 'baixo') { rows = lowStock; fileName = 'insumos_estoque_baixo.csv' }
    else { rows = displayedInsumos; fileName = 'insumos_filtro_atual.csv' }
    if (rows.length === 0) { showToast('Nenhum insumo para exportar.'); return }
    const result = await window.api.insumos.exportCsv(buildCsv(rows), fileName)
    if (result.success) showToast('Arquivo exportado com sucesso!')
  }

  async function handleDelete(insumo: Insumo): Promise<void> {
    const result = await window.api.insumos.delete(insumo.id)
    if (result.success) {
      await loadInsumos()
    } else {
      setErrorMessage(`"${insumo.name}" não pode ser excluído pois está vinculado a variações de produtos.`)
    }
  }

  const lowStock = insumos.filter((i) => stockStatus(i) !== 'ok')
  const totalStockValue = insumos.reduce((s, i) => s + i.stockQuantity * i.costPerUnit, 0)

  const displayedInsumos = useMemo(() => {
    let result = insumos
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'todos') result = result.filter((i) => stockStatus(i) === statusFilter)
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nome-az': return a.name.localeCompare(b.name, 'pt-BR')
        case 'nome-za': return b.name.localeCompare(a.name, 'pt-BR')
        case 'estoque-asc': return a.stockQuantity - b.stockQuantity
        case 'estoque-desc': return b.stockQuantity - a.stockQuantity
        case 'custo-asc': return a.costPerUnit - b.costPerUnit
        case 'custo-desc': return b.costPerUnit - a.costPerUnit
        case 'recente': return b.id - a.id
        default: return 0
      }
    })
  }, [insumos, search, statusFilter, sortBy])

  const isFiltering = search.trim() !== '' || statusFilter !== 'todos'

  const subtitleText = insumos.length === 0
    ? 'Nenhum insumo cadastrado'
    : isFiltering
      ? `${displayedInsumos.length} de ${insumos.length} insumo${insumos.length !== 1 ? 's' : ''}`
      : `${insumos.length} insumo${insumos.length !== 1 ? 's' : ''} cadastrado${insumos.length !== 1 ? 's' : ''}`

  return (
    <div>
      {/* Page header */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="page-kicker">Matéria-prima</div>
          <h1 className="page-title">Estoque</h1>
          <div className="page-subtitle">{subtitleText}</div>
        </div>
        <div className="flex items-center gap-2">
          {insumos.length > 0 && (
            <div style={{ position: 'relative' }} ref={exportMenuRef}>
              <button className="btn btn-ghost" onClick={() => setExportMenuOpen((v) => !v)}>
                Exportar ↓
              </button>
              {exportMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  width: 210, background: 'var(--surface)',
                  border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-raise)', zIndex: 50, overflow: 'hidden'
                }}>
                  {[
                    { label: 'Todos os insumos', mode: 'todos' as const, count: null, disabled: false },
                    { label: 'Estoque baixo / esgotado', mode: 'baixo' as const, count: lowStock.length, disabled: lowStock.length === 0 },
                    { label: 'Visão atual da tela', mode: 'atual' as const, count: displayedInsumos.length, disabled: false },
                  ].map(({ label, mode, count, disabled }) => (
                    <button
                      key={mode}
                      disabled={disabled}
                      onClick={() => handleExport(mode)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        fontSize: 13, color: disabled ? 'var(--ink-5)' : 'var(--ink-2)',
                        background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-ui)', borderBottom: '1px solid var(--hairline-soft)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      {label}
                      {count !== null && count > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 500 }}>({count})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
            + Novo insumo
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert-bar" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button className="icon-btn" onClick={() => setErrorMessage('')} style={{ fontSize: 18 }}>×</button>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center" style={{ height: 160 }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
        </div>
      ) : insumos.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum insumo cadastrado</h3>
          <p>Cadastre os materiais que você usa para fazer suas peças.</p>
          <button className="btn btn-primary mt-4" onClick={() => setModal({ type: 'new' })}>
            Cadastrar primeiro insumo
          </button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid-3 mb-5">
            <div className="kpi">
              <div className="kpi-label">Valor em estoque</div>
              <div className="kpi-value kpi-value-accent">{formatCurrency(totalStockValue)}</div>
              <div className="kpi-sub">custo total dos insumos</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Insumos em falta / baixo</div>
              <div className={`kpi-value ${lowStock.length > 0 ? 'kpi-value-bad' : 'kpi-value-good'}`}>
                {lowStock.length}
              </div>
              <div className="kpi-sub">precisam de reposição</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total de insumos</div>
              <div className="kpi-value">{insumos.length}</div>
              <div className="kpi-sub">materiais cadastrados</div>
            </div>
          </div>

          {/* Alertas de estoque baixo */}
          {lowStock.length > 0 && (
            <div className="alerts-panel">
              <button className="alerts-head" onClick={() => setLowStockExpanded((v) => !v)}>
                <span className="flex items-center gap-3">
                  <span className="alert-tag warn">
                    ⚠ {lowStock.length} insumo{lowStock.length !== 1 ? 's' : ''} com estoque baixo ou esgotado
                  </span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 500 }}>
                  {lowStockExpanded ? '▲ Recolher' : '▼ Expandir'}
                </span>
              </button>
              {lowStockExpanded && (
                <div className="alerts-body">
                  <div className="chips mt-2">
                    {lowStock.map((i) => (
                      <span key={i.id} className={`chip-alert ${stockStatus(i) === 'out' ? 'bad' : 'warn'}`}>
                        {i.name} <em>— {i.stockQuantity.toLocaleString('pt-BR')} {i.unit === 'unidade' ? 'un.' : i.unit}</em>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Pesquisar insumo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ flex: 1, minWidth: 180 }}
            />
            <div className="segmented">
              {([['todos', 'Todos'], ['low', 'Baixo'], ['out', 'Esgotado']] as [StatusFilter, string][]).map(([value, label]) => (
                <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
              <option value="recente">Último adicionado</option>
              <option value="nome-az">Nome A→Z</option>
              <option value="nome-za">Nome Z→A</option>
              <option value="estoque-asc">Estoque ↑</option>
              <option value="estoque-desc">Estoque ↓</option>
              <option value="custo-asc">Custo/un. ↑</option>
              <option value="custo-desc">Custo/un. ↓</option>
            </select>
          </div>

          {/* Tabela */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Insumo</th>
                  <th className="num">Custo/un.</th>
                  <th className="num">Estoque</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Val. estoque</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayedInsumos.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-4)', fontSize: 13 }}>
                      Nenhum insumo encontrado para esta pesquisa.
                    </td>
                  </tr>
                ) : displayedInsumos.map((insumo) => {
                  const status = stockStatus(insumo)
                  const ul = insumo.unit === 'unidade' ? 'un.' : insumo.unit
                  return (
                    <tr key={insumo.id}>
                      <td style={{ paddingLeft: 20 }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{insumo.name}</span>
                          {status === 'out' && <span className="badge bad">Esgotado</span>}
                          {status === 'low' && <span className="badge warn">Baixo</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                          {insumo.unit === 'unidade' ? 'Por unidade' : `Por ${insumo.unit}`}
                        </div>
                      </td>
                      <td className="num">
                        <span className="price-sub">{formatCurrency(insumo.costPerUnit)}/{ul}</span>
                      </td>
                      <td className="num">
                        <span style={{
                          fontWeight: 500,
                          color: status === 'out' ? 'var(--bad)' : status === 'low' ? 'var(--warn)' : 'var(--ink)'
                        }}>
                          {insumo.stockQuantity.toLocaleString('pt-BR')} {ul}
                        </span>
                      </td>
                      <td className="num" style={{ color: 'var(--ink-4)' }}>
                        {insumo.minimumStock > 0 ? `${insumo.minimumStock.toLocaleString('pt-BR')} ${ul}` : '—'}
                      </td>
                      <td className="num">
                        <span className="price-sub">{formatCurrency(insumo.stockQuantity * insumo.costPerUnit)}</span>
                      </td>
                      <td style={{ paddingRight: 16 }}>
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn btn-xs btn-ghost-good"
                            onClick={() => setModal({ type: 'addStock', insumo })}
                          >
                            + Estoque
                          </button>
                          <button className="btn btn-xs btn-ghost" onClick={() => setModal({ type: 'edit', insumo })}>
                            Editar
                          </button>
                          <button
                            className="btn btn-xs btn-ghost-danger"
                            onClick={() => setModal({ type: 'delete', insumo })}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <InsumoForm onSave={() => { loadInsumos(); showToast('Insumo salvo!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <InsumoForm insumo={modal.insumo} onSave={() => { loadInsumos(); showToast('Insumo atualizado!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'addStock' && (
        <AddInsumoStockForm insumo={modal.insumo} onSave={() => { loadInsumos(); showToast('Estoque atualizado!') }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir insumo"
          message={`Tem certeza que deseja excluir "${modal.insumo.name}"?`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(modal.insumo)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
