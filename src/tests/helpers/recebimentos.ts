import type { AmbienteIpc } from './ambiente-ipc'
import type { RegisterPaymentInput } from '../../shared/ipc/vendas'

/** Mesmo payload que o modal Receber envia. Devolve o id do pagamento. */
export async function receber(
  ambiente: AmbienteIpc,
  saleId: number,
  dados: Partial<Omit<RegisterPaymentInput, 'saleId'>> & { amount: number }
): Promise<number> {
  const { id } = await ambiente.chamar<{ id: number }>('sales:registerPayment', {
    saleId,
    paymentMethod: 'pix',
    feePercentage: 0,
    receivedAt: '2026-09-22',
    ...dados
  })
  return Number(id)
}

/**
 * Reproduz o que o antigo `sales:markAsReceived` gravava até a 1.14: a venda deixava de
 * ser "a receber" e guardava forma, taxa, líquido e data do recebimento na própria linha.
 * O canal não existe mais, então o teste escreve esse estado direto no banco para provar
 * que as vendas recebidas antes da migração 4 continuam valendo.
 */
export function simularRecebimentoAntigo(
  ambiente: AmbienteIpc,
  saleId: number,
  dados: {
    paymentMethod: 'dinheiro' | 'pix' | 'debito' | 'credito'
    feePercentage: number
    feeAmount: number
    netAmount: number
    receivedAt: string
  }
): void {
  ambiente.banco.run(
    `UPDATE sales
     SET payment_method = ?, fee_percentage = ?, fee_amount = ?, net_amount = ?, received_at = ?
     WHERE id = ?`,
    [
      dados.paymentMethod,
      dados.feePercentage,
      dados.feeAmount,
      dados.netAmount,
      dados.receivedAt,
      saleId
    ]
  )
}
