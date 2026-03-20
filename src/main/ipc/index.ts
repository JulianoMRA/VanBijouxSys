import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'

export function registerAllHandlers(): void {
  registerProductHandlers()
  registerFairHandlers()
}
