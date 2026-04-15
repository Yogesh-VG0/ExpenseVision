import { test, expect } from "@playwright/test";

/**
 * Minimal Chromium happy-path E2E: Sign in → Add manual expense → Verify in expense list.
 *
 * This test covers the manual expense creation flow, not the receipt OCR flow.
 * Receipt OCR E2E is currently untestable in Playwright without a real AI provider
 * and file-upload mocking. If receipt E2E is needed, it should use a separate
 * test file with appropriate fixtures.
 *
 * Prerequisites:
 * - A running dev server (or Playwright will spin one up via playwright.config.ts)
 * - A valid Supabase test user with credentials in env:
 *   E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 *
 * Skipped if credentials are not set.
 */

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe("Manual expense happy path", () => {
  test.skip(!email || !password, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD required");

  test("sign in → add expense → verify in expense list", async ({ page }) => {
    // 1. Sign in
    await page.goto("/login");
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // 2. Navigate to expenses
    await page.click('a[href="/expenses"]');
    await expect(page).toHaveURL(/\/expenses/);

    // 3. Add a manual expense
    const addButton = page.locator("text=Add Expense").first();
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Fill expense form fields
    const vendorInput = page.locator('input[name="vendor"], input[placeholder*="vendor" i]').first();
    await expect(vendorInput).toBeVisible({ timeout: 3_000 });
    await vendorInput.fill("E2E Test Vendor");

    const amountInput = page.locator('input[name="amount"], input[placeholder*="amount" i], input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 3_000 });
    await amountInput.fill("12.34");

    const descInput = page.locator('input[name="description"], textarea[name="description"]').first();
    if (await descInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await descInput.fill("E2E automated test expense");
    }

    // Submit
    const saveBtn = page.locator('button:has-text("Save")').first();
    await expect(saveBtn).toBeVisible({ timeout: 3_000 });
    await saveBtn.click();

    // Wait for save to complete (toast or navigation)
    await page.waitForTimeout(2000);

    // 4. Verify the expense appears in the list
    await page.goto("/expenses");
    await page.waitForLoadState("networkidle");

    // Check that the page loaded with content
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
    // The vendor name should appear in the expense list
    expect(pageContent).toContain("E2E Test Vendor");
  });
});
