import { useEffect, useMemo, useState } from 'react'
import {
  fieldsFor,
  normalizeSelection,
  type ExportKind,
  type ExportFormat
} from '@core/models/exportFields'

interface ExportDialogProps {
  kind: ExportKind
  /** Colección activa. Exportar nunca mezcla discos de colecciones distintas. */
  collectionId: number
  /** Obligatorio cuando kind es 'setlist'. */
  setlistId?: number
  /** Encabezado del diálogo. */
  title: string
  onClose: () => void
}

interface Progress {
  stage: 'covers' | 'building' | 'writing'
  done: number
  total: number
}

const STAGE_LABEL: Record<Progress['stage'], string> = {
  covers: 'Preparando portadas',
  building: 'Armando el archivo',
  writing: 'Guardando'
}

function fieldsKey(kind: ExportKind): string {
  return `waxbox-export-fields-${kind}`
}

function formatKey(kind: ExportKind): string {
  return `waxbox-export-format-${kind}`
}

function loadSelection(kind: ExportKind): string[] {
  try {
    const raw = localStorage.getItem(fieldsKey(kind))
    return normalizeSelection(kind, raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeSelection(kind, null)
  }
}

function loadFormat(kind: ExportKind): ExportFormat {
  return localStorage.getItem(formatKey(kind)) === 'pdf' ? 'pdf' : 'xlsx'
}

/**
 * Diálogo previo a exportar: elegir formato y qué información incluir.
 *
 * Lo elegido se recuerda por separado para la colección y para los setlists,
 * porque son decisiones distintas y quien exporta un setlist para tocar no
 * quiere volver a desmarcar las reseñas cada vez.
 */
function ExportDialog({ kind, collectionId, setlistId, title, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(() => loadFormat(kind))
  const [selected, setSelected] = useState<string[]>(() => loadSelection(kind))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  // Los campos que solo sirven en un formato desaparecen al cambiar al otro.
  const visibleFields = useMemo(
    () => fieldsFor(kind).filter((field) => !field.onlyIn || field.onlyIn === format),
    [kind, format]
  )

  useEffect(() => {
    localStorage.setItem(fieldsKey(kind), JSON.stringify(selected))
  }, [kind, selected])

  useEffect(() => {
    localStorage.setItem(formatKey(kind), format)
  }, [kind, format])

  useEffect(() => {
    if (!busy) return
    return window.api.onExportProgress(setProgress)
  }, [busy])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [busy, onClose])

  function toggle(fieldId: string) {
    setSelected((current) =>
      current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId]
    )
  }

  async function handleExport() {
    setBusy(true)
    setError(null)
    setSavedPath(null)
    setProgress(null)

    // Se mandan solo los campos que aplican al formato elegido.
    const applicable = selected.filter((id) =>
      visibleFields.some((field) => field.id === id)
    )

    const result = await window.api.runExport({
      kind,
      format,
      fields: applicable,
      collectionId,
      setlistId
    })

    setBusy(false)
    setProgress(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.data.path === null) return // se canceló el diálogo de guardar

    setSavedPath(result.data.path)
  }

  const nothingSelected = selected.filter((id) =>
    visibleFields.some((field) => field.id === id)
  ).length === 0

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="modal export-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            <p className="modal-subtitle">Elige el formato y qué información incluir.</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy} title="Cerrar">
            ✕
          </button>
        </header>

        <section className="export-section">
          <h3 className="section-title">Formato</h3>
          <div className="export-formats" role="radiogroup" aria-label="Formato de exportación">
            <button
              type="button"
              role="radio"
              aria-checked={format === 'xlsx'}
              className={`export-format${format === 'xlsx' ? ' selected' : ''}`}
              onClick={() => setFormat('xlsx')}
              disabled={busy}
            >
              <span className="export-format-name">Excel</span>
              <span className="export-format-hint">
                Una fila por {kind === 'collection' ? 'disco' : 'canción'}. Para filtrar,
                ordenar y hacer cuentas.
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={format === 'pdf'}
              className={`export-format${format === 'pdf' ? ' selected' : ''}`}
              onClick={() => setFormat('pdf')}
              disabled={busy}
            >
              <span className="export-format-name">PDF</span>
              <span className="export-format-hint">
                {kind === 'collection'
                  ? 'Un catálogo con las portadas en buen tamaño, para imprimir o compartir.'
                  : 'Hoja lista para imprimir o mirar en el celular durante el evento.'}
              </span>
            </button>
          </div>
        </section>

        <section className="export-section">
          <h3 className="section-title">Qué incluir</h3>
          <ul className="export-fields">
            {visibleFields.map((field) => {
              const checked = selected.includes(field.id)
              return (
                <li key={field.id}>
                  <label className="export-field">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(field.id)}
                      disabled={busy}
                    />
                    <span className="export-field-text">
                      <span className="export-field-label">{field.label}</span>
                      {field.hint && (
                        <span className="export-field-hint">{field.hint}</span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        {busy && (
          <div className="export-progress">
            <span className="spinner" />
            <span>
              {progress
                ? `${STAGE_LABEL[progress.stage]}${
                    progress.stage === 'covers' ? ` ${progress.done} de ${progress.total}` : '...'
                  }`
                : 'Preparando...'}
            </span>
          </div>
        )}

        {error && <p className="feedback-error">{error}</p>}

        {savedPath && (
          <p className="feedback-ok">Listo. El archivo quedó en: {savedPath}</p>
        )}

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {savedPath ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={busy || nothingSelected}
          >
            {busy ? 'Exportando...' : 'Exportar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ExportDialog
