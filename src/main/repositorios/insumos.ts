import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import { SQL_INSUMOS_COM_USO } from '../database/consultas-estoque'
import { saldoArredondado } from './estoque'
import { insumos } from '../database/schema'
import { ErroDeNegocio } from '../ipc/mensagens'
import type { Insumo, insumoAtualizadoSchema, novoInsumoSchema } from '../../shared/ipc/insumos'

type NovoInsumo = z.output<typeof novoInsumoSchema>
type InsumoAtualizado = z.output<typeof insumoAtualizadoSchema>

export interface RepositorioDeInsumos {
  listar(): Insumo[]
  criar(dados: NovoInsumo): { id: number }
  atualizar(dados: InsumoAtualizado): void
  adicionarEstoque(id: number, quantidade: number): void
  excluir(id: number): void
  definirArquivado(id: number, arquivado: boolean): void
}

export function repositorioDeInsumos({ db, sqlite }: ConexaoBanco): RepositorioDeInsumos {
  /**
   * RN-05. Trocar a unidade não converte nada: 20 cm de fio na receita viram 20 g. Com
   * receita, a troca é recusada, porque as quantidades vivem em outra tela e
   * ninguém veria a mudança de sentido — conta até variação arquivada, que pode
   * voltar. Com saldo, a troca só vale junto com a contagem na unidade nova, que
   * o formulário mostra ao lado do campo.
   */
  function validarTrocaDeUnidade(dados: InsumoAtualizado, estoqueSalvo: number): void {
    const { receitas } = sqlite
      .prepare(
        'SELECT COUNT(DISTINCT variation_id) AS receitas FROM variation_insumos WHERE insumo_id = ?'
      )
      .get(dados.id) as { receitas: number }
    if (receitas > 0) {
      const plural = receitas !== 1 ? 's' : ''
      throw new ErroDeNegocio(
        `A unidade não pode mudar: este insumo está em ${receitas} receita${plural}, e as quantidades passariam a valer em outra unidade. Cadastre um insumo novo com a unidade certa.`
      )
    }
    if (estoqueSalvo !== 0 && dados.stockQuantity === estoqueSalvo) {
      throw new ErroDeNegocio(
        'Para trocar a unidade, informe também o estoque atual na unidade nova.'
      )
    }
  }

  return {
    listar() {
      return sqlite.prepare(SQL_INSUMOS_COM_USO).all() as Insumo[]
    },

    criar(dados) {
      const resultado = db
        .insert(insumos)
        .values({
          name: dados.name,
          unit: dados.unit,
          costPerUnit: dados.costPerUnit,
          stockQuantity: dados.stockQuantity,
          minimumStock: dados.minimumStock
        })
        .run()
      return { id: Number(resultado.lastInsertRowid) }
    },

    atualizar(dados) {
      const atual = db
        .select({ unit: insumos.unit, stockQuantity: insumos.stockQuantity })
        .from(insumos)
        .where(eq(insumos.id, dados.id))
        .get()
      if (!atual) throw new ErroDeNegocio('Insumo não encontrado.')
      if (atual.unit !== dados.unit) validarTrocaDeUnidade(dados, atual.stockQuantity)

      db.update(insumos)
        .set({
          name: dados.name,
          unit: dados.unit,
          costPerUnit: dados.costPerUnit,
          stockQuantity: dados.stockQuantity,
          minimumStock: dados.minimumStock
        })
        .where(eq(insumos.id, dados.id))
        .run()
    },

    adicionarEstoque(id, quantidade) {
      const resultado = db
        .update(insumos)
        .set({ stockQuantity: saldoArredondado(quantidade) })
        .where(eq(insumos.id, id))
        .run()
      if (resultado.changes === 0) throw new ErroDeNegocio('Insumo não encontrado.')
    },

    excluir(id) {
      db.delete(insumos).where(eq(insumos.id, id)).run()
    },

    /**
     * Arquivar tira o insumo dos alertas, da lista e dos seletores de receita. Não
     * bloqueia se ele ainda for usado por variação ativa: a tela avisa e ela decide.
     * As receitas existentes continuam apontando para ele.
     */
    definirArquivado(id, arquivado) {
      db.update(insumos)
        .set({ archivedAt: arquivado ? sql`CURRENT_TIMESTAMP` : null })
        .where(eq(insumos.id, id))
        .run()
    }
  }
}
