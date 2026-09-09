/**
 * The bundle must carry TODAY's document.
 *
 * `src/generated/agent-api.ts` is written from `@tenda/api-doc` before anything
 * compiles, so the only way it can be wrong is by being stale — the package
 * moves and nobody regenerates. That failure is invisible on the page: it
 * renders perfectly, just yesterday's contract.
 *
 * This half lives outside `src/` because it is a NODE test — it runs the
 * generator and reads files — while everything under `src/` compiles as
 * browser code and has no business knowing `node:fs` exists.
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENT_API_DOCUMENT } from '@tenda/api-doc'
import { DOCUMENT_PATH, generateDocument } from '../scripts/generate-document'
import { apiDocument as rendered } from '@/document'

describe('the generated document', () => {
  it('is the one the package builds today, byte for byte', () => {
    // Written to a temp file, never over the real one: a test that repairs the
    // drift it is looking for cannot fail.
    const fresh = generateDocument(join(mkdtempSync(join(tmpdir(), 'tenda-docs-')), 'agent-api.ts'))
    expect(fresh).toBe(readFileSync(DOCUMENT_PATH, 'utf8'))
  })

  it('is the same document the server serves, not a projection of it', () => {
    expect(rendered).toEqual(AGENT_API_DOCUMENT)
  })
})
