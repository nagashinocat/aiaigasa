import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, createState, step, band } from '../src/logic.js';

const run = (s, secs, pressing, climax = false, dt = 0.05) => {
  for (let t = 0; t < secs - 1e-9; t += dt) s = step(s, dt, pressing, climax);
  return s;
};

test('starts in band', () => {
  const s = createState();
  assert.equal(s.rain, 0.5);
  assert.equal(s.outcome, 'playing');
  assert.equal(s.doki, 0);
});

test('pressing raises rain, releasing lowers it', () => {
  assert.ok(run(createState(), 0.5, true).rain > 0.5);
  assert.ok(run(createState(), 0.5, false).rain < 0.5);
});

test('rain clamps to 0..1', () => {
  let s = run({ ...createState(), rain: 0.99 }, 0.2, true);
  assert.ok(s.rain <= 1);
  s = run({ ...createState(), rain: 0.01 }, 0.2, false);
  assert.ok(s.rain >= 0);
});

test('too weak too long closes umbrella', () => {
  const s = run({ ...createState(), rain: 0.1 }, 2.1, false, false, 0.1);
  assert.equal(s.outcome, 'closed');
});

test('too strong too long goes to shelter', () => {
  const s = run({ ...createState(), rain: 0.95 }, 2.1, true, false, 0.1);
  assert.equal(s.outcome, 'shelter');
});

test('brief slip does not end game', () => {
  const s = run({ ...createState(), rain: 0.1 }, 1, false);
  assert.equal(s.outcome, 'playing');
});

test('doki fills in band and clears around 90s', () => {
  let s = createState();
  const keep = (secs) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) s = step(s, 0.05, s.rain < 0.5, false);
  };
  keep(85);
  assert.equal(s.outcome, 'playing');
  keep(6);
  assert.equal(s.outcome, 'clear');
});

test('climax narrows band', () => {
  assert.deepEqual(band(true), { low: 0.42, high: 0.58 });
  assert.deepEqual(band(false), { low: 0.35, high: 0.65 });
});

test('huge dt is capped', () => {
  const s = step(createState(), 5, false, false);
  assert.ok(s.grace > 0);
  assert.equal(s.outcome, 'playing');
});

test('finished state is frozen', () => {
  const done = { ...createState(), outcome: 'closed', rain: 0.2 };
  assert.deepEqual(step(done, 0.1, true, false), done);
});

test('config is exposed', () => {
  assert.equal(CONFIG.graceMax, 2.0);
});

test('tune overrides drift', () => {
  const fast = run(createState(), 1, false, false);
  let slow = createState();
  for (let t = 0; t < 1 - 1e-9; t += 0.05) slow = step(slow, 0.05, false, false, { drift: 0.05 });
  assert.ok(slow.rain > fast.rain);
});
