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
  // ---- метро
  tilewall(g, s) { g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, s, s); const n = 8, m = 16; for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { const v = rnd(222, 238); g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x * s / n + 1, y * s / m + 1, s / n - 2, s / m - 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x * s / n + 2, y * s / m + 2, s / n - 5, 2); } g.fillStyle = '#2e6b4f'; g.fillRect(0, s * 0.62, s, s / m * 1.6); g.fillStyle = '#c9a227'; g.fillRect(0, s * 0.62 + 2, s, 3); g.fillRect(0, s * 0.62 + s / m * 1.6 - 5, s, 3); noise(g, s, 900, 0.12); blobs(g, s, 5, ['rgba(60,50,30,0.12)'], 10, 40); },
  ballast(g, s) { g.fillStyle = '#4b4741'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1600; i++) { const v = rnd(50, 110); g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(2, 5), rnd(1.5, 4), rnd(0, 3), 0, 7); g.fill(); } },
  platformC(g, s) { g.fillStyle = '#8f8c86'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.1); noise(g, s, 1500, 0.06, 1); blobs(g, s, 10, ['rgba(30,25,20,0.12)', 'rgba(20,20,20,0.08)'], 4, 18); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); },
  ceilM(g, s) { g.fillStyle = '#5d5f5c'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.12); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, 6, s); blobs(g, s, 8, ['rgba(40,30,20,0.18)'], 10, 30); },
  pillarG(g, s) { g.fillStyle = '#2f4a3a'; g.fillRect(0, 0, s, s); noise(g, s, 2000, 0.15); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 8; y < s; y += 22) for (let x = 10; x < s; x += 40) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } g.fillStyle = '#e8e0c8'; g.fillRect(0, s * 0.4, s, 26); g.fillStyle = '#111'; g.font = 'bold 20px sans-serif'; g.fillText('14 ST', s * 0.3, s * 0.4 + 20); },
  tunnel(g, s) { const gr = g.createRadialGradient(s / 2, s * 0.7, 4, s / 2, s * 0.6, s * 0.7); gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#0b0b0b'); gr.addColorStop(1, '#2a2826'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
  // ---- Баку
  lime(g, s) { g.fillStyle = '#c9b48b'; g.fillRect(0, 0, s, s); const rows = 6; for (let y = 0; y < rows; y++) { const off = (y % 2) * s / 6; for (let x = -1; x < 4; x++) { g.fillStyle = `hsl(${rnd(36, 42)},${rnd(28, 40)}%,${rnd(62, 72)}%)`; g.fillRect(x * s / 3 + off + 2, y * s / rows + 2, s / 3 - 4, s / rows - 4); } } noise(g, s, 3500, 0.1); blobs(g, s, 10, ['rgba(110,90,60,0.12)'], 8, 26); },
  lime2(g, s) { g.fillStyle = '#d8c7a2'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.08); blobs(g, s, 14, ['rgba(150,120,80,0.12)', 'rgba(255,255,255,0.12)'], 10, 40); },
  fort(g, s) { g.fillStyle = '#a99670'; g.fillRect(0, 0, s, s); for (let y = 0; y < 5; y++) { let x = -rnd(0, 40); while (x < s) { const w = rnd(40, 80); g.fillStyle = `hsl(${rnd(34, 42)},${rnd(22, 32)}%,${rnd(52, 64)}%)`; g.beginPath(); g.roundRect(x + 2, y * s / 5 + 2, w - 4, s / 5 - 4, 6); g.fill(); x += w; } } noise(g, s, 4000, 0.12); blobs(g, s, 12, ['rgba(70,60,40,0.15)'], 8, 30); },
  cobble(g, s) { g.fillStyle = '#7d715d'; g.fillRect(0, 0, s, s); for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { g.fillStyle = `hsl(${rnd(32, 40)},${rnd(14, 24)}%,${rnd(52, 66)}%)`; g.beginPath(); g.roundRect(x * s / 10 + (y % 2) * s / 20 + 2, y * s / 10 + 2, s / 10 - 4, s / 10 - 4, 5); g.fill(); } noise(g, s, 2000, 0.1); },
  kir(g, s) { g.fillStyle = '#2b2a28'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.12, 1); blobs(g, s, 10, ['rgba(0,0,0,0.25)'], 10, 40); },
  carpet(g, s) { g.fillStyle = '#8e1b1b'; g.fillRect(0, 0, s, s); g.strokeStyle = '#e8c070'; g.lineWidth = 8; g.strokeRect(10, 10, s - 20, s - 20); g.strokeStyle = '#1f2a5a'; g.lineWidth = 5; g.strokeRect(24, 24, s - 48, s - 48); for (let i = 0; i < 3; i++) { const cy = s * (0.3 + i * 0.2); g.fillStyle = i % 2 ? '#1f2a5a' : '#e8c070'; g.beginPath(); g.moveTo(s / 2, cy - 22); g.lineTo(s / 2 + 34, cy); g.lineTo(s / 2, cy + 22); g.lineTo(s / 2 - 34, cy); g.closePath(); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(s / 2, cy - 10); g.lineTo(s / 2 + 15, cy); g.lineTo(s / 2, cy + 10); g.lineTo(s / 2 - 15, cy); g.fill(); } for (let i = 0; i < 40; i++) { g.fillStyle = ['#e8c070', '#1f2a5a', '#2e7d32'][i % 3]; g.fillRect(rnd(30, s - 40), rnd(30, s - 40), 6, 6); } },
  // ---- зона боевых действий
  ruin(g, s) {
    g.fillStyle = '#a89f90'; g.fillRect(0, 0, s, s); noise(g, s, 4000, 0.12); noise(g, s, 1500, 0.07, 1);
    blobs(g, s, 12, ['rgba(90,80,70,0.12)', 'rgba(200,190,170,0.1)'], 12, 40);
    // отбитая штукатурка — под ней тёмный кирпич (рваные края)
    for (let i = 0; i < 4; i++) {
      const x = rnd(20, s - 20), y = rnd(20, s - 20), r = rnd(12, 30);
      const pts = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, rr = r * rnd(0.45, 1.25); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.8]); }
      g.save(); g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px, py)); g.closePath(); g.clip();
      g.fillStyle = '#6a5a4c'; g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      for (let yy = y - r * 1.5; yy < y + r * 1.5; yy += 8) for (let xx = x - r * 2 - ((Math.floor(yy / 8)) % 2) * 8; xx < x + r * 2; xx += 16) { g.fillStyle = `hsl(${rnd(8, 18)},${rnd(18, 30)}%,${rnd(28, 38)}%)`; g.fillRect(xx + 1, yy + 1, 14, 6); }
      g.restore();
      g.strokeStyle = 'rgba(235,225,205,0.45)'; g.lineWidth = 1.2; g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px + 1, py + 1)); g.closePath(); g.stroke();
    }
    // выбоины от пуль и осколков
    for (let i = 0; i < 30; i++) { const x = rnd(0, s), y = rnd(0, s), r = rnd(1.2, 3.5); g.fillStyle = 'rgba(200,190,175,0.4)'; g.beginPath(); g.arc(x, y, r * 1.8, 0, 7); g.fill(); g.fillStyle = 'rgba(35,30,26,0.8)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    // трещины
    g.strokeStyle = 'rgba(45,38,32,0.6)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { let x = rnd(0, s), y = rnd(0, s); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rnd(-12, 12); y += rnd(4, 14); g.lineTo(x, y); } g.stroke(); }
    const gr = g.createLinearGradient(0, s, 0, 0); gr.addColorStop(0, 'rgba(20,18,16,0.3)'); gr.addColorStop(0.6, 'rgba(20,18,16,0.0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  },
  barrier(g, s) {
    g.fillStyle = '#7f7c77'; g.fillRect(0, 0, s, s); noise(g, s, 5000, 0.12); noise(g, s, 1500, 0.07, 1);
    g.strokeStyle = 'rgba(30,28,26,0.55)'; g.lineWidth = 3; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.stroke(); }
    g.fillStyle = 'rgba(30,28,26,0.3)'; g.fillRect(0, s * 0.82, s, s * 0.18);
    for (let i = 0; i < 18; i++) { const x = rnd(0, s), y = rnd(0, s); g.fillStyle = 'rgba(40,36,30,0.6)'; g.beginPath(); g.arc(x, y, rnd(1.5, 3.5), 0, 7); g.fill(); }
    g.fillStyle = 'rgba(230,200,40,0.55)'; for (let x = 0; x < s; x += 64) { g.save(); g.translate(x, s * 0.9); g.transform(1, 0, -0.6, 1, 0, 0); g.fillRect(0, -8, 22, 16); g.restore(); }
  },
  asphaltWar(g, s) {
    g.fillStyle = '#55524d'; g.fillRect(0, 0, s, s); noise(g, s, 7000, 0.14); noise(g, s, 2500, 0.07, 1);
    blobs(g, s, 10, ['rgba(160,140,110,0.18)', 'rgba(30,28,26,0.25)'], 14, 50);
    g.strokeStyle = 'rgba(25,22,20,0.7)'; g.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) { let x = rnd(0, s), y = rnd(0, s); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += rnd(-18, 18); y += rnd(-18, 18); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${rnd(120, 170)},${rnd(110, 150)},${rnd(90, 130)},0.8)`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 4), rnd(1, 3)); }
    g.fillStyle = 'rgba(230,230,220,0.35)'; g.fillRect(s * 0.48, 0, 5, s * 0.4); g.fillRect(s * 0.48, s * 0.6, 5, s * 0.3);
  },
  burnt(g, s) {
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, s, s);
    blobs(g, s, 26, ['#5a3420', '#7a4a2a', '#3a3632', '#1a1816', '#8a5a34'], 6, 30); noise(g, s, 5000, 0.25); noise(g, s, 1200, 0.12, 1);
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(200,190,170,0.25)'; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(3, 12), rnd(2, 6), rnd(0, 3), 0, 7); g.fill(); }
  },
  bronze(g, s) { g.fillStyle = '#5a4630'; g.fillRect(0, 0, s, s); blobs(g, s, 20, ['rgba(70,120,100,0.35)', 'rgba(30,22,14,0.3)', 'rgba(120,90,50,0.3)'], 6, 30); noise(g, s, 3000, 0.15); },
  granite(g, s) { g.fillStyle = '#6b5f5a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 6000; i++) { const v = rnd(40, 150); g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.85},0.6)`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(1, 3)); } g.strokeStyle = 'rgba(20,18,16,0.6)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s / 2 - 2); g.strokeRect(1, s / 2 + 1, s - 2, s / 2 - 2); },
  crater(g, s) {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(15,12,10,0.95)'); gr.addColorStop(0.45, 'rgba(40,34,28,0.85)'); gr.addColorStop(0.62, 'rgba(110,95,75,0.7)'); gr.addColorStop(1, 'rgba(60,55,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) { const a = rnd(0, 6.28), r = rnd(s * 0.3, s * 0.5); g.fillStyle = `rgba(${rnd(60, 140)},${rnd(55, 120)},${rnd(45, 100)},0.9)`; g.fillRect(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, rnd(1, 4), rnd(1, 4)); }
  },
  reddot(g, s) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,40,40,1)'); gr.addColorStop(0.35, 'rgba(255,0,0,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); },
};
const SMALL = { crater: 1, hole: 1, soft: 1, flash: 1, blood: 1, leaf: 1, reddot: 1, spark: 1, smoke: 1, flare: 1 };
DRAW.spark = (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.2, 'rgba(255,220,140,0.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); };
DRAW.smoke = (g, s) => { for (let i = 0; i < 9; i++) { const x = s / 2 + rnd(-s / 6, s / 6), y = s / 2 + rnd(-s / 6, s / 6), r = rnd(s / 5, s / 2.6); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); } };
DRAW.flare = (g, s) => { g.translate(s / 2, s / 2); const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, 'rgba(255,170,60,0)'); gr.addColorStop(0.3, 'rgba(255,200,110,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,230,1)'); gr.addColorStop(0.7, 'rgba(255,200,110,0.9)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -s / 2); g.quadraticCurveTo(s * 0.16, 0, 0, s / 2); g.quadraticCurveTo(-s * 0.16, 0, 0, -s / 2); g.fill(); };
// «Старение» текстуры: крупные пятна, мелкое зерно, подтёки — убирает мультяшную чистоту цветов
const STREAKS = { barrier: 1, plaster: 1, plasterWhite: 1, brick: 1, brickDark: 1, concrete: 1, stone: 1, sandstone: 1, adobe: 1, siding: 1, lime: 1, lime2: 1, fort: 1, tilewall: 1, metal: 1, ruin: 1, ruin2: 1, station: 1, mall: 1, uni: 1 };
const NOWEATHER = { carpet: 1, snow: 1 };
function weather(key, g, s) {
  let sd = 0; for (const ch of key) sd = (sd * 31 + ch.charCodeAt(0)) | 0;
  const R = () => { sd = (sd * 16807) % 2147483647; return Math.abs(sd) / 2147483647; };
  // крупные тональные пятна (бесшовно)
  for (let i = 0; i < 9; i++) {
    const x = R() * s, y = R() * s, r = s * (0.15 + R() * 0.3), dark = R() < 0.6;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, dark ? 'rgba(20,15,10,0.13)' : 'rgba(255,250,240,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  if (STREAKS[key]) for (let i = 0; i < 14; i++) { const x = R() * s, w = 2 + R() * 6, l = s * (0.2 + R() * 0.7), gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(25,20,15,0.18)'); gr.addColorStop(1, 'rgba(25,20,15,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, l); }
  // мелкое зерно на каждый пиксель
  const im = g.getImageData(0, 0, s, s), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 16; d[i] = d[i] + n; d[i + 1] = d[i + 1] + n; d[i + 2] = d[i + 2] + n; }
  g.putImageData(im, 0, 0);
}
function canvasOf(key) {
  if (canvases[key]) return canvases[key];
  const c = document.createElement('canvas'); c.width = c.height = SMALL[key] ? 128 : 256;
  const g = c.getContext('2d'); DRAW[key](g, c.width);
  if (!SMALL[key] && !NOWEATHER[key]) { g.setTransform(1, 0, 0, 1, 0, 0); weather(key, g, c.width); }
  canvases[key] = c; return c;
}
const texCache = {};
export function tex(key) {
  if (texCache[key]) return texCache[key];
  const t = new THREE.CanvasTexture(canvasOf(key)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[key] = t);
}
// Материал с UV в мировых координатах: текстура не растягивается на высоких стенах
const wmCache = {};
let curQ = 'medium';
const SHINY = { tiles: 0.55, tilewall: 0.35, platformC: 0.8, asphalt: 0.85, metal: 0.5, snow: 0.6, woodFloor: 0.7 };
export function worldMat(key, size, opts = {}) {
  const k = key + size + JSON.stringify(opts) + curQ;
  if (wmCache[k]) return wmCache[k];
  const pbr = curQ !== 'low';
  const m = pbr ? new THREE.MeshStandardMaterial(Object.assign({ map: tex(key), bumpMap: tex(key), bumpScale: 2.2, roughness: SHINY[key] ?? 0.93, metalness: 0, envMapIntensity: 0.18 }, opts))
    : new THREE.MeshLambertMaterial(Object.assign({ map: tex(key) }, opts));
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
      #ifdef USE_BUMPMAP
      vBumpMapUv = vMapUv;
      #endif
      #ifdef USE_EMISSIVEMAP
      vEmissiveMapUv = vMapUv;
      #endif
      #endif`);
  };
  m.customProgramCacheKey = () => 'wm' + size + (pbr ? 'p' : 'l');
  return (wmCache[k] = m);
}

