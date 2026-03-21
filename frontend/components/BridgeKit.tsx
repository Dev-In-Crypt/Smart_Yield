'use client';

import { usePathname } from 'next/navigation';
import { InterwovenKit } from '@initia/interwovenkit-react';

const bridgeDenom = process.env.NEXT_PUBLIC_INTERWOVEN_BRIDGE_DENOM ?? 'uinit';

export function BridgeKit() {
  const pathname = usePathname();
  if (pathname !== '/bridge') return null;
  return <InterwovenKit bridge={{ srcChainId: 'initiation-2', srcDenom: bridgeDenom }} />;
}
