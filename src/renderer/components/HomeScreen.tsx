import { useCallback, useEffect, useState } from 'react'
import type { CollectionStats } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import { loanStatus } from '@core/models/loan'
import type { ActiveLoan } from '@core/database/db'

interface HomeScreenProps {
  collectionId: number
  collectionName: string
  onOpenAlbum: (albumId: number) => void
  onAdd: () => void
}

function HomeScreen({
  collectionId,
  collectionName,
  onOpenAlbum,
  onAdd
}: HomeScreenProps) {
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [loans, setLoans] = useState<ActiveLoan[]>([])

  const load = useCallback(async () => {
    const [statsRes, loansRes] = await Promise.all([
      window.api.collectionStats(collectionId),
      window.api.activeLoans(collectionId)
    ])
    if (statsRes.ok) setStats(statsRes.data)
    if (loansRes.ok) setLoans(loansRes.data)
  }, [collectionId])

  useEffect(() => { load() }, [load])

  function spin() {
    window.api.collectionStats(collectionId).then((res) => {
      if (res.ok) setStats(res.data)
    })
  }

  if (!stats) return null

  return (
    <div className="home-screen">
      <header className="home-hero">
        <h2 className="home-collection-name">{collectionName}</h2>
        <div className="home-stats-row">
          <StatCard number={stats.totalAlbums} label="discos" />
          <StatCard number={stats.totalTracks} label="canciones" />
          <StatCard number={stats.totalPlays} label="escuchas" />
        </div>
      </header>

      {stats.totalAlbums === 0 ? (
        <section className="home-empty">
          <p>Tu colección está vacía. Agrega tu primer disco para empezar.</p>
          <button className="btn btn-primary" onClick={onAdd}>
            + Agregar disco
          </button>
        </section>
      ) : (
        <>
          {/* Ruleta */}
          {stats.randomAlbum && (
            <section className="home-section home-roulette">
              <h3 className="home-section-title">¿Qué escucho hoy?</h3>
              <button
                className="roulette-card"
                onClick={() => onOpenAlbum(stats.randomAlbum!.id)}
              >
                {coverSrc(stats.randomAlbum) ? (
                  <img
                    className="roulette-cover"
                    src={coverSrc(stats.randomAlbum)!}
                    alt=""
                  />
                ) : (
                  <div className="roulette-cover roulette-no-cover" />
                )}
                <div className="roulette-info">
                  <span className="roulette-title">{stats.randomAlbum.title}</span>
                  <span className="roulette-artist">{stats.randomAlbum.artists}</span>
                  <span className="roulette-meta">
                    {getFormat(stats.randomAlbum.format)?.label}
                    {stats.randomAlbum.year ? ` · ${stats.randomAlbum.year}` : ''}
                  </span>
                </div>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={spin}>
                Otra sugerencia
              </button>
            </section>
          )}

          {/* Formatos */}
          {stats.byFormat.length > 0 && (
            <section className="home-section">
              <h3 className="home-section-title">Por formato</h3>
              <div className="home-format-bars">
                {stats.byFormat.map(({ format, count }) => {
                  const fmt = getFormat(format)
                  const pct = (count / stats.totalAlbums) * 100
                  return (
                    <div key={format} className="format-bar-row">
                      <span className="format-bar-label">
                        {fmt?.icon} {fmt?.label ?? format}
                      </span>
                      <div className="format-bar-track">
                        <div
                          className="format-bar-fill"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="format-bar-count numeric">{count}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Géneros */}
          {stats.topGenres.length > 0 && (
            <section className="home-section">
              <h3 className="home-section-title">Géneros más frecuentes</h3>
              <div className="home-genre-chips">
                {stats.topGenres.map(({ genre, count }) => (
                  <span key={genre} className="genre-chip">
                    {genre} <span className="genre-chip-count">{count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Préstamos activos */}
          {loans.length > 0 && (
            <section className="home-section">
              <h3 className="home-section-title">
                Discos prestados ({loans.length})
              </h3>
              <ul className="active-loans-list">
                {loans.map((loan) => {
                  const status = loanStatus(loan)
                  const cover = loan.userCoverFront
                    ? `waxbox-photo://${loan.userCoverFront}`
                    : loan.canonicalCover
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
                          <span className="active-loan-status">{status.text}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Últimas incorporaciones */}
          {stats.recentAlbums.length > 0 && (
            <section className="home-section">
              <h3 className="home-section-title">Últimas incorporaciones</h3>
              <div className="home-recent-grid">
                {stats.recentAlbums.map((album) => (
                  <button
                    key={album.id}
                    className="recent-card"
                    onClick={() => onOpenAlbum(album.id)}
                  >
                    {coverSrc(album) ? (
                      <img className="recent-cover" src={coverSrc(album)!} alt="" />
                    ) : (
                      <div className="recent-cover recent-no-cover" />
                    )}
                    <span className="recent-title">{album.title}</span>
                    <span className="recent-artist">{album.artists}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/*
            Aquí había una fila de cuatro botones —Colección, Setlists,
            Deseos, Agregar— que era el menú principal de la app escondido al
            final del scroll del inicio. Ahora esas cuatro cosas viven en el
            menú lateral, visibles desde cualquier pantalla, así que repetirlas
            aquí solo daría dos caminos para lo mismo.
          */}
        </>
      )}
    </div>
  )
}

function StatCard({ number, label }: { number: number; label: string }) {
  return (
    <div className="home-stat">
      <span className="home-stat-number numeric">{number.toLocaleString('es-CL')}</span>
      <span className="home-stat-label">{label}</span>
    </div>
  )
}

function coverSrc(album: { userCoverFront: string | null; canonicalCover: string | null }): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
  return album.canonicalCover
}

export default HomeScreen
