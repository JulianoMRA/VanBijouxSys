import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ErrorBoundary from '../ui/ErrorBoundary'

/**
 * Transitório: no visual novo cada tela define o próprio espaçamento, porque o
 * cabeçalho fica fixo e precisa encostar nas bordas. As telas ainda não
 * migradas continuam recebendo o padding do Layout e saem desta lista conforme
 * forem refeitas — quando a lista esvaziar, a condição some.
 */
const ROTAS_VISUAL_ANTIGO = ['/stock', '/sales', '/fairs', '/cash']

export default function Layout(): JSX.Element {
  const { pathname } = useLocation()
  const padding = ROTAS_VISUAL_ANTIGO.includes(pathname) ? 'p-8' : ''

  return (
    <div className="flex h-full bg-bone-200">
      <Sidebar />
      <main className={`flex-1 overflow-auto ${padding}`}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
