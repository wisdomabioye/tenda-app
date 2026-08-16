import { PrivateGigRescue } from '@/components/gig/detail/PrivateGigRescue'

/**
 * The 404 boundary for /gig/[id]. The HTTP status stays 404 — that IS the
 * takedown/draft contract for crawlers and strangers (the anonymous SSR
 * fetch cannot see either). The rescue island then retries with the
 * viewer's bearer: a PARTY gets their draft or hidden escrow in place of
 * this copy; everyone else keeps it.
 */
export default function GigNotFound() {
  return (
    <PrivateGigRescue
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-content-primary">
            Gig not available
          </h1>
          <p className="mt-2 text-sm text-content-secondary">
            This gig may have been removed, or is no longer public.
          </p>
        </div>
      }
    />
  )
}
