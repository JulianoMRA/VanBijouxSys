import { emReais } from './dinheiro'

/**
 * RN-17. Recusas do pagamento de venda a receber, com o texto que chega à tela. O
 * processo principal é quem recusa; a tela usa o mesmo texto quando confere antes
 * de enviar.
 */
export const RECUSAS_DE_PAGAMENTO = {
  vendaNaoEncontrada: 'Esta venda não foi encontrada. Feche a janela e tente de novo.',
  soVendaAReceber: 'Só venda a receber aceita pagamento.',
  vendaQuitada: 'Esta venda já foi recebida por inteiro.',
  valorZerado: 'Informe um valor maior que zero.',
  acimaDoQueFalta: (falta: number): string =>
    `O valor é maior do que o que falta receber (${emReais(falta)}).`,
  antesDaVenda: 'A data do pagamento não pode ser anterior à data da venda.',
  formaTravada:
    'Esta venda tem pagamento registrado, então a forma continua "A receber". Para mudar, exclua os pagamentos antes.',
  totalAbaixoDoPago: (pago: number): string =>
    `O total da venda não pode ficar abaixo do que já foi recebido (${emReais(pago)}).`,
  vendaDepoisDoPagamento: 'A data da venda não pode ficar depois de um pagamento já registrado.'
} as const
