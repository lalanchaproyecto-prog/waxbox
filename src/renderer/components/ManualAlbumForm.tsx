import { useEffect, useMemo, useState } from 'react'
import type { EditableAlbum, EditableTrack } from '@core/albumDraft'
import { emptyManualTrack, renumberTracks as renumber } from '@core/albumDraft'
import {
  PHYSICAL_FORMATS,
  getFormat,
  sideOptionsFor,
  defaultSideFor
} from '@core/models/formats'
import type { PhysicalFormatId } from '@core/models/formats'
import { durationToSeconds } from '@core/models/duration'
import type { DuplicateCandidate } from '@core/database/db'
import type { FeatureFlags } from '@core/models/features'
import PhotoPicker from './PhotoPicker'

interface ManualAlbumFormProps {
  /** Ficha de partida, ya con artista, título y formato de la pantalla anterior. */
  initial: EditableAlbum
  /** Géneros que ya existen en la colección, para poder reusar los mismos. */
  knownGenres: string[]
  /** Colección activa, para avisar si el disco ya está. */
  collectionId: number
  features: FeatureFlags
  coverFront: File | null
  coverBack: File | null
  onPhotosChange: (front: File | null, back: File | null) => void
  onContinue: (album: EditableAlbum) => void
  onCancel: () => void
}

/** Solo avisa; una duración vacía es válida. */
function durationLooksWrong(duration: string | null): boolean {
  if (!duration || duration.trim().length === 0) return false
  return durationToSeconds(duration.trim()) === null
}

/**
 * Carga completa de un disco a mano, sin ninguna fuente automática.
 *
 * Se llega aquí cuando MusicBrainz no encontró el álbum. Todo lo que
 * normalmente llega solo se escribe aquí: datos del álbum, géneros y el
 * tracklist canción por canción.
 *
 * QUÉ NO SE INTENTA BUSCAR Y POR QUÉ:
 * La portada oficial (Cover Art Archive), la reseña (Wikipedia/Wikidata) y los
 * enlaces del artista se consultan con el identificador de MusicBrainz del
 * disco. Este álbum no tiene ninguno, así que esas consultas no se hacen — no
 * hay con qué. Deezer sí se puede usar, porque busca por texto.
 */
