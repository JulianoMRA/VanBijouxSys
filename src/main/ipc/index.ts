import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'
import { registerSaleHandlers } from './sales'
import { registerDashboardHandlers } from './dashboard'
import { registerInsumoHandlers } from './insumos'
import { registerCashHandlers } from './cash'

export function registerAllHandlers(): void {
  registerProductHandlers()
  registerFairHandlers()
  registerSaleHandlers()
  registerDashboardHandlers()
  registerInsumoHandlers()
  registerCashHandlers()
}
