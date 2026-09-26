interface AvisoDeErroProps {
  mensagem: string
  onFechar: () => void
  /** Espaço abaixo da faixa; o Painel usa um maior que as outras páginas. */
  margem?: string
}

/** A faixa de erro no topo das páginas, com o × para dispensar. Sem mensagem, some. */
export default function AvisoDeErro({
  mensagem,
  onFechar,
  margem = 'mb-4'
}: AvisoDeErroProps): JSX.Element | null {
  if (!mensagem) return null

  return (
    <div
      className={`${margem} flex items-start justify-between gap-3 rounded-[11px] border border-bone-500 bg-clay-100 px-4 py-3`}
    >
      <p className="text-body text-clay-600">{mensagem}</p>
      <button
        onClick={onFechar}
        className="shrink-0 text-lg leading-none text-clay-500 hover:text-clay-600"
      >
        ×
      </button>
    </div>
  )
}
