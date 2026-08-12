import { useEffect, useRef, useState } from 'react'

interface PhotoPickerProps {
  label: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
}

/**
 * Recuadro para elegir una foto desde el computador, con vista previa.
 * La foto todavía no se copia a ningún lado: eso ocurre al guardar el disco.
 */
function PhotoPicker({ label, hint, file, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Genera una URL temporal para mostrar la foto elegida, y la libera al cambiarla
  // o al salir de la pantalla para no dejar memoria ocupada.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="photo-picker">
      <span className="photo-picker-label">{label}</span>

      <button
        type="button"
        className={`photo-drop${previewUrl ? ' has-image' : ''}`}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={`Vista previa de ${label.toLowerCase()}`} />
        ) : (
          <span className="photo-drop-empty">
            <span className="photo-drop-icon">&#128247;</span>
            <span className="photo-drop-text">{hint}</span>
          </span>
        )}
      </button>

      {file && (
        <div className="photo-actions">
          <span className="photo-filename" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            Quitar
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  )
}

export default PhotoPicker
