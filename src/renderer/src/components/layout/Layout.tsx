import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ErrorBoundary from '../ui/ErrorBoundary'

export default function Layout(): JSX.Element {
  return (
    <div className="app-body">
      <Sidebar />
      <main className="app-main">
        <div className="main-inner">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
