import initSqlJs, { type Database, type SqlValue } from 'sql.js'

/**
 * As migrações rodam sobre better-sqlite3, que é binário nativo compilado para
 * o Electron e não carrega dentro do vitest. Este adaptador expõe, sobre o
 * sql.js, o pedaço da API que as migrações usam — assim o teste exercita o
 * código real que toca o banco da cliente, em vez de uma cópia do SQL dele.
 */
export interface MigrationSqlite {
  exec(sql: string): void
  prepare(sql: string): { all(): unknown[] }
  pragma(source: string, options?: { simple?: boolean }): unknown
  transaction<T extends (...args: never[]) => unknown>(fn: T): T
}

export function asMigrationTarget(db: Database): MigrationSqlite {
  return {
    exec: (sql) => db.run(sql),
    prepare: (sql) => ({ all: () => queryAll(db, sql) }),
    pragma: (source, options) => {
      if (source.includes('=')) {
        db.run(`PRAGMA ${source}`)
        return undefined
      }
      const valor = db.exec(`PRAGMA ${source}`)[0]?.values?.[0]?.[0] ?? 0
      return options?.simple ? valor : [{ [source]: valor }]
    },
    transaction: ((fn: (...args: never[]) => unknown) =>
      ((...args: never[]) => {
        db.run('BEGIN')
        try {
          const resultado = fn(...args)
          db.run('COMMIT')
          return resultado
        } catch (err) {
          db.run('ROLLBACK')
          throw err
        }
      }) as never) as MigrationSqlite['transaction']
  }
}

/** Banco cru, sem nenhuma tabela — ponto de partida de um banco novo. */
export async function createEmptyDb(): Promise<Database> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  return db
}

/** Executa SELECT e retorna array de objetos tipados */
export function queryAll<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

/** Executa SELECT e retorna o primeiro resultado */
export function queryOne<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
): T | undefined {
  return queryAll<T>(db, sql, params)[0]
}
