import { app, dialog, BrowserWindow } from 'electron'
// electron-updater é CJS; o default import com destructuring é o padrão seguro.
import electronUpdater from 'electron-updater'
import log from 'electron-log/main'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { backupAntesDaAtualizacao } from './database/backup'
import { servicoDeAtualizacao } from './servicos/atualizacao'

const { autoUpdater } = electronUpdater

autoUpdater.logger = log
// Instalar ao fechar deixava o instalador sozinho, sem ninguém olhando: na cliente o
// notebook suspendia logo depois e a instalação morria no meio. A decisão agora é
// dela, com o app aberto (src/main/servicos/atualizacao.ts).
autoUpdater.autoInstallOnAppQuit = false
// Só o instalador completo é publicado; sem isto o electron-updater avisa a cada download.
autoUpdater.disableWebInstaller = true

function janelaAtual(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/** O diálogo precisa de dona visível; no boot, a janela ainda pode estar carregando. */
async function janelaVisivel(): Promise<BrowserWindow | undefined> {
  const janela = janelaAtual()
  if (!janela || janela.isDestroyed()) return undefined
  if (!janela.isVisible()) {
    await new Promise<void>((pronto) => {
      const limite = setTimeout(pronto, 30_000)
      janela.once('show', () => {
        clearTimeout(limite)
        pronto()
      })
    })
  }
  return janela.isDestroyed() || !janela.isVisible() ? undefined : janela
}

const caminhoDoRegistro = (): string =>
  join(app.getPath('userData'), 'atualizacao-em-andamento.json')

const servico = servicoDeAtualizacao({
  versaoAtual: () => app.getVersion(),
  async checar() {
    const resultado = await autoUpdater.checkForUpdates()
    return {
      disponivel: resultado?.isUpdateAvailable ?? false,
      versao: resultado?.updateInfo.version ?? app.getVersion(),
      download: resultado?.downloadPromise ?? null
    }
  },
  // Com a janela do instalador (não silencioso): na máquina lenta da cliente, ver o
  // progresso é o que a faz esperar antes de suspender. Ao terminar, o app reabre.
  instalar: () => autoUpdater.quitAndInstall(false, true),
  backupAntesDaVersao: backupAntesDaAtualizacao,
  async perguntar({ titulo, mensagem, detalhe, botoes }) {
    const janela = await janelaVisivel()
    if (!janela) return null
    const { response } = await dialog.showMessageBox(janela, {
      type: 'info',
      title: titulo,
      message: mensagem,
      detail: detalhe,
      buttons: botoes,
      defaultId: 0,
      cancelId: 1
    })
    return response
  },
  async avisar({ titulo, mensagem, detalhe }) {
    const janela = janelaAtual()
    if (!janela) return
    await dialog.showMessageBox(janela, {
      type: 'info',
      title: titulo,
      message: mensagem,
      detail: detalhe
    })
  },
  registroDaInstalacao: {
    ler: () => (existsSync(caminhoDoRegistro()) ? readFileSync(caminhoDoRegistro(), 'utf8') : null),
    gravar: (texto) => writeFileSync(caminhoDoRegistro(), texto),
    apagar: () => rmSync(caminhoDoRegistro(), { force: true })
  },
  log,
  agora: () => new Date(),
  esperar: (ms) => new Promise((pronto) => setTimeout(pronto, ms))
})

autoUpdater.on('update-downloaded', (info) => {
  servico
    .atualizacaoBaixada(info.version)
    .catch((err) => log.error('[updater] convite de instalação falhou:', err))
})

export function iniciarAutoUpdate(): void {
  log.info(`[updater] versão ${app.getVersion()}, empacotado=${app.isPackaged}`)
  if (!app.isPackaged) return

  servico.iniciar().catch((err) => log.error('[updater] checagem automática falhou:', err))
}

export async function verificarAtualizacoesManual(): Promise<{ atualizacaoDisponivel: boolean }> {
  const janela = janelaAtual()
  if (!janela) return { atualizacaoDisponivel: false }

  if (!app.isPackaged) {
    await dialog.showMessageBox(janela, {
      type: 'info',
      title: 'Atualizações',
      message: 'Checagem de atualização indisponível em modo de desenvolvimento.'
    })
    return { atualizacaoDisponivel: false }
  }

  return servico.verificarAgora()
}
