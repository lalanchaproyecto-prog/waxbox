import { useEffect, useState } from 'react'
import type { CommonsImage } from '@core/services/wikimediaCommons'
import { suggestedQuery } from '@core/services/wikimediaCommons'
import { imageSrc, imageCredit, isFromCommons, type ImageRef } from '@core/models/imageRef'

interface ImagePickerProps {
  /** Qué se le está poniendo imagen, para el título del diálogo. */
  title: string
  /** Imagen actual, si ya tenía una. */
  current: ImageRef | null
  /**
   * Dónde se guarda un archivo propio.
   * 'avatar' para perfiles — se leen sin perfil abierto; 'archivo' para el resto.
   */
  destino: 'archivo' | 'avatar'
  /**
   * Con qué arrancar la búsqueda en Commons. Suele ser el nombre de la
   * colección o el género del setlist.
   */
  sugerencia?: string
  /** Géneros, cuando los hay: buscan mejor que el nombre de un setlist. */
  generos?: string[]
  onChange: (image: ImageRef | null) => void
  onClose: () => void
}

type Pestana = 'commons' | 'archivo'

/**
 * Elegir la imagen de un perfil, una colección o un setlist.
 *
 * Dos caminos: subir un archivo propio, o buscar en Wikimedia Commons, que es
 * el archivo de imágenes libres de Wikimedia — sin cuenta, sin clave y con
 * licencias que permiten reusarlas.
 *
 * LA ATRIBUCIÓN SE MUESTRA SIEMPRE:
 * las imágenes de Commons casi todas exigen crédito al autor y mención de la
 * licencia. Aquí se ve antes de elegir y se guarda pegada a la imagen, para que
 * quien la muestre después pueda enseñarla. Sin eso, la app estaría
 * incumpliendo la licencia.
 */
