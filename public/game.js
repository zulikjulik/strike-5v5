import * as THREE from 'three';
import { U, TEAM_COL, buildWorld, makeGun, makeCharacter, poseCharacter, tex } from './world.js';

const S = window.Shared;
const { C, MAPS, WEAPONS, WKEY, SKINS, SKEY } = S;
const { drawWeaponIcon, rr } = window.Draw;
const Sfx = window.Sfx;
const TEAM_HEX = ['#4ea1ff', '#ff5a5a'];
const TEAM_NAME = ['Синие', 'Красные'];
const $ = (id) => document.getElementById(id);

// =====================================================================
// Сохранение
// =====================================================================
const SAVE_KEY = 'strike5v5_save';
function defSave() { return { money: C.START_MONEY, ownedW: ['knife', 'glock', 'usp'], ownedS: ['recruit'], primary: null, pistol: 'usp', skin: 'recruit', nick: '', music: 0.4, sfx: 0.8, sens: 0.5, quality: 'high' }; }
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(defSave(), s); } catch {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
function addMoney(n) { save.money += n; persist(); $('money').textContent = save.money.toLocaleString('ru-RU'); }
function loadout() { return [save.primary ? WKEY[save.primary] : -1, WKEY[save.pistol] ?? WKEY.usp]; }

// =====================================================================
// Меню
// =====================================================================
const menu = $('menu');
let curTab = 'play';
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  Sfx.init(); Sfx.uiClick();
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
  curTab = b.dataset.tab;
  for (const t of ['play', 'arsenal', 'skins', 'settings']) $('tab-' + t).classList.toggle('hidden', t !== curTab);
  if (curTab === 'arsenal') buildArsenal();
  if (curTab === 'skins') buildSkins();
  if (curTab === 'play') { fillSelects(); refreshPreview(); }
});
document.addEventListener('pointerdown', () => Sfx.init(), { once: true });

$('name').value = save.nick;
$('name').oninput = () => { save.nick = $('name').value; persist(); };
$('money').textContent = save.money.toLocaleString('ru-RU');
$('volMusic').value = save.music; $('volSfx').value = save.sfx; $('sens').value = save.sens; $('quality').value = save.quality;
Sfx.setVolume('music', save.music); Sfx.setVolume('sfx', save.sfx);
$('volMusic').oninput = (e) => { save.music = +e.target.value; Sfx.setVolume('music', save.music); persist(); };
$('volSfx').oninput = (e) => { save.sfx = +e.target.value; Sfx.setVolume('sfx', save.sfx); persist(); };
$('sens').oninput = (e) => { save.sens = +e.target.value; persist(); };
$('quality').onchange = (e) => { save.quality = e.target.value; persist(); applyQuality(); };

function fillSelect(sel, slot) {
  const owned = WEAPONS.filter((w) => w.slot === slot && save.ownedW.includes(w.key));
  sel.innerHTML = (slot === 0 ? '<option value="">— нет (купи в Арсенале) —</option>' : '') + owned.map((w) => `<option value="${w.key}">${w.name}</option>`).join('');
  sel.value = (slot === 0 ? save.primary : save.pistol) || '';
}
function fillSelects() { fillSelect($('selPrimary'), 0); fillSelect($('selPistol'), 1); fillSelect($('pPrimary'), 0); fillSelect($('pPistol'), 1); }
function sendLoadout() { if (ws && ws.readyState === 1 && joined) ws.send(JSON.stringify({ t: 'lo', lo: loadout() })); }
function onSel(slot, val) { if (slot === 0) save.primary = val || null; else save.pistol = val; persist(); fillSelects(); refreshPreview(); sendLoadout(); }
$('selPrimary').onchange = (e) => onSel(0, e.target.value);
$('selPistol').onchange = (e) => onSel(1, e.target.value);
$('pPrimary').onchange = (e) => onSel(0, e.target.value);
$('pPistol').onchange = (e) => onSel(1, e.target.value);
fillSelects();

const CATS = [['all', 'Всё'], ['pistol', 'Пистолеты'], ['smg', 'Пистолеты-пулемёты'], ['shotgun', 'Дробовики'], ['rifle', 'Винтовки'], ['sniper', 'Снайперские'], ['mg', 'Пулемёт']];
let wcat = 'all';
const bar = (v) => `<div class="bar"><i style="width:${Math.round(Math.max(0.04, Math.min(1, v)) * 100)}%"></i></div>`;
function buildArsenal() {
  $('wcats').innerHTML = CATS.map(([k, n]) => `<button class="chip ${k === wcat ? 'active' : ''}" data-c="${k}">${n}</button>`).join('');
  $('wcats').querySelectorAll('.chip').forEach((c) => c.onclick = () => { wcat = c.dataset.c; Sfx.uiClick(); buildArsenal(); });
  const list = WEAPONS.filter((w) => w.cat !== 'knife' && (wcat === 'all' || w.cat === wcat || (wcat === 'pistol' && w.cat === 'dual')));
  const g = $('wgrid'); g.innerHTML = '';
  for (const w of list) {
    const owned = save.ownedW.includes(w.key), eq = (w.slot === 0 ? save.primary : save.pistol) === w.key;
    const el = document.createElement('div'); el.className = 'card' + (eq ? ' equipped' : '');
    const dps = (w.dmg * w.pellets) / 150, rate = Math.min(1, 1000 / w.fire / 14), acc = 1 - w.spread / 0.14, mob = (w.speed - 0.76) / 0.3;
    const tag = w.key === 'awp' ? '<span class="tag gold">ИМБА</span>' : owned ? '<span class="tag">Куплено</span>' : '';
    el.innerHTML = `<canvas width="460" height="180"></canvas><div class="name">${w.name} ${tag}</div>
      <div class="stats"><span>Урон</span>${bar(dps)}<span>Скорострельн.</span>${bar(rate)}<span>Точность</span>${bar(acc)}<span>Мобильность</span>${bar(mob)}</div>
      ${owned ? (eq ? '<button class="b-on">Выбрано</button>' : '<button class="b-eq">Выбрать</button>') : `<button class="b-buy" ${save.money < w.price ? 'disabled' : ''}>Купить · $${w.price.toLocaleString('ru-RU')}</button>`}`;
    drawWeaponIcon(el.querySelector('canvas').getContext('2d'), w.id, 460, 180);
    el.querySelector('button').onclick = () => {
      if (!owned) { if (save.money < w.price) return; save.money -= w.price; save.ownedW.push(w.key); Sfx.buy(); } else Sfx.uiClick();
      if (w.slot === 0) save.primary = w.key; else save.pistol = w.key;
      persist(); addMoney(0); fillSelects(); buildArsenal(); sendLoadout();
    };
    g.appendChild(el);
  }
}

