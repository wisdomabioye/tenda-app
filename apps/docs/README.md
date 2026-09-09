# tenda-docs — the Agent API, rendered

The public reference for `POST /v1/agent/tasks` and the rest of the agent
surface. It is **generated from the document the API actually serves**, so
there is no second description to keep in step.

## How it works

`pnpm generate` imports `@tenda/api-doc` in Node and writes
`src/generated/agent-api.ts` — the same object the server returns at
`/v1/openapi.json`, typed as `OpenApiDocument`. Every script runs it first, so
the page always renders today's contract.

The page writes nothing of its own: the walkthrough is the document's
`info.description` (CommonMark, rendered with `marked`), the guarantees are its
`x-tenda-stability`, and each endpoint's method, path, auth, parameters and
responses come from its operation object. Editing the docs means editing
`packages/api-doc`.

The generated file is **not committed**. A copy in git is the second
description this design exists to prevent.

## Running it

```bash
pnpm --filter tenda-docs dev        # http://localhost:5173
pnpm --filter tenda-docs build      # → dist/
pnpm --filter tenda-docs preview    # serve the build locally
pnpm --filter tenda-docs test       # vitest
pnpm --filter tenda-docs lint
pnpm --filter tenda-docs type-check
```

## Deploying it

`dist/` is a plain static site with **relative** asset URLs and no server-side
anything, so it works unchanged on any static host — object storage, a CDN, an
nginx directory, GitHub Pages, or a Vercel/Netlify project pointed at this
directory. There is no platform config file here on purpose, and nothing to
assemble by hand.

Point the host at:

- build command: `pnpm --filter tenda-docs build`
- output directory: `apps/docs/dist`
- install command: `pnpm install --frozen-lockfile` (the build needs
  `@tenda/shared` and `@tenda/api-doc` from the workspace)

It is one page with in-page anchors, so it needs **no rewrite rules**: a deep
link is a fragment, and a refresh cannot land on a path the host has to
redirect.

## Tests

- `test/document-drift.test.ts` — the generated copy is what the package builds
  today, byte for byte, and equals the object the server serves. Lives outside
  `src/` because it is a Node test; everything under `src/` compiles as browser
  code.
- `src/__tests__/` — the views over the document: every operation is listed
  exactly once, an operation with an undeclared tag is collected rather than
  dropped, anchors are unique, the description renders as markup rather than
  asterisks, and every stability line is on the page.
