// 3D-мир: текстуры, карта (инстансинг), погода, грузовики, деревья, модели оружия и персонажей.
import * as THREE from 'three';

const { C, WEAPONS, SKINS, FINISHES } = window.Shared;
export const U = 1 / 24;
export const TEAM_COL = [0x4ea1ff, 0xff5a5a];
const rnd = (a, b) => a + Math.random() * (b - a);
let seed = 1;
const srnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };

// ---------------------------------------------------------------------
// Процедурные текстуры
// ---------------------------------------------------------------------
const canvases = {};
function noise(g, s, n, alpha, light) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`; const r = rnd(1, 3); g.fillRect(Math.random() * s, Math.random() * s, r, r); } }
function blobs(g, s, n, cols, rmin, rmax) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(rmin, rmax), rnd(rmin, rmax) * 0.7, rnd(0, 3), 0, 7); g.fill(); } }
function bricks(g, s, rows, cols, hue, sat, light, mortar) {
  g.fillStyle = mortar; g.fillRect(0, 0, s, s); const bh = s / rows, bw = s / cols;
  for (let y = 0; y < rows; y++) for (let x = -1; x <= cols; x++) { const ox = (y % 2) * bw / 2; g.fillStyle = `hsl(${rnd(hue[0], hue[1])},${rnd(sat[0], sat[1])}%,${rnd(light[0], light[1])}%)`; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4); }
}
function planks(g, s, n, hue, sat, light, vertical) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(${rnd(hue[0], hue[1])},${rnd(sat[0], sat[1])}%,${rnd(light[0], light[1])}%)`;
    if (vertical) g.fillRect(i * s / n + 1, 0, s / n - 2, s); else g.fillRect(0, i * s / n + 1, s, s / n - 2);
    for (let j = 0; j < 10; j++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); if (vertical) { const x = i * s / n + rnd(3, s / n - 3); g.moveTo(x, rnd(0, s)); g.lineTo(x + rnd(-2, 2), rnd(0, s)); } else { const y = i * s / n + rnd(3, s / n - 3); g.moveTo(rnd(0, s), y); g.lineTo(rnd(0, s), y + rnd(-2, 2)); } g.stroke(); }
  }
}
const DRAW = {
  plaster(g, s) { g.fillStyle = '#e4d8c0'; g.fillRect(0, 0, s, s); noise(g, s, 3000, 0.07); noise(g, s, 1500, 0.1, 1); blobs(g, s, 8, ['rgba(140,110,80,0.10)'], 10, 40); },
  plasterWhite(g, s) { g.fillStyle = '#eef0f2'; g.fillRect(0, 0, s, s); noise(g, s, 3000, 0.05); blobs(g, s, 6, ['rgba(120,130,140,0.08)'], 10, 40); },
  brick(g, s) { bricks(g, s, 16, 4, [6, 16], [40, 55], [34, 44], '#9a8a7c'); noise(g, s, 1500, 0.1); },
  brickDark(g, s) { bricks(g, s, 16, 4, [0, 12], [25, 40], [22, 30], '#5b524b'); noise(g, s, 1500, 0.1); },
  concrete(g, s) { g.fillStyle = '#a5a8ad'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.08); noise(g, s, 2000, 0.06, 1); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s / 2 - 2); g.strokeRect(1, s / 2 + 1, s - 2, s / 2 - 2); },
  stone(g, s) { g.fillStyle = '#7d7a73'; g.fillRect(0, 0, s, s); for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) { g.fillStyle = `hsl(${rnd(30, 45)},${rnd(5, 12)}%,${rnd(46, 60)}%)`; const ox = (y % 2) * s / 8; g.beginPath(); g.roundRect(x * s / 4 + ox + 3, y * s / 6 + 3, s / 4 - 6, s / 6 - 6, 6); g.fill(); } noise(g, s, 2000, 0.1); },
  sandstone(g, s) { g.fillStyle = '#cfae76'; g.fillRect(0, 0, s, s); const bh = s / 6; for (let y = 0; y < 6; y++) { const off = (y % 2) * s / 4; for (let x = -1; x < 3; x++) { g.fillStyle = `hsl(${rnd(34, 40)},${rnd(40, 52)}%,${rnd(60, 68)}%)`; g.fillRect(x * s / 2 + off + 2, y * bh + 2, s / 2 - 4, bh - 4); } } noise(g, s, 2500, 0.08); },
  adobe(g, s) { g.fillStyle = '#d9b98a'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.08); blobs(g, s, 10, ['rgba(160,110,60,0.12)'], 8, 30); },
  siding(g, s) { planks(g, s, 8, [4, 10], [45, 55], [36, 44]); noise(g, s, 1000, 0.08); },
  logs(g, s) { for (let i = 0; i < 6; i++) { const y = i * s / 6; const gr = g.createLinearGradient(0, y, 0, y + s / 6); gr.addColorStop(0, '#5a3a20'); gr.addColorStop(0.5, '#8a5d36'); gr.addColorStop(1, '#4a2e18'); g.fillStyle = gr; g.fillRect(0, y, s, s / 6); } noise(g, s, 1500, 0.1); },
  woodFloor(g, s) { planks(g, s, 8, [24, 32], [35, 45], [34, 44], true); noise(g, s, 800, 0.08); },
  tiles(g, s) { g.fillStyle = '#b9b4a8'; g.fillRect(0, 0, s, s); const n = 4; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? '#d6d0c2' : '#bdb7aa'; g.fillRect(x * s / n + 2, y * s / n + 2, s / n - 4, s / n - 4); } noise(g, s, 1500, 0.06); },
  crate(g, s) { g.fillStyle = '#a5763f'; g.fillRect(0, 0, s, s); for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(30,${rnd(40, 50)}%,${rnd(38, 46)}%)`; g.fillRect(0, i * s / 6 + 1, s, s / 6 - 2); } g.fillStyle = '#6b4520'; const b = s * 0.09; g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillRect(0, 0, b, s); g.fillRect(s - b, 0, b, s); g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.fillRect(-s * 0.7, -b / 2, s * 1.4, b); g.restore(); noise(g, s, 1200, 0.1); },
  grass(g, s) { g.fillStyle = '#6f8a45'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4000; i++) { g.fillStyle = `hsla(${rnd(70, 105)},${rnd(30, 50)}%,${rnd(28, 46)}%,0.7)`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(2, 5)); } blobs(g, s, 10, ['rgba(110,90,60,0.25)'], 8, 26); },
  autumnGrass(g, s) { g.fillStyle = '#8a7a45'; g.fillRect(0, 0, s, s); for (let i = 0; i < 3000; i++) { g.fillStyle = `hsla(${rnd(40, 75)},${rnd(25, 45)}%,${rnd(30, 44)}%,0.7)`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(2, 5)); } for (let i = 0; i < 160; i++) { g.fillStyle = `hsl(${rnd(5, 45)},${rnd(65, 85)}%,${rnd(40, 55)}%)`; g.save(); g.translate(rnd(0, s), rnd(0, s)); g.rotate(rnd(0, 6)); g.beginPath(); g.ellipse(0, 0, rnd(3, 6), rnd(1.5, 3), 0, 0, 7); g.fill(); g.restore(); } },
  snow(g, s) { g.fillStyle = '#eef3f7'; g.fillRect(0, 0, s, s); noise(g, s, 3000, 0.05); blobs(g, s, 14, ['rgba(160,185,210,0.15)', 'rgba(255,255,255,0.5)'], 10, 40); },
  sand(g, s) { g.fillStyle = '#d9ba84'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.07); noise(g, s, 2000, 0.08, 1); for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(150,110,60,0.13)'; g.lineWidth = 3; g.beginPath(); const y = rnd(0, s); g.moveTo(0, y); g.bezierCurveTo(s / 3, y + rnd(-15, 15), s * 2 / 3, y + rnd(-15, 15), s, y); g.stroke(); } },
  asphalt(g, s) { g.fillStyle = '#4a4c51'; g.fillRect(0, 0, s, s); noise(g, s, 6000, 0.12); noise(g, s, 2500, 0.06, 1); },
  roofTiles(g, s) { g.fillStyle = '#8a3324'; g.fillRect(0, 0, s, s); const n = 8; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = `hsl(${rnd(6, 14)},${rnd(50, 60)}%,${rnd(32, 40)}%)`; g.beginPath(); g.arc(x * s / n + (y % 2) * s / n / 2 + s / n / 2, y * s / n + s / n, s / n / 2, Math.PI, 0); g.fill(); } noise(g, s, 1000, 0.1); },
  roofDark(g, s) { g.fillStyle = '#3d4350'; g.fillRect(0, 0, s, s); const n = 8; for (let y = 0; y < n; y++) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, y * s / n, s, 2); } noise(g, s, 2000, 0.1); },
  roofFlat(g, s) { g.fillStyle = '#7b7d82'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.1); },
  roofSand(g, s) { g.fillStyle = '#c5a676'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.1); },
  roofSnow(g, s) { g.fillStyle = '#f4f7fa'; g.fillRect(0, 0, s, s); noise(g, s, 2500, 0.05); blobs(g, s, 8, ['rgba(170,190,210,0.15)'], 10, 30); },
  bark(g, s) { g.fillStyle = '#5a3d22'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${rnd(0.15, 0.35)})`; g.lineWidth = rnd(1, 3); g.beginPath(); const x = rnd(0, s); g.moveTo(x, 0); g.lineTo(x + rnd(-6, 6), s); g.stroke(); } },
  metal(g, s) { g.fillStyle = '#596356'; g.fillRect(0, 0, s, s); noise(g, s, 2000, 0.08); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * s / 8, s, 2); },
  hole(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.35, 'rgba(20,15,10,0.85)'); gr.addColorStop(0.55, 'rgba(60,50,40,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
  blood(g, s) { for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rnd(100, 140)},5,10,${rnd(0.5, 0.9)})`; g.beginPath(); g.arc(s / 2 + rnd(-s / 4, s / 4), s / 2 + rnd(-s / 4, s / 4), rnd(s / 16, s / 6), 0, 7); g.fill(); } },
  soft(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
  leaf(g, s) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.42, s * 0.22, 0.6, 0, 7); g.fill(); },
  flash(g, s) { g.translate(s / 2, s / 2); const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.18 : s * 0.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
  reddot(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,40,40,1)'); gr.addColorStop(0.35, 'rgba(255,0,0,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
};
const SMALL = { hole: 1, soft: 1, flash: 1, blood: 1, leaf: 1, reddot: 1 };
function canvasOf(key) {
  if (canvases[key]) return canvases[key];
  const c = document.createElement('canvas'); c.width = c.height = SMALL[key] ? 128 : 256;
  DRAW[key](c.getContext('2d'), c.width); canvases[key] = c; return c;
}
const texCache = {};
export function tex(key) {
  if (texCache[key]) return texCache[key];
  const t = new THREE.CanvasTexture(canvasOf(key)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[key] = t);
}
// Материал с UV в мировых координатах: текстура не растягивается на высоких стенах
const wmCache = {};
export function worldMat(key, size, opts = {}) {
  const k = key + size + JSON.stringify(opts);
  if (wmCache[k]) return wmCache[k];
  const m = new THREE.MeshLambertMaterial(Object.assign({ map: tex(key) }, opts));
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
      #ifdef USE_INSTANCING
        mat4 wmM = modelMatrix * instanceMatrix;
      #else
        mat4 wmM = modelMatrix;
      #endif
      vec3 wP = (wmM * vec4(position, 1.0)).xyz;
      vec3 wN = normalize(mat3(wmM) * normal);
      vec2 wUV = abs(wN.y) > 0.5 ? wP.xz : (abs(wN.x) > 0.5 ? vec2(wP.z, wP.y) : wP.xy);
      vMapUv = wUV / ${size.toFixed(2)};
      #endif`);
  };
  m.customProgramCacheKey = () => 'wm' + size;
  return (wmCache[k] = m);
}

