/**
 * GENERATED — do not edit. One real x402 exchange, captured through the real
 * route against a real node by
 * test/integration/agent-x402-recording.anvil.test.ts, and published inline in
 * the slim agent document by ./examples.
 *
 * Re-record with `pnpm record:x402` after a DELIBERATE wire change. Editing
 * this file by hand defeats the only property it has: that a reader is looking
 * at something the server actually sent.
 *
 * Captured 2026-09-06.
 */
import type { RecordedExchange } from './examples'

export const RECORDED_EXCHANGE: RecordedExchange = {
  "request": {
    "creation_operation_id": "ee6a4b80-6cdc-4212-a81e-186f95d511c8",
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
        "escrow_id": "97ed9514-2d15-41e6-89b6-14331c4dec05",
        "max_timeout_seconds": 600,
        "expires_at_unix": 1788669875,
        "payment": {
          "kind": "eip155-authorization",
          "creator": "0x06f0aeb708a3d220adfe29b73d769f824cca668e",
          "create_params": {
            "escrowId": "0x97ed95142d1541e689b614331c4dec05",
            "kind": 0,
            "asset": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
            "amount": "25000000",
            "assignedCounterparty": "0x0000000000000000000000000000000000000000",
            "acceptDeadline": "1788755675",
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
              "from": "0x06f0aeb708a3d220adfe29b73d769f824cca668e",
              "to": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
              "value": "25000000",
              "validAfter": "0",
              "validBefore": "1788669875",
              "nonce": "0x948bc8a2e0ff5bd481bf8150a84bc71660abea1c709ed54a5b2dd737018d6075"
            }
          }
        }
      }
    ],
    "error": "payment required: sign the terms in `accepts` and resend with an X-PAYMENT header",
    "task_id": "97ed9514-2d15-41e6-89b6-14331c4dec05"
  },
  "payment_envelope": {
    "x402Version": 1,
    "scheme": "tenda-escrow-create",
    "network": "eip155:84532",
    "payload": {
      "signature": "0x86ed8ef513832daac4866955ee91ee3ad9f4fbed5b1237abc09bfb0043aea7264b598f818fe6bd6fd165ce0fb4789c38fc64b5842d7ad1482aab307b6f25be6e1b",
      "authorization": {
        "from": "0x06f0aeb708a3d220adfe29b73d769f824cca668e",
        "to": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
        "value": "25000000",
        "validAfter": "0",
        "validBefore": "1788669875",
        "nonce": "0x948bc8a2e0ff5bd481bf8150a84bc71660abea1c709ed54a5b2dd737018d6075"
      }
    }
  },
  "created": {
    "task_id": "97ed9514-2d15-41e6-89b6-14331c4dec05",
    "tx_ref": "0x435d844638f3af9f750d4c8b625190105b8d374a20ba2c2ddc5bb734ab613f5d",
    "status": "draft",
    "recorded": true,
    "enqueued": false
  },
  "settlement": {
    "success": true,
    "transaction": "0x435d844638f3af9f750d4c8b625190105b8d374a20ba2c2ddc5bb734ab613f5d",
    "network": "eip155:84532",
    "payer": "0x06f0aeb708a3d220adfe29b73d769f824cca668e"
  }
}
