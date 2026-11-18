// オープニング:水滴のついた曇りガラス、すぐ向こうで雨に揺れる葉っぱ、
// 奥にぼやけた相合傘の二人。ガラスに指で「while it's raining」と書かれていく
import { GLSL_COMMON, compile } from './rainGL.js';

const TEXT = "while it's raining";
const WRITE_START = 1.0, WRITE_DUR = 3.2, HINT_AT = WRITE_START + WRITE_DUR + 0.8;

const VS = `attribute vec2 p; varying vec2 v_uv;
void main(){ v_uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `precision mediump float;
uniform sampler2D u_scene, u_mask; uniform vec2 u_res; uniform float u_time, u_fade;
varying vec2 v_uv;
${GLSL_COMMON}
vec3 blurred(vec2 uv, float r){
  vec2 px = r/u_res;
  vec3 c = vec3(0.);
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++)
    c += texture2D(u_scene, uv + vec2(float(i), float(j))*px).rgb;
  return c/25.;
}
void main(){
  vec2 frag = v_uv*u_res;
  vec2 uv = (frag - .5*u_res)/u_res.y;
  float t = u_time*.2;
  float l0 = 1.4, l1 = .55, l2 = .5;
  vec2 e = vec2(.001,0.);
  float c = drops(uv,t,l0,l1,l2);
  vec2 nrm = vec2(drops(uv+e,t,l0,l1,l2) - c, drops(uv+e.yx,t,l0,l1,l2) - c);
  float wipe = texture2D(u_mask, v_uv).a;
  // 水滴のところはガラスの曇りが取れて、奥がレンズのように映る
  float clear = max(wipe, S(.1,.5,c));
  vec2 suv = v_uv + nrm*1.4;
  vec3 sharp = texture2D(u_scene, suv).rgb;
  vec3 soft = blurred(v_uv, 3.5);
  vec3 fog = mix(soft, vec3(.80,.83,.87), .38);
  vec3 col = mix(fog, sharp, clear);
  col += S(.0,.02,-nrm.y)*c*.15;
  // ガラスに当たる光の筋
  col += vec3(.04)*S(.6,1.,1. - abs(v_uv.x - v_uv.y*.4 - .3)*3.);
  gl_FragColor = vec4(col, u_fade);
}`;

function leafPath(len) {
  const p = new Path2D();
  const w = len * 0.36;
  p.moveTo(0, 0);
  p.bezierCurveTo(len * 0.25, -w, len * 0.75, -w * 0.8, len, 0);
  p.bezierCurveTo(len * 0.75, w * 0.75, len * 0.25, w * 0.9, 0, 0);
  return p;
}

export function createOpening(canvas, onDone, { force } = {}) {
  const scene = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const backdrop = document.createElement('canvas');
  const sctx = scene.getContext('2d'), mctx = mask.getContext('2d');
  const tmp = document.createElement('canvas');
  const leafCanvas = document.createElement('canvas');
  leafCanvas.className = 'opening-leaf';
  canvas.after(leafCanvas);
  const lctx = leafCanvas.getContext('2d');
  let backdropReady = false;
  let W = 1, H = 1, D = 1, T = 0, running = false, done = false, raf = 0, last = 0, fade = 1, leaving = false;
  const leaf = { ang: 0, vel: 0, drip: 0, falls: [], splashes: [], nextHit: 0.5 };

  // WebGL
  let gl = null, prog, U, texS, texM;
  try {
    gl = force === '2d' ? null : canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (gl) {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const mk = (unit) => {
        const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        return tx;
      };
      texS = mk(0); texM = mk(1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const u = (n) => gl.getUniformLocation(prog, n);
      U = { scene: u('u_scene'), mask: u('u_mask'), res: u('u_res'), time: u('u_time'), fade: u('u_fade') };
      gl.uniform1i(U.scene, 0); gl.uniform1i(U.mask, 1);
    }
  } catch (e) { console.warn('opening GL', e); gl = null; }
  const ctx2d = gl ? null : canvas.getContext('2d');

  function resize(w, h) {
    W = w; H = h; D = 1; // ぼかした絵なので等倍で十分(軽さ優先)
    backdropReady = false;
    for (const c of [canvas, scene, mask, backdrop, tmp, leafCanvas]) { c.width = Math.round(w); c.height = Math.round(h); }
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // ---- 奥のシーン ----
  function drawBackdrop() {
    const c = backdrop.getContext('2d');
    c.setTransform(D, 0, 0, D, 0, 0);
    c.filter = 'none';
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5a6576'); g.addColorStop(0.62, '#7d8796'); g.addColorStop(1, '#2c323d');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // ぼやけた街の灯り
    c.save(); c.filter = `blur(${H * 0.012}px)`;
    c.fillStyle = '#3c4452';
    for (let i = 0; i < 9; i++) c.fillRect(i * W / 8 - 20, H * (0.42 + ((i * 37) % 11) / 100), W / 7, H * 0.3);
    const lights = [[0.1, 0.5, '#ffd9a0'], [0.32, 0.46, '#ffe7c0'], [0.78, 0.48, '#ffcf8a'], [0.92, 0.55, '#ffe0b0'], [0.55, 0.43, '#cfe3ff']];
    for (const [x, y, col] of lights) {
      const r = H * 0.035;
      const gg = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, r);
      gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(255,220,170,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x * W, y * H, r, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // ぼやけた相合傘の二人
    c.save(); c.filter = `blur(${H * 0.006}px)`;
    const k = W * 0.0042, cx = W * 0.6, base = H * 0.74;
    c.translate(cx - 60 * k, base - 130 * k); c.scale(k, k);
    c.fillStyle = '#1a1f28';
    c.beginPath(); c.moveTo(10, 48); c.quadraticCurveTo(60, -6, 110, 48); c.closePath(); c.fill();
    c.fillRect(59, 46, 2, 40);
    c.beginPath(); c.arc(44, 66, 8, 0, 7); c.arc(76, 62, 9, 0, 7); c.fill();
    c.beginPath(); c.moveTo(33, 128); c.lineTo(35, 90); c.quadraticCurveTo(44, 72, 53, 90); c.lineTo(55, 128); c.fill();
    c.beginPath(); c.moveTo(64, 128); c.lineTo(66, 88); c.quadraticCurveTo(76, 68, 86, 88); c.lineTo(88, 128); c.fill();
    c.restore();
    // 濡れた路面
    c.save(); c.filter = `blur(${H * 0.008}px)`;
    c.fillStyle = 'rgba(20,24,30,.55)'; c.fillRect(0, H * 0.74, W, H * 0.26);
    c.restore();
    backdropReady = true;
  }

  function drawScene(dt) {
    if (!backdropReady) drawBackdrop();
    const c = sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.filter = 'none';
    c.drawImage(backdrop, 0, 0);
    c.setTransform(D, 0, 0, D, 0, 0);

    // ガラスの向こうの雨筋
    c.strokeStyle = 'rgba(220,230,245,.18)'; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = ((i * 97.3) % W), y = ((i * 211.7 + T * 900) % (H + 40)) - 20;
      c.moveTo(x, y); c.lineTo(x - 2, y - 16);
    }
    c.stroke();
  }

  // ガラスの手前の葉っぱ:くっきり見えて、雨粒が当たると揺れる
  function drawLeaf(dt) {
    const c = lctx;
    c.setTransform(D, 0, 0, D, 0, 0);
    c.clearRect(0, 0, W, H);
    leaf.nextHit -= dt;
    if (leaf.nextHit <= 0) {
      leaf.vel += (0.6 + Math.random() * 0.9) * (Math.random() < 0.8 ? 1 : -0.6);
      leaf.nextHit = 0.35 + Math.random() * 0.9;
      leaf.splashes.push({ s: Math.random() * 0.7 + 0.2, a: 1 });
      leaf.drip += 0.2;
    }
    leaf.vel += (-leaf.ang * 26 - leaf.vel * 3.2) * dt;
    leaf.ang += leaf.vel * dt;
    const len = W * 0.62, ax = -W * 0.08, ay = H * 0.86;
    const ang = -0.42 + leaf.ang * 0.18;
    c.save(); c.filter = 'none';
    c.translate(ax, ay); c.rotate(ang);
    c.strokeStyle = '#1e3a24'; c.lineWidth = 4; c.beginPath(); c.moveTo(-W * 0.1, 6); c.lineTo(0, 0); c.stroke();
    const lg = c.createLinearGradient(0, -len * 0.3, len * 0.3, len * 0.3);
    lg.addColorStop(0, '#4f8a4a'); lg.addColorStop(1, '#244a2a');
    c.fillStyle = lg; c.fill(leafPath(len));
    // 葉の上の水玉
    for (const [px, py, r] of [[0.3, -0.05, 4], [0.48, 0.06, 3], [0.62, -0.08, 5], [0.75, 0.03, 3], [0.42, -0.12, 2.5]]) {
      c.fillStyle = 'rgba(20,40,25,.35)'; c.beginPath(); c.arc(len * px + 1, len * py + 1.5, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(210,235,215,.55)'; c.beginPath(); c.arc(len * px, len * py, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(len * px - r * 0.35, len * py - r * 0.35, r * 0.3, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(200,235,190,.35)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.04, len, 0); c.stroke();
    for (let i = 1; i < 6; i++) {
      const x = len * i / 6;
      c.beginPath(); c.moveTo(x, -len * 0.02); c.lineTo(x + len * 0.08, -len * 0.12); c.moveTo(x, len * 0.0); c.lineTo(x + len * 0.08, len * 0.1); c.stroke();
    }
    // 葉の上で弾ける雨粒
    for (let i = leaf.splashes.length - 1; i >= 0; i--) {
      const s = leaf.splashes[i]; s.a -= dt * 3;
      if (s.a <= 0) { leaf.splashes.splice(i, 1); continue; }
      c.fillStyle = `rgba(230,240,255,${s.a * 0.7})`;
      for (let j = 0; j < 4; j++) c.fillRect(len * s.s + (j - 1.5) * 6 * (1.2 - s.a), -len * 0.06 - (1 - s.a) * 14 - j % 2 * 4, 2, 2);
    }
    // 葉先のしずく
    leaf.drip = Math.min(1, leaf.drip + dt * 0.12);
    c.fillStyle = 'rgba(225,238,255,.85)';
    c.beginPath(); c.arc(len + 2, 3, 2 + leaf.drip * 4, 0, 7); c.fill();
    const tip = { x: ax + Math.cos(ang) * len, y: ay + Math.sin(ang) * len };
    c.restore();
    if (leaf.drip >= 1) { leaf.falls.push({ x: tip.x, y: tip.y + 6, v: 0 }); leaf.drip = 0; }
    c.setTransform(D, 0, 0, D, 0, 0);
    c.fillStyle = 'rgba(225,238,255,.8)';
    for (let i = leaf.falls.length - 1; i >= 0; i--) {
      const f = leaf.falls[i]; f.v += 1400 * dt; f.y += f.v * dt;
      if (f.y > H) { leaf.falls.splice(i, 1); continue; }
      c.beginPath(); c.ellipse(f.x, f.y, 3, 5, 0, 0, 7); c.fill();
    }
  }

  // ---- 指で書く文字のマスク ----
  function drawMask(progress) {
    const c = mctx;
    c.setTransform(D, 0, 0, D, 0, 0);
    c.clearRect(0, 0, W, H);
    if (progress <= 0) return;
    let size = Math.min(W, H) * 0.16;
    c.font = `italic ${size}px "Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", cursive`;
    const m = c.measureText(TEXT).width;
    if (m > W * 0.86) { size *= W * 0.86 / m; c.font = c.font.replace(/[\d.]+px/, `${size}px`); }
    const tw = c.measureText(TEXT).width, x0 = (W - tw) / 2, y0 = H * 0.3;
    c.save();
    c.beginPath(); c.rect(x0 - 10, 0, (tw + 20) * progress, H); c.clip();
    c.filter = 'blur(1.2px)';
    c.fillStyle = c.strokeStyle = '#fff';
    c.lineWidth = size * 0.03; c.lineJoin = c.lineCap = 'round';
    c.strokeText(TEXT, x0, y0); c.fillText(TEXT, x0, y0);
    c.restore();
  }

  function render() {
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texS);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texM);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, T + 3);
      gl.uniform1f(U.fade, fade);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const c = ctx2d;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = fade;
      c.filter = 'blur(6px)'; c.drawImage(scene, 0, 0);
      c.filter = 'none'; c.fillStyle = 'rgba(205,212,222,.38)'; c.fillRect(0, 0, canvas.width, canvas.height);
      // 文字の線のところだけ曇りを外す
      const t = tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, tmp.width, tmp.height);
      t.drawImage(mask, 0, 0); t.globalCompositeOperation = 'source-in'; t.drawImage(scene, 0, 0);
      c.drawImage(tmp, 0, 0);
      c.globalAlpha = 1;
    }
  }

  function frame(now) {
    if (!running) return;
    const raw = Math.max(0, (now - last) / 1000 || 0); last = now;
    const dt = Math.min(0.1, raw);
    T += dt;
    drawScene(dt);
    drawLeaf(dt);
    drawMask(done ? 1 : Math.min(1, Math.max(0, (T - WRITE_START) / WRITE_DUR)));
    if (leaving) {
      fade -= raw / 0.8;
      canvas.style.opacity = leafCanvas.style.opacity = String(Math.max(0, fade));
      if (fade <= 0) { stop(); onDone(); return; }
    }
    render();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    running = true; T = 0; fade = 1; leaving = false; done = false;
    canvas.style.opacity = leafCanvas.style.opacity = '1'; canvas.hidden = leafCanvas.hidden = false;
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); canvas.hidden = leafCanvas.hidden = true; }

  return {
    start, stop, resize,
    kind: gl ? 'gl' : '2d',
    get time() { return T; },
    get ready() { return done || T >= HINT_AT; },
    get hintAt() { return HINT_AT; },
    // 書いている途中のタップは書き終わりまで飛ばす。書き終わり後のタップで開始
    tap() {
      if (leaving) return;
      if (!done && T < HINT_AT) { done = true; T = Math.max(T, HINT_AT); return; }
      last = performance.now();
      leaving = true;
    },
    skip() { done = true; T = Math.max(T, HINT_AT); },
  };
}
