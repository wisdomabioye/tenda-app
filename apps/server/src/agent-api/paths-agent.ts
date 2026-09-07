/**
 * Agent API v1 path items: the write surface. THREE operations, all POST,
 * spelled from the shared route map so they cannot drift from the server; the
 * drift test proves each is served and that the live 402/201 bodies validate
 * against the closed schemas in ./schemas-agent.
 *
 * Two of them take a body and mint or spend a session (#19). The third takes
 * NOTHING (#108): a demo bearer, for the reader who has no wallet to prove and
 * would otherwise meet a 401 at the only endpoint that matters.
 */
import { X402_VERSION, X_PAYMENT_HEADER, X_PAYMENT_RESPONSE_HEADER, apiRoutes } from '@tenda/shared'
import { errorResponse, json, type ParameterObject, type PathItem } from './paths'
import { ref } from './schema-types'

const BEARER = [{ bearer: [] as const }] as const

const paymentHeader: ParameterObject = {
  name: X_PAYMENT_HEADER,
  in: 'header',
  required: false,
  description:
    `Absent on the first call (answers 402 with the terms). On the resend: base64 JSON { x402Version: ${X402_VERSION}, scheme, network, payload } where payload is the EVM { signature, authorization } or the Solana { transaction } the terms asked for.`,
  schema: { type: 'string' },
}

export const AGENT_API_V1_PATHS: Readonly<Record<string, PathItem>> = {
  [apiRoutes.agent.demoSession]: {
    post: {
      operationId: 'agentDemoSession',
      summary: 'START HERE if you have no wallet: a bearer for the shared demo agent',
      description:
        'No body, no signature, no account needed. Answers the same { token, user, is_new } a registration does, so the very next call can carry `Authorization: Bearer <token>` and see the real 402 terms and the real 201 straight away. The account is SHARED and rate-limited, and it is a demo in one specific sense: it can be quoted terms and it can hold drafts, but it cannot fund anything, because funding needs an EIP-3009 signature from the key behind the demo address and this server does not hold that key. Nothing it posts reaches the public feed either — a task stays a draft until a confirmed on-chain create, and the feed shows only open ones. To post work that a person can actually accept, register your own wallet with POST ' +
        `${apiRoutes.agent.register}. Answers 503 where a deployment offers no demo.`,
      tags: ['agent'],
      responses: {
        '200': { description: 'A bearer for the shared demo agent', content: json(ref('AgentRegisterResponse')) },
        '503': errorResponse(`No demo on this deployment: either no demo address is configured, or the one configured belongs to a person's account. Both are the operator's to fix — POST ${apiRoutes.agent.register} works regardless`),
      },
    },
  },
  [apiRoutes.agent.register]: {
    post: {
      operationId: 'registerAgent',
      summary: 'Create (or sign in) an agent account by wallet proof',
      description:
        `POST ${apiRoutes.auth.nonce} for a nonce and build the auth message it describes, sign it with the agent's key, then send that proof here with a display name. A wallet linked to no account creates an is_agent account and links the wallet as primary (is_new: true); a wallet already linked to an agent signs it in (is_new: false); a wallet that belongs to a person is refused with 409 IDENTITY_ALREADY_LINKED. The token is the bearer for every write; POST ${apiRoutes.auth.verify} with method "wallet" signs the agent back in later.`,
      tags: ['agent'],
      requestBody: { required: true, content: json(ref('AgentRegisterBody')) },
      responses: {
        '200': { description: 'The session and the agent\'s account', content: json(ref('AgentRegisterResponse')) },
        '400': errorResponse('A missing or malformed field, or an auth message that does not parse / was signed for another chain or address'),
        '401': errorResponse('The signature does not verify, or the nonce is unknown or expired'),
        '403': errorResponse('The agent account is suspended'),
        '409': errorResponse('IDENTITY_ALREADY_LINKED: the wallet belongs to a human account; or AUTH_NONCE_REPLAY: the nonce was already spent'),
      },
    },
  },
  [apiRoutes.agent.tasks]: {
    post: {
      operationId: 'postAgentTask',
      summary: 'Post a task in one call: terms → 402 → signed resend → funded',
      description:
        `The escrow terms and the listing in one body. Without ${X_PAYMENT_HEADER} the server mints the draft (idempotent on creation_operation_id), attaches and moderates the listing, and answers 402 with accepts[0]: what to sign (EVM: eth_signTypedData_v4 over typed_data; Solana: one ed25519 signature over transaction) and task_id. Resend the SAME body with ${X_PAYMENT_HEADER} and the server verifies the artifact against the terms the draft yields now, simulates, relays with its own wallet paying gas, records the attempt and answers 201; ${X_PAYMENT_RESPONSE_HEADER} carries base64 { success, transaction, network, payer }. The task is a draft until the chain confirms — poll GET /v1/gigs/{id} with that task_id and the bearer (it answers the creator's own draft) until status is open, when the listing is public. Agent accounts only. Values in the example are from the capture that produced it, not defaults: take chain_id and asset from GET ${apiRoutes.platform.chains}.`,
      tags: ['agent'],
      security: BEARER,
      parameters: [paymentHeader],
      requestBody: { required: true, content: json(ref('AgentTaskBody')) },
      responses: {
        '402': { description: 'The x402 terms bound to the task\'s draft — sign and resend', content: json(ref('AgentTaskPaymentRequired')) },
        '201': {
          description: 'Relayed and recorded; the task is a draft until confirmed',
          content: json(ref('AgentTaskCreated')),
          headers: {
            [X_PAYMENT_RESPONSE_HEADER]: {
              description: 'base64 JSON { success, transaction, network, payer } — the settlement receipt for the relayed transaction',
              schema: { type: 'string' },
            },
          },
        },
        '400': errorResponse(`A malformed ${X_PAYMENT_HEADER} header, a listing field the validator refuses, or CONTENT_MODERATED`),
        '401': errorResponse('No or invalid bearer'),
        '403': errorResponse('Not an agent account, a wallet missing on the chain (WALLET_REQUIRED), or a standing restriction'),
        '409': errorResponse('creation_operation_id reused with different terms — including a different accept_window_seconds, which #41 made comparable by moving the caller from an absolute deadline to a duration — or the draft already left the draft state / has a create in flight'),
        '422': errorResponse('Escrow terms the validator refuses, a signer_address that is not a linked wallet, an assigned_counterparty_id with no wallet on the chain (ASSIGNEE_WALLET_REQUIRED), RELAY_REJECTED (the artifact does not match the terms, signature, window or simulation) or RELAY_UNAVAILABLE (the asset cannot fund by signature)'),
        '503': errorResponse('RELAY_UNAVAILABLE: the chain has no relayer configured'),
      },
    },
  },
}
