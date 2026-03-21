'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits } from 'viem';
import { useVault } from '@/hooks/useVault';
import { ERC20_ABI, vaultManagerConfig } from '@/lib/contracts';

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { disconnect }           = useDisconnect();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="glass" style={{ padding: 40, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 20 }}>⬡</div>
          <h2 style={{ fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8, color: 'var(--text)' }}>
            Connect wallet
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
            Connect a Web3 wallet to deposit or withdraw from the vault.
          </p>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => connect({ connector: injected() })}>
            Connect EVM Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

      {/* ── Left column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PositionSummary />
        <BridgePanel />
      </div>

      {/* ── Right column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Wallet header */}
        <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
          <button onClick={() => disconnect()} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            Disconnect
          </button>
        </div>
        <VaultForm />
      </div>

    </div>
  );
}

function BridgePanel() {
  return (
    <div className="glass" style={{ padding: 20 }}>
      <p className="panel-title">Interwoven Bridge</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Bridge test assets from Initia testnet to your appchain wallet before deposit.
      </p>
      <a
        href="https://app.initia.xyz/bridge"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost"
        style={{ fontSize: 13, display: 'inline-flex' }}
      >
        Open Bridge ↗
      </a>
    </div>
  );
}

function PositionSummary() {
  const { userAssetsFormatted, userSharesRaw, totalAssetsFormatted, isLoading } = useVault();
  return (
    <div className="glass" style={{ padding: 20 }}>
      <p className="panel-title">Your Position</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StatBox label="Deposited" value={userAssetsFormatted ? `$${Number(userAssetsFormatted).toFixed(2)}` : '—'} />
        <StatBox label="Vault TVL"  value={totalAssetsFormatted ? `$${Number(totalAssetsFormatted).toFixed(2)}` : '—'} />
        <StatBox label="Shares (SYV)" value={userSharesRaw !== undefined ? formatUnits(userSharesRaw, 6) : '—'} mono />
        <StatBox label="Status" value={isLoading ? 'Loading…' : 'Live'} live={!isLoading} />
      </div>
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
      if ((allowance.data ?? BigInt(0)) < amountBig) {
        setStatus('Approving…');
        await approve(amountBig);
        await allowance.refetch();
      }
      setStatus('Depositing…');
      await deposit(amount);
      setStatus('✓ Deposited');
      setAmount('');
    } catch (e: unknown) {
      setStatus('Error: ' + (e instanceof Error ? e.message.slice(0, 60) : String(e)));
    }
  }

  async function handleRedeem() {
    if (!amount && !userSharesRaw) return;
    setStatus('Withdrawing…');
    try {
      const sharesAmount = amount
        ? BigInt(Math.floor(Number(amount) * 1e6))
        : userSharesRaw!;
      await redeem(sharesAmount);
      setStatus('✓ Withdrawn');
      setAmount('');
    } catch (e: unknown) {
      setStatus('Error: ' + (e instanceof Error ? e.message.slice(0, 60) : String(e)));
    }
  }

  const maxUSDC = usdcBalance.data !== undefined ? formatUnits(usdcBalance.data, 6) : '0';

  return (
    <div className="glass" style={{ padding: 20 }}>
      <p className="panel-title">Actions</p>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {(['deposit', 'withdraw'] as const).map((t) => (
          <button key={t} className={`tab-item${tab === t ? ' active' : ''}`}
            onClick={() => { setTab(t); setAmount(''); setStatus(''); }}>
            {t === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
          </button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="label">Amount USDC</span>
            <button onClick={() => setAmount(maxUSDC)}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              MAX {Number(maxUSDC).toFixed(2)}
            </button>
          </div>
          <input
            className="field-input"
            type="number" min="0" placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleDeposit}
            disabled={isDepositing || isApproving || !amount}>
            {isApproving ? 'Approving…' : isDepositing ? 'Depositing…' : 'Deposit USDC'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="label">Shares to redeem</span>
            <button
              onClick={() => setAmount(userSharesRaw !== undefined ? formatUnits(userSharesRaw, 6) : '0')}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              MAX {userSharesRaw !== undefined ? Number(formatUnits(userSharesRaw, 6)).toFixed(2) : '0.00'}
            </button>
          </div>
          <input
            className="field-input"
            type="number" min="0" placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginBottom: 4 }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>SYV</p>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleRedeem}
            disabled={isRedeeming || (!amount && (!userSharesRaw || userSharesRaw === BigInt(0)))}>
            {isRedeeming ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {status}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, mono, live }: { label: string; value: string; mono?: boolean; live?: boolean }) {
  return (
    <div>
      <p className="label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: mono ? 100 : 300, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', color: live ? 'var(--green)' : 'var(--text)', letterSpacing: mono ? '-0.01em' : undefined }}>
        {live && <span style={{ fontSize: 8, marginRight: 6, verticalAlign: 'middle' }}>●</span>}
        {value}
      </p>
    </div>
  );
}
