import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText, layoutChat, CARD } from '../src/shareCard.js';

// 1文字 = size px の単純な測り方(英数字は半分)
const measureAt = (size) => (s) => [...s].reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? size * 0.55 : size), 0);

test('wrapText splits Japanese by char', () => {
  const rows = wrapText('あいうえおかきくけこ', 400, measureAt(100));
  assert.deepEqual(rows, ['あいうえ', 'おかきく', 'けこ']);
});

test('wrapText keeps English words, breaks an overlong word', () => {
  const m = measureAt(10);
  assert.deepEqual(wrapText('hello world foo', 40, m), ['hello', 'world', 'foo']);
  assert.deepEqual(wrapText('hello world foo', 70, m), ['hello world', 'foo']);
  const rows = wrapText('supercalifragilistic', 60, m);
  assert.ok(rows.length > 1);
  for (const r of rows) assert.ok(m(r) <= 60);
});

test('wrapText handles emoji as single characters', () => {
  const rows = wrapText('☔☔☔☔', 200, measureAt(100));
  assert.deepEqual(rows, ['☔☔', '☔☔']);
});

const longest = () => Array.from({ length: 15 }, (_, i) => ({ who: i % 2 ? 'he' : 'she', text: 'あ'.repeat(30) }));

test('15 lines of 30 chars keep font >= 34 and grow the card instead', () => {
  const lay = layoutChat(longest(), { width: CARD.w, top: CARD.chatTop, bottom: CARD.chatBottom, measureFor: measureAt });
  assert.equal(lay.fontSize, 34);
  assert.ok(lay.bottom > CARD.chatBottom);
  for (let i = 1; i < lay.bubbles.length; i++) assert.ok(lay.bubbles[i].y >= lay.bubbles[i - 1].y + lay.bubbles[i - 1].h);
  for (const b of lay.bubbles) assert.ok(b.x >= 0 && b.x + b.w <= CARD.w);
});

test('a 10-line story of 15 chars fits the standard 1920 card', () => {
  const lines = longest().slice(0, 10).map((l) => ({ ...l, text: 'あ'.repeat(15) }));
  const lay = layoutChat(lines, { width: CARD.w, top: CARD.chatTop, bottom: CARD.chatBottom, measureFor: measureAt });
  assert.ok(lay.bottom <= CARD.chatBottom, `bottom ${lay.bottom}`);
  assert.ok(lay.fontSize >= 34);
});

test('layoutChat uses the big font for a short story', () => {
  const lines = longest().slice(0, 6).map((l) => ({ ...l, text: 'こんにちは' }));
  assert.equal(layoutChat(lines, { width: CARD.w, top: CARD.chatTop, bottom: CARD.chatBottom, measureFor: measureAt }).fontSize, 40);
});

test('layoutChat alternates sides by who', () => {
  const lay = layoutChat(longest().slice(0, 6), { width: CARD.w, top: CARD.chatTop, bottom: CARD.chatBottom, measureFor: measureAt });
  const she = lay.bubbles.find((b) => b.who === 'she'), he = lay.bubbles.find((b) => b.who === 'he');
  assert.ok(she.x < CARD.w / 2 && he.x + he.w > CARD.w / 2);
  assert.ok(he.x > she.x);
});

test('wrapText never starts a row with 、。」!? (kinsoku)', () => {
  const m = measureAt(100);
  assert.deepEqual(wrapText('あいう、えお', 300, m), ['あいう、', 'えお']);
  assert.deepEqual(wrapText('あいう」えお', 300, m), ['あいう」', 'えお']);
  for (const r of wrapText('来年、大阪に行くことになった。…一緒に、来てくれないかな', 600, m)) {
    assert.ok(!/^[、。」』）!?！？…ー]/.test(r), r);
  }
});
