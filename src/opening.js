// オープニング:水滴のついた曇りガラス、すぐ向こうで雨に揺れる葉っぱ、
// 奥にぼやけた相合傘の二人。ガラスに指で「while it's raining」と書かれていく
import { GLSL_COMMON, compile } from './rainGL.js';
import { buildPlan, penAt, finaleAt, FINALE } from './pen.js';

const TEXT = "while it's raining";
const WRITE_START = 1.0;

const VS = `attribute vec2 p; varying vec2 v_uv;
void main(){ v_uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `precision mediump float;
uniform sampler2D u_scene, u_mask; uniform vec2 u_res; uniform float u_time, u_fade;
uniform vec2 u_leafBase; uniform float u_leafAng, u_leafLen;
uniform vec3 u_pen; uniform float u_penA, u_penS;
varying vec2 v_uv;
${GLSL_COMMON}
// ガラスの手前の葉っぱ:透過光、葉脈、濡れたつや、水玉
vec4 leafAt(vec2 frag){
  vec2 d = frag - u_leafBase;
  float c = cos(u_leafAng), s = sin(u_leafAng);
  vec2 q = vec2(c*d.x + s*d.y, -s*d.x + c*d.y)/u_leafLen;
  float x = q.x;
  float y = q.y;
  float xc = clamp(x, 0., 1.);
  float w = .27*pow(xc,.5)*pow(1.-xc,.8)*1.9;
  float px = 1.2/u_leafLen;
  float body = S(px, -px, abs(y) - w)*step(0., x)*step(x, 1.);
  float stem = S(.012, .006, abs(q.y))*S(-.22,-.2,x)*S(.01,0.,x);
  float a = max(body, stem);
  if (a <= 0.) return vec4(0.);
  float yn = clamp(y/max(w,1e-3), -1., 1.);
  float side = abs(yn);
  float mid = S(.016, .004, abs(y));
  float sv = abs(fract((x - side*w*2.6)*7.) - .5);
  float vein = S(.07, .0, sv)*S(.08,.3,side)*S(1.,.75,side)*S(.05,.15,x);
  float tex = fbm(q*vec2(55., 90.));
  vec3 dark = vec3(.10,.27,.10), mid1 = vec3(.27,.52,.18), glow = vec3(.62,.80,.30);
  vec3 col = mix(dark, mid1, .35 + .45*S(.0,.9,x)*(1. - side*.6));
  col = mix(col, glow, S(.45,1.,side)*.35 + vein*.2 + mid*.35);
  col *= .88 + .24*tex;
  float sheen = pow(max(0., 1. - abs(yn + .38 - .08*sin(x*7.))*2.6), 5.);
  col += vec3(.75,.9,.8)*sheen*.28;
  col *= 1. - .25*S(.88,1.,side);
  col = mix(col, vec3(.22,.30,.14), stem*(1.-body));
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 bp = vec2(.18 + fi*.11, (h21(vec2(fi, 3.)) - .5)*.9);
    float bw = .27*pow(bp.x,.5)*pow(1.-bp.x,.8)*1.9;
    bp.y *= bw;
    float br = .012 + .014*h21(vec2(fi, 9.));
    vec2 bd = (vec2(x, y) - bp)/br;
    float bl = length(bd);
    col *= 1. - .22*S(1.5, .9, length(bd - vec2(.35,-.45)))*S(.95,1.1,bl);
    if (bl < 1.) {
      float z = sqrt(1. - bl*bl);
      vec3 under = col*(.85 + .55*(1.-bl));
      under += vec3(.9,1.,.95)*pow(max(0., dot(normalize(vec3(bd, z)), normalize(vec3(-.45,.55,.7)))), 30.)*.9;
      under *= 1. - .35*S(.75, 1., bl);
      col = mix(col, under, S(1., .9, bl));
    }
  }
  return vec4(col, a);
}

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
  vec4 lf = leafAt(frag);
  col = mix(col, lf.rgb, lf.a);
  // 水玉:レンズのように奥を上下逆さに映し、ふちは暗く、上に鋭い光、下に集まった光、ガラスに薄い影
  if (u_penA > 0.) {
    vec2 pd = (frag - u_pen.xy)/u_pen.z;
    pd.y /= u_penS;
    pd.y += .12*(u_penS - 1.)*(1. - pd.y*pd.y); // 下がふくらんだしずくの形
    float pl = length(pd);
    // 影(右下にずれて落ちる)
    float sh = S(1.35, .9, length((frag - u_pen.xy)/u_pen.z - vec2(.16, -.3)));
    col *= 1. - .22*u_penA*sh*S(.92, 1.02, pl);
    if (pl < 1.) {
      float z = sqrt(max(0., 1. - pl*pl));
      vec2 lens = -pd*u_pen.z*(1.6 + .6*z)/u_res;
      vec3 refr = texture2D(u_scene, u_pen.xy/u_res + lens).rgb;
      vec3 bead = refr*1.08;
      float rim = S(.55, 1., pl);
      bead = mix(bead, vec3(.08,.1,.13), .62*pow(rim, 1.6));
      bead += vec3(1.)*exp(-dot(pd - vec2(-.34,.42), pd - vec2(-.34,.42))*55.)*.95;
      bead += vec3(1.)*exp(-dot(pd - vec2(-.18,.2), pd - vec2(-.18,.2))*14.)*.12;
      bead += vec3(1.,.98,.94)*S(.42,.82,pl)*S(1.,.86,pl)*S(.1,.7,-pd.y)*.42;
      float a = S(1., .955, pl)*u_penA;
      col = mix(col, bead, a);
    }
  }
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
  const leafGeom = { ax: 0, ay: 0, ang: 0, len: 1 };
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
      U = { scene: u('u_scene'), mask: u('u_mask'), res: u('u_res'), time: u('u_time'), fade: u('u_fade'),
        leafBase: u('u_leafBase'), leafAng: u('u_leafAng'), leafLen: u('u_leafLen'),
        pen: u('u_pen'), penA: u('u_penA'), penS: u('u_penS') };
      gl.uniform1i(U.scene, 0); gl.uniform1i(U.mask, 1);
    }
  } catch (e) { console.warn('opening GL', e); gl = null; }
  const ctx2d = gl ? null : canvas.getContext('2d');

  function resize(w, h) {
    W = w; H = h; D = 1; // ぼかした絵なので等倍で十分(軽さ優先)
    backdropReady = false;
    lay = null;
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
    leafGeom.ax = ax; leafGeom.ay = ay; leafGeom.ang = ang; leafGeom.len = len;
    c.save(); c.filter = 'none';
    c.translate(ax, ay); c.rotate(ang);
    if (!gl) { // WebGLが使えるときは葉の本体はシェーダーで描く
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
    const dr = 2 + leaf.drip * 4;
    const dg = c.createRadialGradient(len + 2 - dr * 0.35, 3 - dr * 0.35, dr * 0.1, len + 2, 3, dr);
    dg.addColorStop(0, 'rgba(255,255,255,.95)'); dg.addColorStop(0.35, 'rgba(200,225,210,.35)'); dg.addColorStop(1, 'rgba(120,150,140,.55)');
    c.fillStyle = dg; c.beginPath(); c.arc(len + 2, 3, dr, 0, 7); c.fill();
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
  // ---- 文字のレイアウト(書体が読めたら、または画面の大きさが変わったら作り直す) ----
  const ink = document.createElement('canvas');
  let lay = null;
  const pen = { x: 0, y: 0, r: 0, a: 0, st: 1 };
  let hintAt = WRITE_START + 5;
  // 葉の上の点(付け根から長さの u 倍のところ)
  function leafPoint(u, ang) {
    const len = W * 0.62, ax = -W * 0.08, ay = H * 0.86;
    return { x: ax + Math.cos(ang) * len * u, y: ay + Math.sin(ang) * len * u - len * 0.01 };
  }
  const bez = (P, t) => {
    const m = 1 - t;
    return { x: m * m * m * P[0].x + 3 * m * m * t * P[1].x + 3 * m * t * t * P[2].x + t * t * t * P[3].x,
      y: m * m * m * P[0].y + 3 * m * m * t * P[1].y + 3 * m * t * t * P[2].y + t * t * t * P[3].y };
  };
  let landed = false;
  function layout() {
    const c = ink.getContext('2d', { willReadFrequently: true });
    ink.width = Math.round(W * D); ink.height = Math.round(H * D);
    c.setTransform(D, 0, 0, D, 0, 0);
    let size = Math.min(W, H) * 0.24;
    const fam = '"Title Script", "Snell Roundhand", "Apple Chancery", cursive';
    c.font = `${size}px ${fam}`;
    const m = c.measureText(TEXT).width;
    if (m > W * 0.86) { size *= W * 0.86 / m; c.font = `${size}px ${fam}`; }
    const tw = c.measureText(TEXT).width, x0 = (W - tw) / 2, y0 = H * 0.3;
    const chars = [...TEXT];
    const letters = chars.map((ch, i) => ({
      ch, x0: x0 + c.measureText(chars.slice(0, i).join('')).width, x1: x0 + c.measureText(chars.slice(0, i + 1).join('')).width,
    }));
    c.clearRect(0, 0, W, H);
    c.filter = 'blur(1.2px)';
    c.fillStyle = c.strokeStyle = '#fff';
    c.lineWidth = size * 0.045; // 細い書体でも、水玉が通った跡が見えるように
    c.lineJoin = c.lineCap = 'round';
    c.strokeText(TEXT, x0, y0); c.fillText(TEXT, x0, y0);
    c.filter = 'none';
    // 列ごとに、文字の線がある高さの真ん中を調べておく(水玉の通り道)
    const img = c.getImageData(0, 0, ink.width, ink.height).data;
    const colY = new Float32Array(Math.ceil(W) + 1).fill(NaN);
    const top = Math.max(0, Math.floor((y0 - size) * D)), bot = Math.min(ink.height, Math.ceil((y0 + size * 0.5) * D));
    for (let x = 0; x < colY.length; x++) {
      const px = Math.min(ink.width - 1, Math.round(x * D));
      let sum = 0, n = 0;
      for (let y = top; y < bot; y++) if (img[(y * ink.width + px) * 4 + 3] > 60) { sum += y; n++; }
      if (n) colY[x] = sum / n / D;
    }
    let lastY = y0 - size * 0.3;
    for (let x = 0; x < colY.length; x++) { if (Number.isNaN(colY[x])) colY[x] = lastY; else lastY = colY[x]; }
    const plan = buildPlan(letters);
    hintAt = WRITE_START + plan.total + FINALE.end + 0.5;
    // 最後の g のいちばん下(水の筋の出発点)
    const last = letters[letters.length - 1];
    let gx = last.x1 - 4, gy = y0;
    for (let x = Math.floor(last.x0); x <= Math.ceil(last.x1); x++) {
      const px = Math.min(ink.width - 1, Math.round(x * D));
      for (let y = bot - 1; y >= top; y--) {
        if (img[(y * ink.width + px) * 4 + 3] > 60) { if (y / D > gy) { gy = y / D; gx = x; } break; }
      }
    }
    // 葉っぱ(止まっているとき)の、落ちる場所の真上で筋が終わる
    const land = leafPoint(0.58, -0.42);
    const E = { x: land.x, y: land.y - H * 0.1 };
    const P0 = { x: gx, y: gy - 2 };
    const C1 = { x: P0.x + W * 0.03, y: P0.y + H * 0.14 };
    const C2 = { x: E.x + W * 0.22, y: E.y - H * 0.14 };
    lay = { size, x0, y0, tw, colY, plan, endX: last.x1, tail: [P0, C1, C2, E] };
  }
  try { document.fonts?.load(`64px "Title Script"`).then(() => { lay = null; }); } catch { /* 書体が読めなくても代わりの字で書く */ }

  // ---- 水玉が通ったところだけ曇りが取れる ----
  function drawMask(t) {
    if (!lay) layout();
    const c = mctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, mask.width, mask.height);
    const w = t - WRITE_START;
    const p = done ? { x: lay.endX, done: true } : penAt(lay.plan, w);
    const f = done ? { phase: 'landed', s: 1, k: 1, since: 9 } : finaleAt(w, lay.plan.total);
    if (w > 0 || done) {
      const front = Math.max(0, Math.min(mask.width, Math.round(p.x * D)));
      if (front > 0) c.drawImage(ink, 0, 0, front, ink.height, 0, 0, front, ink.height);
    }
    // g から伸びる水の筋
    const sTail = f.phase === 'write' ? 0 : f.s;
    if (sTail > 0) {
      c.setTransform(D, 0, 0, D, 0, 0);
      c.save(); c.filter = 'blur(1.2px)'; c.strokeStyle = '#fff'; c.lineCap = c.lineJoin = 'round';
      c.lineWidth = lay.size * 0.05;
      c.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) { const q = bez(lay.tail, (sTail * i) / N); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }
      c.stroke(); c.restore();
    }
    // 水玉
    const R = Math.max(lay.size * 0.17, W * 0.04); // ガラスの水滴らしい大きさ
    pen.r = R; pen.st = 1;
    if (done) { pen.a = 0; return; }
    if (w <= 0) {
      const k = Math.max(0, Math.min(1, (w + 0.6) / 0.6));
      pen.x = lay.x0; pen.y = lay.colY[Math.max(0, Math.round(lay.x0))] - (1 - k) * lay.size * 0.8; pen.a = k;
    } else if (f.phase === 'write') {
      pen.x = p.x; pen.y = lay.colY[Math.max(0, Math.min(lay.colY.length - 1, Math.round(p.x)))]; pen.a = 1;
      pen.st = p.writing ? 1.06 : 1;
    } else if (f.phase === 'tail') {
      const q = bez(lay.tail, f.s); pen.x = q.x; pen.y = q.y; pen.a = 1; pen.st = 1.1 + f.s * 0.15;
    } else if (f.phase === 'hang') {
      const E = lay.tail[3];
      pen.x = E.x; pen.y = E.y + R * 0.25 * f.k; pen.a = 1;
      pen.r = R * (1 + 0.28 * f.k); pen.st = 1.12 + 0.12 * f.k + 0.05 * Math.sin(f.k * 24);
    } else if (f.phase === 'fall') {
      const E = lay.tail[3], L = leafPoint(0.58, leafGeom.ang);
      pen.x = E.x + (L.x - E.x) * f.k; pen.y = E.y + (L.y - pen.r * 0.6 - E.y) * f.k;
      pen.r = R * 1.28; pen.st = 1.3; pen.a = 1;
    } else {
      // ぽたん:葉が大きくしなって、しぶきが跳ねる
      if (!landed) {
        landed = true;
        leaf.vel += 3.4;
        for (let i = 0; i < 4; i++) leaf.splashes.push({ s: 0.56 + i * 0.015, a: 1.2 });
        leaf.drip += 0.4;
      }
      pen.a = 0;
    }
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
      gl.uniform2f(U.leafBase, leafGeom.ax, H - leafGeom.ay);
      gl.uniform1f(U.leafAng, -leafGeom.ang);
      gl.uniform1f(U.leafLen, leafGeom.len);
      gl.uniform3f(U.pen, pen.x, H - pen.y, pen.r);
      gl.uniform1f(U.penA, pen.a);
      gl.uniform1f(U.penS, pen.st || 1);
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
      if (pen.a > 0) {
        const g = c.createRadialGradient(pen.x - pen.r * 0.35, pen.y - pen.r * 0.35, pen.r * 0.1, pen.x, pen.y, pen.r);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, 'rgba(210,225,235,.35)'); g.addColorStop(1, 'rgba(90,105,120,.6)');
        c.globalAlpha = fade * pen.a; c.fillStyle = g; c.beginPath(); c.arc(pen.x, pen.y, pen.r, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  let paused = false;
  function frame(now) {
    if (!running) return;
    const raw = Math.max(0, (now - last) / 1000 || 0); last = now;
    if (paused) { raf = requestAnimationFrame(frame); return; }
    tick(raw);
  }
  // 撮影用:止めて1コマずつ進められる
  function tick(raw) {
    const dt = Math.min(0.1, raw);
    T += dt;
    drawScene(dt);
    drawLeaf(dt);
    drawMask(T);
    if (leaving) {
      fade -= raw / 0.8;
      canvas.style.opacity = leafCanvas.style.opacity = String(Math.max(0, fade));
      if (fade <= 0) { stop(); onDone(); return; }
    }
    render();
    if (!paused) raf = requestAnimationFrame(frame);
  }

  function start() {
    running = true; T = 0; fade = 1; leaving = false; done = false; landed = false;
    canvas.style.opacity = leafCanvas.style.opacity = '1'; canvas.hidden = leafCanvas.hidden = false;
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); canvas.hidden = leafCanvas.hidden = true; }

  return {
    start, stop, resize,
    kind: gl ? 'gl' : '2d',
    get time() { return T; },
    get covering() { return running && !leaving; },
    get ready() { return done || T >= hintAt; },
    get hintAt() { return hintAt; },
    // 書いている途中のタップは書き終わりまで飛ばす。書き終わり後のタップで開始
    tap() {
      if (leaving) return;
      if (!done && T < hintAt) { done = true; T = Math.max(T, hintAt); return; }
      last = performance.now();
      leaving = true;
    },
    skip() { done = true; T = Math.max(T, hintAt); },
    debugPause() { paused = true; },
    debugStep(dt) { if (running) tick(dt); },
  };
}
