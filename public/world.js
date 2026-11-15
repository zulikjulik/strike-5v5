// 3D-мир: процедурные текстуры, геометрия карты, модели персонажей и оружия.
import * as THREE from 'three';

const { C, T, WEAPONS, SKINS } = window.Shared;
export const U = 1 / 24; // пиксели сервера -> метры
export const TEAM_COL = [0x4ea1ff, 0xff5a5a];

// ---------------------------------------------------------------------
// Текстуры (рисуем на canvas, без внешних файлов)
// ---------------------------------------------------------------------
const texCache = {};
function rnd(a, b) { return a + Math.random() * (b - a); }
function canvasTex(key, size, draw, rx = 1, ry = 1) {
  const k = key + rx + 'x' + ry;
  if (texCache[k]) return texCache[k];
  let base = texCache['__' + key];
  if (!base) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size);
    base = c; texCache['__' + key] = c;
  }
  const t = new THREE.CanvasTexture(base);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache[k] = t; return t;
}
function noise(g, s, n, alpha, light) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`; const r = rnd(1, 3); g.fillRect(Math.random() * s, Math.random() * s, r, r); }
}
const DRAW = {
  plaster(g, s) { g.fillStyle = '#d9cbb0'; g.fillRect(0, 0, s, s); noise(g, s, 2500, 0.08); noise(g, s, 900, 0.1, 1);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,100,70,0.12)'; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(10, 40), rnd(6, 20), rnd(0, 3), 0, 7); g.fill(); }
    g.fillStyle = 'rgba(90,70,50,0.35)'; g.fillRect(0, s - 26, s, 26); noise(g, s, 400, 0.15); },
  brick(g, s) { g.fillStyle = '#6e3b2c'; g.fillRect(0, 0, s, s); const bh = s / 16, bw = s / 4;
    for (let y = 0; y < 16; y++) for (let x = -1; x < 5; x++) { const ox = (y % 2) * bw / 2; g.fillStyle = `hsl(${rnd(8, 18)},${rnd(35, 50)}%,${rnd(30, 40)}%)`; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4); }
    noise(g, s, 1500, 0.12); },
  concrete(g, s) { g.fillStyle = '#8d9096'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.09); noise(g, s, 1500, 0.07, 1);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s / 2 - 2); g.strokeRect(1, s / 2 + 1, s - 2, s / 2 - 2); },
  sandstone(g, s) { g.fillStyle = '#cfae76'; g.fillRect(0, 0, s, s); const bh = s / 6;
    for (let y = 0; y < 6; y++) { const off = (y % 2) * s / 4; for (let x = -1; x < 3; x++) { g.fillStyle = `hsl(${rnd(34, 40)},${rnd(40, 52)}%,${rnd(58, 66)}%)`; g.fillRect(x * s / 2 + off + 2, y * bh + 2, s / 2 - 4, bh - 4); } }
    noise(g, s, 2500, 0.1); },
  wood(g, s) { g.fillStyle = '#7a5232'; g.fillRect(0, 0, s, s); const n = 8;
    for (let i = 0; i < n; i++) { g.fillStyle = `hsl(${rnd(22, 30)},${rnd(35, 45)}%,${rnd(26, 36)}%)`; g.fillRect(i * s / n + 1, 0, s / n - 2, s);
      for (let j = 0; j < 14; j++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); const x = i * s / n + rnd(3, s / n - 3); g.moveTo(x, rnd(0, s)); g.lineTo(x + rnd(-2, 2), rnd(0, s)); g.stroke(); } }
    noise(g, s, 800, 0.1); },
  tiles(g, s) { g.fillStyle = '#b9b4a8'; g.fillRect(0, 0, s, s); const n = 4;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? '#c9c3b5' : '#a9a396'; g.fillRect(x * s / n + 2, y * s / n + 2, s / n - 4, s / n - 4); }
    noise(g, s, 1500, 0.08); },
  crate(g, s) { g.fillStyle = '#9a6b38'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(30,${rnd(40, 50)}%,${rnd(34, 42)}%)`; g.fillRect(0, i * s / 6 + 1, s, s / 6 - 2); }
    g.fillStyle = '#6b4520'; const b = s * 0.09; g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillRect(0, 0, b, s); g.fillRect(s - b, 0, b, s);
    g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.fillRect(-s * 0.7, -b / 2, s * 1.4, b); g.restore();
    noise(g, s, 1200, 0.12); },
  dirt(g, s) { g.fillStyle = '#6f6a45'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `hsla(${rnd(50, 90)},${rnd(20, 40)}%,${rnd(22, 38)}%,0.6)`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 4), rnd(1, 4)); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,100,70,0.25)'; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(6, 26), rnd(4, 14), rnd(0, 3), 0, 7); g.fill(); } },
  sand(g, s) { g.fillStyle = '#d6b57e'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.08); noise(g, s, 2000, 0.08, 1);
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(150,110,60,0.15)'; g.lineWidth = 3; g.beginPath(); const y = rnd(0, s); g.moveTo(0, y); g.bezierCurveTo(s / 3, y + rnd(-15, 15), s * 2 / 3, y + rnd(-15, 15), s, y); g.stroke(); } },
  asphalt(g, s) { g.fillStyle = '#3d3f43'; g.fillRect(0, 0, s, s); noise(g, s, 6000, 0.12); noise(g, s, 2500, 0.06, 1);
    g.fillStyle = 'rgba(220,210,170,0.25)'; g.fillRect(s / 2 - 3, 0, 6, s * 0.4); },
  roof(g, s) { g.fillStyle = '#7d2f22'; g.fillRect(0, 0, s, s); const n = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = `hsl(${rnd(5, 12)},${rnd(45, 55)}%,${rnd(28, 36)}%)`; g.beginPath(); g.arc(x * s / n + (y % 2) * s / n / 2 + s / n / 2, y * s / n + s / n, s / n / 2, Math.PI, 0); g.fill(); }
    noise(g, s, 1000, 0.1); },
  roofFlat(g, s) { g.fillStyle = '#6a6c70'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.1); },
  ceiling(g, s) { g.fillStyle = '#cfc8b8'; g.fillRect(0, 0, s, s); noise(g, s, 2000, 0.06);
    g.fillStyle = 'rgba(80,60,40,0.5)'; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, 8, s); },
  hole(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.35, 'rgba(20,15,10,0.85)'); gr.addColorStop(0.55, 'rgba(60,50,40,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
  blood(g, s) { for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rnd(100, 140)},5,10,${rnd(0.5, 0.9)})`; g.beginPath(); g.arc(s / 2 + rnd(-s / 4, s / 4), s / 2 + rnd(-s / 4, s / 4), rnd(s / 16, s / 6), 0, 7); g.fill(); } },
  soft(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
  flash(g, s) { g.translate(s / 2, s / 2); const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr;
    g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.18 : s * 0.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
};
export function tex(key, rx, ry) { return canvasTex(key, key === 'hole' || key === 'soft' || key === 'flash' || key === 'blood' ? 128 : 256, DRAW[key], rx, ry); }

const THEMES = {
  village: { wall: 'plaster', floorIn: 'wood', ground: 'dirt', groundRep: 30, roof: 'roof', sky: 0x9fc4e8, fog: 0xb9d2ea, sun: 0xfff1d6, hemiG: 0x5d5a3c, trim: 0x5b3b22 },
  desert: { wall: 'sandstone', floorIn: 'tiles', ground: 'sand', groundRep: 26, roof: 'roofFlat', sky: 0xa8cdea, fog: 0xe6d6b8, sun: 0xffe6b8, hemiG: 0x8d7650, trim: 0x8d6e3f },
  city: { wall: 'brick', wall2: 'concrete', floorIn: 'tiles', ground: 'asphalt', groundRep: 20, roof: 'roofFlat', sky: 0x8fa7c0, fog: 0xa3b3c4, sun: 0xf3f0ea, hemiG: 0x3c3f45, trim: 0x2c2f35 },
};

function mat(map, opts = {}) { return new THREE.MeshLambertMaterial(Object.assign({ map }, opts)); }

// ---------------------------------------------------------------------
// Мир карты
// ---------------------------------------------------------------------
export function buildWorld(scene, map, quality) {
  const th = THEMES[map.theme];
  const root = new THREE.Group(); scene.add(root);
  const TL = C.TILE * U, WH = C.WALL_H * U;
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog, 35, 110);

  // свет
  const hemi = new THREE.HemisphereLight(0xdfeaff, th.hemiG, 1.25); root.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, 2.0);
  const cx = map.pw * U / 2, cz = map.ph * U / 2;
  sun.position.set(cx - 30, 45, cz - 20); sun.target.position.set(cx, 0, cz); root.add(sun, sun.target);
  if (quality === 'high') {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  }

  // земля
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.pw * U + 200, map.ph * U + 200), mat(tex(th.ground, th.groundRep + 8, th.groundRep + 8)));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, cz); ground.receiveShadow = true; root.add(ground);

  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H ? T.WALL : map.grid[ty * map.W + tx]);
  const lists = { wall: [], wallB: [], inF: [], lintel: [], winLo: [], winHi: [], crate: [], tall: [], roof: [], ceil: [] };
  const isHouse = (t) => t === T.IN || t === T.DOOR;
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    const t = at(x, y);
    const border = x === 0 || y === 0 || x === map.W - 1 || y === map.H - 1;
    let nearIn = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isHouse(at(x + dx, y + dy)) && at(x + dx, y + dy) === T.IN) nearIn = true;
    if (t === T.WALL) (border ? lists.wallB : lists.wall).push([x, y]);
    if (t === T.IN) { lists.inF.push([x, y]); lists.ceil.push([x, y]); }
    if (t === T.DOOR) { lists.lintel.push([x, y]); lists.inF.push([x, y]); }
    if (t === T.WIN) { lists.winLo.push([x, y]); lists.winHi.push([x, y]); }
    if (t === T.CRATE) lists.crate.push([x, y]);
    if (t === T.TALL) lists.tall.push([x, y]);
    if (!border && (t === T.IN || ((t === T.WALL || t === T.WIN || t === T.DOOR) && nearIn))) lists.roof.push([x, y]);
  }
  function inst(geo, material, cells, y, opts = {}) {
    if (!cells.length) return;
    const m = new THREE.InstancedMesh(geo, material, cells.length);
    const o = new THREE.Object3D();
    cells.forEach(([x, z], i) => { o.position.set((x + 0.5) * TL, y, (z + 0.5) * TL); o.rotation.y = opts.rot ? (Math.floor(Math.random() * 4) * Math.PI) / 2 : 0; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = opts.cast !== false; m.receiveShadow = true; root.add(m); return m;
  }
  const wallMat = mat(tex(th.wall, 1, 1.5));
  const wallMatB = mat(tex(th.wall2 || th.wall, 1, 2.5));
  inst(new THREE.BoxGeometry(TL, WH, TL), wallMat, lists.wall, WH / 2);
  inst(new THREE.BoxGeometry(TL, WH * 1.7, TL), wallMatB, lists.wallB, (WH * 1.7) / 2);
  inst(new THREE.BoxGeometry(TL, 0.02, TL), mat(tex(th.floorIn, 1, 1)), lists.inF, 0.011, { cast: false });
  const lintelH = WH - 53 * U;
  inst(new THREE.BoxGeometry(TL, lintelH, TL), wallMat, lists.lintel, WH - lintelH / 2);
  // дверная рама
  inst(new THREE.BoxGeometry(TL * 0.98, 0.08, TL * 0.98), mat(null, { color: th.trim }), lists.lintel, 53 * U + 0.04);
  const loH = 22 * U, hiH = WH - 50 * U;
  inst(new THREE.BoxGeometry(TL, loH, TL), wallMat, lists.winLo, loH / 2);
  inst(new THREE.BoxGeometry(TL, hiH, TL), wallMat, lists.winHi, WH - hiH / 2);
  inst(new THREE.BoxGeometry(TL * 1.02, 0.06, TL * 1.02), mat(null, { color: th.trim }), lists.winLo, loH + 0.03);
  const crateMat = mat(tex('crate', 1, 1));
  inst(new THREE.BoxGeometry(TL * 0.96, C.CRATE_TOP_M || 26 * U, TL * 0.96), crateMat, lists.crate, (26 * U) / 2, { rot: true });
  inst(new THREE.BoxGeometry(TL * 0.96, 26 * U, TL * 0.96), crateMat, lists.tall, (26 * U) / 2, { rot: true });
  inst(new THREE.BoxGeometry(TL * 0.9, 26 * U, TL * 0.9), crateMat, lists.tall, 26 * U * 1.5, { rot: true });
  // крыши и потолки
  inst(new THREE.BoxGeometry(TL + 0.02, 0.25, TL + 0.02), mat(tex(th.roof, 1, 1)), lists.roof, WH + 0.125);
  inst(new THREE.BoxGeometry(TL, 0.02, TL), mat(tex('ceiling', 1, 1)), lists.ceil, WH - 0.011, { cast: false });
  // лампы под потолком
  const lamps = lists.ceil.filter(([x, y]) => (x + y * 3) % 7 === 0);
  inst(new THREE.BoxGeometry(0.5, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), lamps, WH - 0.05, { cast: false });

  // декор за пределами карты: деревья/холмы/здания, чтобы мир не обрывался
  const decoMat = map.theme === 'city' ? mat(tex('concrete', 2, 6)) : new THREE.MeshLambertMaterial({ color: map.theme === 'desert' ? 0xc9a56c : 0x4f6b3a });
  const trunk = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, rx = cx + Math.cos(a) * (cx + rnd(10, 30)), rz = cz + Math.sin(a) * (cz + rnd(10, 30));
    if (map.theme === 'city') {
      const h = rnd(10, 30), b = new THREE.Mesh(new THREE.BoxGeometry(rnd(6, 12), h, rnd(6, 12)), decoMat); b.position.set(rx, h / 2, rz); root.add(b);
    } else if (map.theme === 'desert') {
      const h = rnd(3, 9), b = new THREE.Mesh(new THREE.ConeGeometry(rnd(6, 14), h, 6), decoMat); b.position.set(rx, h / 2, rz); root.add(b);
    } else {
      const g = new THREE.Group();
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), trunk); t1.position.y = 1.5;
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(rnd(1.8, 2.6), rnd(4, 6), 7), decoMat); c1.position.y = 5;
      g.add(t1, c1); g.position.set(rx, 0, rz); g.scale.setScalar(rnd(0.9, 1.6)); root.add(g);
    }
  }
  return { root, sun };
}

// ---------------------------------------------------------------------
// Модели оружия (вдоль -Z, в метрах)
// ---------------------------------------------------------------------
const gunMats = {};
function gm(color) { return gunMats[color] || (gunMats[color] = new THREE.MeshLambertMaterial({ color })); }
function box(g, w, h, d, x, y, z, color, rx = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm(color)); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }
function cyl(g, r, len, x, y, z, color) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), gm(color)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; }

export function makeGun(wid) {
  const w = WEAPONS[wid] || WEAPONS[0], k = w.key, g = new THREE.Group();
  const BLK = 0x23262b, DRK = 0x15171a, MET = 0x4a4f57, WOOD = 0x7a4a26, WOOD2 = 0x5e3519;
  let len = 0.6;
  if (w.cat === 'knife') {
    box(g, 0.03, 0.035, 0.11, 0, 0, 0.02, 0x2b2e33);
    const b = box(g, 0.008, 0.03, 0.2, 0, 0.005, -0.13, 0xcfd5dd); b.material = new THREE.MeshPhongMaterial({ color: 0xd8dde4, shininess: 90 });
    len = 0.24;
  } else if (w.cat === 'pistol' || w.cat === 'dual') {
    const col = k === 'deagle' ? 0xa0a6ae : BLK, L = k === 'deagle' ? 0.26 : 0.2;
    box(g, 0.035, 0.04, L, 0, 0.02, -L / 2 + 0.03, col);
    box(g, 0.03, 0.11, 0.045, 0, -0.05, 0.02, DRK, -0.25);
    len = L;
  } else if (w.cat === 'smg') {
    const L = k === 'p90' ? 0.5 : k === 'mac10' || k === 'tmp' ? 0.32 : 0.48;
    const col = k === 'p90' ? 0x2f3328 : BLK;
    box(g, 0.05, 0.07, L * 0.6, 0, 0.01, -L * 0.25, col);
    cyl(g, 0.012, L * 0.4, 0, 0.02, -L * 0.75, DRK);
    box(g, 0.035, 0.1, 0.04, 0, -0.06, -0.02, DRK, -0.2);
    if (k !== 'p90') box(g, 0.03, 0.14, 0.035, 0, -0.08, -L * 0.3, DRK, 0.15);
    else box(g, 0.04, 0.025, L * 0.5, 0, 0.055, -L * 0.3, 0x5b6155);
    if (k === 'mp5' || k === 'ump45') box(g, 0.025, 0.04, 0.2, 0, 0.0, 0.12, MET);
    len = L;
  } else if (w.cat === 'shotgun') {
    const L = 0.95, stock = k === 'm3' ? WOOD : BLK;
    box(g, 0.045, 0.08, 0.28, 0, -0.02, 0.18, stock, 0.12);
    box(g, 0.055, 0.075, 0.22, 0, 0.01, -0.06, BLK);
    cyl(g, 0.014, 0.6, 0, 0.03, -0.45, DRK); cyl(g, 0.014, 0.45, 0, -0.005, -0.38, MET);
    box(g, 0.06, 0.06, 0.16, 0, -0.005, -0.32, k === 'm3' ? WOOD2 : 0x33363c);
    box(g, 0.03, 0.1, 0.04, 0, -0.07, 0.03, DRK, -0.3);
    len = L;
  } else if (w.cat === 'rifle' || w.cat === 'sniper' || w.cat === 'mg') {
    const wood = k === 'ak47' || k === 'galil' || k === 'scout';
    const body = k === 'awp' ? 0x3f5f3a : k === 'aug' ? 0x4a5546 : BLK;
    const L = w.cat === 'sniper' ? 1.15 : w.cat === 'mg' ? 1.0 : 0.88;
    box(g, 0.045, 0.09, 0.3, 0, -0.015, 0.2, wood ? WOOD : body, 0.1); // приклад
    box(g, 0.055, 0.085, 0.32, 0, 0.01, -0.08, body); // ствольная коробка
    box(g, 0.05, 0.065, 0.2, 0, 0.005, -0.32, wood ? WOOD2 : MET); // цевьё
    cyl(g, w.cat === 'sniper' ? 0.016 : 0.012, L - 0.42, 0, 0.02, -0.42 - (L - 0.42) / 2, DRK);
    if (k === 'awp') box(g, 0.035, 0.035, 0.07, 0, 0.02, -L + 0.03, DRK);
    box(g, 0.03, 0.1, 0.04, 0, -0.07, -0.01, DRK, -0.3); // рукоять
    if (w.cat === 'mg') box(g, 0.08, 0.12, 0.12, 0, -0.09, -0.12, 0x3b4433);
    else if (k === 'ak47' || k === 'galil') box(g, 0.035, 0.17, 0.05, 0, -0.1, -0.13, DRK, 0.35);
    else if (w.cat === 'sniper') box(g, 0.035, 0.07, 0.06, 0, -0.06, -0.1, DRK);
    else box(g, 0.035, 0.15, 0.05, 0, -0.09, -0.13, DRK, 0.12);
    if (w.scope) { cyl(g, w.cat === 'sniper' ? 0.026 : 0.02, w.cat === 'sniper' ? 0.32 : 0.16, 0, 0.085, -0.12, 0x111316); box(g, 0.015, 0.03, 0.02, 0, 0.06, -0.06, DRK); box(g, 0.015, 0.03, 0.02, 0, 0.06, -0.2, DRK); }
    if (k === 'm4a1') box(g, 0.02, 0.04, 0.16, 0, 0.07, -0.08, BLK);
    len = L;
  }
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -len);
  g.userData.len = len;
  return g;
}

// ---------------------------------------------------------------------
// Персонаж (низкополигональный человек)
// ---------------------------------------------------------------------
const charMats = {};
function cm(color, emissive) { const k = color + '_' + (emissive || 0); return charMats[k] || (charMats[k] = new THREE.MeshLambertMaterial({ color, emissive: emissive || 0 })); }
function part(parent, w, h, d, color, x, y, z, emissive) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cm(color, emissive)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function col(hex) { return new THREE.Color(hex).getHex(); }

export function makeCharacter(skinId, team, wid) {
  const s = SKINS[skinId] || SKINS[0], fem = s.female;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const sc = fem ? 0.94 : 1;
  body.scale.setScalar(sc);
  const tw = fem ? 0.36 : 0.46;
  // ноги
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * (fem ? 0.09 : 0.11), 0.86, 0); body.add(hip);
    part(hip, 0.16, 0.5, 0.18, col(s.vest), 0, -0.25, 0);
    part(hip, 0.15, 0.36, 0.16, col(s.vest), 0, -0.62, 0);
    part(hip, 0.16, 0.1, 0.26, col(s.boots), 0, -0.82, -0.04);
    legs.push(hip);
  }
  // корпус
  const torso = new THREE.Group(); torso.position.y = 0.86; body.add(torso);
  part(torso, tw, 0.6, 0.25, col(s.shirt), 0, 0.3, 0);
  part(torso, tw + 0.03, 0.4, 0.28, col(s.vest), 0, 0.33, 0);
  if (fem) part(torso, tw + 0.04, 0.16, 0.26, col(s.vest), 0, 0.02, 0);
  part(torso, tw + 0.02, 0.06, 0.27, 0x2b2620, 0, 0.02, 0); // ремень
  // верх (вращается по питчу): голова, руки, оружие
  const upper = new THREE.Group(); upper.position.y = 1.35; body.add(upper);
  const head = new THREE.Group(); head.position.y = 0.26; upper.add(head);
  part(head, 0.07, 0.08, 0.07, col(s.skin), 0, -0.1, 0); // шея
  part(head, 0.22, 0.25, 0.24, col(s.skin), 0, 0.04, 0);
  part(head, 0.04, 0.03, 0.01, 0x1a1a1a, -0.05, 0.07, -0.121); part(head, 0.04, 0.03, 0.01, 0x1a1a1a, 0.05, 0.07, -0.121);
  switch (s.hat) {
    case 'helmet': part(head, 0.26, 0.13, 0.28, col(s.hatColor), 0, 0.15, 0.01); part(head, 0.27, 0.03, 0.29, col(s.hatColor), 0, 0.09, 0.01); break;
    case 'cap': part(head, 0.235, 0.08, 0.25, col(s.hatColor), 0, 0.17, 0.01); part(head, 0.2, 0.02, 0.12, col(s.hatColor), 0, 0.13, -0.17); break;
    case 'beanie': part(head, 0.24, 0.12, 0.26, col(s.hatColor), 0, 0.15, 0.01); break;
    case 'mask': part(head, 0.235, 0.27, 0.255, col(s.hatColor), 0, 0.045, 0.003); part(head, 0.16, 0.03, 0.01, 0xe74c3c, 0, 0.07, -0.132); break;
    default:
      part(head, 0.235, 0.07, 0.255, col(s.hair), 0, 0.17, 0.01);
      part(head, 0.235, 0.2, 0.06, col(s.hair), 0, 0.06, 0.1);
      if (fem) { part(head, 0.24, 0.24, 0.07, col(s.hair), 0, 0.0, 0.1); part(head, 0.03, 0.2, 0.2, col(s.hair), -0.12, 0.02, 0.02); part(head, 0.03, 0.2, 0.2, col(s.hair), 0.12, 0.02, 0.02); part(head, 0.08, 0.26, 0.08, col(s.hair), 0, -0.12, 0.17); }
  }
  // плечи + повязки команды
  const tcol = TEAM_COL[team] ?? 0x888888;
  const arms = new THREE.Group(); upper.add(arms);
  const gun = makeGun(wid); gun.position.set(0.1, -0.08, -0.22); arms.add(gun);
  const shR = new THREE.Vector3(tw / 2, 0.02, 0), shL = new THREE.Vector3(-tw / 2, 0.02, 0);
  const hR = new THREE.Vector3(0.1, -0.13, -0.2), hL = new THREE.Vector3(0.08, -0.08, -0.22 - Math.min(0.45, gun.userData.len * 0.45));
  const W2 = WEAPONS[wid];
  if (W2 && (W2.cat === 'pistol' || W2.cat === 'dual' || W2.cat === 'knife')) hL.set(0.02, -0.14, -0.24);
  for (const [a, b] of [[shR, hR], [shL, hL]]) {
    const mid = a.clone().lerp(b, 0.45);
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, a.distanceTo(b)), cm(col(s.shirt))); g1.castShadow = true;
    g1.position.copy(a).add(b).multiplyScalar(0.5); arms.add(g1);
    g1.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0)));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.06), cm(tcol, tcol)); band.position.copy(a.clone().lerp(b, 0.2)); band.quaternion.copy(g1.quaternion); arms.add(band);
    part(arms, 0.08, 0.08, 0.08, col(s.skin), b.x, b.y, b.z);
    void mid;
  }
  // нашивка команды на спине
  part(torso, 0.18, 0.12, 0.01, tcol, 0, 0.42, 0.145, tcol);
  root.userData = { legs, upper, head, body, gun, wid, skin: skinId, team, phase: 0, deadT: 0 };
  return root;
}

// Поза персонажа каждый кадр
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
  if (!o.alive) {
    u.deadT = Math.min(1, u.deadT + dt * 2.5);
    u.body.rotation.x = (u.deadT * Math.PI) / 2; u.body.position.y = -0.0; u.body.position.z = u.deadT * 0.5;
  } else if (u.deadT) { u.deadT = 0; u.body.rotation.x = 0; u.body.position.z = 0; }
}
