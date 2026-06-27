# Tenda Escrow Smart Contract

Solana escrow contract for trustless gig payments on Tenda platform.

## Features

- **Escrow:** Lock SOL until gig completion
- **Grace Period:** 24h after deadline to submit proof
- **Gas Subsidy:** $1 SOL airdrop (locked until 1 gig completed)
- **Disputes:** Admin resolution system
- **Platform Fee:** Configurable basis points

## Quick Start

```bash
# Build
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Functions

| Function | Caller | Description |
|----------|--------|-------------|
| `initialize_platform` | Admin | Setup platform |
| `create_user_account` | User | Create account |
| `airdrop_gas_subsidy` | Platform | Give user gas SOL |
| `create_gig_escrow` | Poster | Post gig + lock payment |
| `accept_gig` | Worker | Accept gig |
| `submit_proof` | Worker | Submit completion |
| `approve_completion` | Poster | Release payment |
| `refund_expired` | Poster | Refund if timeout |
| `dispute_gig` | Poster/Worker | Open dispute |
| `resolve_dispute` | Admin | Resolve dispute |

## File Structure

```
src/
├── lib.rs              # Entry point
├── constants.rs        # Constants
├── errors.rs           # Error types
├── events.rs           # Events
├── utils.rs            # Helpers
├── state/              # Account structs
└── instructions/       # Program instructions
```

## Accounts

- **PlatformState** - Platform config
- **GigEscrow** - Individual gig escrow
- **UserAccount** - User earnings + airdrop tracking

## Requirements

- Anchor 0.32.1
- Solana 3.0.15
- Rust 1.86.0

## License

MIT