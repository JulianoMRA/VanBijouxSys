import { app, dialog, BrowserWindow } from 'electron'
// electron-updater é CJS; o default import com destructuring é o padrão seguro.
import electronUpdater from 'electron-updater'
import log from 'electron-log/main'
import { criarBackup } from './database/backup'

const { autoUpdater } = electronUpdater

autoUpdater.logger = log

function janelaAtual(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/**
 * O instalador é aplicado ao fechar o app, sobre um banco já migrado pela versão
 * nova. Se a migração der errado não há como voltar, então a cópia sai antes.
 */
autoUpdater.on('update-downloaded', (info) => {
  criarBackup()
    .then((caminho) => log.info(`[updater] backup antes da versão ${info.version}: ${caminho}`))
    .catch((err) => log.error('[updater] backup pré-atualização falhou:', err))
})

export function iniciarAutoUpdate(): void {
  log.info(`[updater] versão ${app.getVersion()}, empacotado=${app.isPackaged}`)
  if (!app.isPackaged) return

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // Sem rede ou release indisponível não é erro fatal — o app segue normal.
    log.error('[updater] checagem automática falhou:', err)
  })
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

  try {
    const resultado = await autoUpdater.checkForUpdates()
    const novaVersao = resultado?.updateInfo.version

    if (novaVersao && novaVersao !== app.getVersion()) {
      await dialog.showMessageBox(janela, {
        type: 'info',
        title: 'Atualização disponível',
        message: `Versão ${novaVersao} disponível (atual: ${app.getVersion()}).`,
        detail:
          'O download acontece em segundo plano. A atualização é aplicada ao fechar o aplicativo, e um backup do banco é feito antes.'
      })
      return { atualizacaoDisponivel: true }
    }

    await dialog.showMessageBox(janela, {
      type: 'info',
      title: 'Atualizações',
      message: `Você já está na versão mais recente (${app.getVersion()}).`
    })
    return { atualizacaoDisponivel: false }
  } catch (err) {
    log.error('[updater] checagem manual falhou:', err)
    throw new Error(
      'Não foi possível verificar atualizações. Verifique a conexão com a internet e tente novamente.'
    )
  }
}