// ---------------------------------------------------------------------
// Слияние простых деталей в одну геометрию с цветами вершин (меньше вызовов отрисовки)
// ---------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed();
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed();
export function part(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { return { geo, color, m: _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)).clone() }; }
const bx = (w, h, d, x, y, z, color, rx, ry, rz) => part(BOX, color, x, y, z, w, h, d, rx, ry, rz);
const cz = (r, len, x, y, z, color, seg6) => part(seg6 ? CYL6 : CYL, color, x, y, z, r, len, r, Math.PI / 2, 0, 0); // цилиндр вдоль Z
const cyY = (r, len, x, y, z, color) => part(CYL, color, x, y, z, r, len, r);
export function merge(parts) {
  let n = 0; for (const p of parts) n += p.geo.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geo, P = g.attributes.position, N = g.attributes.normal, UVA = g.attributes.uv;
    nm.getNormalMatrix(p.m); _c.set(p.color);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[(o + i) * 3] = v.x; pos[(o + i) * 3 + 1] = v.y; pos[(o + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(o + i) * 3] = v.x; nor[(o + i) * 3 + 1] = v.y; nor[(o + i) * 3 + 2] = v.z;
      col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b;
      if (UVA) { uv[(o + i) * 2] = UVA.getX(i); uv[(o + i) * 2 + 1] = UVA.getY(i); }
    }
    o += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}
