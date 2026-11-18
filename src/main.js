import { createState, step, band } from './logic.js';
import { lineAt, isClimax, GOODBYE, PROMISE } from './story.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';

const stage = document.getElementById('stage');
const ui = createUI(document);
const input = createInput(stage, window);

let mode = 'title';          // title | play | end
let state = createState();
let last = performance.now();
const game = (window.__game = { get outcome() { return state.outcome; }, get state() { return state; }, mode: () => mode });
window.__debugSetDoki = (v) => { state = { ...state, doki: v }; };

function startGame() {
  state = createState();
  mode = 'play';
  ui.showPlay();
}

function finish() {
  mode = 'end';
  const text = state.outcome === 'clear' ? `${PROMISE}\n\nデートの約束、成立!` : GOODBYE[state.outcome];
  ui.say(text);
  setTimeout(() => ui.showEnd(text), 1500);
}

ui.onStart(() => { if (mode === 'title') startGame(); });
ui.onRetry(startGame);

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (mode === 'play') {
    const climax = isClimax(state.doki);
    state = step(state, dt, input.pressing(), climax);
    ui.update(state, band(climax), lineAt(state.doki));
    if (state.outcome !== 'playing') finish();
  }
  requestAnimationFrame(frame);
}
ui.showTitle();
requestAnimationFrame(frame);
void game;
