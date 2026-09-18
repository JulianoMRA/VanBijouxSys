import type { ConexaoBanco } from '../database/conexao'
import { repositorioDoPainel } from '../repositorios/painel'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import { ARGUMENTOS_PAINEL } from '../../shared/ipc/painel'
import { registrarCanal, type RegistroDeCanais } from './canal'

export function registerDashboardHandlers(ipc: RegistroDeCanais, banco: ConexaoBanco): void {
  const repositorio = repositorioDoPainel(banco)

  registrarCanal(ipc, CANAIS_IPC.dashboard.getStats, ARGUMENTOS_PAINEL.getStats, (params) =>
    repositorio.estatisticas(params)
  )
}
