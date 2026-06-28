import { test, expect } from '@playwright/test';

const email = process.env.E2E_DASHBOARD_EMAIL;
const password = process.env.E2E_DASHBOARD_PASSWORD;
const shouldAssertAuthenticatedDashboard = !!email && !!password;

test.describe('صفحة الموظفين (Employees)', () => {
  test('يجب أن تعرض صفحة الموظفين الأساسية والتبويبات', async ({ page }) => {
    test.skip(!shouldAssertAuthenticatedDashboard, 'Requires authenticated session'); // NOSONAR

    // Navigate to employees page
    await page.goto('/employees');

    // Wait for the main heading or breadcrumb to ensure the page loaded
    await expect(page.locator('.page-breadcrumb')).toContainText('الموظفون');

    // Tab buttons should be visible
    const tableTab = page.getByRole('button', { name: /جدول الموظفين/ });
    const kpiTab = page.getByRole('button', { name: /مؤشرات الأداء/ });

    await expect(tableTab).toBeVisible();
    await expect(kpiTab).toBeVisible();

    // The grid/table should be active by default
    await expect(tableTab).toHaveClass(/bg-background/);
    
    // Switch to KPI tab
    await kpiTab.click();
    await expect(kpiTab).toHaveClass(/bg-background/);
  });
});
