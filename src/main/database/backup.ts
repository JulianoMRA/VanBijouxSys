import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { closeDatabase, getDbPath, getSqlite } from './index'
import {
  ehArquivoDeBackup,
  nomeDeBackup,
  selecionarParaRemover,
  temBackupAntesDaVersao,
  temBackupDoDia,
  type ArquivoBackup,
  type MotivoDoBackup
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
 * Grava uma cópia na pasta de backups pela API de backup do SQLite, que é
 * consistente mesmo com o WAL ativo e o app escrevendo — copiar o arquivo na mão
 * não seria. Sem motivo é a cópia do dia; com motivo, a de antes de atualizar,
 * migrar ou restaurar, que tem cota própria na rotação (RN-15).
 */
export async function criarBackup(motivo?: MotivoDoBackup): Promise<string> {
  const caminho = join(getBackupDir(), nomeDeBackup(new Date(), motivo))
  mkdirSync(dirname(caminho), { recursive: true })
  await getSqlite().backup(caminho)
  rotacionar()
  return caminho
}

/** Cópia no caminho que a usuária escolheu, fora da pasta de backups e da rotação. */
export async function exportarBackup(destino: string): Promise<string> {
  mkdirSync(dirname(destino), { recursive: true })
  await getSqlite().backup(destino)
  return destino
}

/** RN-15: um backup por dia de uso; devolve o caminho, ou null se o do dia já existia. */
export async function backupDiario(): Promise<string | null> {
  if (temBackupDoDia(nomesDeBackup(), new Date())) return null
  return criarBackup()
}

const versoesEmBackup = new Set<string>()

/**
 * RN-15: uma cópia por versão baixada. O electron-updater avisa de novo a cada
 * checagem que encontra a atualização já baixada — no boot e a cada clique em
 * "Verificar atualizações" —, e dois avisos podem chegar quase juntos. Devolve
 * null quando a cópia daquela versão já existe.
 */
export async function backupAntesDaAtualizacao(versao: string): Promise<string | null> {
  if (versoesEmBackup.has(versao) || temBackupAntesDaVersao(nomesDeBackup(), versao)) return null
  versoesEmBackup.add(versao)
  try {
    return await criarBackup({ tipo: 'atualizacao', versao })
  } finally {
    versoesEmBackup.delete(versao)
  }
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