// ---------------------------------------------------------------------
// Слияние простых деталей в одну геометрию с цветами вершин (меньше вызовов отрисовки)
// ---------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed();
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed();
const SPH = new THREE.SphereGeometry(1, 10, 7).toNonIndexed();
// «пышная» крона: икосаэдр с рваными вершинами (сглаженные нормали по позиции)
const LEAF = (() => {
  const g = new THREE.IcosahedronGeometry(1, 2); const P = g.attributes.position, v = new THREE.Vector3(), mp = new Map();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const k = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3); if (!mp.has(k)) mp.set(k, 0.78 + Math.random() * 0.38); v.multiplyScalar(mp.get(k)); P.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); const n = g; const N = n.attributes.normal, Q = n.attributes.position;
  for (let i = 0; i < N.count; i++) { v.fromBufferAttribute(Q, i).normalize(); const nx = N.getX(i) * 0.4 + v.x * 0.6, ny = N.getY(i) * 0.4 + v.y * 0.6, nz = N.getZ(i) * 0.4 + v.z * 0.6, l = Math.hypot(nx, ny, nz); N.setXYZ(i, nx / l, ny / l, nz / l); }
  return n;
})();
const TRUNKG = new THREE.CylinderGeometry(0.7, 1, 1, 9).toNonIndexed();
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
  metro: { wall: 'tilewall', wall2: 'tilewall', tower: 'tilewall', border: 'tilewall', slab: 'platformC', roof: 'ceilM', roof2: 'ceilM', ground: 'ballast', floorIn: 'platformC', sky: 0x111111, horizon: 0x15161a, fog: 0x17181d, fogNear: 30, fogFar: 110, sun: 0xfff1d6, sunI: 0.15, hemiS: 0xe6eef5, hemiG: 0x4a463e, hemiI: 1.35, trim: 0x2e3a33, tree: [0x333333], bush: [0x3a3a3a], truck: 0x555555, weather: 'none', indoor: true },
  baku: { wall: 'lime', wall2: 'lime2', tower: 'lime', border: 'fort', slab: 'woodFloor', roof: 'kir', roof2: 'kir', ground: 'cobble', floorIn: 'tiles', sky: 0x3f6db3, horizon: 0xffb27a, fog: 0xe9b08c, fogNear: 80, fogFar: 820, skyR: 950, far: 1600, sun: 0xffc286, sunI: 2.7, hemiS: 0xffe2c4, hemiG: 0x7a6040, hemiI: 1.15, trim: 0x6b4a2a, tree: [0x3f6a2a, 0x4f7a32, 0x355a24], bush: [0x5d7a3a, 0x4c6a30], truck: 0x4b5a3a, weather: 'pollen', baku: true },
  warzone: { wall: 'ruin', wall2: 'ruin', tower: 'ruin', border: 'barrier', slab: 'platformC', roof: 'roofFlat', roof2: 'roofFlat', ground: 'asphaltWar', floorIn: 'tiles', sky: 0x7a848e, horizon: 0xbdb2a0, fog: 0xa69d90, fogNear: 55, fogFar: 420, skyR: 760, far: 1100, sun: 0xffd6a8, sunI: 2.0, hemiS: 0xd2d5d8, hemiG: 0x5a5046, hemiI: 1.2, trim: 0x3a3632, tree: [0x4a5a32, 0x56663a, 0x3f4c2a], bush: [0x4a5a32], truck: 0x4b5a3a, weather: 'dust', war: true, cloud: 0x8a8a8a },
  winter: { wall: 'logs', wall2: 'plasterWhite', tower: 'stone', border: 'stone', slab: 'woodFloor', roof: 'roofSnow', roof2: 'roofSnow', ground: 'snow', floorIn: 'woodFloor', sky: 0xb7cde0, horizon: 0xe9f1f8, fog: 0xdfe9f2, sun: 0xeef5ff, sunI: 2.0, hemiS: 0xf0f6ff, hemiG: 0x9aa8b6, hemiI: 1.5, trim: 0x3a2a1c, tree: [0x2f5a3c, 0x3a6a48], bush: [0xe8eef4], truck: 0x4f5a48, weather: 'snow' },
};

