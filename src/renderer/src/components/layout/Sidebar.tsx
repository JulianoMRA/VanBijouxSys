import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Gem, Package, ShoppingBag, Store, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/products', label: 'Produtos', Icon: Gem },
  { to: '/price-calculator', label: 'Precificação', Icon: Tag },
  { to: '/stock', label: 'Estoque', Icon: Package },
  { to: '/sales', label: 'Vendas', Icon: ShoppingBag },
  { to: '/fairs', label: 'Feiras', Icon: Store }
]

export default function Sidebar(): JSX.Element {
  return (
    <aside
      className="w-60 flex flex-col shrink-0"
      style={{
        background: 'linear-gradient(180deg, #1a0d17 0%, #251020 50%, #1e0c1a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.25)'
      }}
    >
      <div className="px-6 py-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1
          className="font-display text-xl font-semibold leading-tight"
          style={{ color: '#f9eef3', letterSpacing: '0.02em' }}
        >
          Van Bijoux
        </h1>
        <p className="text-xs mt-1" style={{ color: '#7a4a60', letterSpacing: '0.05em' }}>
          GESTÃO DE BIJOUTERIAS
        </p>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
          >
            {({ isActive }) => (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  color: isActive ? '#f5aacb' : 'rgba(255,255,255,0.42)',
                  background: isActive ? 'rgba(228,77,138,0.15)' : 'transparent',
                  boxShadow: isActive ? 'inset 0 0 0 1px rgba(228,77,138,0.2)' : 'none'
                }}
              >
                <Icon size={16} />
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs" style={{ color: '#4a2438' }}>v1.0.0</p>
      </div>
    </aside>
  )
}
