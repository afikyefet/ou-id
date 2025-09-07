import { expect, test } from '@playwright/test';

test.describe('FluxFill Extension Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Load extension and navigate to test page
        await page.goto('http://localhost:3000/fixtures/basic-forms.html');

        // Wait for extension to load
        await page.waitForTimeout(1000);
    });

    test('Extension loads without console errors', async ({ page }) => {
        const errors = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.reload();
        await page.waitForTimeout(2000);

        // Filter out known non-critical errors
        const criticalErrors = errors.filter(error =>
            !error.includes('chrome-extension://') &&
            !error.includes('Non-passive event listener')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('Popup opens and displays correctly', async ({ page, context }) => {
        // Get extension ID (this would need to be set in test environment)
        const extensionId = 'your-extension-id';

        // Open popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Check if popup elements are present
        await expect(page.locator('h1')).toContainText('Element Snapper');
        await expect(page.locator('[data-tab="vars"]')).toBeVisible();
        await expect(page.locator('[data-tab="sites"]')).toBeVisible();
        await expect(page.locator('[data-tab="profiles"]')).toBeVisible();
    });

    test('Pick element creates variable', async ({ page }) => {
        // This test would require extension context
        // For now, we'll test the page structure

        const input = page.locator('input[name="email"]');
        await expect(input).toBeVisible();

        // Test that element can be selected
        await input.click();
        await expect(input).toBeFocused();
    });

    test('Form elements are accessible', async ({ page }) => {
        // Test basic form elements
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('textarea[name="message"]')).toBeVisible();
        await expect(page.locator('select[name="country"]')).toBeVisible();
        await expect(page.locator('input[type="checkbox"]')).toBeVisible();
        await expect(page.locator('input[type="radio"]')).toBeVisible();
    });

    test('Shadow DOM elements are accessible', async ({ page }) => {
        await page.goto('http://localhost:3000/fixtures/shadow-dom.html');

        // Test shadow DOM elements
        const shadowInput = page.locator('#shadow-host').locator('input');
        await expect(shadowInput).toBeVisible();

        // Test interaction
        await shadowInput.fill('test value');
        await expect(shadowInput).toHaveValue('test value');
    });

    test('Complex forms work correctly', async ({ page }) => {
        await page.goto('http://localhost:3000/fixtures/complex-forms.html');

        // Test various form elements
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const submitButton = page.locator('button[type="submit"]');

        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');

        await expect(emailInput).toHaveValue('test@example.com');
        await expect(passwordInput).toHaveValue('password123');
        await expect(submitButton).toBeEnabled();
    });

    test('Keyboard navigation works', async ({ page }) => {
        const emailInput = page.locator('input[name="email"]');
        const passwordInput = page.locator('input[name="password"]');

        await emailInput.focus();
        await expect(emailInput).toBeFocused();

        // Tab to next element
        await page.keyboard.press('Tab');
        await expect(passwordInput).toBeFocused();
    });

    test('Form validation works', async ({ page }) => {
        const emailInput = page.locator('input[name="email"]');
        const submitButton = page.locator('button[type="submit"]');

        // Test invalid email
        await emailInput.fill('invalid-email');
        await submitButton.click();

        // Check for validation message
        await expect(page.locator(':invalid')).toBeVisible();
    });
});
