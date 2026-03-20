import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ErrorBoundary from '../ui/ErrorBoundary'

export default function Layout(): JSX.Element {
  return (
    <div className="flex h-full" style={{ background: '#faf5f2' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