export const VCOL = new THREE.MeshLambertMaterial({ vertexColors: true });
const VCOL_SHINY = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x333333 });
function meshOf(parts, mat) { const m = new THREE.Mesh(merge(parts), mat || VCOL); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------------------------------------------------------------------
// Темы карт
// ---------------------------------------------------------------------
export const THEMES = {
  village: { wall: 'plaster', wall2: 'brick', tower: 'stone', border: 'stone', slab: 'woodFloor', roof: 'roofTiles', roof2: 'roofTiles', ground: 'grass', floorIn: 'woodFloor', sky: 0x8ec5f0, horizon: 0xd8ecfb, fog: 0xcfe3f2, sun: 0xfff1d6, sunI: 2.4, hemiS: 0xe6f2ff, hemiG: 0x6b6a45, hemiI: 1.25, trim: 0x5b3b22, tree: [0x4f7a32, 0x5f8a3a, 0x3f6a2a], bush: [0x4c7a30, 0x5d8d3a], truck: 0x4b5a3a, weather: 'pollen' },
  desert: { wall: 'sandstone', wall2: 'adobe', tower: 'sandstone', border: 'sandstone', slab: 'tiles', roof: 'roofSand', roof2: 'roofSand', ground: 'sand', floorIn: 'tiles', sky: 0x9cc8ea, horizon: 0xf3e3c3, fog: 0xead9b8, sun: 0xffe2b0, sunI: 2.8, hemiS: 0xfff2dc, hemiG: 0x9a7e52, hemiI: 1.2, trim: 0x8d6e3f, tree: [0x6a7a3a, 0x7d8a45], bush: [0x8a8a55, 0x9a9050], truck: 0xb59a6a, weather: 'dust' },
  city: { wall: 'brick', wall2: 'concrete', tower: 'concrete', border: 'brickDark', slab: 'tiles', roof: 'roofFlat', roof2: 'roofFlat', ground: 'asphalt', floorIn: 'tiles', sky: 0x9fb4c8, horizon: 0xcdd6df, fog: 0xbcc6d0, sun: 0xf3f0ea, sunI: 2.0, hemiS: 0xe8eef5, hemiG: 0x55585e, hemiI: 1.35, trim: 0x2c2f35, tree: [0x4d7a3c, 0x5a8a44], bush: [0x4a6e38], truck: 0x3f444b, weather: 'pollen' },
  autumn: { wall: 'siding', wall2: 'brick', tower: 'stone', border: 'stone', slab: 'woodFloor', roof: 'roofDark', roof2: 'roofDark', ground: 'autumnGrass', floorIn: 'woodFloor', sky: 0xa9c4dc, horizon: 0xf5d6b0, fog: 0xe8cfb0, sun: 0xffc98a, sunI: 2.5, hemiS: 0xffe8cc, hemiG: 0x7a5a35, hemiI: 1.2, trim: 0x3d2a1a, tree: [0xd9631e, 0xe8a317, 0xb83a1b, 0xc9822a], bush: [0xa8642a, 0xc98a2a], truck: 0x55603e, weather: 'leaves' },
  winter: { wall: 'logs', wall2: 'plasterWhite', tower: 'stone', border: 'stone', slab: 'woodFloor', roof: 'roofSnow', roof2: 'roofSnow', ground: 'snow', floorIn: 'woodFloor', sky: 0xb7cde0, horizon: 0xe9f1f8, fog: 0xdfe9f2, sun: 0xeef5ff, sunI: 2.0, hemiS: 0xf0f6ff, hemiG: 0x9aa8b6, hemiI: 1.5, trim: 0x3a2a1c, tree: [0x2f5a3c, 0x3a6a48], bush: [0xe8eef4], truck: 0x4f5a48, weather: 'snow' },
};

// ---------------------------------------------------------------------
// Мир карты
// ---------------------------------------------------------------------
export function buildWorld(scene, map, quality) {
  seed = 12345 + map.name.length * 777;
  const th = THEMES[map.theme];
  const root = new THREE.Group(); scene.add(root);
  const TL = C.TILE * U;
  const cx = map.pw * U / 2, cz0 = map.ph * U / 2;
  // небо: градиент
  const skyGeo = new THREE.SphereGeometry(300, 24, 12);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(th.sky) }, bot: { value: new THREE.Color(th.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }' });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.position.set(cx, 0, cz0); root.add(sky);
  scene.background = new THREE.Color(th.horizon);
  scene.fog = new THREE.Fog(th.fog, 45, 150);

  const hemi = new THREE.HemisphereLight(th.hemiS, th.hemiG, th.hemiI); root.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunI);
  sun.position.set(cx - 35, 50, cz0 - 25); sun.target.position.set(cx, 0, cz0); root.add(sun, sun.target);
  if (quality !== 'low') {
    sun.castShadow = true; const sz = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  }

  // земля
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.pw * U + 260, map.ph * U + 260), worldMat(th.ground, 4));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, cz0); ground.receiveShadow = true; root.add(ground);

  // группы инстансов по материалу
  const groups = {};
  const add = (key, x, y, z0, z1, sx = 1, sz = 1) => { (groups[key] || (groups[key] = [])).push([x, y, z0, z1, sx, sz]); };
  const crates = [], barrels = [], sands = [], fences = [], trees = [], floors = [];
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    const c = map.cols[y * map.W + x];
    if (c.kind === 'in' || c.kind === 'door') floors.push([x, y]);
    for (const r of c.s) {
      const m = r[2];
      if (m === 'crate') crates.push([x, y, r[1]]);
      else if (m === 'barrel') barrels.push([x, y]);
      else if (m === 'sand') sands.push([x, y]);
      else if (m === 'fence') fences.push([x, y]);
      else if (m === 'trunk') trees.push([x, y]);
      else if (m === 'cab' || m === 'bed') continue;
      else add(m, x, y, r[0], r[1]);
    }
    if (c.ramp) add('ramp', x, y, c.ramp.z0, c.ramp.z1);
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const o3 = new THREE.Object3D();
  const MAT = {
    wall: worldMat(th.wall, 3), wall2: worldMat(th.wall2, 3), tower: worldMat(th.tower, 3), border: worldMat(th.border, 3),
    slab: worldMat(th.slab, 2.5), roof: worldMat(th.roof, 3),
  };
  for (const key in groups) {
    const list = groups[key];
    if (key === 'ramp') continue;
    const mesh = new THREE.InstancedMesh(box, MAT[key] || MAT.wall, list.length);
    list.forEach(([x, y, z0, z1], i) => {
      const h = (z1 - z0) * U;
      o3.position.set((x + 0.5) * TL, z0 * U + h / 2, (y + 0.5) * TL); o3.rotation.set(0, 0, 0); o3.scale.set(TL, h, TL); o3.updateMatrix(); mesh.setMatrixAt(i, o3.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
  // лестницы: наклонные плиты со ступеньками
  if (groups.ramp) {
    const parts = [];
    for (const [x, y, z0, z1] of groups.ramp) {
      const c = map.cols[y * map.W + x], r = c.ramp;
      for (let i = 0; i < 4; i++) {
        const f0 = i / 4, f1 = (i + 1) / 4, h = (z0 + (z1 - z0) * f1) * U;
        const cxp = (x + 0.5) * TL, czp = (y + 0.5) * TL;
        const off = ((f0 + f1) / 2 - 0.5) * TL;
        const px = cxp + (r.dx ? r.dx * off : 0), pz = czp + (r.dy ? r.dy * off : 0);
        const base = z0 > 0 ? z0 * U - 0.0 : 0;
        const sx = r.dx ? TL / 4 : TL * 0.9, sz = r.dy ? TL / 4 : TL * 0.9;
        parts.push(bx(sx, h - base, sz, px, base + (h - base) / 2, pz, 0xd9c9b0));
      }
    }
    const m = new THREE.Mesh(merge(parts), worldMat(th.slab, 2.5, { vertexColors: true })); m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  // полы в домах
  if (floors.length) {
    const fm = new THREE.InstancedMesh(box, worldMat(th.floorIn, 2.5), floors.length);
    floors.forEach(([x, y], i) => { o3.position.set((x + 0.5) * TL, 0.011, (y + 0.5) * TL); o3.scale.set(TL, 0.02, TL); o3.updateMatrix(); fm.setMatrixAt(i, o3.matrix); });
    fm.receiveShadow = true; root.add(fm);
  }
  // подоконники и перемычки
  if (map.trims.length) {
    const tm = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: th.trim }), map.trims.length);
    map.trims.forEach(([x, y, z], i) => { o3.position.set((x + 0.5) * TL, z * U + 0.03, (y + 0.5) * TL); o3.scale.set(TL * 1.04, 0.07, TL * 1.04); o3.updateMatrix(); tm.setMatrixAt(i, o3.matrix); });
    tm.castShadow = true; root.add(tm);
  }
  // ящики
  if (crates.length) {
    const list = []; for (const [x, y, top] of crates) for (let z = 0; z < top; z += 26) list.push([x, y, z, z === 0 ? 0.96 : 0.86]);
    const m = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ map: tex('crate') }), list.length);
    list.forEach(([x, y, z, s], i) => { o3.position.set((x + 0.5) * TL, (z + 13) * U, (y + 0.5) * TL); o3.rotation.set(0, srnd(-0.15, 0.15), 0); o3.scale.set(TL * s, 26 * U, TL * s); o3.updateMatrix(); m.setMatrixAt(i, o3.matrix); });
    m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  // бочки, мешки с песком, заборы
  const deco = [];
  const barrelCols = [0x2f6db5, 0xb5372f, 0x3d7a3d, 0xd09a2a];
  for (const [x, y] of barrels) for (const [ox, oz] of [[-0.45, -0.4], [0.45, -0.35], [0, 0.45]]) { const col = barrelCols[Math.floor(srnd(0, 4))]; const px = (x + 0.5) * TL + ox, pz = (y + 0.5) * TL + oz; deco.push(cyY(0.36, 1.25, px, 0.625, pz, col), cyY(0.37, 0.05, px, 0.35, pz, 0x222222), cyY(0.37, 0.05, px, 0.9, pz, 0x222222)); }
  for (const [x, y] of sands) for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - (row % 2); i++) { const px = x * TL + 0.25 + i * 0.5 + (row % 2) * 0.25, pz = (y + 0.5) * TL; deco.push(bx(0.5, 0.4, 0.9, px, 0.2 + row * 0.4, pz, row % 2 ? 0xa89068 : 0xb59c72, 0, srnd(-0.1, 0.1), 0)); }
  for (const [x, y] of fences) {
    const horiz = map.cols[y * map.W + x - 1]?.s.some((r) => r[2] === 'fence') || map.cols[y * map.W + x + 1]?.s.some((r) => r[2] === 'fence');
    const px = (x + 0.5) * TL, pz = (y + 0.5) * TL;
    for (let i = 0; i < 5; i++) { const off = -0.8 + i * 0.4; deco.push(bx(0.12, 1.1, 0.06, horiz ? px + off : px, 0.55, horiz ? pz : pz + off, 0x8a6238, 0, horiz ? 0 : Math.PI / 2, 0)); }
    deco.push(bx(horiz ? TL : 0.06, 0.08, horiz ? 0.06 : TL, px, 0.85, pz, 0x6e4a28), bx(horiz ? TL : 0.06, 0.08, horiz ? 0.06 : TL, px, 0.35, pz, 0x6e4a28));
  }
  if (deco.length) root.add(meshOf(deco));

  // деревья
  const treeParts = [];
  const addTree = (px, pz, s, inMap) => {
    if (map.theme === 'winter') {
      treeParts.push(cyY(0.18 * s, 2 * s, px, 1 * s, pz, 0x4a3220));
      for (let i = 0; i < 4; i++) { const r = (1.6 - i * 0.33) * s, y = (1.6 + i * 1.1) * s; treeParts.push(part(CYL6, th.tree[i % 2], px, y, pz, r, 1.6 * s, r), part(CYL6, 0xf4f8fb, px, y + 0.55 * s, pz, r * 0.75, 0.35 * s, r * 0.75)); }
      // конусы через цилиндры с сужением делаем ниже
    } else if (map.theme === 'desert') {
      treeParts.push(cyY(0.16 * s, 4.5 * s, px, 2.25 * s, pz, 0x7a5a36));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; treeParts.push(bx(0.35 * s, 0.08 * s, 2.2 * s, px + Math.cos(a) * 0.9 * s, 4.4 * s, pz + Math.sin(a) * 0.9 * s, th.tree[i % 2], 0.35, -a + Math.PI / 2, 0)); }
    } else {
      treeParts.push(cyY(0.2 * s, 3 * s, px, 1.5 * s, pz, 0x5a3d22));
      for (let i = 0; i < 5; i++) { const col = th.tree[Math.floor(srnd(0, th.tree.length))]; treeParts.push(bx(srnd(1.4, 2.0) * s, srnd(1.2, 1.7) * s, srnd(1.4, 2.0) * s, px + srnd(-0.6, 0.6) * s, (3.4 + srnd(-0.4, 1.4)) * s, pz + srnd(-0.6, 0.6) * s, col, srnd(0, 0.4), srnd(0, 3), srnd(0, 0.4))); }
    }
  };
  for (const [x, y] of trees) addTree((x + 0.5) * TL, (y + 0.5) * TL, 1.05, true);
  // окружение за пределами карты
  const W = map.pw * U, Hh = map.ph * U;
  for (let i = 0; i < 90; i++) {
    const side = i % 4; let px, pz;
    if (side === 0) { px = srnd(-12, W + 12); pz = srnd(-26, -4); } else if (side === 1) { px = srnd(-12, W + 12); pz = srnd(Hh + 4, Hh + 26); }
    else if (side === 2) { px = srnd(-26, -4); pz = srnd(-12, Hh + 12); } else { px = srnd(W + 4, W + 26); pz = srnd(-12, Hh + 12); }
    if (map.theme === 'city' && i % 3) {
      const h = srnd(8, 26), w = srnd(5, 10);
      treeParts.push(bx(w, h, w, px, h / 2, pz, [0x8c8f96, 0x9d8d80, 0x7a7f88][i % 3]));
      for (let k = 0; k < Math.floor(h / 3); k++) treeParts.push(bx(w * 1.01, 0.5, w * 1.01, px, 1.6 + k * 3, pz, 0x2d3540));
    } else addTree(px, pz, srnd(1.1, 1.8), false);
  }
  if (map.theme === 'desert') for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 85 + srnd(0, 25); const h = srnd(4, 12); treeParts.push(part(CYL6, 0xc9a56c, cx + Math.cos(a) * r, h / 2 - 1, cz0 + Math.sin(a) * r * 0.7, srnd(10, 20), h, srnd(10, 20))); }
  const treeMesh = meshOf(treeParts); root.add(treeMesh);

  // кусты/камни/сугробы/листва — без столкновений, только вдоль стен
  const small = [];
  for (let y = 1; y < map.H - 1; y++) for (let x = 1; x < map.W - 1; x++) {
    const c = map.cols[y * map.W + x];
    if (c.kind !== 'out') continue;
    const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => map.cols[(y + dy) * map.W + x + dx].kind === 'wall');
    if (!nearWall || srnd(0, 1) > 0.35) continue;
    const px = (x + 0.5 + nearWall[0] * 0.38) * TL, pz = (y + 0.5 + nearWall[1] * 0.38) * TL;
    const col = th.bush[Math.floor(srnd(0, th.bush.length))];
    if (map.theme === 'winter') small.push(part(CYL6, 0xf2f6f9, px, 0.1, pz, srnd(0.5, 0.9), 0.35, srnd(0.4, 0.8)));
    else if (map.theme === 'desert') small.push(bx(srnd(0.3, 0.6), srnd(0.25, 0.45), srnd(0.3, 0.6), px, 0.15, pz, 0x9a8a70, srnd(0, 1), srnd(0, 3), 0));
    else for (let k = 0; k < 3; k++) small.push(bx(srnd(0.35, 0.6), srnd(0.35, 0.6), srnd(0.35, 0.6), px + srnd(-0.3, 0.3), 0.25, pz + srnd(-0.3, 0.3), col, 0, srnd(0, 3), 0));
  }
  if (small.length) { const sm = meshOf(small); sm.castShadow = false; root.add(sm); }

  // трубы на крышах
  if (map.chimneys.length) {
    const cp = [];
    for (const [x, y, z] of map.chimneys) cp.push(bx(0.6, 1.4, 0.6, (x + 0.5) * TL, z * U + 0.7, (y + 0.5) * TL, 0x6e4a3a), bx(0.7, 0.12, 0.7, (x + 0.5) * TL, z * U + 1.4, (y + 0.5) * TL, 0x3a2a22));
    root.add(meshOf(cp));
  }
  // лампы на стенах
  const lamps = [];
  for (let y = 1; y < map.H - 1; y++) for (let x = 1; x < map.W - 1; x++) {
    const c = map.cols[y * map.W + x];
    if (c.kind === 'in' && (x * 7 + y * 3) % 9 === 0) for (const r of c.s) if (r[2] === 'slab' || r[2] === 'roof') lamps.push(bx(0.45, 0.06, 0.45, (x + 0.5) * TL, r[0] * U - 0.04, (y + 0.5) * TL, 0xfff3c8));
  }
  if (lamps.length) { const lm = new THREE.Mesh(merge(lamps), new THREE.MeshBasicMaterial({ vertexColors: true })); root.add(lm); }

  // грузовики
  for (const t of map.trucks) root.add(makeTruck(t, th));

  // облака
  const clouds = new THREE.Group();
  const cmat = new THREE.SpriteMaterial({ map: tex('soft'), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(cmat); s.position.set(cx + srnd(-140, 140), srnd(45, 70), cz0 + srnd(-140, 140)); s.scale.set(srnd(30, 60), srnd(10, 18), 1); clouds.add(s); }
  root.add(clouds);

  const weather = makeWeather(th.weather);
  root.add(weather.points);
  const chimneys = map.chimneys.map(([x, y, z]) => new THREE.Vector3((x + 0.5) * TL, z * U + 1.5, (y + 0.5) * TL));
  return {
    root, sun, chimneys,
    update(dt, cam) { weather.update(dt, cam); clouds.position.x = (clouds.position.x + dt * 0.6) % 60; },
  };
}

