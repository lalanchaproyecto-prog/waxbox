import { useEffect, useState } from 'react'
import type { Loan } from '@core/models/loan'
import { loanStatus, today } from '@core/models/loan'
import { formatPurchaseDate } from '@core/models/purchase'
import { IconClose } from './Icons'

interface LoansSectionProps {
  albumId: number
}

function LoansSection({ albumId }: LoansSectionProps) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [person, setPerson] = useState('')
  const [lentAt, setLentAt] = useState(today())
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
  }, [albumId])

  async function load() {
    const result = await window.api.loansOf(albumId)
    if (result.ok) setLoans(result.data)
  }

  const activeLoan = loans.find((l) => l.returnedAt === null)

  function openForm() {
    setPerson('')
    setLentAt(today())
    setDueAt('')
    setNotes('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
  }

  async function lend() {
    if (!person.trim()) return
    setBusy(true)
    const result = await window.api.lendAlbum(
      albumId,
      person.trim(),
      lentAt,
      dueAt || null,
      notes || null
    )
    if (result.ok) {
      closeForm()
      await load()
    }
    setBusy(false)
  }

  async function returnAlbum(loanId: number) {
    setBusy(true)
    const result = await window.api.returnLoan(loanId, today())
    if (result.ok) await load()
    setBusy(false)
  }

  async function removeLoan(loanId: number) {
    setBusy(true)
    const result = await window.api.deleteLoan(loanId)
    if (result.ok) await load()
    setBusy(false)
  }

  return (
    <section className="review-block">
      <div className="review-block-head">
        <h3 className="section-title">Préstamos</h3>
        {!activeLoan && (
          <button className="btn-link" onClick={openForm}>
            + Prestar
          </button>
        )}
      </div>

      {activeLoan && (
        <div className={`loan-active loan-${loanStatus(activeLoan).tone}`}>
          <p className="loan-status-text">{loanStatus(activeLoan).text}</p>
          {activeLoan.notes && <p className="loan-notes">{activeLoan.notes}</p>}
          <div className="loan-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => returnAlbum(activeLoan.id)}
              disabled={busy}
            >
              Ya volvió
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => !busy && closeForm()}>
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Registrar préstamo"
          >
            <header className="modal-header">
              <div>
                <h2>Prestar este disco</h2>
                <p className="modal-subtitle">
                  Solo el nombre de la persona es obligatorio. La fecha de devolución
                  sirve para que Melôfyle te avise si se pasa.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={closeForm}
                disabled={busy}
                title="Cerrar"
              >
                <IconClose size={18} />
              </button>
            </header>

            <div className="edit-grid">
              <label className="field">
                <span className="field-label">A quién</span>
                <input
                  value={person}
                  placeholder="Nombre de la persona"
                  spellCheck={false}
                  autoFocus
                  onChange={(e) => setPerson(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && person.trim()) lend() }}
                />
              </label>
              <label className="field">
                <span className="field-label">Fecha de préstamo</span>
                <input
                  type="date"
                  value={lentAt}
                  onChange={(e) => setLentAt(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Debería volver el</span>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </label>
              <label className="field field-wide">
                <span className="field-label">Notas</span>
                <input
                  value={notes}
                  placeholder="Opcional"
                  spellCheck
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            <footer className="modal-footer">
              <button className="btn btn-ghost" onClick={closeForm} disabled={busy}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={lend}
                disabled={busy || !person.trim()}
              >
                Registrar préstamo
              </button>
            </footer>
          </div>
        </div>
      )}

      {loans.filter((l) => l.returnedAt !== null).length > 0 && (
        <details className="loan-history">
          <summary>
            Historial ({loans.filter((l) => l.returnedAt !== null).length})
          </summary>
          <ul className="loan-history-list">
            {loans
              .filter((l) => l.returnedAt !== null)
              .map((loan) => (
                <li key={loan.id} className="loan-history-item">
                  <span className="loan-person">{loan.person}</span>
                  <span className="loan-dates">
                    {formatPurchaseDate(loan.lentAt) ?? loan.lentAt}
                    {' — '}
                    {formatPurchaseDate(loan.returnedAt!) ?? loan.returnedAt}
                  </span>
                  {loan.notes && <span className="loan-notes">{loan.notes}</span>}
                  <button
                    className="icon-btn danger"
                    title="Borrar este registro"
                    onClick={() => removeLoan(loan.id)}
                    disabled={busy}
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

      {loans.length === 0 && !showForm && (
        <p className="setting-description">
          Nunca se ha prestado este disco.
        </p>
      )}
    </section>
  )
}

export default LoansSection
