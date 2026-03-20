'use client';

import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { vaultManagerConfig, ERC20_ABI } from '@/lib/contracts';

const USDC_DECIMALS = 6;

export function useVault() {
  const { address } = useAccount();

  const totalAssets = useReadContract({
    ...vaultManagerConfig,
    functionName: 'totalAssets',
  });

  const totalSupply = useReadContract({
    ...vaultManagerConfig,
    functionName: 'totalSupply',
  });

  const userShares = useReadContract({
    ...vaultManagerConfig,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const userAssets = useReadContract({
    ...vaultManagerConfig,
    functionName: 'convertToAssets',
    args: userShares.data !== undefined ? [userShares.data] : undefined,
    query: { enabled: userShares.data !== undefined },
  });

  const assetAddress = useReadContract({
    ...vaultManagerConfig,
    functionName: 'asset',
  });

  const { writeContractAsync: writeDeposit, isPending: isDepositing } = useWriteContract();
  const { writeContractAsync: writeRedeem,  isPending: isRedeeming  } = useWriteContract();
  const { writeContractAsync: writeApprove, isPending: isApproving  } = useWriteContract();

  async function approve(amount: bigint) {
    if (!assetAddress.data) throw new Error('Asset address not loaded');
    return writeApprove({
      address: assetAddress.data,
      abi:     ERC20_ABI,
      functionName: 'approve',
      args: [vaultManagerConfig.address, amount],
    });
  }

  async function deposit(usdcAmount: string) {
    const assets = parseUnits(usdcAmount, USDC_DECIMALS);
    if (!address) throw new Error('Wallet not connected');
    return writeDeposit({
      ...vaultManagerConfig,
      functionName: 'deposit',
      args: [assets, address],
    });
  }

  async function redeem(sharesAmount: bigint) {
    if (!address) throw new Error('Wallet not connected');
    return writeRedeem({
      ...vaultManagerConfig,
      functionName: 'redeem',
      args: [sharesAmount, address, address],
    });
  }

  return {
    // Read
    totalAssetsFormatted: totalAssets.data !== undefined
      ? formatUnits(totalAssets.data, USDC_DECIMALS)
      : null,
    totalAssetsRaw: totalAssets.data,
    totalSupply: totalSupply.data,

    userSharesRaw: userShares.data,
    userAssetsFormatted: userAssets.data !== undefined
      ? formatUnits(userAssets.data, USDC_DECIMALS)
      : null,
    userAssetsRaw: userAssets.data,

    assetAddress: assetAddress.data,

    isLoading: totalAssets.isLoading || userShares.isLoading,

    // Write
    approve,
    deposit,
    redeem,
    isDepositing,
    isRedeeming,
    isApproving,
  };
}
