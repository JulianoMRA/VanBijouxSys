import { z } from 'zod'

/**
 * Os canais de backup e os de versão e atualização não recebem nenhum argumento:
 * tudo o que eles precisam sai de diálogo nativo ou do próprio sistema. As tuplas
 * vazias garantem isso — argumento a mais é recusado antes de abrir qualquer diálogo
 * ou tocar em arquivo.
 */
export const ARGUMENTOS_BACKUP = {
  exportar: [],
  restaurar: [],
  info: [],
  abrirPasta: []
} as const

/**
 * Erro da tela que precisa chegar ao log: o app empacotado não tem console. Os
 * limites de tamanho seguram um erro repetido de encher o `main.log`.
 */
export const erroDaTelaSchema = z.object({
  origem: z.enum(['renderizacao', 'promessa', 'excecao']),
  mensagem: z.string().max(2000),
  /** Pilha do erro e, na renderização, a pilha dos componentes. */
  detalhe: z.string().max(8000).optional()
})

export const ARGUMENTOS_APP = {
  versao: [],
  verificarAtualizacoes: [],
  registrarErroDaTela: [erroDaTelaSchema]
} as const

export type ErroDaTela = z.input<typeof erroDaTelaSchema>

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
