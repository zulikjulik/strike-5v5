// Модели: оружие (силуэты-профили с фасками, металл с отражениями), ножи, руки с перчатками,
// персонажи с округлыми формами и анимацией смерти, раскраски оружия и перчаток.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { part, merge } from './world.js';

const { WEAPONS, SKINS, FINISHES } = window.Shared;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------
// Окружение для отражений металла (своё для каждого рендерера)
// ---------------------------------------------------------------------
const envCache = new WeakMap();
export function envFor(renderer) {
  let t = envCache.get(renderer);
  if (!t) { const pm = new THREE.PMREMGenerator(renderer); t = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); envCache.set(renderer, t); }
  return t;
}

// ---------------------------------------------------------------------
// Материалы по типу поверхности (цвет берётся из вершин)
// ---------------------------------------------------------------------
const KIND = {
  steel: { metalness: 0.82, roughness: 0.34 },
  dark: { metalness: 0.65, roughness: 0.42 },
  poly: { metalness: 0.04, roughness: 0.6 },
  wood: { metalness: 0.0, roughness: 0.46 },
  alu: { metalness: 0.92, roughness: 0.2 },
  brass: { metalness: 1.0, roughness: 0.26 },
  rubber: { metalness: 0.0, roughness: 0.88 },
  blade: { metalness: 1.0, roughness: 0.12 },
  cloth: { metalness: 0.0, roughness: 0.95 },
  skin: { metalness: 0.0, roughness: 0.62 },
  leather: { metalness: 0.0, roughness: 0.55 },
};
const matCache = {};
export function kindMat(k) { return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, KIND[k] || KIND.poly))); }
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x223a5a, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1 });

// Геометрии-заготовки
const geoC = {};
const cylG = (seg) => geoC['c' + seg] || (geoC['c' + seg] = new THREE.CylinderGeometry(1, 1, 1, seg).toNonIndexed());
const BOXG = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const sphG = (w, h) => geoC['s' + w + h] || (geoC['s' + w + h] = new THREE.SphereGeometry(1, w, h).toNonIndexed());
const capG = (r, l, cs = 4, rs = 10) => { const k = `cap${r}_${l}_${cs}_${rs}`; return geoC[k] || (geoC[k] = new THREE.CapsuleGeometry(r, l, cs, rs).toNonIndexed()); };
function nonIdx(g) { return g.index ? g.toNonIndexed() : g; }
function mkShape(pts) {
  const s = new THREE.Shape(); let first = true;
  for (const q of pts) {
    if (q[0] === 'q') s.quadraticCurveTo(q[1], q[2], q[3], q[4]);
    else if (first) { s.moveTo(q[0], q[1]); first = false; } else s.lineTo(q[0], q[1]);
  }
  return s;
}
// Профиль (x = вперёд, y = вверх), выдавленный на ширину w, с фаской
function extr(pts, w, bevel = 0.0022, holes) {
  const sh = mkShape(pts); if (holes) for (const h of holes) sh.holes.push(mkShape(h));
  const bt = Math.min(bevel, w * 0.3);
  const d = Math.max(0.0004, w - 2 * bt);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: 2, curveSegments: 7 });
  geo.translate(0, 0, -d / 2);
  const g = nonIdx(geo); const uv = g.attributes.uv; for (let i = 0; i < uv.array.length; i++) uv.array[i] *= 4;
  return g;
}
function latheG(pts, seg = 20) { const g = nonIdx(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg)); return g; }

