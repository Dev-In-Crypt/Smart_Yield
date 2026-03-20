'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits } from 'viem';
import { useVault } from '@/hooks/useVault';
import { ERC20_ABI, vaultManagerConfig } from '@/lib/contracts';

const S = {
  page:    { maxWidth: 520, margin: '0 auto', padding: '40px 20px' } as React.CSSProperties,
  card:    { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 16 } as React.CSSProperties,
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
  label:   { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 4 },
  value:   { fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  input:   { width: '100%', background: '#0f1117', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', fontSize: 18, color: 'var(--text)', outline: 'none', marginBottom: 12 } as React.CSSProperties,
  tab:     (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', fontWeight: 600, fontSize: 14,
    borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color:      active ? '#fff' : 'var(--text-muted)',
    transition: 'background 0.15s, color 0.15s',
  }),
};

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { disconnect }           = useDisconnect();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected) {
    return (
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 57px)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...S.card, textAlign: 'center', maxWidth: 360, padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Connect your wallet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>To deposit or withdraw, connect a Web3 wallet first.</p>
          <button className="btn-primary" style={{ width: '100%', fontSize: 16 }} onClick={() => connect({ connector: injected() })}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ ...S.row, marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Vault</h1>
        <button
          onClick={() => disconnect()}
          style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
        >
          {address?.slice(0, 6)}…{address?.slice(-4)} ✕
        </button>
      </div>

      <PositionSummary />
      <VaultForm />
    </div>
  );
}

function PositionSummary() {
  const { userAssetsFormatted, userSharesRaw, totalAssetsFormatted, isLoading } = useVault();
  return (
    <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
      <StatBox label="Your Position"  value={userAssetsFormatted ? `$${Number(userAssetsFormatted).toFixed(2)}` : '—'} />
      <StatBox label="Vault TVL"      value={totalAssetsFormatted ? `$${Number(totalAssetsFormatted).toFixed(2)}` : '—'} />
      <StatBox label="Your Shares"    value={userSharesRaw !== undefined ? formatUnits(userSharesRaw, 6) : '—'} />
      <StatBox label="Status"         value={isLoading ? 'Loading…' : '✅ Live'} />
    </div>
  );
}

function VaultForm() {
  const [tab, setTab]       = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const { address } = useAccount();
  const { approve, deposit, redeem, userSharesRaw, assetAddress, isDepositing, isRedeeming, isApproving } = useVault();

  const allowance = useReadContract({
    address: assetAddress, abi: ERC20_ABI, functionName: 'allowance',
    args: address ? [address, vaultManagerConfig.address] : undefined,
    query: { enabled: !!address && !!assetAddress },
  });
  const usdcBalance = useReadContract({
    address: assetAddress, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!assetAddress },
  });

  async function handleDeposit() {
    if (!amount) return;
    setStatus('');
    try {
      const amountBig = BigInt(Math.floor(Number(amount) * 1e6));
      if ((allowance.data ?? 0n) < amountBig) {
        setStatus('Approving…');
        await approve(amountBig);
        await allowance.refetch();
      }
      setStatus('Depositing…');
      await deposit(amount);
      setStatus('✅ Deposited!');
      setAmount('');
    } catch (e: unknown) {
      setStatus('❌ ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleRedeem() {
    if (!userSharesRaw) return;
    setStatus('Withdrawing…');
    try {
      await redeem(userSharesRaw);
      setStatus('✅ Withdrawn!');
    } catch (e: unknown) {
      setStatus('❌ ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  const maxUSDC = usdcBalance.data !== undefined ? formatUnits(usdcBalance.data, 6) : '0';

  return (
    <div style={S.card}>
      {/* Tabs */}
      <div style={{ display: 'flex', background: '#0f1117', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
        {(['deposit', 'withdraw'] as const).map((t) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => { setTab(t); setAmount(''); setStatus(''); }}>
            {t === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
          </button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <div>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <span style={S.label}>Amount (USDC)</span>
            <button onClick={() => setAmount(maxUSDC)} style={{ fontSize: 12, color: 'var(--accent-hover)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Max: {Number(maxUSDC).toFixed(2)}
            </button>
          </div>
          <input type="number" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={S.input} />
          <button className="btn-primary" style={{ width: '100%', fontSize: 16 }} onClick={handleDeposit} disabled={isDepositing || isApproving || !amount}>
            {isApproving ? 'Approving…' : isDepositing ? 'Depositing…' : 'Deposit USDC'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ ...S.label, marginBottom: 8 }}>Your shares to redeem</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
            {userSharesRaw !== undefined ? formatUnits(userSharesRaw, 6) : '0'} <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>SYV</span>
          </p>
          <button className="btn-primary" style={{ width: '100%', fontSize: 16 }} onClick={handleRedeem} disabled={isRedeeming || !userSharesRaw || userSharesRaw === 0n}>
            {isRedeeming ? 'Withdrawing…' : 'Withdraw All'}
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#0f1117', borderRadius: 8, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
          {status}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={S.label}>{label}</p>
      <p style={S.value}>{value}</p>
    </div>
  );
}
