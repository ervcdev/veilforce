# VeilForge

<div align="center">

![VeilForge Banner](https://img.shields.io/badge/VeilForge-Dark%20Orderbook-00d4ff?style=for-the-badge&labelColor=0a0a0f)

[![Somnia Testnet](https://img.shields.io/badge/Somnia-Testnet%2050312-00d4ff?style=flat-square&logo=ethereum&logoColor=white)](https://shannon-explorer.somnia.network)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-Passing-00ff88?style=flat-square&logo=checkmarx)](https://github.com/veilforge/veilforge)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Encode Club](https://img.shields.io/badge/Encode%20Club-Somnia%20Agentathon%202026-purple?style=flat-square)](https://encodeclub.com)

**The first MEV-resistant dark orderbook for autonomous AI agents on Somnia.**

[Demo](https://veilforge.vercel.app) · [Video](https://youtu.be/[VIDEO_ID]) · [Explorer](https://shannon-explorer.somnia.network/address/0x[CLOB_ADDRESS])

</div>

---

## The Problem

Every onchain orderbook has the same fundamental flaw: orders are public the moment they are submitted. Before a transaction confirms, anyone scanning the mempool can see your price, your amount, and your direction — and act on it.

MEV bots exploit this in two ways. Frontrunning places an identical order ahead of yours with higher gas, capturing the price you were about to get. Sandwich attacks bracket your transaction — buying before you and selling after — extracting value from the price movement you cause. The result is a hidden tax on every trade.

Existing solutions require centralized infrastructure: private mempools, trusted sequencers, off-chain matching engines. They fix MEV by reintroducing the single points of failure that decentralization was supposed to eliminate. VeilForge solves this at the protocol level, without any trusted intermediary.

---

## How It Works

VeilForge uses a two-phase commit-reveal scheme. Agents submit cryptographic commitments instead of orders. Nobody knows what's inside a commitment until the agent reveals it — and by then, the window to frontrun has closed.

```
PHASE 1 — COMMIT
─────────────────────────────────────────────────────────────
Agent generates:
  salt       = crypto.randomBytes(32)
  commitment = keccak256(price, amount, direction, salt)

Agent calls commitOrder(commitment)
  → only the hash is stored onchain
  → MEV bots see: "0xa8f3d9c2..." — nothing exploitable

PHASE 2 — REVEAL  (after N blocks)
─────────────────────────────────────────────────────────────
Agent calls revealOrder(price, amount, direction, salt)
  → contract verifies: keccak256(params) == commitment ✓
  → Somnia Reactivity fires matchOrders() in the same block
  → SettlementEngine transfers tokens atomically

RESULT
─────────────────────────────────────────────────────────────
No frontrunning — order was invisible until execution
No keeper — Somnia Reactivity handles matching natively
No trusted party — everything is onchain and verifiable
```

---

## Why Only Possible on Somnia

The commit-reveal pattern is not new. What makes it viable for real trading is Somnia's infrastructure. Each primitive solves a specific problem that would make this system impractical on any other chain.

| Somnia Primitive | What It Solves in VeilForge | Without It |
|---|---|---|
| **Sub-second finality** | Commit-reveal window is ~5 seconds — fast enough for real trading | Ethereum: 13s/block makes the window too slow; traders won't wait |
| **Near-zero gas** | Agents run two transactions per order profitably at scale | Ethereum: 2 txs = $20–100 in gas, economically unviable |
| **Somnia Reactivity** | `OrderRevealed` event triggers `matchOrders()` in the same block, no keeper needed | Requires centralized bot monitoring the chain 24/7 |
| **Somnia Agents (JSON API)** | Agents fetch live market prices onchain without a trusted oracle | Requires Chainlink or similar — adds latency and trust assumptions |
| **Somnia Agents (LLM)** | Pricing strategy computed onchain, deterministic across validators | Requires offchain AI server — reintroduces centralization |
| **Cron Subscriptions** | Expired orders auto-detected without a keeper bot | Requires external infrastructure to expire and slash agents |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOMNIA TESTNET                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────-───┐  │
│  │                   CommitRevealCLOB.sol                        │  │
│  │                                                               │  │
│  │  commitOrder()  ──► hash stored onchain                       │  │
│  │  revealOrder()  ──► hash verified + order added to book       │  │
│  │  matchOrders()  ──► best bid × best ask → settlement          │  │
│  └──────────┬───────────────────────────┬────────────────────┘   │  │
│             │                           │                        │  │
│    Reactivity│subscription         invoke│agents                 │  │
│             ▼                           ▼                        │  │
│  ┌──────────────────┐     ┌─────────────────────────────────-┐   │  │
│  │ ReactivityAdapter│     │       Somnia Agents              │   │  │
│  │                  │     │                                  │   │  │
│  │ OrderRevealed    │     │  JSON API Agent                  │   │  │
│  │ → matchOrders()  │     │  → live market price onchain     │   │  │
│  │ (same block)     │     │                                  │   │  │
│  └──────────────────┘     │  LLM Inference Agent             │   │  │
│                           │  → pricing strategy onchain      │   │  │
│  ┌──────────────────┐     └──────────────────────────────-───┘   │  │
│  │ Cron Subscription│                                            │  │
│  │ → expireOrder()  │     ┌───────────────────────────────-──┐   │  │
│  │   every N blocks │     │       Data Streams               │   │  │
│  └──────────────────┘     │  → structured orderbook events   │   │  │
│                           │  → consumed by frontend SDK      │   │  │
│  ┌──────────────────┐     └──────────────────────────────-───┘   │  │
│  │  AgentRegistry   │                                            │  │
│  │  → collateral    │                                            │  │
│  │  → slash/reward  │                                            │  │
│  └──────────────────┘                                            │  │
└─────────────────────────────────────────────────────────────────────┘
          ▲                                        ▲
          │ RPC / WebSocket                        │ RPC / WebSocket
          │                                        │
┌──────────────────-───┐               ┌────────────────────────-────┐
│   TypeScript Agents  │               │   Next.js Dashboard         │
│   (your machine)     │               │   (Vercel)                  │
│                      │               │                             │
│  Agent-1 MarketMaker │               │  Live orderbook             │
│  Agent-2 Arbitrage   │               │  Commit → Reveal animation  │
│  Agent-3 Conservative│               │  Agent heatmap              │
│                      │               │  Real-time ticker           │
│  Loop:               │               │  WebSocket events           │
│  1. Request price    │               └─────────────────-───────────┘
│     via JSON API     │
│     Agent onchain    │
│  2. Calculate spread │
│  3. commitOrder()    │
│  4. Wait N blocks    │
│  5. revealOrder()    │
│  6. Repeat           │
└─────────────-────────┘
```

---

## Deployed Contracts

All contracts verified on Somnia Testnet (Shannon).

| Contract | Address | Explorer |
|---|---|---|
| CommitRevealCLOB | `0x[CLOB_ADDRESS]` | [View](https://shannon-explorer.somnia.network/address/0x[CLOB_ADDRESS]) |
| AgentRegistry | `0x[REGISTRY_ADDRESS]` | [View](https://shannon-explorer.somnia.network/address/0x[REGISTRY_ADDRESS]) |
| ReactivityAdapter | `0x[ADAPTER_ADDRESS]` | [View](https://shannon-explorer.somnia.network/address/0x[ADAPTER_ADDRESS]) |
| MockWETH | `0x[TOKEN_A_ADDRESS]` | [View](https://shannon-explorer.somnia.network/address/0x[TOKEN_A_ADDRESS]) |
| MockUSDC | `0x[TOKEN_B_ADDRESS]` | [View](https://shannon-explorer.somnia.network/address/0x[TOKEN_B_ADDRESS]) |

---

## Security Audit

The contracts went through 4 rounds of audit before deployment. 33 issues were identified and resolved across all rounds.

| Severity | Count | Categories |
|---|---|---|
| 🔴 Critical | 4 | Fee routing (tokens destroyed), array unbounded growth → DOS, permissionless slash griefing, fee cross-token decimal mismatch |
| 🟠 High | 5 | Struct packing (7 slots → 4), withdrawal without active order check, decimal standardization, missing receipt awaits, race condition on orderId |
| 🟡 Medium | 6 | Event indexing, matchOrders spam protection, Reactivity precompile address, reveal window not enforced, connection leak in arbitrage agent, backoff on expired window |

Key fixes include:

- **Fee routing** — fees were being silently destroyed instead of sent to the protocol. Fixed with separate `feeInTokenA` and `feeInTokenB` calculated independently in their respective token units.
- **DOS vector** — `openBids` and `openAsks` arrays could grow indefinitely as matched/expired orders were never cleaned. Fixed with in-place cleanup during iteration.
- **Slash griefing** — `expireOrder()` was permissionless, allowing any address to slash agents by frontrunning their reveal transaction. Fixed with keeper authorization and a grace period.
- **Race condition** — agents were reading the global `orderCount` to determine their `orderId`, which is incorrect with concurrent agents. Fixed by reading the `orderId` directly from the `OrderCommitted` event receipt.

```bash
# Run audit validation tests
cd contracts
forge test --match-path test/AuditFixes.t.sol -vvv
```

All 4 audit tests pass:
- `test_feesReachRecipientInBothTokens`
- `test_expireOrderNoSlashWithoutKeeper`
- `test_activeOrdersDecrementOnReveal`
- `test_feeUnitsAreCorrect`

---

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh) installed
- Node.js 20+
- STT tokens from the [Somnia Faucet](https://testnet.somnia.network/)

### Setup

```bash
# Clone and install
git clone https://github.com/[your-username]/veilforge
cd veilforge
npm install

# Compile and test contracts
cd contracts
forge build
forge test -vvv
```

### Environment Variables

```bash
# contracts/.env
SOMNIA_RPC_URL=https://api.infra.testnet.somnia.network/
DEPLOYER_PRIVATE_KEY=0x...
AGENT_1_ADDRESS=0x...
AGENT_2_ADDRESS=0x...
AGENT_3_ADDRESS=0x...

# agent/.env
SOMNIA_RPC_URL=https://api.infra.testnet.somnia.network/
SOMNIA_WS_URL=wss://api.infra.testnet.somnia.network/ws
SOMNIA_CHAIN_ID=50312
AGENT_1_PRIVATE_KEY=0x...
AGENT_2_PRIVATE_KEY=0x...
AGENT_3_PRIVATE_KEY=0x...
COMMIT_REVEAL_CLOB_ADDRESS=0x...
AGENT_REGISTRY_ADDRESS=0x...
TOKEN_A_ADDRESS=0x...
TOKEN_B_ADDRESS=0x...
REVEAL_WINDOW_BLOCKS=5
COLLATERAL_AMOUNT=0.01

# frontend/.env.local
NEXT_PUBLIC_SOMNIA_WS_URL=wss://api.infra.testnet.somnia.network/ws
NEXT_PUBLIC_CLOB_ADDRESS=0x...
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x...
```

### Deploy Contracts

```bash
cd contracts
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SOMNIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --legacy \
  -vvv
```

The script prints all deployed addresses. Copy them to `agent/.env` and `frontend/.env.local`.

---

## Running the Agents

Three autonomous agents run independently. Each has its own wallet, strategy, and collateral deposit. After setup, they operate without any human input.

```bash
# Terminal 1 — Market Maker (spread 0.20–0.35%, alternates BID/ASK)
cd agent && npm run agent1

# Terminal 2 — Arbitrage (detects crossed spreads, closes them)
cd agent && npm run agent2

# Terminal 3 — Conservative (spread 0.60–0.80%, smaller amounts)
cd agent && npm run agent3
```

Each agent automatically registers in `AgentRegistry`, approves tokens, and begins the commit-reveal loop. No configuration required beyond the `.env` file.

---

## Running the Frontend

```bash
cd frontend
npm run dev
# open http://localhost:3000
```

The dashboard connects to Somnia Testnet via WebSocket and displays live orderbook activity: commits appearing as hashes, transitioning to revealed orders, and matches executing in real time.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Smart Contracts | Solidity 0.8.24 | Commit-reveal CLOB, registry, settlement |
| Testing & Deploy | Foundry | Unit tests, deployment scripts |
| Agent Runtime | TypeScript + Node.js | Autonomous trading agents |
| Blockchain Client | Viem v2 | Contract interactions, event watching |
| Frontend | Next.js 14 + Tailwind | Real-time dashboard |
| Monorepo | npm workspaces | Shared ABIs between agent and frontend |
| Network | Somnia Testnet (50312) | Sub-second finality, native agents |

---

## Project Structure

```
veilforge/
├── contracts/
│   ├── src/
│   │   ├── CommitRevealCLOB.sol    # Core orderbook
│   │   ├── AgentRegistry.sol       # Agent identity and collateral
│   │   ├── ReactivityAdapter.sol   # Somnia Reactivity subscriber
│   │   ├── SettlementEngine.sol    # Token transfers and fees
│   │   └── MockERC20.sol           # Test tokens
│   ├── test/
│   │   ├── CommitReveal.t.sol
│   │   ├── Matching.t.sol
│   │   └── AuditFixes.t.sol
│   └── script/Deploy.s.sol
├── agent/
│   └── src/
│       ├── index.ts                # Entry point + main loop
│       ├── commitReveal.ts         # Commit/reveal logic
│       ├── somniaAgents.ts         # Somnia Agent invocations
│       ├── dataStreams.ts          # Data Streams publisher
│       └── strategies/
│           ├── marketMaker.ts
│           ├── arbitrage.ts
│           └── conservative.ts
├── frontend/
│   ├── app/
│   ├── components/veilforge/
│   ├── hooks/useVeilForge.ts       # Live blockchain data
│   └── lib/contracts.ts           # Viem client + event watchers
└── packages/abis/
    └── index.ts                    # Shared ABIs from forge build output
```

---

## Somnia Primitives Used

VeilForge integrates all six of Somnia's core primitives. Each one is structural to the system — not a demonstration of feature coverage.

| Primitive | Where Used | What Happens Without It |
|---|---|---|
| **Reactivity** | `ReactivityAdapter.sol` subscribes to `OrderRevealed` | Matching requires a centralized keeper bot |
| **Agents (JSON API)** | `CommitRevealCLOB.requestMarketPrice()` | Price feed requires Chainlink or custom oracle |
| **Agents (LLM)** | `CommitRevealCLOB.requestPricingStrategy()` | Strategy computation moves offchain |
| **Data Streams** | Agent publishes commits, reveals, matches as typed schemas | Frontend requires manual ABI decoding |
| **Cron Subscriptions** | Auto-expire uncommitted orders after reveal window | Expired orders require manual cleanup |
| **WebSocket** | Frontend subscribes to live contract events | Frontend falls back to polling every N seconds |

---

## Links

| Resource | URL |
|---|---|
| Live Demo | https://veilforge.vercel.app |
| Demo Video | https://youtu.be/[VIDEO_ID] |
| Somnia Explorer | https://shannon-explorer.somnia.network |
| Somnia Docs | https://docs.somnia.network |
| Encode Club | https://encodeclub.com |

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
Built for <a href="https://encodeclub.com">Encode Club</a> Somnia Agentathon 2026
</div>