// Погода: снег, листья, пыль, пыльца — частицы вокруг камеры
function makeWeather(kind) {
  const N = kind === 'snow' ? 1400 : kind === 'leaves' ? 260 : kind === 'dust' ? 500 : 160;
  const R = 26, HGT = 16;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const palette = kind === 'snow' ? [0xffffff] : kind === 'leaves' ? [0xd9631e, 0xe8a317, 0xb83a1b, 0x9a5a2a] : kind === 'dust' ? [0xe6cfa2, 0xd9bd8a] : [0xfff8d0, 0xffffff];
  const cc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rnd(-R, R); pos[i * 3 + 1] = rnd(0, HGT); pos[i * 3 + 2] = rnd(-R, R);
    cc.set(palette[i % palette.length]); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    vel.push(kind === 'snow' ? [rnd(-0.3, 0.3), -rnd(0.8, 1.6), rnd(-0.3, 0.3), rnd(0, 6)] : kind === 'leaves' ? [rnd(0.2, 0.8), -rnd(0.5, 1.0), rnd(-0.3, 0.3), rnd(0, 6)] : kind === 'dust' ? [rnd(1.0, 2.5), rnd(-0.1, 0.1), rnd(-0.3, 0.3), rnd(0, 6)] : [rnd(-0.2, 0.2), rnd(-0.1, 0.1), rnd(-0.2, 0.2), rnd(0, 6)]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const size = kind === 'snow' ? 0.09 : kind === 'leaves' ? 0.22 : kind === 'dust' ? 0.07 : 0.05;
  const mat = new THREE.PointsMaterial({ size, map: tex(kind === 'leaves' ? 'leaf' : 'soft'), vertexColors: true, transparent: true, depthWrite: false, opacity: kind === 'dust' ? 0.5 : kind === 'pollen' ? 0.6 : 0.95, alphaTest: 0.01 });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  let t = 0;
  return {
    points,
    update(dt, cam) {
      t += dt;
      points.position.set(Math.round(cam.x), 0, Math.round(cam.z));
      const ox = cam.x - points.position.x, oz = cam.z - points.position.z;
      for (let i = 0; i < N; i++) {
        const v = vel[i];
        pos[i * 3] += (v[0] + Math.sin(t * 1.5 + v[3]) * (kind === 'leaves' ? 0.8 : 0.15)) * dt;
        pos[i * 3 + 1] += v[1] * dt; pos[i * 3 + 2] += (v[2] + Math.cos(t * 1.2 + v[3]) * 0.15) * dt;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] += HGT; if (pos[i * 3 + 1] > HGT) pos[i * 3 + 1] -= HGT;
        if (pos[i * 3] - ox > R) pos[i * 3] -= 2 * R; if (pos[i * 3] - ox < -R) pos[i * 3] += 2 * R;
        if (pos[i * 3 + 2] - oz > R) pos[i * 3 + 2] -= 2 * R; if (pos[i * 3 + 2] - oz < -R) pos[i * 3 + 2] += 2 * R;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// Военный грузовик: кабина (x..x+1, y) и кузов (y+1..y+3)
function makeTruck(t, th) {
  const TL = C.TILE * U, p = [];
  const x0 = t.x * TL, z0 = t.y * TL, w = TL * 2, cxp = x0 + w / 2;
  const body = th.truck, dark = 0x1c1e21, glass = 0x23303a, team = TEAM_COL[t.team === 'A' ? 0 : 1];
  // рама и колёса
  p.push(bx(w * 0.7, 0.3, TL * 4 * 0.94, cxp, 0.55, z0 + TL * 2, dark));
  for (const zz of [0.55, 2.4, 3.3]) for (const sx of [-1, 1]) { const zc = z0 + TL * zz; p.push(part(CYL, 0x18191b, cxp + sx * (w / 2 - 0.45), 0.55, zc, 0.55, 0.5, 0.55, 0, 0, Math.PI / 2), part(CYL, 0x55585c, cxp + sx * (w / 2 - 0.2), 0.55, zc, 0.28, 0.06, 0.28, 0, 0, Math.PI / 2)); }
  // кабина
  const cz1 = z0 + TL * 0.5;
  p.push(bx(w * 0.92, 1.0, TL * 0.95, cxp, 1.35, cz1, body));
  p.push(bx(w * 0.9, 1.15, TL * 0.6, cxp, 2.35, cz1 + 0.15, body));
  p.push(bx(w * 0.8, 0.6, 0.04, cxp, 2.45, cz1 - 0.16, glass, -0.2, 0, 0));
  for (const sx of [-1, 1]) { p.push(bx(0.04, 0.5, TL * 0.4, cxp + sx * w * 0.452, 2.45, cz1 + 0.15, glass)); p.push(bx(0.05, 0.35, 0.6, cxp + sx * w * 0.462, 1.6, cz1 + 0.1, team)); }
  p.push(bx(w * 0.94, 0.25, 0.15, cxp, 0.9, z0 + 0.06, dark));
  for (const sx of [-1, 1]) p.push(bx(0.3, 0.18, 0.05, cxp + sx * w * 0.32, 1.25, z0 + 0.03, 0xfff3c8));
  p.push(bx(w * 0.5, 0.5, 0.05, cxp, 1.35, z0 + 0.04, 0x2a2c2f));
  // кузов: платформа и борта
  const bz = z0 + TL * 2.5, bl = TL * 3 * 0.98, bed = C.BED * U;
  p.push(bx(w * 0.98, 0.2, bl, cxp, bed - 0.1, bz, 0x6b4f33));
  for (const sx of [-1, 1]) p.push(bx(0.08, 0.55, bl, cxp + sx * w * 0.485, bed + 0.27, bz, body));
  p.push(bx(w * 0.98, 0.55, 0.08, cxp, bed + 0.27, z0 + TL * 1.02, body));
  // дуги тента
  for (const zz of [1.1, 2.5, 3.9]) { const zc = z0 + TL * zz; for (const sx of [-1, 1]) p.push(bx(0.05, 2.35, 0.05, cxp + sx * w * 0.48, bed + 1.17, zc, dark)); p.push(bx(w * 0.96, 0.05, 0.05, cxp, bed + 2.35, zc, dark)); }
  const m = meshOf(p);
  return m;
}

// ---------------------------------------------------------------------
// Раскраски оружия
// ---------------------------------------------------------------------
const finCache = {};
export function finishMaterial(fid) {
  if (finCache[fid]) return finCache[fid];
  const f = FINISHES[fid]; if (!f) return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), s = 128, [c0, c1, c2] = f.c;
  switch (f.p) {
    case 'camo': g.fillStyle = c0; g.fillRect(0, 0, s, s); blobs(g, s, 22, [c1, c2], 8, 22); break;
    case 'tiger': g.fillStyle = c0; g.fillRect(0, 0, s, s); g.strokeStyle = c1; for (let i = 0; i < 9; i++) { g.lineWidth = rnd(3, 7); g.beginPath(); const y = i * 15 + rnd(-4, 4); g.moveTo(0, y); g.bezierCurveTo(40, y + rnd(-14, 14), 80, y + rnd(-14, 14), s, y + rnd(-6, 6)); g.stroke(); } g.fillStyle = c2; g.globalAlpha = 0.3; g.fillRect(0, 0, s, s); g.globalAlpha = 1; break;
    case 'carbon': for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? c0 : c1; g.fillRect(x * 8, y * 8, 8, 8); } g.fillStyle = c2; g.fillRect(0, s * 0.45, s, 4); break;
    case 'fade': case 'gold': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); if (f.p === 'gold') { g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 22, s, 3); } break; }
    case 'doppler': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); blobs(g, s, 30, ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.15)'], 4, 16); break; }
    case 'neon': g.fillStyle = c0; g.fillRect(0, 0, s, s); g.lineWidth = 3; for (let i = 0; i < 10; i++) { g.strokeStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(rnd(0, s), 0); g.lineTo(rnd(0, s), s); g.stroke(); } break;
    case 'hex': for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = [c0, c1, c2][Math.floor(rnd(0, 3))]; g.fillRect(x * 16, y * 16, 16, 16); } break;
    case 'snow': g.fillStyle = c0; g.fillRect(0, 0, s, s); blobs(g, s, 26, [c1, c2], 3, 12); break;
    default: g.fillStyle = c0; g.fillRect(0, 0, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const shiny = f.p === 'gold' || f.p === 'doppler' || f.p === 'fade';
  const m = new THREE.MeshPhongMaterial({ map: t, shininess: shiny ? 90 : 25, specular: shiny ? 0x888888 : 0x222222 });
  if (f.p === 'neon') { m.emissiveMap = t; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.55; }
  return (finCache[fid] = m);
}

