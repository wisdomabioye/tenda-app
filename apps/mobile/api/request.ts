/**
 * HTTP core for the typed API client: env-aware base URL, JWT header,
 * timeout via AbortController, and the ApiError envelope → ApiClientError
 * mapping. Endpoint groups live in ./client.
 */
import { apiConfig, type ApiError } from '@tenda/shared'
import { getJwtToken } from '@/lib/secure-store'
import { getEnv } from '@/lib/env'

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    /** Machine-readable ErrorCode from the API envelope. */
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string>,
  query?: Record<string, unknown>,
): string {
  let url = `${base}${path}`

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(value))
    }
  }

  if (query) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  return url
}

export async function request<TResponse>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, string>
    body?: unknown
    query?: Record<string, unknown>
    /**
     * false → force an anonymous call: no Authorization header even when a JWT
     * is stored. Sign-in surfaces need this, the server treats a present
     * bearer on /v1/auth/{challenge,verify} as link intent and hard-401s a
     * stale one, which would poison every retry until storage is cleared.
     */
    auth?: boolean
  },
): Promise<TResponse> {
  const env = getEnv()
  const config = apiConfig[env]
  const url = buildUrl(config.baseUrl, path, options?.params, options?.query)
  const token = options?.auth === false ? null : await getJwtToken()
  const headers: Record<string, string> = {}

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      const error: ApiError = await response.json()
      throw new ApiClientError(error.statusCode, error.error, error.message, error.code)
    }

    return (await response.json()) as TResponse
  } finally {
    clearTimeout(timeoutId)
  }
}
