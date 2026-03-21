'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function InterwovenActions() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { disconnect }           = useDisconnect();

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {isConnected && address ? (
        <button
          style={{ fontSize: 12, color: 'var(--text)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 100, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          onClick={() => disconnect()}
        >
          {shorten(address)}
        </button>
      ) : (
        <button
          style={{ fontSize: 12, color: '#111111', background: '#ffffff', border: 'none', borderRadius: 100, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          onClick={() => connect({ connector: injected() })}
        >
          Connect
        </button>
      )}
    </div>
  );
}
