import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Gem,
  Package,
  ShoppingBag,
  Store,
  Tag,
  Landmark,
  ShieldCheck
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SystemPanel from './SystemPanel'
import { EVENTO_INSUMOS_ALTERADOS } from '../../utils/eventos'

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/products', label: 'Produtos', Icon: Gem },
  { to: '/price-calculator', label: 'Precificação', Icon: Tag },
  { to: '/stock', label: 'Estoque', Icon: Package },
  { to: '/sales', label: 'Vendas', Icon: ShoppingBag },
  { to: '/fairs', label: 'Feiras', Icon: Store },
  { to: '/cash', label: 'Caixa', Icon: Landmark }
]

export default function Sidebar(): JSX.Element {
  const [versao, setVersao] = useState('')
  const [painelAberto, setPainelAberto] = useState(false)
  const [insumosParaRepor, setInsumosParaRepor] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    window.api.app
      .versao()
      .then(setVersao)
      .catch(() => setVersao(''))
  }, [])

  const contarReposicao = useCallback(async (): Promise<void> => {
    try {
      const insumos = await window.api.insumos.getAll()
      setInsumosParaRepor(
        insumos.filter(
          (i) => i.stockQuantity <= 0 || (i.minimumStock > 0 && i.stockQuantity < i.minimumStock)
        ).length
      )
    } catch {
      setInsumosParaRepor(0)
    }
  }, [])

  // Recontagem a cada navegação cobre o que muda fora da tela de Estoque; o
  // evento cobre as alterações feitas sem sair dela.
  useEffect(() => {
    contarReposicao()
    window.addEventListener(EVENTO_INSUMOS_ALTERADOS, contarReposicao)
    return () => window.removeEventListener(EVENTO_INSUMOS_ALTERADOS, contarReposicao)
  }, [pathname, contarReposicao])

  return (
    <aside className="w-[236px] shrink-0 flex flex-col bg-bone-50 border-r border-bone-400">
      <div className="flex items-center gap-2.5 px-[22px] pt-[26px] pb-5">
        <div className="w-[26px] h-[26px] shrink-0 rounded-lg bg-wine-500" />
        <div>
          <h1 className="font-display text-base font-semibold leading-tight text-ink-900">
            Van Bijoux
          </h1>
          <p className="text-meta text-ink-300 tracking-[0.04em]">Gestão</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-px">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div
                className={`flex items-center gap-[11px] px-3 py-[9px] rounded-control text-body transition-colors duration-150 ${
                  isActive
                    ? 'font-semibold text-wine-500 bg-wine-50'
                    : 'font-medium text-ink-600 hover:bg-bone-200'
                }`}
              >
                <Icon size={15} className={isActive ? '' : 'text-ink-200'} />
                {label}
                {to === '/stock' && insumosParaRepor > 0 && (
                  <span
                    className="ml-auto rounded-full bg-honey-100 px-[7px] py-px text-meta font-bold tabular-nums text-honey-500"
                    title={`${insumosParaRepor} insumo${insumosParaRepor !== 1 ? 's' : ''} para repor`}
                  >
                    {insumosParaRepor}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3.5 border-t border-bone-300">
        <button
          onClick={() => setPainelAberto(true)}
          className="w-full flex items-center gap-[11px] px-3 py-2 rounded-control text-aux font-medium text-ink-400 hover:bg-bone-200 hover:text-ink-700 transition-colors duration-150"
        >
          <ShieldCheck size={14} />
          Backup e dados
        </button>
        <p className="px-3 pt-0.5 text-meta text-ink-100">{versao ? `v${versao}` : ''}</p>
      </div>

      {painelAberto && <SystemPanel onClose={() => setPainelAberto(false)} />}
    </aside>
  )
}
