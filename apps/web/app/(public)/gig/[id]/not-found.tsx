import { NotFoundPanel } from '@/components/public/NotFoundPanel'
import { PrivateGigRescue } from '@/components/gig/detail/PrivateGigRescue'

/**
 * The 404 boundary for /gig/[id]. The HTTP status stays 404 — that IS the
 * takedown/draft contract for crawlers and strangers (the anonymous SSR fetch
 * cannot see either). The rescue island then retries with the viewer's bearer:
 * a PARTY gets their draft or hidden escrow in place of this copy; everyone
 * else keeps it.
 *
 * KNOWN, MEASURED: with JavaScript off this page is blank. Next defers the
 * whole not-found boundary into the RSC flight payload when `notFound()` is
 * thrown from a dynamic page — verified by removing this file entirely and
 * watching the ROOT boundary go blank the same way, while `/nowhere-at-all`
 * (an unmatched route, no `notFound()` call) renders its copy into the DOM.
 * So it is not this file's shape: moving the panel into a server component
 * beside the rescue was tried and changed nothing. The two ways out both cost
 * something real — dropping `notFound()` would render the copy at HTTP 200 and
 * give up the 404 the takedown contract depends on — so the status is kept and
 * the gap is tracked rather than traded away. Third instance of the trap this
 * app documents for `loading.tsx` and `error.tsx`.
 *
 * The copy says the gig is not available and stops there. It does NOT say
 * whether the gig ever existed, was taken down, or is someone's draft —
 * distinguishing those would turn this page into an oracle for exactly the
 * rows the takedown contract hides. The comp's own takedown variant adds
 * "there is nothing to appeal from this page", which is honest for the one
 * reader it applies to; it is not said here, because a stranger who mistyped
 * an id is the far commoner visitor and that sentence would tell them a
 * moderation story that never happened.
 */
export default function GigNotFound() {
  return (
    <PrivateGigRescue
      fallback={
        <NotFoundPanel
          code="404"
          heading="This gig is not available"
          body="It may have been completed, refunded or taken down. Everything still open is in the feed."
        />
      }
    />
  )
}