// Предпросмотр персонажей в 3D
const pv = $('preview');
const pvR = new THREE.WebGLRenderer({ canvas: pv, alpha: true, antialias: true });
pvR.setSize(340, 340, false); pvR.setPixelRatio(2); pvR.outputColorSpace = THREE.SRGBColorSpace;
const pvScene = new THREE.Scene();
pvScene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.0));
const pvSun = new THREE.DirectionalLight(0xffffff, 2.2); pvSun.position.set(2, 4, 3); pvScene.add(pvSun);
const pvCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); pvCam.position.set(0, 1.25, 4.6); pvCam.lookAt(0, 0.95, 0);
const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: 0x4ea1ff, transparent: true, opacity: 0.18 })); disc.rotation.x = -Math.PI / 2; pvScene.add(disc);
let pvChar = null, pvAng = Math.PI - 0.5;
function refreshPreview() {
  if (pvChar) pvScene.remove(pvChar);
  const wid = save.primary ? WKEY[save.primary] : WKEY[save.pistol];
  pvChar = makeCharacter(SKEY[save.skin] ?? 0, 0, wid); pvChar.rotation.y = pvAng; pvScene.add(pvChar);
}
refreshPreview();
let cardR = null;
function skinImage(id) {
  if (!cardR) { cardR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); cardR.setSize(460, 300, false); cardR.outputColorSpace = THREE.SRGBColorSpace; }
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.0)); const l = new THREE.DirectionalLight(0xffffff, 2.2); l.position.set(2, 4, 3); sc.add(l);
  const ch = makeCharacter(id, 0, WKEY.ak47); ch.rotation.y = Math.PI - 0.55; sc.add(ch);
  const cam = new THREE.PerspectiveCamera(28, 460 / 300, 0.1, 50); cam.position.set(0, 1.05, 3.4); cam.lookAt(0, 0.92, 0);
  cardR.render(sc, cam); return cardR.domElement.toDataURL();
}
const skinImgs = {};
function buildSkins() {
  const g = $('sgrid'); g.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.ownedS.includes(s.key), eq = save.skin === s.key;
    const el = document.createElement('div'); el.className = 'card skin' + (eq ? ' equipped' : '');
    const tag = s.female ? '<span class="tag pink">Меньше хитбокс</span>' : owned ? '<span class="tag">Куплено</span>' : '';
    if (!skinImgs[s.id]) skinImgs[s.id] = skinImage(s.id);
    el.innerHTML = `<img src="${skinImgs[s.id]}"><div class="name">${s.name} ${tag}</div>
      ${owned ? (eq ? '<button class="b-on">Надето</button>' : '<button class="b-eq">Надеть</button>') : `<button class="b-buy" ${save.money < s.price ? 'disabled' : ''}>Купить · $${s.price.toLocaleString('ru-RU')}</button>`}`;
    el.querySelector('button').onclick = () => {
      if (!owned) { if (save.money < s.price) return; save.money -= s.price; save.ownedS.push(s.key); Sfx.buy(); } else Sfx.uiClick();
      save.skin = s.key; persist(); addMoney(0); buildSkins(); refreshPreview();
    };
    g.appendChild(el);
  }
}

// =====================================================================
// Рендер
// =====================================================================
const glc = $('gl'), hud = $('hud'), h = hud.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 400); camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.6));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.6); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);
const vmFlashLight = new THREE.PointLight(0xffc070, 0, 3); vmFlashLight.position.set(0.2, -0.1, -0.8); vmScene.add(vmFlashLight);
const flashLight = new THREE.PointLight(0xffb060, 0, 9, 1.5); scene.add(flashLight);
const flashLight2 = new THREE.PointLight(0xffb060, 0, 9, 1.5); scene.add(flashLight2);

let W = 0, H = 0, DPR = 1;
function applyQuality() {
  const hi = save.quality === 'high';
  renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 1.5) : 0.85);
  renderer.shadowMap.enabled = hi;
  resize();
}
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  renderer.setSize(W, H, false);
  hud.width = W * DPR; hud.height = H * DPR; hud.style.width = W + 'px'; hud.style.height = H + 'px';
  camera.aspect = W / H; camera.updateProjectionMatrix(); vmCam.aspect = W / H; vmCam.updateProjectionMatrix();
  for (const p of psys) p.mat.uniforms.scale.value = (H * renderer.getPixelRatio()) / 2;
}
addEventListener('resize', resize);

// ---------------- частицы ----------------
class PSys {
  constructor(max, additive) {
    this.max = max; this.list = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex('soft') }, scale: { value: 400 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.05,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC,vA*t.a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  add(o) { if (this.list.length < this.max) this.list.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0.92, grow: 0, life: 0, a: 1 }, o)); }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life += dt; if (p.life >= p.max) continue;
      p.vy -= p.g * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01 && p.g) { p.y = 0.01; p.vy *= -0.2; p.vx *= 0.5; p.vz *= 0.5; }
      const k = 1 - p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.c.r; this.col[n * 3 + 1] = p.c.g; this.col[n * 3 + 2] = p.c.b;
      this.size[n] = p.s + p.grow * (1 - k); this.alpha[n] = p.a * (p.fadeIn ? Math.min(1, (1 - k) * 6) * k : k);
      L[n++] = p;
    }
    L.length = n;
    for (const a of ['position', 'pcolor', 'psize', 'palpha']) this.geo.attributes[a].needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
}
const pAdd = new PSys(1500, true), pNorm = new PSys(1500, false);
const psys = [pAdd, pNorm];
applyQuality();

const COL = { spark: new THREE.Color(1, 0.8, 0.4), dust: new THREE.Color(0.62, 0.58, 0.5), blood: new THREE.Color(0.55, 0.02, 0.04), smoke: new THREE.Color(0.8, 0.8, 0.8) };

