'use client';

import { useEffect, useState } from 'react';
import { useVault } from '@/hooks/useVault';
import { useRebalanceHistory } from '@/hooks/useRebalanceHistory';
import { AllocationChart } from '@/components/AllocationChart';
import { RebalanceHistory } from '@/components/RebalanceHistory';

const S = {
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 6 },
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { totalAssetsFormatted } = useVault();
  const { data: history }        = useRebalanceHistory(1);
  const [vaultStats, setVaultStats] = useState<{
    total_rebalances: string;
    triggered_count: string;
    last_rebalance_at: string | null;
  } | null>(null);

  useEffect(() => {
    fetch('/api/vault-stats')
      .then((r) => r.json())
      .then((j) => setVaultStats(j.data))
      .catch(console.error);
  }, []);

  const DEMO_ALLOC = [
    { name: 'Strategy 1 (0x1111…)', value: 3500 },
    { name: 'Strategy 2 (0x2222…)', value: 3000 },
    { name: 'Strategy 3 (0x3333…)', value: 3500 },
  ];

  const latestAlloc = history.find((e) => e.triggered)?.new_alloc ?? {};
  const allocationData = Object.keys(latestAlloc).length
    ? Object.entries(latestAlloc).map(([addr, bps], i) => ({
        name:  `Strategy ${i + 1} (${addr.slice(0, 6)}…)`,
        value: bps,
      }))
    : DEMO_ALLOC;

  const lastRebalanceAt = vaultStats?.last_rebalance_at
    ? new Date(vaultStats.last_rebalance_at).toLocaleString()
    : '—';

  if (!mounted) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 28 }}>Dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ ...S.card, height: 90, opacity: 0.4 }} />
          ))}
        </div>
        <div style={{ ...S.card, height: 300, opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 28 }}>Dashboard</h1>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total TVL"      value={totalAssetsFormatted ? `$${Number(totalAssetsFormatted).toFixed(2)}` : '—'} />
        <StatCard label="Rebalances"     value={vaultStats?.triggered_count ?? '—'} />
        <StatCard label="AI Cycles"      value={vaultStats?.total_rebalances ?? '—'} />
        <StatCard label="Last Rebalance" value={lastRebalanceAt} small />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Panel title="📊 Current Allocation">
          <AllocationChart data={allocationData} />
        </Panel>
        <Panel title="🔄 Rebalance History">
          <RebalanceHistory />
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={S.card}>
      <p style={S.label}>{label}</p>
      <p style={{ fontSize: small ? 14 : 26, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.card}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}
