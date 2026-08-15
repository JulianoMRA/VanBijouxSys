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
    <Modal title={`${product.name} — ${variation.identifier}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <section>
          <h3 className="label mb-2">Composição</h3>
          {variation.insumos.length === 0 ? (
            <p className="text-body text-ink-300">Nenhum insumo vinculado a esta variação.</p>
          ) : (
            <div className="overflow-hidden rounded-control border border-bone-400">
              <table className="w-full text-body">
                <thead>
                  <tr className="bg-bone-100">
                    <th className="px-4 py-2 text-left text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
                      Insumo
                    </th>
                    <th className="px-4 py-2 text-right text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
                      Qtd.
                    </th>
                    <th className="px-4 py-2 text-right text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
                      Custo/un.
                    </th>
                    <th className="px-4 py-2 text-right text-meta font-bold uppercase tracking-[0.1em] text-ink-200">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variation.insumos.map((i) => (
                    <tr
                      key={i.id}
                      className="border-t border-bone-300 transition-colors hover:bg-bone-100"
                    >
                      <td className="px-4 py-2.5 font-medium text-ink-900">{i.insumoName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-400">
                        {i.quantity} {i.unit === 'unidade' ? 'un.' : i.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-400">
                        {fmt(i.costPerUnit)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-800">
                        {fmt(i.costPerUnit * i.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-bone-400 bg-bone-100">
                    <td
                      colSpan={3}
                      className="px-4 py-2.5 text-meta font-bold uppercase tracking-[0.1em] text-wine-500"
                    >
                      Total materiais
                    </td>
                    <td className="px-4 py-2.5 text-right text-body font-semibold tabular-nums text-wine-500">
                      {fmt(insumosCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="label mb-2">Precificação</h3>
          <div className="space-y-2 rounded-control bg-wine-50 p-4 text-body">
            <div className="flex justify-between text-ink-600">
              <span>Materiais {hasMaterials ? '(insumos)' : '(custo manual)'}</span>
              <span className="tabular-nums">{fmt(materialsForCalc)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>Materiais × 3</span>
              <span className="tabular-nums">{fmt(materialsForCalc * 3)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>+ Mão de obra</span>
              <span className="tabular-nums">
                {labor > 0 ? (
                  fmt(labor)
                ) : (
                  <span className="italic text-ink-300">Não informada</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>× 1,10 (margem)</span>
              <span className="tabular-nums">{fmt((materialsForCalc * 3 + labor) * 1.1)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>+ Embalagem</span>
              <span className="tabular-nums">R$ 1,00</span>
            </div>
            <div className="flex justify-between border-t border-wine-100 pt-2 text-[15px] font-semibold text-wine-500">
              <span>Preço sugerido</span>
              <span className="tabular-nums">{fmt(suggestedPrice)}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="label mb-2">Resumo financeiro</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-control bg-bone-100 p-3 text-center">
              <p className="label mb-1">Custo</p>
              <p className="text-lg font-semibold tabular-nums text-ink-800">
                {fmt(variation.costPrice)}
              </p>
            </div>
            <div className="rounded-control bg-bone-100 p-3 text-center">
              <p className="label mb-1">Venda</p>
              <p className="text-lg font-semibold tabular-nums text-ink-900">
                {fmt(variation.salePrice)}
              </p>
            </div>
            <div
              className={`rounded-control p-3 text-center ${profit >= 0 ? 'bg-sage-100' : 'bg-clay-100'}`}
            >
              <p className="label mb-1">Lucro/un.</p>
              <p
                className={`text-lg font-semibold tabular-nums ${profit >= 0 ? 'text-sage-500' : 'text-clay-500'}`}
              >
                {fmt(profit)}
              </p>
              <p className={`mt-0.5 text-micro ${profit >= 0 ? 'text-sage-600' : 'text-clay-500'}`}>
                {margin.toFixed(1)}% margem
              </p>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
