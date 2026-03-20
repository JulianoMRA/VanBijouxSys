import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Stock from './pages/Stock'
import Sales from './pages/Sales'
import Fairs from './pages/Fairs'
import PriceCalculator from './pages/PriceCalculator'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="stock" element={<Stock />} />
        <Route path="sales" element={<Sales />} />
        <Route path="fairs" element={<Fairs />} />
        <Route path="price-calculator" element={<PriceCalculator />} />
      </Route>
    </Routes>
  )
}
