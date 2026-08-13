import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { closeDatabase, getDbPath, getSqlite } from './index'
import {
  ehArquivoDeBackup,
  nomeDeBackup,
  selecionarParaRemover,
  temBackupDoDia,
  type ArquivoBackup
} from './backup-rules'

export function getBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

function nomesDeBackup(): string[] {
  const dir = getBackupDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(ehArquivoDeBackup)
}

function listarBackups(): ArquivoBackup[] {
  const dir = getBackupDir()
  return nomesDeBackup().map((nome) => {
    const caminho = join(dir, nome)
    return { caminho, modificadoEm: statSync(caminho).mtimeMs }
  })
}

function rotacionar(): void {
  for (const antigo of selecionarParaRemover(listarBackups())) {
    rmSync(antigo.caminho, { force: true })
  }
}

/**
 * Copia o banco usando a API de backup do SQLite, que é consistente mesmo com
 * o WAL ativo e o app escrevendo — copiar o arquivo na mão não seria.
 */
export async function criarBackup(destino?: string): Promise<string> {
  const caminho = destino ?? join(getBackupDir(), nomeDeBackup(new Date()))
  mkdirSync(dirname(caminho), { recursive: true })
  await getSqlite().backup(caminho)
  if (!destino) rotacionar()
  return caminho
}

/** Um backup por dia é o suficiente para o volume de uso e mantém 10 dias de histórico. */
export async function backupDiario(): Promise<void> {
  if (temBackupDoDia(nomesDeBackup(), new Date())) return
  await criarBackup()
}

export function validarBackup(caminho: string): { ok: true } | { ok: false; erro: string } {
  let teste: InstanceType<typeof Database> | null = null
  try {
    teste = new Database(caminho, { readonly: true, fileMustExist: true })
    if (teste.pragma('integrity_check', { simple: true }) !== 'ok') {
      return { ok: false, erro: 'O arquivo está corrompido e não pode ser restaurado.' }
    }
    const tabelas = teste
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('sales', 'products', 'product_variations')`
      )
      .all()
    if (tabelas.length < 3) {
      return { ok: false, erro: 'O arquivo não é um backup do Van Bijoux Sys.' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) }
  } finally {
    teste?.close()
  }
}

/**
 * Substitui o banco em uso. Antes de sobrescrever, guarda o estado atual num
 * backup próprio — restaurar o arquivo errado não pode ser um caminho sem volta.
 * O app reinicia porque a conexão e todos os prepared statements morrem aqui.
 */
export async function restaurarBackup(origem: string): Promise<void> {
  await criarBackup()
  closeDatabase()

  const destino = getDbPath()
  copyFileSync(origem, destino)
  for (const sufixo of ['-wal', '-shm']) {
    rmSync(`${destino}${sufixo}`, { force: true })
  }

  app.relaunch()
  app.exit(0)
}
