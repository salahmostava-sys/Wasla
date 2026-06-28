import { test, expect } from '@playwright/test';

const email = process.env.E2E_DASHBOARD_EMAIL;
const password = process.env.E2E_DASHBOARD_PASSWORD;
const shouldAssertAuthenticatedDashboard = !!email && !!password;

test.describe('صفحة الطلبات اليومية (Orders)', () => {
  test('يجب أن تعرض صفحة الطلبات والتبويبات وتحديث الرابط عند التنقل', async ({ page }) => {
    test.skip(!shouldAssertAuthenticatedDashboard, 'Requires authenticated session'); // NOSONAR

    // Navigate to orders page
    await page.goto('/orders');

    // Check heading
    await expect(page.getByRole('heading', { name: /الطلبات اليومية/ })).toBeVisible();

    // Verify tabs are present
    const gridTab = page.getByRole('tab', { name: /الطلبات/ });
    const shiftsTab = page.getByRole('tab', { name: /الدوام/ });
    const summaryTab = page.getByRole('tab', { name: /ملخص الشهر/ });

    await expect(gridTab).toBeVisible();
    await expect(shiftsTab).toBeVisible();
    await expect(summaryTab).toBeVisible();

    // By default, 'grid' tab should be selected
    await expect(gridTab).toHaveAttribute('aria-selected', 'true');

    // Switch to shifts tab and verify URL parameter
    await shiftsTab.click();
    await expect(shiftsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=shifts/);

    // Switch to summary tab and verify URL parameter
    await summaryTab.click();
    await expect(summaryTab).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=summary/);
  });
});
