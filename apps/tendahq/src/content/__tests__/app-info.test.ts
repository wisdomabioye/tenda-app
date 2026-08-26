import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_INFO } from '../app-info'
import { CHAIN_NAMES_LINE } from '../chains'

const SOURCE = readFileSync(fileURLToPath(new URL('../app-info.ts', import.meta.url)), 'utf8')

describe('release facts', () => {
  /**
   * `bump-version.mjs` rewrites this file with `replaceOnce` over a regex
   * matching the key followed by a quoted string, and `check-app-version.mjs`
   * reads it the same way — both throw on zero or two matches. A second quoted
   * occurrence anywhere, INCLUDING IN A COMMENT, breaks the release. That is
   * not hypothetical: adding a docstring that spelled the quoted form is
   * exactly how it broke while this file was being restructured.
   */
  it('keeps exactly one quoted version and one quoted apkUrl in the whole file', () => {
    expect(SOURCE.match(/version:\s*'[^']*'/g)).toHaveLength(1)
    expect(SOURCE.match(/apkUrl:\s*'[^']*'/g)).toHaveLength(1)
  })

  it('derives the stage from the version suffix', () => {
    const suffix = APP_INFO.version.includes('-') ? APP_INFO.version.split('-').slice(1).join('-') : ''
    expect(APP_INFO.chains.stage).toBe(suffix === '' ? 'mainnet' : `${suffix} release`)
  })

  it('strips the qualifier from the display version', () => {
    expect(APP_INFO.versionNumber).toBe(APP_INFO.version.split('-')[0])
    expect(APP_INFO.versionNumber).not.toContain('-')
  })

  it('advertises an APK whose filename matches the version it claims to be', () => {
    expect(APP_INFO.apkUrl).toContain(APP_INFO.version)
  })

  it('derives the network line from the chain manifest', () => {
    expect(APP_INFO.chains.networksLine).toBe(CHAIN_NAMES_LINE)
    expect(APP_INFO.about).toContain(CHAIN_NAMES_LINE)
  })

  /**
   * The FAQ tells readers the source is open and forkable, which is only true
   * with somewhere to read it. '#' was the value that made that a dead promise.
   */
  it('points the source links somewhere real', () => {
    for (const url of [APP_INFO.githubUrl, APP_INFO.chains.contractsUrl]) {
      expect(url).toMatch(/^https:\/\//)
    }
  })
})
