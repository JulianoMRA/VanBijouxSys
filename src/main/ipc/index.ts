import type { ConexaoBanco } from '../database/conexao'
import type { RegistroDeCanais } from './canal'
import { registerProductHandlers } from './products'
import { registerFairHandlers } from './fairs'
import { registerSaleHandlers } from './sales'
import { registerDashboardHandlers } from './dashboard'
import { registerInsumoHandlers, type DialogoDeArquivo } from './insumos'
import { registerCashHandlers } from './cash'
import { registerBackupHandlers, type DependenciasDosCanaisDeBackup } from './backup'

export interface DependenciasDosCanais {
  ipc: RegistroDeCanais
  banco: ConexaoBanco
  dialogoDeArquivo: DialogoDeArquivo
  backup: DependenciasDosCanaisDeBackup
}

/** Todos os canais passam pela fronteira validada e recebem o que usam por parâmetro. */
export function registerAllHandlers({
  ipc,
  banco,
  dialogoDeArquivo,
  backup
}: DependenciasDosCanais): void {
  registerProductHandlers(ipc, banco)
  registerFairHandlers(ipc, banco)
  registerSaleHandlers(ipc, banco)
  registerDashboardHandlers(ipc, banco)
  registerInsumoHandlers(ipc, banco, dialogoDeArquivo)
  registerCashHandlers(ipc, banco)
  registerBackupHandlers(ipc, backup)
}
