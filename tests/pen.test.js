import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, penAt } from '../src/pen.js';

// 'ab c' : a=[0,10] b=[10,30] ' '=[30,35] c=[35,50]
const letters = [{ ch: 'a', x0: 0, x1: 10 }, { ch: 'b', x0: 10, x1: 30 }, { ch: ' ', x0: 30, x1: 35 }, { ch: 'c', x0: 35, x1: 50 }];

test('the pen starts at the first letter and ends at the last', () => {
  const plan = buildPlan(letters);
  assert.equal(penAt(plan, 0).x, 0);
  assert.equal(penAt(plan, plan.total).x, 50);
  assert.equal(penAt(plan, plan.total + 5).done, true);
});

test('the pen only moves forward', () => {
  const plan = buildPlan(letters);
  let last = -1;
  for (let t = 0; t <= plan.total; t += 0.01) { const x = penAt(plan, t).x; assert.ok(x >= last); last = x; }
});

test('it writes one letter at a time, pausing between letters', () => {
  const plan = buildPlan(letters, { gap: 0.1 });
  const a = plan.segments[0];
  // 1文字目を書き終えたあと、少し止まる
  assert.equal(penAt(plan, a.t1 + 0.05).x, 10);
  assert.equal(penAt(plan, a.t1 + 0.05).writing, false);
  assert.equal(penAt(plan, (a.t0 + a.t1) / 2).index, 0);
});

test('wider letters take longer; spaces are quick', () => {
  const plan = buildPlan(letters);
  const dur = (i) => plan.segments[i].t1 - plan.segments[i].t0;
  assert.ok(dur(1) > dur(0));
  assert.ok(dur(2) < dur(0));
});

test('a realistic title takes a few seconds', () => {
  const t = "while it's raining";
  const ls = [...t].map((ch, i) => ({ ch, x0: i * 18, x1: (i + 1) * 18 }));
  const plan = buildPlan(ls);
  assert.ok(plan.total > 3 && plan.total < 7, String(plan.total));
});
