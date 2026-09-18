import type { ConexaoBanco } from '../database/conexao'
import type { RegistroDeCanais } from './canal'
import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'
import { registerSaleHandlers } from './sales'
import { registerDashboardHandlers } from './dashboard'
import { registerInsumoHandlers, type DialogoDeArquivo } from './insumos'
import { registerCashHandlers } from './cash'
import { registerBackupHandlers } from './backup'

export interface DependenciasDosCanais {
  ipc: RegistroDeCanais
  banco: ConexaoBanco
  dialogoDeArquivo: DialogoDeArquivo
}

/**
 * Os domínios migrados para a fronteira validada recebem ipc e banco por
 * parâmetro; os demais ainda usam o `ipcMain` e o banco globais.
 */
export function registerAllHandlers({ ipc, banco, dialogoDeArquivo }: DependenciasDosCanais): void {
  registerProductHandlers(ipc, banco)
  registerFairHandlers(ipc, banco)
  registerSaleHandlers(ipc, banco)
  registerDashboardHandlers()
  registerInsumoHandlers(ipc, banco, dialogoDeArquivo)
  registerCashHandlers(ipc, banco)
  registerBackupHandlers()
}
