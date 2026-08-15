/*
  EL AVISO DE ACTUALIZACIÓN.

  Aparece abajo a la izquierda cuando hay una versión nueva ya descargada, y
  dice lo único que hay que saber: está lista y se instalará al cerrar.

  NO HAY BOTÓN DE «REINICIAR AHORA», Y ES A PROPÓSITO.

  Ese botón parece una cortesía y es una trampa: se pulsa sin pensar, y si
  estabas a mitad de catalogar un disco —con la portada elegida, el estado
  anotado, sin guardar— acabas de perderlo. La actualización ya está en el
  disco; puede esperar a que cierres la app cuando tú quieras. No hay ninguna
  urgencia real que justifique arriesgar el trabajo de alguien.

  Se puede descartar, y entonces no vuelve en toda la sesión. Al reiniciar,
  la actualización ya estará instalada, así que tampoco hay nada que repetir.

  Durante la descarga no se muestra nada. Bajar unos megas en segundo plano
  no es asunto de quien está catalogando, y una barra de progreso que aparece
  sola solo sirve para distraer de lo que se estaba haciendo.
*/

import { useEffect, useState } from 'react'
import type { UpdateState } from '@core/models/update'
import { IconClose } from './Icons'

function UpdateNotice() {
  const [version, setVersion] = useState<string | null>(null)
  const [descartado, setDescartado] = useState(false)

  useEffect(() => {
    /*
      El puente puede no tener este método todavía.

      Pasa en una ventana que quedó abierta desde antes del cambio: el
      renderer se recarga solo al guardar, pero el proceso principal no. Sin
      esta comprobación, la app entera se cae al arrancar por un aviso de
      actualización, que es un intercambio pésimo.
    */
    if (typeof window.api.onUpdateState !== 'function') return

    return window.api.onUpdateState((estado: UpdateState) => {
      if (estado.estado === 'lista') setVersion(estado.version)
    })
  }, [])

  if (!version || descartado) return null

  return (
    <div className="update-notice" role="status">
      <div className="update-notice-texto">
        <span className="overline">Actualización lista</span>
        <p>
          La versión <span className="numeric">{version}</span> ya está descargada. Se
          instalará sola la próxima vez que cierres Melôfyle.
        </p>
      </div>
      <button
        className="icon-btn"
        onClick={() => setDescartado(true)}
        title="Descartar el aviso"
        aria-label="Descartar el aviso de actualización"
      >
        <IconClose size={16} />
      </button>
    </div>
  )
}

export default UpdateNotice
