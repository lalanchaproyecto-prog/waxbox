import { useState } from 'react'
import { PHYSICAL_FORMATS, type PhysicalFormatId } from '@core/models/formats'
import PhotoPicker from './PhotoPicker'

/**
 * Lo que la persona ingresa a mano. A partir de esto la app buscará
 * el resto de los datos en MusicBrainz y los demás servicios.
 */
export interface AlbumDraft {
  coverFront: File | null
  coverBack: File | null
  artist: string
  title: string
  format: PhysicalFormatId
}

interface AddAlbumFormProps {
  /** Datos con los que arranca el formulario, al volver a editar algo ya ingresado. */
  initial?: AlbumDraft | null
  onSubmit: (draft: AlbumDraft) => void
  onCancel: () => void
}

function AddAlbumForm({ initial, onSubmit, onCancel }: AddAlbumFormProps) {
  const [coverFront, setCoverFront] = useState<File | null>(initial?.coverFront ?? null)
  const [coverBack, setCoverBack] = useState<File | null>(initial?.coverBack ?? null)
  const [artist, setArtist] = useState(initial?.artist ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [format, setFormat] = useState<PhysicalFormatId>(initial?.format ?? 'vinilo')

  // El artista y el álbum son lo único obligatorio: son la base de la búsqueda automática.
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

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <header className="add-form-header">
        <h2>Agregar un disco</h2>
        <p>Sube las fotos de tu copia y escribe el artista y el álbum.</p>
      </header>

      <section className="form-section">
        <h3 className="section-title">Tus fotos</h3>
        <p className="section-note">
          Estas fotos son tu copia personal y se guardan aparte de la portada oficial del catálogo.
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

      <section className="form-section">
        <h3 className="section-title">Datos del álbum</h3>

        <label className="field">
          <span className="field-label">Artista o banda</span>
          <input
            type="text"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder="Ej: Soda Stereo"
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Nombre del álbum</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej: Canción Animal"
          />
        </label>
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
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          Buscar datos del álbum
        </button>
      </footer>
    </form>
  )
}

export default AddAlbumForm
