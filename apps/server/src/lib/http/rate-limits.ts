/**
 * Per-route rate limits shared by more than one route.
 *
 * The global default (plugins/rate-limit.ts) is 100 a minute per IP. A list
 * read costs a database page of up to MAX_PAGINATION_LIMIT rows, so the public
 * order book states its own ceiling instead of inheriting the one meant for a
 * health check: 60 a minute is 6,000 rows a minute per IP rather than 10,000,
 * and a signed-out reader who pages the book by hand never gets near it.
 *
 * Per IP on purpose. The book is ANONYMOUS (#179), so there is no account to
 * key on, and an account-keyed bucket would only hand a scraper one fresh
 * allowance per free wallet (see docs/unattended-run-findings-2026-10-04.md, G3).
 */
export const PUBLIC_FEED_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const
