import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHash, shareText, SITE_URL, storyLink } from '../src/share.js';

test('readHash parses #s= and #story=', () => {
  assert.deepEqual(readHash('#s=abc_-1'), { kind: 'custom', code: 'abc_-1' });
  assert.deepEqual(readHash('#story=tenkin'), { kind: 'builtin', id: 'tenkin' });
});

test('readHash returns null for others', () => {
  for (const h of ['', '#', '#foo', '#story=', '#s=', '#story=nope', '#s=<x>']) assert.equal(readHash(h), null, h);
});

test('shareText includes the hashtag and the link', () => {
  const t = shareText('https://x.test/#s=a');
  assert.match(t, /この二人の相合傘、守り切れる\?/);
  assert.match(t, /#相合傘をやめさせない/);
  assert.ok(t.endsWith('https://x.test/#s=a'));
});

test('storyLink builds links on the site URL', () => {
  assert.equal(SITE_URL, 'https://nagashinocat.github.io/aiaigasa/');
  assert.equal(storyLink({ kind: 'builtin', id: 'tenkin' }), SITE_URL + '#story=tenkin');
  assert.equal(storyLink({ kind: 'custom', code: 'abc' }), SITE_URL + '#s=abc');
});
