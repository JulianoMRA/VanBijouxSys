import type { ConexaoBanco } from '../database/conexao'
import { repositorioDeVendas } from '../repositorios/vendas'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import { ARGUMENTOS_VENDAS } from '../../shared/ipc/vendas'
import { registrarCanal, type RegistroDeCanais } from './canal'

const OK = { success: true }

export function registerSaleHandlers(ipc: RegistroDeCanais, banco: ConexaoBanco): void {
  const repositorio = repositorioDeVendas(banco)
  const { sales } = CANAIS_IPC

  registrarCanal(ipc, sales.getAll, ARGUMENTOS_VENDAS.getAll, () => repositorio.listarVendas())
  registrarCanal(ipc, sales.create, ARGUMENTOS_VENDAS.create, (dados) =>
    repositorio.criarVenda(dados)
  )
  registrarCanal(ipc, sales.update, ARGUMENTOS_VENDAS.update, (dados) => {
    repositorio.atualizarVenda(dados)
    return OK
  })
  registrarCanal(ipc, sales.delete, ARGUMENTOS_VENDAS.delete, (id) => {
    repositorio.excluirVenda(id)
    return OK
  })
  registrarCanal(ipc, sales.registerPayment, ARGUMENTOS_VENDAS.registerPayment, (dados) =>
    repositorio.registrarPagamento(dados)
  )
  registrarCanal(ipc, sales.deletePayment, ARGUMENTOS_VENDAS.deletePayment, (id) => {
    repositorio.excluirPagamento(id)
    return OK
  })
  registrarCanal(ipc, sales.unmarkAsReceived, ARGUMENTOS_VENDAS.unmarkAsReceived, (id) => {
    repositorio.desmarcarRecebida(id)
    return OK
  })
}
