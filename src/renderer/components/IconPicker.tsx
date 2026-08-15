/*
  ELEGIR EL ÍCONO DE UN PERFIL O DE UNA COLECCIÓN.

  Sustituye al selector de imágenes que había antes, que permitía subir una
  foto propia o buscar en Wikimedia Commons.

  POR QUÉ SE CAMBIÓ POR UNA LISTA DE ÍCONOS:

  Un perfil y una colección no son contenido, son etiquetas: contestan «¿de
  quién?» y «¿cuál?». Para eso hace falta distinguirlos de un vistazo en un
  menú de 24 píxeles, no tener una imagen bonita. Una foto recortada a ese
  tamaño se convierte en una mancha de color, y elegirla costaba un diálogo
  con búsqueda, descarga, atribución de licencia y manejo de fallos de red —
  todo para decorar una entrada de menú.

  Los discos SÍ conservan sus fotos de portada y contraportada, y los setlists
  su imagen: ahí la imagen es el contenido, no la etiqueta.

  Se dibuja como diálogo y va a `document.body` por portal, igual que el resto
  de los diálogos de esta parte de la app: dentro del menú lateral quedaría
  atrapado en su contexto de apilamiento.
*/

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ICONOS, iconRef, imageIcon, type ImageRef } from '@core/models/imageRef'
import { IconClose } from './Icons'

interface IconPickerProps {
  /** Qué se le está poniendo ícono, para el título del diálogo. */
  title: string
  /** Lo que tiene ahora, para marcarlo como elegido. */
  current: ImageRef | null
  /** El que se muestra cuando no hay ninguno elegido. */
  porOmision?: string
  onChange: (image: ImageRef | null) => void
  onClose: () => void
}

function IconPicker({ title, current, porOmision = '💿', onChange, onClose }: IconPickerProps) {
  const elegido = imageIcon(current) ?? porOmision

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-iconos"
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-label={`Ícono de ${title}`}
      >
        <header className="modal-header">
          <div>
            <h2>Ícono de {title}</h2>
            <p className="modal-subtitle">
              Sirve para reconocerlo de un vistazo en el menú.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            <IconClose size={18} />
          </button>
        </header>

        <div className="icono-grid" role="radiogroup" aria-label="Íconos disponibles">
          {ICONOS.map((icono) => (
            <button
              key={icono}
              type="button"
              role="radio"
              aria-checked={icono === elegido}
              aria-label={`Ícono ${icono}`}
              className={`icono-opcion${icono === elegido ? ' elegido' : ''}`}
              onClick={() => {
                onChange(iconRef(icono))
                onClose()
              }}
            >
              <span aria-hidden="true">{icono}</span>
            </button>
          ))}
        </div>

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default IconPicker
