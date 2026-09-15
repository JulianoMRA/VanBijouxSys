import { describe, expect, it } from 'vitest'
import { getTableColumns, is, SQL } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '../main/database/schema'

describe('defaults do schema', () => {
  it('should_never_declare_a_sql_function_as_a_plain_text_default', () => {
    // Com .default('CURRENT_TIMESTAMP') o Drizzle envia o texto como valor no
    // insert, e a coluna guarda a palavra em vez da data. Função SQL vai em sql``.
    const texto = /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)$/i
    const problemas: string[] = []

    for (const [nomeDaTabela, tabela] of Object.entries(schema)) {
      if (!is(tabela, SQLiteTable)) continue
      for (const [nomeDaColuna, coluna] of Object.entries(getTableColumns(tabela))) {
        const padrao = coluna.default
        if (typeof padrao === 'string' && texto.test(padrao) && !is(padrao, SQL)) {
          problemas.push(`${nomeDaTabela}.${nomeDaColuna}`)
        }
      }
    }

    expect(problemas).toEqual([])
  })
})
