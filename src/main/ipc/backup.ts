import { app, dialog, shell, BrowserWindow } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { basename, join } from 'path'
import { criarBackup, getBackupDir, restaurarBackup, validarBackup } from '../database/backup'
import { verificarAtualizacoesManual } from '../updater'
import { ErroDeNegocio, handleIpc } from './handle'

export interface BackupInfo {
  pasta: string
  ultimoBackup: string | null
}

function janelaAtual(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function janelaObrigatoria(): BrowserWindow {
  const janela = janelaAtual()
  if (!janela) throw new ErroDeNegocio('Nenhuma janela ativa para abrir a caixa de diálogo.')
  return janela
}

export function registerBackupHandlers(): void {
  handleIpc('backup:exportar', async () => {
    const janela = janelaObrigatoria()
    const dataArquivo = new Date().toISOString().slice(0, 10)

    const resultado = await dialog.showSaveDialog(janela, {
      title: 'Salvar backup',
      defaultPath: `van-bijoux-backup-${dataArquivo}.db`,
      filters: [{ name: 'Banco de dados', extensions: ['db'] }]
    })
    if (resultado.canceled || !resultado.filePath) return { salvo: false }

    await criarBackup(resultado.filePath)
    return { salvo: true, caminho: resultado.filePath }
  })

  handleIpc('backup:restaurar', async () => {
    const janela = janelaObrigatoria()

    const escolha = await dialog.showOpenDialog(janela, {
      title: 'Escolher backup para restaurar',
      defaultPath: getBackupDir(),
      properties: ['openFile'],
      filters: [{ name: 'Banco de dados', extensions: ['db'] }]
    })
    if (escolha.canceled || escolha.filePaths.length === 0) return { restaurado: false }

    const origem = escolha.filePaths[0]
    const validacao = validarBackup(origem)
    if (!validacao.ok) throw new ErroDeNegocio(validacao.erro)

    const confirmacao = await dialog.showMessageBox(janela, {
      type: 'warning',
      title: 'Restaurar backup',
      message: `Restaurar "${basename(origem)}"?`,
      detail:
        'Todos os dados atuais serão substituídos pelos do backup. O estado atual será salvo numa cópia antes, e o aplicativo vai reiniciar.',
      buttons: ['Cancelar', 'Restaurar'],
      defaultId: 0,
      cancelId: 0
    })
    if (confirmacao.response !== 1) return { restaurado: false }

    await restaurarBackup(origem)
    return { restaurado: true }
  })

  handleIpc('backup:info', (): BackupInfo => {
    const pasta = getBackupDir()
    if (!existsSync(pasta)) return { pasta, ultimoBackup: null }

    const arquivos = readdirSync(pasta)
      .filter((f) => f.startsWith('vanbijouxsys-') && f.endsWith('.db'))
      .map((f) => join(pasta, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

    return {
      pasta,
      ultimoBackup:
        arquivos.length > 0 ? new Date(statSync(arquivos[0]).mtimeMs).toISOString() : null
    }
  })

  handleIpc('backup:abrirPasta', async () => {
    await shell.openPath(getBackupDir())
    return { aberto: true }
  })

  handleIpc('app:versao', () => app.getVersion())

  handleIpc('app:verificarAtualizacoes', () => verificarAtualizacoesManual())
}
