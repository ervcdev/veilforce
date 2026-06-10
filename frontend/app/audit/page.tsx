import Link from 'next/link'

// ─── Data ─────────────────────────────────────────────────────────────────────

const rounds = [
  {
    title: 'Round 1: Initial Contract Audit',
    badge: '9 issues',
    badgeColor: '#ff4466',
    badgeBg: 'rgba(255,68,102,0.12)',
    issues: 'C-1 Fees destroyed in settlement · C-2 Arrays unbounded → DOS · C-3 Permissionless slash griefing',
    dotColor: '#00ff88',
  },
  {
    title: 'Round 2: Security & Gas Optimization',
    badge: '9 issues',
    badgeColor: '#ff9944',
    badgeBg: 'rgba(255,153,68,0.12)',
    issues: 'H-1 Struct 7 slots → 4 slots · H-2 Withdraw without active orders check · H-3 Token decimal mismatch',
    dotColor: '#00ff88',
  },
  {
    title: 'Round 3: TypeScript Agent Audit',
    badge: '9 issues',
    badgeColor: '#ff9944',
    badgeBg: 'rgba(255,153,68,0.12)',
    issues: 'A-1 Race condition on orderId · A-2 Reveal window not enforced · A-3 Setup not awaiting receipts',
    dotColor: '#00ff88',
  },
  {
    title: 'Round 4: Final Gap Analysis',
    badge: '6 issues',
    badgeColor: '#ffcc44',
    badgeBg: 'rgba(255,204,68,0.12)',
    issues: 'GAP-4 Fee cross-token decimal error · GAP-2 Wrong call order decrement → slash · GAP-5 No backoff on expired window',
    dotColor: '#00d4ff',
  },
]

const fixes = [
  {
    label: 'Fee Routing [C-1]',
    before: `// fees destroyed silently
tokenB.transferFrom(bidAgent, askAgent,
  totalCost - fee/2);`,
    after: `// fees routed to protocol
uint256 feeInTokenB = (totalCost * FEE_BPS) / BPS_DENOMINATOR;
uint256 feeInTokenA = (execAmount * FEE_BPS) / BPS_DENOMINATOR;
tokenB.transferFrom(bidAgent, feeTarget, feeInTokenB);
tokenA.transferFrom(askAgent, feeTarget, feeInTokenA);`,
  },
  {
    label: 'Race Condition on orderId [A-1]',
    before: `// wrong with concurrent agents
const orderId = await readContract({
  functionName: 'orderCount'
})`,
    after: `// read from event receipt
const decoded = decodeEventLog({
  eventName: 'OrderCommitted'
})
orderId = decoded.args.orderId`,
  },
  {
    label: 'Permissionless Slash [C-3]',
    before: `// anyone can slash agents
function expireOrder(uint id) external {
  registry.slashAgent(order.agent, "...");
}`,
    after: `// keeper only
if (msg.sender == owner() ||
    msg.sender == keeperAddress) {
  registry.slashAgent(order.agent, "...");
}`,
  },
]

const stats = [
  { value: '33', label: 'Total Issues Found',  color: 'white'   },
  { value: '0',  label: 'Critical Pending',    color: '#00d4ff' },
  { value: '4',  label: 'Audit Rounds',        color: 'white'   },
  { value: '33', label: 'Fixes Applied',       color: 'white'   },
]