// ---------------- трассеры, вспышки, следы, гильзы ----------------
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const tracerPool = [], smokePool = [];
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(unitBox, tracerMat); m.visible = false; scene.add(m); tracerPool.push(m); }
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xdde3ec, transparent: true, opacity: 0.3, depthWrite: false })); m.visible = false; scene.add(m); smokePool.push(m); }
let tracers = [], smokes = [];
const flashMat = new THREE.SpriteMaterial({ map: tex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const flashPool = []; for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(flashMat); s.visible = false; scene.add(s); flashPool.push({ s, t: 0 }); }
let flashIdx = 0;
const holeMat = new THREE.MeshBasicMaterial({ map: tex('hole'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const bloodMat = new THREE.MeshBasicMaterial({ map: tex('blood'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const planeGeo = new THREE.PlaneGeometry(1, 1);
const holes = [], bloods = []; let holeIdx = 0, bloodIdx = 0;
for (let i = 0; i < 220; i++) { const m = new THREE.Mesh(planeGeo, holeMat); m.visible = false; m.scale.setScalar(0.09); scene.add(m); holes.push(m); }
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(planeGeo, bloodMat); m.visible = false; scene.add(m); bloods.push(m); }
const shellMat = new THREE.MeshLambertMaterial({ color: 0xd9a740 }), shellGeo = new THREE.BoxGeometry(0.012, 0.012, 0.04);
const shells = []; for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(shellGeo, shellMat); m.visible = false; scene.add(m); shells.push({ m, v: new THREE.Vector3(), life: 0 }); }
let shellIdx = 0;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

function placeDecal(pool, idx, p, n, size) {
  const m = pool[idx % pool.length];
  m.position.set(p.x + n.x * 0.012, p.y + n.y * 0.012, p.z + n.z * 0.012);
  _v.copy(m.position).add(n); m.lookAt(_v); m.rotateZ(Math.random() * 6);
  m.scale.setScalar(size); m.visible = true;
}
function ejectShell(pos, yaw) {
  const s = shells[shellIdx++ % shells.length];
  s.m.position.copy(pos); s.m.visible = true; s.life = 0;
  const r = yaw + Math.PI / 2;
  s.v.set(Math.cos(r) * 1.6 + (Math.random() - 0.5) * 0.6, 1.6 + Math.random(), Math.sin(r) * 1.6 + (Math.random() - 0.5) * 0.6);
  s.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
}
function muzzleFlash(pos, big, own) {
  const f = flashPool[flashIdx++ % flashPool.length];
  f.s.position.copy(pos); f.s.scale.setScalar(0.35 * big); f.s.material.rotation = Math.random() * 6; f.s.visible = true; f.t = performance.now();
  const L = own ? flashLight : flashLight2; L.position.copy(pos); L.intensity = 6 * big; L.userData.t = performance.now();
  for (let i = 0; i < 2; i++) pNorm.add({ x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.6, max: 0.7, s: 0.12, grow: 0.5, c: COL.smoke, a: 0.18, drag: 0.95 });
}
function impactWall(p, n) {
  placeDecal(holes, holeIdx++, p, n, 0.07 + Math.random() * 0.04);
  for (let i = 0; i < 7; i++) pAdd.add({ x: p.x, y: p.y, z: p.z, vx: n.x * 2 + (Math.random() - 0.5) * 4, vy: n.y * 2 + Math.random() * 3, vz: n.z * 2 + (Math.random() - 0.5) * 4, max: 0.15 + Math.random() * 0.2, s: 0.035, c: COL.spark, g: 9, drag: 0.95 });
  for (let i = 0; i < 3; i++) pNorm.add({ x: p.x, y: p.y, z: p.z, vx: n.x * 0.8 + (Math.random() - 0.5) * 0.5, vy: n.y * 0.8 + Math.random() * 0.4, vz: n.z * 0.8 + (Math.random() - 0.5) * 0.5, max: 0.6 + Math.random() * 0.4, s: 0.1, grow: 0.35, c: COL.dust, a: 0.45, drag: 0.9 });
}
function impactBody(p, dir, big) {
  for (let i = 0; i < (big ? 18 : 9); i++) pNorm.add({ x: p.x, y: p.y, z: p.z, vx: dir.x * 2 + (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: dir.z * 2 + (Math.random() - 0.5) * 2, max: 0.5 + Math.random() * 0.3, s: 0.05 + Math.random() * 0.04, c: COL.blood, g: 9, a: 0.95, drag: 0.97 });
  // кровь на полу или стене позади
  const map = MAPS[mapIndex];
  const hit = S.ray3(map, p.x / U, p.z / U, p.y / U, dir.x, dir.z, -0.4, 120);
  if (hit.n && hit.t < 120) { const q = new THREE.Vector3(p.x + dir.x * hit.t * U, p.y - 0.4 * hit.t * U, p.z + dir.z * hit.t * U); placeDecal(bloods, bloodIdx++, q, new THREE.Vector3(hit.n[0], hit.n[2], hit.n[1]), 0.4 + Math.random() * 0.5); }
}

// =====================================================================
// Сеть и состояние
// =====================================================================
let ws = null, myId = 0, mapIndex = 0, joined = false, leaving = false, world = null, worldIdx = -1;
let snaps = [], last = null, roster = new Map();
const me = { alive: false, hp: 100, team: 0, slot: 1, prevSlot: 0, wpn: [-1, WKEY.usp, WKEY.knife], scoped: false, info: {}, yaw: 0, pitch: 0 };
let pred = { x: 0, y: 0, z: 0, vz: 0, og: true }, prevPred = { ...pred }, predT = 0, deathPos = null, deathT = 0;
let pending = [], seq = 0;
let lastState = 'play', endBonus = 0, killedBy = null;
let feed = [], floaters = [], ping = 0, hurtFlash = 0, lastHp = 100, hitMark = 0, hitHead = false;
const others = new Map();

function startGame() {
  Sfx.init();
  save.nick = $('name').value.trim(); persist();
  $('status').textContent = 'Подключение…'; leaving = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: save.nick || 'Игрок', skin: SKEY[save.skin] ?? 0, lo: loadout() }));
  ws.onclose = () => { const was = joined; joined = false; showMenu(); if (!leaving) $('status').textContent = was ? 'Соединение потеряно. Жми «В бой», чтобы вернуться.' : 'Не удалось подключиться к серверу.'; };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'welcome') { myId = m.id; setMap(m.m); joined = true; showGame(); }
    else if (m.t === 'map') { setMap(m.m); feed.push({ s: 'Карта: ' + MAPS[mapIndex].name, c: '#ffd166', t: performance.now() }); }
    else if (m.t === 'pong') ping = Math.round(performance.now() - m.c);
    else if (m.t === 's') onSnap(m);
  };
}
setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', c: performance.now() })); }, 2000);
$('play').onclick = startGame;
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });

function showGame() { menu.classList.add('hidden'); glc.classList.remove('hidden'); hud.classList.remove('hidden'); $('status').textContent = ''; Sfx.setInGame(true); lockPointer(); }
function showMenu() { menu.classList.remove('hidden'); glc.classList.add('hidden'); hud.classList.add('hidden'); $('pause').classList.add('hidden'); paused = false; Sfx.setInGame(false); fillSelects(); addMoney(0); refreshPreview(); if (curTab === 'arsenal') buildArsenal(); if (curTab === 'skins') buildSkins(); if (document.pointerLockElement) document.exitPointerLock(); }
$('resume').onclick = () => { paused = false; $('pause').classList.add('hidden'); lockPointer(); };
$('toMenu').onclick = () => { leaving = true; if (ws) ws.close(); };

function setMap(i) {
  mapIndex = i; snaps = []; pending = []; lastState = 'play';
  for (const o of others.values()) scene.remove(o.model); others.clear();
  for (const m of holes) m.visible = false; for (const m of bloods) m.visible = false;
  if (world) { scene.remove(world.root); world.root.traverse((o) => { if (o.isMesh && o.geometry !== unitBox) o.geometry.dispose(); }); }
  world = buildWorld(scene, MAPS[i], save.quality); worldIdx = i;
}

const curWid = () => { const w = me.wpn[me.slot]; return w != null && w >= 0 ? w : WKEY.knife; };
const curW = () => WEAPONS[curWid()];

