import { NotFoundPanel } from '@/components/public/NotFoundPanel'
import { PrivateGigRescue } from '@/components/gig/detail/PrivateGigRescue'

/**
 * The 404 boundary for /gig/[id]. The HTTP status stays 404 — that IS the
 * takedown/draft contract for crawlers and strangers (the anonymous SSR fetch
 * cannot see either). The rescue island then retries with the viewer's bearer:
 * a PARTY gets their draft or hidden escrow in place of this copy; everyone
 * else keeps it.
 *
 * The copy says the gig is not available and stops there. It does NOT say
 * whether the gig ever existed, was taken down, or is someone's draft —
 * distinguishing those would turn this page into an oracle for exactly the
 * rows the takedown contract hides. The comp's own takedown variant adds
 * "there is nothing to appeal from this page", which is honest and worth
 * saying to the one reader it applies to; it is not said here, because a
 * stranger who mistyped an id is the far commoner visitor and that sentence
 * would tell them a moderation story that never happened.
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
