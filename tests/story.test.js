import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, lineAt, isClimax, GOODBYE, PROMISE } from '../src/story.js';

test('LINES is sorted by at', () => {
  for (let i = 1; i < LINES.length; i++) assert.ok(LINES[i].at >= LINES[i - 1].at);
});

test('12..15 lines', () => {
  assert.ok(LINES.length >= 12 && LINES.length <= 15);
});

test('lineAt(0) is the first line', () => {
  assert.equal(LINES[0].at, 0);
  assert.equal(lineAt(0).index, 0);
});

test('lineAt(0.5) is the last line at or before 0.5', () => {
  const expected = LINES.map((l, i) => [l, i]).filter(([l]) => l.at <= 0.5).pop()[1];
  assert.equal(lineAt(0.5).index, expected);
});

test('at least one climax line between 0.8 and 1', () => {
  assert.ok(LINES.some((l) => l.climax && l.at >= 0.8 && l.at < 1));
  const c = LINES.find((l) => l.climax);
  assert.equal(isClimax(c.at), true);
  assert.equal(isClimax(0), false);
});

test('GOODBYE texts include また明日', () => {
  assert.match(GOODBYE.closed, /また明日/);
  assert.match(GOODBYE.shelter, /また明日/);
  assert.ok(PROMISE.length > 0);
});
