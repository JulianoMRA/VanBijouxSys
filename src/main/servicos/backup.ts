import { basename } from 'path'
import { ErroDeNegocio } from '../ipc/mensagens'
import type {
  BackupInfo,
  ResultadoDaExportacao,
  ResultadoDaRestauracao
} from '../../shared/ipc/backup'

/**
 * Tudo o que o backup precisa do mundo de fora: diálogos nativos, sistema de
 * arquivos e o banco. Entra por parâmetro para o fluxo poder ser testado sem
 * abrir janela nem sobrescrever o banco da máquina.
 */
export interface DependenciasDeBackup {
  /** Caminho escolhido no diálogo de salvar; `null` quando a usuária cancela. */
  perguntarOndeSalvar(nomePadrao: string): Promise<string | null>
  /** Arquivo escolhido no diálogo de abrir; `null` quando a usuária cancela. */
  perguntarQualRestaurar(pastaPadrao: string): Promise<string | null>
  /** Confirmação do aviso de substituição. `false` cancela a restauração. */
  confirmarRestauracao(nomeDoArquivo: string): Promise<boolean>
  pastaDeBackups(): string
  criarBackup(destino: string): Promise<void>
  validarBackup(caminho: string): { ok: true } | { ok: false; erro: string }
  restaurarBackup(origem: string): Promise<void>
  abrirPasta(caminho: string): Promise<void>
  /** Arquivos de backup da pasta, do mais recente para o mais antigo. */
  arquivosDeBackup(pasta: string): Array<{ caminho: string; modificadoEm: Date }>
}

export interface ServicoDeBackup {
  exportar(): Promise<ResultadoDaExportacao>
  restaurar(): Promise<ResultadoDaRestauracao>
  info(): BackupInfo
  abrirPasta(): Promise<{ aberto: true }>
}

const nomeSugerido = (hoje: Date): string =>
  `van-bijoux-backup-${hoje.toISOString().slice(0, 10)}.db`

export function servicoDeBackup(dependencias: DependenciasDeBackup): ServicoDeBackup {
  return {
    async exportar() {
      const destino = await dependencias.perguntarOndeSalvar(nomeSugerido(new Date()))
      if (!destino) return { salvo: false }

      await dependencias.criarBackup(destino)
      return { salvo: true, caminho: destino }
    },

    /**
     * Restaurar troca o banco inteiro, então tem três portas antes de escrever:
     * a escolha do arquivo, a conferência de que ele é mesmo um backup do app e
     * a confirmação do aviso. Só depois das três o banco é substituído.
     */
    async restaurar() {
      const origem = await dependencias.perguntarQualRestaurar(dependencias.pastaDeBackups())
      if (!origem) return { restaurado: false }

      const validacao = dependencias.validarBackup(origem)
      if (!validacao.ok) throw new ErroDeNegocio(validacao.erro)

      const confirmado = await dependencias.confirmarRestauracao(basename(origem))
      if (!confirmado) return { restaurado: false }

      await dependencias.restaurarBackup(origem)
      return { restaurado: true }
    },

    info() {
      const pasta = dependencias.pastaDeBackups()
      const arquivos = dependencias.arquivosDeBackup(pasta)
      return {
        pasta,
        ultimoBackup: arquivos.length > 0 ? arquivos[0].modificadoEm.toISOString() : null
      }
    },

    async abrirPasta() {
      await dependencias.abrirPasta(dependencias.pastaDeBackups())
      return { aberto: true }
    }
  }
}
