import type { InputHTMLAttributes } from 'react'
import { formatarNumeroParaCampo, interpretarNumero } from '../../utils/numero'

type AtributosDoInput = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'
>

interface CampoNumericoProps extends AtributosDoInput {
  value: string
  onChange: (texto: string) => void
}

/**
 * Campo de número no formato brasileiro. Ao sair do campo, o texto é reescrito
 * como foi entendido ("1.000" vira "1000", "2.5" vira "2,5"): é o jeito de a
 * leitura ficar visível sem ocupar espaço embaixo do campo. Texto que não é
 * número fica como está, para a validação do formulário apontar.
 */
export default function CampoNumerico({
  value,
  onChange,
  onBlur,
  ...resto
}: CampoNumericoProps): JSX.Element {
  return (
    <input
      {...resto}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const valor = interpretarNumero(value)
        if (valor !== null) onChange(formatarNumeroParaCampo(valor))
        onBlur?.(e)
      }}
    />
  )
}
