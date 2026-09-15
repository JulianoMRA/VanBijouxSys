import type { ConexaoBanco } from '../database/conexao'
import { repositorioDeProdutos } from '../repositorios/produtos'
import { CANAIS_IPC } from '../../shared/ipc/channels'
import {
  ARGUMENTOS_CATEGORIAS,
  ARGUMENTOS_PRODUTOS,
  ARGUMENTOS_VARIACOES
} from '../../shared/ipc/produtos'
import { registrarCanal, type RegistroDeCanais } from './canal'

const OK = { success: true }

export function registerProductHandlers(ipc: RegistroDeCanais, banco: ConexaoBanco): void {
  const repositorio = repositorioDeProdutos(banco)
  const { categories, products, variations } = CANAIS_IPC

  registrarCanal(ipc, categories.getAll, ARGUMENTOS_CATEGORIAS.getAll, () =>
    repositorio.listarCategorias()
  )

  registrarCanal(ipc, products.getAll, ARGUMENTOS_PRODUTOS.getAll, () =>
    repositorio.listarProdutos()
  )
  registrarCanal(ipc, products.create, ARGUMENTOS_PRODUTOS.create, (dados) =>
    repositorio.criarProduto(dados)
  )
  registrarCanal(ipc, products.update, ARGUMENTOS_PRODUTOS.update, (dados) => {
    repositorio.atualizarProduto(dados)
    return OK
  })
  registrarCanal(ipc, products.delete, ARGUMENTOS_PRODUTOS.delete, (id) => {
    repositorio.excluirProduto(id)
    return OK
  })
  registrarCanal(ipc, products.setArchived, ARGUMENTOS_PRODUTOS.setArchived, (id, arquivado) => {
    repositorio.definirProdutoArquivado(id, arquivado)
    return OK
  })

  registrarCanal(ipc, variations.create, ARGUMENTOS_VARIACOES.create, (dados) =>
    repositorio.criarVariacao(dados)
  )
  registrarCanal(ipc, variations.update, ARGUMENTOS_VARIACOES.update, (dados) => {
    repositorio.atualizarVariacao(dados)
    return OK
  })
  registrarCanal(ipc, variations.setSalePrice, ARGUMENTOS_VARIACOES.setSalePrice, (id, preco) => {
    repositorio.definirPrecoDeVenda(id, preco)
    return OK
  })
  registrarCanal(ipc, variations.delete, ARGUMENTOS_VARIACOES.delete, (id, opcoes) => {
    repositorio.excluirVariacao(id, opcoes)
    return OK
  })
  registrarCanal(ipc, variations.setArchived, ARGUMENTOS_VARIACOES.setArchived, (id, arquivada) => {
    repositorio.definirVariacaoArquivada(id, arquivada)
    return OK
  })
  registrarCanal(ipc, variations.addStock, ARGUMENTOS_VARIACOES.addStock, (id, quantidade) => {
    repositorio.adicionarPecas(id, quantidade)
    return OK
  })
}