// ---------------------------------------------------------------------
// Модели оружия (вдоль -Z, метры). Детали «body» перекрашиваются раскраской.
// ---------------------------------------------------------------------
const dotTex = () => tex('reddot');
export function makeGun(wid, fid) {
  const w = WEAPONS[wid] || WEAPONS[0], k = w.key;
  const fin = fid != null && fid >= 0 && FINISHES[fid] && (FINISHES[fid].w === k) ? fid : -1;
  const knifeModel = k === 'knife' ? (fin >= 0 ? FINISHES[fin].model : 'bayonet') : null;
  const B = [], R = []; // body (окрашиваемые), rest
  const BLK = 0x1f2125, DRK = 0x131416, MET = 0x3c4047, STEEL = 0x6c727b, WOOD = 0x7a4a26, WOOD2 = 0x5e3519, POLY = 0x2a2d31;
  const body = k === 'awp' ? 0x3f5f3a : k === 'deagle' ? 0xa7adb5 : k === 'aug' ? 0x4f5a4c : k === 'p90' ? 0x343828 : k === 'famas' ? 0x2c2f33 : BLK;
  let len = 0.6, sight = null;
  const b = (...a) => B.push(bx(...a)), r = (...a) => R.push(bx(...a));
  switch (w.cat) {
    case 'knife':
      if (knifeModel === 'karambit') {
        R.push(part(new THREE.TorusGeometry(0.03, 0.008, 6, 14).toNonIndexed(), STEEL, 0, -0.02, 0.07, 1, 1, 1, Math.PI / 2, 0, 0));
        r(0.025, 0.03, 0.1, 0, 0, 0.0, 0x2b2e33);
        for (let i = 0; i < 6; i++) { const a = i * 0.16; B.push(bx(0.006, 0.026 - i * 0.002, 0.04, 0, 0.012 + Math.sin(a) * 0.04, -0.05 - i * 0.032 + (1 - Math.cos(a)) * 0.02, 0xcfd5dd, a)); }
        len = 0.24;
      } else if (knifeModel === 'butterfly') {
        r(0.012, 0.025, 0.13, -0.01, 0, 0.03, STEEL); r(0.012, 0.025, 0.13, 0.01, 0, 0.03, STEEL);
        b(0.006, 0.03, 0.13, 0, 0.004, -0.1, 0xcfd5dd);
        B.push(bx(0.006, 0.016, 0.03, 0, 0.012, -0.175, 0xcfd5dd, 0.5));
        len = 0.22;
      } else {
        r(0.03, 0.035, 0.12, 0, 0, 0.03, 0x2b2e33); r(0.07, 0.012, 0.014, 0, 0, -0.035, STEEL);
        b(0.008, 0.034, 0.17, 0, 0.004, -0.13, 0xcfd5dd); B.push(bx(0.008, 0.02, 0.04, 0, 0.012, -0.225, 0xcfd5dd, 0.45));
        len = 0.26;
      }
      break;
    case 'pistol': case 'dual': {
      const L = k === 'deagle' ? 0.27 : 0.2;
      const one = (ox) => {
        b(0.034, 0.042, L, ox, 0.022, -L / 2 + 0.035, body);
        for (let i = 0; i < 4; i++) r(0.036, 0.004, 0.004, ox, 0.03, 0.005 - i * 0.012, DRK);
        r(0.03, 0.022, L * 0.8, ox, -0.008, -L / 2 + 0.04, POLY);
        R.push(bx(0.03, 0.11, 0.045, ox, -0.06, 0.03, POLY, -0.25));
        r(0.012, 0.025, 0.03, ox, -0.022, -0.02, DRK);
        R.push(cz(0.008, 0.02, ox, 0.03, -L + 0.03, DRK));
        r(0.006, 0.008, 0.006, ox, 0.046, -L + 0.045, DRK); r(0.018, 0.008, 0.006, ox, 0.046, 0.02, DRK);
      };
      if (w.cat === 'dual') { one(-0.06); one(0.06); } else one(0);
      len = L; break;
    }
    case 'smg': {
      if (k === 'p90') {
        b(0.06, 0.09, 0.42, 0, 0, -0.12, body); r(0.05, 0.03, 0.3, 0, 0.06, -0.14, 0x5b6155);
        R.push(bx(0.04, 0.06, 0.12, 0, -0.06, -0.08, POLY, 0.3)); r(0.045, 0.06, 0.08, 0, -0.03, 0.12, body);
        R.push(cz(0.011, 0.1, 0, 0.0, -0.38, DRK)); len = 0.45;
      } else if (k === 'mac10' || k === 'tmp') {
        b(0.05, 0.075, 0.24, 0, 0.01, -0.08, body);
        R.push(bx(0.035, 0.18, 0.04, 0, -0.1, 0.0, DRK, -0.05)); R.push(cz(0.011, 0.12, 0, 0.02, -0.25, DRK));
        if (k === 'tmp') { R.push(bx(0.03, 0.08, 0.035, 0, -0.06, -0.15, POLY, 0.3)); R.push(cz(0.02, 0.12, 0, 0.02, -0.3, DRK)); }
        len = k === 'tmp' ? 0.36 : 0.31;
      } else {
        b(0.052, 0.085, 0.3, 0, 0.01, -0.1, body); r(0.046, 0.06, 0.14, 0, 0.0, -0.31, k === 'ump45' ? BLK : MET);
        R.push(cz(0.011, 0.1, 0, 0.02, -0.42, DRK)); R.push(bx(0.033, 0.11, 0.045, 0, -0.07, 0.02, POLY, -0.25));
        if (k === 'mp5') R.push(bx(0.03, 0.15, 0.035, 0, -0.08, -0.14, DRK, 0.35)); else R.push(bx(0.034, 0.16, 0.045, 0, -0.08, -0.14, DRK, 0.15));
        r(0.012, 0.04, 0.2, -0.02, 0, 0.13, MET); r(0.012, 0.04, 0.2, 0.02, 0, 0.13, MET); r(0.05, 0.07, 0.025, 0, -0.005, 0.23, DRK);
        r(0.01, 0.03, 0.01, 0, 0.065, -0.3, DRK); r(0.02, 0.025, 0.02, 0, 0.06, 0.02, DRK);
        len = 0.47;
      }
      break;
    }
    case 'shotgun': {
      const stock = k === 'm3' ? WOOD : POLY;
      B.push(bx(0.045, 0.085, 0.3, 0, -0.025, 0.2, stock, 0.12)); b(0.055, 0.08, 0.24, 0, 0.012, -0.05, body);
      R.push(cz(0.015, 0.62, 0, 0.032, -0.48, DRK)); R.push(cz(0.014, 0.46, 0, -0.004, -0.41, MET));
      B.push(bx(0.062, 0.062, 0.17, 0, 0.0, -0.33, k === 'm3' ? WOOD2 : 0x33363c)); R.push(bx(0.03, 0.1, 0.04, 0, -0.075, 0.04, DRK, -0.3));
      r(0.006, 0.012, 0.008, 0, 0.05, -0.77, 0xd0d0d0); len = 0.8; break;
    }
    case 'rifle': case 'sniper': case 'mg': {
      const wood = k === 'ak47' || k === 'galil' || k === 'scout';
      const bull = k === 'aug' || k === 'famas';
      const L = w.cat === 'sniper' ? 1.15 : w.cat === 'mg' ? 1.02 : bull ? 0.75 : 0.9;
      if (bull) {
        b(0.06, 0.095, 0.5, 0, 0.0, -0.05, body); B.push(bx(0.055, 0.07, 0.12, 0, -0.01, 0.24, body));
        R.push(cz(0.013, 0.28, 0, 0.02, -0.45, DRK)); R.push(bx(0.034, 0.11, 0.045, 0, -0.08, -0.12, POLY, -0.2));
        R.push(bx(0.034, 0.13, 0.05, 0, -0.08, 0.08, DRK, 0.1));
        if (k === 'famas') { r(0.02, 0.03, 0.42, 0, 0.09, -0.06, BLK); r(0.02, 0.06, 0.02, 0, 0.065, 0.12, BLK); r(0.02, 0.06, 0.02, 0, 0.065, -0.24, BLK); }
        else R.push(bx(0.03, 0.09, 0.04, 0, -0.06, -0.26, POLY, 0.4));
        len = L;
      } else {
        B.push(bx(0.045, 0.1, 0.28, 0, -0.025, 0.24, wood ? WOOD : k === 'awp' ? body : POLY, 0.1));
        if (k === 'm4a1' || k === 'sg552') { R.push(cz(0.018, 0.22, 0, 0.0, 0.22, DRK)); r(0.04, 0.09, 0.08, 0, -0.01, 0.34, POLY); }
        b(0.056, 0.085, 0.34, 0, 0.012, -0.06, body);
        B.push(bx(0.05, 0.068, 0.22, 0, 0.006, -0.33, wood ? WOOD2 : w.cat === 'mg' ? MET : k === 'm4a1' ? 0x2a2d32 : MET));
        R.push(cz(w.cat === 'sniper' ? 0.017 : 0.012, L - 0.44, 0, 0.022, -0.44 - (L - 0.44) / 2, DRK));
        if (k === 'ak47') { R.push(cz(0.009, 0.2, 0, 0.05, -0.3, MET)); r(0.012, 0.035, 0.012, 0, 0.055, -0.6, DRK); R.push(cz(0.016, 0.04, 0, 0.022, -L + 0.02, DRK)); }
        if (k === 'awp') { r(0.04, 0.04, 0.08, 0, 0.022, -L + 0.03, DRK); R.push(bx(0.012, 0.012, 0.05, 0.04, 0.03, -0.0, STEEL, 0, 0, 0.3)); }
        R.push(bx(0.032, 0.11, 0.045, 0, -0.075, -0.0, POLY, -0.3));
        if (w.cat === 'mg') { r(0.085, 0.12, 0.12, 0, -0.09, -0.13, 0x3b4433); r(0.07, 0.03, 0.1, 0, 0.075, -0.1, BLK); R.push(bx(0.008, 0.15, 0.008, 0.03, -0.06, -0.62, DRK, 0.4)); R.push(bx(0.008, 0.15, 0.008, -0.03, -0.06, -0.62, DRK, 0.4)); }
        else if (k === 'ak47' || k === 'galil') { for (let i = 0; i < 4; i++) R.push(bx(0.034, 0.05, 0.05, 0, -0.06 - i * 0.04, -0.12 - i * 0.012, DRK, 0.35 + i * 0.05)); }
        else if (w.cat === 'sniper') r(0.034, 0.06, 0.07, 0, -0.055, -0.1, DRK);
        else R.push(bx(0.034, 0.15, 0.05, 0, -0.09, -0.13, DRK, 0.12));
        if (k === 'm4a1') { r(0.026, 0.012, 0.3, 0, 0.062, -0.12, BLK); r(0.02, 0.05, 0.03, 0, 0.08, 0.04, BLK); }
        len = L;
      }
      if (w.scope === 2) {
        R.push(cz(0.026, 0.3, 0, 0.09, -0.12, 0x111316)); R.push(cz(0.034, 0.06, 0, 0.09, -0.29, 0x111316)); R.push(cz(0.031, 0.05, 0, 0.09, 0.04, 0x111316));
        r(0.016, 0.035, 0.02, 0, 0.06, -0.04, DRK); r(0.016, 0.035, 0.02, 0, 0.06, -0.2, DRK);
        R.push(cz(0.028, 0.004, 0, 0.09, -0.32, 0x4aa3ff));
      }
      if (w.scope === 1) {
        // коллиматор (красная точка)
        const sy = bull ? 0.1 : 0.1, sz = -0.06;
        r(0.05, 0.012, 0.08, 0, sy - 0.04, sz, DRK); r(0.006, 0.05, 0.05, -0.024, sy - 0.012, sz - 0.01, DRK); r(0.006, 0.05, 0.05, 0.024, sy - 0.012, sz - 0.01, DRK);
        r(0.05, 0.006, 0.05, 0, sy + 0.014, sz - 0.01, DRK); r(0.02, 0.016, 0.03, 0, sy - 0.03, sz + 0.03, MET);
        sight = new THREE.Vector3(0, sy - 0.005, sz - 0.03);
      }
      break;
    }
  }
  const g = new THREE.Group();
  if (R.length) { const m = new THREE.Mesh(merge(R), VCOL_SHINY); m.castShadow = true; g.add(m); }
  if (B.length) {
    const fm = fin >= 0 ? finishMaterial(fin) : null;
    const m = new THREE.Mesh(merge(B), fm || VCOL_SHINY); m.castShadow = true; g.add(m);
  }
  if (sight) {
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.04), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    lens.position.copy(sight); g.add(lens);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    dot.position.copy(sight).add(new THREE.Vector3(0, 0, -0.002)); dot.scale.setScalar(0.012); dot.renderOrder = 10; g.add(dot);
    g.userData.dot = dot;
  }
  g.userData.muzzle = new THREE.Vector3(0, 0.022, -len);
  g.userData.len = len; g.userData.sight = sight;
  return g;
}

