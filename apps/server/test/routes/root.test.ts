import '../helpers/boot-env'
import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'
import { TEST_DB_CONFIGURED, useSuiteLock } from '../helpers/test-app'

useSuiteLock()

test('default root route', { skip: !TEST_DB_CONFIGURED }, async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/'
  })
  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(JSON.parse(res.payload), { status: 'ok' })
})
