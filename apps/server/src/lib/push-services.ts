/**
 * S5.1 (closes open #84): native push services + per-platform routing,
 * replacing Expo as the sole delivery path. Expo remains the fallback for
 * tokens registered by older app builds.
 *
 * Provider notes (deviations from the stage doc, both forced by vendor
 * reality):
 *   - FCM: the legacy server-key API (`FCM_SERVER_KEY`) was retired by
 *     Google in 2024 — this uses HTTP v1 with a service-account OAuth
 *     token, minted from a hand-rolled RS256 JWT (node:crypto; no
 *     google-auth-library dependency).
 *   - APNs: requires HTTP/2 — node:http2 directly (undici fetch doesn't
 *     speak h2 to APNs); auth is the p8 token scheme (ES256 JWT, reused
 *     for up to 50 minutes per Apple guidance).
 *
 * All transports sit behind seams so the JWT/claims/routing logic is unit
 * tested offline; live delivery needs the #53 credentials.
 */

import { createSign, sign as cryptoSign } from 'node:crypto'
import type { PushService } from '@server/chains/types'

// ---------- shared types ------------------------------------------------------

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushLogger {
  warn(obj: Record<string, unknown>, msg: string): void
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

// ---------- FCM (HTTP v1) ------------------------------------------------------

export interface FcmServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export const FCM_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
/** Access tokens last 3600s; refresh with headroom. */
export const FCM_TOKEN_REFRESH_MS = 50 * 60_000

/** RS256 service-account JWT for the OAuth token exchange (pure). */
export function buildFcmAssertion(account: FcmServiceAccount, now_ms: number): string {
  const iat = Math.floor(now_ms / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: FCM_TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(account.private_key)
  return `${header}.${claims}.${b64url(signature)}`
}

export interface FcmTransport {
  /** Exchange the signed assertion for an access token. */
  exchangeToken(assertion: string): Promise<{ access_token: string }>
  /** POST one message; throws on non-2xx except 404 (token gone). */
  send(args: {
    project_id: string
    access_token: string
    token: string
    payload: PushPayload
  }): Promise<'ok' | 'unregistered'>
}

export function fcmHttpTransport(): FcmTransport {
  return {
    async exchangeToken(assertion) {
      const res = await fetch(FCM_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      })
      if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status}`)
      return (await res.json()) as { access_token: string }
    },
    async send({ project_id, access_token, token, payload }) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access_token}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              ...(payload.data !== undefined ? { data: payload.data } : {}),
            },
          }),
        },
      )
      if (res.status === 404) return 'unregistered'
      if (!res.ok) throw new Error(`FCM send failed: ${res.status}`)
      return 'ok'
    },
  }
}

export function fcmPushService(args: {
  account: FcmServiceAccount
  transport: FcmTransport
  log: PushLogger
  now(): number
}): PushService {
  let cached: { access_token: string; fetched_at: number } | null = null

  async function accessToken(): Promise<string> {
    const now = args.now()
    if (cached !== null && now - cached.fetched_at < FCM_TOKEN_REFRESH_MS) {
      return cached.access_token
    }
    const { access_token } = await args.transport.exchangeToken(
      buildFcmAssertion(args.account, now),
    )
    cached = { access_token, fetched_at: now }
    return access_token
  }

  return {
    async send({ tokens, title, body, data }) {
      let ok = 0
      let failed = 0
      const token = await accessToken()
      for (const t of tokens) {
        try {
          const result = await args.transport.send({
            project_id: args.account.project_id,
            access_token: token,
            token: t,
            payload: { title, body, ...(data !== undefined ? { data } : {}) },
          })
          if (result === 'ok') ok += 1
          else failed += 1 // unregistered — caller prunes via failed count
        } catch (err) {
          failed += 1
          args.log.warn({ err }, 'fcm send failed')
        }
      }
      return { ok, failed }
    },
  }
}

// ---------- APNs (token auth) ----------------------------------------------------

export interface ApnsCredentials {
  key_id: string
  team_id: string
  /** ES256 private key (p8 contents). */
  private_key: string
  /** App bundle id — the apns-topic header. */
  topic: string
}

/** Apple: reuse a provider token for 20–60 minutes; refresh at 50. */
export const APNS_TOKEN_REFRESH_MS = 50 * 60_000

/** ES256 provider JWT (pure). */
export function buildApnsJwt(creds: ApnsCredentials, now_ms: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: creds.key_id }))
  const claims = b64url(
    JSON.stringify({ iss: creds.team_id, iat: Math.floor(now_ms / 1000) }),
  )
  const signature = cryptoSign('sha256', Buffer.from(`${header}.${claims}`), {
    key: creds.private_key,
    dsaEncoding: 'ieee-p1363',
  })
  return `${header}.${claims}.${b64url(signature)}`
}

export interface ApnsTransport {
  /** POST one notification over HTTP/2; 410 = token gone. */
  send(args: {
    jwt: string
    topic: string
    token: string
    payload: PushPayload
  }): Promise<'ok' | 'unregistered'>
}

export function apnsHttp2Transport(host = 'https://api.push.apple.com'): ApnsTransport {
  return {
    send({ jwt, topic, token, payload }) {
      return new Promise((resolve, reject) => {
        // Lazy import keeps node:http2 out of test paths entirely.
        import('node:http2')
          .then((http2) => {
            const client = http2.connect(host)
            client.on('error', reject)
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              'apns-topic': topic,
              'apns-push-type': 'alert',
            })
            req.setEncoding('utf8')
            let status = 0
            req.on('response', (headers) => {
              status = Number(headers[':status'] ?? 0)
            })
            req.on('close', () => {
              client.close()
              if (status >= 200 && status < 300) resolve('ok')
              else if (status === 410) resolve('unregistered')
              else reject(new Error(`APNs responded ${status}`))
            })
            req.end(
              JSON.stringify({
                aps: { alert: { title: payload.title, body: payload.body } },
                ...(payload.data ?? {}),
              }),
            )
          })
          .catch(reject)
      })
    },
  }
}

export function apnsPushService(args: {
  creds: ApnsCredentials
  transport: ApnsTransport
  log: PushLogger
  now(): number
}): PushService {
  let cached: { jwt: string; minted_at: number } | null = null

  function jwt(): string {
    const now = args.now()
    if (cached !== null && now - cached.minted_at < APNS_TOKEN_REFRESH_MS) return cached.jwt
    cached = { jwt: buildApnsJwt(args.creds, now), minted_at: now }
    return cached.jwt
  }

  return {
    async send({ tokens, title, body, data }) {
      let ok = 0
      let failed = 0
      for (const t of tokens) {
        try {
          const result = await args.transport.send({
            jwt: jwt(),
            topic: args.creds.topic,
            token: t,
            payload: { title, body, ...(data !== undefined ? { data } : {}) },
          })
          if (result === 'ok') ok += 1
          else failed += 1
        } catch (err) {
          failed += 1
          args.log.warn({ err }, 'apns send failed')
        }
      }
      return { ok, failed }
    },
  }
}

// ---------- per-platform router ------------------------------------------------

export type DevicePlatform = 'expo' | 'fcm' | 'apns'

export interface PlatformToken {
  token: string
  platform: DevicePlatform
}

export interface PushRouterDeps {
  /** Missing platform = provider unconfigured → tokens counted failed. */
  services: Partial<Record<DevicePlatform, PushService>>
  log: PushLogger
}

/**
 * Split tokens by platform and dispatch to each configured service.
 * Unconfigured platforms degrade loudly (logged + counted failed) — never
 * silently dropped.
 */
export async function routePush(
  deps: PushRouterDeps,
  tokens: ReadonlyArray<PlatformToken>,
  payload: PushPayload,
): Promise<{ ok: number; failed: number }> {
  const grouped = new Map<DevicePlatform, string[]>()
  for (const t of tokens) {
    const list = grouped.get(t.platform) ?? []
    list.push(t.token)
    grouped.set(t.platform, list)
  }

  let ok = 0
  let failed = 0
  for (const [platform, list] of grouped) {
    const service = deps.services[platform]
    if (service === undefined) {
      failed += list.length
      deps.log.warn({ platform, count: list.length }, 'push: provider not configured')
      continue
    }
    const result = await service.send({ tokens: list, title: payload.title, body: payload.body, ...(payload.data !== undefined ? { data: payload.data } : {}) })
    ok += result.ok
    failed += result.failed
  }
  return { ok, failed }
}

// ---------- config → services builder (the #33 worker composes via this) -------

import type { Config } from '@server/config'
import { sendPush } from '@server/lib/push'

export function buildPushServices(
  config: Pick<
    Config,
    'FCM_SERVICE_ACCOUNT_B64' | 'APNS_KEY_ID' | 'APNS_TEAM_ID' | 'APNS_PRIVATE_KEY_B64' | 'APNS_TOPIC'
  >,
  log: PushLogger & { error(obj: object, msg: string): void },
): Partial<Record<DevicePlatform, PushService>> {
  const services: Partial<Record<DevicePlatform, PushService>> = {
    // Expo stays available as the legacy-build fallback (S5.1).
    expo: {
      async send({ tokens, title, body, data }) {
        const invalid = await sendPush([...tokens], { title, body, data }, log)
        return { ok: tokens.length - invalid.length, failed: invalid.length }
      },
    },
  }

  if (config.FCM_SERVICE_ACCOUNT_B64 !== null) {
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(config.FCM_SERVICE_ACCOUNT_B64, 'base64').toString(),
      )
      const account = parsed as FcmServiceAccount
      if (
        typeof account.project_id === 'string' &&
        typeof account.client_email === 'string' &&
        typeof account.private_key === 'string'
      ) {
        services.fcm = fcmPushService({
          account,
          transport: fcmHttpTransport(),
          log,
          now: () => Date.now(),
        })
      } else {
        log.warn({}, 'FCM_SERVICE_ACCOUNT_B64 missing required fields — fcm disabled')
      }
    } catch (err) {
      log.warn({ err }, 'FCM_SERVICE_ACCOUNT_B64 is not valid base64 JSON — fcm disabled')
    }
  }

  if (
    config.APNS_KEY_ID !== null &&
    config.APNS_TEAM_ID !== null &&
    config.APNS_PRIVATE_KEY_B64 !== null &&
    config.APNS_TOPIC !== null
  ) {
    services.apns = apnsPushService({
      creds: {
        key_id: config.APNS_KEY_ID,
        team_id: config.APNS_TEAM_ID,
        private_key: Buffer.from(config.APNS_PRIVATE_KEY_B64, 'base64').toString(),
        topic: config.APNS_TOPIC,
      },
      transport: apnsHttp2Transport(),
      log,
      now: () => Date.now(),
    })
  }

  return services
}
