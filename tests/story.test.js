import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, getStory, lineAt, isClimax } from '../src/story.js';

test('five stories with unique ids, no teacher story', () => {
  assert.equal(STORIES.length, 5);
  assert.equal(new Set(STORIES.map((s) => s.id)).size, 5);
  assert.deepEqual(STORIES.map((s) => s.id), ['hajimete', 'tenkin', 'ryugaku', 'mukuchi', 'tenkou']);
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
