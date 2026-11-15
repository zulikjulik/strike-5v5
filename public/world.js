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

  const weather = makeWeather(th.weather, map);
  root.add(weather.points);
  const chimneys = map.chimneys.map(([x, y, z]) => new THREE.Vector3((x + 0.5) * TL, z * U + 1.5, (y + 0.5) * TL));
  return {
    root, sun, chimneys,
    update(dt, cam) { weather.update(dt, cam); clouds.position.x = (clouds.position.x + dt * 0.6) % 60; },
  };
}

// Погода: снег, листья, пыль, пыльца — частицы вокруг камеры
function makeWeather(kind, map) {
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
  const disp = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(disp, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
        // под крышей частицу прячем
        const wx = (pos[i * 3] + points.position.x) / U, wy = (pos[i * 3 + 2] + points.position.z) / U, wz = pos[i * 3 + 1] / U;
        const tx = Math.floor(wx / C.TILE), ty = Math.floor(wy / C.TILE);
        let covered = false;
        if (tx >= 0 && ty >= 0 && tx < map.W && ty < map.H) for (const r of map.cols[ty * map.W + tx].s) if (r[1] > wz) { covered = true; break; }
        disp[i * 3] = pos[i * 3]; disp[i * 3 + 1] = covered ? -100 : pos[i * 3 + 1]; disp[i * 3 + 2] = pos[i * 3 + 2];
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
    case 'dragon': { const gr = g.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = c1; g.lineWidth = 2; for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) { g.beginPath(); g.arc(x * 16 + (y % 2) * 8, y * 14, 9, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); } break; }
    case 'galaxy': { const gr = g.createRadialGradient(s * 0.4, s * 0.5, 4, s * 0.5, s * 0.5, s * 0.8); gr.addColorStop(0, c1); gr.addColorStop(0.5, c0); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, s, s); blobs(g, s, 8, [c2 + '55', c1 + '44'], 8, 26); for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() < 0.2 ? c2 : '#ffffff'; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 2.5), rnd(1, 2.5)); } break; }
    case 'marble': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = c2; for (let i = 0; i < 12; i++) { g.lineWidth = rnd(0.5, 2.5); g.beginPath(); let x = rnd(0, s), y = 0; g.moveTo(x, y); while (y < s) { x += rnd(-10, 10); y += rnd(6, 14); g.lineTo(x, y); } g.stroke(); } break; }
    case 'lava': { g.fillStyle = c0; g.fillRect(0, 0, s, s); g.strokeStyle = c1; g.shadowColor = c2; g.shadowBlur = 6; for (let i = 0; i < 14; i++) { g.lineWidth = rnd(1.5, 3.5); g.beginPath(); let x = rnd(0, s), y = rnd(0, s); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += rnd(-22, 22); y += rnd(-22, 22); g.lineTo(x, y); } g.stroke(); } g.shadowBlur = 0; break; }
    case 'circuit': { g.fillStyle = c0; g.fillRect(0, 0, s, s); g.strokeStyle = c1; g.fillStyle = c2; g.lineWidth = 2; for (let i = 0; i < 18; i++) { let x = Math.floor(rnd(0, 8)) * 16 + 8, y = Math.floor(rnd(0, 8)) * 16 + 8; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 3; j++) { if (Math.random() < 0.5) x += (Math.random() < 0.5 ? -1 : 1) * 16; else y += (Math.random() < 0.5 ? -1 : 1) * 16; g.lineTo(x, y); } g.stroke(); g.fillRect(x - 3, y - 3, 6, 6); } break; }
    case 'geo': { g.fillStyle = c0; g.fillRect(0, 0, s, s); for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c0; g.beginPath(); g.moveTo(rnd(0, s), rnd(0, s)); g.lineTo(rnd(0, s), rnd(0, s)); g.lineTo(rnd(0, s), rnd(0, s)); g.closePath(); g.fill(); } g.fillStyle = c2; g.fillRect(0, s * 0.62, s, 6); g.fillStyle = c1; g.fillRect(0, s * 0.7, s, 3); break; }
    case 'comic': { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 16; i++) { g.fillStyle = [c0, c1, c2][i % 3]; g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(8, 22), rnd(6, 16), rnd(0, 3), 0, 7); g.fill(); g.stroke(); } break; }
    case 'chrome': { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c1); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.7, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(0, 0, s, s); break; }
    default: g.fillStyle = c0; g.fillRect(0, 0, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const shiny = f.p === 'gold' || f.p === 'doppler' || f.p === 'fade' || f.p === 'chrome' || f.p === 'marble';
  const m = new THREE.MeshPhongMaterial({ map: t, shininess: shiny ? 90 : 25, specular: shiny ? 0x888888 : 0x222222 });
  if (f.p === 'neon' || f.p === 'lava' || f.p === 'circuit' || f.p === 'galaxy') { m.emissiveMap = t; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = f.p === 'galaxy' ? 0.25 : 0.55; }
  if (f.p === 'chrome') { m.shininess = 140; m.specular = new THREE.Color(0xffffff); }
  return (finCache[fid] = m);
}

