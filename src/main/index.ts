import { app, BrowserWindow, Menu, MenuItem, protocol, net, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { closeDatabase } from './database'
import { getPhotosDir } from './photos'
import { ensureProfilesReady } from './profiles'

protocol.registerSchemesAsPrivileged([
  { scheme: 'waxbox-photo', privileges: { standard: true, secure: true } }
])

/**
 * Idiomas del corrector ortográfico.
 *
 * Se usa el corrector que ya trae Chromium dentro de Electron, no una librería
 * aparte: los diccionarios los baja y mantiene el propio navegador. Para sumar
 * inglés cuando traduzcamos la app basta con agregar su código aquí.
 */
const SPELLCHECK_LANGUAGES = ['es', 'en-US']

/**
 * Enciende el corrector y arma el menú del clic derecho.
 *
 * Electron no trae menú contextual propio, así que sin esto las palabras se
 * subrayarían en rojo pero no habría forma de ver las sugerencias.
 */
function configureSpellChecker(window: BrowserWindow): void {
  const session = window.webContents.session

  // En macOS el corrector es el del sistema y detecta el idioma solo.
  if (process.platform !== 'darwin') {
    const available = session.availableSpellCheckerLanguages
    const supported = SPELLCHECK_LANGUAGES.filter((lang) => available.includes(lang))
    if (supported.length > 0) session.setSpellCheckerLanguages(supported)
  }

  window.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion)
        })
      )
    }

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length === 0) {
        menu.append(new MenuItem({ label: 'Sin sugerencias', enabled: false }))
      }
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: 'Agregar al diccionario',
          click: () => session.addWordToSpellCheckerDictionary(params.misspelledWord)
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'cut', label: 'Cortar', enabled: params.editFlags.canCut }))
      menu.append(
        new MenuItem({ role: 'copy', label: 'Copiar', enabled: params.editFlags.canCopy })
      )
      menu.append(
        new MenuItem({ role: 'paste', label: 'Pegar', enabled: params.editFlags.canPaste })
      )
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'selectAll', label: 'Seleccionar todo' }))
    } else if (params.selectionText.trim()) {
      menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }))
    }

    if (menu.items.length > 0) menu.popup({ window })
  })
}

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
      sandbox: false,
      spellcheck: true
    }
  })

  configureSpellChecker(mainWindow)

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

  // La base ya no se abre acá: cada perfil tiene la suya y no sabemos cuál
  // hasta que la persona elija en el selector de perfiles.
  ensureProfilesReady()

  protocol.handle('waxbox-photo', (request) => {
    const raw = request.url.slice('waxbox-photo://'.length)
    const filename = decodeURIComponent(raw).replace(/^\/+/, '')
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new Response('Forbidden', { status: 403 })
    }

    // getPhotosDir() apunta al perfil abierto, así que una foto solo se sirve
    // mientras su perfil está activo.
    try {
      const filePath = join(getPhotosDir(), filename)
      return net.fetch(pathToFileURL(filePath).href)
    } catch {
      return new Response('Sin perfil activo', { status: 404 })
    }
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
