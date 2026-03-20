import { useState } from 'react'
import Modal from '../ui/Modal'
import type { Category, Product } from '../../types'

interface ProductFormProps {
  categories: Category[]
  product?: Product
  onSave: () => void
  onClose: () => void
}

export default function ProductForm({
  categories,
  product,
  onSave,
  onClose
}: ProductFormProps): JSX.Element {
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState<number>(product?.categoryId ?? categories[0]?.id ?? 0)
  const [description, setDescription] = useState(product?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!product

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) {
      setError('O nome do produto é obrigatório.')
      return
    }
    setSaving(true)
    try {
      if (isEditing) {
        await window.api.products.update({
          id: product.id,
          name: name.trim(),
          categoryId,
          description: description.trim() || undefined
        })
      } else {
        await window.api.products.create({
          name: name.trim(),
          categoryId,
          description: description.trim() || undefined
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
    <Modal title={isEditing ? 'Editar Produto' : 'Novo Produto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nome do produto</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pulseira de Cristal"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Categoria</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Descrição <span className="text-gray-400 font-normal">(opcional)</span></label>
          <textarea
            className="input resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes adicionais sobre o produto…"
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
