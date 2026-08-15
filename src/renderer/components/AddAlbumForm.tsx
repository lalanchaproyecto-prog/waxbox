import { useCallback, useEffect, useRef, useState } from 'react'
import { PHYSICAL_FORMATS, type PhysicalFormatId } from '@core/models/formats'
import type { ArtistSuggestion, AlbumSuggestion } from '@core/services/musicbrainz'
import PhotoPicker from './PhotoPicker'
import PageHeader from './PageHeader'
import FlowSteps from './FlowSteps'

/**
 * Los dos caminos para agregar un disco.
 *
 * Se declaran aquí, junto al primer paso que comparten, para que las cuatro
 * pantallas del flujo digan lo mismo. Si cada una llevara su propia copia de
 * la lista, bastaría con cambiar una para que el indicador se contradijera
 * a sí mismo a mitad de camino.
 */
export const PASOS_CATALOGO = ['Buscar', 'Elegir edición', 'Revisar y guardar']
export const PASOS_MANUAL = ['Buscar', 'Escribir los datos', 'Revisar y guardar']

/**
 * Los pasos cuando lo que se está anotando es un deseo.
 *
 * El último paso se llama distinto porque termina en otro sitio: un deseo no
 * se «guarda en la colección», se anota en una lista de lo que buscas. Decir
 * «guardar» en las dos tareas haría pensar que el disco ya entró a la
 * colección.
 */
export const PASOS_DESEO = ['Buscar', 'Elegir edición', 'Anotar el deseo']

export interface AlbumDraft {
  coverFront: File | null
  coverBack: File | null
  artist: string
  title: string
  format: PhysicalFormatId
}

