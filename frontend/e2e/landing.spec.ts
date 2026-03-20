import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Smart Yield Vaults/);
  });

  test('shows key headline copy', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Smart Yield Vaults/i })).toBeVisible();
  });

  test('shows stats section with APY label', async ({ page }) => {
    await expect(page.getByText(/Current APY/i)).toBeVisible();
    await expect(page.getByText(/Total TVL/i)).toBeVisible();
    // Use exact match to avoid matching "rebalances" in the description paragraph
    await expect(page.getByText('Rebalances', { exact: true })).toBeVisible();
  });

  test('Deposit USDC button links to /vault', async ({ page }) => {
    const link = page.getByRole('link', { name: /Deposit USDC/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/vault');
  });

  test('View Dashboard button links to /dashboard', async ({ page }) => {
    const link = page.getByRole('link', { name: /View Dashboard/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/dashboard');
  });

  test('navigates to /vault on Deposit click', async ({ page }) => {
    await page.getByRole('link', { name: /Deposit USDC/i }).click();
    // Next.js dev server may take time to compile /vault on first visit
    await expect(page).toHaveURL(/\/vault/, { timeout: 60_000 });
  });

  test('navigates to /dashboard on View Dashboard click', async ({ page }) => {
    await page.getByRole('link', { name: /View Dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });
});
