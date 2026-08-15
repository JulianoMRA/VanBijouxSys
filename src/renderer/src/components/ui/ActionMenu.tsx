import { useEffect, useRef, useState } from 'react'
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

export default function ActionMenu({
  items,
  trigger,
  triggerClassName
}: ActionMenuProps): JSX.Element {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    function handlePointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [aberto])

  return (
    <div className="relative" ref={ref}>
      <button
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

      {aberto && (
        <div className="absolute right-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-control border border-bone-400 bg-bone-50 py-1 shadow-pop">
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
        </div>
      )}
    </div>
  )
}
