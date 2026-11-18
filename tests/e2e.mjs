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
const startGame = async (page, id = 'hajimete') => {
  if (await page.evaluate(() => document.getElementById('opening').hidden)) {
    await page.evaluate(() => window.__debugChoose());
  } else {
    await page.evaluate(() => window.__debugSkipOpening());
    await page.mouse.click(195, 420);
    await page.waitForTimeout(1300);
  }
  await page.click(`#storyList [data-id=${id}]`);
  await page.waitForTimeout(300);
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
    const page = await open('?rain=2d');
    await page.evaluate(() => window.__debugHideOpening());
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
      await page.evaluate(() => window.__debugHideOpening());
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.__game.rainKind), kind);
      await page.evaluate(() => window.__debugBackground({ rain: 0.9 }));
      await page.waitForTimeout(1200); await shot(page, `20-rain-${kind}-heavy`);
      await page.evaluate(() => window.__debugBackground({ rain: 0.3 }));
      await page.waitForTimeout(1200); await shot(page, `21-rain-${kind}-light`);
      if (kind === 'gl') {
        await page.evaluate(() => window.__debugBackground({ rain: 0.05, sunset: 1, rainbow: 1 }));
        await page.waitForTimeout(1200); await shot(page, '23-rain-gl-sunset-rainbow');
        await page.evaluate(() => window.__debugBackground({ rain: 0.15, sunset: 0.5, rainbow: 0.5 }));
        await page.waitForTimeout(1200); await shot(page, '24-rain-gl-half-rainbow');
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
    await page.waitForTimeout(2000); await shot(page, '30-clear-ask');
    assert.match(await page.textContent('#bubble'), /晴れた日にも/);
    await page.waitForTimeout(6500); await shot(page, '31-clear-rainbow-answer');
    assert.match(await page.textContent('#bubble'), /傘のいらない日/);
    await page.waitForFunction(() => window.__game.mode() === 'end', null, { timeout: 8000 });
    assert.match(await page.textContent('#endTitle'), /成立/);
    assert.match(await page.textContent('#endText'), /晴れた日にも[\s\S]*傘のいらない日/);
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
      assert.equal(await page.evaluate(() => window.__game.mode()), 'select');
      await page.waitForTimeout(600); await shot(page, `43-select-${kind}`);
      await page.click('#storyList [data-id=tenkin]');
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__game.mode()), 'play');
      assert.equal(await page.evaluate(() => window.__game.story), 'tenkin');
      assert.equal(await outcome(page), 'playing');
      await page.close();
    }
  }
  if (wants('playthrough')) {
    // 帯の中央を狙って押す/離すを繰り返すボットで最後までクリアできるか
    const page = await open('?rain=2d');
    await startGame(page);
    const r = await page.evaluate(() => new Promise((done) => {
      const stage = document.getElementById('stage');
      let down = false, out = { normal: 0, climax: 0 }, t0 = performance.now();
      const id = setInterval(() => {
        const s = window.__game.state;
        const want = s.rain < 0.5;
        if (want !== down) { stage.dispatchEvent(new Event(want ? 'pointerdown' : 'pointerup')); down = want; }
        const climax = s.doki >= 0.87;
        const b = climax ? [0.42, 0.58] : [0.35, 0.65];
        if (s.rain < b[0] || s.rain > b[1]) out[climax ? 'climax' : 'normal']++;
        if (s.outcome !== 'playing') { clearInterval(id); done({ outcome: s.outcome, secs: (performance.now() - t0) / 1000, out }); }
      }, 50);
    }));
    console.log('playthrough', JSON.stringify(r));
    assert.equal(r.outcome, 'clear');
    assert.ok(r.secs > 60 && r.secs < 130);
    const css = await page.evaluate(() => { const c = getComputedStyle(document.body); return [c.touchAction, c.userSelect]; });
    assert.deepEqual(css, ['none', 'none']);
    await page.close();
  }
  if (wants('idle-under-opening')) {
    const page = await open('?perf=off');
    await page.waitForTimeout(2000);
    assert.equal(await page.evaluate(() => window.__game.rainFrames), 0);
    await page.close();
  }
  if (wants('stories')) {
    const ids = ['hajimete', 'tenkin', 'ryugaku', 'mukuchi', 'tenkou', 'seijin'];
    for (const id of ids) {
      const page = await open('?rain=2d');
      await startGame(page, id);
      assert.equal(await page.evaluate(() => window.__game.story), id);
      await page.evaluate(() => window.__debugSetDoki(0.5));
      await page.waitForTimeout(600); await shot(page, `50-story-${id}`);
      await page.evaluate(() => window.__debugSetDoki(0.9999));
      await page.evaluate(() => { const st = document.getElementById('stage'); let d = false;
        const id = setInterval(() => { const s = window.__game.state; const w = s.rain < 0.5;
          if (w !== d) { st.dispatchEvent(new Event(w ? 'pointerdown' : 'pointerup')); d = w; }
          if (s.outcome !== 'playing') { clearInterval(id); st.dispatchEvent(new Event('pointerup')); } }, 50); });
      await page.waitForFunction(() => window.__game.mode() === 'end', null, { timeout: 25000 });
      assert.equal(await outcome(page), 'clear', `${id} should clear`);
      const title = await page.textContent('#endTitle');
      assert.ok(title.length > 0, `${id} end title`);
      await shot(page, `51-story-${id}-end`);
      await page.click('#choose');
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.__game.mode()), 'select');
      await page.close();
    }
  }
  if (wants('audio')) {
    const page = await open('?rain=2d');
    assert.equal(await page.evaluate(() => window.__game.audio), 'none');
    await page.mouse.click(195, 420);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__game.audio), 'running');
    await page.click('#sound');
    assert.equal(await page.evaluate(() => window.__game.audio), 'muted');
    assert.equal(await page.evaluate(() => window.__game.mode()), 'title');
    await page.reload();
    assert.equal(await page.evaluate(() => window.__game.audio), 'muted');
    await page.click('#sound');
    assert.equal(await page.evaluate(() => window.__game.audio), 'running');
    await page.close();
  }
  if (wants('editor')) {
    const page = await open('?rain=2d');
    await page.evaluate(() => window.__debugHideOpening());
    await page.evaluate(() => window.__debugChoose());
    await page.click('#storyList [data-id=make]');
    await page.waitForTimeout(300);
    assert.equal(await page.isVisible('#editor'), true);
    await shot(page, '60-editor');
    // 5行に減らすとエラーで始まらない
    await page.click('#editor .line:last-child .del');
    await page.click('#edPlay');
    assert.match(await page.textContent('#edErrors'), /6行以上/);
    assert.equal(await page.evaluate(() => window.__game.mode()), 'edit');
    await page.click('#edAdd');
    await page.fill('#editor .line:last-child input', 'なに?');
    await page.fill('#editor .line:first-child input', '<b>x</b>');
    await page.click('#edPlay');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__game.mode()), 'play');
    assert.equal(await page.evaluate(() => window.__game.story), 'custom');
    await page.waitForTimeout(500);
    assert.equal(await page.textContent('#bubble'), '<b>x</b>');
    // 下書きが残る
    await page.reload();
    await page.evaluate(() => { window.__debugHideOpening(); window.__debugChoose(); });
    await page.click('#storyList [data-id=make]');
    assert.equal(await page.inputValue('#editor .line:first-child input'), '<b>x</b>');
    await page.close();
  }
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('e2e ok');
} finally {
  await browser.close();
  server.kill();
}
