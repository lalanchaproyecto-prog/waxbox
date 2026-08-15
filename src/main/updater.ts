/*
  AUTO-ACTUALIZACIÓN.

  Melôfyle se distribuye por GitHub Releases, así que la app puede mirar ahí
  si hay una versión más nueva, bajarla en segundo plano y dejarla instalada
  la próxima vez que se cierre.

  LA REGLA QUE MANDA AQUÍ: NO INTERRUMPIR.

  Una actualización nunca es más urgente que lo que la persona está haciendo.
  Si está a mitad de catalogar un disco —con la portada elegida, el estado
  anotado y sin guardar todavía— un diálogo modal que dice «reiniciar ahora»
  es una forma de perder ese trabajo. Por eso:

  - La descarga va sola, en segundo plano, sin preguntar ni avisar.
  - Cuando termina, se avisa UNA vez con un mensaje discreto dentro de la
    interfaz, no con un cuadro del sistema.
  - La instalación ocurre al cerrar la app, por su cuenta. Nadie tiene que
    decidir cuándo.

  `autoInstallOnAppQuit` es justamente eso: electron-updater deja el
  instalador preparado y lo ejecuta cuando el proceso termina.

  EN DESARROLLO NO HACE NADA. Sin firmar y sin empaquetar no hay nada que
  actualizar, y electron-updater se queja con un error que no significa nada.
*/

import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../core/models/update'

/**
 * Cada cuánto se vuelve a mirar si hay versión nueva.
 *
 * Seis horas. La app de escritorio se queda abierta días entre reinicios, así
 * que mirar solo al arrancar dejaría a quien nunca la cierra sin actualizar
 * nunca. Y más seguido que esto sería gastar la cuota de la API de GitHub
 * para nada: no se publica una versión cada hora.
 */
const CADA_SEIS_HORAS = 6 * 60 * 60 * 1000

function avisarALaVentana(estado: UpdateState): void {
  for (const ventana of BrowserWindow.getAllWindows()) {
    if (!ventana.isDestroyed()) {
      ventana.webContents.send('actualizacion:estado', estado)
    }
  }
}

export function iniciarActualizaciones(): void {
  /*
    En desarrollo se sale de inmediato.

    `app.isPackaged` es false mientras se trabaja con `npm run dev`. Sin esta
    salida, electron-updater busca un `app-update.yml` que solo existe dentro
    del instalador y llena la consola de errores en cada arranque.
  */
  if (!app.isPackaged) return

  /*
    QUIÉN RECIBE BETAS, Y POR QUÉ LO DECIDE LA VERSIÓN QUE ESTÁ CORRIENDO.

    Con el proveedor de GitHub, electron-builder NO reparte por canales: genera
    un único `latest.yml` y espera que la separación la haga la marca de
    pre-release de la propia release. Lo dice en su código: «for GitHub should
    be pre-release way be used». Así que no hay `beta.yml` que valga — lo que
    manda es esta opción.

    Y por defecto está en `false`, que con una beta publicada como pre-release
    significa exactamente esto: el cliente pide `/releases/latest`, GitHub
    excluye de ahí las pre-releases por definición, y no encuentra nada. La
    beta no recibiría NINGUNA actualización, en silencio y para siempre.

    En `true`, el cliente mira la lista completa y elige por canal:

      - corriendo 0.9.0-beta.1 → acepta betas más nuevas Y la 1.0 estable
        cuando salga, así que nadie se queda encallado en la beta;
      - corriendo 1.0.0 (sin sufijo) → ojo, aceptaría la primera entrada de la
        lista aunque sea una beta.

    De ahí que no se ponga fijo. Se saca de si la versión que está corriendo
    ahora mismo lleva sufijo de preversión: quien instaló una beta quiere
    betas, y quien instaló una estable no. El día que salga la 1.0 esto se
    apaga solo, sin que nadie tenga que acordarse.
  */
  const estoyEnUnaBeta = (autoUpdater.currentVersion?.prerelease?.length ?? 0) > 0
  autoUpdater.allowPrerelease = estoyEnUnaBeta

  // Bajar sí, instalar a la fuerza no.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('download-progress', (progreso) => {
    avisarALaVentana({
      estado: 'descargando',
      version: autoUpdater.currentVersion?.version ?? '',
      progreso: Math.round(progreso.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    avisarALaVentana({ estado: 'lista', version: info.version })
  })

  /*
    Los fallos se anotan y se olvidan.

    Que no haya internet, que GitHub esté caído o que la persona esté detrás
    de un proxy corporativo son situaciones normales, y ninguna es asunto de
    quien solo quiere catalogar sus discos. Se reintenta a las seis horas.
  */
  autoUpdater.on('error', (error) => {
    console.warn('[actualizador] no se pudo comprobar:', error?.message ?? error)
  })

  const comprobar = (): void => {
    autoUpdater.checkForUpdates().catch(() => {
      // Ya se registra en el manejador de 'error'. Este catch existe para que
      // la promesa no quede sin capturar y tumbe el proceso principal.
    })
  }

  comprobar()
  const reloj = setInterval(comprobar, CADA_SEIS_HORAS)

  // Sin esto, el temporizador mantiene vivo el proceso al cerrar la ventana.
  app.on('before-quit', () => clearInterval(reloj))
}
