# @tenda/shared

Shared code consumed by both the server and mobile app. Single source of truth for types, database schema, API contracts, constants, and utilities.

## Structure

```
src/
  types/        TypeScript interfaces (User, Gig, Review, Chat, ...)
  db/
    schema.ts   Drizzle ORM schema (authoritative — migrate from here)
  api/
    contracts/  Typed endpoint definitions per resource
    routes.ts   All API route paths
  constants/
    errors.ts   ErrorCode constants
  utils/        Pure helper functions (gig-utils, currency, ...)
```

## Usage

```ts
// Types + utilities
import type { Gig, GigDetail, User } from '@tenda/shared'
import { canAddProof, canDispute } from '@tenda/shared'

// DB schema (server only)
import { gigs, users, gig_proofs } from '@tenda/shared/db/schema'
```

## Important

**Always rebuild after changes:**

```bash
pnpm --filter @tenda/shared build
```

The server and mobile resolve imports from `dist/`. Stale output will cause type mismatches and runtime errors.

## Exports

| Path | Contents |
|---|---|
| `@tenda/shared` | Types, utilities, constants, API contracts |
| `@tenda/shared/db/schema` | Drizzle table definitions |
