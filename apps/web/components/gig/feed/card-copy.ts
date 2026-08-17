/**
 * Card strings. Separate from FEED_COPY because the card is reused outside
 * the feed (search results, a poster's other listings) and should not drag
 * the hero and the empty states along with it.
 */
export const GIG_CARD_COPY = {
  /** Approval mode: the poster picks from applications. */
  apply: 'Apply',
  /** Direct mode: taking it starts the work. */
  accept: 'Accept',
  open: 'Open',
  closingSoon: 'Closing soon',
  ratingLabel: (score: string) => `Rated ${score} out of 5`,
} as const
