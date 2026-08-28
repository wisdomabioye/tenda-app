import { canonicalJson } from '@tenda/shared'
import type { DossierProof, ProofType } from '@tenda/shared'

/** Icon glyph per non-image proof kind — images render as thumbnails. */
const KIND_GLYPH: Record<Exclude<ProofType, 'image'>, string> = {
  video: '🎬',
  document: '📄',
  geotag: '📍',
  text: '📝',
  structured: '🧾',
}

export function ProofTile({
  url,
  type,
  label,
  title,
}: {
  url: string | null
  type: ProofType
  label: string
  title?: string
}) {
  const body =
    type === 'image' && url !== null ? (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URLs, no next/image domain config in admin
      <img src={url} alt={label} className="h-full w-full object-cover" />
    ) : (
      <>
        <span className="text-2xl">{type === 'image' ? '🖼' : KIND_GLYPH[type]}</span>
        <span className="mt-1 truncate px-1 text-[10px] text-muted-foreground">{label}</span>
      </>
    )
  const frame =
    'group flex h-24 w-24 flex-col items-center justify-center overflow-hidden rounded-md border text-center'
  // Data proofs (geotag/text/structured) have no url — nothing to open, so
  // no dead link. Their payload rides the title attribute for now; a real
  // payload view is the #15 surface.
  if (url === null) {
    return (
      <div className={frame} title={title ?? label}>
        {body}
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={frame}
      title={title ?? label}
    >
      {body}
    </a>
  )
}

/**
 * Submitted evidence. Handles every proof kind — image thumbnails,
 * video/document links, unlinked data-proof tiles (payload in the tooltip) —
 * and folds in the exchange fiat payment proof, which lives on
 * exchange_details rather than escrow_proofs.
 */
export function ProofsGallery({
  proofs,
  paymentProofUrl,
}: {
  proofs: DossierProof[]
  paymentProofUrl?: string | null
}) {
  const payment =
    paymentProofUrl !== undefined && paymentProofUrl !== null && paymentProofUrl !== ''
      ? paymentProofUrl
      : null
  if (proofs.length === 0 && payment === null) {
    return <p className="text-sm text-muted-foreground">No proofs submitted.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {payment !== null && <ProofTile url={payment} type="image" label="Payment proof" />}
      {proofs.map((p, i) => (
        <ProofTile
          key={p.id}
          url={p.url}
          type={p.type}
          label={`${p.type} ${i + 1}`}
          title={p.payload === null ? undefined : canonicalJson(p.payload)}
        />
      ))}
    </div>
  )
}
