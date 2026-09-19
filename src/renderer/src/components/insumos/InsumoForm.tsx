import { useState } from 'react'
import Modal from '../ui/Modal'
import CampoNumerico from '../ui/CampoNumerico'
import { formatarNumeroParaCampo, interpretarNumero } from '../../utils/numero'
import type { Insumo, InsumoUnit } from '../../types'

interface InsumoFormProps {
  insumo?: Insumo
  initialName?: string
  onSave: (insumo: Insumo) => void
  onClose: () => void
}

const UNITS: { value: InsumoUnit; label: string }[] = [
  { value: 'unidade', label: 'Unidade (un.)' },
  { value: 'cm', label: 'Centímetro (cm)' },
  { value: 'g', label: 'Grama (g)' }
]

export default function InsumoForm({
  insumo,
  initialName = '',
  onSave,
  onClose
}: InsumoFormProps): JSX.Element {
  const [name, setName] = useState(insumo?.name ?? initialName)
  const [unit, setUnit] = useState<InsumoUnit>(insumo?.unit ?? 'unidade')
  const [costPerUnit, setCostPerUnit] = useState(
    insumo ? formatarNumeroParaCampo(insumo.costPerUnit) : ''
  )
  const [stockQuantity, setStockQuantity] = useState(
    insumo ? formatarNumeroParaCampo(insumo.stockQuantity) : '0'
  )
  const [minimumStock, setMinimumStock] = useState(
    insumo ? formatarNumeroParaCampo(insumo.minimumStock) : '0'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!insumo

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) {
      setError('O nome é obrigatório.')
      return
    }
    const cost = interpretarNumero(costPerUnit)
    const stock = interpretarNumero(stockQuantity)
    const minStock = interpretarNumero(minimumStock)
    if (cost === null || cost < 0) {
      setError('Custo por unidade inválido.')
      return
    }
    // Saldo negativo salvo continua valendo: só não se digita um negativo novo.
    if (stock === null || (stock < 0 && stock !== insumo?.stockQuantity)) {
      setError('Quantidade em estoque inválida.')
      return
    }
    if (minStock === null || minStock < 0) {
      setError('Estoque mínimo inválido.')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await window.api.insumos.update({
          id: insumo.id,
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock
        })
        onSave({
          ...insumo,
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock
        })
      } else {
        const result = await window.api.insumos.create({
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock
        })
        onSave({
          id: result.id,
          name: name.trim(),
          unit,
          costPerUnit: cost,
          stockQuantity: stock,
          minimumStock: minStock,
          createdAt: new Date().toISOString(),
          archivedAt: null,
          usadoPorVariacoesAtivas: 0
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const unitLabel = UNITS.find((u) => u.value === unit)?.label ?? ''
  const unidadeTravada = isEditing && insumo.usadoPorVariacoesAtivas > 0
  const unidadeMudou = isEditing && unit !== insumo.unit

  return (
    <Modal title={isEditing ? 'Editar Insumo' : 'Novo Insumo'} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="insumo-nome">
            Nome do insumo
          </label>
          <input
            id="insumo-nome"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Fio de nylon, Miçanga dourada, Argola…"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Unidade de medida</label>
          <div className="flex gap-2">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                disabled={unidadeTravada && unit !== u.value}
                onClick={() => setUnit(u.value)}
                className={`flex-1 rounded-control py-2 text-body font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  unit === u.value
                    ? 'bg-wine-500 text-bone-50'
                    : 'bg-bone-200 text-ink-600 hover:bg-bone-300'
                }`}
              >
                {u.value === 'unidade' ? 'Un.' : u.value}
              </button>
            ))}
          </div>
          {unidadeTravada && (
            <p className="text-micro text-ink-300 mt-1">
              Usado em receitas: trocar a unidade mudaria o sentido das quantidades delas.
            </p>
          )}
          {unidadeMudou && insumo.stockQuantity !== 0 && (
            <p className="text-micro text-honey-500 mt-1">
              Nada é convertido. Informe abaixo o estoque atual contado em {unit}.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="insumo-custo">
            Custo por {unitLabel}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-body pointer-events-none">
              R$
            </span>
            <CampoNumerico
              id="insumo-custo"
              className="input pl-8"
              placeholder="0,0000"
              value={costPerUnit}
              onChange={setCostPerUnit}
            />
          </div>
          <p className="text-micro text-ink-300 mt-1">
            Ex: se o fio custa R$20,00 por 100cm, o custo por cm é R$0,20.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="insumo-estoque">
              Estoque atual ({unit === 'unidade' ? 'un.' : unit})
            </label>
            <CampoNumerico
              id="insumo-estoque"
              className="input"
              value={stockQuantity}
              onChange={setStockQuantity}
            />
          </div>
          <div>
            <label className="label" htmlFor="insumo-minimo">
              Estoque mínimo ({unit === 'unidade' ? 'un.' : unit})
            </label>
            <CampoNumerico
              id="insumo-minimo"
              className="input"
              value={minimumStock}
              onChange={setMinimumStock}
            />
          </div>
        </div>

        {error && <p className="text-body text-clay-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar insumo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
