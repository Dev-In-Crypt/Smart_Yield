'use client';

import { useEffect, useState } from 'react';
import { useVault } from '@/hooks/useVault';
import { useRebalanceHistory } from '@/hooks/useRebalanceHistory';
import { AllocationChart } from '@/components/AllocationChart';
import { RebalanceHistory } from '@/components/RebalanceHistory';

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
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px' }}>
        <p className="panel-title" style={{ marginBottom: 28 }}>Dashboard</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass" style={{ height: 84, opacity: 0.25 }} />
          ))}
        </div>
        <div className="glass" style={{ height: 280, opacity: 0.25 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px' }}>
      <p className="panel-title" style={{ marginBottom: 28 }}>Dashboard</p>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total TVL"      value={totalAssetsFormatted ? `$${Number(totalAssetsFormatted).toFixed(2)}` : '—'} />
        <StatCard label="Rebalances"     value={vaultStats?.triggered_count ?? '—'} mono />
        <StatCard label="AI Cycles"      value={vaultStats?.total_rebalances ?? '—'} mono />
        <StatCard label="Last Rebalance" value={lastRebalanceAt} small />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel title="Allocation">
          <AllocationChart data={allocationData} />
        </Panel>
        <Panel title="Rebalance History">
          <RebalanceHistory />
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, small, mono }: { label: string; value: string; small?: boolean; mono?: boolean }) {
  return (
    <div className="glass" style={{ padding: '16px 20px' }}>
      <p className="label" style={{ marginBottom: 8 }}>{label}</p>
      <p style={{
        fontSize: small ? 13 : 24,
        fontWeight: small ? 400 : 100,
        fontFamily: mono || small ? 'var(--font-mono)' : 'var(--font-sans)',
        color: 'var(--text)',
        letterSpacing: small ? '0.01em' : '-0.02em',
        lineHeight: 1.1,
      }}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ padding: '20px 20px' }}>
      <p className="panel-title">{title}</p>
      {children}
    </div>
  );
}