interface AddAlbumFormProps {
  initial?: AlbumDraft | null
  onSubmit: (draft: AlbumDraft) => void
  onBrowseArtist?: (draft: AlbumDraft) => void
  onManual?: (draft: AlbumDraft) => void
  onCancel: () => void
  /**
   * Para qué se está buscando: para la colección o para la lista de deseos.
   *
   * Es el mismo formulario en los dos casos —mismas sugerencias, misma
   * exploración de discografía, mismo buscador— y esa es justamente la
   * intención: anotar un deseo tenía antes un buscador propio, más pobre, y no
   * había razón para que fuera distinto.
   *
   * Lo único que cambia es que un deseo no lleva TUS fotos. Todavía no tienes
   * el disco: no hay una copia tuya que fotografiar.
   */
  modo?: 'coleccion' | 'deseo'
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function AddAlbumForm({
  initial,
  onSubmit,
  onBrowseArtist,
  onManual,
  onCancel,
  modo = 'coleccion'
}: AddAlbumFormProps) {
  const esDeseo = modo === 'deseo'
  const [coverFront, setCoverFront] = useState<File | null>(initial?.coverFront ?? null)
  const [coverBack, setCoverBack] = useState<File | null>(initial?.coverBack ?? null)
  const [artist, setArtist] = useState(initial?.artist ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [format, setFormat] = useState<PhysicalFormatId>(initial?.format ?? 'vinilo')

  const [artistSuggestions, setArtistSuggestions] = useState<ArtistSuggestion[]>([])
  const [albumSuggestions, setAlbumSuggestions] = useState<AlbumSuggestion[]>([])
  const [artistFocused, setArtistFocused] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [activeArtistIdx, setActiveArtistIdx] = useState(-1)
  const [activeTitleIdx, setActiveTitleIdx] = useState(-1)

  const artistRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const artistDropRef = useRef<HTMLUListElement>(null)
  const titleDropRef = useRef<HTMLUListElement>(null)

  const debouncedArtist = useDebounce(artist, 350)
  const debouncedTitle = useDebounce(title, 350)

  const suppressArtistRef = useRef(false)
  const suppressTitleRef = useRef(false)

  const fetchArtistSuggestions = useCallback(async (query: string) => {
    if (suppressArtistRef.current) { suppressArtistRef.current = false; return }
    if (query.trim().length < 2) { setArtistSuggestions([]); return }
    const result = await window.api.suggestArtists(query)
    if (result.ok) setArtistSuggestions(result.data)
  }, [])

  const fetchAlbumSuggestions = useCallback(async (titleQ: string, artistQ: string) => {
    if (suppressTitleRef.current) { suppressTitleRef.current = false; return }
    if (titleQ.trim().length < 2) { setAlbumSuggestions([]); return }
    const result = await window.api.suggestAlbums(titleQ, artistQ)
    if (result.ok) setAlbumSuggestions(result.data)
  }, [])

  useEffect(() => { fetchArtistSuggestions(debouncedArtist) }, [debouncedArtist, fetchArtistSuggestions])
  useEffect(() => { fetchAlbumSuggestions(debouncedTitle, artist) }, [debouncedTitle, artist, fetchAlbumSuggestions])

  function pickArtist(name: string) {
    suppressArtistRef.current = true
    setArtist(name)
    setArtistSuggestions([])
    setActiveArtistIdx(-1)
    titleRef.current?.focus()
  }

  function pickAlbum(suggestion: AlbumSuggestion) {
    suppressTitleRef.current = true
    setTitle(suggestion.title)
    if (!artist.trim() && suggestion.artist) {
      suppressArtistRef.current = true
      setArtist(suggestion.artist)
    }
    setAlbumSuggestions([])
    setActiveTitleIdx(-1)
  }

  function handleArtistKeyDown(e: React.KeyboardEvent) {
    if (artistSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveArtistIdx((i) => Math.min(i + 1, artistSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveArtistIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeArtistIdx >= 0) {
      e.preventDefault()
      pickArtist(artistSuggestions[activeArtistIdx].name)
    } else if (e.key === 'Escape') {
      setArtistSuggestions([])
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (albumSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveTitleIdx((i) => Math.min(i + 1, albumSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveTitleIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeTitleIdx >= 0) {
      e.preventDefault()
      pickAlbum(albumSuggestions[activeTitleIdx])
    } else if (e.key === 'Escape') {
      setAlbumSuggestions([])
    }
  }

  const canSubmit = artist.trim().length > 0 && title.trim().length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({
      coverFront,
      coverBack,
      artist: artist.trim(),
      title: title.trim(),
      format
    })
  }

  const showArtistDrop = artistFocused && artistSuggestions.length > 0
  const showTitleDrop = titleFocused && albumSuggestions.length > 0

  return (
    <form className="screen add-form" onSubmit={handleSubmit}>
      <FlowSteps
        steps={esDeseo ? PASOS_DESEO : PASOS_CATALOGO}
        current={0}
        onCancel={onCancel}
      />

      <PageHeader
        title={esDeseo ? 'Anotar un disco que buscas' : 'Agregar un disco'}
        subtitle={
          esDeseo
            ? 'Escribe el artista y el álbum; Melôfyle completa los datos'
            : 'Escribe el artista y el álbum; Melôfyle busca el resto'
        }
      />

      {/*
        Las fotos solo tienen sentido para un disco que ya tienes: son la foto
        de TU copia, con su desgaste y su etiqueta. Un deseo no tiene copia
        todavía, así que aquí no hay nada que fotografiar.
      */}
      {!esDeseo && (
        <section className="form-section">
          <h3 className="section-title">Tus fotos</h3>
          <p className="section-note">
            Estas fotos son tu copia personal y se guardan aparte de la portada oficial del
            catálogo.
          </p>
          <div className="photo-row">
            <PhotoPicker
              label="Portada"
              hint="Elegir foto de la portada"
              file={coverFront}
              onChange={setCoverFront}
            />
            <PhotoPicker
              label="Contraportada"
              hint="Elegir foto de la contraportada"
              file={coverBack}
              onChange={setCoverBack}
            />
          </div>
        </section>
      )}

      <section className="form-section">
        <h3 className="section-title">Datos del álbum</h3>

        <div className="field autocomplete-field">
          <span className="field-label">Artista o banda</span>
          <input
            ref={artistRef}
            type="text"
            value={artist}
            onChange={(e) => { setArtist(e.target.value); setActiveArtistIdx(-1) }}
            onFocus={() => setArtistFocused(true)}
            onBlur={() => setTimeout(() => setArtistFocused(false), 150)}
            onKeyDown={handleArtistKeyDown}
            placeholder="Ej: Soda Stereo"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          {showArtistDrop && (
            <ul className="autocomplete-dropdown" ref={artistDropRef} role="listbox">
              {artistSuggestions.map((s, i) => (
                <li
                  key={`${s.name}-${i}`}
                  role="option"
                  aria-selected={i === activeArtistIdx}
                  className={`autocomplete-option${i === activeArtistIdx ? ' active' : ''}`}
                  onMouseDown={() => pickArtist(s.name)}
                >
                  <span className="autocomplete-name">{s.name}</span>
                  {s.disambiguation && (
                    <span className="autocomplete-hint">{s.disambiguation}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="field autocomplete-field">
          <span className="field-label">Nombre del álbum</span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setActiveTitleIdx(-1) }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTimeout(() => setTitleFocused(false), 150)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Ej: Canción Animal"
            autoComplete="off"
            spellCheck={false}
          />
          {showTitleDrop && (
            <ul className="autocomplete-dropdown" ref={titleDropRef} role="listbox">
              {albumSuggestions.map((s, i) => (
                <li
                  key={`${s.title}-${s.artist}-${i}`}
                  role="option"
                  aria-selected={i === activeTitleIdx}
                  className={`autocomplete-option${i === activeTitleIdx ? ' active' : ''}`}
                  onMouseDown={() => pickAlbum(s)}
                >
                  <span className="autocomplete-name">{s.title}</span>
                  <span className="autocomplete-hint">
                    {s.artist}{s.year ? ` (${s.year})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="form-section">
        <h3 className="section-title">Formato físico</h3>
        <div className="format-options" role="radiogroup" aria-label="Formato físico">
          {PHYSICAL_FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={format === option.id}
              className={`format-chip${format === option.id ? ' selected' : ''}`}
              onClick={() => setFormat(option.id)}
            >
              <span className="format-icon">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="add-form-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <div className="add-form-actions">
          {onManual && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!artist.trim()}
              onClick={() =>
                onManual({
                  coverFront,
                  coverBack,
                  artist: artist.trim(),
                  title: title.trim(),
                  format
                })
              }
            >
              {esDeseo ? 'Anotar a mano' : 'Cargar a mano'}
            </button>
          )}
          {onBrowseArtist && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!artist.trim()}
              onClick={() =>
                onBrowseArtist({
                  coverFront,
                  coverBack,
                  artist: artist.trim(),
                  title: '',
                  format
                })
              }
            >
              Explorar discografía
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {esDeseo ? 'Buscar el disco' : 'Buscar datos del álbum'}
          </button>
        </div>
      </footer>
    </form>
  )
}

export default AddAlbumForm
