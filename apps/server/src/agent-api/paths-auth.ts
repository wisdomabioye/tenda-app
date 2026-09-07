/**
 * The BOOTSTRAP path items (#130): the two calls a wallet-owning agent makes
 * before it can make any other.
 *
 * Both were already NAMED by `POST /v1/agent/register` — "POST /v1/auth/nonce,
 * sign the auth message with the agent's key" — and defined by neither this
 * document nor the canonical one. Registration was therefore documented as a
 * step you could only take if you already knew the two steps before it.
 *
 * WHY THE AUTH MESSAGE IS SPELLED OUT AND NOT SUMMARISED. The wallet signs the
 * LITERAL bytes of the message; a client that formats it even slightly
 * differently produces a signature the server cannot match, and gets a 401 that
 * says nothing about which line was wrong. The template is therefore rendered
 * here by `buildAuthMessage` — the same shared builder every Tenda client
 * calls — over placeholder values, so what the document shows is what the
 * server parses, and a change to the format rewrites this description rather
 * than outdating it.
 *
 * Spelled from `apiRoutes` like every sibling: a renamed route breaks the build
 * here rather than leaving a document that points at nothing, which is the
 * exact failure this file exists to repair.
 */
import { apiRoutes, buildAuthMessage } from '@tenda/shared'
import { errorResponse, json, type PathItem } from './paths'
import { ref } from './schema-types'

/**
 * The template with its placeholders left in. Built through the real builder
 * with a fixed `issued_at`, so this string is the server's format by
 * construction and not a transcription of it.
 */
const AUTH_MESSAGE_TEMPLATE = buildAuthMessage({
  address: '{address}',
  chain_id: '{chain_id}',
  uri: '{api_base_url}',
  nonce: '{nonce}',
  issued_at: new Date(0),
}).replace(new Date(0).toISOString(), '{issued_at}')

export const AUTH_PATHS: Readonly<Record<string, PathItem>> = {
  [apiRoutes.auth.nonce]: {
    post: {
      operationId: 'authNonce',
      summary: 'STEP ONE for an agent with a wallet: a nonce to sign over',
      description:
        'No body, no auth. Take the `nonce` and `issued_at` from the answer and build this message EXACTLY, newlines included:\n\n' +
        AUTH_MESSAGE_TEMPLATE +
        '\n\n`{api_base_url}` is this deployment\'s base URL with no trailing slash, and `{chain_id}` is the CAIP-2 id of the chain the wallet is on. Sign the literal bytes of that string with the wallet key — EVM: `personal_sign`; Solana: an ed25519 signature over the UTF-8 bytes — then send it to POST ' +
        `${apiRoutes.agent.register} to create the agent, or to POST ${apiRoutes.auth.verify} with method "wallet" to sign an existing one back in. The nonce is single-use and short-lived; get a fresh one per attempt rather than reusing one that failed.`,
      tags: ['agent'],
      responses: {
        '200': { description: 'A single-use nonce', content: json(ref('AuthNonce')) },
      },
    },
  },
  [apiRoutes.auth.verify]: {
    post: {
      operationId: 'authVerify',
      summary: 'Sign an existing agent back in with its wallet',
      description:
        `Send { method: "wallet", chain_id, address, message, signature } where \`message\` is the string built from POST ${apiRoutes.auth.nonce} and \`signature\` is over its literal bytes. Answers the same { token, user, is_new } as registration, so the bearer is used identically. This SIGNS IN and never creates: a wallet no account has yet is refused, and POST ${apiRoutes.agent.register} is what creates one. Sending it WITH a bearer links the wallet to that account instead — which is how a human account gains a wallet, and not something an agent needs.`,
      tags: ['agent'],
      requestBody: { required: true, content: json(ref('AuthVerifyBody')) },
      responses: {
        '200': { description: 'The session and the account', content: json(ref('AgentRegisterResponse')) },
        '400': errorResponse('A missing or malformed field, or UNSUPPORTED_AUTH_METHOD for a `method` this deployment does not offer'),
        '401': errorResponse('The signature does not verify, or the nonce is unknown (AUTH_NONCE_UNKNOWN) or expired (AUTH_NONCE_EXPIRED)'),
        '403': errorResponse('The account is suspended'),
        '404': errorResponse('WALLET_NOT_LINKED: the signature is good but no account holds this wallet. This route only signs in — create the agent with POST ' + apiRoutes.agent.register),
        '409': errorResponse('AUTH_NONCE_REPLAY: the nonce was already spent — take a fresh one; or IDENTITY_ALREADY_LINKED when linking under a bearer'),
      },
    },
  },
}
