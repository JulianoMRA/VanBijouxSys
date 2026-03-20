import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'
import { registerSaleHandlers } from './sales'

export function registerAllHandlers(): void {
  registerProductHandlers()
  registerFairHandlers()
  registerSaleHandlers()
}
