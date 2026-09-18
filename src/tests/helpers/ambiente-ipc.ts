import type { Database } from 'sql.js'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../main/database/schema'
import { aplicarMigracoes } from '../../main/database/migrations'
import { asMigrationTarget, createEmptyDb } from './testDb'
import { criarSqliteFalso } from './sqlite-falso'
import type { RegistroDeCanais } from '../../main/ipc/canal'
import type { ConexaoBanco } from '../../main/database/conexao'

type Handler = (...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const conexao: { db: unknown; sqlite: unknown } = { db: null, sqlite: null }

/**
 * Substitutos de `electron` e de `main/database` para os testes que chamam os
 * handlers reais. Cada arquivo de teste precisa declarar, no topo:
 *
 *   vi.mock('electron', async () => (await import('../helpers/ambiente-ipc')).electronFalso)
 *   vi.mock('../../main/database', async () => (await import('../helpers/ambiente-ipc')).bancoFalso)
 *
 * O `vi.mock` só é içado dentro do próprio arquivo de teste, por isso não mora aqui.
 */
export const electronFalso = {
  ipcMain: { handle: (canal: string, fn: Handler) => handlers.set(canal, fn) },
  dialog: { showSaveDialog: async () => ({ canceled: true }) },
  app: { getPath: () => '' }
}

export const bancoFalso = {
  getDb: () => conexao.db,
  getSqlite: () => conexao.sqlite
}

export interface AmbienteIpc {
  banco: Database
  chamar: <T = unknown>(canal: string, ...args: unknown[]) => Promise<T>
  /** Nomes de todos os canais registrados até agora. */
  canais: () => string[]
}

/**
 * Banco novo com as migrações reais e os handlers registrados. Ficam de fora só
 * os de backup, que abrem diálogo nativo e reiniciam o app.
 */
export interface OpcoesDoAmbiente {
  /** Caminho que o diálogo de salvar devolve; `null` simula a usuária cancelando. */
  caminhoParaSalvar?: string | null
}

export async function prepararAmbienteIpc(opcoes: OpcoesDoAmbiente = {}): Promise<AmbienteIpc> {
  const banco = await createEmptyDb()
  aplicarMigracoes(asMigrationTarget(banco) as never)

  const sqlite = criarSqliteFalso(banco)
  conexao.sqlite = sqlite
  conexao.db = drizzle(sqlite as never, { schema })

  handlers.clear()
  const [
    { registerProductHandlers },
    { registerSaleHandlers },
    { registerInsumoHandlers },
    { registerFairHandlers },
    { registerDashboardHandlers },
    { registerCashHandlers }
  ] = await Promise.all([
    import('../../main/ipc/products'),
    import('../../main/ipc/sales'),
    import('../../main/ipc/insumos'),
    import('../../main/ipc/fairs'),
    import('../../main/ipc/dashboard'),
    import('../../main/ipc/cash')
  ])
  registerSaleHandlers()
  // Domínios da fronteira validada: ipc, banco e diálogo entram por parâmetro.
  const ipc: RegistroDeCanais = { handle: (canal, fn) => handlers.set(canal, fn as Handler) }
  const conexaoInjetada = conexao as unknown as ConexaoBanco
  registerProductHandlers(ipc, conexaoInjetada)
  registerInsumoHandlers(ipc, conexaoInjetada, {
    escolherOndeSalvar: async () => opcoes.caminhoParaSalvar ?? null
  })
  registerFairHandlers()
  registerDashboardHandlers()
  registerCashHandlers()

  async function chamar<T = unknown>(canal: string, ...args: unknown[]): Promise<T> {
    const handler = handlers.get(canal)
    if (!handler) throw new Error(`canal IPC não registrado: ${canal}`)
    return (await handler({}, ...args)) as T
  }

  return { banco, chamar, canais: () => [...handlers.keys()] }
}
