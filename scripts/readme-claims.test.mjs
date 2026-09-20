import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const repositoryRoot = dirname(fileURLToPath(new URL('../README.md', import.meta.url)))
const manifestSource = readFileSync(new URL('../packages/shared/src/chains/manifest.ts', import.meta.url), 'utf8')
const platformSource = readFileSync(new URL('../packages/shared/src/constants/platform.ts', import.meta.url), 'utf8')

const field = (block, name) => {
  const match = block.match(new RegExp(`^    ${name}: '([^']+)'`, 'm'))
  assert.ok(match, `manifest entry missing ${name}`)
  return match[1]
}

const chainEntries = manifestSource
  .split('\n  {\n')
  .slice(1)
  .map((block) => ({
    displayName: field(block, 'displayName'),
    gasPolicy: field(block, 'gasPolicy'),
    kind: field(block, 'kind'),
    status: field(block, 'status'),
  }))

const basisPoints = (name) => {
  const match = platformSource.match(new RegExp(`^  ${name}: ([0-9_]+),`, 'm'))
  assert.ok(match, `platform defaults missing ${name}`)
  return Number(match[1].replaceAll('_', ''))
}

const titleCase = (value) => value
  .replace(/[-_]/g, ' ')
  .replace(/([A-Z])/g, ' $1')
  .toLowerCase()
  .replace(/^./, (first) => first.toUpperCase())
const percent = (basisPoints) => `${basisPoints / 100}%`

test('README network table mirrors the shared chain manifest', () => {
  assert.ok(chainEntries.length > 0, 'manifest parser found no chain entries')
  for (const chain of chainEntries) {
    const expected = `| ${chain.displayName} | ${titleCase(chain.kind)} | ${titleCase(chain.status)} | ${titleCase(chain.gasPolicy)} |`
    assert.ok(readme.includes(expected), `missing manifest row: ${expected}`)
  }
})

test('README fee snapshot mirrors platform defaults and labels them configurable', () => {
  assert.match(readme, new RegExp(`default platform fee is \\*\\*${percent(basisPoints('fee_bps'))}\\*\\*`))
  assert.match(readme, new RegExp(`\\*\\*${percent(basisPoints('seeker_fee_bps'))} Seeker tier\\*\\*`))
  assert.match(readme, /Both are administrator-configurable/)
})

test('README links every product surface and required section', () => {
  const appLinks = ['mobile', 'web', 'server', 'admin', 'tendahq', 'docs']
  for (const app of appLinks) {
    assert.ok(readme.includes(`apps/${app}`), `missing apps/${app}`)
  }

  const headings = [
    'Why Tenda',
    'What Tenda enables',
    'Human marketplace',
    'Agent-to-human hiring',
    'x402-compatible funding',
    'Gas abstraction and relayers',
    'Proof, settlement and disputes',
    'P2P exchange',
    'Product surfaces',
    'Networks and capability status',
    'Architecture',
    'End-to-end flows',
    'Quick start',
    'Agent integration',
    'Security and trust boundaries',
    'Roadmap',
    'Licensing',
  ]
  for (const heading of headings) {
    assert.ok(readme.includes(`## ${heading}`), `missing section: ${heading}`)
  }
})

test('README relative links resolve to repository files', () => {
  const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g
  const relativeLinks = [...readme.matchAll(markdownLink)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith('http') && !target.startsWith('#'))

  assert.ok(relativeLinks.length > 0, 'README has no relative links to validate')
  for (const target of relativeLinks) {
    assert.ok(existsSync(resolve(repositoryRoot, target)), `broken README link: ${target}`)
  }
})
