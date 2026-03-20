import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Gem, Package, ShoppingBag, Store, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/products', label: 'Produtos', Icon: Gem },
  { to: '/stock', label: 'Estoque', Icon: Package },
  { to: '/sales', label: 'Vendas', Icon: ShoppingBag },
  { to: '/fairs', label: 'Feiras', Icon: Store },
  { to: '/price-calculator', label: 'Precificação', Icon: Tag }
]

export default function Sidebar(): JSX.Element {
  return (
    <aside className="w-60 bg-white border-r border-cream-200 flex flex-col shadow-soft">
      <div className="px-6 py-8 border-b border-cream-200">
        <h1 className="font-display text-xl font-semibold text-blush-700 leading-tight">
          Van Bijoux
        </h1>
        <p className="text-xs text-gray-400 mt-0.5 font-sans">Gestão de Bijouterias</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blush-50 text-blush-700 shadow-sm'
                  : 'text-gray-500 hover:bg-cream-100 hover:text-gray-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-cream-200">
        <p className="text-xs text-gray-300 font-sans">v0.1.0</p>
      </div>
    </aside>
  )
}
