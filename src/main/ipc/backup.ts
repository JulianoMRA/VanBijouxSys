import { servicoDeBackup, type DependenciasDeBackup } from '../servicos/backup'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import { ARGUMENTOS_APP, ARGUMENTOS_BACKUP } from '../../shared/ipc/backup'
import { registrarCanal, type RegistroDeCanais } from './canal'

export interface DependenciasDosCanaisDeBackup {
  servicos: DependenciasDeBackup
  versaoDoApp(): string
  verificarAtualizacoes(): Promise<{ atualizacaoDisponivel: boolean }>
}

export function registerBackupHandlers(
  ipc: RegistroDeCanais,
  { servicos, versaoDoApp, verificarAtualizacoes }: DependenciasDosCanaisDeBackup
): void {
  const servico = servicoDeBackup(servicos)
  const { backup, app } = CANAIS_IPC

  registrarCanal(ipc, backup.exportar, ARGUMENTOS_BACKUP.exportar, () => servico.exportar())
  registrarCanal(ipc, backup.restaurar, ARGUMENTOS_BACKUP.restaurar, () => servico.restaurar())
  registrarCanal(ipc, backup.info, ARGUMENTOS_BACKUP.info, () => servico.info())
  registrarCanal(ipc, backup.abrirPasta, ARGUMENTOS_BACKUP.abrirPasta, () => servico.abrirPasta())

  registrarCanal(ipc, app.versao, ARGUMENTOS_APP.versao, () => versaoDoApp())
  registrarCanal(ipc, app.verificarAtualizacoes, ARGUMENTOS_APP.verificarAtualizacoes, () =>
    verificarAtualizacoes()
  )
}
