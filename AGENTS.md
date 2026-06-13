# VeilForge — Autonomous Agent Strategies

Three independent agents operate continuously on VeilForge.
Each has a distinct strategy, risk profile, and economic incentive.
None require human intervention after deployment.

---

## How Agents Work

Every agent runs the same commit-reveal cycle:

1. Calculate order parameters based on strategy
2. Generate a random salt and compute commitment hash
3. Call `commitOrder(keccak256(price, amount, direction, salt))`
4. Wait N blocks (reveal window — 50 blocks on Somnia Testnet)
5. Call `revealOrder(price, amount, direction, salt)`
6. Somnia Reactivity triggers `matchOrders()` automatically
7. Repeat

The agent never touches the order after reveal — Somnia handles the rest.

---

## Agent-1: Market Maker

**Address:** `0x73DA43042E8D509a5AC84eCDbE9bb4FE341274d9`
**Strategy:** Symmetric spread around market price
**Spread:** 0.20–0.35% variable
**Amount:** 1.0 WETH per order
**Direction:** Alternates BID → ASK → BID each cycle

**Logic:**
The market maker posts both sides of the book, earning the spread on
each completed match. It adjusts spread width based on how many
competitors are active — tighter when few agents are posting,
wider when the book is crowded.

**Edge:** Tightest spread in the orderbook = highest match rate =
most fees earned per hour.

**Risk:** Inventory risk when market moves strongly in one direction
before the alternate-side order gets matched.

**Economic incentive:** Fees from matched orders. A market maker
that consistently posts tight spreads accumulates fees faster than
any other strategy.

---

## Agent-2: Arbitrage

**Address:** `0xB14d017200eF7DdE24fF134Cbdc89AF5eB0C9e64`
**Strategy:** Cross-spread detection and execution
**Spread:** 0.15–0.40% (opportunistic)
**Amount:** 1.0 WETH per order
**Direction:** Reactive — posts whichever side closes an open spread

**Logic:**
The arbitrage agent scans the revealed orderbook before each commit.
If there is an open BID at price X, it posts an ASK at X - epsilon,
guaranteeing a match when both reveals land. If there is an open ASK
at price Y, it posts a BID at Y + epsilon.

If no opportunity exists, it posts a neutral order at market price
and waits for a natural match.

**Edge:** Zero inventory risk on arbitrage trades — the profit is
locked in at commit time. Only trades when a gain is certain.

**Risk:** The target order may expire or get matched by another agent
between the arbitrageur's commit and reveal. This is the fundamental
risk of any commit-reveal arbitrage system.

**Economic incentive:** Guaranteed profit on each arbitrage execution,
no dependency on market direction.

---

## Agent-3: Conservative

**Address:** `0x53a74dfe2dBbefF585449b2e7D8DDbD381931aEF`
**Strategy:** Wide spread, small amounts, minimize slash risk
**Spread:** 0.60–0.80% fixed
**Amount:** 0.5 WETH per order
**Direction:** Alternates, same as market maker

**Logic:**
The conservative agent prioritizes capital preservation over yield.
Wide spreads mean lower match rate but higher profit per match.
Small amounts reduce exposure on each individual order. The wide
spread also reduces the probability of being frontrun even without
the commit-reveal protection (defense in depth).

**Edge:** Survives market volatility that kills tight spreaders.
When the market maker is getting slashed for missed reveals during
network congestion, the conservative agent's longer cycle time
means it is more likely to reveal within the window.

**Risk:** Low match rate means low fees per hour. In a competitive
orderbook this strategy earns less than market making but loses
less when conditions deteriorate.

**Economic incentive:** Consistent low-risk income. Suitable for
agents managing collateral they cannot afford to lose to slashing.

---

## Slash Protection

Every agent is at risk of being slashed if it fails to reveal within
the `REVEAL_WINDOW` (50 blocks on Somnia Testnet — approximately 50 seconds).

The reveal window was set to 50 blocks (instead of the default 5) to
account for network latency on Somnia Testnet, where block propagation
can be variable. This ensures agents have sufficient time to reveal
without being penalized for network congestion.

Protection mechanisms:
- **Backoff on network errors** — agents wait 5–15 seconds before
  retrying after a failed reveal, avoiding rapid slash accumulation
- **Window monitoring** — agents track the max block for each commit
  and throw an error rather than attempting a late reveal
- **High-frequency polling** — agents poll every 100ms for block
  confirmation to reveal as early as possible within the window
- **Priority gas** — agents set elevated `maxPriorityFeePerGas` to
  ensure validators prioritize reveal transactions

Slash amount: `0.001 STT` per missed reveal, deducted from collateral.
An agent must maintain `MIN_COLLATERAL` (0.01 STT) to remain active.

---

## Deployed Contracts

Agents interact with these contracts on Somnia Testnet (Chain ID 50312):

| Contract | Address |
|---|---|
| CommitRevealCLOB | `0x05f27223bBe02B3CC5c2F5d61DA8902811f5d207` |
| AgentRegistry | `0x22b4710F8219949D98849dAdBecF077a1b0Edc75` |
| ReactivityAdapter | `0x93f859b7c206ea38218c1De6BD8e5412114e93F5` |
| Token WETH (mock) | `0x3De966884898384B32B7E1d45e54d94d058a811a` |
| Token USDC (mock) | `0xC84F35D855aF44fD85B477A8924BF981df00EE20` |

---

## Network Configuration

```bash
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_WS_URL=wss://api.infra.testnet.somnia.network/ws
SOMNIA_CHAIN_ID=50312
REVEAL_WINDOW_BLOCKS=50
COLLATERAL_AMOUNT=0.01
```

> **Note:** Use `https://dream-rpc.somnia.network` as the primary RPC.
> The alternative `https://api.infra.testnet.somnia.network/` can be
> used as fallback but has less reliable contract deployment propagation.

---

## Running All Three Agents

```bash
# Terminal 1 — Market Maker
cd agent && npm run agent1

# Terminal 2 — Arbitrage
cd agent && npm run agent2

# Terminal 3 — Conservative
cd agent && npm run agent3
```

Each agent automatically:
1. Connects to Somnia Testnet via the configured RPC
2. Registers itself in `AgentRegistry` (if not already registered)
3. Approves `tokenA` and `tokenB` to the CLOB contract
4. Begins the commit-reveal loop

No further input required after starting.

---

*VeilForge — Somnia Agentathon 2026 — Encode Club*