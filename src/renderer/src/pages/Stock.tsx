import { useEffect, useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '../utils/format'
import { avisarInsumosAlterados } from '../utils/eventos'
import { estaArquivado, insumosAtivos, mensagemDeArquivamento } from '../utils/arquivamento'
import InsumoForm from '../components/insumos/InsumoForm'
import AddInsumoStockForm from '../components/insumos/AddInsumoStockForm'
import ActionMenu from '../components/ui/ActionMenu'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import type { Insumo } from '../types'

type Modal =
  | { type: 'new' }
  | { type: 'edit'; insumo: Insumo }
  | { type: 'addStock'; insumo: Insumo }
  | { type: 'delete'; insumo: Insumo }
  | { type: 'archive'; insumo: Insumo }

type StatusFilter = 'todos' | 'low' | 'out'
type SortOption =
  | 'reposicao'
  | 'recente'
  | 'nome-az'
  | 'nome-za'
  | 'estoque-asc'
  | 'estoque-desc'
  | 'custo-asc'
  | 'custo-desc'

type Status = 'ok' | 'low' | 'out'

function stockStatus(insumo: Insumo): Status {
  if (insumo.stockQuantity <= 0) return 'out'
  if (insumo.minimumStock > 0 && insumo.stockQuantity < insumo.minimumStock) return 'low'
  return 'ok'
}

const CORES: Record<Status, { marcador: string; texto: string }> = {
  out: { marcador: '#b3413f', texto: 'text-clay-500' },
  low: { marcador: '#c98b2e', texto: 'text-honey-500' },
  ok: { marcador: '#5d8f76', texto: 'text-ink-900' }
}

function unitLabel(unit: Insumo['unit']): string {
  return unit === 'unidade' ? 'un.' : unit
}

function nomeUnidade(unit: Insumo['unit']): string {
  return unit === 'unidade' ? 'Por unidade' : `Por ${unit}`
}

/**
 * Insumos vendidos a granel têm custo unitário abaixo de um centavo (fio a
 * R$ 0,012/cm). Arredondar para duas casas mostraria "R$ 0,01" e faria a conta
 * parecer errada ao lado do valor total.
 */
function formatarCustoUnitario(valor: number): string {
  const casas = valor > 0 && valor < 0.1 ? 4 : 2
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })
}

/** Quanto falta em dinheiro para todos os insumos voltarem ao mínimo. */
function custoDeReposicao(insumos: Insumo[]): number {
  return insumos.reduce((total, i) => {
    const falta = Math.max(i.minimumStock - i.stockQuantity, 0)
    return total + falta * i.costPerUnit
  }, 0)
}

const TH = 'px-3 py-2.5 text-meta font-bold uppercase tracking-[0.1em] text-ink-200'

