'use client';

import { useEffect } from 'react';
import { useInterwovenKit, InterwovenKit } from '@initia/interwovenkit-react';
import Link from 'next/link';

const bridgeDenom = process.env.NEXT_PUBLIC_INTERWOVEN_BRIDGE_DENOM ?? 'uinit';

export default function BridgePage() {
  const { openBridge } = useInterwovenKit();

  useEffect(() => {
    openBridge({ srcChainId: 'initiation-2', srcDenom: bridgeDenom });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div style={{
        minHeight: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 24,
      }}>
        <div className="glass" style={{ padding: '32px 40px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <p className="label" style={{ marginBottom: 16 }}>Interwoven Bridge</p>
          <h2 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 10 }}>
            Bridge Assets
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
            Transfer INIT from Initia testnet to your appchain wallet.
          </p>
          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
            onClick={() => openBridge({ srcChainId: 'initiation-2', srcDenom: bridgeDenom })}
          >
            Open Bridge →
          </button>
          <Link href="/vault" className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
            ← Back to Vault
          </Link>
        </div>
      </div>
      <InterwovenKit bridge={{ srcChainId: 'initiation-2', srcDenom: bridgeDenom }} />
    </>
  );
}
