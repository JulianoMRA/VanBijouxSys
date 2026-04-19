import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Gem, Package, ShoppingBag, Store, Tag, Landmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/',                label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/products',        label: 'Produtos',     Icon: Gem },
  { to: '/price-calculator',label: 'Precificação', Icon: Tag },
  { to: '/stock',           label: 'Estoque',      Icon: Package },
  { to: '/sales',           label: 'Vendas',       Icon: ShoppingBag },
  { to: '/fairs',           label: 'Feiras',       Icon: Store },
  { to: '/cash',            label: 'Caixa',        Icon: Landmark },
]

export default function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">Van Bijoux</div>
        <div className="sidebar-brand-tag">Gestão de bijouterias</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <span className={`nav-item${isActive ? ' active' : ''}`}>
                <Icon size={15} className="nav-icon" />
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span>v1.5.1</span>
      </div>
    </aside>
  )
}
