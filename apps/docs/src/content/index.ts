/**
 * The content layer — every string this site states about the product, in one
 * place, the way the landing does it.
 *
 * `APP_INFO` is re-exported rather than restated: it is the ONE source of
 * product identity strings across mobile, web and the landing, and a docs site
 * that retyped the name or the pitch would be the fourth copy to drift. What
 * is docs-specific — the page's own labels — sits below it, and everything
 * about the API itself comes from the document, never from here.
 */
export { APP_INFO } from '@tenda/shared/app-info'

/** Section labels. The API's own words come from the document, not from this file. */
export const DOCS_COPY = {
  guarantees: 'What this contract guarantees',
  responses: 'Responses',
  parameters: 'Parameters',
  requestBody: 'Request body',
  sampleRecorded: 'Recorded from a real exchange',
  sampleDerived: 'Shaped from the schema',
  runLabel: 'Run',
  runningLabel: 'Running…',
  runHint: 'Runs against the demo agent — no wallet, no key.',
} as const
