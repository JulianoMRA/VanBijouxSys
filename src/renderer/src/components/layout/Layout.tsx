import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout(): JSX.Element {
  return (
    <div className="flex h-full bg-blush-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
