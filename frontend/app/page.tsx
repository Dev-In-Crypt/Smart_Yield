import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="home-grid" style={{
      minHeight: 'calc(100vh - 72px)',
      display: 'grid',
      gridTemplateColumns: '260px 1fr 360px',
      gap: 28,
      maxWidth: 1680,
      width: '100%',
      margin: '0 auto',
      padding: '48px 48px 48px',
    }}>

      {/* ── Left sidebar ──────────────────────── */}
      <aside className="home-sidebar-left glass" style={{
        padding: '32px 24px',
        height: 'fit-content',
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
      }}>

        <div>
          <p className="label" style={{ marginBottom: 14 }}>Protocol</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SideLink href="/vault">Vault</SideLink>
            <SideLink href="/dashboard">Dashboard</SideLink>
          </div>
        </div>

        <div>
          <p className="label" style={{ marginBottom: 14 }}>Network</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <NetRow label="Chain"  value="Initia EVM" />
            <NetRow label="Layer"  value="Minitia L2" />
            <NetRow label="Asset"  value="USDC" />
            <NetRow label="Bridge" value="Interwoven" />
          </div>
        </div>

        <div>
          <p className="label" style={{ marginBottom: 14 }}>Status</p>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: '#A1A1AA' }}>
            <span className="dot-live" />
            Testnet live
          </div>
        </div>

      </aside>

      {/* ── Center hero ───────────────────────── */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 32px',
        textAlign: 'center',
      }}>

        <div style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#6B6B74',
          border: '1px solid #2A2A2A',
          borderRadius: 100,
          padding: '5px 14px',
          marginBottom: 36,
        }}>
          Built on Initia EVM
        </div>

        <h1 style={{
          fontSize: 'clamp(56px, 5.5vw, 96px)',
          fontWeight: 300,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          marginBottom: 32,
          color: '#FFFFFF',
        }}>
          Smart Yield.<br />
          AI-managed.
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 1.2vw, 18px)',
          color: '#A1A1AA',
          lineHeight: 1.7,
          marginBottom: 12,
          maxWidth: 620,
          fontWeight: 300,
        }}>
          Deposit USDC. An AI agent continuously rebalances your
          funds across the highest-yielding strategies —
          on-chain, transparently.
        </p>

        <p style={{
          fontSize: 12,
          color: '#4B4B54',
          marginBottom: 56,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          Claude AI · ECDSA signatures · Full on-chain audit trail
        </p>

        <div style={{ display: 'flex', gap: 40, marginBottom: 64, alignItems: 'center' }}>
          <Stat value="5.8%" label="Est. APY" />
          <StatDivider />
          <Stat value="$—" label="Total TVL" />
          <StatDivider />
          <Stat value="—" label="Rebalances" />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/vault" className="btn-primary" style={{ fontSize: 15, padding: '13px 32px' }}>
            Deposit USDC →
          </Link>
          <Link href="/dashboard" className="btn-ghost" style={{ fontSize: 15, padding: '13px 32px' }}>
            Dashboard
          </Link>
        </div>

      </section>

      {/* ── Right panel ───────────────────────── */}
      <aside className="home-sidebar-right glass" style={{
        padding: '32px 24px',
        height: 'fit-content',
        display: 'flex',
        flexDirection: 'column',
      }}>

        <p className="panel-title">System Operations</p>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 28 }}>
          <StepBlock n="01" title="Deposit USDC"
            desc="Connect your EVM wallet and deposit USDC into the vault." />
          <StepBlock n="02" title="AI rebalances"
            desc="Claude AI analyzes on-chain yield data and allocates optimally." />
          <StepBlock n="03" title="Earn & withdraw"
            desc="Yield accrues automatically. Withdraw anytime, no lock-up." />
        </div>

        <div style={{ height: 1, background: '#2A2A2A', margin: '0 0 24px' }} />

        <p className="panel-title">Vault Info</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="data-pill">
            <span style={{ fontSize: 13, color: '#A1A1AA' }}>Strategy</span>
            <span className="metric">AI-MANAGED</span>
          </div>
          <div className="data-pill">
            <span style={{ fontSize: 13, color: '#A1A1AA' }}>Asset</span>
            <span className="metric">USDC (ERC-20)</span>
          </div>
          <div className="data-pill">
            <span style={{ fontSize: 13, color: '#A1A1AA' }}>Share token</span>
            <span className="metric">SYV</span>
          </div>
        </div>

      </aside>

    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{
        fontSize: 'clamp(28px, 3vw, 42px)',
        fontWeight: 200,
        color: '#FFFFFF',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#6B6B74',
        marginTop: 6,
      }}>{label}</div>
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: 1, height: 44, background: '#2A2A2A', alignSelf: 'center' }} />;
}

function StepBlock({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="step-block">
      <p className="step-number">{n} —</p>
      <p className="step-title">{title}</p>
      <p className="step-desc">{desc}</p>
    </div>
  );
}

function SideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="side-link">{children}</Link>;
}

function NetRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, color: '#6B6B74' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#A1A1AA' }}>{value}</span>
    </div>
  );
}
