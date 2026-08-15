import { useCallback, useEffect, useState } from 'react'
import type { ActiveLoan } from '@core/database/db'
import { loanStatus, today } from '@core/models/loan'
import { getFormat } from '@core/models/formats'
import PageHeader from './PageHeader'

interface LoansScreenProps {
  collectionId: number
  onOpenAlbum: (albumId: number) => void
  /** Para refrescar los contadores del menú al devolver un disco. */
  onChanged: () => void
}

/**
 * Los discos que están fuera de casa.
 *
 * Antes esto no tenía pantalla: era una sección del inicio que solo aparecía
 * si había algún préstamo activo, así que quien no tenía ninguno no llegaba a
 * saber que la función existía. Ahora está en el menú siempre, y cuando no
 * hay nada prestado lo dice y explica dónde se presta un disco.
 *
 * Muestra lo que está afuera ahora. El historial completo de un disco —a
 * quién se le prestó a lo largo de los años— vive en su ficha, que es donde
 * pertenece: es parte de la historia de ese disco, no de una lista general.
 */
function LoansScreen({ collectionId, onOpenAlbum, onChanged }: LoansScreenProps) {
  const [loans, setLoans] = useState<ActiveLoan[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await window.api.activeLoans(collectionId)
    if (result.ok) setLoans(result.data)
    else setError(result.error)
  }, [collectionId])

  useEffect(() => {
    load()
  }, [load])

  async function handleReturn(loanId: number) {
    const result = await window.api.returnLoan(loanId, today())
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
    onChanged()
  }

  if (loans === null) return null

  const tarde = loans.filter((loan) => loanStatus(loan).tone === 'tarde').length

  return (
    <div className="screen">
      <PageHeader
        title="Préstamos"
        subtitle={
          loans.length === 0
            ? 'Nada prestado'
            : `${loans.length === 1 ? '1 disco fuera de casa' : `${loans.length} discos fuera de casa`}${
                tarde > 0 ? ` · ${tarde} con retraso` : ''
              }`
        }
      />

      {error && <p className="feedback-error">{error}</p>}

      {loans.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No tienes discos prestados.</p>
          <p className="empty-state-help">
            Cuando le prestes uno a alguien, anótalo desde la ficha del disco, en «Tu copia».
            Aparecerá aquí hasta que vuelva.
          </p>
        </div>
      ) : (
        <ul className="loans-list">
          {loans.map((loan) => {
            const status = loanStatus(loan)
            const format = getFormat(loan.format)
            const cover = loan.userCoverFront
              ? `melofyle-photo://${loan.userCoverFront}`
              : loan.canonicalCover

            return (
              <li key={loan.id} className={`loan-row loan-${status.tone}`}>
                <button
                  className="loan-row-main"
                  onClick={() => onOpenAlbum(loan.albumId)}
                  title="Abrir la ficha del disco"
                >
                  {cover ? (
                    <img className="loan-row-cover" src={cover} alt="" loading="lazy" />
                  ) : (
                    <span className="loan-row-cover loan-row-nocover" aria-hidden="true">
                      {format?.icon ?? '🎵'}
                    </span>
                  )}
                  <span className="loan-row-text">
                    <span className="loan-row-title">{loan.albumTitle}</span>
                    <span className="loan-row-artist">{loan.albumArtists}</span>
                  </span>
                </button>

                <div className="loan-row-side">
                  <span className="loan-row-person">{loan.person}</span>
                  <span className={`loan-tag loan-tag-${status.tone}`}>
                    {status.tone === 'tarde'
                      ? 'Con retraso'
                      : status.tone === 'pronto'
                        ? 'Vuelve pronto'
                        : 'Al día'}
                  </span>
                  <span className="loan-row-dates numeric">
                    Salió {loan.lentAt}
                    {loan.dueAt ? ` · vuelve ${loan.dueAt}` : ''}
                  </span>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={() => handleReturn(loan.id)}>
                  Marcar devuelto
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default LoansScreen