// ---------------------------------------------------------------------
// Раскраски оружия
// ---------------------------------------------------------------------
function blobs(g, s, n, cols, rmin, rmax) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(rmin, rmax), rnd(rmin, rmax) * 0.7, rnd(0, 3), 0, 7); g.fill(); } }
function speck(g, s, n, col, a) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillRect(rnd(0, s), rnd(0, s), rnd(0.5, 2), rnd(0.5, 2)); } g.globalAlpha = 1; }
function hexPath(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
function drawFinish(f, g, s) {
  const [c0, c1, c2] = f.c;
  switch (f.p) {
    case 'camo': g.fillStyle = c0; g.fillRect(0, 0, s, s); blobs(g, s, 34, [c1, c2, c1], 14, 40); blobs(g, s, 18, [c0], 6, 18); speck(g, s, 900, '#000', 0.15); break;
    case 'tiger': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = c1; for (let i = 0; i < 16; i++) { const y = i * s / 15 + rnd(-6, 6); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + rnd(-22, 22), s * 0.6, y + rnd(-22, 22), s * rnd(0.55, 1.05), y + rnd(-10, 10)); g.bezierCurveTo(s * 0.5, y + rnd(4, 12), s * 0.25, y + rnd(4, 12), 0, y + rnd(5, 12)); g.fill(); } break; }
    case 'carbon': for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const gr = g.createLinearGradient(x * 8, y * 8, x * 8 + ((x + y) % 2 ? 8 : 0), y * 8 + ((x + y) % 2 ? 0 : 8)); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(x * 8, y * 8, 8, 8); } g.fillStyle = c2; g.fillRect(0, s * 0.46, s, 5); g.fillRect(0, s * 0.54, s, 2); break;
    case 'fade': case 'gold': { const gr = g.createLinearGradient(0, s, s, 0); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); if (f.p === 'gold') { for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.2)})`; g.lineWidth = rnd(0.5, 2); g.beginPath(); const y = rnd(0, s); g.moveTo(0, y); g.lineTo(s, y + rnd(-4, 4)); g.stroke(); } } else speck(g, s, 600, '#fff', 0.12); break; }
    case 'doppler': { g.fillStyle = c1; g.fillRect(0, 0, s, s); for (let i = 0; i < 26; i++) { const x = rnd(0, s), y = rnd(0, s), r = rnd(20, 70); const gr = g.createRadialGradient(x, y, 0, x, y, r); const c = i % 2 ? c0 : c2; gr.addColorStop(0, c); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } speck(g, s, 400, '#fff', 0.5); break; }
    case 'neon': { g.fillStyle = c0; g.fillRect(0, 0, s, s); g.lineCap = 'round'; for (let i = 0; i < 14; i++) { const col = i % 2 ? c1 : c2; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.lineWidth = rnd(2, 5); g.beginPath(); let x = rnd(0, s), y = 0; g.moveTo(x, y); while (y < s) { x += rnd(-30, 30); y += rnd(20, 50); g.lineTo(x, y); } g.stroke(); } g.shadowBlur = 0; break; }
    case 'hex': { g.fillStyle = c2; g.fillRect(0, 0, s, s); const r = 14; for (let y = -1; y < s / (r * 1.5) + 1; y++) for (let x = -1; x < s / (r * 1.73) + 1; x++) { hexPath(g, x * r * 1.732 + (y % 2) * r * 0.866, y * r * 1.5, r - 1.5); g.fillStyle = [c0, c1, c0][Math.floor(rnd(0, 3))]; g.fill(); } break; }
    case 'snow': { g.fillStyle = c0; g.fillRect(0, 0, s, s); for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? c1 : c2; const x = Math.floor(rnd(0, 32)) * 8, y = Math.floor(rnd(0, 32)) * 8; g.fillRect(x, y, 8 * Math.ceil(rnd(0.5, 3)), 8 * Math.ceil(rnd(0.5, 2))); } break; }
    case 'dragon': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); for (let y = 0; y < 18; y++) for (let x = 0; x < 13; x++) { const px = x * 22 + (y % 2) * 11, py = y * 15; const sg = g.createRadialGradient(px, py - 6, 1, px, py, 13); sg.addColorStop(0, c1); sg.addColorStop(0.7, c1 + '88'); sg.addColorStop(1, '#00000000'); g.fillStyle = sg; g.beginPath(); g.arc(px, py, 11, 0, Math.PI); g.fill(); g.strokeStyle = c2; g.lineWidth = 1.2; g.stroke(); } break; }
    case 'galaxy': { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); for (let i = 0; i < 14; i++) { const x = rnd(0, s), y = rnd(0, s), r = rnd(40, 120); const gr = g.createRadialGradient(x, y, 0, x, y, r); const c = [c0, c1, c2][i % 3]; gr.addColorStop(0, c + 'cc'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, s, s); } for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.15 ? c2 : '#ffffff'; const r = Math.random() < 0.05 ? 2.2 : rnd(0.4, 1.2); g.beginPath(); g.arc(rnd(0, s), rnd(0, s), r, 0, 7); g.fill(); } break; }
    case 'marble': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(0.5, c2); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, s, s); for (let i = 0; i < 18; i++) { g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.55)' : c1; g.lineWidth = rnd(0.6, 3); g.beginPath(); let x = rnd(0, s), y = 0; g.moveTo(x, y); while (y < s) { x += rnd(-16, 16); y += rnd(8, 18); g.lineTo(x, y); } g.stroke(); } break; }
    case 'lava': { g.fillStyle = c0; g.fillRect(0, 0, s, s); blobs(g, s, 30, ['#00000055', '#ffffff10'], 10, 30); for (let i = 0; i < 22; i++) { g.strokeStyle = i % 3 ? c1 : c2; g.shadowColor = c1; g.shadowBlur = 12; g.lineWidth = rnd(1.5, 4); g.beginPath(); let x = rnd(0, s), y = rnd(0, s); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); } g.shadowBlur = 0; break; }
    case 'circuit': { g.fillStyle = c0; g.fillRect(0, 0, s, s); g.lineWidth = 2; g.shadowColor = c1; g.shadowBlur = 6; for (let i = 0; i < 40; i++) { g.strokeStyle = i % 4 ? c1 : c2; let x = Math.floor(rnd(0, 16)) * 16 + 8, y = Math.floor(rnd(0, 16)) * 16 + 8; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { if (Math.random() < 0.5) x += (Math.random() < 0.5 ? -1 : 1) * 16 * Math.ceil(rnd(0, 3)); else y += (Math.random() < 0.5 ? -1 : 1) * 16 * Math.ceil(rnd(0, 3)); g.lineTo(x, y); } g.stroke(); g.fillStyle = c2; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); } g.shadowBlur = 0; break; }
    case 'geo': { g.fillStyle = c0; g.fillRect(0, 0, s, s); for (let i = 0; i < 16; i++) { g.fillStyle = [c1, c2, c0, c1][i % 4]; g.beginPath(); g.moveTo(rnd(0, s), rnd(0, s)); g.lineTo(rnd(0, s), rnd(0, s)); g.lineTo(rnd(0, s), rnd(0, s)); g.closePath(); g.fill(); } g.fillStyle = c2; g.fillRect(0, s * 0.62, s, 10); g.fillStyle = c1; g.fillRect(0, s * 0.68, s, 4); g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif'; g.fillText('R-7', s * 0.1, s * 0.4); break; }
    case 'comic': { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.fillStyle = c2; for (let y = 0; y < s; y += 8) for (let x = (y / 8) % 2 * 4; x < s; x += 8) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } for (let i = 0; i < 18; i++) { g.fillStyle = [c0, c1, c2][i % 3]; g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(14, 40), rnd(10, 26), rnd(0, 3), 0, 7); g.fill(); g.stroke(); } g.fillStyle = '#111'; g.font = 'bold 34px sans-serif'; g.fillText('POW!', s * 0.2, s * 0.6); break; }
    case 'chrome': { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c1); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.7, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fillRect(0, 0, s, s); break; }
    default: g.fillStyle = c0; g.fillRect(0, 0, s, s);
  }
}
const finCache = {};
export function finishMaterial(fid) {
  if (finCache[fid]) return finCache[fid];
  const f = FINISHES[fid]; if (!f) return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  drawFinish(f, g, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = 4;
  const P = { gold: [1, 0.18, 1], chrome: [1, 0.05, 1], doppler: [0.75, 0.16, 1], fade: [0.55, 0.22, 1], marble: [0.4, 0.2, 1], carbon: [0.35, 0.32, 0.6], neon: [0.2, 0.35, 0.8], lava: [0.2, 0.5, 0.3], circuit: [0.3, 0.35, 0.7], galaxy: [0.35, 0.25, 1], dragon: [0.3, 0.3, 0.8], comic: [0.05, 0.45, 0.6] }[f.p] || [0.15, 0.48, 0.3];
  const m = new THREE.MeshPhysicalMaterial({ map: t, metalness: P[0], roughness: P[1], clearcoat: P[2], clearcoatRoughness: 0.12 });
  if (f.p === 'neon' || f.p === 'lava' || f.p === 'circuit' || f.p === 'galaxy') { m.emissiveMap = t; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = f.p === 'galaxy' ? 0.3 : 0.6; }
  return (finCache[fid] = m);
}

// Текстура перчаток
const gloveCache = {};
export function gloveMaterial(fid) {
  const key = fid == null || fid < 0 ? 'def' : fid;
  if (gloveCache[key]) return gloveCache[key];
  const f = FINISHES[fid];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), s = 256;
  if (!f) { g.fillStyle = '#4a4636'; g.fillRect(0, 0, s, s); g.fillStyle = '#5c5844'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 44 + 10, s, 14); g.fillStyle = '#2b2a22'; for (let i = 0; i < 4; i++) g.fillRect(i * 64 + 28, 0, 6, s); speck(g, s, 1500, '#000', 0.3); }
  else {
    const [c0, c1, c2] = f.c;
    switch (f.model) {
      case 'sport': g.fillStyle = c0; g.fillRect(0, 0, s, s); g.fillStyle = c1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 70); g.lineTo(s, i * 70 + 40); g.lineTo(s, i * 70 + 64); g.lineTo(0, i * 70 + 24); g.fill(); } g.fillStyle = c2; for (let i = 0; i < 4; i++) g.fillRect(0, i * 64 + 30, s, 5); break;
      case 'driver': g.fillStyle = c0; g.fillRect(0, 0, s, s); g.fillStyle = c2; for (let y = 6; y < s; y += 12) for (let x = (y / 12) % 2 * 6 + 6; x < s; x += 12) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } g.strokeStyle = c1; g.lineWidth = 3; g.setLineDash([6, 5]); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, i * 56 + 20); g.lineTo(s, i * 56 + 20); g.stroke(); } g.setLineDash([]); break;
      case 'wraps': g.fillStyle = c0; g.fillRect(0, 0, s, s); for (let i = 0; i < 16; i++) { g.fillStyle = i % 4 === 0 ? c1 : 'rgba(0,0,0,0.12)'; g.save(); g.translate(0, i * 18); g.rotate(-0.12); g.fillRect(-20, 0, s + 40, i % 4 === 0 ? 6 : 1.5); g.restore(); } speck(g, s, 1200, c2, 0.25); break;
      case 'moto': g.fillStyle = c2; g.fillRect(0, 0, s, s); g.fillStyle = c0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.roundRect(x * 64 + 6, y * 64 + 6, 52, 52, 12); g.fill(); } g.strokeStyle = c1; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 64 + 32); g.lineTo(s, i * 64 + 32); g.stroke(); } break;
      case 'hydra': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); for (let y = 0; y < 24; y++) for (let x = 0; x < 18; x++) { const px = x * 15 + (y % 2) * 7.5, py = y * 11; g.fillStyle = Math.random() < 0.2 ? c1 : c0; g.strokeStyle = c1; g.lineWidth = 1; g.beginPath(); g.ellipse(px, py, 7, 5, 0, 0, 7); g.fill(); g.stroke(); } break; }
      case 'specialist': { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, c0); gr.addColorStop(0.6, c0); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = c1; g.lineWidth = 2; for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + s, s); g.stroke(); g.beginPath(); g.moveTo(i * 24 + s, 0); g.lineTo(i * 24, s); g.stroke(); } break; }
      default: g.fillStyle = c0; g.fillRect(0, 0, s, s);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: f && f.model === 'driver' ? 0.45 : 0.72, metalness: 0.02 });
  return (gloveCache[key] = m);
}

// ---------------------------------------------------------------------
// Оружие. Координаты деталей: f — вперёд (к дулу), y — вверх, x — вправо.
// Ось ствола винтовок на высоте 0.022, рукоять у начала координат.
// ---------------------------------------------------------------------
const CL = { BLK: 0x1d1f22, DRK: 0x121315, MET: 0x2f3338, STEEL: 0x8b929b, ALU: 0xc5cbd2, WOOD: 0x7a4824, WOOD2: 0x5a3216, TAN: 0xb59b6a, OD: 0x4d5a3c, POLY: 0x232528, BRASS: 0xc9a227, RUB: 0x1b1c1e, GREY: 0x4a4f55, GREEN: 0x3f4a35 };
function GB(hasFin) {
  const P = { main: [], mag: [], slide: [] };
  let G = 'main';
  const o = {
    P,
    to(g) { G = g; return o; },
    add(k, fin, p) { P[G].push({ key: fin && hasFin ? 'FIN' : k, p }); return o; },
    prof(k, fin, col, pts, w, x = 0, holes, bev) { return o.add(k, fin, part(extr(pts, w, bev, holes), col, x, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0)); },
    cyl(k, fin, col, r, f0, f1, y, x = 0, seg = 18) { return o.add(k, fin, part(cylG(seg), col, x, y, -(f0 + f1) / 2, r, Math.abs(f1 - f0), r, Math.PI / 2, 0, 0)); },
    cylX(k, fin, col, r, len, f, y, x = 0, seg = 14) { return o.add(k, fin, part(cylG(seg), col, x, y, -f, r, len, r, 0, 0, Math.PI / 2)); },
    cylY(k, fin, col, r, len, f, y, x = 0, seg = 14) { return o.add(k, fin, part(cylG(seg), col, x, y, -f, r, len, r)); },
    box(k, fin, col, w, h, f0, f1, y, x = 0, rx = 0) { return o.add(k, fin, part(BOXG, col, x, y, -(f0 + f1) / 2, w, h, Math.abs(f1 - f0), rx, 0, 0)); },
    sph(k, fin, col, r, f, y, x = 0) { return o.add(k, fin, part(sphG(12, 8), col, x, y, -f, r, r, r)); },
    lathe(k, fin, col, pts, f0, y, x = 0, seg = 22) { return o.add(k, fin, part(latheG(pts, seg), col, x, y, -f0, 1, 1, 1, -Math.PI / 2, 0, 0)); },
    rail(f0, f1, y, x = 0, w = 0.021) { o.box('dark', false, CL.DRK, w, 0.007, f0, f1, y, x); for (let f = f0 + 0.004; f < f1 - 0.004; f += 0.01) o.box('dark', false, CL.DRK, w + 0.003, 0.004, f, f + 0.005, y + 0.005, x); return o; },
  };
  return o;
}
const S_ = (pts, k) => pts.map((q) => (q[0] === 'q' ? ['q', q[1] * k, q[2] * k, q[3] * k, q[4] * k] : [q[0] * k, q[1] * k]));
const SX = (pts, dx, dy = 0) => pts.map((q) => (q[0] === 'q' ? ['q', q[1] + dx, q[2] + dy, q[3] + dx, q[4] + dy] : [q[0] + dx, q[1] + dy]));

// рукоять в стиле AR: верх задней кромки у (f, y)
function arGrip(o, f, y, col = CL.POLY, k = 'poly', fin = false, w = 0.03) {
  o.prof(k, fin, col, [[f + 0.006, y], [f - 0.004, y - 0.03], ['q', f - 0.01, y - 0.062, f - 0.022, y - 0.094], ['q', f - 0.028, y - 0.106, f - 0.044, y - 0.104], [f - 0.058, y - 0.1], ['q', f - 0.05, y - 0.06, f - 0.036, y - 0.004], [f - 0.03, y]], w);
  for (let i = 0; i < 3; i++) o.box('poly', false, CL.DRK, w + 0.002, 0.002, f - 0.03 - i * 0.004, f - 0.012 - i * 0.004, y - 0.035 - i * 0.02);
}
// спусковая скоба и крючок
function guard(o, f0, f1, y, col = CL.MET) {
  const L = f1 - f0;
  o.prof('dark', false, col, [[f0, y], [f1, y], [f1, y - 0.006], ['q', f1, y - 0.032, f1 - 0.012, y - 0.034], [f0 + 0.005, y - 0.036], [f0, y - 0.03]], 0.011, 0, [[[f0 + 0.005, y - 0.006], [f1 - 0.005, y - 0.006], ['q', f1 - 0.005, y - 0.027, f1 - 0.013, y - 0.028], [f0 + 0.008, y - 0.03]]], 0.0015);
  o.prof('steel', false, CL.BLK, [[f0 + L * 0.42, y - 0.004], [f0 + L * 0.52, y - 0.004], ['q', f0 + L * 0.54, y - 0.02, f0 + L * 0.4, y - 0.026], [f0 + L * 0.38, y - 0.022]], 0.006, 0, null, 0.001);
}
// изогнутый магазин: верх f0..f1 на высоте y0, опускается на drop и уходит вперёд на curve
function curvedMag(o, f0, f1, y0, drop, curve, w = 0.028, col = CL.DRK, k = 'dark', fin = false) {
  o.prof(k, fin, col, [[f0, y0], [f1, y0], ['q', f1 + curve * 0.25, y0 - drop * 0.55, f1 + curve, y0 - drop], [f0 + curve + 0.004, y0 - drop - 0.012], ['q', f0 + curve * 0.22, y0 - drop * 0.5, f0, y0]], w);
  for (let i = 1; i < 4; i++) { const t = i / 4, fc = (f0 + f1) / 2 + curve * t * t, yc = y0 - drop * t; o.box(k, false, col, w + 0.002, 0.003, fc - 0.012, fc + 0.012, yc); }
  o.box('dark', false, CL.BLK, w + 0.004, 0.008, f0 + curve - 0.004, f1 + curve + 0.004, y0 - drop - 0.006);
}
// пистолет: рамка с рукоятью и скобой (scale — общий масштаб)
function pistolFrame(o, k, fin, col, f1, gk, gfin, gcol, sc = 1, x = 0) {
  o.prof(k, fin, col, S_([[-0.06, 0.006], [f1 / sc, 0.006], [f1 / sc, -0.012], [0.062, -0.014], ['q', 0.062, -0.05, 0.045, -0.052], [0.008, -0.052], [-0.004, -0.024], [-0.058, -0.012]], sc), 0.028 * sc, x, [S_([[0.05, -0.018], [0.05, -0.044], ['q', 0.048, -0.047, 0.042, -0.047], [0.008, -0.047], [0.004, -0.022]], sc)]);
  o.prof(gk, gfin, gcol, S_([[-0.004, -0.02], ['q', -0.01, -0.06, -0.026, -0.112], [-0.03, -0.126], [-0.072, -0.13], ['q', -0.074, -0.1, -0.064, -0.05], [-0.06, -0.012], ['q', -0.074, -0.002, -0.068, 0.004], [-0.05, 0.004]], sc), 0.031 * sc, x);
  for (let i = 0; i < 5; i++) o.box(gk, false, CL.DRK, 0.032 * sc, 0.0018, (-0.06 + i * 0.004) * sc, (-0.03 + i * 0.002) * sc, (-0.05 - i * 0.014) * sc, x);
  o.prof('steel', false, CL.BLK, S_([[0.03, -0.018], [0.036, -0.018], ['q', 0.038, -0.034, 0.028, -0.042], [0.026, -0.04], ['q', 0.031, -0.032, 0.029, -0.018]], sc), 0.006, x, null, 0.001);
}
function pistolMag(o, sc = 1, x = 0, col = CL.DRK) {
  o.to('mag');
  o.prof('dark', false, col, S_([[-0.012, -0.03], ['q', -0.018, -0.07, -0.027, -0.118], [-0.029, -0.134], [-0.076, -0.137], [-0.073, -0.122], ['q', -0.064, -0.07, -0.054, -0.03]], sc), 0.024 * sc, x);
  o.box('dark', false, CL.BLK, 0.03 * sc, 0.006, -0.078 * sc, -0.028 * sc, -0.135 * sc, x);
  o.to('main');
}
// затвор пистолета в своих координатах (центр в нуле)
function slideG(o, L, h, w, col, k, fin, op = {}) {
  const a = L / 2, b = h / 2, r = op.round ?? 0.006, x = op.x || 0;
  const pts = op.slant ? [[-a, -b], [a - 0.004, -b], [a, b - 0.016], [a - 0.012, b], [-a + r, b], ['q', -a, b, -a, b - r]]
    : op.open ? [[-a, -b], [a, -b], [a, b * 0.1], [a - 0.07, b * 0.1], ['q', a - 0.074, b, a - 0.085, b], [-a + r, b], ['q', -a, b, -a, b - r]]
      : [[-a, -b], [a, -b], [a, b - r], ['q', a, b, a - r, b], [-a + r, b], ['q', -a, b, -a, b - r]];
  o.prof(k, fin, col, pts, w, x, null, 0.0025);
  for (let i = 0; i < (op.serr ?? 6); i++) o.box('dark', false, CL.DRK, w + 0.0016, h * 0.7, -a + 0.008 + i * 0.0058, -a + 0.0102 + i * 0.0058, -b * 0.12, x);
  o.box('dark', false, CL.DRK, 0.004, 0.006, a - 0.014, a - 0.006, b + 0.003, x);
  o.box('dark', false, CL.DRK, 0.016, 0.007, -a + 0.004, -a + 0.015, b + 0.0035, x);
  o.box('dark', false, CL.DRK, 0.0016, h * 0.42, -0.006, 0.032, b * 0.12, x + w / 2 + 0.0006);
  if (op.open) o.cyl('steel', false, CL.STEEL, 0.0062, a - 0.075, a + 0.002, b * 0.1 + 0.002, x);
  o.cyl('dark', false, 0x050505, 0.0048, a - 0.002, a + 0.0012, op.open ? b * 0.1 + 0.002 : -b * 0.15, x, 12);
}
function hammer(o, f, y, x = 0) { o.prof('steel', false, CL.MET, [[f, y], [f - 0.006, y + 0.006], [f - 0.014, y + 0.008], [f - 0.012, y + 0.002], [f - 0.004, y - 0.004]], 0.008, x, null, 0.001); }

const GUNS = {
  glock(o, d) {
    pistolFrame(o, 'poly', true, CL.POLY, 0.15, 'poly', true, CL.POLY);
    o.rail(0.09, 0.148, -0.019, 0, 0.022);
    o.to('slide'); slideG(o, 0.19, 0.034, 0.03, CL.BLK, 'dark', true, { serr: 6 }); o.to('main');
    pistolMag(o);
    Object.assign(d, { slidePos: [0, 0.022, -0.06], len: 0.155, grip: [0, -0.06, 0.038], gripRx: -0.32, fore: 'pistol' });
  },
  usp(o, d) {
    pistolFrame(o, 'poly', true, CL.BLK, 0.16, 'poly', true, CL.BLK, 1.04);
    o.rail(0.1, 0.158, -0.02, 0, 0.022);
    o.to('slide'); slideG(o, 0.205, 0.036, 0.032, CL.BLK, 'dark', true, { serr: 7 }); o.to('main');
    o.cyl('dark', false, CL.DRK, 0.0085, 0.16, 0.175, 0.024);
    o.lathe('dark', true, CL.MET, [[0, 0], [0.015, 0], [0.0175, 0.004], [0.0175, 0.17], [0.0158, 0.176], [0.006, 0.176], [0, 0.176]], 0.168, 0.024);
    for (let i = 0; i < 3; i++) o.cyl('dark', false, CL.DRK, 0.0181, 0.19 + i * 0.05, 0.193 + i * 0.05, 0.024);
    pistolMag(o, 1.04);
    Object.assign(d, { slidePos: [0, 0.024, -0.0625], len: 0.345, sil: true, grip: [0, -0.062, 0.04], gripRx: -0.32, fore: 'pistol' });
  },
  p228(o, d) {
    pistolFrame(o, 'dark', true, CL.MET, 0.14, 'wood', false, CL.WOOD2);
    o.to('slide'); slideG(o, 0.18, 0.034, 0.031, CL.BLK, 'dark', true, { serr: 5 }); o.to('main');
    hammer(o, -0.058, 0.012);
    pistolMag(o);
    Object.assign(d, { slidePos: [0, 0.023, -0.055], len: 0.145, grip: [0, -0.06, 0.038], gripRx: -0.32, fore: 'pistol' });
  },
  fiveseven(o, d) {
    pistolFrame(o, 'poly', true, 0x434a43, 0.158, 'poly', true, 0x434a43);
    o.rail(0.095, 0.155, -0.019, 0, 0.022);
    o.to('slide'); slideG(o, 0.205, 0.03, 0.029, 0x363c36, 'dark', true, { serr: 0, slant: true }); for (let i = 0; i < 4; i++) o.box('dark', false, CL.DRK, 0.03, 0.022, 0.06 + i * 0.008, 0.063 + i * 0.008, 0); o.to('main');
    pistolMag(o);
    Object.assign(d, { slidePos: [0, 0.021, -0.0625], len: 0.165, grip: [0, -0.06, 0.038], gripRx: -0.3, fore: 'pistol' });
  },
  deagle(o, d) {
    pistolFrame(o, 'alu', true, CL.ALU, 0.19, 'rubber', false, CL.RUB, 1.15);
    o.to('slide'); slideG(o, 0.27, 0.05, 0.042, CL.ALU, 'alu', true, { serr: 8 });
    o.box('alu', true, CL.ALU, 0.022, 0.008, -0.13, 0.135, 0.028); for (let i = 0; i < 12; i++) o.box('dark', false, CL.GREY, 0.023, 0.002, -0.12 + i * 0.022, -0.115 + i * 0.022, 0.032);
    o.to('main');
    hammer(o, -0.069, 0.016);
    pistolMag(o, 1.15);
    Object.assign(d, { slidePos: [0, 0.03, -0.075], len: 0.215, grip: [0, -0.068, 0.044], gripRx: -0.32, fore: 'pistol' });
  },
  elite(o, d) {
    for (const x of [-0.12, 0.12]) {
      pistolFrame(o, 'alu', true, CL.ALU, 0.13, 'rubber', false, CL.RUB, 1, x);
      o.to('slide'); slideG(o, 0.2, 0.032, 0.03, CL.ALU, 'alu', true, { open: true, serr: 5, x }); o.to('main');
      hammer(o, -0.058, 0.012, x);
      pistolMag(o, 1, x);
    }
    Object.assign(d, { slidePos: [0, 0.02, -0.07], len: 0.17, grip: [0.12, -0.06, 0.038], gripRx: -0.3, fore: 'dual' });
  },
  // --------------------------------- пистолеты-пулемёты
  tmp(o, d) {
    o.prof('poly', true, CL.POLY, [[-0.06, 0.0], [-0.06, 0.045], ['q', -0.056, 0.056, -0.042, 0.056], [0.16, 0.056], [0.176, 0.044], [0.176, 0.0], [0.06, -0.012], [-0.03, -0.012]], 0.048);
    o.rail(-0.04, 0.15, 0.059);
    o.prof('poly', true, CL.POLY, [[0.0, -0.01], ['q', -0.006, -0.06, -0.012, -0.1], [-0.05, -0.1], ['q', -0.046, -0.06, -0.04, -0.01]], 0.034);
    o.prof('poly', false, CL.BLK, [[0.1, -0.008], [0.13, -0.008], ['q', 0.137, -0.05, 0.128, -0.088], [0.103, -0.088], ['q', 0.097, -0.05, 0.1, -0.008]], 0.03);
    guard(o, 0.005, 0.07, -0.01);
    o.lathe('dark', true, CL.MET, [[0, 0], [0.018, 0], [0.021, 0.006], [0.021, 0.19], [0.016, 0.2], [0.006, 0.2], [0, 0.2]], 0.172, 0.022);
    o.box('steel', false, CL.MET, 0.012, 0.012, -0.065, -0.05, 0.05, 0.026);
    o.to('mag'); o.prof('dark', false, CL.DRK, [[-0.008, -0.03], [-0.04, -0.03], [-0.054, -0.175], [-0.02, -0.175]], 0.024); o.box('dark', false, CL.BLK, 0.03, 0.008, -0.058, -0.016, -0.178); o.to('main');
    Object.assign(d, { len: 0.375, grip: [0, -0.055, 0.025], gripRx: -0.15, fore: [0, -0.05, -0.115], foreKind: 'vgrip' });
  },
  mac10(o, d) {
    o.prof('dark', true, CL.BLK, [[-0.085, -0.012], [-0.085, 0.048], ['q', -0.08, 0.054, -0.07, 0.054], [0.12, 0.054], [0.132, 0.042], [0.132, -0.012]], 0.056);
    o.box('dark', false, CL.DRK, 0.03, 0.006, -0.06, 0.1, 0.057); o.box('steel', false, CL.MET, 0.014, 0.012, -0.02, 0.0, 0.064);
    for (const x of [-0.031, 0.031]) o.cyl('steel', false, CL.STEEL, 0.004, -0.09, 0.1, 0.05, x, 8);
    o.cylX('steel', false, CL.STEEL, 0.004, 0.066, -0.09, 0.05, 0, 8); o.box('steel', false, CL.MET, 0.07, 0.03, -0.095, -0.088, 0.035);
    o.cyl('dark', false, CL.DRK, 0.013, 0.132, 0.19, 0.016); for (let i = 0; i < 5; i++) o.cyl('dark', false, CL.MET, 0.0142, 0.14 + i * 0.01, 0.144 + i * 0.01, 0.016);
    o.prof('poly', true, CL.POLY, [[0.0, -0.012], [-0.003, -0.092], ['q', -0.004, -0.1, -0.012, -0.1], [-0.044, -0.1], [-0.044, -0.012]], 0.036);
    guard(o, 0.002, 0.07, -0.012);
    o.box('steel', false, CL.MET, 0.03, 0.006, 0.09, 0.13, -0.018);
    o.to('mag'); o.prof('dark', false, CL.DRK, [[-0.006, -0.04], [-0.04, -0.04], [-0.042, -0.19], [-0.004, -0.19]], 0.028); o.box('dark', false, CL.BLK, 0.034, 0.008, -0.044, -0.002, -0.192); o.to('main');
    Object.assign(d, { len: 0.19, grip: [0, -0.06, 0.022], gripRx: -0.05, fore: [0, -0.03, -0.11], foreKind: 'under' });
  },
  mp5(o, d) {
    o.prof('dark', true, CL.BLK, [[-0.065, -0.004], [-0.065, 0.04], ['q', -0.062, 0.058, -0.045, 0.058], [0.19, 0.058], ['q', 0.205, 0.058, 0.205, 0.04], [0.205, -0.004]], 0.044);
    o.cyl('dark', true, CL.BLK, 0.012, 0.2, 0.37, 0.046);
    o.prof('poly', true, CL.POLY, [[0.2, 0.035], [0.355, 0.03], ['q', 0.368, 0.0, 0.355, -0.03], [0.2, -0.036], ['q', 0.19, 0.0, 0.2, 0.035]], 0.052);
    for (let i = 0; i < 5; i++) o.box('poly', false, CL.DRK, 0.054, 0.004, 0.22 + i * 0.026, 0.232 + i * 0.026, -0.018);
    o.cyl('dark', false, CL.DRK, 0.009, 0.355, 0.42, 0.012); o.cyl('dark', false, CL.MET, 0.012, 0.39, 0.42, 0.012);
    o.prof('dark', false, CL.DRK, [[0.37, 0.05], [0.395, 0.05], [0.395, 0.085], [0.37, 0.085]], 0.034, 0, [[[0.374, 0.056], [0.391, 0.056], [0.391, 0.08], [0.374, 0.08]]]);
    o.box('dark', false, CL.DRK, 0.004, 0.02, 0.38, 0.385, 0.066);
    o.cylX('dark', false, CL.DRK, 0.012, 0.036, -0.045, 0.07);
    for (const x of [-0.019, 0.019]) o.cyl('steel', false, CL.STEEL, 0.004, -0.24, -0.06, 0.016, x, 8);
    o.prof('rubber', false, CL.RUB, [[-0.262, 0.04], [-0.242, 0.04], [-0.242, -0.052], [-0.262, -0.062]], 0.052);
    o.prof('poly', true, CL.POLY, [[0.05, -0.004], [-0.06, -0.004], [-0.06, -0.022], [0.05, -0.022]], 0.04);
    arGrip(o, 0.0, -0.022, CL.POLY, 'poly', true);
    guard(o, 0.004, 0.06, -0.022);
    o.box('steel', false, CL.MET, 0.006, 0.006, -0.03, -0.02, 0.0, 0.024);
    o.to('mag'); curvedMag(o, 0.082, 0.112, 0.0, 0.17, 0.06, 0.022); o.to('main');
    Object.assign(d, { len: 0.42, grip: [0, -0.07, 0.03], gripRx: -0.3, fore: [0, 0.0, -0.29] });
  },
  ump45(o, d) {
    o.prof('poly', true, CL.POLY, [[-0.07, -0.02], [-0.07, 0.058], [0.2, 0.058], [0.245, 0.042], [0.245, -0.02], [0.13, -0.034], [0.04, -0.034], [0.04, -0.02]], 0.058);
    o.rail(-0.05, 0.2, 0.061);
    for (let i = 0; i < 6; i++) o.box('poly', false, CL.DRK, 0.06, 0.003, 0.14 + i * 0.016, 0.148 + i * 0.016, 0.01);
    o.cyl('dark', false, CL.DRK, 0.012, 0.245, 0.33, 0.02); o.cyl('dark', false, CL.MET, 0.016, 0.3, 0.33, 0.02);
    o.prof('poly', true, CL.POLY, [[-0.07, 0.05], [-0.3, 0.04], [-0.31, -0.072], [-0.27, -0.076], [-0.07, -0.016]], 0.024, 0, [[[-0.1, 0.03], [-0.265, 0.024], [-0.272, -0.05], [-0.1, -0.003]]]);
    o.box('rubber', false, CL.RUB, 0.03, 0.12, -0.315, -0.305, -0.016);
    arGrip(o, 0.0, -0.02, CL.POLY, 'poly', true);
    guard(o, 0.004, 0.04, -0.02);
    o.to('mag'); curvedMag(o, 0.068, 0.11, -0.03, 0.16, 0.018, 0.03); o.to('main');
    Object.assign(d, { len: 0.33, grip: [0, -0.07, 0.03], gripRx: -0.3, fore: [0, -0.025, -0.2] });
  },
  p90(o, d) {
    o.prof('poly', true, CL.POLY, [[-0.22, 0.02], ['q', -0.225, 0.065, -0.18, 0.066], [0.17, 0.066], ['q', 0.25, 0.064, 0.26, 0.02], [0.26, -0.02], ['q', 0.255, -0.045, 0.22, -0.046], [0.16, -0.046], ['q', 0.15, -0.12, 0.11, -0.122], [-0.02, -0.122], ['q', -0.06, -0.12, -0.08, -0.08], [-0.16, -0.06], ['q', -0.215, -0.05, -0.22, 0.02]], 0.06, 0,
      [[[0.035, -0.06], [0.13, -0.06], ['q', 0.135, -0.105, 0.105, -0.106], [0.04, -0.106]], [[-0.07, -0.05], [-0.035, -0.05], [-0.04, -0.1], ['q', -0.06, -0.1, -0.064, -0.078]]]);
    o.cyl('dark', false, CL.DRK, 0.011, 0.26, 0.3, 0.02); o.cyl('dark', false, CL.MET, 0.013, 0.285, 0.3, 0.02);
    o.box('dark', false, CL.DRK, 0.03, 0.03, -0.02, 0.06, 0.092); o.box('dark', false, CL.BLK, 0.032, 0.004, -0.022, 0.062, 0.109);
    o.box('steel', false, CL.MET, 0.008, 0.008, 0.1, 0.12, 0.03, 0.033); o.box('steel', false, CL.MET, 0.008, 0.008, 0.1, 0.12, 0.03, -0.033);
    o.to('mag'); o.box('poly', false, 0x8fb3c4, 0.052, 0.022, -0.16, 0.19, 0.078); for (let i = 0; i < 12; i++) o.box('brass', false, CL.BRASS, 0.04, 0.008, -0.15 + i * 0.028, -0.14 + i * 0.028, 0.08); o.to('main');
    Object.assign(d, { len: 0.3, grip: [0, -0.075, 0.03], gripRx: -0.2, fore: [0, -0.08, -0.12], foreKind: 'vgrip' });
  },
  // --------------------------------- дробовики
  m3(o, d) {
    o.prof('dark', true, CL.BLK, [[-0.07, -0.02], [-0.07, 0.05], ['q', -0.06, 0.062, -0.04, 0.062], [0.17, 0.058], [0.182, 0.046], [0.182, -0.016], [0.06, -0.022]], 0.052);
    o.box('steel', false, CL.MET, 0.002, 0.024, 0.0, 0.07, 0.022, 0.0265);
    o.cyl('steel', false, CL.MET, 0.0148, 0.18, 0.76, 0.036); o.cyl('dark', false, CL.DRK, 0.0095, 0.759, 0.762, 0.036, 0, 12);
    o.cyl('dark', true, CL.BLK, 0.0145, 0.18, 0.62, 0.003); o.cyl('dark', false, CL.MET, 0.016, 0.6, 0.63, 0.003);
    o.sph('steel', false, 0xe0e0e0, 0.003, 0.75, 0.054);
    o.prof('poly', true, CL.POLY, [[-0.07, 0.048], [-0.42, 0.022], [-0.425, -0.1], [-0.39, -0.108], [-0.14, -0.062], ['q', -0.1, -0.08, -0.09, -0.115], [-0.058, -0.112], ['q', -0.05, -0.07, -0.03, -0.02], [-0.07, -0.02]], 0.044);
    o.box('rubber', false, CL.RUB, 0.046, 0.13, -0.432, -0.42, -0.04);
    guard(o, 0.0, 0.06, -0.02);
    o.to('slide');
    o.prof('poly', true, CL.POLY, [[-0.09, -0.024], [0.09, -0.024], ['q', 0.1, 0.0, 0.09, 0.024], [-0.09, 0.024], ['q', -0.1, 0.0, -0.09, -0.024]], 0.054);
    for (let i = 0; i < 6; i++) o.box('poly', false, CL.DRK, 0.056, 0.036, -0.07 + i * 0.028, -0.064 + i * 0.028, 0);
    o.to('main');
    Object.assign(d, { slidePos: [0, 0.006, -0.33], len: 0.76, grip: [0, -0.08, 0.075], gripRx: -0.5, fore: [0, -0.012, -0.33], eject: [0.03, 0.03, -0.04] });
  },
  xm1014(o, d) {
    o.prof('alu', true, CL.BLK, [[-0.06, -0.02], [-0.06, 0.055], [0.2, 0.055], [0.21, 0.04], [0.21, -0.014], [0.07, -0.022]], 0.054);
    o.rail(-0.05, 0.19, 0.058);
    o.prof('dark', false, CL.DRK, [[-0.04, 0.062], [-0.02, 0.062], [-0.02, 0.09], [-0.04, 0.09]], 0.03, 0, [[[-0.035, 0.07], [-0.025, 0.07], [-0.025, 0.084], [-0.035, 0.084]]]);
    o.cyl('steel', false, CL.MET, 0.0155, 0.21, 0.72, 0.036); o.cyl('dark', true, CL.BLK, 0.016, 0.21, 0.58, 0.002);
    o.prof('dark', false, CL.DRK, [[0.68, 0.045], [0.7, 0.045], [0.698, 0.07], [0.684, 0.07]], 0.016);
    o.prof('poly', true, CL.POLY, [[0.21, 0.03], [0.5, 0.03], ['q', 0.51, 0.0, 0.5, -0.034], [0.21, -0.034]], 0.06);
    for (let i = 0; i < 8; i++) o.box('poly', false, CL.DRK, 0.062, 0.002, 0.24 + i * 0.03, 0.25 + i * 0.03, -0.02);
    o.cyl('dark', false, CL.BLK, 0.017, -0.3, -0.06, 0.02);
    o.prof('poly', true, CL.POLY, [[-0.18, 0.045], [-0.32, 0.045], [-0.33, -0.08], [-0.3, -0.085], [-0.22, 0.0], [-0.18, 0.0]], 0.042, 0, [[[-0.235, 0.035], [-0.3, 0.035], [-0.305, -0.04], [-0.26, 0.012], [-0.235, 0.012]]]);
    o.box('rubber', false, CL.RUB, 0.044, 0.13, -0.338, -0.326, -0.02);
    arGrip(o, 0.0, -0.02, CL.POLY, 'poly', true);
    guard(o, 0.004, 0.062, -0.02);
    o.to('mag'); o.box('brass', false, 0xb22222, 0.016, 0.016, 0.06, 0.1, -0.025); o.box('brass', false, CL.BRASS, 0.017, 0.017, 0.055, 0.062, -0.025); o.to('main');
    Object.assign(d, { len: 0.72, grip: [0, -0.07, 0.03], gripRx: -0.3, fore: [0, -0.01, -0.36] });
  },
  // --------------------------------- винтовки
  ak47(o, d) {
    o.prof('dark', true, CL.MET, [[-0.06, 0.04], [0.27, 0.04], [0.27, -0.012], [0.17, -0.02], [-0.06, -0.02]], 0.05);
    o.prof('dark', true, CL.MET, [[-0.07, 0.038], ['q', -0.074, 0.062, -0.045, 0.063], [0.25, 0.058], [0.268, 0.04]], 0.046);
    o.box('steel', false, CL.MET, 0.03, 0.02, 0.27, 0.33, 0.05); o.box('dark', false, CL.DRK, 0.012, 0.012, 0.29, 0.31, 0.064);
    o.box('steel', false, CL.MET, 0.003, 0.01, 0.0, 0.22, 0.018, 0.027);
    o.prof('steel', false, CL.MET, [[0.0, 0.026], [0.2, 0.034], [0.2, 0.026], [0.0, 0.016]], 0.004, 0.027, null, 0.001);
    o.prof('wood', true, CL.WOOD, [[0.27, 0.022], [0.5, 0.022], [0.505, 0.01], [0.5, -0.012], ['q', 0.49, -0.024, 0.47, -0.024], [0.29, -0.024], [0.27, -0.012]], 0.052);
    o.prof('wood', true, CL.WOOD, [[0.33, 0.03], [0.5, 0.032], [0.5, 0.05], ['q', 0.48, 0.064, 0.45, 0.064], [0.36, 0.064], ['q', 0.335, 0.062, 0.33, 0.046]], 0.038);
    o.cyl('steel', false, CL.MET, 0.009, 0.5, 0.6, 0.048); o.box('steel', false, CL.MET, 0.026, 0.044, 0.58, 0.615, 0.04);
    o.cyl('steel', false, CL.MET, 0.0115, 0.27, 0.72, 0.022); o.cyl('steel', false, CL.STEEL, 0.003, 0.3, 0.68, 0.004, 0, 8);
    o.box('steel', false, CL.MET, 0.022, 0.022, 0.685, 0.72, 0.032); o.prof('dark', false, CL.DRK, [[0.693, 0.043], [0.712, 0.043], [0.706, 0.078], [0.699, 0.078]], 0.004);
    for (const x of [-0.008, 0.008]) o.box('dark', false, CL.MET, 0.003, 0.03, 0.695, 0.71, 0.058, x);
    o.lathe('dark', false, CL.MET, [[0, 0], [0.015, 0], [0.015, 0.05], [0.012, 0.062], [0.006, 0.062], [0, 0.062]], 0.72, 0.022);
    o.prof('wood', true, CL.WOOD2, [[-0.004, -0.02], [-0.036, -0.02], [-0.076, -0.115], ['q', -0.071, -0.126, -0.056, -0.123], [-0.021, -0.112], ['q', -0.012, -0.06, -0.004, -0.02]], 0.032);
    o.prof('wood', true, CL.WOOD, [[-0.06, 0.036], [-0.42, 0.002], [-0.425, -0.108], [-0.39, -0.112], [-0.06, -0.016]], 0.042);
    o.box('steel', false, CL.MET, 0.044, 0.114, -0.432, -0.424, -0.052);
    guard(o, -0.004, 0.068, -0.02);
    o.to('mag'); curvedMag(o, 0.074, 0.13, -0.012, 0.22, 0.13, 0.03, 0x3a2a20); o.to('main');
    o.to('slide'); o.cylX('steel', false, CL.STEEL, 0.005, 0.024, 0, 0, 0); o.to('main');
    Object.assign(d, { slidePos: [0.038, 0.034, -0.21], len: 0.782, grip: [0, -0.07, 0.04], gripRx: -0.4, fore: [0, -0.008, -0.38] });
  },
  m4a1(o, d) {
    o.prof('alu', true, CL.BLK, [[-0.03, 0.0], [-0.03, 0.05], [0.2, 0.05], [0.205, 0.0]], 0.05);
    o.rail(-0.03, 0.2, 0.053);
    o.prof('alu', true, CL.BLK, [[-0.035, 0.0], [0.135, 0.0], [0.135, -0.046], [0.074, -0.046], [0.068, -0.028], [-0.035, -0.028]], 0.046);
    o.box('dark', false, CL.DRK, 0.0016, 0.018, 0.05, 0.11, 0.026, 0.0258); o.cylX('steel', false, CL.MET, 0.007, 0.012, -0.0, 0.036, 0.03);
    o.cyl('poly', true, CL.POLY, 0.017, -0.29, -0.03, 0.014);
    o.prof('poly', true, CL.POLY, [[-0.17, 0.034], [-0.31, 0.036], [-0.316, -0.066], [-0.285, -0.072], [-0.25, -0.022], [-0.17, -0.02]], 0.04, 0, [[[-0.2, 0.024], [-0.255, 0.026], [-0.256, -0.008], [-0.2, -0.008]]]);
    o.box('rubber', false, CL.RUB, 0.042, 0.1, -0.324, -0.314, -0.015);
    o.prof('dark', false, CL.DRK, [[-0.035, 0.052], [-0.025, 0.052], [-0.025, 0.06], [-0.035, 0.06]], 0.03);
    o.lathe('poly', true, CL.POLY, [[0.0, 0], [0.024, 0], [0.025, 0.01], [0.025, 0.22], [0.022, 0.23], [0.0, 0.23]], 0.205, 0.016, 0, 18);
    for (let i = 0; i < 7; i++) o.cyl('poly', false, CL.DRK, 0.0256, 0.225 + i * 0.028, 0.232 + i * 0.028, 0.016);
    o.cyl('steel', false, CL.MET, 0.009, 0.43, 0.49, 0.022);
    o.prof('dark', false, CL.DRK, [[0.4, 0.034], [0.43, 0.034], [0.424, 0.088], [0.406, 0.088]], 0.012, 0, [[[0.41, 0.05], [0.42, 0.05], [0.418, 0.08], [0.412, 0.08]]]);
    o.box('dark', false, CL.DRK, 0.012, 0.016, -0.02, 0.03, 0.066); o.prof('dark', false, CL.DRK, [[-0.01, 0.07], [0.02, 0.07], [0.016, 0.084], [-0.006, 0.084]], 0.02, 0, [[[-0.0, 0.074], [0.008, 0.074], [0.008, 0.08], [0.0, 0.08]]]);
    o.lathe('dark', true, CL.DRK, [[0, 0], [0.014, 0], [0.021, 0.008], [0.021, 0.23], [0.017, 0.24], [0.006, 0.24], [0, 0.24]], 0.485, 0.022);
    for (let i = 0; i < 4; i++) o.cyl('dark', false, CL.MET, 0.0213, 0.52 + i * 0.05, 0.523 + i * 0.05, 0.022);
    arGrip(o, 0.0, -0.028, CL.POLY, 'poly', true);
    guard(o, 0.0, 0.068, -0.028);
    o.to('mag'); curvedMag(o, 0.077, 0.128, -0.032, 0.17, 0.035, 0.026); o.to('main');
    o.to('slide'); o.box('steel', false, CL.MET, 0.016, 0.006, -0.012, 0.0, 0.0); o.to('main');
    Object.assign(d, { slidePos: [0, 0.046, 0.02], len: 0.725, sil: true, grip: [0, -0.076, 0.035], gripRx: -0.32, fore: [0, -0.012, -0.33] });
  },
  galil(o, d) {
    o.prof('dark', true, CL.MET, [[-0.06, 0.042], ['q', -0.062, 0.058, -0.045, 0.06], [0.26, 0.056], [0.27, 0.04], [0.27, -0.012], [0.17, -0.02], [-0.06, -0.02]], 0.052);
    o.prof('dark', false, CL.DRK, [[0.0, 0.064], [0.08, 0.064], [0.08, 0.075], [0.0, 0.075]], 0.012);
    o.prof('wood', true, CL.WOOD, [[0.27, 0.03], [0.48, 0.03], ['q', 0.49, 0.0, 0.48, -0.026], [0.27, -0.026]], 0.05);
    for (let i = 0; i < 4; i++) o.box('wood', false, CL.WOOD2, 0.052, 0.006, 0.3 + i * 0.04, 0.32 + i * 0.04, 0.012);
    o.cyl('steel', false, CL.MET, 0.012, 0.27, 0.74, 0.022); o.cyl('steel', false, CL.MET, 0.008, 0.48, 0.6, 0.048);
    o.prof('dark', false, CL.DRK, [[0.66, 0.035], [0.69, 0.035], [0.685, 0.095], [0.67, 0.095]], 0.012);
    o.lathe('dark', false, CL.MET, [[0, 0], [0.016, 0], [0.016, 0.06], [0.0, 0.06]], 0.735, 0.022);
    for (const x of [-0.022, 0.022]) o.cyl('steel', false, CL.MET, 0.005, 0.5, 0.66, -0.03, x, 8);
    for (const y of [0.03, -0.065]) o.cyl('steel', false, CL.STEEL, 0.006, -0.38, -0.06, y, 0, 10);
    o.prof('steel', false, CL.MET, [[-0.39, 0.042], [-0.37, 0.042], [-0.37, -0.08], [-0.39, -0.085]], 0.04);
    o.prof('poly', true, CL.POLY, [[-0.004, -0.02], [-0.034, -0.02], [-0.072, -0.115], ['q', -0.066, -0.125, -0.052, -0.122], [-0.02, -0.11], ['q', -0.012, -0.06, -0.004, -0.02]], 0.032);
    guard(o, -0.004, 0.068, -0.02);
    o.to('mag'); curvedMag(o, 0.076, 0.13, -0.012, 0.21, 0.09, 0.03); o.to('main');
    Object.assign(d, { len: 0.795, grip: [0, -0.07, 0.04], gripRx: -0.4, fore: [0, -0.005, -0.37] });
  },
  famas(o, d) {
    o.prof('poly', true, CL.BLK, [[-0.33, 0.01], ['q', -0.335, 0.055, -0.3, 0.058], [0.17, 0.05], [0.22, 0.03], [0.22, -0.026], [0.13, -0.034], [0.06, -0.034], [0.04, -0.02], [-0.06, -0.02], [-0.11, -0.03], [-0.3, -0.05], ['q', -0.33, -0.05, -0.33, 0.01]], 0.06);
    o.prof('poly', true, CL.BLK, [[-0.24, 0.054], [-0.22, 0.054], [-0.22, 0.09], [0.11, 0.09], [0.11, 0.05], [0.13, 0.05], [0.13, 0.11], [0.08, 0.118], [-0.21, 0.118], [-0.24, 0.1]], 0.024, 0, [[[-0.2, 0.06], [0.1, 0.06], [0.1, 0.082], [-0.2, 0.082]]]);
    o.cyl('steel', false, CL.MET, 0.012, 0.22, 0.48, 0.016); o.lathe('dark', false, CL.MET, [[0, 0], [0.016, 0], [0.016, 0.05], [0, 0.05]], 0.48, 0.016);
    for (const x of [-0.016, 0.016]) o.cyl('steel', false, CL.MET, 0.004, 0.24, 0.44, -0.005, x, 8);
    o.box('rubber', false, CL.RUB, 0.062, 0.1, -0.345, -0.33, 0.0);
    o.prof('poly', true, CL.BLK, [[0.06, -0.034], [0.03, -0.034], ['q', 0.022, -0.075, 0.012, -0.11], [0.044, -0.112], ['q', 0.05, -0.07, 0.06, -0.034]], 0.032);
    o.prof('dark', false, CL.DRK, [[0.065, -0.034], [0.12, -0.034], ['q', 0.124, -0.08, 0.1, -0.1], [0.06, -0.1]], 0.012, 0, [[[0.07, -0.04], [0.115, -0.04], ['q', 0.116, -0.08, 0.098, -0.093], [0.068, -0.093]]]);
    o.to('mag'); o.prof('dark', false, CL.DRK, [[-0.14, -0.03], [-0.085, -0.03], [-0.08, -0.13], [-0.135, -0.135]], 0.028); o.to('main');
    Object.assign(d, { len: 0.5, grip: [0, -0.075, -0.035], gripRx: -0.15, fore: [0, -0.03, -0.17] });
  },
  sg552(o, d) {
    o.prof('dark', true, CL.BLK, [[-0.05, 0.0], [-0.05, 0.046], ['q', -0.046, 0.056, -0.03, 0.056], [0.18, 0.054], [0.19, 0.04], [0.19, -0.016], [0.07, -0.024], [-0.05, -0.02]], 0.05);
    o.rail(-0.03, 0.17, 0.057);
    o.prof('poly', true, CL.OD, [[0.19, 0.032], [0.36, 0.03], ['q', 0.372, 0.0, 0.36, -0.03], [0.19, -0.034]], 0.054);
    for (let i = 0; i < 5; i++) o.box('poly', false, CL.GREEN, 0.056, 0.012, 0.21 + i * 0.03, 0.222 + i * 0.03, 0.0);
    o.cyl('steel', false, CL.MET, 0.0115, 0.36, 0.56, 0.02); o.lathe('dark', false, CL.MET, [[0, 0], [0.016, 0], [0.016, 0.05], [0.0, 0.05]], 0.55, 0.02);
    for (let i = 0; i < 4; i++) o.box('dark', false, CL.DRK, 0.034, 0.003, 0.555 + i * 0.012, 0.56 + i * 0.012, 0.02);
    o.prof('poly', true, CL.BLK, [[-0.05, 0.044], [-0.29, 0.034], [-0.3, -0.08], [-0.27, -0.084], [-0.05, -0.016]], 0.022, 0, [[[-0.08, 0.026], [-0.265, 0.018], [-0.27, -0.055], [-0.08, -0.004]]]);
    arGrip(o, 0.0, -0.02, CL.POLY, 'poly', true);
    guard(o, 0.002, 0.066, -0.02);
    o.to('mag'); curvedMag(o, 0.074, 0.126, -0.024, 0.18, 0.06, 0.028, 0xd9822b, 'poly'); o.to('main');
    Object.assign(d, { len: 0.6, grip: [0, -0.07, 0.03], gripRx: -0.32, fore: [0, -0.01, -0.28] });
  },
  aug(o, d) {
    o.prof('poly', true, CL.OD, [[-0.3, 0.0], ['q', -0.312, 0.06, -0.26, 0.062], [0.06, 0.062], [0.1, 0.05], [0.2, 0.045], [0.21, 0.03], [0.21, -0.02], [0.13, -0.03], [-0.04, -0.03], [-0.1, -0.06], [-0.26, -0.065], ['q', -0.3, -0.06, -0.3, 0.0]], 0.064);
    o.prof('poly', true, CL.OD, [[-0.04, -0.03], [0.14, -0.03], [0.15, -0.06], ['q', 0.15, -0.1, 0.12, -0.105], [-0.0, -0.105], ['q', -0.04, -0.1, -0.04, -0.07]], 0.03, 0, [[[-0.025, -0.036], [0.13, -0.036], ['q', 0.13, -0.092, 0.11, -0.094], [0.0, -0.094], ['q', -0.025, -0.09, -0.025, -0.07]]]);
    o.prof('poly', true, CL.OD, [[0.0, -0.036], [0.03, -0.036], ['q', 0.034, -0.065, 0.028, -0.092], [0.004, -0.092]], 0.03);
    o.prof('poly', true, CL.OD, [[0.15, -0.02], [0.175, -0.02], ['q', 0.18, -0.07, 0.172, -0.11], [0.152, -0.11], ['q', 0.146, -0.07, 0.15, -0.02]], 0.03);
    o.cyl('steel', false, CL.MET, 0.012, 0.21, 0.52, 0.016); o.lathe('dark', false, CL.MET, [[0, 0], [0.017, 0], [0.017, 0.045], [0.0, 0.045]], 0.51, 0.016);
    o.box('rubber', false, CL.RUB, 0.066, 0.12, -0.314, -0.3, -0.002);
    o.to('mag'); o.prof('poly', false, 0x9fb7a8, [[-0.17, -0.04], [-0.11, -0.04], ['q', -0.105, -0.1, -0.085, -0.16], [-0.14, -0.168], ['q', -0.162, -0.1, -0.17, -0.04]], 0.03); o.to('main');
    Object.assign(d, { len: 0.555, grip: [0, -0.07, -0.015], gripRx: -0.15, fore: [0, -0.07, -0.162], foreKind: 'vgrip' });
  },
  // --------------------------------- снайперские
  scout(o, d) {
    o.cyl('dark', true, CL.BLK, 0.017, -0.07, 0.17, 0.022); o.box('dark', false, CL.DRK, 0.002, 0.014, 0.0, 0.06, 0.024, 0.017);
    o.cyl('steel', false, CL.MET, 0.0098, 0.17, 0.8, 0.022);
    o.lathe('dark', false, CL.DRK, [[0, 0], [0.014, 0], [0.014, 0.035], [0.0, 0.035]], 0.79, 0.022);
    for (let i = 0; i < 3; i++) o.box('dark', false, CL.BLK, 0.03, 0.004, 0.8 + i * 0.01, 0.804 + i * 0.01, 0.022);
    o.prof('poly', true, CL.POLY, [[0.4, 0.01], [0.0, 0.006], [-0.05, 0.006], [-0.08, 0.012], [-0.42, 0.022], [-0.425, -0.1], [-0.39, -0.106], [-0.15, -0.052], ['q', -0.09, -0.07, -0.078, -0.104], [-0.05, -0.104], ['q', -0.036, -0.05, -0.0, -0.02], [0.38, -0.02], ['q', 0.41, -0.01, 0.4, 0.01]], 0.042);
    o.box('rubber', false, CL.RUB, 0.044, 0.124, -0.434, -0.422, -0.04);
    guard(o, 0.0, 0.06, -0.018);
    o.to('mag'); o.box('dark', false, CL.DRK, 0.03, 0.04, 0.07, 0.13, -0.034); o.to('main');
    o.to('slide'); o.cylX('steel', false, CL.STEEL, 0.0055, 0.05, 0, 0, 0.025); o.sph('steel', false, CL.STEEL, 0.011, 0, 0, 0.052); o.to('main');
    Object.assign(d, { slidePos: [0, 0.03, -0.0], len: 0.84, grip: [0, -0.068, 0.07], gripRx: -0.45, fore: [0, -0.03, -0.3] });
  },
  awp(o, d) {
    o.cyl('dark', true, CL.OD, 0.021, -0.07, 0.2, 0.022);
    o.cyl('steel', false, CL.MET, 0.0165, 0.2, 0.82, 0.022);
    o.box('dark', false, CL.DRK, 0.042, 0.038, 0.82, 0.905, 0.022); for (let i = 0; i < 3; i++) for (const x of [-0.0215, 0.0215]) o.box('dark', false, 0x050505, 0.002, 0.026, 0.83 + i * 0.022, 0.842 + i * 0.022, 0.022, x);
    o.prof('poly', true, CL.OD, [[0.0, 0.004], [0.4, 0.002], ['q', 0.42, -0.015, 0.4, -0.034], [0.0, -0.036]], 0.064);
    for (let i = 0; i < 5; i++) o.box('poly', false, CL.GREEN, 0.066, 0.004, 0.06 + i * 0.06, 0.08 + i * 0.06, -0.016);
    o.prof('poly', true, CL.OD, [[-0.06, 0.035], [-0.15, 0.05], [-0.42, 0.05], ['q', -0.445, 0.05, -0.445, 0.02], [-0.445, -0.1], ['q', -0.445, -0.115, -0.42, -0.115], [-0.32, -0.115], [-0.2, -0.06], ['q', -0.12, -0.06, -0.095, -0.1], [-0.07, -0.1], ['q', -0.055, -0.06, -0.04, -0.02], [-0.06, -0.015]], 0.058, 0,
      [[[-0.11, 0.0], [-0.17, 0.02], ['q', -0.2, 0.02, -0.2, -0.01], [-0.19, -0.04], [-0.12, -0.04]]]);
    o.prof('poly', false, CL.GREEN, [[-0.22, 0.05], [-0.4, 0.05], [-0.4, 0.075], [-0.24, 0.075]], 0.05);
    o.box('rubber', false, CL.RUB, 0.06, 0.16, -0.458, -0.445, -0.03);
    guard(o, 0.0, 0.07, -0.036);
    o.to('mag'); o.box('dark', false, CL.DRK, 0.036, 0.05, 0.08, 0.16, -0.05); o.to('main');
    o.to('slide'); o.cylX('steel', false, CL.STEEL, 0.006, 0.06, 0, 0, 0.03); o.sph('steel', false, CL.DRK, 0.013, 0, 0, 0.062); o.to('main');
    Object.assign(d, { slidePos: [0, 0.03, 0.03], len: 0.905, grip: [0, -0.072, 0.075], gripRx: -0.45, fore: [0, -0.04, -0.3] });
  },
  // --------------------------------- пулемёт
  m249(o, d) {
    o.prof('dark', true, CL.BLK, [[-0.07, -0.02], [-0.07, 0.06], [0.2, 0.06], [0.22, 0.045], [0.22, -0.02], [0.05, -0.03]], 0.07);
    o.prof('dark', true, CL.BLK, [[-0.06, 0.06], [0.18, 0.06], [0.18, 0.078], [-0.04, 0.084]], 0.074);
    o.rail(-0.04, 0.16, 0.086);
    o.prof('steel', false, CL.MET, [[0.04, 0.09], [0.06, 0.09], [0.06, 0.13], [0.2, 0.13], [0.2, 0.09], [0.22, 0.09], [0.22, 0.145], [0.04, 0.145]], 0.014, 0, [[[0.065, 0.135], [0.195, 0.135], [0.195, 0.14], [0.065, 0.14]]]);
    o.cyl('steel', false, CL.MET, 0.0145, 0.22, 0.78, 0.024);
    o.lathe('dark', false, CL.GREY, [[0.0, 0], [0.026, 0], [0.026, 0.3], [0.0, 0.3]], 0.24, 0.03, 0, 16);
    for (let i = 0; i < 9; i++) o.box('dark', false, 0x0a0a0a, 0.054, 0.006, 0.26 + i * 0.03, 0.27 + i * 0.03, 0.03);
    o.cyl('steel', false, CL.MET, 0.009, 0.22, 0.6, -0.012);
    o.lathe('dark', false, CL.DRK, [[0, 0], [0.017, 0], [0.017, 0.05], [0, 0.05]], 0.76, 0.024);
    for (const x of [-0.016, 0.016]) { o.cyl('steel', false, CL.MET, 0.005, 0.5, 0.72, -0.03, x, 8); o.box('rubber', false, CL.RUB, 0.012, 0.01, 0.71, 0.73, -0.03, x); }
    o.prof('poly', true, CL.POLY, [[-0.07, 0.05], [-0.36, 0.035], [-0.37, -0.09], [-0.33, -0.095], [-0.14, -0.04], [-0.07, -0.02]], 0.05, 0, [[[-0.12, 0.03], [-0.32, 0.022], [-0.325, -0.06], [-0.15, -0.02], [-0.12, -0.012]]]);
    o.box('rubber', false, CL.RUB, 0.052, 0.13, -0.38, -0.37, -0.03);
    arGrip(o, 0.0, -0.025, CL.POLY, 'poly', true);
    guard(o, 0.002, 0.07, -0.025);
    o.to('mag'); o.prof('poly', false, CL.GREEN, [[0.06, -0.03], [0.2, -0.03], [0.2, -0.16], ['q', 0.2, -0.17, 0.19, -0.17], [0.07, -0.17], ['q', 0.06, -0.17, 0.06, -0.16]], 0.09); o.box('poly', false, 0x313a29, 0.092, 0.02, 0.06, 0.2, -0.06);
    for (let i = 0; i < 6; i++) o.box('brass', false, CL.BRASS, 0.016, 0.008, 0.06 + i * 0.012, 0.068 + i * 0.012, -0.022 + i * 0.002, 0.04); o.to('main');
    Object.assign(d, { len: 0.81, grip: [0, -0.075, 0.035], gripRx: -0.32, fore: [0, -0.02, -0.34] });
  },
};

// Прицелы
function addScope(o, d, w) {
  if (w.scope === 2) {
    const big = w.key === 'awp', R = big ? 0.034 : 0.027;
    o.lathe('dark', false, 0x0f1012, [[0, 0], [0.019, 0], [0.022, 0.005], [0.022, 0.05], [0.017, 0.08], [0.0165, 0.09], [0.0165, 0.2], [R * 0.8, 0.235], [R, 0.27], [R, 0.33], [R - 0.003, 0.335], [0, 0.335]], -0.115, 0.104);
    o.cylY('dark', false, 0x0f1012, 0.009, 0.026, 0.06, 0.128); o.cylX('dark', false, 0x0f1012, 0.009, 0.05, 0.06, 0.104);
    for (const f of [-0.02, 0.15]) { o.lathe('dark', false, CL.DRK, [[0.017, 0], [0.021, 0], [0.021, 0.018], [0.017, 0.018], [0.017, 0]], f, 0.104, 0, 16); o.box('dark', false, CL.DRK, 0.018, 0.05, f, f + 0.018, 0.07); }
    o.add('lens', false, part(cylG(20), 0xffffff, 0, 0.104, -(0.218), R - 0.003, 0.002, R - 0.003, Math.PI / 2, 0, 0));
    o.add('lens', false, part(cylG(20), 0xffffff, 0, 0.104, 0.112, 0.017, 0.002, 0.017, Math.PI / 2, 0, 0));
  }
  if (w.scope === 1) {
    const sy = 0.104;
    o.box('dark', false, CL.DRK, 0.03, 0.03, -0.04, 0.03, 0.07); o.box('dark', false, CL.DRK, 0.038, 0.008, -0.05, 0.04, 0.059);
    o.lathe('dark', false, 0x15171a, [[0.016, 0], [0.0205, 0], [0.0215, 0.006], [0.0215, 0.062], [0.0205, 0.068], [0.016, 0.068], [0.016, 0]], -0.04, sy, 0, 20);
    o.cylY('dark', false, CL.DRK, 0.007, 0.012, 0.0, sy + 0.025); o.cylX('dark', false, CL.DRK, 0.007, 0.01, 0.0, sy, 0.024);
    d.sight = [0, sy, -0.02];
  }
}

const gunGeo = {};
const _bb = new THREE.Box3(), _bc = new THREE.Vector3();
function buildGun(w, hasFin, vmMode) {
  const o = GB(hasFin);
  const d = { len: 0.6, sight: null, slidePos: [0, 0, 0], sil: false, grip: [0, -0.07, 0.03], gripRx: -0.3, fore: [0, -0.02, -0.3], foreKind: 'under' };
  (GUNS[w.key] || GUNS.ak47)(o, d, w);
  addScope(o, d, w);
  d.groups = {};
  for (const g of ['main', 'mag', 'slide']) {
    const by = {};
    for (const it of o.P[g]) {
      // в руках от первого лица приклад позади щеки не нужен — он только загораживает экран
      if (vmMode && g === 'main' && w.cat !== 'pistol' && w.cat !== 'dual') { if (!it.p.geo.boundingBox) it.p.geo.computeBoundingBox(); _bb.copy(it.p.geo.boundingBox).applyMatrix4(it.p.m).getCenter(_bc); if (_bc.z > 0.12) continue; }
      (by[it.key] || (by[it.key] = [])).push(it.p);
    }
    d.groups[g] = Object.entries(by).map(([key, parts]) => [key, merge(parts)]);
  }
  return d;
}
const dotTexC = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,40,40,1)'); gr.addColorStop(0.35, 'rgba(255,0,0,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }; })();

export function makeGun(wid, fid, vmMode) {
  const w = WEAPONS[wid] || WEAPONS[0], k = w.key;
  const fin = fid != null && fid >= 0 && FINISHES[fid] && FINISHES[fid].w === k ? fid : -1;
  const fm = fin >= 0 ? finishMaterial(fin) : null;
  if (k === 'knife') return makeKnife(fin >= 0 ? FINISHES[fin].model : 'default', fm);
  const ck = wid + (fm ? 'F' : 'N') + (vmMode ? 'V' : '');
  const d = gunGeo[ck] || (gunGeo[ck] = buildGun(w, !!fm, vmMode));
  const g = new THREE.Group(), sub = {};
  for (const gname of ['main', 'mag', 'slide']) {
    const grp = new THREE.Group(); g.add(grp); sub[gname] = grp;
    for (const [key, geo] of d.groups[gname]) { const m = new THREE.Mesh(geo, key === 'FIN' ? fm : key === 'lens' ? glassMat : kindMat(key)); m.castShadow = true; grp.add(m); }
  }
  sub.slide.position.set(...d.slidePos);
  let sight = null;
  if (d.sight) {
    sight = new THREE.Vector3(...d.sight);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
    lens.position.copy(sight); g.add(lens);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexC(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    dot.position.copy(sight).add(new THREE.Vector3(0, 0, -0.002)); dot.scale.setScalar(0.009); dot.renderOrder = 10; dot.visible = false; g.add(dot);
    g.userData.dot = dot;
  }
  const by = w.cat === 'pistol' || w.cat === 'dual' ? 0.022 : w.key === 'm3' || w.key === 'xm1014' ? 0.036 : 0.022;
  g.userData = Object.assign(g.userData, {
    muzzle: new THREE.Vector3(w.key === 'elite' ? 0.12 : 0, by, -d.len), len: d.len, sight, mag: sub.mag, slide: sub.slide, magHome: sub.mag.position.clone(), slideHome: sub.slide.position.clone(), sil: !!d.sil, kind: w.cat,
    grip: new THREE.Vector3(...d.grip), gripRx: d.gripRx, fore: Array.isArray(d.fore) ? new THREE.Vector3(...d.fore) : d.fore, foreKind: d.foreKind,
  });
  return g;
}

// ---------------------------------------------------------------------
// Ножи: рукоять у начала координат, клинок вперёд (-Z). Клинки — полированная сталь.
// ---------------------------------------------------------------------
const torusG = (r, t) => { const k = 't' + r + t; return geoC[k] || (geoC[k] = nonIdx(new THREE.TorusGeometry(r, t, 8, 22))); };
const KNIFE_DEF = {
  default(o, d) {
    o.prof('rubber', false, 0x2b2e33, [[0.0, -0.014], [-0.115, -0.016], ['q', -0.126, 0.0, -0.115, 0.016], [0.0, 0.014]], 0.026);
    for (let i = 0; i < 6; i++) o.box('rubber', false, CL.BLK, 0.027, 0.03, -0.1 + i * 0.016, -0.094 + i * 0.016, 0);
    o.box('steel', false, CL.MET, 0.03, 0.046, 0.0, 0.008, -0.002);
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.008, -0.012], [0.17, -0.01], ['q', 0.235, 0.0, 0.25, 0.016], [0.17, 0.018], [0.008, 0.018]], 0.006, 0, null, 0.0014);
    o.box('steel', false, 0x9aa2ab, 0.0066, 0.004, 0.03, 0.15, 0.006); o.to('main');
    Object.assign(d, { len: 0.25, pivot: 0.008 });
  },
  m9(o, d) {
    o.prof('rubber', false, CL.RUB, [[0, -0.016], [-0.025, -0.02], ['q', -0.035, -0.012, -0.045, -0.02], ['q', -0.055, -0.012, -0.065, -0.02], [-0.11, -0.018], ['q', -0.122, 0, -0.11, 0.017], [0, 0.016]], 0.03);
    o.box('steel', false, CL.MET, 0.032, 0.03, -0.122, -0.11, 0.0);
    o.prof('steel', false, CL.MET, [[0.0, -0.028], [0.008, -0.028], [0.008, 0.024], [0.0, 0.024]], 0.034);
    o.add('steel', false, part(torusG(0.011, 0.0032), CL.MET, 0, -0.04, -0.004, 1, 1, 1));
    o.to('slide');
    o.prof('blade', true, 0xd5dbe2, [[0.008, -0.014], [0.19, -0.012], ['q', 0.25, -0.004, 0.27, 0.014], [0.215, 0.014], [0.2, 0.021], [0.008, 0.021]], 0.0065, 0, null, 0.0014);
    for (let i = 0; i < 12; i++) { const f = 0.06 + i * 0.011; o.prof('blade', true, 0xd5dbe2, [[f, 0.02], [f + 0.007, 0.02], [f + 0.0035, 0.027]], 0.004, 0, null, 0.0005); }
    o.box('steel', false, 0x9aa2ab, 0.0068, 0.005, 0.03, 0.17, 0.004);
    o.to('main');
    Object.assign(d, { len: 0.28, pivot: 0.008 });
  },
  butterfly(o, d) {
    const hp = [[0.035, -0.012], [-0.095, -0.012], ['q', -0.1, 0, -0.095, 0.012], [0.035, 0.012]], hole = [[[0.015, -0.005], [-0.08, -0.005], [-0.08, 0.005], [0.015, 0.005]]];
    o.prof('steel', false, CL.STEEL, hp, 0.01, -0.011, hole); o.box('poly', false, CL.DRK, 0.004, 0.018, -0.08, 0.02, 0, -0.017);
    o.to('mag'); o.prof('steel', false, CL.STEEL, hp, 0.01, 0.011, hole); o.box('poly', false, CL.DRK, 0.004, 0.018, -0.08, 0.02, 0, 0.017); o.box('steel', false, CL.MET, 0.03, 0.004, -0.098, -0.085, -0.012);
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.035, -0.011], [0.155, -0.009], ['q', 0.205, 0.0, 0.215, 0.014], [0.165, 0.014], [0.035, 0.014]], 0.006, 0, null, 0.0014);
    o.to('main');
    o.cylX('steel', false, CL.MET, 0.006, 0.036, 0.035, 0.0);
    Object.assign(d, { len: 0.22, pivot: 0.035 });
  },
  flip(o, d) {
    o.prof('poly', false, 0x2b2e33, [[0.03, -0.014], [-0.085, -0.016], ['q', -0.096, 0.0, -0.085, 0.016], [0.03, 0.014]], 0.026);
    o.box('steel', false, CL.STEEL, 0.028, 0.006, -0.08, 0.02, 0.014);
    o.cylX('steel', false, CL.MET, 0.009, 0.032, 0.03, 0.0);
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.03, -0.012], [0.15, -0.01], ['q', 0.195, 0.0, 0.2, 0.016], [0.14, 0.018], [0.03, 0.016]], 0.006, 0, null, 0.0014);
    o.cylX('steel', false, CL.STEEL, 0.004, 0.016, 0.05, 0.014); o.to('main');
    Object.assign(d, { len: 0.2, pivot: 0.03 });
  },
  bear(o, d) {
    o.prof('wood', false, CL.WOOD, [[0.0, -0.018], [-0.11, -0.02], ['q', -0.122, 0.0, -0.11, 0.019], [0.0, 0.018]], 0.032);
    o.box('brass', false, CL.BRASS, 0.034, 0.044, -0.128, -0.11, 0.0);
    o.prof('brass', false, CL.BRASS, [[0.0, -0.034], [0.012, -0.034], [0.012, 0.03], [0.0, 0.03]], 0.04);
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.012, -0.02], [0.2, -0.018], ['q', 0.28, -0.008, 0.3, 0.018], [0.24, 0.012], ['q', 0.21, 0.022, 0.19, 0.026], [0.012, 0.026]], 0.008, 0, null, 0.0016);
    o.box('steel', false, 0x9aa2ab, 0.0082, 0.006, 0.03, 0.17, 0.008); o.to('main');
    Object.assign(d, { len: 0.3, pivot: 0.012 });
  },
  machete(o, d) {
    o.prof('rubber', false, CL.RUB, [[0.0, -0.016], [-0.13, -0.02], ['q', -0.142, 0.0, -0.13, 0.018], [0.0, 0.016]], 0.03);
    o.box('poly', false, CL.BLK, 0.034, 0.04, 0.0, 0.01, 0.0);
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.01, -0.018], [0.4, -0.032], ['q', 0.52, -0.032, 0.53, 0.0], ['q', 0.5, 0.018, 0.45, 0.02], [0.01, 0.014]], 0.005, 0, null, 0.0012); o.to('main');
    Object.assign(d, { len: 0.52, pivot: 0.01 });
  },
  katana(o, d) {
    o.prof('cloth', false, 0x7a1f2b, [[0.0, -0.016], [-0.2, -0.016], ['q', -0.206, 0.0, -0.2, 0.016], [0.0, 0.016]], 0.028);
    for (let i = 0; i < 9; i++) o.prof('cloth', false, 0x111111, [[-0.012 - i * 0.021, 0.0], [-0.022 - i * 0.021, 0.017], [-0.032 - i * 0.021, 0.0], [-0.022 - i * 0.021, -0.017]], 0.03, 0, null, 0.001);
    o.box('brass', false, CL.BRASS, 0.03, 0.034, -0.215, -0.2, 0.0);
    o.cyl('dark', false, CL.BLK, 0.042, 0.0, 0.009, 0.0, 0, 20);
    o.box('brass', false, CL.BRASS, 0.012, 0.03, 0.009, 0.03, 0.0);
    o.to('slide'); o.prof('blade', true, 0xe3e8ee, [[0.012, -0.012], ['q', 0.45, -0.008, 0.82, 0.05], [0.84, 0.064], ['q', 0.82, 0.066, 0.8, 0.064], ['q', 0.45, 0.012, 0.012, 0.016]], 0.0055, 0, null, 0.0012); o.to('main');
    Object.assign(d, { len: 0.86, pivot: 0.012 });
  },
  karambit(o, d) {
    o.prof('poly', false, 0x2b2e33, [[0.02, -0.014], [-0.07, -0.02], ['q', -0.085, -0.02, -0.09, -0.01], [-0.085, 0.012], [0.02, 0.016]], 0.026);
    o.add('steel', false, part(torusG(0.02, 0.0055), CL.STEEL, 0, -0.004, 0.11, 1, 1, 1, 0, Math.PI / 2, 0));
    o.to('slide'); o.prof('blade', true, 0xd5dbe2, [[0.02, 0.016], ['q', 0.12, 0.022, 0.16, -0.06], ['q', 0.172, -0.1, 0.15, -0.132], ['q', 0.138, -0.08, 0.1, -0.042], ['q', 0.06, -0.012, 0.02, -0.012]], 0.006, 0, null, 0.0014); o.to('main');
    Object.assign(d, { len: 0.18, pivot: 0.02 });
  },
};
function buildKnife(model, hasFin) {
  const o = GB(hasFin), d = { len: 0.25, pivot: 0.01 };
  (KNIFE_DEF[model] || KNIFE_DEF.default)(o, d);
  d.groups = {};
  for (const g of ['main', 'mag', 'slide']) { const by = {}; for (const it of o.P[g]) (by[it.key] || (by[it.key] = [])).push(it.p); d.groups[g] = Object.entries(by).map(([key, parts]) => [key, merge(parts)]); }
  return d;
}
function makeKnife(model, fm) {
  const ck = 'k' + model + (fm ? 'F' : 'N');
  const d = gunGeo[ck] || (gunGeo[ck] = buildKnife(model, !!fm));
  const meshes = (list) => { const grp = new THREE.Group(); for (const [key, geo] of list) { const m = new THREE.Mesh(geo, key === 'FIN' ? fm : kindMat(key)); m.castShadow = true; grp.add(m); } return grp; };
  const g = new THREE.Group();
  g.add(meshes(d.groups.main));
  const bp = new THREE.Group(); bp.position.set(0, 0, -d.pivot); g.add(bp);
  const bg = meshes(d.groups.slide); bg.position.set(0, 0, d.pivot); bp.add(bg);
  let h2g = null;
  if (d.groups.mag.length) { h2g = new THREE.Group(); h2g.position.set(0, 0, -d.pivot); g.add(h2g); const hm = meshes(d.groups.mag); hm.position.set(0, 0, d.pivot); h2g.add(hm); }
  g.userData = { muzzle: new THREE.Vector3(0, 0, -d.len), len: d.len, sight: null, mag: null, slide: null, bladePivot: bp, handle2: h2g, knife: KNIFE_DEF[model] ? model : 'default', kind: 'knife', sil: false, grip: new THREE.Vector3(0, 0, 0.045), gripRx: 0 };
  return g;
}

// ---------------------------------------------------------------------
// Руки от первого лица: ладонь, пальцы фалангами обхватывают рукоять, перчатки
// ---------------------------------------------------------------------
const _Y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function bone(out, a, b, ra, rb, col = 0xffffff) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), L = dir.length();
  if (L < 1e-5) return;
  _q.setFromUnitVectors(_Y, dir.normalize()); _e.setFromQuaternion(_q);
  const ratio = Math.round((rb / ra) * 20) / 20, k = 'tc' + ratio;
  const g = geoC[k] || (geoC[k] = nonIdx(new THREE.CylinderGeometry(ratio, 1, 1, 12, 1, true)));
  const mid = A.clone().add(B).multiplyScalar(0.5);
  out.push(part(g, col, mid.x, mid.y, mid.z, ra, L, ra, _e.x, _e.y, _e.z));
}
function ball(out, p, r, col = 0xffffff, sx = 1, sy = 1, sz = 1) { out.push(part(sphG(12, 9), col, p[0], p[1], p[2], r * sx, r * sy, r * sz)); }
function chain(out, pts, r0, r1) { for (let i = 0; i < pts.length; i++) { const r = r0 + (r1 - r0) * (i / Math.max(1, pts.length - 1)); ball(out, pts[i], r); if (i) bone(out, pts[i - 1], pts[i], r0 + (r1 - r0) * ((i - 1) / Math.max(1, pts.length - 1)), r); } }
// Правая кисть, хват рукояти: ось рукояти — локальная Y, указательный палец — на спуске
function gripHand(trigger = true) {
  const palm = [], fing = [];
  ball(palm, [0.024, -0.008, 0.012], 1, 0xffffff, 0.016, 0.044, 0.034);
  ball(palm, [0.022, 0.03, 0.03], 1, 0xffffff, 0.022, 0.028, 0.03); ball(palm, [0.024, 0.012, 0.045], 1, 0xffffff, 0.024, 0.026, 0.024);
  [[-0.004, 0.0085], [-0.024, 0.0082], [-0.043, 0.0074]].forEach(([y, r]) => chain(fing, [[0.03, y, -0.014], [0.024, y - 0.002, -0.04], [0.004, y - 0.004, -0.05], [-0.016, y - 0.004, -0.041]], r, r * 0.85));
  if (trigger) chain(fing, [[0.03, 0.017, -0.014], [0.024, 0.015, -0.044], [0.012, 0.011, -0.064], [0.004, 0.006, -0.073]], 0.0086, 0.0074);
  else chain(fing, [[0.03, 0.016, -0.014], [0.024, 0.014, -0.04], [0.004, 0.012, -0.05], [-0.016, 0.012, -0.041]], 0.0086, 0.0074);
  chain(fing, [[0.022, 0.03, 0.012], [0.002, 0.042, -0.006], [-0.018, 0.038, -0.024], [-0.024, 0.032, -0.038]], 0.011, 0.0085);
  return { palm, fing, wrist: new THREE.Vector3(0.024, 0.012, 0.05) };
}
// Левая кисть под цевьём: ось цевья — локальная Z
function underHand() {
  const palm = [], fing = [];
  ball(palm, [0.002, -0.031, 0.004], 1, 0xffffff, 0.032, 0.013, 0.042);
  [-0.03, -0.012, 0.006, 0.022].forEach((z, i) => chain(fing, [[0.024, -0.027, z], [0.037, -0.006, z - 0.003], [0.033, 0.014, z - 0.005], [0.02, 0.027, z - 0.005]], i === 3 ? 0.0074 : 0.0085, 0.0072));
  chain(fing, [[-0.022, -0.026, 0.032], [-0.033, -0.006, 0.014], [-0.031, 0.012, -0.006]], 0.011, 0.0085);
  return { palm, fing, wrist: new THREE.Vector3(-0.012, -0.046, 0.05) };
}
let clothT = null;
function clothTex() {
  if (clothT) return clothT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 3) { g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; g.fillRect(0, i, 128, 1); g.fillRect(i, 0, 1, 128); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, rnd(0, 128), 128, rnd(2, 6)); }
  clothT = new THREE.CanvasTexture(c); clothT.colorSpace = THREE.SRGBColorSpace; clothT.wrapS = clothT.wrapT = THREE.RepeatWrapping; clothT.repeat.set(2, 3);
  return clothT;
}
export function makeVMHands(w, gun, s, gloveFid) {
  const ud = gun.userData, G = new THREE.Group();
  const gf = gloveFid != null && gloveFid >= 0 && FINISHES[gloveFid] && FINISHES[gloveFid].w === 'gloves' ? FINISHES[gloveFid] : null;
  const gm = gloveMaterial(gf ? gloveFid : -1);
  const skinM = new THREE.MeshStandardMaterial({ color: s.skin, roughness: 0.6 });
  const fingM = gf && gf.model === 'wraps' ? skinM : gm;
  const sleeve = new THREE.MeshStandardMaterial({ color: new THREE.Color(s.shirt).multiplyScalar(0.8), roughness: 0.95, map: clothTex() });
  const cuffCol = gf ? gf.c[gf.model === 'sport' ? 2 : 1] : '#1e1f1d';
  const cuffM = new THREE.MeshStandardMaterial({ color: cuffCol, roughness: 0.7 });
  const addHand = (h, pos, rx, ry, mirror, elbowDir) => {
    const hg = new THREE.Group(); hg.position.copy(pos); hg.rotation.set(rx, ry, 0); if (mirror) hg.scale.x = -1; G.add(hg);
    const pm = new THREE.Mesh(merge(h.palm), gm), fm = new THREE.Mesh(merge(h.fing), fingM); hg.add(pm, fm);
    if (gf && gf.model === 'moto') { const kn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.03), cuffM); kn.position.set(0.032, -0.02, -0.012); hg.add(kn); }
    hg.updateMatrix(); const wr = h.wrist.clone().applyMatrix4(hg.matrix);
    const el = wr.clone().add(elbowDir.clone().multiplyScalar(0.72));
    const len = wr.distanceTo(el), mid = wr.clone().add(el).multiplyScalar(0.5);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.04, len, 16, 1, true), sleeve); arm.position.copy(mid); arm.quaternion.setFromUnitVectors(_Y, el.clone().sub(wr).normalize()); G.add(arm);
    const cl = gf && gf.model === 'specialist' ? 0.075 : 0.045;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, cl, 14), gf && gf.model === 'wraps' ? gm : gf && (gf.model === 'sport' || gf.model === 'specialist') ? cuffM : gm);
    const cdir = el.clone().sub(wr).normalize(); cuff.position.copy(wr).addScaledVector(cdir, cl * 0.35); cuff.quaternion.copy(arm.quaternion); G.add(cuff);
    const wb = new THREE.Mesh(sphG(12, 9), gm); wb.scale.set(0.026, 0.026, 0.026); wb.position.copy(wr); G.add(wb);
  };
  if (w.cat === 'knife') {
    addHand(gripHand(false), new THREE.Vector3(0, 0.0, 0.046), -Math.PI / 2, 0, false, new THREE.Vector3(0.06, 0.24, 0.16));
  } else {
    const gp = ud.grip.clone();
    addHand(gripHand(true), gp, ud.gripRx ?? -0.3, 0, false, w.cat === 'pistol' || w.cat === 'dual' ? new THREE.Vector3(0.12, -0.2, 0.32) : new THREE.Vector3(0.11, -0.24, 0.34));
    if (ud.fore === 'pistol') addHand(gripHand(false), gp.clone().add(new THREE.Vector3(-0.024, -0.014, -0.006)), (ud.gripRx ?? -0.3) + 0.1, 0.25, true, new THREE.Vector3(-0.2, -0.2, 0.3));
    else if (ud.fore === 'dual') addHand(gripHand(true), new THREE.Vector3(-gp.x, gp.y, gp.z), ud.gripRx ?? -0.3, 0, true, new THREE.Vector3(-0.12, -0.2, 0.32));
    else if (ud.foreKind === 'vgrip') addHand(gripHand(false), ud.fore, -0.1, 0, true, new THREE.Vector3(-0.2, -0.24, 0.32));
    else addHand(underHand(), ud.fore, 0, 0, false, new THREE.Vector3(-0.2, -0.26, 0.3));
  }
  G.traverse((o) => { o.frustumCulled = false; });
  return G;
}
// Модель перчаток для карточек в меню
export function makeGloveModel(fid) {
  const s = { skin: '#d9a77c', shirt: '#2b3440' };
  const g = new THREE.Group();
  const h = makeVMHands({ cat: 'knife' }, { userData: {} }, s, fid);
  h.rotation.set(0.2, -0.4, 0); g.add(h);
  return g;
}

// ---------------------------------------------------------------------
// Персонаж: округлые формы (эллипсоиды и сужающиеся «кости»), колени, анимация смерти
// ---------------------------------------------------------------------
const VCOLM = new THREE.MeshLambertMaterial({ vertexColors: true });
function cm(parts) { const m = new THREE.Mesh(merge(parts), VCOLM); m.castShadow = true; m.receiveShadow = true; return m; }
function el(out, col, x, y, z, rx, ry, rz, ax = 0, ay = 0, az = 0) { out.push(part(sphG(14, 10), col, x, y, z, rx, ry, rz, ax, ay, az)); }
function limb(out, col, a, b, ra, rb) { ball(out, a, ra, col); ball(out, b, rb, col); bone(out, a, b, ra, rb, col); }
function bx3(out, col, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { out.push(part(BOXG, col, x, y, z, w, h, d, rx, ry, rz)); }
const TEAMC = [0x4ea1ff, 0xff5a5a];

export function makeCharacter(skinId, team, wid, fid) {
  const s = SKINS[skinId] || SKINS[0], fem = s.female, tcol = TEAMC[team] ?? 0x888888;
  const root = new THREE.Group(), fall = new THREE.Group(), tilt = new THREE.Group(), body = new THREE.Group();
  root.add(fall); fall.add(tilt); tilt.add(body);
  body.scale.setScalar(fem ? 0.95 : 1);
  const pants = s.vest, sw = fem ? 0.84 : 1;
  // ноги: бедро → колено → голень и ботинок
  const legs = [], shins = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1 * sw, 0.92, 0); body.add(hip);
    const th = []; limb(th, pants, [0, 0, 0], [0, -0.43, -0.01], 0.098 * (fem ? 1.02 : 1), 0.07); el(th, pants, sx * 0.04, -0.2, -0.0, 0.05, 0.075, 0.05); bx3(th, 0x2b2620, 0.06, 0.08, 0.02, sx * 0.075, -0.2, 0.0);
    th.push(...[]);
    hip.add(cm(th));
    const knee = new THREE.Group(); knee.position.set(0, -0.43, -0.01); hip.add(knee);
    const sh = []; limb(sh, pants, [0, 0, 0], [0, -0.36, 0.0], 0.07, 0.056); el(sh, new THREE.Color(pants).multiplyScalar(0.7).getHex(), 0, -0.02, -0.045, 0.058, 0.065, 0.04);
    limb(sh, s.boots, [0, -0.33, 0.0], [0, -0.44, -0.0], 0.06, 0.062); el(sh, s.boots, 0, -0.45, -0.06, 0.066, 0.05, 0.12); bx3(sh, 0x141414, 0.13, 0.03, 0.27, 0, -0.485, -0.05);
    knee.add(cm(sh));
    legs.push(hip); shins.push(knee);
  }
  // таз, торс, жилет, подсумки
  const tp = [];
  el(tp, pants, 0, 0.95, 0, 0.17 * sw * (fem ? 1.08 : 1), 0.11, 0.12);
  el(tp, 0x2b2620, 0, 1.03, 0, 0.18 * sw, 0.035, 0.13);
  el(tp, s.shirt, 0, 1.16, 0, 0.17 * sw * (fem ? 0.84 : 1), 0.16, 0.125);
  el(tp, s.shirt, 0, 1.34, 0, 0.225 * sw, 0.15, 0.135);
  el(tp, s.vest, 0, 1.26, 0, 0.225 * sw, 0.2, 0.152);
  for (const sx of [-1, 1]) bx3(tp, new THREE.Color(s.vest).multiplyScalar(0.7).getHex(), 0.05, 0.36, 0.31, sx * 0.1 * sw, 1.3, 0);
  for (const x of [-0.07, 0, 0.07]) bx3(tp, s.vest, 0.06, 0.08, 0.04, x * sw, 1.16, -0.145);
  for (const x of [-0.07, 0, 0.07]) bx3(tp, 0x2b2620, 0.062, 0.012, 0.042, x * sw, 1.2, -0.146);
  bx3(tp, tcol, 0.16, 0.05, 0.01, 0, 1.36, 0.15);
  for (const sx of [-1, 1]) el(tp, s.vest, sx * 0.19 * sw, 1.42, 0, 0.075, 0.05, 0.08);
  limb(tp, s.skin, [0, 1.43, 0], [0, 1.53, -0.005], 0.052, 0.048);
  body.add(cm(tp));
  // верх (наклон по взгляду): голова, руки, оружие
  const upper = new THREE.Group(); upper.position.y = 1.35; body.add(upper);
  const head = new THREE.Group(); head.position.y = 0.27; upper.add(head);
  const hp = [];
  el(hp, s.skin, 0, 0.03, 0, 0.098, 0.118, 0.108);
  el(hp, s.skin, 0, -0.04, -0.03, 0.074, 0.055, 0.075);
  el(hp, s.skin, 0, 0.02, -0.106, 0.018, 0.03, 0.02);
  for (const sx of [-1, 1]) { el(hp, s.skin, sx * 0.098, 0.02, 0.0, 0.015, 0.03, 0.022); el(hp, 0xffffff, sx * 0.036, 0.05, -0.092, 0.016, 0.01, 0.008); el(hp, 0x1a1a1a, sx * 0.036, 0.05, -0.098, 0.008, 0.008, 0.005); bx3(hp, s.hair, 0.035, 0.008, 0.01, sx * 0.037, 0.071, -0.099, 0, 0, sx * 0.12); }
  el(hp, 0x8a4a40, 0, -0.035, -0.098, 0.025, 0.006, 0.008);
  switch (s.hat) {
    case 'helmet': el(hp, s.hatColor, 0, 0.085, 0.005, 0.124, 0.098, 0.132); el(hp, s.hatColor, 0, 0.045, 0.005, 0.13, 0.02, 0.138); bx3(hp, 0x222222, 0.05, 0.03, 0.03, 0, 0.14, -0.12); break;
    case 'cap': el(hp, s.hatColor, 0, 0.1, 0.005, 0.108, 0.065, 0.114); bx3(hp, s.hatColor, 0.17, 0.012, 0.1, 0, 0.088, -0.13, 0.08); break;
    case 'beanie': el(hp, s.hatColor, 0, 0.1, 0.01, 0.11, 0.085, 0.116); el(hp, s.hatColor, 0, 0.065, 0.005, 0.112, 0.025, 0.118); break;
    case 'mask': el(hp, s.hatColor, 0, 0.03, 0.002, 0.104, 0.124, 0.113); el(hp, s.hatColor, 0, -0.04, -0.03, 0.08, 0.06, 0.08); bx3(hp, 0xe74c3c, 0.13, 0.016, 0.012, 0, 0.05, -0.105); break;
    default:
      el(hp, s.hair, 0, 0.085, 0.012, 0.104, 0.075, 0.112);
      if (fem) { el(hp, s.hair, 0, 0.0, 0.05, 0.106, 0.14, 0.075); for (const sx of [-1, 1]) el(hp, s.hair, sx * 0.09, -0.02, 0.02, 0.03, 0.12, 0.07); limb(hp, s.hair, [0, 0.04, 0.12], [0, -0.18, 0.15], 0.035, 0.02); }
  }
  head.add(cm(hp));
  const arms = new THREE.Group(); upper.add(arms);
  const gun = makeGun(wid, fid); gun.position.set(0.1, -0.08, -0.22); arms.add(gun);
  const W2 = WEAPONS[wid], gu = gun.userData;
  const ap = [];
  const shR = [0.2 * sw, 0.07, 0], shL = [-0.2 * sw, 0.07, 0];
  const gp = gun.position;
  const hR = [gp.x + (gu.grip ? gu.grip.x : 0), gp.y + (gu.grip ? gu.grip.y : -0.05), gp.z + (gu.grip ? gu.grip.z : 0.03)];
  let hL;
  if (W2 && (W2.cat === 'pistol' || W2.cat === 'dual' || W2.cat === 'knife')) hL = [hR[0] - 0.04, hR[1] - 0.01, hR[2] - 0.01];
  else { const f = gu.fore && gu.fore.isVector3 ? gu.fore : new THREE.Vector3(0, -0.02, -0.3); hL = [gp.x + f.x, gp.y + f.y - 0.02, gp.z + f.z]; }
  for (const [sh, hd, side] of [[shR, hR, 1], [shL, hL, -1]]) {
    const elb = [(sh[0] + hd[0]) / 2 + side * 0.09, (sh[1] + hd[1]) / 2 - 0.16, (sh[2] + hd[2]) / 2 + 0.06];
    limb(ap, s.shirt, sh, elb, 0.066, 0.054); limb(ap, s.shirt, elb, hd, 0.052, 0.04);
    el(ap, tcol, sh[0] + side * 0.01, sh[1] - 0.06, sh[2], 0.06, 0.035, 0.062);
    ball(ap, hd, 0.042, 0x2a2826);
  }
  arms.add(cm(ap));
  root.userData = { legs, shins, upper, head, body, fall, tilt, arms, gun, gunPos: gun.position.clone(), gunRot: gun.rotation.clone(), wid, skin: skinId, team, phase: 0, dead: false, deadT: 0 };
  return root;
}

const U_ = 1 / 24;
export function poseCharacter(ch, o, dt) {
  const u = ch.userData;
  ch.position.set(o.x * U_, o.z * U_, o.y * U_);
  ch.rotation.y = -o.yaw - Math.PI / 2;
  if (o.alive) {
    if (u.dead) {
      u.dead = false; u.deadT = 0; u.fall.rotation.set(0, 0, 0); u.tilt.rotation.set(0, 0, 0); u.body.rotation.set(0, 0, 0); u.head.rotation.set(0, 0, 0);
      u.arms.add(u.gun); u.gun.position.copy(u.gunPos); u.gun.rotation.copy(u.gunRot);
    }
    u.upper.rotation.set(Math.max(-1.1, Math.min(1.1, o.pitch)), 0, 0);
    const sp = o.moving ? 1 : 0;
    u.phase += dt * (o.mv === 1 ? 6 : 9) * sp;
    const ph = u.phase, amp = o.mv === 1 ? 0.35 : 0.55;
    u.legs[0].rotation.x = Math.sin(ph) * amp * sp; u.legs[1].rotation.x = -Math.sin(ph) * amp * sp;
    u.shins[0].rotation.x = -Math.max(0, -Math.cos(ph)) * 0.9 * sp; u.shins[1].rotation.x = -Math.max(0, Math.cos(ph)) * 0.9 * sp;
    u.body.position.y = -Math.abs(Math.cos(ph)) * 0.035 * sp;
    u.body.rotation.y = Math.sin(ph) * 0.05 * sp;
    u.cr = (u.cr || 0) + ((o.cr ? 1 : 0) - (u.cr || 0)) * Math.min(1, dt * 12);
    if (u.cr > 0.01) {
      u.body.position.y -= u.cr * 0.34;
      u.legs[0].rotation.x = u.legs[0].rotation.x * 0.4 + u.cr * 1.05; u.legs[1].rotation.x = u.legs[1].rotation.x * 0.4 + u.cr * 0.75;
      u.shins[0].rotation.x = -u.cr * 1.75; u.shins[1].rotation.x = -u.cr * 1.25;
      u.upper.rotation.x += u.cr * 0.12;
    }
    return;
  }
  // ---- смерть: колени подгибаются, тело падает в сторону удара, оружие выпадает
  if (!u.dead) {
    u.dead = true; u.deadT = 0;
    const a = o.fallA ?? (o.yaw + Math.PI + (Math.random() - 0.5) * 1.2);
    let fy = Math.PI / 2 - a - ch.rotation.y; fy = Math.atan2(Math.sin(fy), Math.cos(fy));
    u.fall.rotation.y = fy; u.body.rotation.y = -fy; u.hs = !!o.hs;
    ch.updateMatrixWorld(true); ch.attach(u.gun);
    u.gv = new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.4, (Math.random() - 0.5) * 1.2); u.gs = (Math.random() - 0.5) * 8;
  }
  u.deadT += dt;
  const t = u.deadT, k1 = Math.min(1, t / 0.22);
  const t2 = Math.max(0, t - 0.1), T = 0.5;
  let th = t2 < T ? (Math.PI / 2) * Math.pow(t2 / T, 2) : Math.PI / 2 - (t2 - T < 0.24 ? Math.sin(((t2 - T) / 0.24) * Math.PI) * 0.09 : 0);
  u.tilt.rotation.x = th;
  const lay = th / (Math.PI / 2);
  u.legs[0].rotation.x = 0.6 * k1 * (1 - lay) + 0.15 * lay; u.legs[1].rotation.x = 0.35 * k1 * (1 - lay) - 0.1 * lay;
  u.shins[0].rotation.x = -1.1 * k1 * (1 - lay) - 0.1 * lay; u.shins[1].rotation.x = -0.7 * k1 * (1 - lay) - 0.25 * lay;
  u.body.position.y = -0.2 * k1 * (1 - lay);
  u.upper.rotation.x = u.hs ? -0.9 * Math.min(1, t / 0.12) * (1 - lay * 0.4) : -0.5 * lay;
  u.head.rotation.z = 0.35 * lay; u.head.rotation.x = u.hs ? -0.4 : 0.15 * lay;
  // оружие
  const g = u.gun;
  if (g.parent === ch) {
    u.gv.y -= 9.8 * dt; g.position.addScaledVector(u.gv, dt); g.rotation.z += u.gs * dt; g.rotation.x += u.gs * 0.5 * dt;
    if (g.position.y < 0.04) { g.position.y = 0.04; u.gv.y *= -0.25; u.gv.x *= 0.5; u.gv.z *= 0.5; u.gs *= 0.4; g.rotation.z += (Math.PI / 2 - g.rotation.z) * Math.min(1, dt * 10); g.rotation.x *= 0.8; }
  }
  if (t > 5.2) ch.position.y -= Math.min(0.7, (t - 5.2) * 0.6);
}