const passingTests = [
  'test_feesReachRecipientInBothTokens() (gas: ~284k)',
  'test_expireOrderNoSlashWithoutKeeper() (gas: ~156k)',
  'test_activeOrdersDecrementOnReveal() (gas: ~198k)',
  'test_feeUnitsAreCorrect() (gas: ~301k)',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  return (
    <main
      className="min-h-screen font-mono"
      style={{ background: '#0a0a0f', color: 'white' }}
    >
      <style>{`
        .font-mono-jetbrains { font-family: 'JetBrains Mono', monospace; }
        .code-block { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; line-height: 1.6; white-space: pre; overflow-x: auto; }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs mb-8 transition-colors back-link"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <style>{`.back-link { color: #666680; } .back-link:hover { color: #00d4ff; }`}</style>
          &#8592; Back to Dashboard
        </Link>

        {/* ── HEADER ── */}
        <div className="mb-10">
          <h1
            className="text-3xl font-bold mb-2 tracking-tight"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Security Audit
          </h1>
          <p className="text-sm mb-5" style={{ color: '#666680' }}>
            4 rounds &middot; 33 issues identified &middot; 0 critical pending
          </p>
          <div className="flex flex-wrap gap-3">
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(185,28,28,0.3)', color: '#f87171' }}
            >
              7 Critical &mdash; Resolved
            </span>
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(194,65,12,0.3)', color: '#fb923c' }}
            >
              13 High &mdash; Resolved
            </span>
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(161,98,7,0.3)', color: '#fbbf24' }}
            >
              13 Medium &mdash; Resolved
            </span>
          </div>
        </div>

        {/* ── SECTION 1: AUDIT TIMELINE ── */}
        <section className="mb-12">
          <p
            className="text-xs uppercase tracking-widest mb-5"
            style={{ color: '#666680' }}
          >
            Audit Rounds
          </p>

          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-[7px] top-2 bottom-2 w-px"
              style={{ background: '#1a1a2e' }}
            />

            <div className="flex flex-col gap-4">
              {rounds.map((round, i) => (
                <div key={i} className="flex gap-4">
                  {/* Dot */}
                  <div className="relative flex-shrink-0 mt-4">
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 z-10 relative"
                      style={{ background: round.dotColor, borderColor: '#0a0a0f' }}
                    />
                  </div>

                  {/* Card */}
                  <div
                    className="flex-1 rounded-lg p-4"
                    style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {round.title}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: round.badgeBg, color: round.badgeColor }}
                      >
                        {round.badge}
                      </span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: '#666680', lineHeight: '1.6' }}>
                      {round.issues}
                    </p>
                    <span className="text-xs" style={{ color: '#00ff88' }}>
                      &#10003; All resolved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 2: KEY FIXES ── */}
        <section className="mb-12">
          <p
            className="text-xs uppercase tracking-widest mb-5"
            style={{ color: '#666680' }}
          >
            Most Critical Fixes
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {fixes.map((fix, i) => (
              <div
                key={i}
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {fix.label}
                </p>

                {/* BEFORE */}
                <div>
                  <p className="text-xs mb-1" style={{ color: '#666680' }}>BEFORE</p>
                  <div
                    className="rounded p-3 code-block"
                    style={{ background: 'rgba(255,68,102,0.07)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.15)' }}
                  >
                    {fix.before}
                  </div>
                </div>

                {/* AFTER */}
                <div>
                  <p className="text-xs mb-1" style={{ color: '#666680' }}>AFTER</p>
                  <div
                    className="rounded p-3 code-block"
                    style={{ background: 'rgba(0,255,136,0.06)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.15)' }}
                  >
                    {fix.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: FORGE TEST OUTPUT ── */}
        <section className="mb-12">
          <p
            className="text-xs uppercase tracking-widest mb-5"
            style={{ color: '#666680' }}
          >
            Test Results
          </p>
          <div
            className="rounded-lg p-5"
            style={{ background: '#080810', border: '1px solid #1a1a2e' }}
          >
            <p
              className="code-block mb-2"
              style={{ color: '#666680' }}
            >
              {'$ forge test --match-path test/AuditFixes.t.sol -vvv'}
            </p>
            {passingTests.map((t, i) => (
              <p key={i} className="code-block" style={{ color: '#00ff88' }}>
                {'[PASS] ' + t}
              </p>
            ))}
            <p
              className="code-block font-bold mt-3"
              style={{ color: '#00ff88' }}
            >
              Test result: ok. 4 passed; 0 failed
            </p>
          </div>
          <p className="text-xs mt-3" style={{ color: '#666680' }}>
            Run locally:{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              cd contracts &amp;&amp; forge test --match-path test/AuditFixes.t.sol -vvv
            </span>
          </p>
        </section>

        {/* ── SECTION 4: STATS ROW ── */}
        <section>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-lg p-4"
                style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}
              >
                <p className="text-xs mb-2" style={{ color: '#666680' }}>
                  {s.label}
                </p>
                <p
                  className="text-3xl font-bold"
                  style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
