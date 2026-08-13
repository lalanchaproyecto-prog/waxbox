import { useEffect, useState } from 'react'
import type { GenrePreview } from '@core/database/db'

interface GenerateSetlistDialogProps {
  /** Géneros que realmente existen en la colección. */
  genres: string[]
  collectionId: number
  onCreated: (setlistId: number) => void
  onClose: () => void
}

/**
 * Arma un setlist a partir de los géneros que elija la persona.
 *
 * OJO CON EL DATO: el género está guardado por álbum, no por canción, así que
 * entran todas las canciones de los discos que coincidan. No hay forma de
 * distinguir la balada dentro de un disco de rock; se avisa en la pantalla para
 * que nadie se lleve una sorpresa.
 *
 * El conteo se muestra en vivo mientras se marcan géneros: es mejor que la
 * persona vea "3 canciones" antes de crear nada, y no después.
 */
function GenerateSetlistDialog({
  genres,
  collectionId,
  onCreated,
  onClose
}: GenerateSetlistDialogProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [limitText, setLimitText] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [preview, setPreview] = useState<GenrePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = (() => {
    const parsed = Number.parseInt(limitText, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  })()

  const willInclude = preview
    ? limit === null
      ? preview.totalCandidates
      : Math.min(limit, preview.totalCandidates)
    : 0

  // Conteo en vivo cada vez que cambian los géneros marcados.
  useEffect(() => {
    let cancelled = false

    if (selected.length === 0) {
      setPreview(null)
      return
    }

    window.api.previewGenreSelection(collectionId, selected).then((result) => {
      if (cancelled) return
      if (result.ok) setPreview(result.data)
      else setError(result.error)
    })

    return () => {
      cancelled = true
    }
  }, [selected, collectionId])

  // El nombre se sugiere solo, hasta que la persona lo escriba a mano.
  useEffect(() => {
    if (nameTouched) return
    if (selected.length === 0) {
      setName('')
      return
    }
    const label = selected.join(' + ')
    setName(willInclude > 0 ? `Setlist ${label} — ${willInclude} canciones` : `Setlist ${label}`)
  }, [selected, willInclude, nameTouched])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [busy, onClose])

  function toggleGenre(genre: string) {
    setSelected((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    )
  }

  async function handleGenerate() {
    setBusy(true)
    setError(null)

    const result = await window.api.generateSetlist(collectionId, name, selected, limit)
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    onCreated(result.data.id)
  }

  function previewMessage(): { text: string; tone: 'none' | 'few' | 'ok' } {
    if (selected.length === 0) {
      return { text: 'Marca al menos un género para ver cuántas canciones hay.', tone: 'none' }
    }
    if (!preview) return { text: 'Contando...', tone: 'none' }

    if (preview.totalCandidates === 0) {
      return { text: 'No hay canciones con esa combinación de géneros.', tone: 'none' }
    }

    const discos =
      preview.albumCount === 1 ? '1 disco' : `${preview.albumCount} discos`
    const base = `${preview.totalCandidates} ${
      preview.totalCandidates === 1 ? 'canción' : 'canciones'
    } en ${discos}`

    if (preview.totalCandidates <= 3) {
      return { text: `Solo encontramos ${base}.`, tone: 'few' }
    }
    if (limit !== null && limit < preview.totalCandidates) {
      return { text: `${base}. Se van a tomar ${willInclude}, repartidas entre los discos.`, tone: 'ok' }
    }
    return { text: `${base}. Entran todas.`, tone: 'ok' }
  }

  const message = previewMessage()
  const canGenerate = !busy && willInclude > 0 && name.trim().length > 0

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="modal generate-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Generar setlist automático"
      >
        <header className="modal-header">
          <div>
            <h2>Generar setlist automático</h2>
            <p className="modal-subtitle">
              Elige uno o varios géneros y armamos la lista con canciones de tu colección.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy} title="Cerrar">
            ✕
          </button>
        </header>

        {genres.length === 0 ? (
          <p className="empty-note">
            Ninguno de tus discos tiene género registrado todavía, así que no hay de dónde
            armar la lista.
          </p>
        ) : (
          <>
            <section className="generate-section">
              <h3 className="section-title">Géneros de tu colección</h3>
              <div className="genre-chips">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    role="checkbox"
                    aria-checked={selected.includes(genre)}
                    className={`genre-chip${selected.includes(genre) ? ' selected' : ''}`}
                    onClick={() => toggleGenre(genre)}
                    disabled={busy}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              <p className={`generate-preview tone-${message.tone}`}>{message.text}</p>
              <p className="generate-caveat">
                El género está registrado por disco, no por canción, así que entran todas
                las canciones de los discos que coincidan.
              </p>
            </section>

            <section className="generate-section">
              <h3 className="section-title">Cuántas canciones</h3>
              <div className="generate-limit">
                <input
                  type="number"
                  min={1}
                  value={limitText}
                  onChange={(event) => setLimitText(event.target.value)}
                  placeholder="todas"
                  disabled={busy}
                />
                <span className="generate-limit-hint">
                  Déjalo vacío para incluir todas las que coincidan.
                </span>
              </div>
            </section>

            <section className="generate-section">
              <h3 className="section-title">Nombre</h3>
              <input
                className="generate-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameTouched(true)
                }}
                placeholder="Ej: Fiesta años 80"
                disabled={busy}
                spellCheck
              />
            </section>
          </>
        )}

        {error && <p className="feedback-error">{error}</p>}

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!canGenerate}>
            {busy ? 'Generando...' : `Generar${willInclude > 0 ? ` (${willInclude})` : ''}`}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default GenerateSetlistDialog