function ManualAlbumForm({
  initial,
  knownGenres,
  collectionId,
  features,
  coverFront,
  coverBack,
  onPhotosChange,
  onContinue,
  onCancel
}: ManualAlbumFormProps) {
  const [album, setAlbum] = useState<EditableAlbum>(initial)
  const [genreText, setGenreText] = useState(initial.genres.join(', '))
  const [variousArtists, setVariousArtists] = useState(
    initial.tracks.some((track) => track.artist !== initial.artists)
  )
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const [deezerBusy, setDeezerBusy] = useState(false)
  const [deezerResult, setDeezerResult] = useState<string | null>(null)

  const format = getFormat(album.format)
  const sides = useMemo(() => sideOptionsFor(album.format), [album.format])

  /*
    El aviso de duplicado se consulta mientras se escribe, con una pausa para no
    golpear la base en cada tecla. Nunca bloquea: tener dos copias del mismo
    disco es normal en una colección física.
  */
  useEffect(() => {
    const artists = album.artists.trim()
    const title = album.title.trim()

    if (artists.length === 0 || title.length === 0) {
      setDuplicates([])
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await window.api.findPossibleDuplicates(collectionId, artists, title)
      if (!cancelled && result.ok) setDuplicates(result.data)
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [album.artists, album.title, collectionId])

  function update(changes: Partial<EditableAlbum>) {
    setAlbum((current) => ({ ...current, ...changes }))
  }

  /** Cambiar de formato cambia qué lados existen; los que ya no valen se limpian. */
  function changeFormat(next: PhysicalFormatId) {
    const valid = new Set(sideOptionsFor(next).map((option) => option.value))
    const fallback = defaultSideFor(next)

    setAlbum((current) => ({
      ...current,
      format: next,
      tracks: renumber(
        current.tracks.map((track) => ({
          ...track,
          side: valid.has(track.side) ? track.side : fallback
        }))
      )
    }))
  }

  function applyGenreText(text: string) {
    setGenreText(text)
    update({
      genres: text
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean)
    })
  }

  /** Marcar un género que ya existe garantiza que se escriba exactamente igual. */
  function toggleKnownGenre(genre: string) {
    const has = album.genres.some((item) => item.toLowerCase() === genre.toLowerCase())
    const next = has
      ? album.genres.filter((item) => item.toLowerCase() !== genre.toLowerCase())
      : [...album.genres, genre]

    setAlbum((current) => ({ ...current, genres: next }))
    setGenreText(next.join(', '))
  }

  function addTrack() {
    const lastSide = album.tracks[album.tracks.length - 1]?.side
    const side = lastSide ?? defaultSideFor(album.format)
    const artist = variousArtists ? '' : album.artists

    update({
      tracks: renumber([...album.tracks, emptyManualTrack(0, side, artist)])
    })
  }

  function updateTrack(index: number, changes: Partial<EditableTrack>) {
    const tracks = album.tracks.map((track, i) =>
      i === index ? { ...track, ...changes } : track
    )
    // El lado puede haber cambiado, así que la numeración se rehace.
    update({ tracks: renumber(tracks) })
  }

  function removeTrack(index: number) {
    update({ tracks: renumber(album.tracks.filter((_, i) => i !== index)) })
  }

  function moveTrack(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= album.tracks.length) return

    const tracks = [...album.tracks]
    ;[tracks[index], tracks[target]] = [tracks[target], tracks[index]]
    update({ tracks: renumber(tracks) })
  }

  /**
   * Cuando deja de ser un compilado, todas las canciones vuelven a ser del
   * artista del álbum. Al revés no se toca nada: los nombres ya escritos sirven.
   */
  function toggleVariousArtists(next: boolean) {
    setVariousArtists(next)
    if (!next) {
      update({
        tracks: album.tracks.map((track) => ({ ...track, artist: album.artists }))
      })
    }
  }

  /** Deezer busca por texto, así que sirve igual para un álbum sin MusicBrainz. */
  async function lookUpDeezer() {
    const searchable = album.tracks
      .map((track, index) => ({ index, track }))
      .filter(({ track }) => track.title.trim().length > 0)

    if (searchable.length === 0) return

    setDeezerBusy(true)
    setDeezerResult(null)

    const result = await window.api.findDeezerTracks(
      searchable.map(({ track }) => ({
        artist: (track.artist || album.artists).trim(),
        title: track.title.trim()
      }))
    )

    setDeezerBusy(false)

    if (!result.ok) {
      setDeezerResult(result.error)
      return
    }

    const tracks = [...album.tracks]
    let found = 0
    searchable.forEach(({ index }, position) => {
      const match = result.data[position] ?? null
      if (match) found += 1
      tracks[index] = { ...tracks[index], deezer: match }
    })

    update({ tracks })
    setDeezerResult(
      found === 0
        ? 'Deezer no tiene adelantos de estas canciones.'
        : `Se encontraron adelantos de ${found} de ${searchable.length} canciones.`
    )
  }

  const titledTracks = album.tracks.filter((track) => track.title.trim().length > 0)
  const missingTitles = album.tracks.length - titledTracks.length
  const canContinue =
    album.artists.trim().length > 0 &&
    album.title.trim().length > 0 &&
    album.tracks.length > 0 &&
    missingTitles === 0

  function handleContinue() {
    if (!canContinue) return

    // Se limpian los espacios sobrantes y se completa el artista de las
    // canciones que quedaron en blanco en un compilado.
    onContinue({
      ...album,
      artists: album.artists.trim(),
      title: album.title.trim(),
      label: album.label?.trim() || null,
      tracks: renumber(
        album.tracks.map((track) => ({
          ...track,
          title: track.title.trim(),
          artist: track.artist.trim() || album.artists.trim(),
          duration: track.duration?.trim() || null
        }))
      )
    })
  }

  return (
    <div className="add-form manual-form">
      <header className="add-form-header">
        <h2>Cargar el disco a mano</h2>
        <p>
          Este disco no está en MusicBrainz, así que los datos los escribes tú. Una vez
          guardado funciona igual que cualquier otro: se busca, se filtra, se exporta y
          sus canciones se pueden poner en un setlist.
        </p>
      </header>

      {duplicates.length > 0 && (
        <div className="duplicate-warning">
          <strong>
            {duplicates.length === 1
              ? 'Ya tienes un disco con ese artista y título'
              : `Ya tienes ${duplicates.length} discos con ese artista y título`}
          </strong>
          <ul>
            {duplicates.map((item) => (
              <li key={item.id}>
                {item.title} — {item.artists}
                {item.year ? ` (${item.year})` : ''} ·{' '}
                {getFormat(item.format)?.label ?? item.format}
                {item.source === 'manual' ? ' · cargado a mano' : ''}
              </li>
            ))}
          </ul>
          <p>
            Puede ser un descuido, o puede que tengas dos copias distintas de la misma
            edición. Si es a propósito, sigue sin problema.
          </p>
        </div>
      )}

      <section className="form-section">
        <h3 className="section-title">Tus fotos</h3>
        <p className="section-note">
          Las fotos de tu copia son las únicas imágenes que va a tener este disco: sin
          MusicBrainz no hay portada oficial de catálogo que buscar.
        </p>
        <div className="photo-row">
          <PhotoPicker
            label="Portada"
            hint="Elegir foto de la portada"
            file={coverFront}
            onChange={(file) => onPhotosChange(file, coverBack)}
          />
          <PhotoPicker
            label="Contraportada"
            hint="Elegir foto de la contraportada"
            file={coverBack}
            onChange={(file) => onPhotosChange(coverFront, file)}
          />
        </div>
      </section>

      <section className="form-section">
        <h3 className="section-title">Datos del álbum</h3>

        <div className="edit-grid">
          <label className="field">
            <span className="field-label">Artista o banda</span>
            <input
              value={album.artists}
              spellCheck={false}
              placeholder="Ej: Los Jaivas"
              onChange={(event) => update({ artists: event.target.value })}
            />
            <span className="field-hint">
              Si es un compilado de varios artistas, escribe algo como "Varios
              artistas" y marca la casilla del tracklist.
            </span>
          </label>

          <label className="field">
            <span className="field-label">Nombre del álbum</span>
            <input
              value={album.title}
              spellCheck={false}
              placeholder="Ej: Alturas de Machu Picchu"
              onChange={(event) => update({ title: event.target.value })}
            />
          </label>

          <label className="field">
            <span className="field-label">Año</span>
            <input
              value={album.year ?? ''}
              placeholder="1981"
              spellCheck={false}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                update({ year: Number.isFinite(parsed) ? parsed : null })
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">Sello</span>
            <input
              value={album.label ?? ''}
              placeholder="Ej: SyM Records"
              spellCheck={false}
              onChange={(event) => update({ label: event.target.value || null })}
            />
          </label>
        </div>

        <div className="field field-wide">
          <span className="field-label">Formato físico</span>
          <div className="format-options" role="radiogroup" aria-label="Formato físico">
            {PHYSICAL_FORMATS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={album.format === option.id}
                className={`format-chip${album.format === option.id ? ' selected' : ''}`}
                onClick={() => changeFormat(option.id)}
              >
                <span className="format-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3 className="section-title">Género</h3>
        <p className="section-note">
          Importante si usas los setlists automáticos: se arman justamente por género,
          y un disco sin género queda fuera de esa función.
        </p>

        {knownGenres.length > 0 && (
          <div className="genre-chips">
            {knownGenres.map((genre) => {
              const selected = album.genres.some(
                (item) => item.toLowerCase() === genre.toLowerCase()
              )
              return (
                <button
                  key={genre}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className={`genre-chip${selected ? ' selected' : ''}`}
                  onClick={() => toggleKnownGenre(genre)}
                >
                  {genre}
                </button>
              )
            })}
          </div>
        )}

        <label className="field field-wide">
          <span className="field-label">
            {knownGenres.length > 0
              ? 'O escribe otros, separados por coma'
              : 'Géneros, separados por coma'}
          </span>
          <input
            value={genreText}
            spellCheck={false}
            placeholder="Ej: Rock, Folclore"
            onChange={(event) => applyGenreText(event.target.value)}
          />
          {knownGenres.length > 0 && (
            <span className="field-hint">
              Conviene marcar los de arriba cuando sirvan: escritos igual, los discos
              quedan juntos en el filtro de género.
            </span>
          )}
        </label>
      </section>

      <section className="form-section">
        <div className="review-block-head">
          <h3 className="section-title">Tracklist ({album.tracks.length})</h3>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={variousArtists}
              onChange={(event) => toggleVariousArtists(event.target.checked)}
            />
            Es un compilado de varios artistas
          </label>
        </div>

        <p className="section-note">
          Agrega las canciones una por una. El número se pone solo según el orden y el{' '}
          {format?.usesSides ? 'lado' : 'disco'}. La duración es opcional; escríbela
          como 4:26 si la sabes, porque es lo que suma el tiempo total de un setlist.
        </p>

        {album.tracks.length === 0 && (
          <p className="empty-note">
            Todavía no hay canciones. Agrega la primera para poder continuar.
          </p>
        )}

        {album.tracks.length > 0 && (
          <ul className="manual-tracks">
            {album.tracks.map((track, index) => (
              <li className="manual-track" key={index}>
                <span className="manual-track-pos">
                  {track.side !== 'N/A' ? `${track.side}${track.number}` : track.number}
                </span>

                <select
                  className="manual-track-side"
                  value={track.side}
                  aria-label="Lado o disco"
                  onChange={(event) => updateTrack(index, { side: event.target.value })}
                >
                  {sides.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  className="manual-track-title"
                  value={track.title}
                  placeholder="Título de la canción"
                  spellCheck={false}
                  aria-label="Título de la canción"
                  onChange={(event) => updateTrack(index, { title: event.target.value })}
                />

                {variousArtists && (
                  <input
                    className="manual-track-artist"
                    value={track.artist}
                    placeholder="Artista de esta canción"
                    spellCheck={false}
                    aria-label="Artista de esta canción"
                    onChange={(event) => updateTrack(index, { artist: event.target.value })}
                  />
                )}

                <input
                  className={`manual-track-duration${
                    durationLooksWrong(track.duration) ? ' looks-wrong' : ''
                  }`}
                  value={track.duration ?? ''}
                  placeholder="4:26"
                  spellCheck={false}
                  aria-label="Duración"
                  title={
                    durationLooksWrong(track.duration)
                      ? 'No se entiende esa duración. Se espera algo como 4:26.'
                      : undefined
                  }
                  onChange={(event) =>
                    updateTrack(index, { duration: event.target.value || null })
                  }
                />

                <div className="manual-track-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Subir"
                    disabled={index === 0}
                    onClick={() => moveTrack(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Bajar"
                    disabled={index === album.tracks.length - 1}
                    onClick={() => moveTrack(index, 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Quitar esta canción"
                    onClick={() => removeTrack(index)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="manual-track-tools">
          <button type="button" className="btn btn-ghost" onClick={addTrack}>
            + Agregar canción
          </button>

          {features.playback && titledTracks.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={lookUpDeezer}
              disabled={deezerBusy}
              title="Deezer busca por texto, así que funciona sin MusicBrainz"
            >
              {deezerBusy ? 'Buscando en Deezer...' : 'Buscar adelantos en Deezer'}
            </button>
          )}
        </div>

        {deezerResult && <p className="section-note">{deezerResult}</p>}

        {missingTitles > 0 && (
          <p className="feedback-error">
            {missingTitles === 1
              ? 'Hay una canción sin título.'
              : `Hay ${missingTitles} canciones sin título.`}{' '}
            Complétalas o quítalas para continuar.
          </p>
        )}
      </section>

      <footer className="add-form-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <div className="add-form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Continuar a la revisión
          </button>
        </div>
      </footer>
    </div>
  )
}

export default ManualAlbumForm
