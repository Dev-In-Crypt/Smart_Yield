import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';

// Initia EVM Minitia — fill chain ID and RPC after deployment
const initiaMiniEVM = defineChain({
  id:   Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1),
  name: 'Initia EVM Minitia',
  nativeCurrency: { name: 'INIT', symbol: 'INIT', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545'] },
  },
});

export const wagmiConfig = createConfig({
  chains:      [initiaMiniEVM],
  transports:  { [initiaMiniEVM.id]: http() },
});
