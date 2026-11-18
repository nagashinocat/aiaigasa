import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiToHz, barNotes, CHORDS, rainGain } from '../src/audio.js';

test('midiToHz: A4 is 440', () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.63) < 0.01);
});

test('barNotes loops through the chords', () => {
  assert.equal(CHORDS.length, 4);
  assert.deepEqual(barNotes(0).map((n) => n.midi), barNotes(CHORDS.length).map((n) => n.midi));
  assert.notDeepEqual(barNotes(0).map((n) => n.midi), barNotes(1).map((n) => n.midi));
});

test('barNotes: times are inside the bar and quiet', () => {
  for (let b = 0; b < 4; b++) {
    for (const n of barNotes(b)) {
      assert.ok(n.t >= 0 && n.t < 1);
      assert.ok(n.vel > 0 && n.vel <= 0.5);
    }
  }
});

test('rainGain rises with rain and is silent at 0', () => {
  assert.equal(rainGain(0), 0);
  assert.ok(rainGain(0.8) > rainGain(0.3));
  assert.ok(rainGain(1) <= 0.5);
});