// ---------------------------------------------------------------------
// Персонаж: детали слиты в несколько мешей (ноги отдельно для анимации)
// ---------------------------------------------------------------------
export function makeCharacter(skinId, team, wid, fid) {
  const s = SKINS[skinId] || SKINS[0], fem = s.female;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  body.scale.setScalar(fem ? 0.95 : 1);
  const tw = fem ? 0.38 : 0.47, tcol = TEAM_COL[team] ?? 0x888888;
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * (fem ? 0.095 : 0.115), 0.86, 0); body.add(hip);
    hip.add(meshOf([bx(0.17, 0.5, 0.19, 0, -0.25, 0, s.vest), bx(0.16, 0.36, 0.17, 0, -0.62, 0, s.vest), bx(0.17, 0.1, 0.27, 0, -0.82, -0.045, s.boots), bx(0.175, 0.05, 0.2, 0, -0.38, 0, 0x2b2620)]));
    legs.push(hip);
  }
  const torso = [bx(tw, 0.6, 0.26, 0, 0.3 + 0.86, 0, s.shirt), bx(tw + 0.035, 0.42, 0.29, 0, 0.33 + 0.86, 0, s.vest), bx(tw + 0.02, 0.06, 0.28, 0, 0.88, 0, 0x2b2620),
    bx(0.2, 0.13, 0.012, 0, 1.28, 0.152, tcol), bx(0.09, 0.12, 0.06, -0.1, 1.08, -0.16, s.vest), bx(0.09, 0.12, 0.06, 0.1, 1.08, -0.16, s.vest)];
  if (fem) torso.push(bx(tw + 0.05, 0.17, 0.27, 0, 0.88, 0, s.vest));
  body.add(meshOf(torso));
  const upper = new THREE.Group(); upper.position.y = 1.35; body.add(upper);
  const head = new THREE.Group(); head.position.y = 0.26; upper.add(head);
  const hp = [bx(0.08, 0.08, 0.08, 0, -0.1, 0, s.skin), bx(0.22, 0.25, 0.24, 0, 0.04, 0, s.skin), bx(0.04, 0.03, 0.012, -0.05, 0.07, -0.121, 0x1a1a1a), bx(0.04, 0.03, 0.012, 0.05, 0.07, -0.121, 0x1a1a1a), bx(0.04, 0.05, 0.03, 0, 0.02, -0.13, s.skin)];
  switch (s.hat) {
    case 'helmet': hp.push(bx(0.26, 0.13, 0.28, 0, 0.15, 0.01, s.hatColor), bx(0.27, 0.035, 0.29, 0, 0.09, 0.01, s.hatColor), bx(0.06, 0.04, 0.03, 0, 0.17, -0.145, 0x222222)); break;
    case 'cap': hp.push(bx(0.235, 0.08, 0.25, 0, 0.17, 0.01, s.hatColor), bx(0.2, 0.02, 0.12, 0, 0.13, -0.17, s.hatColor)); break;
    case 'beanie': hp.push(bx(0.24, 0.12, 0.26, 0, 0.15, 0.01, s.hatColor), bx(0.245, 0.04, 0.265, 0, 0.1, 0.01, s.hatColor)); break;
    case 'mask': hp.push(bx(0.235, 0.27, 0.255, 0, 0.045, 0.003, s.hatColor), bx(0.16, 0.03, 0.012, 0, 0.07, -0.132, 0xe74c3c)); break;
    default:
      hp.push(bx(0.235, 0.07, 0.255, 0, 0.17, 0.01, s.hair), bx(0.235, 0.2, 0.06, 0, 0.06, 0.1, s.hair));
      if (fem) hp.push(bx(0.24, 0.24, 0.07, 0, 0.0, 0.1, s.hair), bx(0.03, 0.2, 0.2, -0.12, 0.02, 0.02, s.hair), bx(0.03, 0.2, 0.2, 0.12, 0.02, 0.02, s.hair), bx(0.08, 0.26, 0.08, 0, -0.12, 0.17, s.hair));
  }
  head.add(meshOf(hp));
  const arms = new THREE.Group(); upper.add(arms);
  const gun = makeGun(wid, fid); gun.position.set(0.1, -0.08, -0.22); arms.add(gun);
  const W2 = WEAPONS[wid];
  const shR = new THREE.Vector3(tw / 2, 0.02, 0), shL = new THREE.Vector3(-tw / 2, 0.02, 0);
  const hR = new THREE.Vector3(0.1, -0.13, -0.2), hL = new THREE.Vector3(0.08, -0.08, -0.22 - Math.min(0.45, gun.userData.len * 0.45));
  if (W2 && (W2.cat === 'pistol' || W2.cat === 'dual' || W2.cat === 'knife')) hL.set(0.02, -0.14, -0.24);
  const ap = [];
  const mt = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  for (const [a, b2] of [[shR, hR], [shL, hL]]) {
    const len = a.distanceTo(b2);
    mt.lookAt(a, b2, up); const q = new THREE.Quaternion().setFromRotationMatrix(mt); const e = new THREE.Euler().setFromQuaternion(q);
    const mid = a.clone().add(b2).multiplyScalar(0.5), bp = a.clone().lerp(b2, 0.2);
    ap.push(bx(0.11, 0.11, len, mid.x, mid.y, mid.z, s.shirt, e.x, e.y, e.z), bx(0.125, 0.125, 0.06, bp.x, bp.y, bp.z, tcol, e.x, e.y, e.z), bx(0.08, 0.08, 0.08, b2.x, b2.y, b2.z, s.skin));
  }
  arms.add(meshOf(ap));
  root.userData = { legs, upper, head, body, gun, wid, skin: skinId, team, phase: 0, deadT: 0 };
  return root;
}

export function poseCharacter(ch, o, dt) {
  const u = ch.userData;
  ch.position.set(o.x * U, o.z * U, o.y * U);
  ch.rotation.y = -o.yaw - Math.PI / 2;
  u.upper.rotation.x = Math.max(-1.1, Math.min(1.1, o.pitch));
  const sp = o.moving ? 1 : 0;
  u.phase += dt * 9 * sp;
  const sw = Math.sin(u.phase) * 0.6 * sp;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.03 * sp;
  if (!o.alive) { u.deadT = Math.min(1, u.deadT + dt * 2.5); u.body.rotation.x = (u.deadT * Math.PI) / 2; u.body.position.z = u.deadT * 0.5; }
  else if (u.deadT) { u.deadT = 0; u.body.rotation.x = 0; u.body.position.z = 0; }
}
