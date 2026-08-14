import { useCallback, useEffect, useState } from 'react'
import type { CollectionStats } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import { loanStatus } from '@core/models/loan'
import type { ActiveLoan } from '@core/database/db'
import PageHeader from './PageHeader'

interface HomeScreenProps {
  collectionId: number
  collectionName: string
  onOpenAlbum: (albumId: number) => void
  onOpenLoans: () => void
  onAdd: () => void
}

function HomeScreen({
  collectionId,
  collectionName,
  onOpenAlbum,
  onOpenLoans,
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

  useEffect(() => {
    load()
  }, [load])

  function spin() {
    window.api.collectionStats(collectionId).then((res) => {
      if (res.ok) setStats(res.data)
    })
  }

  if (!stats) return null

  const numero = (valor: number) => valor.toLocaleString('es-CL')

  if (stats.totalAlbums === 0) {
    return (
      <div className="screen">
        <PageHeader title={collectionName} />
        <div className="empty-state">
          <p className="empty-state-title">Esta colección está vacía.</p>
          <p className="empty-state-help">
            Agrega tu primer disco, casete o CD. Waxbox completa el año, el sello y el
            tracklist por ti.
          </p>
          <button className="btn btn-primary" onClick={onAdd} style={{ alignSelf: 'flex-start' }}>
            Agregar disco
          </button>
        </div>
      </div>
    )
  }

  const atrasados = loans.filter((loan) => loanStatus(loan).tone === 'tarde').length

  return (
    <div className="screen">
      {/*
        Los tres totales van en el subtítulo, en la mono, y no en tres
        tarjetas con números gigantes. Un dashboard que abre con tres cifras
        enormes es la respuesta de plantilla, y además ninguna de las tres es
        lo que trae a nadie aquí: lo que se viene a resolver es qué poner.
      */}
      <PageHeader
        title={collectionName}
        subtitle={`${numero(stats.totalAlbums)} discos · ${numero(stats.totalTracks)} canciones · ${numero(stats.totalPlays)} escuchas`}
        actions={
          <button className="btn btn-primary" onClick={onAdd}>
            Agregar disco
          </button>
        }
      />

      {/*
        LA PIEZA PRINCIPAL: qué escuchar hoy.

        Es la pregunta que uno se hace de verdad frente a un estante lleno, y
        la única que una app puede contestar mejor que mirarlo. Por eso abre
        la pantalla con el objeto —portada y disco— y no con estadísticas.
      */}
      {stats.randomAlbum && (
        <section className="tonight">
          <div className="tonight-object">
            <div className="ficha-sleeve">
              {stats.randomAlbum.format !== 'casete' && (
                <span className="tonight-disc-wrap" aria-hidden="true">
                  <span
                    className={`disc${stats.randomAlbum.format === 'cd' ? ' disc-cd' : ''}`}
                  />
                </span>
              )}
              {coverSrc(stats.randomAlbum) ? (
                <img
                  className="ficha-cover"
                  src={coverSrc(stats.randomAlbum)!}
                  alt={`Portada de ${stats.randomAlbum.title}`}
                />
              ) : (
                <div className="ficha-cover ficha-cover-missing">
                  <span>Sin portada</span>
                </div>
              )}
            </div>
          </div>

          <div className="tonight-info">
            <span className="overline">¿Qué escucho hoy?</span>
            <h3 className="tonight-title">{stats.randomAlbum.title}</h3>
            <p className="tonight-artist">{stats.randomAlbum.artists}</p>
            <p className="tonight-meta numeric">
              {getFormat(stats.randomAlbum.format)?.label ?? stats.randomAlbum.format}
              {stats.randomAlbum.year ? ` · ${stats.randomAlbum.year}` : ''}
              {` · ${stats.randomAlbum.trackCount} ${
                stats.randomAlbum.trackCount === 1 ? 'canción' : 'canciones'
              }`}
            </p>
            <div className="tonight-actions">
              <button
                className="btn btn-primary"
                onClick={() => onOpenAlbum(stats.randomAlbum!.id)}
              >
                Abrir la ficha
              </button>
              <button className="btn btn-ghost" onClick={spin}>
                Otra sugerencia
              </button>
            </div>
          </div>
        </section>
      )}

      {/*
        Avisa solo cuando hay algo que hacer, y manda a la pantalla que lo
        resuelve en vez de repetirla aquí. Préstamos ya tiene su sitio en el
        menú desde que existe la sección.
      */}
      {loans.length > 0 && (
        <button
          className={`home-alert${atrasados > 0 ? ' home-alert-warn' : ''}`}
          onClick={onOpenLoans}
        >
          <span className="home-alert-text">
            {loans.length === 1
              ? 'Tienes 1 disco prestado'
              : `Tienes ${loans.length} discos prestados`}
            {atrasados > 0 &&
              ` · ${atrasados === 1 ? '1 lleva retraso' : `${atrasados} llevan retraso`}`}
          </span>
          <span className="home-alert-go">Ver préstamos →</span>
        </button>
      )}

      {stats.recentAlbums.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Últimas incorporaciones</h3>
          <div className="home-recent-grid">
            {stats.recentAlbums.map((album) => (
              <button
                key={album.id}
                className="album-card"
                onClick={() => onOpenAlbum(album.id)}
                data-format={album.format}
              >
                <span className="album-card-sleeve">
                  <span className="album-card-disc" aria-hidden="true" />
                  <span className="album-card-cover">
                    {coverSrc(album) ? (
                      <img src={coverSrc(album)!} alt={`Portada de ${album.title}`} loading="lazy" />
                    ) : (
                      <span className="album-card-placeholder" aria-hidden="true">
                        {getFormat(album.format)?.icon ?? '🎵'}
                      </span>
                    )}
                  </span>
                </span>
                <span className="album-card-info">
                  <span className="album-card-title">{album.title}</span>
                  <span className="album-card-artist">{album.artists}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="home-meters">
        {stats.byFormat.length > 0 && (
          <section className="home-section">
            <h3 className="home-section-title">Por formato</h3>
            {/*
              El formato SÍ reparte el total: cada disco tiene uno y solo uno,
              así que el porcentaje sobre la colección entera dice algo cierto.
            */}
            <ul className="meters">
              {stats.byFormat.map(({ format, count }) => {
                const pct = (count / stats.totalAlbums) * 100
                return (
                  <Meter
                    key={format}
                    label={getFormat(format)?.label ?? format}
                    fill={pct}
                    value={`${numero(count)} · ${Math.round(pct)}%`}
                  />
                )
              })}
            </ul>
          </section>
        )}

        {stats.topGenres.length > 0 && (
          <section className="home-section">
            <h3 className="home-section-title">Géneros más frecuentes</h3>
            {/*
              El género NO reparte el total: un disco puede tener varios, así
              que los porcentajes sumarían más de cien y serían una mentira.
              Las barras se miden contra el género más frecuente, y el número
              que se lee es el conteo de discos.
            */}
            <ul className="meters">
              {stats.topGenres.map(({ genre, count }) => (
                <Meter
                  key={genre}
                  label={genre}
                  fill={(count / stats.topGenres[0].count) * 100}
                  value={`${numero(count)} ${count === 1 ? 'disco' : 'discos'}`}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/**
 * Una barra de una sola serie.
 *
 * Un solo color para todas: pintar cada barra de un tono distinto según su
 * tamaño repetiría en color lo que el largo ya dice, y gastaría el único
 * canal libre que queda en no decir nada nuevo.
 *
 * El valor va en texto normal al lado, nunca del color de la barra: un color
 * de relleno no tiene contraste suficiente para leerse como letra.
 */
function Meter({ label, fill, value }: { label: string; fill: number; value: string }) {
  return (
    <li className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${Math.max(fill, 2)}%` }} />
      </span>
      <span className="meter-value numeric">{value}</span>
    </li>
  )
}

function coverSrc(album: {
  userCoverFront: string | null
  canonicalCover: string | null
}): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
  return album.canonicalCover
}

export default HomeScreen
