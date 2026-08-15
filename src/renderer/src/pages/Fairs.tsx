import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import FairForm from '../components/fairs/FairForm'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ActionMenu from '../components/ui/ActionMenu'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate, formatDateRange } from '../utils/format'
import type { Fair, Sale } from '../types'

type Modal = { type: 'new' } | { type: 'edit'; fair: Fair } | { type: 'delete'; fair: Fair }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isFuture(fair: Fair): boolean {
  const lastDay = fair.endDate ?? fair.date
  return lastDay >= hojeISO()
}

function diasAte(dateStr: string): number {
  const umDia = 24 * 60 * 60 * 1000
  return Math.round((new Date(dateStr).getTime() - new Date(hojeISO()).getTime()) / umDia)
}

function prazoLabel(fair: Fair): string {
  const dias = diasAte(fair.date)
  if (dias < 0) return 'acontecendo agora'
  if (dias === 0) return 'é hoje'
  if (dias === 1) return 'é amanhã'
  return `em ${dias} dias`
}

function DataBadge({ data, futura }: { data: string; futura: boolean }): JSX.Element {
  const mes = MESES[parseInt(data.slice(5, 7), 10) - 1]
  return (
    <div
      className={`w-[54px] shrink-0 rounded-[10px] py-[7px] text-center ${
        futura ? 'bg-wine-50' : 'bg-bone-300'
      }`}
    >
      <p
        className={`text-[10.5px] font-bold uppercase tracking-[0.08em] ${
          futura ? 'text-wine-400' : 'text-ink-300'
        }`}
      >
        {mes}
      </p>
      <p
        className={`font-display text-[21px] font-semibold leading-none ${
          futura ? 'text-wine-500' : 'text-ink-800'
        }`}
      >
        {data.slice(8, 10)}
      </p>
    </div>
  )
}

function Metrica({
  rotulo,
  valor,
  cor = 'text-ink-900'
}: {
  rotulo: string
  valor: string
  cor?: string
}): JSX.Element {
  return (
    <div>
      <p className="label mb-0">{rotulo}</p>
      <p className={`text-sm font-semibold tabular-nums ${cor}`}>{valor}</p>
    </div>
  )
}

const TH = 'py-2 text-meta font-bold uppercase tracking-[0.1em] text-ink-200'

