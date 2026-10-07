// Direct app boot: fastify-cli/helper loads .env unconditionally, masking CI
// configuration failures and potentially connecting tests to a deployment DB.
import './helpers/test-app/env'
import * as test from 'node:test'
import Fastify from 'fastify'
import appPlugin from '../src/app'

export type TestContext = {
  after: typeof test.after
}

// Automatically build and tear down our instance
async function build (t: TestContext) {
  const app = Fastify()
  t.after(() => app.close())
  await app.register(appPlugin)
  await app.ready()

  return app
}

export {
  build
}