function ImagePicker({
  title,
  current,
  destino,
  sugerencia = '',
  generos = [],
  onChange,
  onClose
}: ImagePickerProps) {
  const [pestana, setPestana] = useState<Pestana>('commons')
  const [consulta, setConsulta] = useState(() => suggestedQuery(sugerencia, generos))
  const [resultados, setResultados] = useState<CommonsImage[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  /** La descarga fallo y hay que decidir si se guarda igual como enlace. */
  const [falloDescarga, setFalloDescarga] = useState(false)
  const [elegida, setElegida] = useState<ImageRef | null>(current)

  // Primera búsqueda automática con la sugerencia, para que el diálogo no se
  // abra vacío pidiendo que alguien piense qué escribir.
  useEffect(() => {
    if (consulta.trim().length >= 2) buscar(consulta)
    // Solo al abrir: después la persona controla cuándo se busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function alPulsar(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [onClose])

  async function buscar(termino: string) {
    const q = termino.trim()
    if (q.length < 2) return

    setBuscando(true)
    setError(null)

    const result = await window.api.searchCommonsImages(q)

    setBuscando(false)
    setBuscado(true)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setResultados(result.data)
  }

  async function subirArchivo() {
    setError(null)
    const result = await window.api.pickImageFile(destino)

    if (!result.ok) {
      setError(result.error)
      return
    }
    // null significa que canceló el diálogo: no es un error ni un cambio.
    if (result.data) setElegida(result.data)
  }

  function elegirDeCommons(image: CommonsImage) {
    setElegida({
      kind: 'commons',
      value: image.imageUrl,
      author: image.author,
      license: image.license,
      sourceUrl: image.descriptionUrl,
      title: image.title
    })
  }

  /**
   * Guarda lo elegido, descargando antes la imagen si vino de Commons.
   *
   * La descarga ocurre AQUÍ y no al hacer clic en cada resultado: mirar diez
   * imágenes descargaría diez archivos de los que se usaría uno solo.
   */
  async function aplicar() {
    setGuardando(true)
    setError(null)
    setFalloDescarga(false)

    const preparada = await window.api.prepareImage(elegida, destino)
    setGuardando(false)

    if (!preparada.ok) {
      setError(preparada.error)
      return
    }

    /*
      Si la imagen venía de Commons y no se pudo descargar, NO se cierra el
      diálogo: se avisa y se deja decidir. Cerrarlo guardando el enlace en
      silencio dejaría a la persona con una imagen que desaparece al quedarse
      sin internet, sin haberle dicho nunca por qué.
    */
    if (elegida?.kind === 'commons' && !preparada.data.offline) {
      setFalloDescarga(true)
      return
    }

    onChange(preparada.data.image)
    onClose()
  }

  /** Guardar de todas formas, aceptando que solo se verá con conexión. */
  function guardarComoEnlace() {
    onChange(elegida)
    onClose()
  }

  const vistaPrevia = imageSrc(elegida)
  const credito = imageCredit(elegida)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal image-picker-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`Imagen de ${title}`}
      >
        <header className="modal-header">
          <div>
            <h2>Imagen de {title}</h2>
            <p className="modal-subtitle">
              Sube una foto tuya o busca una imagen libre en Wikimedia Commons.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </header>

        {/* Lo elegido, arriba, para poder compararlo con lo que había. */}
        <section className="image-picker-preview">
          <div className="image-picker-thumb">
            {vistaPrevia ? (
              <img src={vistaPrevia} alt="Imagen elegida" />
            ) : (
              <span className="image-picker-empty">Sin imagen</span>
            )}
          </div>
          <div className="image-picker-preview-info">
            {elegida ? (
              <>
                <span className="image-picker-kind">
                  {isFromCommons(elegida)
                    ? elegida.kind === 'commons'
                      ? 'De Wikimedia Commons — sin descargar'
                      : 'De Wikimedia Commons — guardada en tu computador'
                    : 'Archivo tuyo'}
                </span>
                {credito && <span className="image-picker-credit">{credito}</span>}
                <button className="btn-link" onClick={() => setElegida(null)}>
                  Quitar la imagen
                </button>
              </>
            ) : (
              <span className="image-picker-kind">
                Todavía no elegiste ninguna. Sin imagen se ve el color del tema.
              </span>
            )}
          </div>
        </section>

        <div className="image-picker-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={pestana === 'commons'}
            className={`image-picker-tab${pestana === 'commons' ? ' active' : ''}`}
            onClick={() => setPestana('commons')}
          >
            Buscar en Commons
          </button>
          <button
            role="tab"
            aria-selected={pestana === 'archivo'}
            className={`image-picker-tab${pestana === 'archivo' ? ' active' : ''}`}
            onClick={() => setPestana('archivo')}
          >
            Subir la mía
          </button>
        </div>

        {pestana === 'commons' && (
          <section className="image-picker-body">
            <form
              className="image-picker-search"
              onSubmit={(event) => {
                event.preventDefault()
                buscar(consulta)
              }}
            >
              <input
                type="text"
                value={consulta}
                onChange={(event) => setConsulta(event.target.value)}
                placeholder="Ej: tocadiscos, jazz, vinilo"
                spellCheck={false}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={buscando || consulta.trim().length < 2}
              >
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {error && <p className="feedback-error">{error}</p>}

            {!buscando && buscado && resultados.length === 0 && !error && (
              <p className="empty-note">
                No se encontraron imágenes con ese término. Prueba con una palabra más
                general, o sube una foto tuya.
              </p>
            )}

            <div className="image-picker-grid">
              {resultados.map((image) => {
                const seleccionada =
                  elegida?.kind === 'commons' && elegida.value === image.imageUrl
                return (
                  <button
                    key={image.imageUrl}
                    type="button"
                    className={`image-picker-option${seleccionada ? ' selected' : ''}`}
                    onClick={() => elegirDeCommons(image)}
                    title={image.title.replace(/^File:/, '')}
                  >
                    <img src={image.thumbUrl} alt="" loading="lazy" />
                    <span className="image-picker-option-credit">
                      {image.license ?? 'Licencia libre'}
                    </span>
                  </button>
                )
              })}
            </div>

            {resultados.length > 0 && (
              <p className="section-note">
                Imágenes de Wikimedia Commons. Al guardar se descargan a tu computador,
                así que se ven aunque estés sin conexión, y se conserva el crédito del
                autor y la licencia como exigen sus términos de uso.
              </p>
            )}
          </section>
        )}

        {pestana === 'archivo' && (
          <section className="image-picker-body">
            <p className="section-note">
              Una foto tuya desde el computador. Se copia a la carpeta de Melôfyle, así que
              puedes mover o borrar el original sin perderla.
            </p>
            <button className="btn btn-ghost" onClick={subirArchivo}>
              Elegir una imagen del computador
            </button>
            {error && <p className="feedback-error">{error}</p>}
          </section>
        )}

        {falloDescarga && (
          <p className="feedback-error">
            No se pudo descargar la imagen a tu computador. Si la guardas igual, quedará
            como enlace y solo se verá cuando tengas conexión.
          </p>
        )}

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          {falloDescarga ? (
            <>
              <button className="btn btn-ghost" onClick={aplicar}>
                Reintentar la descarga
              </button>
              <button className="btn btn-primary" onClick={guardarComoEnlace}>
                Guardar igual
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={aplicar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default ImagePicker
