'use client';

// Must be first: patches React vendored by Next.js to add useEffectEvent
import '@/lib/react-compat';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';
import { useEffect, useState } from 'react';
import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from '@initia/interwovenkit-react';
import InterwovenKitStyles from '@initia/interwovenkit-react/styles.js';
import '@initia/interwovenkit-react/styles.css';

const chainId = process.env.NEXT_PUBLIC_INTERWOVEN_CHAIN_ID ?? 'initiation-2';
const bridgeDenom = process.env.NEXT_PUBLIC_INTERWOVEN_BRIDGE_DENOM ?? 'uinit';

const customChain = {
  chain_id: chainId,
  chain_name: 'Initia EVM Minitia',
  network_type: 'testnet',
  bech32_prefix: 'init',
  apis: {
    rpc: [{ address: process.env.NEXT_PUBLIC_INTERWOVEN_RPC_URL ?? 'http://localhost:26657' }],
    rest: [{ address: process.env.NEXT_PUBLIC_INTERWOVEN_REST_URL ?? 'http://localhost:1317' }],
    indexer: [{ address: process.env.NEXT_PUBLIC_INTERWOVEN_INDEXER_URL ?? 'http://localhost:8080' }],
    'json-rpc': [{ address: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545' }],
  },
  fees: {
    fee_tokens: [{
      denom: bridgeDenom,
      fixed_min_gas_price: 0,
      low_gas_price: 0,
      average_gas_price: 0,
      high_gas_price: 0,
    }],
  },
  staking: { staking_tokens: [{ denom: bridgeDenom }] },
  native_assets: [{ denom: bridgeDenom, name: 'Initia', symbol: 'INIT', decimals: 6 }],
  metadata: { is_l1: false, minitia: { type: 'minievm' } },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    injectStyles(InterwovenKitStyles);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...(TESTNET as any)}
          defaultChainId="initiation-2"
          customChain={chainId !== 'initiation-2' ? (customChain as any) : undefined}
        >
          {children}
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
