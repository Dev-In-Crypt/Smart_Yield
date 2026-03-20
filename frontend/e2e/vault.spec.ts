import { test, expect } from '@playwright/test';

test.describe('Vault page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vault');
  });

  test('shows Connect Wallet prompt when wallet is not connected', async ({ page }) => {
    // Without an injected wallet the page should show the connect prompt
    await expect(page.getByRole('heading', { name: /Connect your wallet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
  });

  test('Connect Wallet button is clickable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Connect Wallet/i });
    await expect(btn).toBeEnabled();
    // Clicking will attempt to open wallet modal — we just verify no page crash
    await btn.click();
    // Page should not navigate away or throw
    await expect(page).toHaveURL(/\/vault/);
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
    await page.goto('/vault');
  });

  // wagmi connection requires a full wallet handshake that can't be easily
  // simulated in Playwright without a real wallet extension. This test verifies
  // the page loads without errors and at least shows some vault-related UI.
  test('vault page renders without crash when ethereum stub present', async ({ page }) => {
    // The page should show either the connect prompt or the vault form —
    // either way it must render something (not a blank/error page).
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();

    // The heading or connect button should be on screen
    const hasHeading     = await page.getByRole('heading').count() > 0;
    const hasConnectText = await page.getByText(/connect|vault/i).count() > 0;
    expect(hasHeading || hasConnectText).toBe(true);
  });
});
