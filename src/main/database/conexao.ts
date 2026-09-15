import type { getDb, getSqlite } from './index'

/**
 * A conexão que os repositórios recebem por parâmetro. Nos testes, o `sqlite` é a
 * fachada sobre o sql.js e o `db` é o Drizzle montado sobre ela.
 */
export interface ConexaoBanco {
  db: ReturnType<typeof getDb>
  sqlite: ReturnType<typeof getSqlite>
}