function onSnap(m) {
  const now = performance.now();
  if (m.r) roster = new Map(m.r.map((r) => [r[0], { name: r[1], team: r[2], kills: r[3], deaths: r[4], bot: r[5], skin: r[6] }]));
  const players = new Map();
  for (const p of m.p) players.set(p[0], { id: p[0], team: p[1], x: p[2], y: p[3], z: p[4], yaw: p[5], pitch: p[6], hp: p[7], alive: p[8], bot: p[9], wid: p[10], skin: p[11], sc: p[12], mv: p[13] });
  snaps.push({ t: now, players }); if (snaps.length > 30) snaps.shift();
  const prevInfo = me.info || {};
  last = m; me.info = m.me;
  if (m.me.wpn) me.wpn = m.me.wpn;
  if (m.me.rl > 0 && !(prevInfo.rl > 0)) { Sfx.reloadStart(); me.scoped = false; pendShots = []; reloadTotal = m.me.rl; }
  if (!(m.me.rl > 0) && prevInfo.rl > 0 && m.me.ammo > (prevInfo.ammo ?? 0)) Sfx.reloadEnd();
  const sp = players.get(myId);
  if (sp) {
    me.team = sp.team; me.hp = sp.hp;
    if (sp.hp < lastHp && sp.alive) hurtFlash = 1;
    lastHp = sp.hp;
    if (!sp.alive) {
      if (me.alive) { deathPos = { x: pred.x, y: pred.y, z: pred.z }; deathT = now; }
      me.alive = false; pending = []; me.scoped = false;
    } else {
      const wasDead = !me.alive;
      me.alive = true;
      if (wasDead) { me.slot = m.me.slot; me.scoped = false; killedBy = null; pendShots = []; me.yaw = sp.yaw; me.pitch = 0; buildVM(); }
      pending = pending.filter((i) => i.s > m.me.seq);
      const st = { x: m.me.x, y: m.me.y, z: m.me.z, vz: m.me.vz, og: !!m.me.og };
      for (const i of pending) S.step(MAPS[mapIndex], st, i.k, i.a, !!i.j, S.speedOf(i.wid, i.z), C.DT);
      if (wasDead || Math.hypot(st.x - pred.x, st.y - pred.y) > 60) prevPred = { ...st };
      pred = st;
    }
  }
  for (const s of m.sh) onShot(s, now);
  for (const ev of m.ev) {
    if (ev.t === 'kill') {
      feed.push({ kill: ev, t: now });
      if (ev.k === myId) { const r = WEAPONS[ev.w].reward; addMoney(r); floaters.push({ s: `+$${r}  ${ev.vn}${ev.hs ? '  · ХЕДШОТ' : ''}`, t: now }); Sfx.killDing(); }
      if (ev.v === myId) killedBy = { name: ev.kn, w: WEAPONS[ev.w].name, hs: ev.hs };
    } else if (ev.t === 'msg') feed.push({ s: ev.s, c: '#9aa3b2', t: now });
  }
  if (feed.length > 6) feed.splice(0, feed.length - 6);
  if (m.st === 'end' && lastState !== 'end') { const win = m.w !== 'D' && (m.w === 'A' ? 0 : 1) === me.team; endBonus = win ? C.WIN_BONUS : C.LOSE_BONUS; addMoney(endBonus); }
  lastState = m.st;
}

