import { displayName, type UserRef } from '@tenda/shared'

/**
 * Poster identity as the public feed shows it: name + review average.
 * review_score is numeric(3,2) as a STRING on the wire; parseFloat is for
 * display only, never math.
 */
export function GigCreatorLine({ creator }: { creator: UserRef }) {
  const score = creator.review_score !== null ? Number.parseFloat(creator.review_score) : null
  return (
    <p className="flex items-center gap-2 text-sm text-content-tertiary">
      <span>{displayName(creator.first_name, creator.last_name, creator.id)}</span>
      {score !== null && score > 0 && (
        <span className="font-numeric text-content-secondary" aria-label={`Rated ${score.toFixed(1)} out of 5`}>
          ★ {score.toFixed(1)}
        </span>
      )}
    </p>
  )
}
