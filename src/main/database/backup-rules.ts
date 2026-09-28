import { diaLocal } from '../../shared/datas'

export const PREFIXO_BACKUP = 'vanbijouxsys-'
/** RN-15: dez cópias diárias, uma por dia em que o app foi aberto. */
export const MAX_BACKUPS_DIARIOS = 10
/** RN-15: as cópias de antes de atualizar, migrar ou restaurar têm cota própria. */
export const MAX_BACKUPS_DE_EVENTO = 10

export interface ArquivoBackup {
  caminho: string
  modificadoEm: number
}

/** Por que o backup foi feito fora da cópia do dia. */
export type MotivoDoBackup =
  { tipo: 'atualizacao'; versao: string } | { tipo: 'migracao' } | { tipo: 'restauracao' }

const CARIMBO = String.raw`\d{4}-\d{2}-\d{2}-\d{6}`
const DIARIO = new RegExp(`^${PREFIXO_BACKUP}${CARIMBO}\\.db$`)
const DE_EVENTO = new RegExp(`^${PREFIXO_BACKUP}${CARIMBO}-antes-[0-9A-Za-z.-]+\\.db$`)

export function ehArquivoDeBackup(nome: string): boolean {
  return nome.startsWith(PREFIXO_BACKUP) && nome.endsWith('.db')
}

/** A cópia do dia; os backups gravados até a 1.15 têm todos esse nome. */
export function ehBackupDiario(nome: string): boolean {
  return DIARIO.test(nome)
}

/** Carimbo local (não UTC): o backup precisa bater com o dia da cliente, não com Greenwich. */
export function carimboDeBackup(data: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${diaLocal(data)}-${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`
}

function sufixoDoMotivo(motivo: MotivoDoBackup): string {
  switch (motivo.tipo) {
    case 'atualizacao':
      // A versão vem do latest.yml da release: nada fora disso entra no nome do arquivo.
      return `antes-da-${motivo.versao.replace(/[^0-9A-Za-z.-]/g, '-')}`
    case 'migracao':
      return 'antes-de-migrar'
    case 'restauracao':
      return 'antes-de-restaurar'
  }
}

/** O nome diz, para quem abre a pasta, de quando é a cópia e por que ela existe. */
export function nomeDeBackup(data: Date, motivo?: MotivoDoBackup): string {
  const base = `${PREFIXO_BACKUP}${carimboDeBackup(data)}`
  return motivo ? `${base}-${sufixoDoMotivo(motivo)}.db` : `${base}.db`
}

/** Só a cópia do dia conta: a de antes de uma atualização tem cota própria. */
export function temBackupDoDia(nomes: string[], data: Date): boolean {
  const dia = carimboDeBackup(data).slice(0, 10)
  return nomes.some((nome) => ehBackupDiario(nome) && nome.startsWith(`${PREFIXO_BACKUP}${dia}`))
}

export function temBackupAntesDaVersao(nomes: string[], versao: string): boolean {
  const final = `-${sufixoDoMotivo({ tipo: 'atualizacao', versao })}.db`
  return nomes.some((nome) => DE_EVENTO.test(nome) && nome.endsWith(final))
}

function nomeDoArquivo(arquivo: ArquivoBackup): string {
  return arquivo.caminho.split(/[\\/]/).pop() ?? arquivo.caminho
}

/**
 * Devolve os backups excedentes, do mais antigo em diante. Diários e de evento têm
 * cotas separadas: com uma só, cada checagem de atualização gravava uma cópia e
 * empurrava para fora os dias anteriores — a cliente chegou a ter dez backups de
 * um dia só. Arquivo com nome que o app não usa não entra em cota nenhuma.
 */
export function selecionarParaRemover(
  arquivos: ArquivoBackup[],
  limites = { diarios: MAX_BACKUPS_DIARIOS, deEvento: MAX_BACKUPS_DE_EVENTO }
): ArquivoBackup[] {
  const maisNovosPrimeiro = [...arquivos].sort((a, b) => b.modificadoEm - a.modificadoEm)
  const diarios = maisNovosPrimeiro.filter((a) => ehBackupDiario(nomeDoArquivo(a)))
  const deEvento = maisNovosPrimeiro.filter((a) => DE_EVENTO.test(nomeDoArquivo(a)))
  return [...diarios.slice(limites.diarios), ...deEvento.slice(limites.deEvento)]
}
