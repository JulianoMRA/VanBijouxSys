import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { closeDatabase, getDb, getSqlite, initDatabase } from './database'
import { backupDiario, criarBackup } from './database/backup'
import { criarEncerramento } from './encerramento'
import { registerAllHandlers } from './ipc'
import { ehNavegacaoInterna, urlExternaPermitida } from './navegacao'
import { definirRegistro, registro } from './registro'
import { iniciarAutoUpdate } from './updater'

// Sem `productName` no package.json, `npm run dev` abre a mesma pasta de dados do
// app instalado. VANBIJOUX_USER_DATA aponta para uma base isolada, para testar sem
// tocar no banco de verdade. Precisa vir antes do lock de instância única, que é
// por pasta de dados, e antes da primeira escrita de log, que mora dentro dela.
const pastaDeDadosIsolada = process.env['VANBIJOUX_USER_DATA']
if (pastaDeDadosIsolada) {
  app.setPath('userData', resolve(pastaDeDadosIsolada))
}

// O app empacotado não tem console: sem o arquivo, falha de backup, de migração ou
// de handler só existiria na tela, e muitas vezes nem nela.
log.transports.file.level = 'info'
definirRegistro(log)

// Registrado antes do boot para cobrir também as falhas dele. Sem isso, um banco
// que não abre deixava o processo vivo e sem janela, e o atalho parecia não fazer nada.
const encerramento = criarEncerramento({
  registrar: (mensagem, erro) => registro.error(mensagem, erro),
  mostrarErro: (titulo, conteudo) => dialog.showErrorBox(titulo, conteudo),
  fecharBanco: closeDatabase,
  sair: (codigo) => app.exit(codigo),
  caminhoDoLog: () => log.transports.file.getFile().path
})

process.on('uncaughtException', (erro) => {
  encerramento.falhaFatal('Aconteceu um erro inesperado.', erro)
})
process.on('unhandledRejection', (motivo) => {
  encerramento.rejeicaoSemTratamento(motivo)
})
app.on('before-quit', () => encerramento.marcarSaidaNormal())

function abrirNoNavegador(rawUrl: string): void {
  const url = urlExternaPermitida(rawUrl)
  if (url) shell.openExternal(url)
  else registro.warn('[janela] URL externa recusada:', rawUrl)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    abrirNoNavegador(details.url)
    return { action: 'deny' }
  })

  // Só o fragmento pode mudar dentro da janela; qualquer outro destino é cancelado
  // e, se for http(s), vai para o navegador do sistema.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (ehNavegacaoInterna(mainWindow.webContents.getURL(), url)) return
    event.preventDefault()
    abrirNoNavegador(url)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function focarJanelaExistente(): void {
  const janela = BrowserWindow.getAllWindows()[0]
  if (!janela) return
  if (janela.isMinimized()) janela.restore()
  janela.focus()
}

async function iniciar(): Promise<void> {
  electronApp.setAppUserModelId('com.vanbijouxsys')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase(async () => {
    const caminho = await criarBackup()
    registro.info(`[db] backup antes de migrar: ${caminho}`)
  })

  registerAllHandlers({
    ipc: ipcMain,
    banco: { db: getDb(), sqlite: getSqlite() },
    dialogoDeArquivo: {
      async escolherOndeSalvar(nomePadrao, filtros) {
        const escolha = await dialog.showSaveDialog({ defaultPath: nomePadrao, filters: filtros })
        return escolha.canceled || !escolha.filePath ? null : escolha.filePath
      }
    }
  })
  createWindow()

  // Falha de backup não pode impedir a cliente de trabalhar — apenas registra.
  backupDiario().catch((err) => {
    registro.error('[backup] backup diário falhou:', err)
  })

  iniciarAutoUpdate()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

// Uma segunda instância abriria outra conexão com o mesmo banco. Restaurar um
// backup numa delas sobrescreve o arquivo e apaga o WAL com a outra ainda
// escrevendo, e cada janela passaria a mostrar estoque sem ver as vendas da outra.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focarJanelaExistente)

  app
    .whenReady()
    .then(iniciar)
    .catch((erro) => encerramento.falhaFatal('Não foi possível iniciar o aplicativo.', erro))

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