// ---------------------------------------------------------------------
// Мир карты
// ---------------------------------------------------------------------
export function buildWorld(scene, map, quality) {
  curQ = quality;
  seed = 12345 + map.name.length * 777;
  const th = THEMES[map.theme];
  const root = new THREE.Group(); scene.add(root);
  const TL = C.TILE * U;
  const cx = map.pw * U / 2, cz0 = map.ph * U / 2;
  // небо: градиент
  const skyGeo = new THREE.SphereGeometry(th.skyR || 300, 32, 16);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color(th.sky) }, bot: { value: new THREE.Color(th.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }' });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.position.set(cx, 0, cz0); root.add(sky);
  scene.background = new THREE.Color(th.horizon);
  scene.fog = new THREE.Fog(th.fog, th.fogNear ?? 45, th.fogFar ?? 150);

  const hemi = new THREE.HemisphereLight(th.hemiS, th.hemiG, th.hemiI); root.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunI);
  sun.position.set(cx - 35, 50, cz0 - 25); sun.target.position.set(cx, 0, cz0); root.add(sun, sun.target);
  if (th.baku) sun.position.set(cx - 70, 30, cz0 + 38);
  if (th.war) sun.position.set(cx + 40, 34, cz0 - 30);
  if (quality !== 'low' && !th.indoor) {
    sun.castShadow = true; const sz = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  }

  // земля
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.pw * U + (th.baku ? 40 : th.war ? 600 : 260), map.ph * U + (th.baku ? 40 : th.war ? 600 : 260)), worldMat(th.ground, th.indoor ? 3 : 4));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, cz0); ground.receiveShadow = true; root.add(ground);
  const SKIP = { bcar: 1, bus: 1, hedge: 1, rubble: 1, statue: 1, train: 1, trainfloor: 1, wreck: 1, mtower: 1, bench: 1, vend: 1, trash: 1, stall: 1, ceil: 1 };

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
      else if (m === 'cab' || m === 'bed' || SKIP[m]) continue;
      else add(m, x, y, r[0], r[1]);
    }
    if (c.ramp) add('ramp', x, y, c.ramp.z0, c.ramp.z1);
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const o3 = new THREE.Object3D();
  const MAT = {
    wall: worldMat(th.wall, 3), wall2: worldMat(th.wall2, 3), tower: worldMat(th.tower, 3), border: worldMat(th.border, 3),
    slab: worldMat(th.slab, 2.5), roof: worldMat(th.roof, 3),
    ruin: worldMat('ruin', 3), barrier: worldMat('barrier', 3),
    platform: worldMat('platformC', 2.5), pillar: worldMat('pillarG', 4), tunnel: worldMat('tunnel', 4), tilewall: worldMat('tilewall', 3), fort: worldMat('fort', 4),
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
    list.forEach(([x, y, z, s], i) => { o3.position.set((x + 0.5) * TL, (z + 13) * U, (y + 0.5) * TL); o3.rotation.set(0, 0, 0); o3.scale.set(TL * s, 26 * U, TL * s); o3.updateMatrix(); m.setMatrixAt(i, o3.matrix); });
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
    } else if (th.baku) {
      treeParts.push(cyY(0.17 * s, 2.6 * s, px, 1.3 * s, pz, 0x5a4330));
      for (let i = 0; i < 6; i++) treeParts.push(part(LEAF, th.tree[i % th.tree.length], px + srnd(-0.8, 0.8) * s, (3.0 + srnd(-0.3, 1.0)) * s, pz + srnd(-0.8, 0.8) * s, srnd(1.0, 1.5) * s, srnd(0.8, 1.2) * s, srnd(1.0, 1.5) * s));
      for (let i = 0; i < 10; i++) treeParts.push(part(SPH, 0xb3202a, px + srnd(-1.3, 1.3) * s, (2.6 + srnd(0, 1.6)) * s, pz + srnd(-1.3, 1.3) * s, 0.09, 0.09, 0.09));
    } else {
      treeParts.push(part(CYL, 0x4e3620, px, 1.6 * s, pz, 0.2 * s, 3.2 * s, 0.2 * s));
      // ветви
      for (let i = 0; i < 3; i++) { const a = srnd(0, 6.28); treeParts.push(part(TRUNKG, 0x4e3620, px + Math.cos(a) * 0.45 * s, 3.2 * s, pz + Math.sin(a) * 0.45 * s, 0.07 * s, 1.3 * s, 0.07 * s, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7)); }
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Color(th.tree[Math.floor(srnd(0, th.tree.length))]).multiplyScalar(srnd(0.8, 1.1)).getHex(), y = (3.5 + srnd(-0.5, 1.5)) * s, r = srnd(0.9, 1.35) * s;
        treeParts.push(part(LEAF, c, px + srnd(-0.9, 0.9) * s, y, pz + srnd(-0.9, 0.9) * s, r, r * srnd(0.75, 0.95), r, 0, srnd(0, 3), 0));
      }
    }
  };
  for (const [x, y] of trees) addTree((x + 0.5) * TL, (y + 0.5) * TL, 1.05, true);
  // окружение за пределами карты
  const W = map.pw * U, Hh = map.ph * U;
  for (let i = 0; i < (th.indoor || th.baku || th.war ? 0 : 90); i++) {
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
    if (c.kind !== 'out' || th.indoor) continue;
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
  const clouds = new THREE.Group(); clouds.visible = !th.indoor;
  const cmat = new THREE.SpriteMaterial({ map: tex('soft'), color: th.cloud ?? 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(cmat); s.position.set(cx + srnd(-140, 140), srnd(45, 70), cz0 + srnd(-140, 140)); s.scale.set(srnd(30, 60), srnd(10, 18), 1); clouds.add(s); }
  root.add(clouds);

  const weather = makeWeather(th.weather, map);
  root.add(weather.points);
  const chimneys = map.chimneys.map(([x, y, z]) => new THREE.Vector3((x + 0.5) * TL, z * U + 1.5, (y + 0.5) * TL));
  const ups = [], fires = [];
  if (map.theme === 'metro') buildMetro(root, map, th, quality, ups, fires);
  if (th.baku) buildBaku(root, map, th, quality, ups);
  const smokes = [];
  if (th.war) buildWar(root, map, th, quality, ups, fires, smokes);
  let T = 0;
  return {
    root, sun, chimneys, fires, smokes, far: th.far || 500, indoor: !!th.indoor,
    update(dt, cam) { T += dt; weather.update(dt, cam); clouds.position.x = (clouds.position.x + dt * 0.6) % 60; for (const f of ups) f(dt, T, cam); },
  };
}

// Погода: снег, листья, пыль, пыльца — частицы вокруг камеры
function makeWeather(kind, map) {
  const N = kind === 'none' ? 0 : kind === 'snow' ? 1400 : kind === 'leaves' ? 260 : kind === 'dust' ? 500 : 160;
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
  for (const zz of [1.05, 3.95]) { const zc = z0 + TL * zz; for (const sx of [-1, 1]) p.push(bx(0.04, 2.35, 0.04, cxp + sx * w * 0.485, bed + 1.17, zc, dark)); p.push(bx(w * 0.96, 0.04, 0.04, cxp, bed + 2.35, zc, dark)); }
  const m = meshOf(p);
  return m;
}

// =====================================================================
// Декор: общие помощники
// =====================================================================
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// Плоскость-наклейка на стену: центр (x,y,z), нормаль по оси (nx, nz)
function decal(root, mat, x, y, z, nx, nz, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x + nx * 0.03, y, z + nz * 0.03); m.lookAt(x + nx, y, z + nz); root.add(m); return m;
}
// Граффити в стиле Нью-Йорка: пузырчатые буквы, обводка, подтёки
const TAGS = ['STRIKE', 'NYC', '5X5', 'BOOM', 'KAOS', 'RUSH B', 'ZULIK', 'BAKU', 'WILD', 'SPRAY', 'GG', 'NOVA', 'ACE'];
const GCOLS = [['#ff3d8b', '#ffd23f'], ['#22d3ee', '#a855f7'], ['#7cff4f', '#1f6feb'], ['#ff6a00', '#ffe066'], ['#f5f5f5', '#ff1744'], ['#00e5ff', '#ff00e5'], ['#ffd23f', '#e53935']];
function graffitiTex(seedI) {
  return canvasTex(512, 256, (g, W, H) => {
    const word = TAGS[seedI % TAGS.length], [c1, c2] = GCOLS[seedI % GCOLS.length];
    g.translate(W / 2, H / 2); g.rotate(rnd(-0.12, 0.08));
    const fs = Math.min(150, 780 / Math.max(3, word.length));
    g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    // тень-облако
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, W * 0.46, H * 0.36, 0, 0, 7); g.fill();
    g.lineJoin = 'round';
    g.strokeStyle = '#111'; g.lineWidth = 26; g.strokeText(word, 6, 8);
    g.strokeStyle = '#fff'; g.lineWidth = 14; g.strokeText(word, 0, 0);
    const gr = g.createLinearGradient(0, -fs / 2, 0, fs / 2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(word, 0, 0);
    g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 18; i++) g.fillRect(rnd(-W * 0.4, W * 0.4), rnd(-fs * 0.4, -fs * 0.2), rnd(4, 14), 3);
    g.fillStyle = c2; for (let i = 0; i < 14; i++) { const x = rnd(-W * 0.38, W * 0.38), y = fs * 0.32; g.fillRect(x, y, 3, rnd(10, 60)); g.beginPath(); g.arc(x + 1.5, y + rnd(10, 60), 3, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { g.save(); g.translate(rnd(-W * 0.45, W * 0.45), rnd(-H * 0.4, H * 0.4)); g.rotate(rnd(0, 1)); g.fillRect(-1, -9, 2, 18); g.fillRect(-9, -1, 18, 2); g.restore(); }
  });
}
const gMats = [];
function graffitiMat(i) { const k = i % 10; return gMats[k] || (gMats[k] = new THREE.MeshLambertMaterial({ map: graffitiTex(k), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); }

// =====================================================================
// Метро (Нью-Йорк)
// =====================================================================
function carPanelTex(variant) {
  return canvasTex(256, 448, (g, W, H) => {
    const burnt = variant === 'burnt';
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, burnt ? '#3a332c' : '#9aa1a8'); gr.addColorStop(0.5, burnt ? '#5a4c3c' : '#d3d8dd'); gr.addColorStop(1, burnt ? '#2a2420' : '#8e959c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 4; x < W; x += 9) g.fillRect(x, H * 0.62, 2, H * 0.36);
    // окно
    g.fillStyle = '#1b2733'; g.beginPath(); g.roundRect(W * 0.14, H * 0.16, W * 0.72, H * 0.36, 14); g.fill();
    const gl = g.createLinearGradient(0, H * 0.16, W, H * 0.5); gl.addColorStop(0, 'rgba(160,190,220,0.35)'); gl.addColorStop(0.4, 'rgba(255,255,255,0.05)'); gl.addColorStop(0.6, 'rgba(160,190,220,0.25)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(W * 0.14, H * 0.16, W * 0.72, H * 0.36);
    g.strokeStyle = '#6b7178'; g.lineWidth = 6; g.beginPath(); g.roundRect(W * 0.14, H * 0.16, W * 0.72, H * 0.36, 14); g.stroke();
    // фирменная полоса
    g.fillStyle = burnt ? '#2a1a12' : '#6a2c91'; g.fillRect(0, H * 0.56, W, 14);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, 6); g.fillRect(0, H - 8, W, 8); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
    if (variant === 'tag') { const t = graffitiTex(Math.floor(rnd(0, 20))).image; g.drawImage(t, -20, H * 0.5, W + 40, H * 0.46); }
    if (variant === 'tag2') { const t = graffitiTex(Math.floor(rnd(0, 20))).image; g.drawImage(t, -10, H * 0.04, W + 20, H * 0.3); }
    if (burnt) { for (let i = 0; i < 14; i++) { const x = rnd(0, W), y = rnd(0, H), r = rnd(20, 70); const sg = g.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, 'rgba(0,0,0,0.8)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H); } g.fillStyle = '#05070a'; g.beginPath(); g.moveTo(W * 0.2, H * 0.2); g.lineTo(W * 0.5, H * 0.32); g.lineTo(W * 0.35, H * 0.45); g.lineTo(W * 0.7, H * 0.4); g.lineTo(W * 0.8, H * 0.2); g.fill(); }
  });
}
function carEndTex() {
  return canvasTex(256, 448, (g, W, H) => {
    g.fillStyle = '#b8bec4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b2733'; g.beginPath(); g.roundRect(W * 0.1, H * 0.12, W * 0.32, H * 0.3, 10); g.fill(); g.beginPath(); g.roundRect(W * 0.58, H * 0.12, W * 0.32, H * 0.3, 10); g.fill();
    g.fillStyle = '#6a2c91'; g.beginPath(); g.arc(W * 0.5, H * 0.08, 18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('S', W * 0.5, H * 0.08 + 9);
    g.fillStyle = '#fff6d0'; for (const x of [0.2, 0.8]) { g.beginPath(); g.arc(W * x, H * 0.62, 14, 0, 7); g.fill(); }
    g.fillStyle = '#333'; g.fillRect(W * 0.4, H * 0.5, W * 0.2, H * 0.4);
  });
}
let carMats = null;
function getCarMats() {
  if (carMats) return carMats;
  carMats = { clean: new THREE.MeshLambertMaterial({ map: carPanelTex('clean') }), tag: new THREE.MeshLambertMaterial({ map: carPanelTex('tag') }), tag2: new THREE.MeshLambertMaterial({ map: carPanelTex('tag2') }), burnt: new THREE.MeshLambertMaterial({ map: carPanelTex('burnt') }), end: new THREE.MeshLambertMaterial({ map: carEndTex() }) };
  return carMats;
}
// Вагон: p = {x, y, w (длина), h (2 — стоящий, 3 — спавн с дверями)}
function makeCar(map, p) {
  const TL = C.TILE * U, M = getCarMats(), g = new THREE.Group();
  const z0 = p.y * TL + 0.12, z1 = (p.y + p.h) * TL - 0.12, zc = (z0 + z1) / 2, wd = z1 - z0;
  const bodyB = { clean: [], tag: [], tag2: [] }, dark = [], grey = [];
  const top = (p.h === 3 ? 108 : 100) * U;
  for (let i = 0; i < p.w; i++) {
    const x = (p.x + i + 0.5) * TL;
    dark.push(bx(TL, 1.0, wd - 0.6, x, 0.5, zc, 0x1c1d1f));
    for (const sz of [-1, 1]) dark.push(part(CYL, 0x2a2b2d, x, 0.42, zc + sz * (wd / 2 - 0.5), 0.4, 0.2, 0.4, Math.PI / 2, 0, 0));
    const v = ['clean', 'tag', 'clean', 'tag2', 'clean'][(i * 7 + p.x * 3 + p.y) % 5];
    if (p.h === 2) bodyB[v].push(bx(TL, top - 1.0, wd, x, 1.0 + (top - 1.0) / 2, zc));
    else {
      const door = i % 3 === 1;
      grey.push(bx(TL, 0.04, wd, x, 1.0, zc, 0x6a7078));
      grey.push(bx(TL, 0.34, wd, x, top - 0.17, zc, 0x9aa1a8));
      for (const [ra, rb] of [[p.y, p.y + 1], [p.y + 2, p.y + 3]]) {
        const za = ra * TL + (ra === p.y ? 0.12 : 0), zb = rb * TL - (rb === p.y + 3 ? 0.12 : 0), zm = (za + zb) / 2;
        if (door) { bodyB[v].push(bx(TL, top - 92 * U, zb - za, x, (92 * U + top) / 2, zm)); grey.push(bx(0.08, 92 * U - 1.0, zb - za, x - TL / 2 + 0.04, (1.0 + 92 * U) / 2, zm, 0x7c838a), bx(0.08, 92 * U - 1.0, zb - za, x + TL / 2 - 0.04, (1.0 + 92 * U) / 2, zm, 0x7c838a)); }
        else bodyB[v].push(bx(TL, top - 1.0, zb - za, x, 1.0 + (top - 1.0) / 2, zm));
      }
      // поручни под потолком салона
      grey.push(part(CYL, 0xc8ccd0, x, top - 0.55, (p.y + 1.5) * TL, 0.02, TL, 0.02, 0, 0, Math.PI / 2));
    }
  }
  for (const k in bodyB) if (bodyB[k].length) { const m = new THREE.Mesh(merge(bodyB[k]), M[k]); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.add(meshOf(dark)); if (grey.length) g.add(meshOf(grey, VCOL_SHINY));
  // крыша с округлением и торцы
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(wd / 2, wd / 2, p.w * TL, 20, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: 0x8e959c }));
  roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.22); roof.position.set((p.x + p.w / 2) * TL, top, zc); g.add(roof);
  for (const [xe, nx] of [[p.x * TL - 0.01, -1], [(p.x + p.w) * TL + 0.01, 1]]) decal(g, M.end, xe, 1.0 + (top - 1.0) / 2, zc, nx, 0, wd, top - 1.0);
  // салон спавн-вагона: свет
  if (p.h === 3) { const lm = new THREE.Mesh(new THREE.BoxGeometry(p.w * TL - 0.4, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xf2f8ff })); lm.position.set((p.x + p.w / 2) * TL, top - 0.37, (p.y + 1.5) * TL); g.add(lm); }
  return g;
}
function makeWreck(p) {
  const TL = C.TILE * U, M = getCarMats(), g = new THREE.Group();
  const ang = Math.atan(1 / 3), thick = 72 * U * Math.cos(ang), len = 8.8 / Math.cos(ang), zc = (p.y + 1) * TL;
  for (const side of [-1, 1]) {
    const xc = side < 0 ? 19.8 * TL : (44 - 19.8) * TL;
    const bottom = (19.8 - 18.5) * TL / 3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 2 * TL - 0.3), [M.burnt, M.burnt, M.burnt, new THREE.MeshLambertMaterial({ color: 0x15100c }), M.burnt, M.burnt]);
    m.position.set(xc, bottom + (72 * U) / 2, zc); m.rotation.z = side < 0 ? ang : -ang; m.castShadow = true; g.add(m);
    const und = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.5, 2 * TL - 0.8), new THREE.MeshLambertMaterial({ color: 0x1a1612 }));
    und.position.set(xc, bottom - 0.1, zc); und.rotation.z = m.rotation.z; g.add(und);
  }
  // искорёженный металл на изломе
  const deb = [];
  for (let i = 0; i < 14; i++) deb.push(bx(srnd(0.3, 1.2), srnd(0.05, 0.2), srnd(0.3, 1.0), 22 * TL + srnd(-1.2, 1.2), srnd(2.0, 3.6), zc + srnd(-1.6, 1.6), [0x3a332c, 0x5a4c3c, 0x222][i % 3], srnd(0, 3), srnd(0, 3), srnd(0, 3)));
  for (let i = 0; i < 20; i++) deb.push(bx(srnd(0.1, 0.5), srnd(0.05, 0.2), srnd(0.1, 0.5), 22 * TL + srnd(-6, 6), 0.06, zc + srnd(-3, 3), 0x4a4038, 0, srnd(0, 3), 0));
  g.add(meshOf(deb));
  return g;
}
function buildMetro(root, map, th, quality, ups, fires) {
  const TL = C.TILE * U, cY = map.ceilZ * U, PW = map.pw * U, PH = map.ph * U;
  // потолок и балки
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.4, PH), worldMat('ceilM', 4)); ceil.position.set(PW / 2, cY + 0.2, PH / 2); ceil.receiveShadow = true; root.add(ceil);
  const beams = [];
  for (let x = 2; x < map.W - 1; x += 2) beams.push(bx(0.35, 0.45, PH, x * TL, cY - 0.22, PH / 2, 0x2f3a33));
  for (const y of [5.5, 9.5, 15.5, 19.5]) beams.push(bx(PW, 0.4, 0.35, PW / 2, cY - 0.2, y * TL, 0x2f3a33));
  root.add(meshOf(beams));
  // рельсы, шпалы, контактный рельс
  const rails = [];
  for (const tz of [7.5, 18]) {
    const zc = tz * TL;
    for (const s of [-0.72, 0.72]) rails.push(bx(PW, 0.16, 0.08, PW / 2, 0.22, zc + s, 0x8f8a84), bx(PW, 0.04, 0.16, PW / 2, 0.15, zc + s, 0x4a443e));
    rails.push(bx(PW, 0.12, 0.12, PW / 2, 0.25, zc + 1.6, 0x55504a), bx(PW, 0.04, 0.4, PW / 2, 0.36, zc + 1.6, 0xc9a227));
  }
  root.add(meshOf(rails, VCOL_SHINY));
  const slp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.12, 2.5), new THREE.MeshLambertMaterial({ color: 0x3b2c20 }), 2 * Math.floor((map.W - 2) * TL / 0.65));
  let si = 0; const o3 = new THREE.Object3D();
  for (const tz of [7.5, 18]) for (let x = TL; x < PW - TL && si < slp.count; x += 0.65) { o3.position.set(x, 0.07, tz * TL); o3.updateMatrix(); slp.setMatrixAt(si++, o3.matrix); }
  slp.count = si; slp.receiveShadow = true; root.add(slp);
  // жёлтая кромка платформ
  const edges = [];
  for (let y = 1; y < map.H - 1; y++) for (let x = 1; x < map.W - 1; x++) {
    const c = map.cols[y * map.W + x]; if (c.kind !== 'plat') continue;
    for (const dy of [-1, 1]) {
      const n = map.cols[(y + dy) * map.W + x];
      if (n.kind !== 'plat' && !n.ramp && n.kind !== 'wall' && n.kind !== 'door' && n.kind !== 'in' && n.s.every((r) => r[0] > 30 || r[1] <= 0 || r[2] === 'ceil' || r[2] === 'crate' || r[2] === 'sand' || r[2] === 'barrel')) {
        const zE = (y + (dy > 0 ? 1 : 0)) * TL - dy * 0.3;
        edges.push(bx(TL, 0.02, 0.5, (x + 0.5) * TL, 1.01, zE, 0xf2c014), bx(TL, 0.98, 0.06, (x + 0.5) * TL, 0.5, (y + (dy > 0 ? 1 : 0)) * TL + dy * 0.0, 0x3a3a38));
      }
    }
  }
  if (edges.length) root.add(meshOf(edges));
  // лампы дневного света над платформами + точечные источники
  const lampGeo = new THREE.BoxGeometry(1.4, 0.08, 0.28), lampMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff }), lampOff = new THREE.MeshBasicMaterial({ color: 0x5a6068 });
  const housing = [], flick = [];
  for (const ty of [3.5, 13, 22.5]) for (let x = 2.5; x < map.W - 2; x += 3) {
    const m = new THREE.Mesh(lampGeo, lampMat); m.position.set(x * TL, cY - 0.55, ty * TL); root.add(m);
    housing.push(bx(1.5, 0.12, 0.38, x * TL, cY - 0.47, ty * TL, 0x2a2c2e), bx(0.04, 0.5, 0.04, x * TL - 0.6, cY - 0.25, ty * TL, 0x2a2c2e), bx(0.04, 0.5, 0.04, x * TL + 0.6, cY - 0.25, ty * TL, 0x2a2c2e));
    if (srnd(0, 1) < 0.12) flick.push(m);
  }
  root.add(meshOf(housing));
  // свет от ламп: мягкие пятна на полу (дёшево) и немного точечных источников на высоких настройках
  const nL = quality === 'high' ? 3 : quality === 'medium' ? 2 : 0;
  for (const [x, y] of [[22, 3.5], [22, 22.5], [22, 13]].slice(0, nL)) { const L = new THREE.PointLight(0xe8f2ff, 22, 26, 1.6); L.position.set(x * TL, cY - 1.2, y * TL); root.add(L); }
  const poolMat = new THREE.MeshBasicMaterial({ map: tex('soft'), color: 0x8fa4b8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, 60); let pi = 0;
  for (const ty of [3.5, 13, 22.5]) for (let x = 2.5; x < map.W - 2 && pi < 60; x += 3) { o3.position.set(x * TL, 1.03, ty * TL); o3.rotation.set(-Math.PI / 2, 0, 0); o3.scale.set(5.5, 3.6, 1); o3.updateMatrix(); pools.setMatrixAt(pi++, o3.matrix); }
  pools.count = pi; root.add(pools);
  // огонь у разбитого поезда
  const fireL = new THREE.PointLight(0xff7a30, 30, 24, 1.6); fireL.position.set(22 * TL, 3.2, 18 * TL); root.add(fireL);
  fires.push(new THREE.Vector3(22 * TL, 2.6, 18 * TL), new THREE.Vector3(21 * TL, 1.2, 17.2 * TL));
  ups.push((dt, T) => {
    fireL.intensity = 24 + Math.sin(T * 13) * 5 + Math.sin(T * 31) * 3;
    for (const m of flick) m.material = Math.sin(T * 17 + m.position.x) > 0.6 || Math.sin(T * 3.1 + m.position.x) > 0.95 ? lampOff : lampMat;
  });
  // вагоны, обломки, скамейки, автоматы, урны
  const deco = [];
  for (const p of map.props) {
    const px = (p.x + 0.5) * TL, pz = (p.y + 0.5) * TL;
    if (p.type === 'car') root.add(makeCar(map, p));
    else if (p.type === 'wreck') root.add(makeWreck(p));
    else if (p.type === 'bench') { deco.push(bx(TL * 0.9, 0.08, 0.5, px, 1.45, pz, 0x6b4a2a), bx(TL * 0.9, 0.45, 0.06, px, 1.75, pz + 0.24, 0x6b4a2a)); for (const s of [-0.7, 0.7]) deco.push(bx(0.06, 0.45, 0.45, px + s, 1.22, pz, 0x2a2c2e)); }
    else if (p.type === 'vend') { deco.push(bx(1.3, 2.1, 1.0, px, 2.05, pz, 0xb0202a), bx(0.9, 1.2, 0.02, px, 2.3, pz - 0.51, 0x1b2733), bx(0.2, 0.5, 0.03, px + 0.5, 2.1, pz - 0.51, 0xd0d0d0)); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), new THREE.MeshBasicMaterial({ color: 0x9fd8ff })); sc.position.set(px, 2.3, pz - 0.525); sc.rotation.y = Math.PI; root.add(sc); }
    else if (p.type === 'trash') deco.push(part(CYL, 0x2f6b4f, px, 1.55, pz, 0.32, 1.1, 0.32), part(CYL, 0x1f1f1f, px, 2.12, pz, 0.34, 0.06, 0.34));
  }
  if (deco.length) root.add(meshOf(deco));
  // граффити на стенах, колоннах; названия станции; плакаты
  let gi = 0;
  const signMat = new THREE.MeshLambertMaterial({ map: canvasTex(512, 128, (g, W, H) => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 64px Helvetica, Arial, sans-serif'; g.fillText('Strike Av', 30, 80); g.fillStyle = '#6a2c91'; g.beginPath(); g.arc(W - 60, 64, 40, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.fillText('S', W - 60, 84); }) });
  const posterMat = new THREE.MeshLambertMaterial({ map: canvasTex(256, 384, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b1a3a'); gr.addColorStop(1, '#1f6feb'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.fillText('STRIKE', 24, 90); g.fillText('5×5', 24, 140); g.font = '20px Arial'; g.fillText('Заходи в бой', 24, 190); g.strokeStyle = '#22d3ee'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20); }) });
  for (let y = 1; y < map.H - 1; y++) for (const [x, nx] of [[0, 1], [map.W - 1, -1]]) {
    const inC = map.cols[y * map.W + x + nx]; if (inC.kind !== 'plat') continue;
    const fx = (x + (nx > 0 ? 1 : 0)) * TL, z = (y + 0.5) * TL;
    if (y % 4 === 2) decal(root, signMat, fx, 3.0, z, nx, 0, 3.2, 0.8);
    else if (srnd(0, 1) < 0.55) decal(root, graffitiMat(gi++), fx, srnd(1.8, 3.2), z, nx, 0, srnd(2.2, 3.6), srnd(1.1, 1.8));
  }
  for (let x = 1; x < map.W - 1; x++) for (const [y, ny] of [[0, 1], [map.H - 1, -1]]) {
    const fz = (y + (ny > 0 ? 1 : 0)) * TL, px = (x + 0.5) * TL;
    if (x % 6 === 3) decal(root, signMat, px, 3.3, fz, 0, ny, 3.4, 0.85);
    else if (x % 6 === 0) decal(root, posterMat, px, 2.3, fz, 0, ny, 1.1, 1.65);
    else if (srnd(0, 1) < 0.5) decal(root, graffitiMat(gi++), px, srnd(1.8, 3.4), fz, 0, ny, srnd(2.0, 3.8), srnd(1.0, 1.9));
  }
  for (let y = 1; y < map.H - 1; y++) for (let x = 1; x < map.W - 1; x++) {
    const c = map.cols[y * map.W + x]; if (!c.s.some((r) => r[2] === 'pillar')) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (srnd(0, 1) < 0.3) decal(root, graffitiMat(gi++), (x + 0.5 + dx * 0.5) * TL, srnd(1.8, 2.8), (y + 0.5 + dy * 0.5) * TL, dx, dy, 1.8, 0.9);
  }
}

// =====================================================================
// Баку: Ичеришехер, Девичья башня, Пламенные башни, панорама
// =====================================================================
function towerStoneTex() {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#c4ae86'; g.fillRect(0, 0, W, H);
    const rows = 16;
    for (let y = 0; y < rows; y++) { let x = -rnd(0, 40); while (x < W) { const w = rnd(26, 60); g.fillStyle = `hsl(${rnd(34, 41)},${rnd(22, 34)}%,${rnd(58, 70)}%)`; g.fillRect(x + 1.5, y * H / rows + 1.5, w - 3, H / rows - 3); x += w; } }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`; g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3)); }
    for (let i = 0; i < 18; i++) { const x = rnd(0, W), y = rnd(0, H); const gr = g.createRadialGradient(x, y, 0, x, y, rnd(20, 60)); gr.addColorStop(0, 'rgba(90,70,40,0.14)'); gr.addColorStop(1, 'rgba(90,70,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  }, [1, 1]);
}
function makeMaidenTower(map) {
  const TL = C.TILE * U, MT = window.Shared.MT;
  const cx = MT.cx * TL, cz = MT.cy * TL, R = 4.22 * TL, Ri = 3.25 * TL, Hh = MT.H * U, dH = 64 * U;
  const g = new THREE.Group();
  const tx = towerStoneTex(); tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  const t1 = tx.clone(); t1.repeat.set(9, 7); t1.needsUpdate = true;
  const t0 = tx.clone(); t0.repeat.set(4, 0.65); t0.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: t1 }), mat0 = new THREE.MeshLambertMaterial({ map: t0 });
  const dw = Math.asin((2 * TL) / R) + 0.02;
  // нижний пояс с проёмами входов (запад/восток) и верхняя часть
  for (const [a0, a1] of [[Math.PI / 2 + dw, Math.PI * 1.5 - dw], [Math.PI * 1.5 + dw, Math.PI * 2.5 - dw]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.005, dH, 40, 1, true, a0, a1 - a0), mat0); m.position.set(cx, dH / 2, cz); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  const up = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R, Hh - dH, 72, 1, true), mat); up.position.set(cx, dH + (Hh - dH) / 2, cz); up.castShadow = true; up.receiveShadow = true; g.add(up);
  // крыша и парапет
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R * 0.985, 0.3, 48), new THREE.MeshLambertMaterial({ color: 0x8f8064 })); roof.position.set(cx, Hh - 0.4, cz); g.add(roof);
  const par = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.99, R * 0.99, 1.0, 72, 1, true), mat); par.position.set(cx, Hh + 0.3, cz); g.add(par);
  // комната внутри
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, 3.0, 40, 1, true), new THREE.MeshLambertMaterial({ map: t0, side: THREE.BackSide })); inner.position.set(cx, 1.5, cz); g.add(inner);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(Ri, 40), new THREE.MeshLambertMaterial({ color: 0x6f6350, side: THREE.DoubleSide })); cap.rotation.x = Math.PI / 2; cap.position.set(cx, 3.0, cz); g.add(cap);
  const lamp = new THREE.PointLight(0xffc27a, 8, 10, 1.6); lamp.position.set(cx, 2.4, cz); g.add(lamp);
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); lampM.position.copy(lamp.position); g.add(lampM);
  // проходы входов: боковые стенки и перемычка с аркой
  const pass = [];
  for (const sx of [-1, 1]) {
    const xm = cx + sx * (R + Ri) / 2, len = R - Ri + 0.3;
    for (const sz of [-1, 1]) pass.push(bx(len, dH, 0.25, xm, dH / 2, cz + sz * (2 * TL - 0.12), 0xb9a47c));
    pass.push(bx(len, 0.25, 4 * TL, xm, dH - 0.12, cz, 0xa8946c));
    pass.push(part(new THREE.TorusGeometry(2 * TL - 0.1, 0.22, 6, 18, Math.PI).toNonIndexed(), 0xa8946c, cx + sx * (R + 0.02), dH - 0.6, cz, 1, 0.35, 1, 0, Math.PI / 2, 0));
  }
  g.add(meshOf(pass));
  // контрфорс с севера (выступ с закруглённым концом)
  const bw = 2.2, zN = 7 * TL, zIn = cz - R + 0.6;
  const sh = new THREE.Shape(); sh.moveTo(-bw, zIn); sh.lineTo(-bw, zN + bw); sh.absarc(0, zN + bw, bw, Math.PI, 0, false); sh.lineTo(bw, zIn); sh.lineTo(-bw, zIn);
  const bh = 660 * U;
  const bgeo = new THREE.ExtrudeGeometry(sh, { depth: bh, bevelEnabled: false, curveSegments: 16 });
  const tb = tx.clone(); tb.repeat.set(0.2, 0.2); tb.needsUpdate = true;
  const but = new THREE.Mesh(bgeo, new THREE.MeshLambertMaterial({ map: tb })); but.rotation.x = -Math.PI / 2; but.position.set(cx, 0, 0); but.scale.set(1, -1, 1);
  but.castShadow = true; but.receiveShadow = true; g.add(but);
  // ряды выступающих камней в верхней части (узнаваемая «ребристость»)
  const stones = [];
  for (let y = Hh * 0.55; y < Hh - 1.4; y += 0.95) {
    const n = Math.floor((Math.PI * 2 * R) / 1.1), off = (Math.round(y / 0.95) % 2) * 0.5;
    for (let i = 0; i < n; i++) { const a = ((i + off) / n) * Math.PI * 2; if (Math.abs(Math.cos(a)) < 0.12 && Math.sin(a) < 0) continue; stones.push([cx + Math.sin(a) * (R * 0.99), y, cz + Math.cos(a) * (R * 0.99), a]); }
    for (let i = -1; i <= 1; i++) { stones.push([cx + i * 1.3, y, zN - 0.02 + 0, Math.PI]); stones.push([cx - bw - 0.02, y, zN + bw + i * 1.4 + 1.2, -Math.PI / 2]); stones.push([cx + bw + 0.02, y, zN + bw + i * 1.4 + 1.2, Math.PI / 2]); }
  }
  const st = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.26, 0.28), new THREE.MeshLambertMaterial({ color: 0xc2ac84 }), stones.length);
  const o3 = new THREE.Object3D();
  stones.forEach(([x, y, z, a], i) => { o3.position.set(x, y, z); o3.rotation.set(0, a, 0); o3.updateMatrix(); st.setMatrixAt(i, o3.matrix); });
  st.castShadow = true; g.add(st);
  // узкие окна-бойницы
  const slitM = new THREE.MeshBasicMaterial({ color: 0x1a140d });
  for (let i = 0; i < 26; i++) {
    const a = srnd(0, Math.PI * 2), y = srnd(4, Hh - 3); if (Math.abs(Math.sin(a)) > 0.93 && y < 4) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.28, srnd(0.8, 1.3)), slitM); m.position.set(cx + Math.sin(a) * (R + 0.04), y, cz + Math.cos(a) * (R + 0.04)); m.rotation.y = a; g.add(m);
  }
  // флаг Азербайджана на крыше
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), new THREE.MeshLambertMaterial({ color: 0xdddddd })); pole.position.set(cx, Hh + 3, cz); g.add(pole);
  const flagT = canvasTex(300, 150, (q, W, H) => { q.fillStyle = '#00b5e2'; q.fillRect(0, 0, W, H / 3); q.fillStyle = '#ef3340'; q.fillRect(0, H / 3, W, H / 3); q.fillStyle = '#509e2f'; q.fillRect(0, (2 * H) / 3, W, H / 3); q.fillStyle = '#fff'; q.beginPath(); q.arc(W / 2 - 6, H / 2, 20, 0, 7); q.fill(); q.fillStyle = '#ef3340'; q.beginPath(); q.arc(W / 2, H / 2, 16, 0, 7); q.fill(); q.fillStyle = '#fff'; q.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 4 : 9; q.lineTo(W / 2 + 22 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); } q.fill(); });
  const fgeo = new THREE.PlaneGeometry(3.6, 1.8, 12, 1);
  const flag = new THREE.Mesh(fgeo, new THREE.MeshLambertMaterial({ map: flagT, side: THREE.DoubleSide })); flag.position.set(cx + 1.8, Hh + 5.0, cz); g.add(flag);
  const base = fgeo.attributes.position.array.slice();
  g.userData.flag = (T) => { const p = fgeo.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const x = base[i] + 1.8; p[i + 2] = Math.sin(x * 2.2 - T * 5) * 0.18 * (x / 3.6); } fgeo.attributes.position.needsUpdate = true; };
  return g;
}
// Пламенные башни: сечение — скруглённый треугольник, силуэт — язык пламени
function flameTowerGeo(Hh, R, lean) {
  const rings = 44, segs = 40, pos = [], uv = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, w = Math.pow(Math.max(0, 1 - Math.pow(t, 2.3)), 0.75) * (1 - 0.08 * t) + 0.002, dx = lean * t * t * Hh * 0.12;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2, r = R * w * (1 + 0.16 * Math.cos(3 * a));
      pos.push(Math.cos(a) * r + dx, t * Hh, Math.sin(a) * r); uv.push(j / segs, t);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function flameMaterial(th) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: new THREE.Color(th.fog) }, fogNear: { value: th.fogNear }, fogFar: { value: th.fogFar } },
    vertexShader: 'varying vec2 vUv; varying float vDepth; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float time; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec2 vUv; varying float vDepth; varying vec3 vN;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec2 gg = vec2(vUv.x * 70.0, vUv.y * 90.0);
        float grid = step(0.86, fract(gg.x)) + step(0.84, fract(gg.y));
        vec3 glass = mix(vec3(0.1, 0.14, 0.24), vec3(0.34, 0.42, 0.58), clamp(vN.y * 0.5 + 0.5, 0.0, 1.0));
        glass += vec3(1.0, 0.55, 0.25) * pow(max(0.0, -vN.x * 0.6 + 0.4), 3.0) * 0.5;
        vec2 q = vec2(vUv.x * 7.0, vUv.y * 3.2 - time * 0.8);
        float f = n(q * vec2(1.0, 1.7)) * 0.62 + n(q * 2.4 + 3.1) * 0.38;
        float flame = smoothstep(0.32, 0.7, f + (1.0 - vUv.y) * 0.32 - 0.05);
        vec3 fc = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.82, 0.25), f);
        float on = 0.75 + 0.25 * sin(time * 0.35);
        vec3 col = mix(glass, fc * 1.5, flame * on);
        col *= 1.0 - grid * 0.35;
        float fogF = smoothstep(fogNear, fogFar, vDepth) * 0.8;
        gl_FragColor = vec4(mix(col, fogColor, fogF), 1.0);
      }`,
  });
}
function buildingTex() {
  return canvasTex(256, 256, (g, W, H) => { g.fillStyle = '#d8c9a8'; g.fillRect(0, 0, W, H); for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { const lit = Math.random() < 0.32; g.fillStyle = lit ? '#ffcf7a' : '#2a3442'; g.fillRect(x * W / 6 + 9, y * H / 8 + 8, W / 6 - 18, H / 8 - 14); } g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 8; y++) g.fillRect(0, y * H / 8, W, 3); }, [1, 1]);
}
function buildBaku(root, map, th, quality, ups) {
  const TL = C.TILE * U, PW = map.pw * U, PH = map.ph * U, cx = PW / 2;
  const tower = makeMaidenTower(map); root.add(tower);
  ups.push((dt, T) => tower.userData.flag(T));
  // зубцы крепостной стены и круглые башни
  const fortTop = 168 * U, mer = [];
  for (let x = 0; x < map.W; x++) for (const y of [0, map.H - 1]) for (const k of [0.25, 0.75]) mer.push(bx(0.75, 0.9, 1.9, (x + k) * TL, fortTop + 0.45, (y + 0.5) * TL, 0xb3a07a));
  for (let y = 1; y < map.H - 1; y++) for (const x of [0, map.W - 1]) for (const k of [0.25, 0.75]) mer.push(bx(1.9, 0.9, 0.75, (x + 0.5) * TL, fortTop + 0.45, (y + k) * TL, 0xb3a07a));
  root.add(meshOf(mer));
  const fm = worldMat('fort', 4);
  const towers = [[0, 0], [map.W, 0], [0, map.H], [map.W, map.H], [map.W / 2 - 8, 0], [map.W / 2 + 8, 0], [map.W / 2 - 8, map.H], [map.W / 2 + 8, map.H], [0, map.H / 2], [map.W, map.H / 2]];
  for (const [tx, ty] of towers) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, fortTop + 1.6, 20), fm); t.position.set(tx * TL, (fortTop + 1.6) / 2, ty * TL); t.castShadow = true; root.add(t);
    const r = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; r.push(bx(0.8, 0.9, 0.8, tx * TL + Math.cos(a) * 2.4, fortTop + 2.0, ty * TL + Math.sin(a) * 2.4, 0xb3a07a, 0, -a, 0)); } root.add(meshOf(r));
  }
  // деревянные балконы на окнах второго этажа и ковры у прилавков
  const balT = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#6b4424'; g.fillRect(0, 0, W, H); g.fillStyle = '#2a3a4a'; for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) g.fillRect(x * 32 + 5, y * 30 + 10, 22, 22); g.strokeStyle = '#8a5a30'; g.lineWidth = 2; for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) { g.beginPath(); g.moveTo(x * 32 + 5, y * 30 + 21); g.lineTo(x * 32 + 27, y * 30 + 21); g.moveTo(x * 32 + 16, y * 30 + 10); g.lineTo(x * 32 + 16, y * 30 + 32); g.stroke(); } g.fillStyle = '#4a2e18'; g.fillRect(0, H - 26, W, 26); });
  const balM = new THREE.MeshLambertMaterial({ map: balT }), carpetM = new THREE.MeshLambertMaterial({ map: tex('carpet') });
  const done = new Set();
  for (const [x, y, z] of map.trims) {
    if (z !== 90 || done.has(x + ',' + y)) continue; done.add(x + ',' + y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = map.cols[(y + dy) * map.W + x + dx]; if (!n || n.kind === 'wall' || n.kind === 'in' || n.kind === 'door') continue;
      const bxm = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.8 : 1.8, 1.7, dx ? 1.8 : 0.8), balM);
      bxm.position.set((x + 0.5 + dx * 0.5) * TL + dx * 0.4, 90 * U + 0.55, (y + 0.5 + dy * 0.5) * TL + dy * 0.4); bxm.castShadow = true; root.add(bxm);
      const rf = new THREE.Mesh(new THREE.BoxGeometry(dx ? 1.0 : 2.0, 0.12, dx ? 2.0 : 1.0), new THREE.MeshLambertMaterial({ color: 0x3a2412 })); rf.position.copy(bxm.position).add(new THREE.Vector3(0, 0.9, 0)); root.add(rf);
      break;
    }
  }
  const stall = [];
  for (const p of map.props) {
    if (p.type !== 'stall') continue;
    const px = (p.x + 0.5) * TL, pz = (p.y + 0.5) * TL;
    stall.push(bx(1.7, 0.08, 1.7, px, 1.2, pz, 0x6b4424)); for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) stall.push(bx(0.08, 2.4, 0.08, px + sx, 1.2, pz + sz, 0x4a2e18));
    for (let i = 0; i < 9; i++) stall.push(part(SPH, [0xb3202a, 0xe0a030, 0x7a2a8a][i % 3], px + srnd(-0.6, 0.6), 1.32, pz + srnd(-0.6, 0.6), 0.12, 0.12, 0.12));
    const can = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 2.1), new THREE.MeshLambertMaterial({ map: tex('carpet') })); can.position.set(px, 2.42, pz); root.add(can);
    decal(root, carpetM, px, 1.7, pz + 0.9, 0, 1, 1.4, 1.8);
  }
  if (stall.length) root.add(meshOf(stall));
  // ---- панорама за стенами
  const SEAZ = PH + 70;
  const cityG = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1400), new THREE.MeshLambertMaterial({ color: 0x8a7a62 })); cityG.rotation.x = -Math.PI / 2; cityG.position.set(cx, -0.05, SEAZ - 700); root.add(cityG);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3200, 1600), new THREE.MeshPhongMaterial({ color: 0x2f5f86, shininess: 120, specular: 0xffc48a, emissive: 0x0a1a2a })); sea.rotation.x = -Math.PI / 2; sea.position.set(cx, -0.3, SEAZ + 800); root.add(sea);
  // бульвар с деревьями вдоль моря
  const blv = [];
  for (let x = -250; x < PW + 250; x += 9) { blv.push(part(CYL, 0x5a4330, x, 2.5, SEAZ - 8, 0.25, 5, 0.25)); blv.push(part(SPH, 0x2f5a24, x, 5.6, SEAZ - 8, 2.2, 1.8, 2.2)); }
  blv.push(bx(PW + 520, 0.4, 6, cx, 0.2, SEAZ - 3, 0xbfb59a));
  root.add(meshOf(blv));
  // жилые кварталы и высотки
  const bt = buildingTex();
  const bmat = new THREE.MeshLambertMaterial({ map: bt, emissiveMap: bt, emissive: 0xffb060, emissiveIntensity: 0.35 });
  bmat.onBeforeCompile = worldMat('lime', 18).onBeforeCompile; bmat.customProgramCacheKey = () => 'wmb';
  const blds = [];
  const addB = (x, z, w, d, hgt) => blds.push(bx(w, hgt, d, x, hgt / 2, z, 0xffffff));
  for (let i = 0; i < 160; i++) {
    const side = i % 3; let x, z;
    if (side === 0) { x = srnd(-320, PW + 320); z = srnd(-420, -45); if (Math.hypot(x - (cx - 70), z + 210) < 110) continue; }
    else if (side === 1) { x = srnd(-330, -40); z = srnd(-300, SEAZ - 25); } else { x = srnd(PW + 40, PW + 330); z = srnd(-300, SEAZ - 25); }
    const tall = Math.random() < 0.12; addB(x, z, srnd(10, 24), srnd(10, 24), tall ? srnd(40, 85) : srnd(8, 26));
  }
  // «Порт Баку» и прочие высотки на востоке
  for (const [x, z, w, hgt] of [[PW + 160, SEAZ - 60, 22, 110], [PW + 200, SEAZ - 90, 20, 95], [PW + 260, -60, 26, 130], [PW + 120, -140, 18, 75]]) addB(x, z, w, w, hgt);
  const bm = new THREE.Mesh(merge(blds), bmat); root.add(bm);
  // холм нагорного парка и Пламенные башни
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshLambertMaterial({ color: 0x8c7c5a })); hill.scale.set(150, 42, 90); hill.position.set(cx - 70, -8, -215); root.add(hill);
  const fmat = flameMaterial(th);
  for (const [dx, dz, hgt, rr, rot] of [[-22, -8, 112, 15, 0.4], [16, -18, 102, 14, -0.2], [0, 18, 94, 13, 2.2]]) {
    const ft = new THREE.Mesh(flameTowerGeo(hgt, rr, 1), fmat); ft.position.set(cx - 70 + dx, 26, -215 + dz); ft.rotation.y = rot; root.add(ft);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.4, rr * 1.6, 6, 24), new THREE.MeshLambertMaterial({ color: 0x5b6470 })); podium.position.set(cx - 70 + dx, 26, -215 + dz); root.add(podium);
  }
  ups.push((dt, T) => { fmat.uniforms.time.value = T; });
  // телебашня
  const tvm = new THREE.MeshLambertMaterial({ color: 0xd8d4cc });
  const tv = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 6, 190, 16), tvm); tv.position.set(cx - 330, 95, -360); root.add(tv);
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 10, 20), tvm); pod.position.set(cx - 330, 150, -360); root.add(pod);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.0, 60, 8), new THREE.MeshLambertMaterial({ color: 0xc0392b })); ant.position.set(cx - 330, 220, -360); root.add(ant);
  // Кристал Холл на берегу
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(40, 46, 18, 10), new THREE.MeshPhongMaterial({ color: 0xc9d6e6, emissive: 0x3a2a6a, shininess: 80 })); ch.position.set(PW + 260, 9, SEAZ + 30); root.add(ch);
}

