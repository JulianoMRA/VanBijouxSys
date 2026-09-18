import type { ConexaoBanco } from '../database/conexao'
import { repositorioDeCaixa } from '../repositorios/caixa'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import {
  ARGUMENTOS_CAIXA,
  ARGUMENTOS_CATEGORIAS_DE_DESPESA,
  ARGUMENTOS_DESPESAS
} from '../../shared/ipc/caixa'
import { registrarCanal, type RegistroDeCanais } from './canal'

const OK = { success: true }

export function registerCashHandlers(ipc: RegistroDeCanais, banco: ConexaoBanco): void {
  const repositorio = repositorioDeCaixa(banco)
  const { expenseCategories, cashExpenses, cashSettings } = CANAIS_IPC

  registrarCanal(ipc, expenseCategories.getAll, ARGUMENTOS_CATEGORIAS_DE_DESPESA.getAll, () =>
    repositorio.listarCategorias()
  )
  registrarCanal(ipc, expenseCategories.create, ARGUMENTOS_CATEGORIAS_DE_DESPESA.create, (dados) =>
    repositorio.criarCategoria(dados)
  )
  registrarCanal(
    ipc,
    expenseCategories.update,
    ARGUMENTOS_CATEGORIAS_DE_DESPESA.update,
    (dados) => {
      repositorio.atualizarCategoria(dados)
      return OK
    }
  )
  registrarCanal(ipc, expenseCategories.delete, ARGUMENTOS_CATEGORIAS_DE_DESPESA.delete, (id) => {
    repositorio.excluirCategoria(id)
    return OK
  })

  registrarCanal(ipc, cashExpenses.getAll, ARGUMENTOS_DESPESAS.getAll, (filtro) =>
    repositorio.listarDespesas(filtro)
  )
  registrarCanal(ipc, cashExpenses.create, ARGUMENTOS_DESPESAS.create, (dados) =>
    repositorio.criarDespesa(dados)
  )
  registrarCanal(ipc, cashExpenses.update, ARGUMENTOS_DESPESAS.update, (dados) => {
    repositorio.atualizarDespesa(dados)
    return OK
  })
  registrarCanal(ipc, cashExpenses.delete, ARGUMENTOS_DESPESAS.delete, (id) => {
    repositorio.excluirDespesa(id)
    return OK
  })
  registrarCanal(ipc, cashExpenses.getStats, ARGUMENTOS_DESPESAS.getStats, (filtro) =>
    repositorio.estatisticas(filtro)
  )

  registrarCanal(ipc, cashSettings.get, ARGUMENTOS_CAIXA.get, () => repositorio.configuracoes())
  registrarCanal(
    ipc,
    cashSettings.setOpeningBalance,
    ARGUMENTOS_CAIXA.setOpeningBalance,
    (saldo) => {
      repositorio.definirSaldoDeAbertura(saldo)
      return OK
    }
  )
}
