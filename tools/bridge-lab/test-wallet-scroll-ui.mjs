import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = process.env.HUB_TEST_ORIGIN || 'http://127.0.0.1:5174';
const output = new URL('test-results/wallet-scroll/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 900], ['short-desktop', 1024, 600],
    ['mobile', 390, 660], ['landscape', 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') return route.abort('blockedbyclient');
      if (url.origin === origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
      return route.fulfill({ json: { code: 0, data: { list: [], balances: [], total: 0 } } });
    });
    await page.addInitScript(() => {
      window.__walletSelections = [];
      const wallets = Array.from({ length: 12 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0');
        return {
          info: {
            uuid: `00000000-0000-4000-8000-0000000000${number}`,
            name: `Scroll Wallet ${number}`, rdns: `test.scroll.wallet${number}`,
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          },
          provider: {
            on() {}, removeListener() {},
            async request({ method }) {
              if (method === 'eth_chainId') return '0x301b';
              if (method === 'eth_accounts' || method === 'wallet_getPermissions') return [];
              if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
                window.__walletSelections.push(number);
                throw Object.assign(new Error('Test connection rejected'), { code: 4001 });
              }
              throw new Error(`Unexpected wallet method: ${method}`);
            },
          },
        };
      });
      const announce = () => wallets.forEach(detail => window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', { detail }),
      ));
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
    });
    await page.goto(origin + '/wallet');
    await page.getByRole('button', { name: /^Connect Wallet$/ }).last().click();
    const last = page.getByRole('button', { name: /Scroll Wallet 12/ });
    await expect(last).toHaveCount(1);
    await expect(page.getByText('12 Found')).toBeVisible();
    await page.waitForTimeout(300); // Let the modal's entrance animation finish.
    await page.screenshot({ path: new URL(`${name}-before.png`, output).pathname });
    // Locate the real scroll ancestor, whether the mobile body or desktop list.
    const scrollBox = await last.evaluate(element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
            parent.scrollHeight > parent.clientHeight) {
          const rect = parent.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
      return null;
    });
    assert.ok(scrollBox, `${name}: wallet list has no constrained scroll ancestor`);
    assert.ok(scrollBox.height > 0 && scrollBox.y >= 0 &&
      scrollBox.y + scrollBox.height <= height, `${name}: scroll area is clipped`);
    await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
    for (let step = 0; step < 12; step++) {
      const visible = await last.evaluate(element => {
        const r = element.getBoundingClientRect();
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) {
            const clip = parent.getBoundingClientRect();
            if (r.top < clip.top || r.bottom > clip.bottom) return false;
          }
        }
        return r.top >= 0 && r.bottom <= innerHeight &&
          element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      if (visible) break;
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(80);
    }
    await expect(last).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: new URL(`${name}-scrolled.png`, output).pathname });
    const bounds = await last.boundingBox();
    // A coordinate click prevents Playwright from auto-scrolling a broken list.
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect.poll(() => page.evaluate(() => window.__walletSelections)).toContain('12');
    await expect(page.getByRole('button', { name: 'Close wallet modal' })).toBeInViewport();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`${name}-after.png`, output).pathname });
    await page.getByRole('button', { name: 'Close wallet modal' }).click();
    await expect(page.getByRole('heading', { name: 'Connect a Wallet' })).toHaveCount(0);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${name}: wheel scroll and final wallet selection passed (mock providers only)`);
  }
} finally { await browser.close(); }
