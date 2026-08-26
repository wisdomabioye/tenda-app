/**
 * Tests for resolve-eas-profile.mjs — the guard that stops a release building
 * the wrong app, or the right app in the wrong container.
 *
 * The last case is the one that motivated the script: `production` exists and
 * looks like the obvious mainnet profile, but it builds an app-bundle, and the
 * workflow's own artifact check (`starts with PK`) passes for an .aab. Nothing
 * downstream would catch it, so it has to be caught here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { profileForSuffix, effectiveBuildType, resolveEasProfile } from './resolve-eas-profile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FIXTURE = {
  build: {
    preview: { android: { buildType: 'apk' } },
    testnet: { extends: 'preview' },
    mainnet: { android: { buildType: 'apk' } },
    production: { android: { buildType: 'app-bundle' } },
    defaulted: {},
  },
}

test('a suffix names the profile of the same name', () => {
  assert.equal(profileForSuffix('testnet'), 'testnet')
  assert.equal(profileForSuffix('beta'), 'beta')
})

test('an empty or whitespace suffix is the mainnet release', () => {
  assert.equal(profileForSuffix(''), 'mainnet')
  assert.equal(profileForSuffix('   '), 'mainnet')
})

test('a non-string suffix is rejected rather than coerced', () => {
  assert.throws(() => profileForSuffix(undefined), /must be a string/)
  assert.throws(() => profileForSuffix(null), /must be a string/)
})

test('buildType is followed through an extends chain', () => {
  assert.equal(effectiveBuildType(FIXTURE.build, 'testnet'), 'apk')
})

test('a profile with no buildType anywhere in its chain resolves to undefined', () => {
  assert.equal(effectiveBuildType(FIXTURE.build, 'defaulted'), undefined)
})

test('a circular extends chain throws instead of hanging the release', () => {
  const build = { a: { extends: 'b' }, b: { extends: 'a' } }
  assert.throws(() => effectiveBuildType(build, 'a'), /circular extends/)
})

test('an unknown profile in a chain names the missing link', () => {
  const build = { a: { extends: 'ghost' } }
  assert.throws(() => effectiveBuildType(build, 'a'), /"ghost" does not exist/)
})

test('resolves the testnet release to the testnet profile', () => {
  assert.equal(resolveEasProfile('testnet', FIXTURE), 'testnet')
})

test('resolves the plain release to the mainnet profile', () => {
  assert.equal(resolveEasProfile('', FIXTURE), 'mainnet')
})

test('a suffix with no matching profile is refused before the build starts', () => {
  assert.throws(
    () => resolveEasProfile('canary', FIXTURE),
    /needs a build profile named "canary"/,
  )
})

/** The trap this script exists for: right profile name, wrong artifact type. */
test('an app-bundle profile is refused because the workflow publishes an .apk', () => {
  const bundled = { build: { ...FIXTURE.build, mainnet: { android: { buildType: 'app-bundle' } } } }
  assert.throws(() => resolveEasProfile('', bundled), /not "apk"/)
})

test('a profile that never declares a buildType is refused too', () => {
  assert.throws(() => resolveEasProfile('defaulted', FIXTURE), /not "apk"/)
})

test('eas.json with no build section fails with a clear message', () => {
  assert.throws(() => resolveEasProfile('', {}), /no "build" section/)
})

/**
 * Contract test against the real file: both suffixes the project actually
 * ships must resolve today, or a release is already broken and nobody knows.
 */
test('the repo eas.json satisfies both the testnet and the mainnet release', () => {
  const easJson = JSON.parse(readFileSync(resolve(ROOT, 'apps/mobile/eas.json'), 'utf8'))
  assert.equal(resolveEasProfile('testnet', easJson), 'testnet')
  assert.equal(resolveEasProfile('', easJson), 'mainnet')
})
