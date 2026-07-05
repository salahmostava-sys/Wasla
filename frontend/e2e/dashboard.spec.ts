import { expect, test } from '@playwright/test';

const email = process.env.E2E_DASHBOARD_EMAIL;
const password = process.env.E2E_DASHBOARD_PASSWORD;
const shouldAssertAuthenticatedDashboard =
  process.env.E2E_ASSERT_AUTHENTICATED_DASHBOARD === '1' && !!email && !!password;

test.describe('Dashboard smoke', () => {
  test.describe('Unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test('redirects unauthenticated users to login', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    });
  });

  test('shows dashboard entry UI when authenticated', async ({ page }) => {
    // NOSONAR typescript:S1607 - intentionally, conditionally skipped: this smoke test only
    // runs when E2E_ASSERT_AUTHENTICATED_DASHBOARD=1 and real dashboard credentials are
    // configured (see shouldAssertAuthenticatedDashboard above); a reason is always provided.
    test.skip(!shouldAssertAuthenticatedDashboard, 'Authenticated dashboard smoke requires confirmed dashboard credentials'); // NOSONAR

    // With global auth setup, we just need to go to the root.
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'النظرة العامة' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'التحليلات والتوقعات' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'الطلبات' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'الحضور' })).toBeVisible();
  });
});
