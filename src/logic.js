// ゲームの決まりごと(描画なし)
export const CONFIG = {
  rainStart: 0.5, pressRate: 0.35, drift: 0.12, climaxDrift: 0.22,
  band: { low: 0.35, high: 0.65 }, climaxBand: { low: 0.42, high: 0.58 },
  graceMax: 2.0, graceRecover: 0.5, dokiRate: 1 / 90, maxDt: 0.1,
};

export function band(climax) {
  const b = climax ? CONFIG.climaxBand : CONFIG.band;
  return { low: b.low, high: b.high };
}

export function createState() {
  return { rain: CONFIG.rainStart, grace: CONFIG.graceMax, doki: 0, outcome: 'playing', time: 0 };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function step(state, dt, pressing, climax) {
  if (state.outcome !== 'playing') return state;
  dt = clamp(dt, 0, CONFIG.maxDt);
  const s = { ...state, time: state.time + dt };
  const push = (pressing ? CONFIG.pressRate : 0) - (climax ? CONFIG.climaxDrift : CONFIG.drift);
  s.rain = clamp(s.rain + push * dt, 0, 1);
  const { low, high } = band(climax);
  if (s.rain >= low && s.rain <= high) {
    s.doki = Math.min(1, s.doki + CONFIG.dokiRate * dt);
    s.grace = Math.min(CONFIG.graceMax, s.grace + CONFIG.graceRecover * dt);
    if (s.doki >= 1) s.outcome = 'clear';
  } else {
    s.grace -= dt;
    if (s.grace <= 0) { s.grace = 0; s.outcome = s.rain < low ? 'closed' : 'shelter'; }
  }
  return s;
}
