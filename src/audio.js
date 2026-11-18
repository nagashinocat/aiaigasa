// 雨の音と薄いピアノのBGM(音声ファイルなし、Web Audio で合成)
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 王道進行 Fmaj7 → G6 → Em7 → Am7(ゆっくり、甘酸っぱく)
export const CHORDS = [
  { bass: 41, tones: [57, 60, 64, 65] }, // F
  { bass: 43, tones: [59, 62, 64, 67] }, // G
  { bass: 40, tones: [55, 59, 62, 64] }, // Em
  { bass: 45, tones: [57, 60, 64, 67] }, // Am
];
const BAR = 4.8; // 1小節の秒数

// 1小節ぶんの音:t は小節内の位置(0〜1)、vel は音量
export function barNotes(bar) {
  const c = CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length];
  const v = bar % 2 === 0 ? 1 : 0.85;
  return [
    { t: 0, midi: c.bass, vel: 0.3 },
    { t: 0.01, midi: c.bass + 12, vel: 0.14 },
    { t: 0.125, midi: c.tones[0], vel: 0.16 * v },
    { t: 0.25, midi: c.tones[1], vel: 0.15 * v },
    { t: 0.375, midi: c.tones[2], vel: 0.17 * v },
    { t: 0.5, midi: c.tones[3] + 12, vel: 0.13 * v },
    { t: 0.75, midi: c.tones[1] + 12, vel: 0.11 * v },
  ];
}

export const rainGain = (r) => (r <= 0 ? 0 : 0.42 * Math.pow(Math.min(1, r), 1.3));

export function createAudio({ storage } = {}) {
  let ctx = null, master, pianoBus, rainLP, rainG, rumbleG, timer = 0, nextBar = 0, bar = 0;
  let muted = false, rain = 0.5;
  try { muted = storage?.getItem('aiaigasa-muted') === '1'; } catch { /* 保存できない環境 */ }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    // 残響(その場で作るインパルス応答)
    const len = ctx.sampleRate * 3;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    const dry = ctx.createGain(); dry.gain.value = 0.5;
    pianoBus = ctx.createGain(); pianoBus.gain.value = 0.55;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    pianoBus.connect(tone); tone.connect(dry); tone.connect(verb); verb.connect(wet);
    dry.connect(master); wet.connect(master);

    // 雨音:ホワイトノイズを帯域で整える + 低いざわめき
    const nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    rainLP = ctx.createBiquadFilter(); rainLP.type = 'lowpass'; rainLP.frequency.value = 4000;
    rainG = ctx.createGain(); rainG.gain.value = 0;
    src.connect(hp); hp.connect(rainLP); rainLP.connect(rainG); rainG.connect(master);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 260;
    rumbleG = ctx.createGain(); rumbleG.gain.value = 0;
    src.connect(rlp); rlp.connect(rumbleG); rumbleG.connect(master);
    src.start();
    return true;
  }

  function note(midi, when, vel, decay = 3.6) {
    const f = midiToHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    g.connect(pianoBus);
    for (const [mul, amp, type] of [[1, 1, 'sine'], [2, 0.32, 'sine'], [3, 0.1, 'triangle'], [1, 0.18, 'triangle']]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f * mul;
      o.detune.value = (Math.random() - 0.5) * 4;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g);
      o.start(when); o.stop(when + decay + 0.1);
    }
  }

  function schedule() {
    if (!ctx) return;
    while (nextBar < ctx.currentTime + 1.2) {
      for (const n of barNotes(bar)) note(n.midi, nextBar + n.t * BAR, n.vel);
      nextBar += BAR; bar++;
    }
  }

  function applyRain() {
    if (!ctx) return;
    const t = ctx.currentTime;
    rainG.gain.setTargetAtTime(rainGain(rain), t, 0.4);
    rumbleG.gain.setTargetAtTime(rainGain(rain) * 0.6, t, 0.6);
    rainLP.frequency.setTargetAtTime(2500 + rain * 4000, t, 0.5);
  }

  const api = {
    // 最初のタップで呼ぶ(ブラウザの決まりで、音はタップのあとからしか鳴らせない)
    unlock() {
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
      if (!timer) { nextBar = ctx.currentTime + 0.3; timer = setInterval(schedule, 250); schedule(); applyRain(); }
    },
    setRain(r) {
      if (Math.abs(r - rain) < 0.01) return;
      rain = r; applyRain();
    },
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime + 0.05;
      [72, 76, 79, 83, 86].forEach((m, i) => note(m, t + i * 0.2, 0.17, 4.5));
    },
    setMuted(m) {
      muted = m;
      try { storage?.setItem('aiaigasa-muted', m ? '1' : '0'); } catch { /* 保存できない環境 */ }
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.15);
    },
    get muted() { return muted; },
    get state() { return ctx ? ctx.state : 'none'; },
  };

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  return api;
}