const NRM = [null, [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function onShot(s, now) {
  const [x1, y1, z1, x2, y2, z2, nn, flag, wid, sid, first, hs] = s;
  const w = WEAPONS[wid], mine = sid === myId;
  const end = new THREE.Vector3(x2 * U, z2 * U, y2 * U);
  if (flag === 3) { impactBody(end, new THREE.Vector3(0, 0, 0), true); if (mine) { hitMark = now; hitHead = !!hs; Sfx.hit(); } return; }
  const ldx = x1 - pred.x, ldy = y1 - pred.y, ld = Math.hypot(ldx, ldy);
  const pan = ld > 1 ? Math.sin(Math.atan2(ldy, ldx) - me.yaw) : 0;
  if (w.cat === 'knife') {
    if (!mine) Sfx.shot(wid, ld, pan);
    if (flag === 1) { impactBody(end, new THREE.Vector3(x2 - x1, 0, y2 - y1).normalize(), false); if (mine) { hitMark = now; Sfx.hit(); } }
    return;
  }
  let start;
  if (mine) start = ownMuzzleWorld();
  else {
    const o = others.get(sid);
    if (o && o.model) { o.model.updateMatrixWorld(true); const g = o.model.userData.gun; start = g.localToWorld(g.userData.muzzle.clone()); }
    else start = new THREE.Vector3(x1 * U, z1 * U, y1 * U);
    if (first) { Sfx.shot(wid, ld, pan); muzzleFlash(start, w.key === 'awp' ? 1.6 : w.cat === 'shotgun' ? 1.4 : 1, false); ejectShell(start, Math.atan2(y2 - y1, x2 - x1)); }
  }
  if (mine && first) pendShots.shift();
  const dir = end.clone().sub(start); const len = dir.length(); dir.normalize();
  tracers.push({ start, dir, len, t: now, flag, nn, end, wid, mine, hs });
  if (w.key === 'awp') smokes.push({ start, end, t: now });
}
function ownMuzzleWorld() {
  _v.set(0.14, -0.1, -0.7).applyQuaternion(camera.quaternion).add(camera.position);
  return _v.clone();
}

// =====================================================================
// Ввод
// =====================================================================
const KEYMAP = { KeyW: 1, ArrowUp: 1, KeyS: 2, ArrowDown: 2, KeyA: 4, ArrowLeft: 4, KeyD: 8, ArrowRight: 8 };
const keys = {}; let mouseDown = false, clickLatch = false, edgeAt = 0, reloadReq = false, jumpLatch = false, showBoard = false, paused = false, locked = false;
let swayX = 0, swayY = 0;
function lockPointer() { try { const p = glc.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === glc;
  if (!locked && joined && !leaving && !paused) { paused = true; mouseDown = false; $('pause').classList.remove('hidden'); fillSelects(); }
});
glc.addEventListener('click', () => { if (joined && !locked && !paused) lockPointer(); });
function selectSlot(s) {
  if (s === me.slot) return;
  const w = me.wpn[s]; if (w == null || w < 0) return;
  me.prevSlot = me.slot; me.slot = s; me.scoped = false; pendShots = []; localSwitchUntil = performance.now() + 350; Sfx.deploy(); buildVM();
}
addEventListener('keydown', (e) => {
  if (!joined) return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard = true; }
  if (paused) return;
  if (e.code === 'KeyR') reloadReq = true;
  if (e.code === 'Space') { jumpLatch = true; e.preventDefault(); }
  if (e.code === 'Digit1') selectSlot(0);
  if (e.code === 'Digit2') selectSlot(1);
  if (e.code === 'Digit3') selectSlot(2);
  if (e.code === 'KeyQ') selectSlot(me.prevSlot);
  if (e.code === 'KeyM') Sfx.toggleMusic();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') { e.preventDefault(); showBoard = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!joined || paused || !locked) return;
  const zoomK = camera.fov / 78;
  const k = 0.0007 + save.sens * 0.0042;
  me.yaw += e.movementX * k * zoomK; me.pitch -= e.movementY * k * zoomK;
  me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch));
  swayX += e.movementX * 0.0004; swayY += e.movementY * 0.0004;
});
glc.addEventListener('mousedown', (e) => {
  if (!joined || paused) return;
  if (e.button === 0) { mouseDown = true; clickLatch = true; edgeAt = performance.now(); }
  if (e.button === 2 && curW().scope && me.alive && !(me.info.rl > 0)) { me.scoped = !me.scoped; Sfx.uiClick(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
glc.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (!joined || paused) return;
  let i = me.slot;
  for (let n = 0; n < 3; n++) { i = (i + (e.deltaY > 0 ? 1 : 2)) % 3; const w = me.wpn[i]; if (w != null && w >= 0) { selectSlot(i); break; } }
}, { passive: true });

// 30 раз в секунду: ввод на сервер + предсказание
let moving = false;
setInterval(() => {
  if (!joined || !ws || ws.readyState !== 1) return;
  let k = 0; if (!paused) for (const c in KEYMAP) if (keys[c]) k |= KEYMAP[c];
  const playing = last && last.st === 'play';
  const f = !paused && playing && (mouseDown || clickLatch) ? 1 : 0;
  clickLatch = false;
  const inp = { t: 'in', s: ++seq, k: playing ? k : 0, a: Math.round(me.yaw * 1000) / 1000, p: Math.round(me.pitch * 1000) / 1000, f, r: reloadReq ? 1 : 0, w: me.slot, z: me.scoped ? 1 : 0, j: jumpLatch && playing ? 1 : 0 };
  reloadReq = false; jumpLatch = false;
  ws.send(JSON.stringify(inp));
  if (me.alive && playing) {
    inp.wid = curWid(); pending.push(inp);
    prevPred = { ...pred }; predT = performance.now();
    const wasOg = pred.og;
    moving = S.step(MAPS[mapIndex], pred, inp.k, inp.a, !!inp.j, S.speedOf(inp.wid, inp.z), C.DT);
    if (inp.j && wasOg && !pred.og) Sfx.step(1.2);
    if (!wasOg && pred.og) Sfx.step(1.5);
  } else moving = false;
}, 1000 / C.TICK);

// Локальный выстрел (звук, вспышка, отдача — сразу)
let localLast = 0, localSwitchUntil = 0, pendShots = [], dryAt = 0, spray = 0, reloadTotal = 1, kick = 0, slashT = 0;
function localAmmo() { const now = performance.now(); pendShots = pendShots.filter((t) => now - t < 500); return Math.max(0, (me.info.ammo ?? 0) - pendShots.length); }
function localFire(now) {
  if (!me.alive || paused || !last || last.st !== 'play') return;
  const w = curW();
  const want = w.auto ? mouseDown : now - edgeAt < 220;
  if (!want || now < localSwitchUntil || me.info.rl > 0 || now - localLast < w.fire) return;
  if (w.cat !== 'knife' && localAmmo() <= 0) { if (now - dryAt > 300) { Sfx.dry(); dryAt = now; } edgeAt = 0; return; }
  localLast = now; edgeAt = 0;
  Sfx.shot(w.id, 0, 0);
  if (w.cat === 'knife') { slashT = now; return; }
  pendShots.push(now);
  const big = w.key === 'awp' ? 1.6 : w.cat === 'shotgun' ? 1.4 : w.cat === 'pistol' ? 0.8 : 1;
  vmFlash.visible = true; vmFlash.userData.t = now; vmFlash.material.rotation = Math.random() * 6; vmFlash.scale.setScalar(0.22 * big);
  vmFlashLight.intensity = 3; flashLight.position.copy(ownMuzzleWorld()); flashLight.intensity = 5 * big; flashLight.userData.t = now;
  ejectShell(ownMuzzleWorld().add(_v2.set(0, 0, 0)), me.yaw);
  kick = Math.min(1, kick + (w.key === 'awp' ? 1 : w.cat === 'shotgun' ? 0.8 : w.cat === 'sniper' ? 0.7 : w.cat === 'pistol' ? 0.35 : 0.25));
  spray = Math.min(0.07, spray + w.recoil);
  me.pitch = Math.min(1.5, me.pitch + (w.recoil * 0.9 + (w.cat === 'sniper' ? 0.02 : w.cat === 'shotgun' ? 0.03 : 0.004)));
  if (w.scope === 2) me.scoped = false;
}

// =====================================================================
// Оружие в руках (viewmodel)
// =====================================================================
const vm = new THREE.Group(); vm.scale.setScalar(0.62); vmScene.add(vm);
const vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); vmFlash.visible = false;
let vmWid = -2, vmGun = null;
function buildVM() {
  const wid = curWid(); if (wid === vmWid && vmGun) return;
  vmWid = wid; vm.clear();
  const s = SKINS[SKEY[save.skin] ?? 0], w = WEAPONS[wid];
  vmGun = makeGun(wid); vm.add(vmGun);
  const sleeve = new THREE.MeshLambertMaterial({ color: s.shirt }), skin = new THREE.MeshLambertMaterial({ color: s.skin });
  const arm = (from, to, mat, t) => { const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, from.distanceTo(to)), mat); m.position.copy(from).add(to).multiplyScalar(0.5); m.lookAt(to); vm.add(m); return m; };
  const grip = new THREE.Vector3(0, -0.05, 0.02);
  const fore = w.cat === 'pistol' || w.cat === 'dual' ? new THREE.Vector3(-0.02, -0.06, 0.0) : w.cat === 'knife' ? null : new THREE.Vector3(0, -0.02, -Math.min(0.42, vmGun.userData.len * 0.42));
  arm(new THREE.Vector3(0.12, -0.3, 0.45), grip.clone().add(new THREE.Vector3(0.02, -0.02, 0.05)), sleeve, 0.075);
  const hR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.09), skin); hR.position.copy(grip); vm.add(hR);
  if (fore) { arm(new THREE.Vector3(-0.28, -0.32, 0.35), fore.clone().add(new THREE.Vector3(-0.03, -0.02, 0.04)), sleeve, 0.075); const hL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.08), skin); hL.position.copy(fore); vm.add(hL); }
  vmFlash.position.copy(vmGun.userData.muzzle).add(new THREE.Vector3(0, 0, -0.04)); vmGun.add(vmFlash);
}
const VM_BASE = { pistol: [0.13, -0.13, -0.3], dual: [0.13, -0.13, -0.3], knife: [0.15, -0.14, -0.28], smg: [0.12, -0.13, -0.26], rifle: [0.11, -0.125, -0.22], shotgun: [0.11, -0.125, -0.22], sniper: [0.11, -0.12, -0.18], mg: [0.12, -0.14, -0.22] };
let vmPhase = 0;
function updateVM(now, dt) {
  const w = curW(), info = me.info || {};
  vm.visible = me.alive && !(me.scoped && w.scope === 2);
  if (!vm.visible) return;
  const b = VM_BASE[w.cat];
  const sp = moving && pred.og ? 1 : 0;
  vmPhase += dt * 9 * sp;
  swayX *= 0.85; swayY *= 0.85; kick *= Math.pow(0.0008, dt);
  let x = b[0] + Math.sin(vmPhase) * 0.012 * sp - swayX, y = b[1] - Math.abs(Math.cos(vmPhase)) * 0.01 * sp + swayY, z = b[2] + kick * 0.07;
  let rx = kick * 0.18, ry = 0, rz = 0;
  if (info.rl > 0) { const p = 1 - info.rl / reloadTotal, d = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI); rx -= d * 0.7; y -= d * 0.12; rz += d * 0.4; }
  if (info.sw > 0 || now < localSwitchUntil) { const s = Math.max(info.sw || 0, localSwitchUntil - now) / 350; y -= s * 0.3; rx -= s * 0.6; }
  if (me.scoped && w.scope === 1) { x = 0; y = -0.085; z = -0.2; }
  if (w.cat === 'knife' && now - slashT < 300) { const p = (now - slashT) / 300, d = Math.sin(p * Math.PI); ry += d * 1.0; rx -= d * 0.5; x -= d * 0.12; z -= d * 0.1; }
  vm.position.set(x, y, z); vm.rotation.set(rx, ry, rz);
  if (vmFlash.visible && now - vmFlash.userData.t > 45) vmFlash.visible = false;
  vmFlashLight.intensity = Math.max(0, vmFlashLight.intensity - dt * 60);
}