// ---------------------------------------------------------------------
// Модели оружия: у каждого ствола свой силуэт. Подвижные части (магазин, затвор,
// клинок, рукояти бабочки) — отдельные группы для анимаций.
// ---------------------------------------------------------------------
const dotTex = () => tex('reddot');
const C_ = { BLK: 0x1f2125, DRK: 0x131416, MET: 0x3c4047, STEEL: 0x7c838c, ALU: 0xb8bec6, WOOD: 0x8a5a2b, WOOD2: 0x6b3f1c, TAN: 0xb59b6a, OD: 0x4b5a3d, POLY: 0x2a2d31, BRASS: 0xc9a227, RUB: 0x26282b };
function torus(r, t, color, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) { return part(new THREE.TorusGeometry(r, t, 6, 16, arc).toNonIndexed(), color, x, y, z, 1, 1, 1, rx, ry, rz); }
function cx_(r, len, x, y, z, color) { return part(CYL, color, x, y, z, r, len, r, 0, 0, Math.PI / 2); } // цилиндр вдоль X

function partsGroup(lists, finMat) {
  const g = new THREE.Group();
  if (lists.R.length) { const m = new THREE.Mesh(merge(lists.R), VCOL_SHINY); m.castShadow = true; g.add(m); }
  if (lists.B.length) { const m = new THREE.Mesh(merge(lists.B), finMat || VCOL_SHINY); m.castShadow = true; g.add(m); }
  return g;
}
function L(col = 0x1f2125) { const o = { B: [], R: [], col }; o.b = (w, h, d, x, y, z, c, rx, ry, rz) => o.B.push(bx(w, h, d, x, y, z, c ?? o.col, rx, ry, rz)); o.r = (w, h, d, x, y, z, c, rx, ry, rz) => o.R.push(bx(w, h, d, x, y, z, c ?? 0x131416, rx, ry, rz)); return o; }