export default function Fairs(): JSX.Element {
  const [fairs, setFairs] = useState<Fair[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function loadFairs(): Promise<void> {
    try {
      const [data, allSales] = await Promise.all([
        window.api.fairs.getAll(),
        window.api.sales.getAll()
      ])
      setFairs(data.slice().reverse())
      setSales(allSales)
    } catch (err) {
      setErrorMessage('Erro ao carregar feiras.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFairs()
  }, [])

  async function handleDelete(fair: Fair): Promise<void> {
    setErrorMessage('')
    try {
      await window.api.fairs.delete(fair.id)
      await loadFairs()
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `"${fair.name}": ${err.message}`
          : `"${fair.name}" não pode ser excluída pois possui vendas registradas.`
      )
    }
  }

  // As próximas vêm da mais perto para a mais distante; as realizadas, da mais
  // recente para a mais antiga.
  const upcoming = fairs.filter(isFuture).sort((a, b) => a.date.localeCompare(b.date))
  const past = fairs.filter((f) => !isFuture(f)).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-10 border-b border-bone-400 bg-bone-200 px-8 pb-3.5 pt-[26px]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="label mb-1">
              {fairs.length > 0
                ? `${upcoming.length} próxima${upcoming.length !== 1 ? 's' : ''} · ${past.length} realizada${past.length !== 1 ? 's' : ''}`
                : 'Nenhuma feira cadastrada'}
            </p>
            <h2 className="font-display text-[30px] font-semibold leading-none text-ink-900">
              Feiras
            </h2>
          </div>
          <button className="btn-primary" onClick={() => setModal({ type: 'new' })}>
            + Nova feira
          </button>
        </div>
      </div>

      <div className="px-8 pt-[22px]">
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
        ) : fairs.length === 0 ? (
          <div className="card flex h-48 flex-col items-center justify-center text-center">
            <p className="text-body text-ink-600">Nenhuma feira cadastrada ainda.</p>
            <button className="btn-primary mt-3" onClick={() => setModal({ type: 'new' })}>
              Cadastrar primeira feira
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <p className="label mb-2.5">Próximas</p>
                <div className="mb-7 flex flex-col gap-2">
                  {upcoming.map((fair) => (
                    <CardProxima
                      key={fair.id}
                      fair={fair}
                      onEdit={() => setModal({ type: 'edit', fair })}
                      onDelete={() => setModal({ type: 'delete', fair })}
                    />
                  ))}
                </div>
              </>
            )}

            {past.length > 0 && (
              <>
                <p className="label mb-2.5">Realizadas</p>
                <div className="flex flex-col gap-2">
                  {past.map((fair) => (
                    <CardRealizada
                      key={fair.id}
                      fair={fair}
                      fairSales={sales.filter((s) => s.fairId === fair.id)}
                      onEdit={() => setModal({ type: 'edit', fair })}
                      onDelete={() => setModal({ type: 'delete', fair })}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}

      {modal?.type === 'new' && (
        <FairForm
          onSave={() => {
            loadFairs()
            showToast('Feira salva!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <FairForm
          fair={modal.fair}
          onSave={() => {
            loadFairs()
            showToast('Feira atualizada!')
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir feira"
          message={`Tem certeza que deseja excluir "${modal.fair.name}"?`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(modal.fair)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function custoDaFeira(fair: Fair): number {
  return fair.enrollmentCost + fair.additionalCosts.reduce((s, c) => s + c.amount, 0)
}

function CardProxima({
  fair,
  onEdit,
  onDelete
}: {
  fair: Fair
  onEdit: () => void
  onDelete: () => void
}): JSX.Element {
  const custo = custoDaFeira(fair)

  return (
    <div className="flex items-center gap-[18px] rounded-card border border-bone-400 bg-bone-50 px-[22px] py-4">
      <DataBadge data={fair.date} futura />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <p className="truncate text-[15px] font-semibold text-ink-900">{fair.name}</p>
          <span className="shrink-0 rounded-[5px] bg-sage-100 px-2 py-0.5 text-meta font-bold text-sage-600">
            {prazoLabel(fair)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-aux text-ink-400">
          {fair.location} · {formatDateRange(fair.date, fair.endDate)}
          {fair.organizer ? ` · Org. ${fair.organizer}` : ''}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="label mb-0">Custo</p>
        <p className="text-sm font-semibold tabular-nums text-ink-900">
          {custo > 0 ? formatCurrency(custo) : 'Gratuita'}
        </p>
      </div>

      <div className="ml-3.5 flex shrink-0 items-center gap-2">
        <button
          className="text-aux font-semibold text-wine-500 hover:text-wine-600"
          onClick={onEdit}
        >
          Editar
        </button>
        <ActionMenu items={[{ label: 'Excluir feira', danger: true, onClick: onDelete }]} />
      </div>
    </div>
  )
}

function CardRealizada({
  fair,
  fairSales,
  onEdit,
  onDelete
}: {
  fair: Fair
  fairSales: Sale[]
  onEdit: () => void
  onDelete: () => void
}): JSX.Element {
  const [expandida, setExpandida] = useState(false)

  const extras = fair.additionalCosts.reduce((s, c) => s + c.amount, 0)
  const custo = fair.enrollmentCost + extras
  const faturado = fairSales.reduce((s, sale) => s + sale.totalAmount, 0)
  const lucroBruto = fairSales.reduce((s, sale) => s + (sale.totalAmount - sale.totalCost), 0)
  const liquido = lucroBruto - custo
  const temVendas = fairSales.length > 0

  return (
    <div className="overflow-hidden rounded-card border border-bone-400 bg-bone-50">
      <div
        className={`flex items-center gap-[18px] px-[22px] py-4 ${
          expandida ? 'border-b border-bone-400 bg-bone-100' : ''
        }`}
      >
        <DataBadge data={fair.date} futura={false} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-900">{fair.name}</p>
          <p className="mt-0.5 truncate text-aux text-ink-400">
            {fair.location} · {formatDateRange(fair.date, fair.endDate)}
            {fair.organizer ? ` · Org. ${fair.organizer}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 gap-6 text-right">
          <Metrica rotulo="Faturado" valor={formatCurrency(faturado)} />
          <Metrica
            rotulo="Custo"
            valor={custo > 0 ? formatCurrency(custo) : 'Gratuita'}
            cor={custo > 0 ? 'text-clay-500' : 'text-ink-400'}
          />
          <Metrica
            rotulo="Líquido"
            valor={formatCurrency(liquido)}
            cor={liquido >= 0 ? 'text-sage-500' : 'text-clay-500'}
          />
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-2">
          {temVendas ? (
            <button
              className="flex items-center gap-1 whitespace-nowrap text-aux font-semibold text-wine-500 hover:text-wine-600"
              onClick={() => setExpandida((v) => !v)}
            >
              {fairSales.length} venda{fairSales.length !== 1 ? 's' : ''}
              {expandida ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="whitespace-nowrap text-aux text-ink-200">sem vendas</span>
          )}
          <ActionMenu
            items={[
              { label: 'Editar feira', onClick: onEdit },
              { label: 'Excluir feira', danger: true, onClick: onDelete }
            ]}
          />
        </div>
      </div>

      {expandida && temVendas && (
        <div className="py-1 pl-[94px] pr-[22px]">
          <table className="w-full text-micro">
            <thead>
              <tr>
                <th className={`${TH} w-[74px] text-left`}>Data</th>
                <th className={`${TH} text-left`}>Itens</th>
                <th className={`${TH} text-right`}>Total</th>
                <th className={`${TH} text-right`}>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {fairSales.map((sale) => (
                <tr key={sale.id} className="border-t border-bone-300">
                  <td className="py-2.5 tabular-nums text-ink-400">{formatDate(sale.soldAt)}</td>
                  <td className="py-2.5 pr-4 text-ink-800">
                    {sale.items
                      .map((i) => `${i.productName} — ${i.variationIdentifier} (${i.quantity}x)`)
                      .join(', ')}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-ink-900">
                    {formatCurrency(sale.totalAmount)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-sage-500">
                    {formatCurrency(sale.totalAmount - sale.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-4 mt-3 flex flex-wrap items-center gap-3.5 rounded-control bg-bone-200 px-3.5 py-2.5 text-aux text-ink-600">
            <span>
              Lucro bruto{' '}
              <strong className="font-semibold tabular-nums text-ink-900">
                {formatCurrency(lucroBruto)}
              </strong>
            </span>
            <span className="text-ink-200">−</span>
            <span className="tabular-nums">
              Inscrição {formatCurrency(fair.enrollmentCost)}
              {extras > 0 && ` + extras ${formatCurrency(extras)}`}
            </span>
            <span className="ml-auto text-body">
              Líquido da feira{' '}
              <strong
                className={`font-bold tabular-nums ${liquido >= 0 ? 'text-sage-500' : 'text-clay-500'}`}
              >
                {formatCurrency(liquido)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
