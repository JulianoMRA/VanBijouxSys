import Modal from '../ui/Modal'
import type { Product, ProductVariation } from '../../types'

interface VariationDetailsModalProps {
  product: Product
  variation: ProductVariation
  onClose: () => void
}

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function VariationDetailsModal({
  product,
  variation,
  onClose
}: VariationDetailsModalProps): JSX.Element {
  const insumosCost = variation.insumos.reduce((s, i) => s + i.costPerUnit * i.quantity, 0)
  const hasMaterials = variation.insumos.length > 0
  const materialsForCalc = hasMaterials ? insumosCost : variation.costPrice
  const labor = variation.laborCost
  const suggestedPrice = Math.ceil((materialsForCalc * 3 + labor) * 1.1 + 1)
  const profit = variation.salePrice - variation.costPrice
  const margin = variation.salePrice > 0 ? (profit / variation.salePrice) * 100 : 0

  return (
    <Modal
      title={`${product.name} — ${variation.identifier}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-5">

        {/* Composição */}
        <section>
          <h3 className="label mb-2">Composição</h3>
          {variation.insumos.length === 0 ? (
            <p className="text-sm text-dim">Nenhum insumo vinculado a esta variação.</p>
          ) : (
            <div className="border border-[var(--hairline)] rounded-[var(--radius-md)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide bg-[var(--surface-alt)]" style={{ color: 'var(--ink-4)' }}>
                    <th className="text-left px-4 py-2 font-medium">Insumo</th>
                    <th className="text-right px-4 py-2 font-medium">Qtd.</th>
                    <th className="text-right px-4 py-2 font-medium">Custo/un.</th>
                    <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline-soft)]">
                  {variation.insumos.map((i) => (
                    <tr key={i.id} className="hover:bg-[var(--surface-alt)] transition-colors">
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--ink-2)' }}>{i.insumoName}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: 'var(--ink-3)' }}>
                        {i.quantity} {i.unit === 'unidade' ? 'un.' : i.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: 'var(--ink-3)' }}>
                        {i.costPerUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: 'var(--ink-2)' }}>
                        {fmt(i.costPerUnit * i.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-alt)] border-t border-[var(--hairline)]">
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-[var(--accent-2)] uppercase tracking-wide">
                      Total materiais
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-[var(--accent-2)]">
                      {fmt(insumosCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Precificação */}
        <section>
          <h3 className="label mb-2">Precificação</h3>
          <div className="bg-[var(--accent-wash)] rounded-[var(--radius-md)] p-4 space-y-2 text-sm">
            <div className="flex justify-between" style={{ color: 'var(--ink-3)' }}>
              <span>Materiais {hasMaterials ? '(insumos)' : '(custo manual)'}</span>
              <span>{fmt(materialsForCalc)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--ink-3)' }}>
              <span>Materiais × 3</span>
              <span>{fmt(materialsForCalc * 3)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--ink-3)' }}>
              <span>+ Mão de obra</span>
              <span>
                {labor > 0
                  ? fmt(labor)
                  : <span className="italic text-dim">Não informada</span>
                }
              </span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--ink-3)' }}>
              <span>× 1,10 (margem)</span>
              <span>{fmt((materialsForCalc * 3 + labor) * 1.1)}</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--ink-3)' }}>
              <span>+ Embalagem</span>
              <span>R$ 1,00</span>
            </div>
            <div className="flex justify-between font-semibold text-[var(--accent-2)] pt-2 border-t border-[var(--accent-soft)] text-base">
              <span>Preço sugerido</span>
              <span>{fmt(suggestedPrice)}</span>
            </div>
          </div>
        </section>

        {/* Resumo financeiro */}
        <section>
          <h3 className="label mb-2">Resumo financeiro</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--surface-alt)] rounded-[var(--radius-md)] p-3 text-center">
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ink-4)' }}>Custo</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--ink-2)' }}>{fmt(variation.costPrice)}</p>
            </div>
            <div className="bg-[var(--surface-alt)] rounded-[var(--radius-md)] p-3 text-center">
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ink-4)' }}>Venda</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{fmt(variation.salePrice)}</p>
            </div>
            <div
              className="rounded-[var(--radius-md)] p-3 text-center"
              style={{ background: profit >= 0 ? 'var(--good-wash)' : 'var(--bad-wash)' }}
            >
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ink-4)' }}>Lucro/un.</p>
              <p
                className="text-lg font-semibold"
                style={{ color: profit >= 0 ? 'var(--good)' : 'var(--bad)' }}
              >
                {fmt(profit)}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: profit >= 0 ? 'var(--good)' : 'var(--bad)', opacity: 0.8 }}
              >
                {margin.toFixed(1)}% margem
              </p>
            </div>
          </div>
        </section>

      </div>
    </Modal>
  )
}
