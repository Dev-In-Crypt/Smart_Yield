import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 640 }}>

        <div style={{ display: 'inline-block', background: '#1e1f3a', border: '1px solid #3b3f6e', borderRadius: 100, padding: '6px 16px', fontSize: 12, fontWeight: 600, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>
          Built on Initia EVM
        </div>

        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 20, lineHeight: 1.15, color: 'var(--text)' }}>
          Smart Yield Vaults
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          Deposit USDC. An AI agent continuously rebalances your funds across
          the highest-yielding strategies — automatically, on-chain, transparently.
        </p>

        <p style={{ fontSize: 13, color: '#555870', marginBottom: 48 }}>
          Powered by Claude AI · Secured by ECDSA signatures · Full on-chain audit trail
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 48 }}>
          <Stat label="Est. APY" value="5.8%" />
          <Stat label="Total TVL" value="$—" />
          <Stat label="Rebalances" value="—" />
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/vault" className="btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
            Deposit USDC →
          </Link>
          <Link href="/dashboard" className="btn-ghost" style={{ fontSize: 16, padding: '14px 32px' }}>
            View Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
