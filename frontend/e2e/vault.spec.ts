import { test, expect } from '@playwright/test';

test.describe('Vault page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vault', { waitUntil: 'networkidle' });
  });

  test('shows Connect Wallet prompt when wallet is not connected', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Connect your wallet/i })).toBeVisible();
  });

  test('shows Connect Wallet button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeEnabled();
  });

  test('Connect Wallet button is clickable without page crash', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Connect Wallet/i });
    await btn.click();
    await expect(page).toHaveURL(/\/vault/);
  });

  test('shows Connect Initia button (InterwovenKit)', async ({ page }) => {
    // The vault page has a "Connect Initia (InterwovenKit)" button — at least one must be visible
    await expect(page.getByRole('button', { name: /Connect Initia/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Smart Yield Vaults/);
  });
});

test.describe('Vault page — with mock wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const accounts = ['0x1234567890123456789012345678901234567890'];
      (window as unknown as Record<string, unknown>).ethereum = {
        isMetaMask: true,
        selectedAddress: accounts[0],
        chainId: '0x9586f89c95f77', // cabal chain id in hex
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return accounts;
          if (method === 'eth_chainId') return '0x9586f89c95f77';
          if (method === 'net_version') return '2630341494499703';
          return null;
        },
        on:             () => {},
        removeListener: () => {},
        emit:           () => {},
      };
    });
    await page.goto('/vault', { waitUntil: 'networkidle' });
  });

  test('vault page renders without crash when ethereum stub present', async ({ page }) => {
    // Page should show either the connect prompt or the vault form
    const headingCount = await page.getByRole('heading').count();
    const connectCount = await page.getByText(/connect/i).count();
    expect(headingCount + connectCount).toBeGreaterThan(0);
  });
});
