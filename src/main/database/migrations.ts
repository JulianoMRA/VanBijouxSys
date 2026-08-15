import type Database from 'better-sqlite3'

type Sqlite = InstanceType<typeof Database>

export interface Migracao {
  versao: number
  nome: string
  aplicar: (sqlite: Sqlite) => void
}

function temColuna(sqlite: Sqlite, tabela: string, coluna: string): boolean {
  const colunas = sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>
  return colunas.some((c) => c.name === coluna)
}

/**
 * A versão 1 é a linha de base: reproduz o schema que os bancos em uso já têm.
 * Ela precisa continuar idempotente, porque roda uma vez no banco da cliente,
 * que existe desde antes de haver versionamento. Migrações novas entram como
 * 2, 3, ... e cada uma roda uma única vez.
 */
export const MIGRACOES: Migracao[] = [
  {
    versao: 1,
    nome: 'esquema-inicial',
    aplicar: (sqlite) => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category_id INTEGER NOT NULL REFERENCES categories(id),
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS product_variations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          identifier TEXT NOT NULL,
          cost_price REAL NOT NULL DEFAULT 0,
          sale_price REAL NOT NULL DEFAULT 0,
          stock_quantity INTEGER NOT NULL DEFAULT 0,
          minimum_stock INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS fairs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          organizer TEXT,
          date TEXT NOT NULL,
          enrollment_cost REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel TEXT NOT NULL,
          fair_id INTEGER REFERENCES fairs(id),
          total_amount REAL NOT NULL,
          total_cost REAL NOT NULL,
          sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          variation_id INTEGER NOT NULL REFERENCES product_variations(id),
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          unit_cost REAL NOT NULL
        );

        INSERT OR IGNORE INTO categories (name) VALUES
          ('Colar'),
          ('Pulseira'),
          ('Brinco'),
          ('Tiara'),
          ('Pingente');

        CREATE TABLE IF NOT EXISTS insumos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          cost_per_unit REAL NOT NULL DEFAULT 0,
          stock_quantity REAL NOT NULL DEFAULT 0,
          minimum_stock REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS variation_insumos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          variation_id INTEGER NOT NULL REFERENCES product_variations(id) ON DELETE CASCADE,
          insumo_id INTEGER NOT NULL REFERENCES insumos(id),
          quantity REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS fair_additional_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fair_id INTEGER NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS expense_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cash_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL REFERENCES expense_categories(id),
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          expense_date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cash_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opening_balance REAL NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO cash_settings (id, opening_balance, updated_at)
        VALUES (1, 0, CURRENT_TIMESTAMP);
      `)

      if (!temColuna(sqlite, 'fairs', 'end_date')) {
        sqlite.exec('ALTER TABLE fairs ADD COLUMN end_date TEXT')
      }
      if (!temColuna(sqlite, 'product_variations', 'labor_cost')) {
        sqlite.exec('ALTER TABLE product_variations ADD COLUMN labor_cost REAL NOT NULL DEFAULT 0')
      }
      if (!temColuna(sqlite, 'sales', 'payment_method')) {
        sqlite.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'dinheiro'")
      }
      if (!temColuna(sqlite, 'sales', 'fee_percentage')) {
        sqlite.exec('ALTER TABLE sales ADD COLUMN fee_percentage REAL NOT NULL DEFAULT 0')
      }
      if (!temColuna(sqlite, 'sales', 'fee_amount')) {
        sqlite.exec('ALTER TABLE sales ADD COLUMN fee_amount REAL NOT NULL DEFAULT 0')
      }
      if (!temColuna(sqlite, 'sales', 'net_amount')) {
        sqlite.exec('ALTER TABLE sales ADD COLUMN net_amount REAL NOT NULL DEFAULT 0')
        sqlite.exec('UPDATE sales SET net_amount = total_amount WHERE net_amount = 0')
      }
      if (!temColuna(sqlite, 'sales', 'received_at')) {
        sqlite.exec('ALTER TABLE sales ADD COLUMN received_at TEXT')
      }
    }
  },
  {
    versao: 2,
    nome: 'arquivamento-de-produtos-variacoes-e-insumos',
    /**
     * `archived_at` nulo significa ativo. Arquivar não escreve nas variações do
     * produto: quem lê deriva o estado (variação inativa = ela arquivada OU o
     * produto dela arquivado). Assim desarquivar o produto devolve exatamente o
     * estado anterior, sem ressuscitar variação que já estava arquivada sozinha.
     */
    aplicar: (sqlite) => {
      for (const tabela of ['products', 'product_variations', 'insumos']) {
        if (!temColuna(sqlite, tabela, 'archived_at')) {
          sqlite.exec(`ALTER TABLE ${tabela} ADD COLUMN archived_at TEXT`)
        }
      }
    }
  }
]

export function versaoAlvo(): number {
  return MIGRACOES.reduce((maior, m) => Math.max(maior, m.versao), 0)
}

export function versaoAtual(sqlite: Sqlite): number {
  return sqlite.pragma('user_version', { simple: true }) as number
}

export function migracoesPendentes(versao: number): Migracao[] {
  return MIGRACOES.filter((m) => m.versao > versao).sort((a, b) => a.versao - b.versao)
}

/**
 * Cada migração roda dentro da própria transação: se falhar no meio, o banco
 * volta ao estado anterior e o `user_version` não avança, então a tentativa se
 * repete no próximo boot em vez de deixar o schema pela metade.
 */
export function aplicarMigracoes(sqlite: Sqlite): number[] {
  const pendentes = migracoesPendentes(versaoAtual(sqlite))
  const aplicadas: number[] = []

  for (const migracao of pendentes) {
    const executar = sqlite.transaction(() => {
      migracao.aplicar(sqlite)
      // pragma não aceita parâmetro vinculado; a versão vem do código, não de entrada externa.
      sqlite.pragma(`user_version = ${migracao.versao}`)
    })
    executar()
    aplicadas.push(migracao.versao)
  }

  return aplicadas
}