// =====================================================================
// Цикл отрисовки
// =====================================================================
function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
function interpPlayers(now) {
  const rt = now - 100; if (!snaps.length) return [];
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].t <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const t = b.t === a.t ? 1 : Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)));
  const out = [];
  for (const [id, pb] of b.players) {
    const pa = a.players.get(id) || pb; const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 120;
    out.push({ ...pb, x: jump ? pb.x : pa.x + (pb.x - pa.x) * t, y: jump ? pb.y : pa.y + (pb.y - pa.y) * t, z: jump ? pb.z : pa.z + (pb.z - pa.z) * t, yaw: lerpAng(pa.yaw, pb.yaw, t), pitch: pa.pitch + (pb.pitch - pa.pitch) * t });
  }
  return out;
}

let lastFrame = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (!menu.classList.contains('hidden')) {
    if (curTab === 'play' && pvChar) { pvAng += dt * 0.6; pvChar.rotation.y = pvAng; pvChar.userData.upper.rotation.x = Math.sin(now / 900) * 0.15; pvR.render(pvScene, pvCam); }
    return;
  }
  if (!joined || !last || !world) return;
  localFire(now);
  const plist = interpPlayers(now);

  // другие игроки
  const seen = new Set();
  for (const p of plist) {
    if (p.id === myId) continue;
    seen.add(p.id);
    let o = others.get(p.id);
    if (!o || o.wid !== p.wid || o.skin !== p.skin || o.team !== p.team) {
      if (o) scene.remove(o.model);
      o = { model: makeCharacter(p.skin, p.team, p.wid), wid: p.wid, skin: p.skin, team: p.team, trailT: 0, deadAt: 0 };
      scene.add(o.model); others.set(p.id, o);
    }
    if (!p.alive) { if (!o.deadAt) o.deadAt = now; } else o.deadAt = 0;
    o.model.visible = p.alive || now - o.deadAt < 2800;
    poseCharacter(o.model, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, moving: p.mv && p.alive, alive: p.alive }, dt);
    o.p = p;
    // шлейф
    if (p.alive && p.mv && now - o.trailT > 30) {
      o.trailT = now; const c = new THREE.Color(SKINS[p.skin]?.trail || '#ffffff');
      pAdd.add({ x: p.x * U + (Math.random() - 0.5) * 0.2, y: p.z * U + 0.08 + Math.random() * 0.1, z: p.y * U + (Math.random() - 0.5) * 0.2, vy: 0.25, max: 0.5, s: 0.32, c, a: 0.32, drag: 0.96 });
    }
  }
  for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.model); others.delete(id); }

  // камера
  const w = curW();
  const a = Math.min(1, (now - predT) / (1000 / C.TICK));
  let cx, cy, cz;
  if (me.alive) {
    cx = prevPred.x + (pred.x - prevPred.x) * a; cy = prevPred.y + (pred.y - prevPred.y) * a; cz = prevPred.z + (pred.z - prevPred.z) * a + C.EYE;
    camera.rotation.set(me.pitch + kick * 0.03, -me.yaw - Math.PI / 2, 0);
  } else {
    const d = deathPos || pred, k = Math.min(1, (now - deathT) / 600);
    cx = d.x; cy = d.y; cz = d.z + C.EYE * (1 - k * 0.8);
    camera.rotation.set(me.pitch * (1 - k) - k * 0.3, -me.yaw - Math.PI / 2, k * 0.5);
  }
  camera.position.set(cx * U, cz * U, cy * U);
  const fovT = me.alive && me.scoped ? (w.key === 'awp' ? 22 : w.key === 'scout' ? 28 : 48) : 78;
  if (Math.abs(camera.fov - fovT) > 0.1) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 18); camera.updateProjectionMatrix(); }
  spray = Math.max(0, spray - dt * 0.12);

  // эффекты
  for (const f of flashPool) if (f.s.visible && now - f.t > 50) f.s.visible = false;
  for (const L of [flashLight, flashLight2]) if (L.intensity > 0 && now - (L.userData.t || 0) > 60) L.intensity = 0;
  for (const s of shells) {
    if (!s.m.visible) continue;
    s.life += dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 15;
    if (s.m.position.y < 0.01) { s.m.position.y = 0.01; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
    if (s.life > 4) s.m.visible = false;
  }
  tracerPool.forEach((m) => (m.visible = false));
  let ti = 0;
  tracers = tracers.filter((t) => {
    const trav = ((now - t.t) / 1000) * 290;
    if (trav >= t.len) {
      if (!t.done) {
        t.done = true;
        if (t.flag === 0 && NRM[t.nn]) impactWall(t.end, new THREE.Vector3(NRM[t.nn][0], NRM[t.nn][2], NRM[t.nn][1]));
        else if (t.flag === 1) { impactBody(t.end, t.dir, WEAPONS[t.wid].key === 'awp'); if (t.mine) { hitMark = now; hitHead = !!t.hs; Sfx.hit(); } }
      }
      return false;
    }
    if (ti < tracerPool.length) {
      const tail = Math.min(trav, WEAPONS[t.wid].key === 'awp' ? 6 : 3);
      const m = tracerPool[ti++]; const head = _v.copy(t.start).addScaledVector(t.dir, trav);
      m.position.copy(head).addScaledVector(t.dir, -tail / 2); m.scale.set(0.014, 0.014, tail);
      m.lookAt(_v2.copy(head).add(t.dir)); m.visible = true;
    }
    return true;
  });
  smokePool.forEach((m) => (m.visible = false));
  smokes = smokes.filter((s, i) => {
    const k = (now - s.t) / 900; if (k >= 1 || i >= smokePool.length) return false;
    const m = smokePool[i], len = s.start.distanceTo(s.end);
    m.position.copy(s.start).add(s.end).multiplyScalar(0.5); m.lookAt(s.end); m.scale.set(0.03 + k * 0.12, 0.03 + k * 0.12, len);
    m.material.opacity = 0.35 * (1 - k); m.visible = true; return true;
  });
  pAdd.update(dt); pNorm.update(dt);
  updateVM(now, dt);

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
  drawHUD(now, plist);
}

