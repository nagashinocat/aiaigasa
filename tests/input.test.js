import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

const setup = () => {
  const target = new EventTarget();
  const win = new EventTarget();
  return { target, win, input: createInput(target, win) };
};

test('pointerdown makes pressing true, pointerup false', () => {
  const { target, input } = setup();
  assert.equal(input.pressing(), false);
  target.dispatchEvent(new Event('pointerdown'));
  assert.equal(input.pressing(), true);
  target.dispatchEvent(new Event('pointerup'));
  assert.equal(input.pressing(), false);
});

test('pointercancel releases', () => {
  const { target, input } = setup();
  target.dispatchEvent(new Event('pointerdown'));
  target.dispatchEvent(new Event('pointercancel'));
  assert.equal(input.pressing(), false);
});

test('blur on window releases', () => {
  const { target, win, input } = setup();
  target.dispatchEvent(new Event('pointerdown'));
  win.dispatchEvent(new Event('blur'));
  assert.equal(input.pressing(), false);
});

test('contextmenu is prevented', () => {
  const { target } = setup();
  const e = new Event('contextmenu', { cancelable: true });
  target.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
});
