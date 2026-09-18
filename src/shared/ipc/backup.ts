/**
 * Os seis canais de backup e do aplicativo não recebem nenhum argumento: tudo o
 * que eles precisam sai de diálogo nativo ou do próprio sistema. As tuplas vazias
 * garantem isso — argumento a mais é recusado antes de abrir qualquer diálogo ou
 * tocar em arquivo.
 */
export const ARGUMENTOS_BACKUP = {
  exportar: [],
  restaurar: [],
  info: [],
  abrirPasta: []
} as const

export const ARGUMENTOS_APP = {
  versao: [],
  verificarAtualizacoes: []
} as const

export interface BackupInfo {
  pasta: string
  /** ISO do arquivo mais recente da pasta; nulo quando ainda não há nenhum. */
  ultimoBackup: string | null
}

export interface ResultadoDaExportacao {
  salvo: boolean
  caminho?: string
}

export interface ResultadoDaRestauracao {
  restaurado: boolean
}
