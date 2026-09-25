import { useState } from 'react'
import Modal from '../ui/Modal'
import CampoNumerico from '../ui/CampoNumerico'
import {
  formatarNumeroParaCampo,
  interpretarNumero,
  numeroDoArmazenamento,
  numeroParaArmazenamento
} from '../../utils/numero'
import { formatCurrency, formatDate, partesDaData } from '../../utils/format'
import { totalRecebido } from '../../utils/recebimentos'
import { emCentavos } from '../../../../shared/dinheiro'
import { RECUSAS_DE_PAGAMENTO } from '../../../../shared/recebimentos'
import type { ReceivedPaymentMethod, Sale } from '../../types'

interface ReceberPagamentoModalProps {
  sale: Sale
  onSave: () => void
  onClose: () => void
}

const PAYMENT_METHODS: { value: ReceivedPaymentMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' }
]

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadLastFee(method: ReceivedPaymentMethod): string {
  if (method === 'dinheiro') return '0'
  return numeroDoArmazenamento(localStorage.getItem(`lastFee_${method}`))
}

/**
 * RN-17. O valor já vem com o que falta receber: quitar de uma vez é só confirmar,
 * e um valor menor é o pagamento parcial. Quem confere e grava é o processo
 * principal; a tela só antecipa as recusas mais comuns.
 */
export default function ReceberPagamentoModal({
  sale,
  onSave,
  onClose
}: ReceberPagamentoModalProps): JSX.Element {
  const [amount, setAmount] = useState(formatarNumeroParaCampo(sale.amountDue))
  const [paymentMethod, setPaymentMethod] = useState<ReceivedPaymentMethod>('dinheiro')
  const [feePercentage, setFeePercentage] = useState('0')
  const [receivedAt, setReceivedAt] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleMethodChange(method: ReceivedPaymentMethod): void {
    setPaymentMethod(method)
    setFeePercentage(loadLastFee(method))
  }

  const valorLido = interpretarNumero(amount)
  const valor = valorLido === null ? 0 : emCentavos(valorLido)
  const feeLida = feePercentage.trim() === '' ? 0 : interpretarNumero(feePercentage)
  const feePercent = feeLida ?? 0
  const feeAmount = (valor * feePercent) / 100
  const netAmount = valor - feeAmount
  const faltaDepois = emCentavos(sale.amountDue - valor)
  const recebido = totalRecebido(sale)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (valorLido === null || valor <= 0) {
      setError(RECUSAS_DE_PAGAMENTO.valorZerado)
      return
    }
    if (valor > sale.amountDue) {
      setError(RECUSAS_DE_PAGAMENTO.acimaDoQueFalta(sale.amountDue))
      return
    }
    if (!receivedAt) {
      setError('Informe a data do recebimento.')
      return
    }
    if (feeLida === null || feeLida < 0 || feeLida > 100) {
      setError('Informe uma taxa entre 0 e 100%.')
      return
    }
    if (paymentMethod !== 'dinheiro' && feePercent > 0) {
      localStorage.setItem(`lastFee_${paymentMethod}`, numeroParaArmazenamento(feePercentage) ?? '')
    }
    setSaving(true)
    try {
      await window.api.sales.registerPayment({
        saleId: sale.id,
        amount: valor,
        paymentMethod,
        feePercentage: feePercent,
        receivedAt
      })
      onSave()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao registrar o pagamento. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Receber pagamento" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1 rounded-control bg-bone-200 px-4 py-3 text-body text-ink-600">
          <p>
            Venda de{' '}
            <span className="font-semibold tabular-nums text-ink-900">
              {formatCurrency(sale.totalAmount)}
            </span>
            {sale.customerName && (
              <>
                {' '}
                para <span className="font-semibold text-ink-900">{sale.customerName}</span>
              </>
            )}
            {partesDaData(sale.soldAt) ? `, em ${formatDate(sale.soldAt)}.` : ', sem data.'}
          </p>
          {recebido > 0 && (
            <p>
              Já recebido{' '}
              <span className="font-semibold tabular-nums text-ink-900">
                {formatCurrency(recebido)}
              </span>{' '}
              · falta{' '}
              <span className="font-semibold tabular-nums text-honey-600">
                {formatCurrency(sale.amountDue)}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="receber-valor">
            Valor recebido (R$)
          </label>
          <CampoNumerico
            id="receber-valor"
            className="input"
            value={amount}
            onChange={setAmount}
            placeholder={formatarNumeroParaCampo(sale.amountDue)}
          />
          {valor > 0 && valor < sale.amountDue && (
            <p className="mt-1 text-micro tabular-nums text-ink-500">
              Depois deste pagamento, ainda faltam {formatCurrency(faltaDepois)}.
            </p>
          )}
          {valor > 0 && valor === sale.amountDue && (
            <p className="mt-1 text-micro text-sage-600">
              Com este pagamento, a venda fica quitada.
            </p>
          )}
        </div>

        <div>
          <label className="label">Forma de pagamento recebida</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleMethodChange(value)}
                className={`rounded-control px-3 py-1.5 text-body font-medium transition-colors ${
                  paymentMethod === value
                    ? 'bg-wine-500 text-bone-50'
                    : 'bg-bone-200 text-ink-600 hover:bg-bone-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod !== 'dinheiro' && (
          <div>
            <label className="label" htmlFor="receber-taxa">
              Taxa (
              {paymentMethod === 'pix'
                ? 'sugerido: 0,99%'
                : paymentMethod === 'debito'
                  ? 'sugerido: 1,69%'
                  : 'variável'}
              )
            </label>
            <div className="relative">
              <CampoNumerico
                id="receber-taxa"
                className="input pr-8"
                value={feePercentage}
                onChange={setFeePercentage}
                placeholder="0,00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body text-ink-300">
                %
              </span>
            </div>
            {feePercent > 0 && valor > 0 && (
              <p className="mt-1 text-micro tabular-nums text-ink-500">
                Taxa: {formatCurrency(feeAmount)} · Entra no caixa: {formatCurrency(netAmount)}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="label" htmlFor="receber-data">
            Data do recebimento
          </label>
          <input
            id="receber-data"
            type="date"
            className="input"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            min={sale.soldAt.slice(0, 10)}
          />
        </div>

        {error && (
          <div className="rounded-control border border-bone-500 bg-clay-100 px-3 py-2 text-body text-clay-600">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Confirmar recebimento'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