export function makeGun(wid, fid) {
  const w = WEAPONS[wid] || WEAPONS[0], k = w.key;
  const fin = fid != null && fid >= 0 && FINISHES[fid] && FINISHES[fid].w === k ? fid : -1;
  const fm = fin >= 0 ? finishMaterial(fin) : null;
  const { BLK, DRK, MET, STEEL, ALU, WOOD, WOOD2, TAN, OD, POLY, BRASS, RUB } = C_;
  const main = L(), mag = L(), slide = L(), extra = {};
  let len = 0.6, sight = null, magPos = new THREE.Vector3(), slidePos = new THREE.Vector3();
  const g = new THREE.Group();
  const knifeModel = k === 'knife' ? (fin >= 0 ? FINISHES[fin].model : 'default') : null;

  if (k === 'knife') return makeKnife(knifeModel, fm);

  switch (k) {
    // ------------------------------- пистолеты
    case 'glock': {
      slide.b(0.032, 0.034, 0.19, 0, 0, 0); for (let i = 0; i < 5; i++) slide.r(0.033, 0.026, 0.003, 0, 0, 0.07 + i * 0.006, DRK);
      slide.r(0.006, 0.006, 0.008, 0, 0.02, -0.088, DRK); slide.r(0.016, 0.006, 0.006, 0, 0.02, 0.085, DRK);
      slidePos.set(0, 0.022, -0.06);
      main.r(0.029, 0.02, 0.17, 0, -0.005, -0.06, POLY); main.r(0.012, 0.024, 0.04, 0, -0.024, -0.02, POLY);
      main.R.push(bx(0.03, 0.11, 0.046, 0, -0.06, 0.025, POLY, -0.22));
      main.r(0.004, 0.018, 0.004, 0, -0.022, -0.012, DRK);
      mag.r(0.022, 0.01, 0.036, 0, -0.118, 0.04, DRK); magPos.set(0, 0, 0);
      len = 0.16; break;
    }
    case 'usp': {
      slide.b(0.034, 0.036, 0.2, 0, 0, 0); slide.r(0.034, 0.02, 0.05, 0, -0.008, 0.05, BLK);
      for (let i = 0; i < 6; i++) slide.r(0.035, 0.028, 0.003, 0, 0, 0.065 + i * 0.006, DRK);
      slidePos.set(0, 0.024, -0.065);
      main.r(0.03, 0.022, 0.18, 0, -0.006, -0.065, BLK); main.R.push(bx(0.032, 0.112, 0.048, 0, -0.062, 0.028, BLK, -0.2));
      main.R.push(torus(0.016, 0.003, BLK, 0, -0.03, -0.01, 0, Math.PI / 2, 0));
      main.R.push(cz(0.019, 0.17, 0, 0.024, -0.245, DRK)); main.R.push(cz(0.02, 0.01, 0, 0.024, -0.33, MET));
      main.r(0.01, 0.014, 0.012, 0, 0.034, 0.045, DRK);
      mag.r(0.024, 0.012, 0.038, 0, -0.12, 0.044, DRK);
      len = 0.33; extra.sil = true; break;
    }
    case 'p228': {
      slide.b(0.033, 0.034, 0.18, 0, 0, 0); for (let i = 0; i < 4; i++) slide.r(0.034, 0.026, 0.003, 0, 0, 0.06 + i * 0.007, DRK);
      slidePos.set(0, 0.023, -0.055);
      main.r(0.03, 0.022, 0.15, 0, -0.006, -0.05, MET); main.R.push(torus(0.017, 0.004, MET, 0, -0.033, -0.01, 0, Math.PI / 2, 0));
      main.R.push(bx(0.031, 0.105, 0.046, 0, -0.06, 0.026, MET, -0.25));
      main.R.push(bx(0.034, 0.08, 0.036, 0, -0.065, 0.028, WOOD, -0.25)); main.r(0.008, 0.014, 0.01, 0.02, -0.002, 0.03, STEEL);
      mag.r(0.022, 0.01, 0.036, 0, -0.112, 0.045, DRK);
      len = 0.15; break;
    }
    case 'fiveseven': {
      slide.col = 0x3f4640;
      slide.b(0.03, 0.03, 0.21, 0, 0, 0); slide.R.push(bx(0.031, 0.02, 0.04, 0, 0.004, -0.11, 0x2f3530, 0.5));
      slidePos.set(0, 0.022, -0.07);
      main.r(0.028, 0.024, 0.19, 0, -0.008, -0.07, 0x3f4640); main.r(0.02, 0.006, 0.08, 0, -0.022, -0.12, DRK);
      main.R.push(bx(0.03, 0.115, 0.05, 0, -0.064, 0.025, 0x3f4640, -0.18));
      for (let i = 0; i < 3; i++) main.R.push(bx(0.031, 0.006, 0.05, 0, -0.04 - i * 0.025, 0.021 + i * 0.005, DRK, -0.18));
      mag.r(0.022, 0.01, 0.04, 0, -0.124, 0.042, DRK);
      len = 0.18; break;
    }
    case 'elite': {
      for (const ox of [-0.075, 0.075]) {
        main.b(0.032, 0.03, 0.2, ox, 0.02, -0.07, ALU); main.r(0.033, 0.012, 0.09, ox, 0.03, -0.12, DRK);
        main.R.push(cz(0.008, 0.03, ox, 0.022, -0.17, DRK));
        main.r(0.03, 0.02, 0.16, ox, -0.006, -0.06, ALU); main.R.push(bx(0.031, 0.11, 0.046, ox, -0.062, 0.024, ALU, -0.2));
        main.R.push(bx(0.034, 0.085, 0.036, ox, -0.066, 0.026, WOOD2, -0.2));
      }
      mag.r(0.02, 0.01, 0.034, -0.075, -0.118, 0.04, DRK); mag.r(0.02, 0.01, 0.034, 0.075, -0.118, 0.04, DRK);
      len = 0.18; break;
    }
    case 'deagle': {
      slide.col = ALU; main.col = ALU;
      slide.b(0.042, 0.05, 0.27, 0, 0, 0); slide.R.push(bx(0.03, 0.03, 0.27, 0, 0.022, 0, STEEL, 0, 0, Math.PI / 4));
      for (let i = 0; i < 6; i++) slide.r(0.043, 0.04, 0.003, 0, -0.004, 0.09 + i * 0.006, MET);
      slidePos.set(0, 0.028, -0.09);
      main.r(0.034, 0.025, 0.2, 0, -0.006, -0.08, ALU); main.R.push(bx(0.036, 0.12, 0.056, 0, -0.068, 0.03, 0x2b2c2e, -0.2));
      main.r(0.012, 0.022, 0.012, 0, 0.04, 0.052, MET);
      mag.r(0.026, 0.012, 0.044, 0, -0.13, 0.05, DRK);
      len = 0.23; break;
    }
    // ------------------------------- пистолеты-пулемёты
    case 'tmp': {
      main.b(0.05, 0.065, 0.22, 0, 0.012, -0.06); main.r(0.03, 0.018, 0.12, 0, 0.052, -0.06, DRK);
      main.R.push(cz(0.022, 0.2, 0, 0.012, -0.27, DRK)); main.R.push(cz(0.023, 0.012, 0, 0.012, -0.37, MET));
      main.R.push(bx(0.032, 0.1, 0.04, 0, -0.06, -0.15, POLY, 0.15)); main.R.push(bx(0.032, 0.1, 0.044, 0, -0.06, 0.03, POLY, -0.15));
      mag.R.push(bx(0.026, 0.13, 0.034, 0, -0.105, 0.028, DRK, -0.15));
      len = 0.38; extra.sil = false; break;
    }
    case 'mac10': {
      main.b(0.056, 0.085, 0.2, 0, 0.0, -0.04); main.r(0.04, 0.012, 0.04, 0, 0.048, 0.02, DRK);
      main.R.push(cz(0.01, 0.08, 0, 0.012, -0.18, DRK)); main.R.push(cz(0.013, 0.02, 0, 0.012, -0.21, MET));
      main.r(0.006, 0.006, 0.2, -0.032, 0.05, -0.02, STEEL); main.r(0.006, 0.006, 0.2, 0.032, 0.05, -0.02, STEEL); main.r(0.07, 0.03, 0.006, 0, 0.05, 0.08, STEEL);
      main.R.push(bx(0.032, 0.07, 0.04, 0, -0.07, 0.03, BLK, -0.05));
      mag.R.push(bx(0.028, 0.16, 0.034, 0, -0.17, 0.034, DRK, -0.05));
      len = 0.22; break;
    }
    case 'mp5': {
      main.b(0.046, 0.06, 0.3, 0, 0.01, -0.07); main.R.push(cz(0.028, 0.15, 0, 0.0, -0.26, POLY));
      main.R.push(cz(0.009, 0.06, 0, 0.012, -0.36, DRK)); main.R.push(cz(0.009, 0.16, 0, 0.042, -0.2, MET));
      main.R.push(cz(0.012, 0.014, 0, 0.05, 0.05, DRK)); main.r(0.008, 0.03, 0.008, 0, 0.048, -0.32, DRK);
      main.R.push(bx(0.032, 0.1, 0.045, 0, -0.065, 0.04, POLY, -0.25));
      main.r(0.008, 0.008, 0.2, -0.022, 0.0, 0.17, STEEL); main.r(0.008, 0.008, 0.2, 0.022, 0.0, 0.17, STEEL); main.r(0.05, 0.08, 0.02, 0, -0.01, 0.27, DRK);
      for (let i = 0; i < 4; i++) mag.R.push(bx(0.026, 0.045, 0.036, 0, -0.052 - i * 0.038, -0.11 - i * 0.012, DRK, 0.18 + i * 0.07));
      len = 0.4; break;
    }
    case 'ump45': {
      main.b(0.058, 0.085, 0.3, 0, 0.0, -0.06); main.r(0.026, 0.012, 0.22, 0, 0.05, -0.06, DRK);
      main.R.push(cz(0.012, 0.07, 0, 0.014, -0.25, DRK)); main.r(0.05, 0.03, 0.08, 0, -0.04, -0.17, POLY);
      main.R.push(bx(0.034, 0.1, 0.05, 0, -0.07, 0.04, POLY, -0.2));
      main.r(0.01, 0.06, 0.012, 0, -0.01, 0.12, POLY); main.r(0.01, 0.012, 0.16, 0, 0.012, 0.2, POLY); main.r(0.01, 0.012, 0.16, 0, -0.04, 0.2, POLY); main.r(0.012, 0.07, 0.02, 0, -0.014, 0.28, POLY);
      mag.r(0.03, 0.16, 0.042, 0, -0.12, -0.08, DRK);
      len = 0.29; break;
    }
    case 'p90': {
      main.b(0.064, 0.09, 0.5, 0, -0.01, -0.06); main.R.push(bx(0.062, 0.04, 0.12, 0, 0.0, -0.33, POLY, 0.25));
      main.r(0.03, 0.05, 0.04, 0, -0.07, -0.18, POLY); main.r(0.03, 0.006, 0.1, 0, -0.1, -0.13, POLY); main.r(0.03, 0.05, 0.02, 0, -0.07, -0.085, POLY);
      main.R.push(bx(0.032, 0.09, 0.045, 0, -0.08, 0.02, POLY, -0.15));
      main.r(0.02, 0.03, 0.08, 0, 0.065, -0.06, DRK); main.R.push(cz(0.009, 0.06, 0, 0.0, -0.4, DRK));
      mag.r(0.05, 0.022, 0.32, 0, 0.046, -0.08, 0x9fc4d6);
      len = 0.43; break;
    }
    // ------------------------------- дробовики
    case 'm3': {
      main.b(0.054, 0.075, 0.22, 0, 0.01, -0.03); main.R.push(cz(0.015, 0.62, 0, 0.03, -0.45, DRK)); main.R.push(cz(0.015, 0.46, 0, -0.005, -0.38, MET));
      main.B.push(bx(0.046, 0.08, 0.3, 0, -0.03, 0.22, WOOD, 0.14)); main.B.push(bx(0.048, 0.07, 0.04, 0, -0.07, 0.07, WOOD, -0.6));
      slide.b(0.062, 0.062, 0.17, 0, 0, 0, WOOD2); for (let i = 0; i < 5; i++) slide.r(0.064, 0.064, 0.006, 0, 0, -0.07 + i * 0.035, DRK);
      slidePos.set(0, -0.005, -0.3);
      main.r(0.006, 0.012, 0.008, 0, 0.048, -0.75, 0xd0d0d0);
      len = 0.76; break;
    }
    case 'xm1014': {
      main.b(0.056, 0.08, 0.26, 0, 0.012, -0.03); main.r(0.024, 0.012, 0.22, 0, 0.058, -0.04, DRK);
      main.R.push(cz(0.016, 0.56, 0, 0.032, -0.44, DRK)); main.R.push(cz(0.017, 0.42, 0, -0.008, -0.38, POLY));
      main.R.push(bx(0.034, 0.1, 0.045, 0, -0.07, 0.07, POLY, -0.25));
      main.R.push(cz(0.014, 0.2, 0, 0.0, 0.2, DRK)); main.r(0.04, 0.08, 0.1, 0, -0.01, 0.31, POLY);
      main.r(0.03, 0.03, 0.01, 0, 0.07, 0.07, DRK); main.r(0.02, 0.02, 0.01, 0, 0.06, -0.68, DRK);
      mag.r(0.03, 0.02, 0.06, 0, -0.04, -0.02, BRASS);
      len = 0.72; break;
    }
    // ------------------------------- винтовки
    case 'galil': {
      main.b(0.058, 0.085, 0.32, 0, 0.012, -0.05); main.B.push(bx(0.052, 0.07, 0.2, 0, 0.0, -0.31, WOOD));
      main.R.push(cz(0.012, 0.36, 0, 0.022, -0.58, DRK)); main.R.push(cz(0.016, 0.05, 0, 0.022, -0.78, DRK));
      main.r(0.008, 0.06, 0.008, 0, 0.06, -0.72, DRK); main.r(0.03, 0.05, 0.015, 0, 0.08, 0.06, MET);
      main.R.push(bx(0.034, 0.11, 0.046, 0, -0.075, 0.03, POLY, -0.25));
      main.r(0.012, 0.012, 0.26, 0, -0.02, 0.24, STEEL); main.r(0.012, 0.012, 0.26, 0, 0.04, 0.24, STEEL); main.r(0.014, 0.09, 0.02, 0, 0.01, 0.37, STEEL);
      main.r(0.006, 0.006, 0.22, -0.02, -0.04, -0.4, MET); main.r(0.006, 0.006, 0.22, 0.02, -0.04, -0.4, MET);
      for (let i = 0; i < 4; i++) mag.R.push(bx(0.032, 0.05, 0.05, 0, -0.06 - i * 0.042, -0.12 - i * 0.016, DRK, 0.3 + i * 0.06));
      len = 0.8; break;
    }
    case 'famas': {
      main.b(0.06, 0.095, 0.5, 0, 0.0, -0.06); main.R.push(bx(0.056, 0.07, 0.12, 0, -0.01, 0.24, POLY));
      main.R.push(cz(0.012, 0.2, 0, 0.02, -0.42, DRK)); main.R.push(cz(0.016, 0.04, 0, 0.02, -0.53, DRK));
      main.r(0.026, 0.03, 0.46, 0, 0.1, -0.08, BLK); main.r(0.02, 0.06, 0.02, 0, 0.07, 0.13, BLK); main.r(0.02, 0.06, 0.02, 0, 0.07, -0.28, BLK);
      main.R.push(bx(0.034, 0.1, 0.045, 0, -0.08, -0.14, POLY, -0.2)); main.r(0.04, 0.012, 0.12, 0, -0.06, -0.1, BLK);
      main.r(0.006, 0.006, 0.2, -0.026, -0.03, -0.38, MET); main.r(0.006, 0.006, 0.2, 0.026, -0.03, -0.38, MET);
      mag.r(0.03, 0.09, 0.05, 0, -0.08, 0.06, DRK);
      len = 0.55; break;
    }
    case 'ak47': {
      main.b(0.056, 0.08, 0.32, 0, 0.012, -0.05); for (let i = 0; i < 6; i++) main.r(0.057, 0.004, 0.02, 0, 0.054, -0.15 + i * 0.04, MET);
      main.B.push(bx(0.05, 0.062, 0.2, 0, -0.005, -0.3, WOOD)); main.B.push(bx(0.04, 0.03, 0.15, 0, 0.042, -0.28, WOOD));
      main.R.push(cz(0.009, 0.2, 0, 0.05, -0.33, MET)); main.R.push(cz(0.012, 0.36, 0, 0.022, -0.56, DRK)); main.R.push(cz(0.016, 0.05, 0, 0.022, -0.76, DRK));
      main.r(0.01, 0.045, 0.012, 0, 0.055, -0.7, DRK); main.r(0.012, 0.02, 0.06, 0, 0.065, -0.12, MET);
      main.R.push(bx(0.034, 0.11, 0.046, 0, -0.07, 0.03, WOOD2, -0.28));
      main.B.push(bx(0.046, 0.08, 0.3, 0, -0.03, 0.25, WOOD, 0.12)); main.r(0.048, 0.09, 0.02, 0, -0.05, 0.4, DRK);
      for (let i = 0; i < 5; i++) mag.R.push(bx(0.032, 0.046, 0.05, 0, -0.055 - i * 0.04, -0.12 - i * 0.02, 0x2d2b28, 0.3 + i * 0.08));
      len = 0.79; break;
    }
    case 'm4a1': {
      main.b(0.056, 0.08, 0.3, 0, 0.012, -0.04); main.r(0.028, 0.014, 0.42, 0, 0.06, -0.12, DRK);
      main.R.push(cz(0.026, 0.22, 0, 0.012, -0.3, POLY)); for (let i = 0; i < 4; i++) main.R.push(cz(0.028, 0.008, 0, 0.012, -0.21 - i * 0.05, DRK));
      main.R.push(cz(0.011, 0.08, 0, 0.022, -0.45, DRK)); main.R.push(cz(0.022, 0.24, 0, 0.022, -0.6, DRK)); main.R.push(cz(0.023, 0.01, 0, 0.022, -0.72, MET));
      main.r(0.012, 0.05, 0.012, 0, 0.075, -0.41, DRK); main.r(0.02, 0.03, 0.04, 0, 0.08, 0.06, DRK);
      main.R.push(bx(0.034, 0.11, 0.046, 0, -0.07, 0.03, POLY, -0.28));
      main.R.push(cz(0.016, 0.22, 0, 0.0, 0.22, DRK)); main.r(0.044, 0.09, 0.12, 0, -0.012, 0.3, POLY);
      for (let i = 0; i < 3; i++) mag.R.push(bx(0.03, 0.06, 0.05, 0, -0.06 - i * 0.055, -0.12 - i * 0.006, DRK, 0.1 + i * 0.04));
      len = 0.73; extra.sil = true; break;
    }
    case 'sg552': {
      main.b(0.054, 0.08, 0.3, 0, 0.012, -0.05); main.B.push(bx(0.05, 0.065, 0.16, 0, 0.0, -0.27, OD));
      main.R.push(cz(0.012, 0.2, 0, 0.022, -0.45, DRK)); main.R.push(cz(0.017, 0.05, 0, 0.022, -0.57, DRK));
      main.R.push(bx(0.034, 0.11, 0.046, 0, -0.07, 0.03, POLY, -0.25));
      main.r(0.012, 0.012, 0.24, 0, -0.02, 0.22, BLK); main.r(0.012, 0.012, 0.24, 0, 0.04, 0.22, BLK); main.r(0.016, 0.1, 0.03, 0, 0.01, 0.34, BLK);
      for (let i = 0; i < 3; i++) mag.R.push(bx(0.03, 0.06, 0.05, 0, -0.06 - i * 0.052, -0.12 - i * 0.012, 0xd9822b, 0.15 + i * 0.06));
      len = 0.6; break;
    }
    case 'aug': {
      main.b(0.064, 0.1, 0.52, 0, 0.0, -0.04, OD); main.R.push(bx(0.06, 0.07, 0.1, 0, -0.01, 0.26, OD));
      main.R.push(cz(0.013, 0.22, 0, 0.022, -0.4, DRK)); main.R.push(cz(0.018, 0.05, 0, 0.022, -0.52, DRK));
      main.R.push(bx(0.034, 0.1, 0.045, 0, -0.08, -0.14, OD, -0.15)); main.R.push(bx(0.03, 0.1, 0.035, 0, -0.08, -0.27, OD, 0.35));
      main.r(0.06, 0.012, 0.1, 0, -0.065, -0.14, OD);
      mag.r(0.032, 0.11, 0.05, 0, -0.09, 0.07, 0x9fb7a8);
      len = 0.55; break;
    }
    // ------------------------------- снайперские
    case 'scout': {
      main.b(0.046, 0.06, 0.24, 0, 0.012, -0.04, BLK); main.R.push(cz(0.011, 0.64, 0, 0.022, -0.48, DRK)); main.R.push(cz(0.014, 0.04, 0, 0.022, -0.8, DRK));
      main.B.push(bx(0.044, 0.06, 0.36, 0, -0.012, -0.3, BLK)); main.B.push(bx(0.042, 0.075, 0.3, 0, -0.04, 0.22, BLK, 0.1));
      main.R.push(bx(0.03, 0.08, 0.04, 0, -0.06, 0.05, BLK, -0.4));
      slide.R.push(cx_(0.006, 0.06, 0.03, 0, 0, STEEL)); slide.R.push(part(CYL, STEEL, 0.06, 0, 0, 0.012, 0.012, 0.012)); slidePos.set(0, 0.03, 0.03);
      mag.r(0.03, 0.05, 0.06, 0, -0.045, -0.08, DRK);
      len = 0.82; break;
    }
    case 'awp': {
      main.b(0.06, 0.08, 0.3, 0, 0.012, -0.05, OD); main.R.push(cz(0.017, 0.62, 0, 0.022, -0.5, DRK)); main.r(0.044, 0.044, 0.1, 0, 0.022, -0.85, DRK);
      for (let i = 0; i < 3; i++) main.r(0.046, 0.012, 0.006, 0, 0.022, -0.82 - i * 0.025, MET);
      main.B.push(bx(0.06, 0.07, 0.3, 0, -0.01, -0.3, OD));
      main.B.push(bx(0.056, 0.09, 0.1, 0, -0.02, 0.16, OD)); main.B.push(bx(0.056, 0.035, 0.18, 0, 0.02, 0.25, OD)); main.B.push(bx(0.056, 0.1, 0.06, 0, -0.025, 0.36, OD));
      main.B.push(bx(0.056, 0.03, 0.2, 0, -0.07, 0.27, OD)); main.r(0.058, 0.1, 0.02, 0, -0.025, 0.395, RUB);
      main.R.push(bx(0.034, 0.09, 0.04, 0, -0.06, 0.07, OD, -0.35));
      main.r(0.008, 0.008, 0.24, -0.02, -0.05, -0.36, MET); main.r(0.008, 0.008, 0.24, 0.02, -0.05, -0.36, MET);
      slide.R.push(cx_(0.007, 0.07, 0.035, 0, 0, STEEL)); slide.R.push(part(new THREE.SphereGeometry(1, 8, 6).toNonIndexed(), STEEL, 0.07, 0, 0, 0.014, 0.014, 0.014)); slidePos.set(0, 0.03, 0.04);
      mag.r(0.034, 0.05, 0.07, 0, -0.05, -0.08, DRK);
      len = 0.9; break;
    }
    // ------------------------------- пулемёт
    case 'm249': {
      main.b(0.07, 0.1, 0.36, 0, 0.012, -0.05); main.r(0.074, 0.03, 0.2, 0, 0.07, -0.05, BLK);
      main.R.push(cz(0.014, 0.5, 0, 0.022, -0.5, DRK)); main.R.push(cz(0.024, 0.3, 0, 0.03, -0.42, 0x50545a));
      for (let i = 0; i < 6; i++) main.r(0.05, 0.006, 0.01, 0, 0.055, -0.3 - i * 0.05, DRK);
      main.r(0.012, 0.012, 0.24, 0, 0.11, -0.12, STEEL); main.r(0.012, 0.04, 0.012, 0, 0.09, -0.02, STEEL); main.r(0.012, 0.04, 0.012, 0, 0.09, -0.22, STEEL);
      main.R.push(bx(0.034, 0.11, 0.046, 0, -0.08, 0.04, POLY, -0.25));
      main.r(0.014, 0.014, 0.24, 0, -0.02, 0.25, BLK); main.r(0.014, 0.014, 0.24, 0, 0.05, 0.25, BLK); main.r(0.05, 0.1, 0.04, 0, 0.01, 0.38, POLY);
      main.R.push(bx(0.008, 0.2, 0.008, -0.03, -0.09, -0.62, DRK, 0.3)); main.R.push(bx(0.008, 0.2, 0.008, 0.03, -0.09, -0.62, DRK, 0.3));
      mag.r(0.08, 0.13, 0.14, 0.01, -0.11, -0.1, OD); mag.r(0.082, 0.02, 0.142, 0.01, -0.05, -0.1, 0x3d4a32);
      len = 0.75; break;
    }
  }
  // прицелы
  if (w.scope === 2) {
    const big = k === 'awp';
    main.R.push(cz(big ? 0.028 : 0.022, 0.3, 0, 0.1, -0.12, 0x111316)); main.R.push(cz(big ? 0.04 : 0.03, 0.08, 0, 0.1, -0.31, 0x111316)); main.R.push(cz(big ? 0.034 : 0.028, 0.06, 0, 0.1, 0.05, 0x111316));
    main.R.push(cx_(0.009, 0.03, 0.03, 0.1, -0.12, 0x111316)); main.R.push(part(CYL, 0x111316, 0, 0.13, -0.12, 0.009, 0.03, 0.009));
    main.r(0.016, 0.04, 0.02, 0, 0.065, -0.04, DRK); main.r(0.016, 0.04, 0.02, 0, 0.065, -0.2, DRK);
    main.R.push(cz(big ? 0.036 : 0.026, 0.004, 0, 0.1, -0.352, 0x4aa3ff));
  }
  if (w.scope === 1) {
    const sy = 0.105, sz = -0.06;
    main.r(0.05, 0.012, 0.09, 0, sy - 0.045, sz, DRK); main.r(0.007, 0.055, 0.05, -0.026, sy - 0.012, sz - 0.01, DRK); main.r(0.007, 0.055, 0.05, 0.026, sy - 0.012, sz - 0.01, DRK);
    main.r(0.06, 0.007, 0.05, 0, sy + 0.016, sz - 0.01, DRK); main.r(0.02, 0.016, 0.03, 0, sy - 0.03, sz + 0.03, MET); main.r(0.012, 0.012, 0.012, 0.03, sy, sz, DRK);
    sight = new THREE.Vector3(0, sy - 0.006, sz - 0.03);
  }
  const mm = partsGroup(main, fm); g.add(mm);
  const mg = partsGroup(mag); mg.position.copy(magPos); g.add(mg);
  const sg = partsGroup(slide, fm); sg.position.copy(slidePos); g.add(sg);
  if (sight) {
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.042), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    lens.position.copy(sight); g.add(lens);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    dot.position.copy(sight).add(new THREE.Vector3(0, 0, -0.002)); dot.scale.setScalar(0.009); dot.renderOrder = 10; dot.visible = false; g.add(dot);
    g.userData.dot = dot;
  }
  g.userData = Object.assign(g.userData, { muzzle: new THREE.Vector3(0, 0.022, -len), len, sight, mag: mg, slide: sg, magHome: mg.position.clone(), slideHome: sg.position.clone(), sil: !!extra.sil, kind: w.cat });
  return g;
}

