import { app, shell, BrowserWindow } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { initDatabase } from './database'
import { backupDiario, criarBackup } from './database/backup'
import { registerAllHandlers } from './ipc'
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
    shell.openExternal(details.url)
    return { action: 'deny' }
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

  registerAllHandlers()
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

  app.whenReady().then(iniciar)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
