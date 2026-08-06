#!/usr/bin/env node
/**
 * check-app-version.mjs
 *
 * Asserts the app version is identical across app.json (the source of truth),
 * apps/mobile/package.json and the landing page's app-info.ts — including both
 * halves of the APK download URL, whose tag and filename use different formats
 * and can go stale independently.
 *
 * Runs on pre-commit (scoped to those files) and in CI on every PR. Exits
 * non-zero on any mismatch.
 *
 * Usage:  node scripts/check-app-version.mjs
 */

import { assertVersionsConsistent } from './lib/version.mjs'
import { readVersionSources, VERSION_FILES } from './lib/version-files.mjs'

try {
  const { version, versionCode, tag, apk } = assertVersionsConsistent(readVersionSources().sources)
  console.log(`✓ app version consistent across ${Object.values(VERSION_FILES).length} files`)
  console.log(`  ${version} (versionCode ${versionCode}) → tag ${tag}, asset ${apk}`)
} catch (err) {
  console.error(`✗ ${err.message}`)
  console.error('  run `pnpm bump:version <patch|minor|major>` rather than editing by hand')
  process.exit(1)
}
