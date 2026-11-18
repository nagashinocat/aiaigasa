import { createState, step, band } from './logic.js';
import { lineAt, isClimax, GOODBYE, PROMISE } from './story.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createBackground } from './background.js';
import { createRain } from './rain.js';

const stage = document.getElementById('stage');
const ui = createUI(document);
const input = createInput(stage, window);

const bg = createBackground(document.getElementById('bg'));
const view = { rain: 0.5, sunset: 0, rainbow: 0, t: 0 };
let debugView = null;
window.__debugBackground = (v) => { debugView = v; };

const params = new URLSearchParams(location.search);
const rain = createRain(document.getElementById('rain'), document.getElementById('bg'),
  { force: params.get('rain'), perfCheck: params.get('perf') !== 'off' });

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bg.resize(innerWidth, innerHeight, dpr);
  rain.resize(innerWidth, innerHeight, dpr);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

let mode = 'title';          // title | play | end
let state = createState();
let last = performance.now();
const game = (window.__game = { get outcome() { return state.outcome; }, get state() { return state; }, mode: () => mode, get rainKind() { return rain.kind; } });
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
  view.t += Math.min(dt, 0.1);
  if (mode === 'play') view.rain = state.rain;
  const v = debugView ? { ...view, ...debugView } : view;
  bg.draw(v);
  rain.draw(v.rain, Math.min(dt, 0.1), view.t);
  requestAnimationFrame(frame);
}
ui.showTitle();
requestAnimationFrame(frame);
void game;
