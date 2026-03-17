import { test, expect } from '@playwright/test';

test.describe('Relay Detail Pages - Debug', () => {
  test('nip-11 page content check', async ({ page }) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.stack || err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/relays/wss/relay.damus.io/nip-11');
    await page.waitForTimeout(3000);

    // Check if SvelteKit error page is shown
    const errorEl = await page.$('text=500');
    const errorEl2 = await page.$('text=Internal Error');
    const errorEl3 = await page.$('text=error');
    const bodyText = await page.textContent('body');

    console.log('=== NIP-11 PAGE ===');
    console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
    console.log('Has "500" on page:', !!errorEl);
    console.log('Has "Internal Error" on page:', !!errorEl2);
    console.log('Page errors:', errors);
    console.log('Console errors:', consoleErrors);
  });

  test('audits page content check', async ({ page }) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.stack || err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/relays/wss/relay.damus.io/audits');
    await page.waitForTimeout(3000);

    const errorEl = await page.$('text=500');
    const errorEl2 = await page.$('text=Internal Error');
    const bodyText = await page.textContent('body');

    console.log('=== AUDITS PAGE ===');
    console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
    console.log('Has "500" on page:', !!errorEl);
    console.log('Has "Internal Error" on page:', !!errorEl2);
    console.log('Page errors:', errors);
    console.log('Console errors:', consoleErrors);
  });

  test('checks page content check (baseline)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.stack || err.message));

    await page.goto('/relays/wss/relay.damus.io/checks');
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    console.log('=== CHECKS PAGE (BASELINE) ===');
    console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));
    console.log('Page errors:', errors);
  });
});
