import { app, BrowserWindow, Menu, MenuItem, protocol, net, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { closeDatabase, getDatabase } from './database'
import { trackFilePath } from '../core/database/db'
import { getPhotosDir, getAvatarsDir } from './photos'
import { ensureProfilesReady } from './profiles'
import { iniciarActualizaciones } from './updater'

protocol.registerSchemesAsPrivileged([
  { scheme: 'waxbox-photo', privileges: { standard: true, secure: true } },
  /* Imágenes de perfil: se leen sin perfil abierto, para el selector. */
  { scheme: 'waxbox-avatar', privileges: { standard: true, secure: true } },
  /*
    `stream: true` es lo que permite adelantar y retroceder dentro de una
    canción: sin eso el archivo se sirve entero de una vez y la barra de
    progreso no puede saltar a un punto cualquiera.
  */
  {
    scheme: 'waxbox-audio',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
  }
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

/*
  El icono de la ventana.

  En la app instalada lo pone electron-builder desde `resources/icon.png`, pero
  en desarrollo nadie lo hace y la ventana sale con el icono genérico de
  Electron. Esto lo carga a mano cuando existe: así la barra de tareas muestra
  la marca también mientras se trabaja.

  El `resources/` del proyecto no se empaqueta dentro de `out/`, así que la
  ruta se calcula desde la raíz y solo se usa si el archivo está ahí.
*/
function iconoDeLaVentana(): string | undefined {
  const ruta = join(__dirname, '../../resources/icon.png')
  return existsSync(ruta) ? ruta : undefined
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Melôfyle',
    icon: iconoDeLaVentana(),
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
  electronApp.setAppUserModelId('com.melofyle.app')

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

  /*
    Sirve una imagen de perfil.

    A diferencia de waxbox-photo, esta no depende de que haya un perfil abierto:
    el selector de perfiles necesita dibujar los avatares justo antes de que se
    elija ninguno.
  */
  protocol.handle('waxbox-avatar', (request) => {
    const raw = request.url.slice('waxbox-avatar://'.length)
    const filename = decodeURIComponent(raw).replace(/^\/+/, '')
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(join(getAvatarsDir(), filename)).href)
  })

  /*
    Sirve el audio propio de una canción.

    LA DIRECCIÓN LLEVA EL ID DE LA CANCIÓN, NO LA RUTA DEL ARCHIVO.
    Es deliberado: si la ventana pudiera pedir "waxbox-audio://C:/lo/que/sea",
    cualquier código que llegue a correr ahí podría leer cualquier archivo del
    computador. Con el id, el proceso principal busca la ruta en su propia base
    de datos, así que lo único que se puede servir es un archivo que la persona
    asoció a mano a una canción suya.
  */
  protocol.handle('waxbox-audio', (request) => {
    const match = /^waxbox-audio:\/\/track\/(\d+)/.exec(request.url)
    if (!match) return new Response('Petición inválida', { status: 400 })

    const trackId = Number.parseInt(match[1], 10)

    let filePath: string | null = null
    try {
      filePath = trackFilePath(getDatabase(), trackId)
    } catch {
      // Sin perfil abierto no hay base que consultar.
      return new Response('Sin perfil activo', { status: 404 })
    }

    if (!filePath) return new Response('Esa canción no tiene archivo propio', { status: 404 })
    if (!existsSync(filePath)) {
      return new Response('El archivo ya no está en esa carpeta', { status: 410 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })

  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  /*
    Después de crear la ventana, no antes: si hay una actualización ya
    descargada de la sesión anterior, el aviso necesita una ventana a la que
    llegar. Comprobar primero dispararía el evento en el vacío.
  */
  iniciarActualizaciones()

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
