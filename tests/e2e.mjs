// 画面確認:node tests/e2e.mjs [section...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 8123;
const BASE = `http://localhost:${PORT}/index.html`;
mkdirSync('screenshots', { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.argv.slice(2);
const wants = (name) => only.length === 0 || only.includes(name);
const errors = [];

async function open(query = '') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + query);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `screenshots/${name}.png` });
const outcome = (page) => page.evaluate(() => window.__game.outcome);
const startGame = async (page) => {
  await page.evaluate(() => window.__debugSkipOpening && window.__debugSkipOpening());
  await page.mouse.click(195, 420);
  await page.waitForTimeout(1300);
};

try {
  if (wants('basic')) {
    const page = await open('?rain=2d');
    await shot(page, '01-title');
    await startGame(page);
    assert.equal(await page.evaluate(() => window.__game.mode()), 'play');
    // 押したり離したりして帯内に保つ
    for (let i = 0; i < 30; i++) {
      const rain = await page.evaluate(() => window.__game.state.rain);
      if (rain < 0.5) await page.mouse.down(); else await page.mouse.up();
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    assert.equal(await outcome(page), 'playing');
    await shot(page, '02-playing');
    await page.waitForTimeout(6000);
    assert.equal(await outcome(page), 'closed');
    await page.waitForTimeout(1800);
    assert.match(await page.textContent('#endText'), /また明日/);
    await shot(page, '03-gameover');
    await page.close();
  }
  if (wants('landscape')) {
    const page = await open();
    await startGame(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);
    await shot(page, '04-landscape');
    await page.close();
  }
  if (wants('background')) {
    const page = await open();
    await page.evaluate(() => window.__debugBackground({ rain: 0.9 }));
    await page.waitForTimeout(200); await shot(page, '10-bg-heavy');
    await page.evaluate(() => window.__debugBackground({ rain: 0.1 }));
    await page.waitForTimeout(200); await shot(page, '11-bg-light');
    await page.evaluate(() => window.__debugBackground({ rain: 0, sunset: 1, rainbow: 1 }));
    await page.waitForTimeout(200); await shot(page, '12-bg-sunset-rainbow');
    await page.close();
  }
  if (wants('rain')) {
    for (const [q, kind] of [['?rain=2d', '2d'], ['?perf=off', 'gl']]) {
      const page = await open(q);
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.__game.rainKind), kind);
      await page.evaluate(() => window.__debugBackground({ rain: 0.9 }));
      await page.waitForTimeout(1200); await shot(page, `20-rain-${kind}-heavy`);
      await page.evaluate(() => window.__debugBackground({ rain: 0.3 }));
      await page.waitForTimeout(1200); await shot(page, `21-rain-${kind}-light`);
      if (kind === 'gl') {
        await page.evaluate(() => document.getElementById('rain').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => window.__game.rainKind), '2d');
        await startGame(page);
        assert.equal(await outcome(page), 'playing');
        await shot(page, '22-after-context-lost');
      }
      await page.close();
    }
  }
  if (wants('clear')) {
    const page = await open('?rain=2d');
    await startGame(page);
    await page.evaluate(() => window.__debugSetDoki(0.999));
    for (let i = 0; i < 20 && (await outcome(page)) === 'playing'; i++) {
      const rain = await page.evaluate(() => window.__game.state.rain);
      if (rain < 0.5) await page.mouse.down(); else await page.mouse.up();
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    assert.equal(await outcome(page), 'clear');
    await page.waitForTimeout(2000); await shot(page, '30-clear-promise');
    await page.waitForTimeout(7500); await shot(page, '31-clear-rainbow');
    await page.waitForTimeout(1500);
    assert.match(await page.textContent('#endText'), /成立/);
    await shot(page, '32-clear-end');
    await page.click('#retry');
    await page.waitForTimeout(200);
    assert.equal(await outcome(page), 'playing');
    assert.equal(await page.evaluate(() => window.__game.state.doki < 0.01), true);
    await page.close();
  }
  if (wants('opening')) {
    for (const [q, kind] of [['?perf=off', 'gl'], ['?rain=2d', '2d']]) {
      const page = await open(q);
      assert.equal(await page.evaluate(() => window.__game.openingKind), kind);
      await page.waitForTimeout(1000); await shot(page, `40-opening-${kind}-1s`);
      await page.waitForTimeout(3000); await shot(page, `41-opening-${kind}-4s`);
      await page.waitForTimeout(2500); await shot(page, `42-opening-${kind}-6s`);
      assert.equal(await page.isVisible('#title .hint'), true);
      await page.mouse.click(195, 420);
      await page.waitForTimeout(1300);
      assert.equal(await page.evaluate(() => window.__game.mode()), 'play');
      assert.equal(await outcome(page), 'playing');
      await page.close();
    }
  }
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('e2e ok');
} finally {
  await browser.close();
  server.kill();
}
