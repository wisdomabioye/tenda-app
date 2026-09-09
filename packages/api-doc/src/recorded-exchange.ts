/**
 * GENERATED — do not edit. One real x402 exchange, captured through the real
 * route against a real node by
 * test/integration/agent-x402-recording.anvil.test.ts, and published inline in
 * the Agent API document by ./examples.
 *
 * Re-record with `pnpm record:x402` after a DELIBERATE wire change. Editing
 * this file by hand defeats the only property it has: that a reader is looking
 * at something the server actually sent.
 *
 * Captured 2026-09-06.
 */
import type { RecordedExchange } from './examples'

export const RECORDED_EXCHANGE: RecordedExchange = {
  "polled": {
    "escrow_id": "8927daa8-99e2-4168-a3fd-156a6b176920",
    "public_feed_revision": "0",
    "chain_id": "eip155:84532",
    "asset": "USDC_BASE",
    "amount_raw": "25000000",
    "is_seeker": false,
    "status": "draft",
    "hidden": false,
    "accept_deadline": "2026-09-07T13:05:26.482Z",
    "created_at": "2026-09-06T13:05:26.501Z",
    "title": "Photograph the storefront at 12 Broad St",
    "description": null,
    "category": "service",
    "country": "NG",
    "city": "Lagos",
    "latitude": null,
    "longitude": null,
    "remote": false,
    "cross_border": false,
    "proof_requirements": [
      "image"
    ],
    "proof_params": null,
    "creator": {
      "id": "bddee076-21e4-4db2-8c9b-679b5786345c",
      "first_name": "Dispatch Bot",
      "last_name": "",
      "avatar_url": null,
      "review_score": null,
      "is_seeker": false,
      "is_agent": true,
      "country": null
    },
    "completion_duration_seconds": 3600,
    "completion_deadline": null,
    "submitted_at": null,
    "approval_deadline": null,
    "dispute_bond_raw": "0",
    "my_signer_address": null,
    "requires_approval": false,
    "is_assigned": false,
    "assigned_counterparty_id": null,
    "unassign_window_seconds": 21600,
    "assignment_released_at": null,
    "counterparty": null,
    "proofs": [],
    "dispute": null,
    "reviews": [],
    "viewer": {
      "application": null,
      "open_application_count": 0
    }
  },
  "request": {
    "creation_operation_id": "6d6fe978-5ac4-494c-81e6-8546891a0c68",
    "chain_id": "eip155:84532",
    "asset": "USDC_BASE",
    "amount_raw": "25000000",
    "accept_window_seconds": 86400,
    "completion_duration_seconds": 3600,
    "title": "Photograph the storefront at 12 Broad St",
    "category": "service",
    "country": "NG",
    "city": "Lagos",
    "proof_requirements": [
      "image"
    ]
  },
  "payment_required": {
    "x402Version": 1,
    "accepts": [
      {
        "scheme": "tenda-escrow-create",
        "network": "eip155:84532",
        "asset": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
        "asset_id": "USDC_BASE",
        "amount_raw": "25000000",
        "pay_to": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
        "escrow_id": "8927daa8-99e2-4168-a3fd-156a6b176920",
        "max_timeout_seconds": 600,
        "expires_at_unix": 1788700526,
        "payment": {
          "kind": "eip155-authorization",
          "creator": "0xeee96ad2cad255942522fc709932d3ffc198ed60",
          "create_params": {
            "escrowId": "0x8927daa899e24168a3fd156a6b176920",
            "kind": 0,
            "asset": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
            "amount": "25000000",
            "assignedCounterparty": "0x0000000000000000000000000000000000000000",
            "acceptDeadline": "1788786326",
            "completionDuration": "3600",
            "disputeBond": "0",
            "isSeeker": false,
            "requiresApproval": false,
            "unassignWindowSeconds": "21600"
          },
          "typed_data": {
            "types": {
              "EIP712Domain": [
                {
                  "name": "name",
                  "type": "string"
                },
                {
                  "name": "version",
                  "type": "string"
                },
                {
                  "name": "chainId",
                  "type": "uint256"
                },
                {
                  "name": "verifyingContract",
                  "type": "address"
                }
              ],
              "ReceiveWithAuthorization": [
                {
                  "name": "from",
                  "type": "address"
                },
                {
                  "name": "to",
                  "type": "address"
                },
                {
                  "name": "value",
                  "type": "uint256"
                },
                {
                  "name": "validAfter",
                  "type": "uint256"
                },
                {
                  "name": "validBefore",
                  "type": "uint256"
                },
                {
                  "name": "nonce",
                  "type": "bytes32"
                }
              ]
            },
            "primaryType": "ReceiveWithAuthorization",
            "domain": {
              "name": "USDC",
              "version": "2",
              "chainId": 84532,
              "verifyingContract": "0x5fbdb2315678afecb367f032d93f642f64180aa3"
            },
            "message": {
              "from": "0xeee96ad2cad255942522fc709932d3ffc198ed60",
              "to": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
              "value": "25000000",
              "validAfter": "0",
              "validBefore": "1788700526",
              "nonce": "0x9040dc61b30cf34e493949f964ca9c0ca9a365c309fe0f5542bbe5c59ab57826"
            }
          }
        }
      }
    ],
    "error": "payment required: sign the terms in `accepts` and resend with an X-PAYMENT header",
    "task_id": "8927daa8-99e2-4168-a3fd-156a6b176920"
  },
  "payment_envelope": {
    "x402Version": 1,
    "scheme": "tenda-escrow-create",
    "network": "eip155:84532",
    "payload": {
      "signature": "0x04a851557847f0a5ca8db6b1ae2c5057abd21917a7d12bfda2cc38c0511774a04e38ec192c0f6e82f6c303307855cf04f68d67f3e96cd17050be71988fabb72d1c",
      "authorization": {
        "from": "0xeee96ad2cad255942522fc709932d3ffc198ed60",
        "to": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
        "value": "25000000",
        "validAfter": "0",
        "validBefore": "1788700526",
        "nonce": "0x9040dc61b30cf34e493949f964ca9c0ca9a365c309fe0f5542bbe5c59ab57826"
      }
    }
  },
  "created": {
    "task_id": "8927daa8-99e2-4168-a3fd-156a6b176920",
    "tx_ref": "0xc74b5cc47626c85b657f8b9612b84d96dd69764de0ba86d6a70b998985ba33d5",
    "status": "draft",
    "recorded": true,
    "enqueued": false
  },
  "settlement": {
    "success": true,
    "transaction": "0xc74b5cc47626c85b657f8b9612b84d96dd69764de0ba86d6a70b998985ba33d5",
    "network": "eip155:84532",
    "payer": "0xeee96ad2cad255942522fc709932d3ffc198ed60"
  }
}