export default function Stock(): JSX.Element {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sortBy, setSortBy] = useState<SortOption>('reposicao')
  const [mostrandoArquivados, setMostrandoArquivados] = useState(false)

  async function loadInsumos(): Promise<void> {
    try {
      const data = await window.api.insumos.getAll()
      setInsumos(data)
      avisarInsumosAlterados()
    } catch (err) {
      setErrorMessage('Erro ao carregar estoque.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInsumos()
  }, [])

  function buildCsv(rows: Insumo[]): string {
    const headers = ['Nome', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Déficit']
    const lines = rows.map((i) => {
      const ul = unitLabel(i.unit)
      const deficit =
        i.minimumStock > 0 && i.stockQuantity < i.minimumStock
          ? `${(i.minimumStock - i.stockQuantity).toLocaleString('pt-BR')} ${ul}`
          : '—'
      return [
        `"${i.name}"`,
        ul,
        `${i.stockQuantity.toLocaleString('pt-BR')} ${ul}`,
        i.minimumStock > 0 ? `${i.minimumStock.toLocaleString('pt-BR')} ${ul}` : '—',
        deficit
      ].join(';')
    })
    return [headers.join(';'), ...lines].join('\r\n')
  }

  async function handleExport(mode: 'todos' | 'baixo' | 'atual'): Promise<void> {
    let rows: Insumo[]
    let fileName: string
    if (mode === 'todos') {
      // "Todos" é a lista de trabalho: o que foi arquivado não entra na compra.
      rows = ativos
      fileName = 'insumos_todos.csv'
    } else if (mode === 'baixo') {
      rows = precisamReposicao
      fileName = 'insumos_estoque_baixo.csv'
    } else {
      rows = displayedInsumos
      fileName = 'insumos_filtro_atual.csv'
    }
    if (rows.length === 0) {
      showToast('Nenhum insumo para exportar.')
      return
    }
    try {
      const result = await window.api.insumos.exportCsv(buildCsv(rows), fileName)
      if (result.salvo) showToast('Arquivo exportado com sucesso!')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao exportar o arquivo.')
    }
  }

  async function arquivarInsumo(insumo: Insumo, arquivar: boolean): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.insumos.setArchived(insumo.id, arquivar)
      await loadInsumos()
      showToast(arquivar ? 'Insumo arquivado.' : 'Insumo desarquivado.')
    } catch {
      setErrorMessage(`Não foi possível ${arquivar ? 'arquivar' : 'desarquivar'} "${insumo.name}".`)
    }
  }

  async function handleDelete(insumo: Insumo): Promise<void> {
    try {
      await window.api.insumos.delete(insumo.id)
      await loadInsumos()
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `"${insumo.name}" não pode ser excluído pois está vinculado a variações de produtos.`
      )
    }
  }

  const ativos = insumosAtivos(insumos)
  const arquivados = insumos.filter(estaArquivado)
  const precisamReposicao = ativos.filter((i) => stockStatus(i) !== 'ok')
  const esgotados = ativos.filter((i) => stockStatus(i) === 'out')
  const baixos = ativos.filter((i) => stockStatus(i) === 'low')
  const totalStockValue = ativos.reduce((s, i) => s + i.stockQuantity * i.costPerUnit, 0)
  const valorArquivado = arquivados.reduce((s, i) => s + i.stockQuantity * i.costPerUnit, 0)
  const valorReposicao = custoDeReposicao(precisamReposicao)

  const displayedInsumos = useMemo(() => {
    // A aba de arquivados é excludente: ou o que está em uso, ou o que saiu.
    let result = insumos.filter((i) => estaArquivado(i) === mostrandoArquivados)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }

    if (statusFilter !== 'todos') {
      result = result.filter((i) => stockStatus(i) === statusFilter)
    }

    const urgencia: Record<Status, number> = { out: 0, low: 1, ok: 2 }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'reposicao': {
          const diff = urgencia[stockStatus(a)] - urgencia[stockStatus(b)]
          if (diff !== 0) return diff
          // Dentro do mesmo status, quem está proporcionalmente mais longe do
          // mínimo aparece antes.
          const folga = (i: Insumo): number =>
            i.minimumStock > 0 ? i.stockQuantity / i.minimumStock : Number.POSITIVE_INFINITY
          return folga(a) - folga(b)
        }
        case 'nome-az':
          return a.name.localeCompare(b.name, 'pt-BR')
        case 'nome-za':
          return b.name.localeCompare(a.name, 'pt-BR')
        case 'estoque-asc':
          return a.stockQuantity - b.stockQuantity
        case 'estoque-desc':
          return b.stockQuantity - a.stockQuantity
        case 'custo-asc':
          return a.costPerUnit - b.costPerUnit
        case 'custo-desc':
          return b.costPerUnit - a.costPerUnit
        case 'recente':
          return b.id - a.id
        default:
          return 0
      }
    })
  }, [insumos, search, statusFilter, sortBy, mostrandoArquivados])

  const isFiltering = search.trim() !== '' || statusFilter !== 'todos'

  const chips: { valor: StatusFilter; rotulo: string; contagem: number }[] = [
    { valor: 'todos', rotulo: 'Todos', contagem: ativos.length },
    { valor: 'low', rotulo: 'Baixo', contagem: baixos.length },
    { valor: 'out', rotulo: 'Esgotado', contagem: esgotados.length }
  ]

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="mb-4 flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">
              {insumos.length === 0
                ? 'Nenhum insumo cadastrado'
                : mostrandoArquivados
                  ? `${displayedInsumos.length} de ${arquivados.length} arquivados · ${formatCurrency(valorArquivado)} parados`
                  : isFiltering
                    ? `${displayedInsumos.length} de ${ativos.length} insumos`
                    : `${ativos.length} insumo${ativos.length !== 1 ? 's' : ''} · ${formatCurrency(totalStockValue)} em estoque`}
            </p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              Insumos
            </h2>
          </div>
          <div className="flex gap-2">
            {insumos.length > 0 && (
              <ActionMenu
                trigger={
                  <>
                    Exportar
                    <ChevronDown size={14} />
                  </>
                }
                items={[
                  { label: 'Todos os insumos', onClick: () => handleExport('todos') },
                  {
                    label: 'Estoque baixo / esgotado',
                    hint:
                      precisamReposicao.length > 0 ? `(${precisamReposicao.length})` : undefined,
                    disabled: precisamReposicao.length === 0,
                    onClick: () => handleExport('baixo')
                  },
                  {
                    label: 'Visão atual da tela',
                    hint: `(${displayedInsumos.length})`,
                    onClick: () => handleExport('atual')
                  }
                ]}
              />
            )}
            <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
              + Novo insumo
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-[280px]"
            placeholder="Pesquisar insumo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mx-1 h-[22px] w-px bg-bone-500" />
          {chips.map((chip) => {
            const ativo = statusFilter === chip.valor && !mostrandoArquivados
            return (
              <button
                key={chip.valor}
                onClick={() => {
                  setStatusFilter(chip.valor)
                  setMostrandoArquivados(false)
                }}
                className={`rounded-lg px-3 py-1.5 text-body transition-colors ${
                  ativo
                    ? 'bg-ink-900 font-semibold text-bone-50'
                    : 'font-medium text-ink-600 hover:bg-bone-300'
                }`}
              >
                {chip.rotulo}{' '}
                <span className={ativo ? 'opacity-55' : 'text-ink-200'}>{chip.contagem}</span>
              </button>
            )
          })}
          {arquivados.length > 0 && (
            <>
              <div className="mx-1 h-[22px] w-px bg-bone-500" />
              <button
                onClick={() => {
                  setMostrandoArquivados((v) => !v)
                  setStatusFilter('todos')
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
              <option value="reposicao">reposição primeiro</option>
              <option value="recente">recentes</option>
              <option value="nome-az">nome A→Z</option>
              <option value="nome-za">nome Z→A</option>
              <option value="estoque-asc">menor estoque</option>
              <option value="estoque-desc">maior estoque</option>
              <option value="custo-asc">menor custo</option>
              <option value="custo-desc">maior custo</option>
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
        ) : insumos.length === 0 ? (
          <div className="card flex h-48 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhum insumo cadastrado ainda.</p>
            <p className="mt-1 text-micro text-ink-300">
              Cadastre os materiais que você usa para fazer suas peças.
            </p>
            <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
              Cadastrar primeiro insumo
            </button>
          </div>
        ) : (
          <>
            {!mostrandoArquivados && precisamReposicao.length > 0 && (
              <div className="mb-4 flex items-center gap-3.5 rounded-[11px] border border-honey-200 bg-honey-100 px-4 py-3">
                <span className="shrink-0 rounded-md bg-honey-200 px-2.5 py-[3px] text-micro font-bold text-honey-500">
                  REPOR
                </span>
                <p className="text-body text-honey-600">
                  {precisamReposicao.length} insumo{precisamReposicao.length !== 1 ? 's' : ''}{' '}
                  abaixo do mínimo — reposição estimada em{' '}
                  <strong className="font-semibold">{formatCurrency(valorReposicao)}</strong>.
                </p>
                <button
                  onClick={() => handleExport('baixo')}
                  className="ml-auto shrink-0 whitespace-nowrap text-body font-semibold text-wine-500 hover:text-wine-600"
                >
                  Exportar lista →
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-card border border-bone-400 bg-bone-50">
              <table className="w-full text-body">
                <thead>
                  <tr>
                    <th className={`${TH} pl-[22px] text-left`}>Insumo</th>
                    <th className={`${TH} text-left`}>Estoque</th>
                    <th className={`${TH} text-right`}>Mínimo</th>
                    <th className={`${TH} text-right`}>Custo/un.</th>
                    <th className={`${TH} text-right`}>Val. estoque</th>
                    <th className={`${TH} pr-[22px]`} />
                  </tr>
                </thead>
                <tbody>
                  {displayedInsumos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-t border-bone-300 px-[22px] py-10 text-center text-body text-ink-300"
                      >
                        Nenhum insumo encontrado para esta pesquisa.
                      </td>
                    </tr>
                  ) : (
                    displayedInsumos.map((insumo) => {
                      const status = stockStatus(insumo)
                      const cores = CORES[status]
                      const ul = unitLabel(insumo.unit)
                      const pct =
                        insumo.minimumStock > 0
                          ? Math.min((insumo.stockQuantity / insumo.minimumStock) * 100, 100)
                          : insumo.stockQuantity > 0
                            ? 100
                            : 0

                      const arquivado = estaArquivado(insumo)

                      return (
                        <tr
                          key={insumo.id}
                          className="border-t border-bone-300 transition-colors hover:bg-bone-100"
                        >
                          <td className="py-3 pl-[22px] pr-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="h-[26px] w-1.5 shrink-0 rounded-full"
                                style={{ background: arquivado ? '#d5c8c2' : cores.marcador }}
                              />
                              <div>
                                <p
                                  className={`font-medium ${arquivado ? 'text-ink-400' : 'text-ink-900'}`}
                                >
                                  {insumo.name}
                                </p>
                                <p className="mt-px text-micro text-ink-300">
                                  {nomeUnidade(insumo.unit)}
                                  {arquivado && insumo.usadoPorVariacoesAtivas > 0 && (
                                    <span className="text-honey-500">
                                      {' '}
                                      · em {insumo.usadoPorVariacoesAtivas} variaç
                                      {insumo.usadoPorVariacoesAtivas !== 1 ? 'ões' : 'ão'} ativa
                                      {insumo.usadoPorVariacoesAtivas !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div
                              className="flex items-center gap-2.5"
                              title={
                                insumo.minimumStock > 0
                                  ? `Mínimo: ${insumo.minimumStock.toLocaleString('pt-BR')} ${ul}`
                                  : 'Sem mínimo definido'
                              }
                            >
                              <div className="h-[5px] w-14 overflow-hidden rounded-full bg-bone-300">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: cores.marcador }}
                                />
                              </div>
                              <span className={`font-semibold tabular-nums ${cores.texto}`}>
                                {insumo.stockQuantity.toLocaleString('pt-BR')} {ul}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-ink-300">
                            {insumo.minimumStock > 0
                              ? `${insumo.minimumStock.toLocaleString('pt-BR')} ${ul}`
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-ink-600">
                            {formatarCustoUnitario(insumo.costPerUnit)}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                            {formatCurrency(insumo.stockQuantity * insumo.costPerUnit)}
                          </td>
                          <td className="py-3 pl-3 pr-[22px]">
                            <div className="flex items-center justify-end gap-2">
                              {arquivado ? (
                                <button
                                  className="whitespace-nowrap text-aux font-semibold text-wine-500 hover:text-wine-600"
                                  onClick={() => arquivarInsumo(insumo, false)}
                                >
                                  Desarquivar
                                </button>
                              ) : (
                                <button
                                  className="whitespace-nowrap text-aux font-semibold text-wine-500 hover:text-wine-600"
                                  onClick={() => setModal({ type: 'addStock', insumo })}
                                >
                                  + Estoque
                                </button>
                              )}
                              <ActionMenu
                                items={[
                                  ...(arquivado
                                    ? []
                                    : [
                                        {
                                          label: 'Editar insumo',
                                          onClick: () => setModal({ type: 'edit' as const, insumo })
                                        },
                                        {
                                          label: 'Arquivar insumo',
                                          onClick: () =>
                                            insumo.usadoPorVariacoesAtivas > 0 ||
                                            insumo.stockQuantity > 0
                                              ? setModal({ type: 'archive' as const, insumo })
                                              : arquivarInsumo(insumo, true)
                                        }
                                      ]),
                                  {
                                    label: 'Excluir insumo',
                                    danger: true,
                                    onClick: () => setModal({ type: 'delete', insumo })
                                  }
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <InsumoForm
          onSave={() => {
            loadInsumos()
            showToast('Insumo salvo!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <InsumoForm
          insumo={modal.insumo}
          onSave={() => {
            loadInsumos()
            showToast('Insumo atualizado!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'addStock' && (
        <AddInsumoStockForm
          insumo={modal.insumo}
          onSave={() => {
            loadInsumos()
            showToast('Estoque atualizado!')
          }}
          onClose={() => setModal(null)}
        />
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
      {modal?.type === 'archive' && (
        <ConfirmDialog
          title="Arquivar insumo"
          message={mensagemDeArquivamento(modal.insumo, unitLabel(modal.insumo.unit))}
          confirmLabel="Arquivar"
          onConfirm={() => arquivarInsumo(modal.insumo, true)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
