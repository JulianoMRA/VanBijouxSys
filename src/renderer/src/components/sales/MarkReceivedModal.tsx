import { useState } from 'react'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/format'
import type { PaymentMethod, Sale } from '../../types'

type ReceivedPaymentMethod = Exclude<PaymentMethod, 'areceber'>

interface MarkReceivedModalProps {
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
  return localStorage.getItem(`lastFee_${method}`) ?? ''
}

export default function MarkReceivedModal({
  sale,
  onSave,
  onClose
}: MarkReceivedModalProps): JSX.Element {
  const [paymentMethod, setPaymentMethod] = useState<ReceivedPaymentMethod>('dinheiro')
  const [feePercentage, setFeePercentage] = useState<string>('0')
  const [receivedAt, setReceivedAt] = useState<string>(todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleMethodChange(method: ReceivedPaymentMethod): void {
    setPaymentMethod(method)
    setFeePercentage(loadLastFee(method))
  }

  const feePercent = parseFloat(feePercentage) || 0
  const feeAmount = (sale.totalAmount * feePercent) / 100
  const netAmount = sale.totalAmount - feeAmount

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!receivedAt) {
      setError('Informe a data de recebimento.')
      return
    }
    if (paymentMethod !== 'dinheiro' && feePercent > 0) {
      localStorage.setItem(`lastFee_${paymentMethod}`, feePercentage)
    }
    setSaving(true)
    try {
      await window.api.sales.markAsReceived({
        id: sale.id,
        paymentMethod,
        feePercentage: feePercent,
        feeAmount,
        netAmount,
        receivedAt
      })
      onSave()
      onClose()
    } catch {
      setError('Erro ao marcar como recebida. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Marcar venda como recebida" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-cream-50 rounded-xl px-4 py-3 text-sm text-gray-600">
          <p>
            Venda de{' '}
            <span className="font-semibold text-gray-800">{formatCurrency(sale.totalAmount)}</span>{' '}
            registrada em {sale.soldAt.slice(8, 10)}/{sale.soldAt.slice(5, 7)}/
            {sale.soldAt.slice(0, 4)}.
          </p>
        </div>

        <div>
          <label className="label">Forma de pagamento recebida</label>
          <div className="flex gap-2 flex-wrap">
            {PAYMENT_METHODS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleMethodChange(value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  paymentMethod === value
                    ? 'bg-blush-500 text-white'
                    : 'bg-cream-100 text-gray-600 hover:bg-cream-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod !== 'dinheiro' && (
          <div>
            <label className="label">
              Taxa (
              {paymentMethod === 'pix'
                ? 'sugerido: 0,99%'
                : paymentMethod === 'debito'
                  ? 'sugerido: 1,69%'
                  : 'variável'}
              )
            </label>
            <div className="relative">
              <input
                className="input pr-8"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={feePercentage}
                onChange={(e) => setFeePercentage(e.target.value)}
                placeholder="0,00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                %
              </span>
            </div>
            {feePercent > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Taxa: {formatCurrency(feeAmount)} · Líquido: {formatCurrency(netAmount)}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="label">Data do recebimento</label>
          <input
            type="date"
            className="input"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            min={sale.soldAt.slice(0, 10)}
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-cream-100 transition-colors"
            disabled={saving}
          >
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
