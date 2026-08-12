import { app, BrowserWindow, protocol, net, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { openDatabase, closeDatabase } from './database'
import { getPhotosDir } from './photos'

protocol.registerSchemesAsPrivileged([
  { scheme: 'waxbox-photo', privileges: { standard: true, secure: true } }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Waxbox',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
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

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.waxbox.app')

  await openDatabase()

  protocol.handle('waxbox-photo', (request) => {
    const raw = request.url.slice('waxbox-photo://'.length)
    const filename = decodeURIComponent(raw).replace(/^\/+/, '')
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new Response('Forbidden', { status: 403 })
    }
    const filePath = join(getPhotosDir(), filename)
    return net.fetch(pathToFileURL(filePath).href)
  })

  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})
