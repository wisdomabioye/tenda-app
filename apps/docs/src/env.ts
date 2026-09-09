/**
 * Which deployment the Run console talks to.
 *
 * The document itself is baked in at build time and needs no server; this is
 * only for the console, which sends real requests. Read from the environment
 * the same way the landing reads its own, so a docs build for staging and one
 * for production differ by a variable rather than by a code change.
 *
 * The fallback is the local server: a contributor running `pnpm dev` with no
 * env file gets a console pointed at their own API rather than at production.
 */
const LOCAL_API = 'http://localhost:3000'

export function apiBaseUrl(env: ImportMetaEnv = import.meta.env): string {
  const configured = env.VITE_API_BASE_URL
  return typeof configured === 'string' && configured.length > 0
    ? configured.replace(/\/+$/, '')
    : LOCAL_API
}
