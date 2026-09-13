import type { Database } from 'sql.js'

type Parametro = string | number | null | Uint8Array

interface ResultadoDeEscrita {
  changes: number
  lastInsertRowid: number
}

export interface SqliteFalso {
  prepare(sql: string): {
    run(...params: unknown[]): ResultadoDeEscrita
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    raw(): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown }
  }
  transaction<T extends (...args: never[]) => unknown>(fn: T): T
}

function normalizar(params: unknown[]): Parametro[] {
  return params.flat().map((p) => {
    if (typeof p === 'boolean') return p ? 1 : 0
    if (typeof p === 'bigint') return Number(p)
    if (p === undefined) return null
    return p as Parametro
  })
}

/**
 * O pedaço da API do better-sqlite3 que os handlers e o driver do Drizzle usam,
 * sobre o sql.js. O better-sqlite3 é compilado para o Electron e não carrega no
 * vitest; sem esta fachada o teste precisaria copiar o SQL do handler, e a cópia
 * não protege o código que roda na máquina da cliente.
 */
export function criarSqliteFalso(banco: Database): SqliteFalso {
  function linhas(sql: string, params: unknown[], modo: 'objeto' | 'lista'): unknown[] {
    const stmt = banco.prepare(sql)
    try {
      stmt.bind(normalizar(params))
      const saida: unknown[] = []
      while (stmt.step()) saida.push(modo === 'objeto' ? stmt.getAsObject() : stmt.get())
      return saida
    } finally {
      stmt.free()
    }
  }

  return {
    prepare: (sql) => ({
      run: (...params) => {
        const stmt = banco.prepare(sql)
        try {
          stmt.run(normalizar(params))
        } finally {
          stmt.free()
        }
        const changes = banco.getRowsModified()
        const lastInsertRowid = banco.exec('SELECT last_insert_rowid()')[0].values[0][0] as number
        return { changes, lastInsertRowid }
      },
      all: (...params) => linhas(sql, params, 'objeto'),
      get: (...params) => linhas(sql, params, 'objeto')[0],
      raw: () => ({
        all: (...params) => linhas(sql, params, 'lista'),
        get: (...params) => linhas(sql, params, 'lista')[0]
      })
    }),
    transaction: <T extends (...args: never[]) => unknown>(fn: T): T =>
      ((...args: never[]) => {
        banco.run('BEGIN')
        try {
          const resultado = fn(...args)
          banco.run('COMMIT')
          return resultado
        } catch (err) {
          banco.run('ROLLBACK')
          throw err
        }
      }) as T
  }
}
