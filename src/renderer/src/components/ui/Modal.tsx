import { useEffect, useId, useRef } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /**
   * Clique no fundo fecha o modal. Só para aviso, confirmação e consulta: num
   * formulário, um clique ao lado da caixa descartava tudo o que ela tinha digitado.
   */
  fechaAoClicarFora?: boolean
}

interface ModalAberto {
  fechar: () => void
}

/**
 * Modais abertos, do mais antigo para o mais novo. Um ouvinte só fecha o de cima:
 * com um ouvinte por modal, Esc numa pergunta aberta sobre um formulário fechava os
 * dois, e o que ela tinha digitado se perdia. Com vários ouvintes, a ordem entre eles
 * e o momento em que o React desmonta o de cima decidiam quem fechava.
 */
const abertos: ModalAberto[] = []

function fecharODeCima(e: KeyboardEvent): void {
  if (e.key === 'Escape') abertos[abertos.length - 1]?.fechar()
}

export default function Modal({
  title,
  onClose,
  children,
  size = 'md',
  fechaAoClicarFora = false
}: ModalProps): JSX.Element {
  const idDoTitulo = useId()
  const aberto = useRef<ModalAberto>({ fechar: onClose })
  // Seleção de texto que começa num campo e termina fora da caixa também gera um
  // clique no fundo: só vale como "clicar fora" se o botão desceu no próprio fundo.
  const apertouNoFundo = useRef(false)

  useEffect(() => {
    aberto.current.fechar = onClose
  }, [onClose])

  useEffect(() => {
    const este = aberto.current
    abertos.push(este)
    if (abertos.length === 1) document.addEventListener('keydown', fecharODeCima)
    return () => {
      abertos.splice(abertos.indexOf(este), 1)
      if (abertos.length === 0) document.removeEventListener('keydown', fecharODeCima)
    }
  }, [])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/35 backdrop-blur-sm"
      onMouseDown={(e) => {
        apertouNoFundo.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        const cliqueNoFundo = e.target === e.currentTarget && apertouNoFundo.current
        apertouNoFundo.current = false
        if (fechaAoClicarFora && cliqueNoFundo) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        className={`bg-bone-50 rounded-card shadow-pop w-full ${widths[size]} mx-4 flex flex-col max-h-[90vh] border border-bone-400`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-bone-300 shrink-0">
          <h3 id={idDoTitulo} className="font-display text-[17px] font-semibold text-ink-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-300 hover:text-ink-700 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
