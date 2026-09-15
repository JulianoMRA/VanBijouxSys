import { writeFileSync } from 'fs'
import type { ConexaoBanco } from '../database/conexao'
import { repositorioDeInsumos } from '../repositorios/insumos'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import { ARGUMENTOS_INSUMOS } from '../../shared/ipc/insumos'
import { registrarCanal, type RegistroDeCanais } from './canal'

/** Sem o BOM o Excel abre o CSV com a acentuação quebrada. */
const BOM_UTF8 = String.fromCharCode(0xfeff)

/** O diálogo nativo de salvar, atrás de uma interface para os testes não abrirem janela. */
export interface DialogoDeArquivo {
  escolherOndeSalvar(
    nomePadrao: string,
    filtros: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null>
}

export function registerInsumoHandlers(
  ipc: RegistroDeCanais,
  banco: ConexaoBanco,
  dialogo: DialogoDeArquivo
): void {
  const repositorio = repositorioDeInsumos(banco)
  const canais = CANAIS_IPC.insumos
  const argumentos = ARGUMENTOS_INSUMOS

  registrarCanal(ipc, canais.getAll, argumentos.getAll, () => repositorio.listar())

  registrarCanal(ipc, canais.create, argumentos.create, (dados) => repositorio.criar(dados))

  registrarCanal(ipc, canais.update, argumentos.update, (dados) => {
    repositorio.atualizar(dados)
    return { success: true }
  })

  registrarCanal(ipc, canais.addStock, argumentos.addStock, (id, quantidade) => {
    repositorio.adicionarEstoque(id, quantidade)
    return { success: true }
  })

  registrarCanal(ipc, canais.delete, argumentos.delete, (id) => {
    repositorio.excluir(id)
    return { success: true }
  })

  registrarCanal(ipc, canais.setArchived, argumentos.setArchived, (id, arquivado) => {
    repositorio.definirArquivado(id, arquivado)
    return { success: true }
  })

  registrarCanal(ipc, canais.exportCsv, argumentos.exportCsv, async (conteudo, nomePadrao) => {
    const caminho = await dialogo.escolherOndeSalvar(nomePadrao, [
      { name: 'CSV (Excel)', extensions: ['csv'] }
    ])
    if (!caminho) return { salvo: false }

    writeFileSync(caminho, BOM_UTF8 + conteudo, 'utf8')
    return { salvo: true, caminho }
  })
}