// Ножи: рукоять в начале координат, клинок вдоль -Z
function makeKnife(model, fm) {
  const { BLK, DRK, MET, STEEL, WOOD, WOOD2, BRASS, RUB } = C_;
  const BL = 0xd5dbe2;
  const g = new THREE.Group(), handle = L(), blade = L(0xd5dbe2), h2 = L();
  let len = 0.26, pivot = new THREE.Vector3(0, 0, -0.06), kind = model;
  const seg = (lst, n, x0, y0, z0, dz, dy, w0, h0, taper, col, curve = 0) => { for (let i = 0; i < n; i++) { const t = i / n; lst.B.push(bx(0.007, h0 * (1 - taper * t), dz * 1.05, x0, y0 + dy * i + curve * t * t, z0 - dz * i, col ?? BL, -curve * 2 * t * 0.6)); } };
  switch (model) {
    case 'm9': {
      handle.r(0.03, 0.036, 0.13, 0, 0, 0.04, RUB); for (let i = 0; i < 6; i++) handle.r(0.032, 0.038, 0.006, 0, 0, -0.01 + i * 0.02, BLK);
      handle.r(0.07, 0.014, 0.016, 0, 0, -0.03, MET); handle.R.push(torus(0.012, 0.004, MET, 0, -0.03, -0.03, 0, Math.PI / 2, 0)); handle.r(0.034, 0.03, 0.02, 0, 0, 0.11, MET);
      blade.b(0.008, 0.038, 0.2, 0, 0.002, -0.14); blade.B.push(bx(0.008, 0.024, 0.05, 0, 0.008, -0.255, BL, 0.5));
      for (let i = 0; i < 8; i++) blade.r(0.006, 0.006, 0.006, 0, 0.022, -0.1 - i * 0.012, STEEL);
      len = 0.28; break;
    }
    case 'butterfly': {
      handle.r(0.012, 0.026, 0.13, -0.011, 0, 0.03, STEEL); handle.r(0.004, 0.02, 0.11, -0.016, 0, 0.03, DRK);
      h2.r(0.012, 0.026, 0.13, 0.011, 0, 0.03, STEEL); h2.r(0.004, 0.02, 0.11, 0.016, 0, 0.03, DRK); h2.r(0.03, 0.006, 0.012, 0, -0.012, 0.095, MET);
      blade.b(0.007, 0.032, 0.13, 0, 0.004, -0.1); blade.B.push(bx(0.007, 0.02, 0.04, 0, 0.012, -0.18, BL, 0.5));
      pivot.set(0, 0, -0.035); len = 0.22; break;
    }
    case 'flip': {
      handle.r(0.026, 0.032, 0.12, 0, 0, 0.03, 0x2b2e33); handle.r(0.028, 0.008, 0.1, 0, 0.016, 0.03, STEEL); handle.R.push(cx_(0.01, 0.034, 0, 0, -0.03, MET));
      blade.b(0.007, 0.034, 0.12, 0, 0.004, -0.09); blade.B.push(bx(0.007, 0.022, 0.04, 0, 0.012, -0.16, BL, 0.55)); blade.r(0.008, 0.012, 0.02, 0, 0.022, -0.03, STEEL);
      pivot.set(0, 0, -0.03); len = 0.2; break;
    }
    case 'bear': {
      handle.r(0.032, 0.04, 0.13, 0, 0, 0.04, WOOD); handle.r(0.034, 0.042, 0.02, 0, 0, 0.115, BRASS); handle.r(0.09, 0.016, 0.02, 0, 0, -0.03, BRASS);
      blade.b(0.009, 0.05, 0.2, 0, 0.004, -0.14); blade.B.push(bx(0.009, 0.034, 0.07, 0, 0.012, -0.265, BL, 0.4)); blade.r(0.01, 0.006, 0.12, 0, 0.03, -0.12, STEEL);
      len = 0.3; break;
    }
    case 'machete': {
      handle.r(0.03, 0.036, 0.14, 0, 0, 0.04, RUB); handle.r(0.034, 0.04, 0.016, 0, 0, -0.035, BLK);
      for (let i = 0; i < 6; i++) blade.B.push(bx(0.006, 0.042 + i * 0.006, 0.075, 0, -0.002 - i * 0.002, -0.08 - i * 0.07, BL));
      blade.B.push(bx(0.006, 0.05, 0.06, 0, 0.0, -0.5, BL, 0.6));
      len = 0.52; break;
    }
    case 'katana': {
      for (let i = 0; i < 8; i++) handle.r(0.03, 0.03, 0.026, 0, 0, 0.13 - i * 0.026, i % 2 ? 0x1a1a1a : 0x7a1f2b);
      handle.r(0.034, 0.034, 0.02, 0, 0, 0.16, BRASS); handle.R.push(cz(0.045, 0.012, 0, 0, -0.035, BLK)); handle.r(0.032, 0.032, 0.02, 0, 0, -0.05, BRASS);
      for (let i = 0; i < 12; i++) { const t = i / 12; blade.B.push(bx(0.007, 0.03 - t * 0.006, 0.062, 0, 0.004 + t * t * 0.06, -0.09 - i * 0.06, BL, -t * 0.12)); }
      blade.B.push(bx(0.007, 0.02, 0.04, 0, 0.068, -0.83, BL, 0.6));
      len = 0.86; break;
    }
    case 'karambit': {
      handle.R.push(torus(0.026, 0.007, STEEL, 0, -0.005, 0.105, 0, Math.PI / 2, 0)); handle.r(0.026, 0.034, 0.1, 0, 0, 0.03, 0x2b2e33);
      { const R = 0.13; for (let i = 0; i < 9; i++) { const a = i * 0.16 + 0.04; blade.B.push(bx(0.007, 0.032 - i * 0.0025, R * 0.19, 0, 0.01 - (1 - Math.cos(a)) * R, -0.035 - Math.sin(a) * R, BL, a)); } }
      len = 0.18; kind = 'karambit'; break;
    }
    default: {
      handle.r(0.028, 0.034, 0.12, 0, 0, 0.035, 0x2b2e33); handle.r(0.06, 0.012, 0.014, 0, 0, -0.03, MET);
      blade.b(0.008, 0.034, 0.17, 0, 0.004, -0.12); blade.B.push(bx(0.008, 0.02, 0.045, 0, 0.012, -0.22, BL, 0.45));
      len = 0.25; kind = 'default';
    }
  }
  const hg = partsGroup(handle); g.add(hg);
  const bp = new THREE.Group(); bp.position.copy(pivot); g.add(bp);
  const bg = partsGroup(blade, fm); bg.position.copy(pivot).negate(); bp.add(bg);
  let h2g = null;
  if (h2.R.length) { h2g = new THREE.Group(); h2g.position.copy(pivot); g.add(h2g); const hm = partsGroup(h2); hm.position.copy(pivot).negate(); h2g.add(hm); }
  g.userData = { muzzle: new THREE.Vector3(0, 0, -len), len, sight: null, mag: null, slide: null, bladePivot: bp, handle2: h2g, knife: kind, kind: 'knife', sil: false };
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
  u.phase += dt * (o.mv === 1 ? 6 : 9) * sp;
  const sw = Math.sin(u.phase) * 0.6 * sp;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.03 * sp;
  u.cr = (u.cr || 0) + ((o.cr ? 1 : 0) - (u.cr || 0)) * Math.min(1, dt * 12);
  if (u.cr > 0.01) { u.body.position.y -= u.cr * 0.36; u.legs[0].rotation.x = sw * 0.5 - u.cr * 1.1; u.legs[1].rotation.x = -sw * 0.5 - u.cr * 0.5; }
  if (!o.alive) { u.deadT = Math.min(1, u.deadT + dt * 2.5); u.body.rotation.x = (u.deadT * Math.PI) / 2; u.body.position.z = u.deadT * 0.5; }
  else if (u.deadT) { u.deadT = 0; u.body.rotation.x = 0; u.body.position.z = 0; }
}
