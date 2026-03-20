import { test, expect } from '@playwright/test';

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API routes so dashboard renders without a real DB
    await page.route('/api/rebalance-history*', (route) =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id:          1,
              executed_at: new Date().toISOString(),
              tx_hash:     '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              prev_alloc:  { '0xaaa': 5000, '0xbbb': 5000 },
              new_alloc:   { '0xaaa': 7000, '0xbbb': 3000 },
              explanation: 'Increased Strategy A due to higher APY.',
              triggered:   true,
            },
            {
              id:          2,
              executed_at: new Date(Date.now() - 3600_000).toISOString(),
              tx_hash:     null,
              prev_alloc:  { '0xaaa': 5000, '0xbbb': 5000 },
              new_alloc:   { '0xaaa': 5000, '0xbbb': 5000 },
              explanation: 'No change required.',
              triggered:   false,
            },
          ],
        }),
      }),
    );

    await page.route('/api/vault-stats*', (route) =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            total_rebalances: '10',
            triggered_count:  '7',
            last_rebalance_at: new Date().toISOString(),
          },
        }),
      }),
    );

    await page.goto('/dashboard');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
  });

  test('shows stat cards', async ({ page }) => {
    await expect(page.getByText(/Total TVL/i)).toBeVisible();
    await expect(page.getByText(/Rebalances/i)).toBeVisible();
    await expect(page.getByText(/AI Cycles/i)).toBeVisible();
    await expect(page.getByText(/Last Rebalance/i)).toBeVisible();
  });

  test('shows rebalance count from API', async ({ page }) => {
    // triggered_count = 7, shown in the "Rebalances" stat card
    // Use a more specific locator to avoid matching '7' in timestamps
    const rebalancesCard = page.locator('.rounded-2xl').filter({ hasText: 'Rebalances' });
    await expect(rebalancesCard.getByText('7')).toBeVisible();
  });

  test('shows Current Allocation panel', async ({ page }) => {
    await expect(page.getByText(/Current Allocation/i)).toBeVisible();
  });

  test('shows Rebalance History panel', async ({ page }) => {
    await expect(page.getByText(/Rebalance History/i)).toBeVisible();
  });

  test('displays executed rebalance entry from API', async ({ page }) => {
    await expect(page.getByText('Executed')).toBeVisible();
    await expect(page.getByText(/Increased Strategy A due to higher APY/i)).toBeVisible();
  });

  test('displays skipped rebalance entry from API', async ({ page }) => {
    await expect(page.getByText('Skipped')).toBeVisible();
    await expect(page.getByText(/No change required/i)).toBeVisible();
  });

  test('shows tx hash link for executed rebalances', async ({ page }) => {
    const link = page.getByRole('link', { name: /0xabcdef12/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /scan\.initia\.tech/);
  });
});
