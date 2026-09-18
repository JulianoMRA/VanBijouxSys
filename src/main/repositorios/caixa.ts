import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import type { ConexaoBanco } from '../database/conexao'
import { cashExpenses, cashSettings, expenseCategories, sales } from '../database/schema'
import { ErroDeNegocio } from '../ipc/mensagens'
import type {
  CashExpense,
  CashSettings,
  CashStats,
  categoriaDeDespesaAtualizadaSchema,
  despesaAtualizadaSchema,
  ExpenseCategory,
  filtroDeDespesasSchema,
  filtroDeEstatisticasSchema,
  novaCategoriaDeDespesaSchema,
  novaDespesaSchema
} from '../../shared/ipc/caixa'

type NovaCategoria = z.output<typeof novaCategoriaDeDespesaSchema>
type CategoriaAtualizada = z.output<typeof categoriaDeDespesaAtualizadaSchema>
type NovaDespesa = z.output<typeof novaDespesaSchema>
type DespesaAtualizada = z.output<typeof despesaAtualizadaSchema>
type FiltroDeDespesas = z.output<typeof filtroDeDespesasSchema>
type FiltroDeEstatisticas = z.output<typeof filtroDeEstatisticasSchema>

export interface RepositorioDeCaixa {
  listarCategorias(): ExpenseCategory[]
  criarCategoria(dados: NovaCategoria): { id: number }
  atualizarCategoria(dados: CategoriaAtualizada): void
  excluirCategoria(id: number): void
  listarDespesas(filtro?: FiltroDeDespesas): CashExpense[]
  criarDespesa(dados: NovaDespesa): { id: number }
  atualizarDespesa(dados: DespesaAtualizada): void
  excluirDespesa(id: number): void
  estatisticas(filtro?: FiltroDeEstatisticas): CashStats
  configuracoes(): CashSettings | undefined
  definirSaldoDeAbertura(saldo: number): void
}

export function repositorioDeCaixa({ db }: ConexaoBanco): RepositorioDeCaixa {
  return {
    listarCategorias() {
      return db.select().from(expenseCategories).orderBy(expenseCategories.name).all()
    },

    criarCategoria(dados) {
      const resultado = db.insert(expenseCategories).values({ name: dados.name }).run()
      return { id: Number(resultado.lastInsertRowid) }
    },

    atualizarCategoria(dados) {
      db.update(expenseCategories)
        .set({ name: dados.name })
        .where(eq(expenseCategories.id, dados.id))
        .run()
    },

    /**
     * Excluir categoria em uso apagaria a classificação de despesas já lançadas,
     * então a recusa vem com o texto que a tela mostra.
     */
    excluirCategoria(id) {
      const emUso = db
        .select({ total: sql<number>`COUNT(*)` })
        .from(cashExpenses)
        .where(eq(cashExpenses.categoryId, id))
        .get()
      if (emUso && emUso.total > 0) {
        throw new ErroDeNegocio(
          'Esta categoria possui despesas vinculadas. Remova as despesas antes de excluir.'
        )
      }

      db.delete(expenseCategories).where(eq(expenseCategories.id, id)).run()
    },

    listarDespesas(filtro) {
      const condicoes: SQL[] = []
      if (filtro?.startDate) condicoes.push(gte(cashExpenses.expenseDate, filtro.startDate))
      if (filtro?.endDate) condicoes.push(lte(cashExpenses.expenseDate, filtro.endDate))
      if (filtro?.categoryId) condicoes.push(eq(cashExpenses.categoryId, filtro.categoryId))

      return (
        db
          .select({
            id: cashExpenses.id,
            categoryId: cashExpenses.categoryId,
            categoryName: expenseCategories.name,
            description: cashExpenses.description,
            amount: cashExpenses.amount,
            expenseDate: cashExpenses.expenseDate,
            notes: cashExpenses.notes,
            createdAt: cashExpenses.createdAt
          })
          .from(cashExpenses)
          .innerJoin(expenseCategories, eq(cashExpenses.categoryId, expenseCategories.id))
          // Desempate pelo id, que segue a ordem de cadastro. created_at não serve: despesas
          // criadas até a v1.12.1 guardam o texto 'CURRENT_TIMESTAMP' no lugar da data.
          .orderBy(desc(cashExpenses.expenseDate), desc(cashExpenses.id))
          .where(condicoes.length ? and(...condicoes) : undefined)
          .all()
      )
    },

    criarDespesa(dados) {
      const resultado = db
        .insert(cashExpenses)
        .values({
          categoryId: dados.categoryId,
          description: dados.description,
          amount: dados.amount,
          expenseDate: dados.expenseDate,
          notes: dados.notes ?? null
        })
        .run()
      return { id: Number(resultado.lastInsertRowid) }
    },

    atualizarDespesa(dados) {
      db.update(cashExpenses)
        .set({
          categoryId: dados.categoryId,
          description: dados.description,
          amount: dados.amount,
          expenseDate: dados.expenseDate,
          notes: dados.notes ?? null
        })
        .where(eq(cashExpenses.id, dados.id))
        .run()
    },

    excluirDespesa(id) {
      db.delete(cashExpenses).where(eq(cashExpenses.id, id)).run()
    },

    /**
     * `date(...)` normaliza registros que guardam data com hora. Vendas "a receber"
     * pendentes não compõem o caixa; as recebidas depois entram na data em que o
     * dinheiro entrou (received_at), não na data da venda.
     */
    estatisticas(filtro) {
      const despesas: SQL[] = []
      if (filtro?.startDate)
        despesas.push(sql`date(${cashExpenses.expenseDate}) >= ${filtro.startDate}`)
      if (filtro?.endDate)
        despesas.push(sql`date(${cashExpenses.expenseDate}) <= ${filtro.endDate}`)

      const totalDespesas = db
        .select({ total: sql<number>`COALESCE(SUM(${cashExpenses.amount}), 0)` })
        .from(cashExpenses)
        .where(despesas.length ? and(...despesas) : undefined)
        .get()

      const dataDoCaixa = sql`date(COALESCE(${sales.receivedAt}, ${sales.soldAt}))`
      const entradas: SQL[] = [sql`${sales.paymentMethod} != 'areceber'`]
      if (filtro?.startDate) entradas.push(sql`${dataDoCaixa} >= ${filtro.startDate}`)
      if (filtro?.endDate) entradas.push(sql`${dataDoCaixa} <= ${filtro.endDate}`)

      const totalEntradas = db
        .select({ total: sql<number>`COALESCE(SUM(${sales.netAmount}), 0)` })
        .from(sales)
        .where(and(...entradas))
        .get()

      const configuracoes = db
        .select({ saldo: cashSettings.openingBalance })
        .from(cashSettings)
        .where(eq(cashSettings.id, 1))
        .get()

      return {
        totalExpenses: totalDespesas?.total ?? 0,
        totalIncome: totalEntradas?.total ?? 0,
        openingBalance: configuracoes?.saldo ?? 0
      }
    },

    configuracoes() {
      return db.select().from(cashSettings).where(eq(cashSettings.id, 1)).get()
    },

    definirSaldoDeAbertura(saldo) {
      db.update(cashSettings)
        .set({ openingBalance: saldo, updatedAt: new Date().toISOString() })
        .where(eq(cashSettings.id, 1))
        .run()
    }
  }
}
