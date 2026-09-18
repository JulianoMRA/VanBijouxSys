import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import { fairAdditionalCosts, fairs } from '../database/schema'
import type {
  custoAdicionalSchema,
  Fair,
  feiraAtualizadaSchema,
  novaFeiraSchema
} from '../../shared/ipc/feiras'

type NovaFeira = z.output<typeof novaFeiraSchema>
type FeiraAtualizada = z.output<typeof feiraAtualizadaSchema>
type CustoAdicional = z.output<typeof custoAdicionalSchema>

export interface RepositorioDeFeiras {
  listarFeiras(): Fair[]
  criarFeira(dados: NovaFeira): { id: number }
  atualizarFeira(dados: FeiraAtualizada): void
  excluirFeira(id: number): void
}

export function repositorioDeFeiras({ db, sqlite }: ConexaoBanco): RepositorioDeFeiras {
  function substituirCustos(fairId: number, custos: CustoAdicional[]): void {
    db.delete(fairAdditionalCosts).where(eq(fairAdditionalCosts.fairId, fairId)).run()
    for (const custo of custos) {
      db.insert(fairAdditionalCosts)
        .values({ fairId, description: custo.description, amount: custo.amount })
        .run()
    }
  }

  return {
    listarFeiras() {
      const linhas = db.select().from(fairs).orderBy(fairs.date).all()
      return linhas.map((feira) => ({
        ...feira,
        additionalCosts: db
          .select()
          .from(fairAdditionalCosts)
          .where(eq(fairAdditionalCosts.fairId, feira.id))
          .all()
      }))
    },

    /** Feira e custos entram juntos: falhar no meio deixaria custo órfão. */
    criarFeira(dados) {
      const criar = sqlite.transaction(() => {
        const resultado = db
          .insert(fairs)
          .values({
            name: dados.name,
            location: dados.location,
            organizer: dados.organizer ?? null,
            date: dados.date,
            endDate: dados.endDate ?? null,
            enrollmentCost: dados.enrollmentCost
          })
          .run()
        const fairId = Number(resultado.lastInsertRowid)

        substituirCustos(fairId, dados.additionalCosts)

        return { id: fairId }
      })

      return criar()
    },

    atualizarFeira(dados) {
      const atualizar = sqlite.transaction(() => {
        db.update(fairs)
          .set({
            name: dados.name,
            location: dados.location,
            organizer: dados.organizer ?? null,
            date: dados.date,
            endDate: dados.endDate ?? null,
            enrollmentCost: dados.enrollmentCost
          })
          .where(eq(fairs.id, dados.id))
          .run()

        substituirCustos(dados.id, dados.additionalCosts)
      })

      atualizar()
    },

    /** Os custos adicionais saem junto, por cascata do próprio banco. */
    excluirFeira(id) {
      db.delete(fairs).where(eq(fairs.id, id)).run()
    }
  }
}
