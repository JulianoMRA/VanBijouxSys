import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'
import { registerSaleHandlers } from './sales'
import { registerDashboardHandlers } from './dashboard'

export function registerAllHandlers(): void {
  registerProductHandlers()
  registerFairHandlers()
  registerSaleHandlers()
  registerDashboardHandlers()
}
