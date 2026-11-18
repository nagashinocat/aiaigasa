// WebGLの雨:奥行きのある雨筋、ガラスを流れる水滴の屈折、街灯のにじみ
import { LAMPS } from './background.js';

const VS = `attribute vec2 p; varying vec2 v_uv;
void main(){ v_uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `precision mediump float;
uniform sampler2D u_bg; uniform vec2 u_res; uniform float u_time, u_rain;
uniform vec2 u_lamp0, u_lamp1;
varying vec2 v_uv;
#define S(a,b,t) smoothstep(a,b,t)
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec3 h31(float p){ vec3 p3=fract(vec3(p)*vec3(.1031,.11369,.13787)); p3+=dot(p3,p3.yzx+19.19);
  return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x)); }

// ガラスを流れ落ちる水滴
vec2 dropLayer(vec2 uv, float t){
  vec2 UV = uv;
  uv.y += t*0.75;
  vec2 a = vec2(6.,1.);
  vec2 grid = a*2.;
  vec2 id = floor(uv*grid);
  uv.y += h21(vec2(id.x, 0.));
  id = floor(uv*grid);
  vec3 n = h31(id.x*35.2 + id.y*2376.1);
  vec2 st = fract(uv*grid) - vec2(.5,0.);
  float x = n.x - .5;
  float y = UV.y*20.;
  x += sin(y + sin(y))*(.5 - abs(x))*(n.z - .5);
  x *= .7;
  float ti = fract(t + n.z);
  y = (S(0.,.85,ti)*S(1.,.85,ti) - .5)*.9 + .5;
  vec2 p = vec2(x,y);
  float d = length((st - p)*a.yx);
  float mainDrop = S(.4,0.,d);
  float r = sqrt(S(1.,y,st.y));
  float cd = abs(st.x - x);
  float trail = S(.23*r,.15*r*r,cd);
  float trailFront = S(-.02,.02,st.y - y);
  trail *= trailFront*r*r;
  y = fract(UV.y*10.) + (st.y - .5);
  float droplets = S(.3,0.,length(st - vec2(x,y)));
  return vec2(mainDrop + droplets*r*trailFront, trail);
}
float staticDrops(vec2 uv, float t){
  uv *= 40.;
  vec2 id = floor(uv); uv = fract(uv) - .5;
  vec3 n = h31(id.x*107.45 + id.y*3543.654);
  vec2 p = (n.xy - .5)*.7;
  float ft = fract(t + n.z);
  float fade = S(0.,.025,ft)*S(1.,.025,ft);
  return S(.3,0.,length(uv - p))*fract(n.z*10.)*fade;
}
float drops(vec2 uv, float t, float l0, float l1, float l2){
  float s = staticDrops(uv,t)*l0;
  vec2 m1 = dropLayer(uv,t)*l1;
  vec2 m2 = dropLayer(uv*1.85,t)*l2;
  return S(.3,1.,s + m1.x + m2.x);
}

// 雨筋(奥ほど細く速く)
float streak(vec2 uv, float t, float scale, float speed, float width, float len, float amt, float seed){
  uv.x += uv.y*0.12;
  uv *= vec2(scale, scale*0.18);
  uv.y += t*speed + seed;
  vec2 id = floor(uv); vec2 f = fract(uv);
  float n = h21(id + seed);
  float x = h21(vec2(id.x, id.y + 7.1 + seed))*.8 + .1;
  float y0 = h21(vec2(id.y, id.x + 3.3 + seed))*.6 + .2;
  float on = step(n, amt);
  return on*S(width,0.,abs(f.x - x))*S(len,len*.3,abs(f.y - y0));
}

void main(){
  vec2 frag = v_uv*u_res;
  vec2 uv = (frag - .5*u_res)/u_res.y;
  float T = u_time;
  float rain = u_rain;

  // 水滴(雨が強いほど増える)
  float t = T*.2;
  float l0 = S(-.3,1.,rain)*1.6;
  float l1 = S(.2,.9,rain);
  float l2 = S(0.,.6,rain)*.8;
  vec2 e = vec2(.001,0.);
  float c = drops(uv,t,l0,l1,l2);
  float cx = drops(uv+e,t,l0,l1,l2);
  float cy = drops(uv+e.yx,t,l0,l1,l2);
  vec2 nrm = vec2(cx - c, cy - c);
  vec2 suv = v_uv + nrm*1.2;
  vec3 col = texture2D(u_bg, suv).rgb;
  // 水滴の縁を少し暗く、上側にハイライト
  col *= 1. - c*.12;
  col += S(.0,.02,-nrm.y)*c*.18;

  // 街灯のにじみ
  vec2 sp = vec2(frag.x/u_res.y, frag.y/u_res.y);
  vec2 L0 = u_lamp0*u_res/u_res.y, L1 = u_lamp1*u_res/u_res.y;
  float lamp = exp(-dot(sp-L0,sp-L0)*28.) + exp(-dot(sp-L1,sp-L1)*28.);

  // 雨筋 3層
  vec2 ruv = vec2(frag.x, frag.y)/u_res.y;
  float far  = streak(ruv, T, 70., 7.5, .06, .28, rain*.9, 1.);
  float mid  = streak(ruv, T, 36., 5.5, .07, .22, rain*.75, 2.);
  float near = streak(ruv, T, 16., 4.2, .06, .14, rain*.5, 3.);
  float s = far*.22 + mid*.32 + near*.42;
  vec3 rainCol = mix(vec3(.82,.87,.95), vec3(1.,.86,.62), clamp(lamp*1.4,0.,1.));
  col += rainCol*s*(.65 + lamp*2.2);
  // 雨の霞
  col = mix(col, vec3(.62,.67,.74), rain*.08);
  gl_FragColor = vec4(col,1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createRainGL(canvas, bgCanvas) {
  let gl;
  try { gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('rainGL', e); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const u = (n) => gl.getUniformLocation(prog, n);
  const U = { res: u('u_res'), time: u('u_time'), rain: u('u_rain'), l0: u('u_lamp0'), l1: u('u_lamp1') };

  function resize(w, h, dpr) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(rain, dt, t) {
    if (gl.isContextLost()) return;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.rain, rain);
    gl.uniform2f(U.l0, LAMPS[0].x, 1 - LAMPS[0].y);
    gl.uniform2f(U.l1, LAMPS[1].x, 1 - LAMPS[1].y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { resize, draw, dispose() {}, kind: 'gl', gl };
}
