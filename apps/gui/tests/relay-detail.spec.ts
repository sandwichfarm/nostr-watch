import { test, expect } from '@playwright/test';

test.describe('Relay Detail Pages', () => {
  test('baseline - checks page loads without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto('/relays/wss/relay.damus.io/checks');
    expect(response?.status()).not.toBe(500);
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('nip-11 page loads without 500 error', async ({ page }) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/relays/wss/relay.damus.io/nip-11');
    expect(response?.status()).not.toBe(500);
    await page.waitForTimeout(2000);

    const has500 = errors.some((e) => e.includes('500')) ||
                   consoleErrors.some((e) => e.includes('500'));
    if (errors.length > 0) console.log('Page errors:', errors);
    if (consoleErrors.length > 0) console.log('Console errors:', consoleErrors);
    expect(has500).toBe(false);
    expect(errors).toEqual([]);
  });

  test('audits page loads without 500 error', async ({ page }) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/relays/wss/relay.damus.io/audits');
    expect(response?.status()).not.toBe(500);
    await page.waitForTimeout(2000);

    const has500 = errors.some((e) => e.includes('500')) ||
                   consoleErrors.some((e) => e.includes('500'));
    if (errors.length > 0) console.log('Page errors:', errors);
    if (consoleErrors.length > 0) console.log('Console errors:', consoleErrors);
    expect(has500).toBe(false);
    expect(errors).toEqual([]);
  });
});
