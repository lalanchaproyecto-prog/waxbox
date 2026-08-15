import { useEffect, useState } from 'react'
import type { VariantSibling } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import { conditionLabel } from '@core/models/condition'

interface VariantsSectionProps {
  albumId: number
  collectionId: number
  onOpenAlbum: (albumId: number) => void
}

function VariantsSection({ albumId, collectionId, onOpenAlbum }: VariantsSectionProps) {
  const [siblings, setSiblings] = useState<VariantSibling[]>([])
  const [suggested, setSuggested] = useState<VariantSibling[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
  }, [albumId])

  async function load() {
    const [siblingsRes, suggestedRes] = await Promise.all([
      window.api.variantsOf(albumId),
      window.api.suggestedVariants(collectionId, albumId)
    ])
    if (siblingsRes.ok) setSiblings(siblingsRes.data)
    if (suggestedRes.ok) setSuggested(suggestedRes.data)
  }

  async function link(otherAlbumId: number) {
    setBusy(true)
    const result = await window.api.linkVariants(albumId, otherAlbumId)
    if (result.ok) await load()
    setBusy(false)
  }

  async function unlink() {
    setBusy(true)
    const result = await window.api.unlinkVariant(albumId)
    if (result.ok) await load()
    setBusy(false)
  }

  if (siblings.length === 0 && suggested.length === 0) return null

  return (
    <section className="review-block">
      <h3 className="section-title">Variantes</h3>

      {siblings.length > 0 && (
        <>
          <p className="setting-description">
            Otras copias del mismo álbum en tu colección.
          </p>
          <ul className="variant-list">
            {siblings.map((s) => (
              <li key={s.id} className="variant-item">
                <VariantCard variant={s} onClick={() => onOpenAlbum(s.id)} />
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost" onClick={unlink} disabled={busy}>
            Desvincular este disco
          </button>
        </>
      )}

      {suggested.length > 0 && (
        <>
          <p className="setting-description">
            {siblings.length > 0
              ? 'Hay más copias que podrían ser del mismo álbum:'
              : 'Tienes otras copias que podrían ser del mismo álbum:'}
          </p>
          <ul className="variant-list">
            {suggested.map((s) => (
              <li key={s.id} className="variant-item">
                <VariantCard variant={s} onClick={() => onOpenAlbum(s.id)} />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => link(s.id)}
                  disabled={busy}
                >
                  Vincular
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function VariantCard({
  variant,
  onClick
}: {
  variant: VariantSibling
  onClick: () => void
}) {
  const cover = variant.userCoverFront
    ? `melofyle-photo://${variant.userCoverFront}`
    : variant.canonicalCover
  const format = getFormat(variant.format)

  return (
    <button className="variant-card" onClick={onClick}>
      {cover ? (
        <img className="variant-cover" src={cover} alt="" />
      ) : (
        <div className="variant-cover variant-no-cover" />
      )}
      <div className="variant-info">
        <span className="variant-title">{variant.title}</span>
        <span className="variant-meta">
          {format?.label ?? variant.format}
          {variant.year ? ` · ${variant.year}` : ''}
          {variant.condition ? ` · ${conditionLabel(variant.condition)}` : ''}
        </span>
      </div>
    </button>
  )
}

export default VariantsSection
