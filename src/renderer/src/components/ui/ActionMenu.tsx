import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  hint?: string
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  /** Conteúdo do gatilho. Sem isto o menu usa o botão "···" das tabelas. */
  trigger?: React.ReactNode
  triggerClassName?: string
}

interface Posicao {
  top: number
  right: number
}

/**
 * O menu é desenhado num portal, em coordenadas de viewport.
 *
 * Posicionado como `absolute` dentro da lista, ele era cortado: os cards das
 * telas usam `overflow-hidden` para arredondar os cantos da tabela, e o menu
 * aberto na última linha passava da borda inferior do card. Com lista longa
 * isso não aparecia — o menu caía sobre as linhas de baixo — mas bastava
 * filtrar a lista para o menu ficar sem espaço e as opções sumirem.
 */
export default function ActionMenu({
  items,
  trigger,
  triggerClassName
}: ActionMenuProps): JSX.Element {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<Posicao | null>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!aberto) {
      setPosicao(null)
      return
    }
    const gatilho = gatilhoRef.current
    const menu = menuRef.current
    if (!gatilho || !menu) return

    const alvo = gatilho.getBoundingClientRect()
    const altura = menu.offsetHeight
    const cabeAbaixo = window.innerHeight - alvo.bottom >= altura + 8

    setPosicao({
      top: cabeAbaixo ? alvo.bottom + 4 : Math.max(8, alvo.top - altura - 4),
      right: Math.max(8, window.innerWidth - alvo.right)
    })
  }, [aberto, items.length])

  useEffect(() => {
    if (!aberto) return

    function handlePointer(e: MouseEvent): void {
      const alvo = e.target as Node
      if (gatilhoRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return
      setAberto(false)
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setAberto(false)
    }
    // Ancorado na viewport, o menu ficaria solto se a página rolasse embaixo dele.
    function handleDeslocamento(): void {
      setAberto(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleDeslocamento, true)
    window.addEventListener('resize', handleDeslocamento)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleDeslocamento, true)
      window.removeEventListener('resize', handleDeslocamento)
    }
  }, [aberto])

  return (
    <div className="relative">
      <button
        ref={gatilhoRef}
        type="button"
        aria-label={trigger ? undefined : 'Mais ações'}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={
          triggerClassName ??
          (trigger
            ? 'btn-secondary'
            : 'flex items-center rounded-lg px-2 py-1.5 text-ink-500 transition-colors hover:bg-bone-300 hover:text-ink-800')
        }
      >
        {trigger ?? <MoreHorizontal size={16} />}
      </button>

      {aberto &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: posicao?.top ?? 0,
              right: posicao?.right ?? 0,
              // Só aparece depois de medido, senão pisca no canto da tela.
              visibility: posicao ? 'visible' : 'hidden'
            }}
            className="z-50 min-w-[150px] overflow-hidden rounded-control border border-bone-400 bg-bone-50 py-1 shadow-pop"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setAberto(false)
                  item.onClick()
                }}
                className={`block w-full px-3.5 py-2 text-left text-body transition-colors hover:bg-bone-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                  item.danger ? 'text-clay-500' : 'text-ink-800'
                }`}
              >
                {item.label}
                {item.hint && <span className="ml-1.5 text-micro text-ink-300">{item.hint}</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
