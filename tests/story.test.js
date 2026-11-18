import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, getStory, lineAt, isClimax } from '../src/story.js';

test('six stories with unique ids, no teacher story', () => {
  assert.equal(new Set(STORIES.map((s) => s.id)).size, 6);
  assert.deepEqual(STORIES.map((s) => s.id), ['hajimete', 'tenkin', 'ryugaku', 'mukuchi', 'tenkou', 'seijin']);
});

test('tenkou: the boy is the one moving away', () => {
  const s = getStory('tenkou');
  assert.equal(s.ask.who, 'he');
  assert.match(s.ask.text, /転校/);
  assert.equal(s.kids, true);
});

test('seijin: grown-up reunion recalls the childhood promise', () => {
  const s = getStory('seijin');
  assert.equal(s.kids, false);
  assert.match(s.ask.text, /お嫁さん/);
});

for (const s of STORIES) {
  test(`${s.id}: lines sorted, 12..15, start at 0`, () => {
    assert.ok(s.lines.length >= 12 && s.lines.length <= 15);
    assert.equal(s.lines[0].at, 0);
    for (let i = 1; i < s.lines.length; i++) assert.ok(s.lines[i].at >= s.lines[i - 1].at);
  });
  test(`${s.id}: climax between 0.8 and 1`, () => {
    const c = s.lines.find((l) => l.climax);
    assert.ok(c && c.at >= 0.8 && c.at < 1);
    assert.equal(isClimax(s, c.at), true);
    assert.equal(isClimax(s, 0), false);
  });
  test(`${s.id}: ask, answer, goodbyes, end title`, () => {
    assert.ok(s.ask.text && s.answer.text && s.endTitle && s.title && s.blurb);
    assert.match(s.goodbye.closed, /また明日/);
    assert.match(s.goodbye.shelter, /また明日/);
    assert.match(s.goodbye.closed, /(…|\()/);
  });
}

test('lineAt returns last line at or before doki', () => {
  const s = getStory('tenkin');
  const expected = s.lines.map((l, i) => [l, i]).filter(([l]) => l.at <= 0.5).pop()[1];
  assert.equal(lineAt(s, 0.5).index, expected);
});

test('getStory falls back to the first story', () => {
  assert.equal(getStory('nope').id, 'hajimete');
});

import { CONFIG } from '../src/logic.js';
for (const s of STORIES) {
  test(`${s.id}: pressing at the climax still raises rain by >= 0.12/s`, () => {
    const climaxDrift = s.tune.climaxDrift ?? CONFIG.climaxDrift;
    assert.ok(CONFIG.pressRate - climaxDrift >= 0.12, `${s.id} net ${CONFIG.pressRate - climaxDrift}`);
  });
}
