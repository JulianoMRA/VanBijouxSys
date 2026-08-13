export const PREFIXO_BACKUP = 'vanbijouxsys-'
export const MAX_BACKUPS = 10

export interface ArquivoBackup {
  caminho: string
  modificadoEm: number
}

export function ehArquivoDeBackup(nome: string): boolean {
  return nome.startsWith(PREFIXO_BACKUP) && nome.endsWith('.db')
}

/** Carimbo local (não UTC): o backup precisa bater com o dia da cliente, não com Greenwich. */
export function carimboDeBackup(data: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}` +
    `-${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`
  )
}

export function nomeDeBackup(data: Date): string {
  return `${PREFIXO_BACKUP}${carimboDeBackup(data)}.db`
}

export function temBackupDoDia(nomes: string[], data: Date): boolean {
  const dia = carimboDeBackup(data).slice(0, 10)
  return nomes.some((nome) => ehArquivoDeBackup(nome) && nome.startsWith(`${PREFIXO_BACKUP}${dia}`))
}

/** Devolve os backups excedentes, do mais antigo em diante, preservando os `max` mais recentes. */
export function selecionarParaRemover(
  arquivos: ArquivoBackup[],
  max = MAX_BACKUPS
): ArquivoBackup[] {
  return [...arquivos].sort((a, b) => b.modificadoEm - a.modificadoEm).slice(max)
}
