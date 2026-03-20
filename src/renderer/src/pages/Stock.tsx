import { useEffect, useState } from 'react'
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

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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

  async function loadInsumos(): Promise<void> {
    const data = await window.api.insumos.getAll()
    setInsumos(data)
    setLoading(false)
  }

  useEffect(() => {
    loadInsumos()
  }, [])

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-800">Estoque de Insumos</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {insumos.length > 0
              ? `${insumos.length} insumo${insumos.length !== 1 ? 's' : ''} cadastrado${insumos.length !== 1 ? 's' : ''}`
              : 'Nenhum insumo cadastrado'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
          + Novo insumo
        </button>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 mb-4 flex items-start justify-between gap-3">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-600 shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando…</p>
        </div>
      ) : insumos.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Nenhum insumo cadastrado ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Cadastre os materiais que você usa para fazer suas peças.</p>
          <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
            Cadastrar primeiro insumo
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="card py-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Valor em estoque</p>
              <p className="font-display text-xl font-bold text-blush-600">{formatCurrency(totalStockValue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">custo total dos insumos</p>
            </div>
            <div className="card py-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Insumos em falta/baixo</p>
              <p className={`font-display text-xl font-bold ${lowStock.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {lowStock.length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">precisam de reposição</p>
            </div>
            <div className="card py-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total de insumos</p>
              <p className="font-display text-xl font-bold text-gray-700">{insumos.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">materiais cadastrados</p>
            </div>
          </div>

          {/* Alertas */}
          {lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                ⚠ {lowStock.length} insumo{lowStock.length !== 1 ? 's' : ''} com estoque baixo ou esgotado
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStock.map((i) => (
                  <span
                    key={i.id}
                    className={`text-xs px-2.5 py-1 rounded-full ${
                      stockStatus(i) === 'out'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {i.name} — {i.stockQuantity} {i.unit === 'unidade' ? 'un.' : i.unit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="bg-white rounded-2xl border border-cream-200 shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Custo/un.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estoque</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Mínimo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Val. estoque</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {insumos.map((insumo) => {
                  const status = stockStatus(insumo)
                  const unitLabel = insumo.unit === 'unidade' ? 'un.' : insumo.unit
                  return (
                    <tr key={insumo.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{insumo.name}</span>
                          {status === 'out' && (
                            <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Esgotado</span>
                          )}
                          {status === 'low' && (
                            <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Baixo</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{insumo.unit === 'unidade' ? 'Por unidade' : `Por ${insumo.unit}`}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(insumo.costPerUnit)}/{unitLabel}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        status === 'out' ? 'text-rose-600' : status === 'low' ? 'text-amber-600' : 'text-gray-700'
                      }`}>
                        {insumo.stockQuantity.toLocaleString('pt-BR')} {unitLabel}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {insumo.minimumStock > 0 ? `${insumo.minimumStock.toLocaleString('pt-BR')} ${unitLabel}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(insumo.stockQuantity * insumo.costPerUnit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap"
                            onClick={() => setModal({ type: 'addStock', insumo })}
                          >
                            + Estoque
                          </button>
                          <button
                            className="text-xs text-blush-600 hover:text-blush-800 px-2 py-1 rounded-lg hover:bg-blush-50 transition-colors"
                            onClick={() => setModal({ type: 'edit', insumo })}
                          >
                            Editar
                          </button>
                          <button
                            className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
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
