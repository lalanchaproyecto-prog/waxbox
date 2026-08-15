import { useEffect, useState } from 'react'
import type { ActiveLoan } from '@core/database/db'
import { loanStatus } from '@core/models/loan'
import { getFormat } from '@core/models/formats'

interface ActiveLoansPanelProps {
  collectionId: number
  onOpenAlbum: (albumId: number) => void
}

function ActiveLoansPanel({ collectionId, onOpenAlbum }: ActiveLoansPanelProps) {
  const [loans, setLoans] = useState<ActiveLoan[]>([])

  useEffect(() => {
    window.api.activeLoans(collectionId).then((result) => {
      if (result.ok) setLoans(result.data)
    })
  }, [collectionId])

  if (loans.length === 0) return null

  return (
    <section className="review-block active-loans-panel">
      <h3 className="section-title">
        Discos prestados ({loans.length})
      </h3>
      <ul className="active-loans-list">
        {loans.map((loan) => {
          const status = loanStatus(loan)
          const cover = loan.userCoverFront
            ? `melofyle-photo://${loan.userCoverFront}`
            : loan.canonicalCover
          const format = getFormat(loan.format)

          return (
            <li key={loan.id} className={`active-loan-item loan-${status.tone}`}>
              <button className="active-loan-card" onClick={() => onOpenAlbum(loan.albumId)}>
                {cover ? (
                  <img className="active-loan-cover" src={cover} alt="" />
                ) : (
                  <div className="active-loan-cover variant-no-cover" />
                )}
                <div className="active-loan-info">
                  <span className="active-loan-title">
                    {loan.albumArtists} — {loan.albumTitle}
                  </span>
                  <span className="active-loan-format">
                    {format ? `${format.icon} ${format.label}` : loan.format}
                  </span>
                  <span className="active-loan-status">{status.text}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ActiveLoansPanel
