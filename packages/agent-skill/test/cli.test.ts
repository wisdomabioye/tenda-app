/**
 * npx @tenda/agent-skill: install the packaged skill into an agent's skills
 * folder. The last test spawns the real bin, because that is what npx runs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cli = require('../bin/cli.cjs') as typeof import('../bin/cli.cjs')

function io() {
  const out: string[] = []
  const err: string[] = []
  return { out, err, io: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } }
}
const tmp = () => mkdtempSync(join(tmpdir(), 'tenda-skill-'))

test('install copies SKILL.md, generated.json and the scripts, byte for byte', () => {
  const dir = join(tmp(), 'skills', cli.SKILL_NAME)
  const h = io()
  assert.equal(cli.main(['install', '--dir', dir], h.io), 0)
  for (const file of ['SKILL.md', 'generated.json', 'scripts/lib.cjs', 'scripts/tenda.cjs']) {
    assert.equal(readFileSync(join(dir, file), 'utf8'), readFileSync(join(cli.SKILL_DIR, file), 'utf8'), file)
  }
  assert.match(h.out[0], /installed tenda-hire-a-human/)
  rmSync(dir, { recursive: true, force: true })
})

test('install refuses to overwrite without --force, and --force replaces it (stale files go)', () => {
  const dir = join(tmp(), 'skill')
  assert.equal(cli.main(['install', '--dir', dir], io().io), 0)
  writeFileSync(join(dir, 'stale.txt'), 'old')
  const refused = io()
  assert.equal(cli.main(['install', '--dir', dir], refused.io), 1)
  assert.match(refused.err[0], /already exists.*--force/)
  assert.ok(existsSync(join(dir, 'stale.txt')), 'a refusal changes nothing')
  assert.equal(cli.main(['install', '--dir', dir, '--force'], io().io), 0)
  assert.ok(!existsSync(join(dir, 'stale.txt')), '--force replaces the folder')
  assert.deepEqual(readdirSync(dir).sort(), ['SKILL.md', 'generated.json', 'scripts'])
})

test('--dir with no path is a usage error, not a write to a path named "--force"', () => {
  const h = io()
  assert.equal(cli.main(['install', '--dir'], h.io), 1)
  assert.match(h.err[0], /--dir needs a path/)
  assert.equal(cli.main(['install', '--dir', '--force'], h.io), 1)
})

test('print writes SKILL.md; path names the packaged folder', () => {
  const printed = io()
  assert.equal(cli.main(['print'], printed.io), 0)
  assert.equal(printed.out[0], readFileSync(join(cli.SKILL_DIR, 'SKILL.md'), 'utf8'))
  const where = io()
  assert.equal(cli.main(['path'], where.io), 0)
  assert.equal(where.out[0], cli.SKILL_DIR)
})

test('no command prints usage and exits 0; an unknown command exits 1', () => {
  assert.equal(cli.main([], io().io), 0)
  assert.equal(cli.main(['--help'], io().io), 0)
  const bad = io()
  assert.equal(cli.main(['frobnicate'], bad.io), 1)
  assert.match(bad.err[0], /^usage:/)
})

test('the real bin (what npx runs) installs, and the installed helper runs and prints its usage', () => {
  const dir = join(tmp(), 'real')
  const bin = join(__dirname, '..', 'bin', 'cli.cjs')
  const installed = spawnSync('node', [bin, 'install', '--dir', dir], { encoding: 'utf8' })
  assert.equal(installed.status, 0, installed.stderr)
  const helper = spawnSync('node', [join(dir, 'scripts', 'tenda.cjs'), 'help'], { encoding: 'utf8' })
  assert.equal(helper.status, 0, helper.stderr)
  assert.match(helper.stdout, /Never signs; you sign/)
  const unconfigured = spawnSync('node', [join(dir, 'scripts', 'tenda.cjs'), 'chains'], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  assert.equal(unconfigured.status, 1)
  assert.match(unconfigured.stderr, /TENDA_API/)
})
