import { expect, test } from '@playwright/test';

test('renders the initial dashboard shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good morning.' })).toBeVisible();
  await expect(page.getByText('No transactions yet')).toBeVisible();
});

test('fits the dashboard on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good morning.' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