// =====================================================================
// «28 Мая»: площадь у вокзала после боёв
// =====================================================================
function stdMat(opts) { return curQ === 'low' ? new THREE.MeshLambertMaterial(opts) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0, envMapIntensity: 0.2 }, opts)); }
// повреждения на фасаде: дыры, копоть, сколы
function damage(g, W, H, n, sc = 1) {
  for (let i = 0; i < n; i++) {
    const x = rnd(0, W), y = rnd(H * 0.1, H * 0.9), r = rnd(6, 22) * sc;
    const gr = g.createRadialGradient(x, y - r, 0, x, y - r * 1.5, r * 3.5); gr.addColorStop(0, 'rgba(15,12,10,0.55)'); gr.addColorStop(1, 'rgba(15,12,10,0)'); g.fillStyle = gr; g.fillRect(x - r * 4, y - r * 5, r * 8, r * 5);
    g.fillStyle = 'rgba(95,88,80,0.55)'; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28, rr = r * 1.18 * rnd(0.8, 1.15); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
    g.fillStyle = '#0e0c0b'; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28, rr = r * rnd(0.55, 1.05); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
  }
  for (let i = 0; i < n * 25; i++) { g.fillStyle = 'rgba(30,26,22,0.7)'; g.beginPath(); g.arc(rnd(0, W), rnd(0, H), rnd(1, 3) * sc, 0, 7); g.fill(); }
}
function stationTex() {
  return canvasTex(2048, 256, (g, W, H) => {
    g.fillStyle = '#cdb38a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd(0, 255) > 128 ? '255,245,220' : '60,45,30'},0.08)`; g.fillRect(rnd(0, W), rnd(0, H), 2, 2); }
    g.fillStyle = '#b39a72'; g.fillRect(0, 0, W, 16); g.fillRect(0, H * 0.48, W, 10); g.fillRect(0, H - 22, W, 22);
    // арки первого этажа и окна второго
    for (let i = 0; i < 40; i++) {
      const x = 14 + i * 51; g.fillStyle = '#e2cfa8'; g.beginPath(); g.moveTo(x, H - 22); g.lineTo(x, H * 0.66); g.arc(x + 18, H * 0.66, 18, Math.PI, 0); g.lineTo(x + 36, H - 22); g.fill();
      g.fillStyle = '#1d1a17'; g.beginPath(); g.moveTo(x + 4, H - 22); g.lineTo(x + 4, H * 0.67); g.arc(x + 18, H * 0.67, 14, Math.PI, 0); g.lineTo(x + 32, H - 22); g.fill();
      g.fillStyle = '#e2cfa8'; g.fillRect(x + 6, H * 0.18, 24, 66); g.fillStyle = '#23262a'; g.fillRect(x + 9, H * 0.2, 18, 60); g.fillStyle = '#cdb38a'; g.fillRect(x + 17, H * 0.2, 2, 60);
    }
    damage(g, W, H, 26);
  });
}
function clockTex() {
  return canvasTex(256, 256, (g, W) => {
    g.fillStyle = '#cdb38a'; g.fillRect(0, 0, W, W); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill();
    g.strokeStyle = '#2a2420'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#2a2420';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.fillRect(128 + Math.cos(a) * 90 - 4, 128 + Math.sin(a) * 90 - 4, 8, 8); }
    g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50, 128 - 30); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 10, 128 - 85); g.stroke();
    // трещина по стеклу циферблата
    g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 70); g.lineTo(110, 120); g.lineTo(100, 180); g.moveTo(110, 120); g.lineTo(170, 150); g.stroke();
  });
}
function mallTex() {
  return canvasTex(2048, 512, (g, W, H) => {
    // нижний ярус — розовый камень с витринами, верх — стекло с переплётом
    const sh = H * 0.42;
    const gl = g.createLinearGradient(0, 0, 0, sh); gl.addColorStop(0, '#5d7486'); gl.addColorStop(1, '#2f3c48'); g.fillStyle = gl; g.fillRect(0, 0, W, sh);
    for (let x = 0; x < W; x += 64) { g.fillStyle = '#20262c'; g.fillRect(x, 0, 6, sh); }
    for (let y = 0; y < sh; y += 52) { g.fillStyle = '#20262c'; g.fillRect(0, y, W, 5); }
    for (let i = 0; i < 70; i++) { const x = Math.floor(rnd(0, 32)) * 64 + 6, y = Math.floor(rnd(0, 4)) * 52 + 5; g.fillStyle = Math.random() < 0.6 ? '#0f1114' : 'rgba(200,220,235,0.35)'; g.fillRect(x, y, 58, 47); if (Math.random() < 0.5) { g.strokeStyle = 'rgba(220,230,240,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + rnd(0, 58), y); g.lineTo(x + rnd(0, 58), y + 47); g.stroke(); } }
    g.fillStyle = '#b98b7c'; g.fillRect(0, sh, W, H - sh);
    for (let i = 0; i < 8000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,235,225' : '70,40,35'},0.1)`; g.fillRect(rnd(0, W), sh + rnd(0, H - sh), 2, 2); }
    for (let y = sh + 40; y < H; y += 40) { g.fillStyle = 'rgba(80,50,45,0.35)'; g.fillRect(0, y, W, 2); }
    for (let i = 0; i < 18; i++) { const x = 30 + i * 112; g.fillStyle = '#121416'; g.fillRect(x, H - 150, 80, 130); g.fillStyle = '#8f6a5e'; g.fillRect(x - 6, H - 156, 92, 8); }
    // вывеска
    g.fillStyle = '#16181b'; g.fillRect(W / 2 - 230, sh + 20, 460, 90); g.fillStyle = '#f2f2f2'; g.font = 'bold 76px Arial'; g.textAlign = 'center'; g.fillText('28 MALL', W / 2, sh + 92);
    damage(g, W, H, 12, 1.3);
  });
}
function uniTex() {
  return canvasTex(2048, 512, (g, W, H) => {
    g.fillStyle = '#e4e1da'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(80,75,70,0.07)'; g.fillRect(rnd(0, W), rnd(0, H), 2, 2); }
    g.fillStyle = '#cfcbc2'; g.fillRect(0, 0, W, 40); g.fillRect(0, 128, W, 10);
    g.fillStyle = '#26303a'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.fillText('NEFT VƏ SƏNAYE UNİVERSİTETİ', W / 2, 105);
    for (let i = 0; i < 24; i++) { const x = 20 + i * 85; g.fillStyle = '#d6d2ca'; g.fillRect(x, 140, 22, H - 160); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 18, 140, 4, H - 160); for (let r = 0; r < 4; r++) { g.fillStyle = '#2a3440'; g.fillRect(x + 32, 160 + r * 85, 44, 62); g.fillStyle = 'rgba(180,200,215,0.3)'; g.fillRect(x + 34, 162 + r * 85, 18, 58); } }
    g.fillStyle = '#bdb8ae'; g.fillRect(0, H - 22, W, 22);
    damage(g, W, H, 24, 1.4);
  });
}
function glassTex(dark) {
  return canvasTex(512, 1024, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, dark ? '#2d3b48' : '#6f8aa0'); gr.addColorStop(1, dark ? '#1a222a' : '#3c4f60'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 32) { g.fillStyle = '#c9ced2'; g.fillRect(x, 0, 3, H); }
    for (let y = 0; y < H; y += 40) { g.fillStyle = '#c9ced2'; g.fillRect(0, y, W, 4); }
    for (let i = 0; i < 90; i++) { const x = Math.floor(rnd(0, 16)) * 32 + 3, y = Math.floor(rnd(0, 26)) * 40 + 4; g.fillStyle = '#0b0d0f'; g.fillRect(x, y, 29, 36); }
    damage(g, W, H, 8, 1.2);
  }, [1, 1]);
}
function burntBusTex() {
  return canvasTex(1024, 256, (g, W, H) => {
    g.fillStyle = '#2a2622'; g.fillRect(0, 0, W, H);
    // остатки синей окраски бакинского автобуса
    for (let i = 0; i < 18; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,150,0.6)' : 'rgba(200,200,200,0.35)'; g.beginPath(); g.ellipse(rnd(0, W), rnd(H * 0.55, H), rnd(20, 70), rnd(10, 30), 0, 0, 7); g.fill(); }
    blobs(g, W, 30, ['#6a3a20', '#8a5a30', '#1a1612'], 10, 40);
    g.fillStyle = '#0c0b0a'; for (let x = 20; x < W - 40; x += 110) g.fillRect(x, 30, 92, 90);
    g.fillStyle = '#3a3430'; g.fillRect(0, 124, W, 8);
    for (let i = 0; i < 6000; i++) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(rnd(0, W), rnd(0, H), 2, 2); }
  });
}
function buildWar(root, map, th, quality, ups, fires, smokes) {
  const TL = C.TILE * U, PW = map.pw * U, PH = map.ph * U, cx = PW / 2;
  const burntM = stdMat({ map: tex('burnt'), roughness: 0.85, metalness: 0.3 });
  const dark = [], steel = [], conc = [];
  // ---- памятник в центре (размеры совпадают с формой для попаданий)
  const sx = 22 * TL, sz = 13 * TL;
  const granite = stdMat({ map: tex('granite'), roughness: 0.55 }), bronze = stdMat({ map: tex('bronze'), metalness: 0.75, roughness: 0.45 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(88 * U, 40 * U, 88 * U), granite); plinth.position.set(sx, 20 * U, sz);
  const ped = new THREE.Mesh(new THREE.BoxGeometry(52 * U, 60 * U, 52 * U), granite); ped.position.set(sx, 70 * U, sz);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(9.5 * U, 12 * U, 35 * U, 18), bronze); coat.position.set(sx, 117.5 * U, sz);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(7.5 * U, 8.5 * U, 27 * U, 16), bronze); torso.position.set(sx, 148.5 * U, sz);
  const head = new THREE.Mesh(new THREE.SphereGeometry(5 * U, 16, 12), bronze); head.scale.set(1, 1.15, 1); head.position.set(sx, 167 * U, sz);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * U, 2.6 * U, 22 * U, 10), bronze); armR.position.set(sx + 7.5 * U, 148 * U, sz - 2 * U); armR.rotation.z = 0.12;
  const armL = armR.clone(); armL.position.x = sx - 7.5 * U; armL.rotation.set(-0.5, 0, -0.12);
  for (const m of [plinth, ped, coat, torso, head, armR, armL]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  const plaque = canvasTex(512, 128, (g, W, H) => { g.fillStyle = '#2b2522'; g.fillRect(0, 0, W, H); g.fillStyle = '#c9a85a'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.fillText('CƏFƏR CABBARLI', W / 2, 60); g.font = '28px Georgia, serif'; g.fillText('1899 — 1934', W / 2, 104); });
  const pm = new THREE.MeshBasicMaterial({ map: plaque });
  for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) decal(root, pm, sx + nx * 26 * U, 70 * U, sz + nz * 26 * U, nx, nz, 1.6, 0.4);
  // ---- сгоревшие машины и автобус
  for (const p of map.props) {
    if (p.type === 'bcar') {
      const ccx = (p.x + p.w / 2) * TL, ccz = (p.y + p.h / 2) * TL, L = 88 * U, Wd = 38 * U, h = p.horiz;
      const body = new THREE.Mesh(new THREE.BoxGeometry(h ? L : Wd, 22 * U, h ? Wd : L), burntM); body.position.set(ccx, 16 * U, ccz);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(h ? 44 * U : 34 * U, 13 * U, h ? 34 * U : 44 * U), burntM); cab.position.set(ccx, 33.5 * U, ccz);
      for (const m of [body, cab]) { m.castShadow = m.receiveShadow = true; root.add(m); }
      // пустые оконные проёмы, диски колёс
      for (const s of [-1, 1]) {
        if (h) dark.push(bx(36 * U, 9 * U, 0.02, ccx, 34 * U, ccz + s * 17.2 * U, 0x0b0a09)); else dark.push(bx(0.02, 9 * U, 36 * U, ccx + s * 17.2 * U, 34 * U, ccz, 0x0b0a09));
        for (const t of [-1, 1]) { const ox = h ? t * 30 * U : s * 16 * U, oz = h ? s * 16 * U : t * 30 * U; steel.push(part(CYL, 0x3a3734, ccx + ox, 5 * U, ccz + oz, 5.5 * U, 4 * U, 5.5 * U, h ? Math.PI / 2 : 0, 0, h ? 0 : Math.PI / 2)); }
      }
      if ((p.x + p.y) % 2 === 0) fires.push(new THREE.Vector3(ccx, 1.2, ccz));
    } else if (p.type === 'bus') {
      const len = p.w * 48 - 6, ccx = (p.x + p.w / 2) * TL, ccz = (p.y + 0.5) * TL;
      const bt = burntBusTex(); const side = stdMat({ map: bt, roughness: 0.8, metalness: 0.25 });
      const bus = new THREE.Mesh(new THREE.BoxGeometry(len * U, 62 * U, 42 * U), [burntM, burntM, burntM, burntM, side, side]); bus.position.set(ccx, 37 * U, ccz);
      bus.castShadow = bus.receiveShadow = true; root.add(bus);
      for (const t of [-0.32, 0.32]) for (const s of [-1, 1]) steel.push(part(CYL, 0x2e2b28, ccx + t * len * U, 6 * U, ccz + s * 19 * U, 6 * U, 5 * U, 6 * U, Math.PI / 2, 0, 0));
      smokes.push(new THREE.Vector3(ccx, 3.0, ccz));
    } else if (p.type === 'metroM') {
      const mx = (p.x + p.w / 2) * TL, mz = (p.y + p.h / 2) * TL;
      const sign = canvasTex(256, 256, (g, W) => { g.fillStyle = '#c62828'; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 4, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 170px Arial'; g.textAlign = 'center'; g.fillText('M', W / 2, W / 2 + 60); g.fillStyle = 'rgba(20,18,16,0.6)'; g.beginPath(); g.arc(W * 0.7, W * 0.3, 40, 0, 7); g.fill(); });
      const sm = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.5, emissive: 0x330000 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24), [new THREE.MeshStandardMaterial({ color: 0x8a1c1c }), sm, sm]); disc.rotation.set(Math.PI / 2, 0, 0.25); disc.position.set(mx, 4.6, mz - p.h * TL / 2 - 0.3); root.add(disc);
      steel.push(part(CYL, 0x3b3f44, mx, 3.6, mz - p.h * TL / 2 - 0.3, 0.06, 1.4, 0.06));
      // навес над входом
      conc.push(bx(p.w * TL + 0.6, 0.25, p.h * TL + 0.6, mx, 72 * U + 0.12, mz, 0x8d8a84));
    }
  }
  // ---- ежи и груды обломков (форма = форма для пуль)
  const rubM = worldMat('ruin', 2);
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    const c = map.cols[y * map.W + x]; if (!c.s[0]) continue; const m = c.s[0][2], px = (x + 0.5) * TL, pz = (y + 0.5) * TL;
    if (m === 'hedge') {
      for (const [a, b] of [[[-16, -16, 2], [16, 16, 26]], [[16, -16, 2], [-16, 16, 26]], [[0, -18, 26], [0, 18, 2]]]) {
        const A = new THREE.Vector3(px + a[0] * U, a[2] * U, pz + a[1] * U), Bv = new THREE.Vector3(px + b[0] * U, b[2] * U, pz + b[1] * U), d = Bv.clone().sub(A), L = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), e = new THREE.Euler().setFromQuaternion(q);
        steel.push(part(BOX, 0x3b2f27, (A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2, 0.16, L, 0.16, e.x, e.y, e.z));
      }
    } else if (m === 'rubble') {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), rubM); mound.scale.set(26 * U, 20 * U, 26 * U); mound.position.set(px, 0, pz); mound.castShadow = mound.receiveShadow = true; root.add(mound);
      for (let i = 0; i < 7; i++) { const a = srnd(0, 6.28), r = srnd(0.2, 0.85), hh = Math.sqrt(Math.max(0, 1 - r * r)) * 20 * U; conc.push(bx(srnd(0.15, 0.4), srnd(0.08, 0.2), srnd(0.15, 0.4), px + Math.cos(a) * r * 26 * U, hh, pz + Math.sin(a) * r * 26 * U, [0x8d867a, 0x7a7266, 0x9a6a50][i % 3], srnd(-0.5, 0.5), srnd(0, 3), srnd(-0.5, 0.5))); }
      for (let i = 0; i < 3; i++) { const a = srnd(0, 6.28); steel.push(part(CYL, 0x5a3a28, px + Math.cos(a) * 0.4, 0.75, pz + Math.sin(a) * 0.4, 0.012, 0.9, 0.012, srnd(-0.6, 0.6), 0, srnd(-0.6, 0.6))); }
    }
  }
  // ---- обломки и мусор на асфальте, воронки
  for (let i = 0; i < 260; i++) {
    const x = srnd(1, map.W - 1), y = srnd(1, map.H - 1), c = map.cols[Math.floor(y) * map.W + Math.floor(x)];
    if (c.kind !== 'out' || c.s.length) continue;
    conc.push(bx(srnd(0.06, 0.3), srnd(0.04, 0.1), srnd(0.06, 0.3), x * TL, 0.03, y * TL, [0x8d867a, 0x6e675e, 0x9a6a50, 0x3a3836][i % 4], 0, srnd(0, 3), 0));
  }
  const crM = new THREE.MeshLambertMaterial({ map: tex('crater'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const [x, y, r] of [[10, 9, 2.4], [34, 16, 2.4], [18, 15, 1.8], [26, 10, 1.8], [3, 24, 2], [41, 1, 2], [22, 3, 2.6], [22, 23, 2.6]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), crM); m.rotation.set(-Math.PI / 2, 0, srnd(0, 6)); m.position.set(x * TL, 0.02, y * TL); root.add(m);
  }
  // ---- задник: вокзал (север), 28 Mall (юг), университет (восток), станция и офисная башня (запад)
  const st = stationTex(); const stM = stdMat({ map: st });
  const stone = stdMat({ color: 0xcdb38a });
  const station = new THREE.Mesh(new THREE.BoxGeometry(120, 14, 14), [stone, stone, stone, stone, stM, stone]); station.position.set(cx, 7, -24); root.add(station);
  // часовая башня с циферблатами и шпилем
  const ct = clockTex(), ctM = stdMat({ map: ct });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 34, 8), stone); tower.position.set(cx, 17, -19); root.add(tower);
  const clock = new THREE.Mesh(new THREE.BoxGeometry(8.4, 6, 8.4), [ctM, ctM, stone, stone, ctM, ctM]); clock.position.set(cx, 28, -19); root.add(clock);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(5.2, 9, 4), stdMat({ color: 0x5d6a63, roughness: 0.6, metalness: 0.4 })); spire.position.set(cx, 38.5, -19); spire.rotation.y = Math.PI / 4; root.add(spire);
  // боковые павильоны с куполами (один купол пробит)
  const domeM = stdMat({ color: 0x6e7b74, roughness: 0.55, metalness: 0.35 });
  for (const dx of [-42, 42]) {
    const pav = new THREE.Mesh(new THREE.BoxGeometry(14, 20, 12), stone); pav.position.set(cx + dx, 10, -21); root.add(pav);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeM); dome.position.set(cx + dx, 20, -21); root.add(dome);
    if (dx > 0) { const hole = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0x0c0b0a })); hole.scale.set(1, 0.5, 1); hole.position.set(cx + dx - 2, 24.3, -18.5); root.add(hole); smokes.push(new THREE.Vector3(cx + dx - 2, 25, -18.5)); }
  }
  const mall = new THREE.Mesh(new THREE.BoxGeometry(110, 20, 22), [stone, stone, stone, stone, stdMat({ map: mallTex() }), stone]); mall.material[2] = stdMat({ color: 0x51585e }); mall.position.set(cx, 10, PH + 26); mall.rotation.y = Math.PI; root.add(mall);
  // стальные распорки крыши 28 Mall
  for (let i = -6; i <= 6; i++) { steel.push(bx(0.35, 9, 0.35, cx + i * 8, 22.5, PH + 16.5, 0x2e3236, 0, 0, i % 2 ? 0.5 : -0.5)); }
  steel.push(bx(104, 0.4, 0.4, cx, 26.6, PH + 16.5, 0x2e3236));
  const uni = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 70), stdMat({ color: 0xe0ddd5 })); uni.position.set(PW + 26, 9, PH / 2); root.add(uni);
  decal(root, stdMat({ map: uniTex() }), PW + 15, 9, PH / 2, -1, 0, 70, 18);
  const gM = stdMat({ map: glassTex(false), roughness: 0.25, metalness: 0.6 }), gD = stdMat({ map: glassTex(true), roughness: 0.3, metalness: 0.6 });
  const stn = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 40), gM); stn.position.set(-24, 6, PH / 2); root.add(stn);
  const office = new THREE.Mesh(new THREE.BoxGeometry(20, 56, 20), gD); office.position.set(-62, 28, PH / 2 - 14); root.add(office);
  smokes.push(new THREE.Vector3(-58, 50, PH / 2 - 10));
  // дальний разрушенный город
  const far = [];
  for (let i = 0; i < 120; i++) {
    const a = srnd(0, 6.28), r = srnd(140, 320), x = cx + Math.cos(a) * r, z = PH / 2 + Math.sin(a) * r * 0.8, w = srnd(10, 26), hh = srnd(8, 40);
    far.push(bx(w, hh, srnd(10, 26), x, hh / 2, z, [0xb7ad9c, 0x9c958a, 0xc4b79c, 0x8a8a8a][i % 4]));
    if (i % 15 === 0) smokes.push(new THREE.Vector3(x, hh, z));
  }
  const farMat = stdMat({ map: tex('ruin'), vertexColors: true });
  root.add(new THREE.Mesh(merge(far), farMat));
  // фонари со сбитыми плафонами вдоль краёв
  for (const [x, y, lean] of [[6, 1, 0], [16, 1, 0.3], [28, 1, 0], [38, 1, -0.25], [6, 24, 0.2], [16, 24, 0], [28, 24, 0], [38, 24, 0]]) {
    steel.push(part(CYL, 0x3a3e42, x * TL, 3, y * TL, 0.07, 6, 0.07, lean, 0, 0));
    steel.push(bx(0.8, 0.1, 0.1, x * TL + 0.3, 5.95, y * TL + Math.sin(lean) * 3, 0x3a3e42));
  }
  fires.push(new THREE.Vector3(9.5 * TL, 1.1, 4.5 * TL), new THREE.Vector3(34.5 * TL, 1.1, 21.5 * TL));
  if (dark.length) root.add(meshOf(dark));
  if (steel.length) root.add(meshOf(steel, stdMat({ vertexColors: true, roughness: 0.6, metalness: 0.5 })));
  if (conc.length) root.add(meshOf(conc));
}
