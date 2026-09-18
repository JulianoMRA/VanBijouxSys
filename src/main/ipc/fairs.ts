import type { ConexaoBanco } from '../database/conexao'
import { repositorioDeFeiras } from '../repositorios/feiras'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import { ARGUMENTOS_FEIRAS } from '../../shared/ipc/feiras'
import { registrarCanal, type RegistroDeCanais } from './canal'

const OK = { success: true }

export function registerFairHandlers(ipc: RegistroDeCanais, banco: ConexaoBanco): void {
  const repositorio = repositorioDeFeiras(banco)
  const { fairs } = CANAIS_IPC

  registrarCanal(ipc, fairs.getAll, ARGUMENTOS_FEIRAS.getAll, () => repositorio.listarFeiras())
  registrarCanal(ipc, fairs.create, ARGUMENTOS_FEIRAS.create, (dados) =>
    repositorio.criarFeira(dados)
  )
  registrarCanal(ipc, fairs.update, ARGUMENTOS_FEIRAS.update, (dados) => {
    repositorio.atualizarFeira(dados)
    return OK
  })
  registrarCanal(ipc, fairs.delete, ARGUMENTOS_FEIRAS.delete, (id) => {
    repositorio.excluirFeira(id)
    return OK
  })
}
