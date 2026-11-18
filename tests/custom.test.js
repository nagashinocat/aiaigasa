import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, normalizeCustom, encodeStory, decodeStory, storyToInput, packForTest } from '../src/custom.js';
import { getStory } from '../src/story.js';

const six = () => ({
  title: '雨の帰り道', kids: false,
  lines: [
    { who: 'she', text: '入れてくれてありがと' }, { who: 'he', text: 'うん' },
    { who: 'she', text: '近いね' }, { who: 'he', text: '…うん' },
    { who: 'she', text: 'あのね' }, { who: 'he', text: 'なに?' },
  ],
  ask: '明日も一緒に帰らない?', answer: '…うん、帰ろ',
});

test('normalizes a valid 6-line story', () => {
  const { story, errors } = normalizeCustom(six());
  assert.deepEqual(errors, []);
  assert.equal(story.id, 'custom');
  assert.equal(story.lines[0].at, 0);
  assert.equal(story.lines[4].at, 0.88);
  assert.equal(story.lines[5].at, 0.94);
  assert.ok(story.lines[4].climax && story.lines[5].climax && !story.lines[3].climax);
  for (let i = 1; i < 4; i++) assert.ok(story.lines[i].at > story.lines[i - 1].at && story.lines[i].at <= 0.83);
  assert.equal(story.ask.who, 'she');
  assert.equal(story.answer.who, 'he');
  assert.match(story.goodbye.closed, /また明日/);
  assert.equal(story.blurb, '雨の帰り道');
});

test('rejects 5 lines and 16 lines', () => {
  const a = six(); a.lines.pop();
  assert.equal(normalizeCustom(a).story, null);
  const b = six(); while (b.lines.length < 16) b.lines.push({ who: 'he', text: 'x' });
  assert.equal(normalizeCustom(b).story, null);
  assert.ok(normalizeCustom(b).errors.length > 0);
});

test('rejects a 31-char line, accepts 30', () => {
  const a = six(); a.lines[0].text = 'あ'.repeat(31);
  assert.equal(normalizeCustom(a).story, null);
  a.lines[0].text = 'あ'.repeat(30);
  assert.ok(normalizeCustom(a).story);
});

test('rejects empty line, empty ask/answer, long title', () => {
  for (const f of [(s) => { s.lines[2].text = '   '; }, (s) => { s.ask = ''; }, (s) => { s.answer = ''; }, (s) => { s.title = 'あ'.repeat(21); }]) {
    const s = six(); f(s);
    assert.equal(normalizeCustom(s).story, null);
  }
});

test('trims and removes newlines', () => {
  const s = six(); s.lines[0].text = '  入れて\nくれて  ';
  assert.equal(normalizeCustom(s).story.lines[0].text, '入れて くれて');
});

test('roundtrip encode/decode equals normalize', async () => {
  const code = await encodeStory(six());
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const decoded = await decodeStory(code);
  assert.deepEqual(decoded, normalizeCustom(six()).story);
});

test('decode garbage returns null', async () => {
  const code = await encodeStory(six());
  for (const bad of ['%%%', '', 'abc', code.slice(0, code.length - 5)]) assert.equal(await decodeStory(bad), null);
});

test('decoded story is re-validated', async () => {
  const s = six(); s.lines[0].text = 'あ'.repeat(31);
  const code = await packForTest(s);
  assert.equal(await decodeStory(code), null);
});

test('storyToInput turns a built-in story back into input', () => {
  const input = storyToInput(getStory('tenkin'));
  assert.equal(input.lines.length, getStory('tenkin').lines.length);
  assert.equal(input.ask, getStory('tenkin').ask.text.replace(/\n/g, ''));
  assert.equal(LIMITS.maxLines, 15);
});
