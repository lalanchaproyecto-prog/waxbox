interface NoResultsScreenProps {
  /** Qué se buscó, para poder repetirlo en pantalla. */
  artist: string
  title: string
  /** Explicación de qué fue lo que no se encontró. */
  message: string
  onRetry: () => void
  onManual: () => void
  onCancel: () => void
}

/**
 * Lo que se ve cuando MusicBrainz no encontró el disco.
 *
 * Antes esto era un mensaje de error con un botón "Entendido", que dejaba a la
 * persona sin salida: si su disco no está en el catálogo —una edición rara, un
 * disco autoproducido, un sello chico— no había forma de agregarlo. Por eso
 * dejó de ser un error y pasó a ser una bifurcación: volver a intentar la
 * búsqueda, o cargar el disco a mano.
 */
function NoResultsScreen({
  artist,
  title,
  message,
  onRetry,
  onManual,
  onCancel
}: NoResultsScreenProps) {
  return (
    <div className="picker no-results">
      <header className="picker-header">
        <h2>No encontramos ese disco</h2>
        <p>{message}</p>
      </header>

      <div className="no-results-query">
        <div>
          <span className="field-label">Artista</span>
          <strong>{artist || '—'}</strong>
        </div>
        <div>
          <span className="field-label">Álbum</span>
          <strong>{title || '—'}</strong>
        </div>
      </div>

      <div className="no-results-options">
        <section className="no-results-option">
          <h3 className="section-title">Puede ser la escritura</h3>
          <p>
            MusicBrainz suele tener los títulos en su idioma original. Prueba
            corrigiendo el nombre o buscando la discografía del artista.
          </p>
          <button className="btn btn-ghost" onClick={onRetry}>
            Volver a buscar
          </button>
        </section>

        <section className="no-results-option highlighted">
          <h3 className="section-title">O sencillamente no está en el catálogo</h3>
          <p>
            Pasa con las ediciones raras, los discos autoproducidos y los sellos
            pequeños. Puedes cargarlo entero a mano: tú escribes los datos y el
            tracklist, y el disco queda en tu colección como cualquier otro.
          </p>
          <button className="btn btn-primary" onClick={onManual}>
            No lo encuentro — crear manualmente
          </button>
        </section>
      </div>

      <footer className="picker-footer">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </footer>
    </div>
  )
}

export default NoResultsScreen
