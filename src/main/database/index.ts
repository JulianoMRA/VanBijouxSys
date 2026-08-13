import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import * as schema from './schema'
import { aplicarMigracoes, migracoesPendentes, versaoAtual } from './migrations'

let db: ReturnType<typeof drizzle>
let sqliteInstance: InstanceType<typeof Database>

export function getDbPath(): string {
  return join(app.getPath('userData'), 'vanbijouxsys.db')
}

/**
 * `antesDeMigrar` recebe a chance de guardar uma cópia do banco antes de o
 * schema mudar — é o único momento em que ainda dá para voltar atrás. O callback
 * entra por parâmetro para o módulo de banco não depender do de backup.
 */
export async function initDatabase(antesDeMigrar?: () => Promise<void>): Promise<void> {
  const caminho = getDbPath()
  const bancoJaExistia = existsSync(caminho)

  const sqlite = new Database(caminho)
  sqliteInstance = sqlite

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })

  const pendentes = migracoesPendentes(versaoAtual(sqlite))
  if (pendentes.length > 0) {
    // Banco recém-criado não tem o que preservar.
    if (bancoJaExistia && antesDeMigrar) await antesDeMigrar()

    const aplicadas = aplicarMigracoes(sqlite)
    console.info(`[db] migrações aplicadas: ${aplicadas.join(', ')}`)
  }
}

export function getDb(): ReturnType<typeof drizzle> {
  return db
}

export function getSqlite(): InstanceType<typeof Database> {
  return sqliteInstance
}

export function closeDatabase(): void {
  if (sqliteInstance && sqliteInstance.open) {
    sqliteInstance.close()
  }
}