// =====================================================================
// HUD
// =====================================================================
const fmtTime = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function box(x, y, bw, bh) { h.fillStyle = 'rgba(10,12,16,0.72)'; rr(h, x, y, bw, bh, 10); h.fill(); }
function drawHUD(now, plist) {
  h.setTransform(DPR, 0, 0, DPR, 0, 0); h.clearRect(0, 0, W, H);
  const m = last, info = me.info || {}, w = curW();
  // прицел снайперки
  if (me.alive && me.scoped && w.scope === 2) {
    const r = Math.min(W, H) * 0.46;
    h.fillStyle = '#000'; h.beginPath(); h.rect(0, 0, W, H); h.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); h.fill('evenodd');
    const g = h.createRadialGradient(W / 2, H / 2, r * 0.75, W / 2, H / 2, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    h.fillStyle = g; h.beginPath(); h.arc(W / 2, H / 2, r, 0, 7); h.fill();
    h.strokeStyle = '#000'; h.lineWidth = 1.5; h.beginPath(); h.moveTo(W / 2 - r, H / 2); h.lineTo(W / 2 + r, H / 2); h.moveTo(W / 2, H / 2 - r); h.lineTo(W / 2, H / 2 + r); h.stroke();
  } else if (me.alive && me.scoped) { h.strokeStyle = 'rgba(0,0,0,0.7)'; h.lineWidth = 3; h.beginPath(); h.arc(W / 2, H / 2, Math.min(W, H) * 0.32, 0, 7); h.stroke(); }
  if (hurtFlash > 0) { const g = h.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${hurtFlash * 0.5})`); h.fillStyle = g; h.fillRect(0, 0, W, H); hurtFlash = Math.max(0, hurtFlash - 0.04); }

  // имена союзников
  h.textAlign = 'center'; h.font = '600 12px system-ui';
  for (const p of plist) {
    if (p.id === myId || !p.alive || p.team !== me.team) continue;
    _v.set(p.x * U, (p.z + 50) * U, p.y * U).project(camera);
    if (_v.z > 1 || _v.z < -1) continue;
    const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
    h.fillStyle = 'rgba(0,0,0,0.5)'; h.fillText(roster.get(p.id)?.name || '', sx + 1, sy + 1);
    h.fillStyle = TEAM_HEX[me.team]; h.fillText(roster.get(p.id)?.name || '', sx, sy);
    h.beginPath(); h.moveTo(sx - 5, sy + 5); h.lineTo(sx + 5, sy + 5); h.lineTo(sx, sy + 11); h.fill();
  }

  // счёт
  h.textAlign = 'center'; box(W / 2 - 130, 10, 260, 50);
  h.font = 'bold 28px system-ui'; h.fillStyle = TEAM_HEX[0]; h.fillText(m.sc[0], W / 2 - 80, 46); h.fillStyle = TEAM_HEX[1]; h.fillText(m.sc[1], W / 2 + 80, 46);
  h.fillStyle = '#fff'; h.font = 'bold 18px system-ui'; h.fillText(m.st === 'play' ? fmtTime(m.tl) : '—', W / 2, 33);
  h.font = '11px system-ui'; h.fillStyle = '#9aa3b2'; h.fillText(MAPS[mapIndex].name + ' · до ' + C.SCORE_LIMIT, W / 2, 51);
  // деньги и радар
  h.textAlign = 'left'; box(16, 14, 180, 38); h.font = 'bold 20px system-ui'; h.fillStyle = '#7ee787'; h.fillText('$ ' + save.money.toLocaleString('ru-RU'), 30, 40);
  drawRadar(plist);
  // здоровье
  box(16, H - 70, 230, 54);
  h.font = 'bold 28px system-ui'; h.fillStyle = me.hp > 30 ? '#fff' : '#ff6b6b'; h.fillText('✚ ' + (me.alive ? me.hp : 0), 30, H - 35);
  h.fillStyle = '#ffffff1a'; h.fillRect(130, H - 47, 100, 8); h.fillStyle = me.hp > 50 ? '#5fd35f' : me.hp > 25 ? '#ffc94d' : '#ff5a5a'; h.fillRect(130, H - 47, me.alive ? me.hp : 0, 8);
  h.font = '11px system-ui'; h.fillStyle = '#9aa3b2'; h.fillText('ping ' + ping + ' ms', 16, H - 78);
  // оружие
  const bx = W - 266; box(bx, H - 70, 250, 54);
  h.textAlign = 'left'; h.font = '600 14px system-ui'; h.fillStyle = '#aab2c0'; h.fillText(w.name, bx + 14, H - 47);
  h.textAlign = 'right';
  if (info.rl > 0) { h.font = 'bold 16px system-ui'; h.fillStyle = '#ffd166'; h.fillText('Перезарядка', bx + 236, H - 30); h.fillStyle = '#ffffff1a'; h.fillRect(bx + 14, H - 26, 120, 4); h.fillStyle = '#ffd166'; h.fillRect(bx + 14, H - 26, 120 * (1 - info.rl / reloadTotal), 4); }
  else if (w.cat === 'knife') { h.font = 'bold 26px system-ui'; h.fillStyle = '#fff'; h.fillText('∞', bx + 236, H - 28); }
  else { const am = localAmmo(); h.font = 'bold 26px system-ui'; h.fillStyle = am > w.mag * 0.2 ? '#fff' : '#ff6b6b'; h.fillText(am + ' / ' + w.mag, bx + 236, H - 28); }
  let sy = H - 80;
  for (let s = 2; s >= 0; s--) { const wid = me.wpn[s]; if (wid == null || wid < 0) continue; const act = s === me.slot; h.font = (act ? 'bold ' : '') + '13px system-ui'; h.fillStyle = act ? '#fff' : '#9aa3b2'; h.fillText(`${s + 1}  ${WEAPONS[wid].name}`, W - 22, sy); sy -= 20; }
  // килфид
  let y = 22;
  for (const f of feed) {
    const age = now - f.t; if (age > 6000) continue;
    h.globalAlpha = Math.min(1, (6000 - age) / 800); h.textAlign = 'right'; h.font = '13px system-ui';
    if (f.kill) {
      const k = f.kill, mid = `  [${WEAPONS[k.w].name}${k.hs ? ' ⌖' : ''}]  `;
      const vw = h.measureText(k.vn).width, mw = h.measureText(mid).width, kw = h.measureText(k.kn).width;
      h.fillStyle = (k.k === myId || k.v === myId) ? 'rgba(80,20,20,0.75)' : 'rgba(10,12,16,0.7)'; h.fillRect(W - 26 - vw - mw - kw, y - 15, vw + mw + kw + 14, 22);
      h.fillStyle = TEAM_HEX[k.vt === 'A' ? 0 : 1]; h.fillText(k.vn, W - 19, y);
      h.fillStyle = k.hs ? '#ffd166' : '#cfd5dd'; h.fillText(mid, W - 19 - vw, y);
      h.fillStyle = TEAM_HEX[k.kt === 'A' ? 0 : 1]; h.fillText(k.kn, W - 19 - vw - mw, y);
    } else { h.fillStyle = f.c; h.fillText(f.s, W - 19, y); }
    y += 26;
  }
  h.globalAlpha = 1;
  floaters = floaters.filter((f) => now - f.t < 1500);
  for (const f of floaters) { const k = (now - f.t) / 1500; h.globalAlpha = 1 - k; h.textAlign = 'center'; h.font = 'bold 20px system-ui'; h.fillStyle = '#7ee787'; h.fillText(f.s, W / 2, H / 2 - 80 - k * 40); }
  h.globalAlpha = 1;
  // перекрестие
  if (me.alive && !(me.scoped && w.scope === 2) && !paused && w.cat !== 'knife') {
    const base = me.scoped ? w.sspread : (moving ? w.mspread : w.spread);
    const gap = 4 + (base + spray) * (H / 2) / Math.tan((camera.fov * Math.PI) / 360) * 0.9;
    h.lineWidth = 3; h.strokeStyle = 'rgba(0,0,0,0.55)'; cross(W / 2, H / 2, gap, 7);
    h.lineWidth = 1.6; h.strokeStyle = '#7dff8a'; cross(W / 2, H / 2, gap, 7);
  } else if (me.alive && w.cat === 'knife') { h.fillStyle = '#7dff8a'; h.fillRect(W / 2 - 1.5, H / 2 - 1.5, 3, 3); }
  if (now - hitMark < 160) { h.strokeStyle = hitHead ? '#ff4040' : '#fff'; h.lineWidth = 2; h.beginPath(); for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { h.moveTo(W / 2 + dx * 6, H / 2 + dy * 6); h.lineTo(W / 2 + dx * 13, H / 2 + dy * 13); } h.stroke(); }

  if (!me.alive && m.st === 'play') {
    h.fillStyle = 'rgba(0,0,0,0.35)'; h.fillRect(0, 0, W, H);
    h.textAlign = 'center'; h.fillStyle = '#fff'; h.font = 'bold 32px system-ui'; h.fillText('Ты убит', W / 2, H / 2 - 20);
    h.font = '17px system-ui'; h.fillStyle = '#ccd';
    if (killedBy) h.fillText(`${killedBy.name} · ${killedBy.w}${killedBy.hs ? ' · в голову' : ''}`, W / 2, H / 2 + 10);
    h.fillText('Возрождение через ' + Math.ceil((info.ri || 0) / 1000) + ' с', W / 2, H / 2 + 38);
  }
  if (m.st === 'end') {
    h.fillStyle = 'rgba(0,0,0,0.6)'; h.fillRect(0, 0, W, H);
    h.textAlign = 'center'; h.font = 'bold 40px system-ui';
    if (m.w === 'D') { h.fillStyle = '#fff'; h.fillText('Ничья', W / 2, H / 2 - 130); }
    else { const t = m.w === 'A' ? 0 : 1; h.fillStyle = TEAM_HEX[t]; h.fillText((t === me.team ? 'Победа! ' : 'Поражение. ') + TEAM_NAME[t] + ' выиграли', W / 2, H / 2 - 130); }
    h.font = '16px system-ui'; h.fillStyle = '#7ee787'; h.fillText(`+$${endBonus} за матч`, W / 2, H / 2 - 100);
    h.fillStyle = '#ccd'; h.fillText('Следующая карта: ' + MAPS[(mapIndex + 1) % MAPS.length].name + ' через ' + Math.ceil(m.tl / 1000) + ' с', W / 2, H / 2 - 76);
    drawBoard(H / 2 - 56);
  } else if (showBoard) drawBoard(90);
  if (!locked && !paused && joined) {
    h.fillStyle = 'rgba(0,0,0,0.5)'; h.fillRect(0, H / 2 + 60, W, 44);
    h.textAlign = 'center'; h.fillStyle = '#fff'; h.font = 'bold 16px system-ui'; h.fillText('Кликни по экрану, чтобы управлять мышью', W / 2, H / 2 + 88);
  }
}
function cross(x, y, g, l) { h.beginPath(); h.moveTo(x - g - l, y); h.lineTo(x - g, y); h.moveTo(x + g, y); h.lineTo(x + g + l, y); h.moveTo(x, y - g - l); h.lineTo(x, y - g); h.moveTo(x, y + g); h.lineTo(x, y + g + l); h.stroke(); }
function drawBoard(top) {
  const bw = Math.min(680, W - 40), x0 = W / 2 - bw / 2;
  const rows = [...roster.entries()].map(([id, r]) => ({ id, ...r }));
  h.fillStyle = 'rgba(12,14,19,0.93)'; rr(h, x0, top, bw, 300, 12); h.fill();
  for (let t = 0; t < 2; t++) {
    const list = rows.filter((r) => r.team === t).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const cx = x0 + (t === 0 ? 16 : bw / 2 + 8), cw = bw / 2 - 24;
    h.textAlign = 'left'; h.font = 'bold 16px system-ui'; h.fillStyle = TEAM_HEX[t]; h.fillText(TEAM_NAME[t] + ' — ' + last.sc[t], cx, top + 30);
    h.font = '12px system-ui'; h.fillStyle = '#7d8696'; h.fillText('Игрок', cx, top + 54); h.textAlign = 'right'; h.fillText('У / С', cx + cw, top + 54);
    list.forEach((r, i) => {
      const yy = top + 80 + i * 40;
      if (r.id === myId) { h.fillStyle = 'rgba(255,255,255,0.07)'; h.fillRect(cx - 6, yy - 20, cw + 12, 30); }
      h.textAlign = 'left'; h.font = '14px system-ui'; h.fillStyle = r.bot ? '#8b93a3' : '#fff'; h.fillText(r.name, cx, yy);
      h.textAlign = 'right'; h.fillText(r.kills + ' / ' + r.deaths, cx + cw, yy);
    });
  }
}
// Радар: вращается вместе со взглядом
function drawRadar(plist) {
  const map = MAPS[mapIndex], R = 85, cx = 16 + R, cy = 64 + R, sc = R / (C.TILE * 9);
  h.save(); h.beginPath(); h.arc(cx, cy, R, 0, 7); h.fillStyle = 'rgba(10,12,16,0.75)'; h.fill(); h.clip();
  h.translate(cx, cy); h.rotate(-Math.PI / 2 - me.yaw); h.scale(sc, sc);
  const mx = me.alive ? pred.x : (deathPos || pred).x, my = me.alive ? pred.y : (deathPos || pred).y;
  h.translate(-mx, -my);
  const TL = C.TILE, tx0 = Math.floor((mx - TL * 13) / TL), tx1 = Math.ceil((mx + TL * 13) / TL), ty0 = Math.floor((my - TL * 13) / TL), ty1 = Math.ceil((my + TL * 13) / TL);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = S.tileAt(map, tx, ty);
    if (t === S.T.OUT) continue;
    h.fillStyle = t === S.T.IN || t === S.T.DOOR ? 'rgba(120,130,150,0.35)' : t === S.T.CRATE || t === S.T.TALL ? '#8a6a3c' : '#6b7383';
    h.fillRect(tx * TL, ty * TL, TL + 0.5, TL + 0.5);
  }
  for (const p of plist) { if (!p.alive || p.team !== me.team || p.id === myId) continue; h.fillStyle = TEAM_HEX[p.team]; h.beginPath(); h.arc(p.x, p.y, 14, 0, 7); h.fill(); }
  h.restore();
  h.fillStyle = '#fff'; h.beginPath(); h.moveTo(cx, cy - 7); h.lineTo(cx + 5, cy + 5); h.lineTo(cx - 5, cy + 5); h.closePath(); h.fill();
  h.strokeStyle = 'rgba(255,255,255,0.15)'; h.lineWidth = 1; h.beginPath(); h.arc(cx, cy, R, 0, 7); h.stroke();
}

requestAnimationFrame(frame);
window.__game = { me, get pred() { return pred; }, scene, camera };
