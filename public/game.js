(() => {
const { C, MAPS, WEAPONS, WKEY, SKINS, SKEY, move, keyDir, speedOf } = Shared;
const { drawCharacter, drawWeaponIcon, muzzle, TEAM_COL, rr } = Draw;
const TEAM_NAME = ['Синие', 'Красные'];
const $ = (id) => document.getElementById(id);

// =====================================================================
// Сохранение: деньги, купленное, выбранное
// =====================================================================
const SAVE_KEY = 'strike5v5_save';
function defSave() { return { money: C.START_MONEY, ownedW: ['knife', 'glock', 'usp'], ownedS: ['recruit'], primary: null, pistol: 'usp', skin: 'recruit', nick: '', music: 0.4, sfx: 0.8 }; }
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(defSave(), s); } catch {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
function addMoney(n) { save.money += n; persist(); $('money').textContent = save.money.toLocaleString('ru-RU'); }
function loadout() { return [save.primary ? WKEY[save.primary] : -1, WKEY[save.pistol] ?? WKEY.usp]; }

// =====================================================================
// Меню
// =====================================================================
const menu = $('menu'), cv = $('c'), ctx = cv.getContext('2d');
let curTab = 'play';
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  Sfx.init(); Sfx.uiClick();
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
  curTab = b.dataset.tab;
  for (const t of ['play', 'arsenal', 'skins', 'settings']) $('tab-' + t).classList.toggle('hidden', t !== curTab);
  if (curTab === 'arsenal') buildArsenal();
  if (curTab === 'skins') buildSkins();
  if (curTab === 'play') fillSelects();
});
document.addEventListener('pointerdown', () => Sfx.init(), { once: true });

$('name').value = save.nick;
$('name').oninput = () => { save.nick = $('name').value; persist(); };
$('money').textContent = save.money.toLocaleString('ru-RU');
$('volMusic').value = save.music; $('volSfx').value = save.sfx;
Sfx.setVolume('music', save.music); Sfx.setVolume('sfx', save.sfx);
$('volMusic').oninput = (e) => { save.music = +e.target.value; Sfx.setVolume('music', save.music); persist(); };
$('volSfx').oninput = (e) => { save.sfx = +e.target.value; Sfx.setVolume('sfx', save.sfx); persist(); };

function fillSelect(sel, slot) {
  const owned = WEAPONS.filter((w) => w.slot === slot && save.ownedW.includes(w.key));
  sel.innerHTML = (slot === 0 ? '<option value="">— нет (купи в Арсенале) —</option>' : '') +
    owned.map((w) => `<option value="${w.key}">${w.name}</option>`).join('');
  sel.value = (slot === 0 ? save.primary : save.pistol) || '';
}
function fillSelects() { fillSelect($('selPrimary'), 0); fillSelect($('selPistol'), 1); fillSelect($('pPrimary'), 0); fillSelect($('pPistol'), 1); }
function onSel(slot, val) {
  if (slot === 0) save.primary = val || null; else save.pistol = val;
  persist(); fillSelects();
  if (ws && ws.readyState === 1 && joined) ws.send(JSON.stringify({ t: 'lo', lo: loadout() }));
}
$('selPrimary').onchange = (e) => onSel(0, e.target.value);
$('selPistol').onchange = (e) => onSel(1, e.target.value);
$('pPrimary').onchange = (e) => onSel(0, e.target.value);
$('pPistol').onchange = (e) => onSel(1, e.target.value);
fillSelects();

const CATS = [['all', 'Всё'], ['pistol', 'Пистолеты'], ['smg', 'Пистолеты-пулемёты'], ['shotgun', 'Дробовики'], ['rifle', 'Винтовки'], ['sniper', 'Снайперские'], ['mg', 'Пулемёт']];
let wcat = 'all';
function bar(v) { return `<div class="bar"><i style="width:${Math.round(Math.max(0.04, Math.min(1, v)) * 100)}%"></i></div>`; }
function buildArsenal() {
  $('wcats').innerHTML = CATS.map(([k, n]) => `<button class="chip ${k === wcat ? 'active' : ''}" data-c="${k}">${n}</button>`).join('');
  $('wcats').querySelectorAll('.chip').forEach((c) => c.onclick = () => { wcat = c.dataset.c; Sfx.uiClick(); buildArsenal(); });
  const list = WEAPONS.filter((w) => w.cat !== 'knife' && (wcat === 'all' || w.cat === wcat || (wcat === 'pistol' && w.cat === 'dual')));
  const g = $('wgrid'); g.innerHTML = '';
  for (const w of list) {
    const owned = save.ownedW.includes(w.key);
    const eq = (w.slot === 0 ? save.primary : save.pistol) === w.key;
    const el = document.createElement('div');
    el.className = 'card' + (eq ? ' equipped' : '');
    const dps = (w.dmg * w.pellets) / 150, rate = Math.min(1, 1000 / w.fire / 14), acc = 1 - w.spread / 0.14, mob = (w.speed - 0.76) / 0.3;
    const tag = w.key === 'awp' ? '<span class="tag gold">ИМБА</span>' : owned ? '<span class="tag">Куплено</span>' : '';
    el.innerHTML = `<canvas width="460" height="180"></canvas>
      <div class="name">${w.name} ${tag}</div>
      <div class="stats"><span>Урон</span>${bar(dps)}<span>Скорострельн.</span>${bar(rate)}<span>Точность</span>${bar(acc)}<span>Мобильность</span>${bar(mob)}</div>
      ${owned ? (eq ? '<button class="b-on">Выбрано</button>' : '<button class="b-eq">Выбрать</button>')
               : `<button class="b-buy" ${save.money < w.price ? 'disabled' : ''}>Купить · $${w.price.toLocaleString('ru-RU')}</button>`}`;
    drawWeaponIcon(el.querySelector('canvas').getContext('2d'), w.id, 460, 180);
    const btn = el.querySelector('button');
    btn.onclick = () => {
      if (!owned) {
        if (save.money < w.price) return;
        save.money -= w.price; save.ownedW.push(w.key); Sfx.buy();
      } else Sfx.uiClick();
      if (w.slot === 0) save.primary = w.key; else save.pistol = w.key;
      persist(); addMoney(0); fillSelects(); buildArsenal();
      if (ws && ws.readyState === 1 && joined) ws.send(JSON.stringify({ t: 'lo', lo: loadout() }));
    };
    g.appendChild(el);
  }
}
function buildSkins() {
  const g = $('sgrid'); g.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.ownedS.includes(s.key), eq = save.skin === s.key;
    const el = document.createElement('div');
    el.className = 'card skin' + (eq ? ' equipped' : '');
    const tag = s.female ? '<span class="tag pink">Меньше хитбокс</span>' : owned ? '<span class="tag">Куплено</span>' : '';
    el.innerHTML = `<canvas width="460" height="300"></canvas><div class="name">${s.name} ${tag}</div>
      ${owned ? (eq ? '<button class="b-on">Надето</button>' : '<button class="b-eq">Надеть</button>')
               : `<button class="b-buy" ${save.money < s.price ? 'disabled' : ''}>Купить · $${s.price.toLocaleString('ru-RU')}</button>`}`;
    const c2 = el.querySelector('canvas').getContext('2d');
    drawCharacter(c2, { x: 230, y: 150, angle: -Math.PI / 2 + 0.3, skin: s.id, wid: WKEY.ak47, walk: 0.6, moving: 1, team: -1, scale: 4.2 });
    el.querySelector('button').onclick = () => {
      if (!owned) { if (save.money < s.price) return; save.money -= s.price; save.ownedS.push(s.key); Sfx.buy(); } else Sfx.uiClick();
      save.skin = s.key; persist(); addMoney(0); buildSkins();
    };
    g.appendChild(el);
  }
}

// Анимированный персонаж в меню
const pv = $('preview'), pctx = pv.getContext('2d');
let pvTrail = [];
function drawPreview(t) {
  pctx.clearRect(0, 0, 680, 680);
  const sk = SKEY[save.skin] ?? 0, s = SKINS[sk];
  const wid = save.primary ? WKEY[save.primary] : WKEY[save.pistol];
  const ang = -Math.PI / 2 + Math.sin(t / 1400) * 0.7;
  const bob = Math.sin(t / 700) * 10;
  if (Math.random() < 0.6) pvTrail.push({ x: 340 + (Math.random() - 0.5) * 30, y: 380 + bob + 60, life: 1 });
  pctx.globalCompositeOperation = 'lighter';
  for (const p of pvTrail) { p.y += 3; p.life -= 0.02; pctx.fillStyle = s.trail; pctx.globalAlpha = Math.max(0, p.life) * 0.25; pctx.beginPath(); pctx.arc(p.x, p.y, 26 * p.life, 0, Math.PI * 2); pctx.fill(); }
  pvTrail = pvTrail.filter((p) => p.life > 0);
  pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1;
  drawCharacter(pctx, { x: 340, y: 340 + bob, angle: ang, skin: sk, wid, walk: t / 110, moving: 1, team: -1, scale: 8.5 });
}

// =====================================================================
// Сеть
// =====================================================================
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
addEventListener('resize', resize); resize();

let ws = null, myId = 0, mapIndex = 0, joined = false, leaving = false;
let snaps = [], last = null, roster = new Map();
let me = { x: 0, y: 0, rx: 0, ry: 0, alive: false, hp: 100, team: 0, slot: 1, prevSlot: 0, wpn: [-1, WKEY.usp, WKEY.knife], scoped: false, info: {} };
let pending = [], seq = 0;
let lastState = 'play', endBonus = 0, killedBy = null;
let feed = [], floaters = [], ping = 0, hurtFlash = 0, lastHp = 100, hitMark = 0;

function startGame() {
  Sfx.init();
  save.nick = $('name').value.trim(); persist();
  $('status').textContent = 'Подключение…';
  leaving = false;
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

function showGame() { menu.classList.add('hidden'); cv.classList.remove('hidden'); $('status').textContent = ''; Sfx.setInGame(true); }
function showMenu() { menu.classList.remove('hidden'); cv.classList.add('hidden'); $('pause').classList.add('hidden'); paused = false; Sfx.setInGame(false); fillSelects(); addMoney(0); if (curTab === 'arsenal') buildArsenal(); if (curTab === 'skins') buildSkins(); }
$('resume').onclick = () => { paused = false; $('pause').classList.add('hidden'); };
$('toMenu').onclick = () => { leaving = true; if (ws) ws.close(); };

function setMap(i) { mapIndex = i; snaps = []; pending = []; particles = []; tracers = []; decalIdx = -1; lastState = 'play'; }

function curWid() { const w = me.wpn[me.slot]; return w != null && w >= 0 ? w : WKEY.knife; }
function curW() { return WEAPONS[curWid()]; }

function onSnap(m) {
  const now = performance.now();
  if (m.r) roster = new Map(m.r.map((r) => [r[0], { name: r[1], team: r[2], kills: r[3], deaths: r[4], bot: r[5], skin: r[6] }]));
  const players = new Map();
  for (const p of m.p) players.set(p[0], { id: p[0], team: p[1], x: p[2], y: p[3], a: p[4], hp: p[5], alive: p[6], bot: p[7], wid: p[8], skin: p[9], sc: p[10] });
  snaps.push({ t: now, players }); if (snaps.length > 30) snaps.shift();
  const prevInfo = me.info || {};
  last = m; me.info = m.me;
  if (m.me.wpn) me.wpn = m.me.wpn;
  // перезарядка: звуки
  if (m.me.rl > 0 && !(prevInfo.rl > 0)) { Sfx.reloadStart(); me.scoped = false; pendShots = []; }
  if (!(m.me.rl > 0) && prevInfo.rl > 0 && m.me.ammo > (prevInfo.ammo ?? 0)) Sfx.reloadEnd();
  const sp = players.get(myId);
  if (sp) {
    me.team = sp.team; me.hp = sp.hp;
    if (sp.hp < lastHp && sp.alive) hurtFlash = 1;
    lastHp = sp.hp;
    if (!sp.alive) { me.alive = false; me.x = me.rx = sp.x; me.y = me.ry = sp.y; pending = []; me.scoped = false; }
    else {
      const wasDead = !me.alive;
      me.alive = true;
      if (wasDead) { me.slot = m.me.slot; me.scoped = false; killedBy = null; pendShots = []; }
      pending = pending.filter((i) => i.s > m.me.seq);
      let x = sp.x, y = sp.y;
      for (const i of pending) { const [mx, my] = keyDir(i.k); if (mx || my) { const sp2 = speedOf(i.wid, i.z) * C.DT; const r = move(MAPS[mapIndex], x, y, mx * sp2, my * sp2, C.R); x = r.x; y = r.y; } }
      me.x = x; me.y = y;
      if (wasDead || Math.hypot(me.rx - x, me.ry - y) > 80) { me.rx = x; me.ry = y; }
    }
  }
  for (const s of m.sh) onShot(s, players, now);
  for (const ev of m.ev) {
    if (ev.t === 'kill') {
      feed.push({ kill: ev, t: now });
      if (ev.k === myId) { const r = WEAPONS[ev.w].reward; addMoney(r); floaters.push({ s: `+$${r}  ${ev.vn}`, t: now }); Sfx.killDing(); }
      if (ev.v === myId) killedBy = { name: ev.kn, w: WEAPONS[ev.w].name };
    } else if (ev.t === 'msg') feed.push({ s: ev.s, c: '#9aa3b2', t: now });
  }
  if (feed.length > 6) feed.splice(0, feed.length - 6);
  // конец матча — бонус
  if (m.st === 'end' && lastState !== 'end') {
    const win = m.w !== 'D' && (m.w === 'A' ? 0 : 1) === me.team;
    endBonus = win ? C.WIN_BONUS : C.LOSE_BONUS; addMoney(endBonus);
  }
  lastState = m.st;
}

// =====================================================================
// Ввод
// =====================================================================
const KEYMAP = { KeyW: 1, ArrowUp: 1, KeyS: 2, ArrowDown: 2, KeyA: 4, ArrowLeft: 4, KeyD: 8, ArrowRight: 8 };
const keys = {}; const mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
let clickLatch = false, edgeAt = 0, reloadReq = false, showBoard = false, paused = false;

function selectSlot(s) {
  if (s === me.slot) return;
  const w = me.wpn[s]; if (w == null || w < 0) return;
  me.prevSlot = me.slot; me.slot = s; me.scoped = false; pendShots = []; localSwitchUntil = performance.now() + 350; Sfx.deploy();
}
addEventListener('keydown', (e) => {
  if (!joined) return;
  if (e.code === 'Escape') { paused = !paused; $('pause').classList.toggle('hidden', !paused); fillSelects(); return; }
  if (e.code === 'Tab') { e.preventDefault(); showBoard = true; }
  if (paused) return;
  if (e.code === 'KeyR') reloadReq = true;
  if (e.code === 'Digit1') selectSlot(0);
  if (e.code === 'Digit2') selectSlot(1);
  if (e.code === 'Digit3') selectSlot(2);
  if (e.code === 'KeyQ') selectSlot(me.prevSlot);
  if (e.code === 'KeyM') Sfx.toggleMusic();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') { e.preventDefault(); showBoard = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', (e) => {
  if (paused) return;
  if (e.button === 0) { mouse.down = true; clickLatch = true; edgeAt = performance.now(); }
  if (e.button === 2 && curW().scope && me.alive && !(me.info.rl > 0)) { me.scoped = !me.scoped; Sfx.uiClick(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => {
  if (paused) return;
  const order = [0, 1, 2]; let i = order.indexOf(me.slot);
  for (let n = 0; n < 3; n++) { i = (i + (e.deltaY > 0 ? 1 : 2)) % 3; const w = me.wpn[order[i]]; if (w != null && w >= 0) { selectSlot(order[i]); break; } }
}, { passive: true });

// Камера и прицел
let camOff = { x: 0, y: 0 }, shake = 0;
function playerScreen() { return { x: W / 2 - camOff.x, y: H / 2 - camOff.y }; }
function aimAngle() { const p = playerScreen(); return Math.atan2(mouse.y - p.y, mouse.x - p.x); }

// Отправка ввода 30 раз/с + предсказание движения
setInterval(() => {
  if (!joined || !ws || ws.readyState !== 1) return;
  let k = 0; if (!paused) for (const c in KEYMAP) if (keys[c]) k |= KEYMAP[c];
  const playing = last && last.st === 'play';
  const f = !paused && playing && (mouse.down || clickLatch) ? 1 : 0;
  clickLatch = false;
  const inp = { t: 'in', s: ++seq, k: playing ? k : 0, a: Math.round(aimAngle() * 1000) / 1000, f, r: reloadReq ? 1 : 0, w: me.slot, z: me.scoped ? 1 : 0 };
  reloadReq = false;
  ws.send(JSON.stringify(inp));
  if (me.alive && playing) {
    inp.wid = curWid(); pending.push(inp);
    const [mx, my] = keyDir(inp.k);
    if (mx || my) { const sp = speedOf(inp.wid, inp.z) * C.DT; const r = move(MAPS[mapIndex], me.x, me.y, mx * sp, my * sp, C.R); me.x = r.x; me.y = r.y; }
  }
}, 1000 / C.TICK);

// Локальное предсказание выстрела (звук и вспышка сразу, без задержки сети)
let localLast = 0, localSwitchUntil = 0, pendShots = [], dryAt = 0, spray = 0;
function localAmmo() { const now = performance.now(); pendShots = pendShots.filter((t) => now - t < 500); return Math.max(0, (me.info.ammo ?? 0) - pendShots.length); }
function localFire(now) {
  if (!me.alive || paused || !last || last.st !== 'play') return;
  const w = curW();
  const want = w.auto ? mouse.down : now - edgeAt < 220;
  if (!want || now < localSwitchUntil || me.info.rl > 0 || now - localLast < w.fire) return;
  if (w.cat !== 'knife' && localAmmo() <= 0) { if (now - dryAt > 300) { Sfx.dry(); dryAt = now; } edgeAt = 0; return; }
  localLast = now; edgeAt = 0;
  const a = aimAngle();
  Sfx.shot(w.id, 0, 0);
  if (w.cat === 'knife') return;
  pendShots.push(now);
  const ml = muzzle(w.id);
  addFlash(me.rx + Math.cos(a) * ml, me.ry + Math.sin(a) * ml, a, w);
  ejectShell(me.rx, me.ry, a, w);
  shake = Math.min(14, shake + (w.key === 'awp' ? 12 : w.cat === 'shotgun' ? 7 : w.cat === 'sniper' ? 6 : w.cat === 'pistol' ? 2 : 2.5));
  spray = Math.min(0.07, spray + w.recoil);
  if (w.scope === 2) me.scoped = false;
}

// =====================================================================
// Эффекты
// =====================================================================
let particles = [], tracers = [], flashes = [];
let decal = null, dctx = null, decalIdx = -1;
const walkState = new Map();

function P(o) { if (particles.length < 1800) particles.push(o); }
function addFlash(x, y, a, w) {
  flashes.push({ x, y, a, t: performance.now(), big: w.key === 'awp' ? 1.8 : w.cat === 'shotgun' ? 1.5 : w.cat === 'pistol' || w.cat === 'dual' ? 0.8 : w.cat === 'smg' ? 0.9 : 1.1 });
  for (let i = 0; i < 2; i++) P({ type: 'smoke', x, y, vx: Math.cos(a) * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20, vy: Math.sin(a) * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20, life: 0, max: 500 + Math.random() * 400, size: 4 + Math.random() * 4, grow: 14 });
}
function ejectShell(x, y, a, w) {
  if (w.cat === 'knife') return;
  const side = a + Math.PI / 2, sp = 90 + Math.random() * 70;
  P({ type: 'shell', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: Math.cos(side) * sp + Math.cos(a) * -20, vy: Math.sin(side) * sp + Math.sin(a) * -20, life: 0, max: 700, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 30, size: w.cat === 'shotgun' ? 1.6 : w.cat === 'pistol' ? 0.9 : 1.2, red: w.cat === 'shotgun' });
}
function impactWall(x, y, a) {
  for (let i = 0; i < 6; i++) { const b = a + Math.PI + (Math.random() - 0.5) * 1.8, s = 120 + Math.random() * 260; P({ type: 'spark', x, y, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0, max: 120 + Math.random() * 160 }); }
  for (let i = 0; i < 3; i++) { const b = a + Math.PI + (Math.random() - 0.5) * 1.4, s = 20 + Math.random() * 50; P({ type: 'dust', x, y, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0, max: 500 + Math.random() * 300, size: 3, grow: 12 }); }
  if (dctx) { const hx = x - Math.cos(a) * 1.5, hy = y - Math.sin(a) * 1.5; dctx.fillStyle = 'rgba(0,0,0,0.55)'; dctx.beginPath(); dctx.arc(hx, hy, 1.8, 0, 7); dctx.fill(); dctx.fillStyle = 'rgba(255,255,255,0.08)'; dctx.beginPath(); dctx.arc(hx + 0.6, hy + 0.6, 2.6, 0, 7); dctx.fill(); }
}
function impactBody(x, y, a, big) {
  const n = big ? 14 : 7;
  for (let i = 0; i < n; i++) { const b = a + (Math.random() - 0.5) * 1.2, s = 40 + Math.random() * (big ? 260 : 160); P({ type: 'blood', x, y, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0, max: 300 + Math.random() * 300, size: 1.5 + Math.random() * 2 }); }
  if (dctx) {
    const map = MAPS[mapIndex];
    for (let i = 0; i < (big ? 6 : 3); i++) {
      const d = 6 + Math.random() * (big ? 40 : 20), bx = x + Math.cos(a) * d + (Math.random() - 0.5) * 10, by = y + Math.sin(a) * d + (Math.random() - 0.5) * 10;
      if (Shared.isWall(map, Math.floor(bx / C.TILE), Math.floor(by / C.TILE))) continue;
      dctx.fillStyle = `rgba(${110 + Math.random() * 40},10,14,${0.35 + Math.random() * 0.25})`;
      dctx.beginPath(); dctx.arc(bx, by, 1.5 + Math.random() * 3.5, 0, 7); dctx.fill();
    }
  }
}

function onShot(s, players, now) {
  const [x1, y1, x2, y2, team, flag, wid, sid, first] = s;
  const w = WEAPONS[wid];
  const mine = sid === myId;
  if (flag === 3) { impactBody(x2, y2, 0, true); if (mine) { hitMark = now; Sfx.hit(); } return; }
  const a = Math.atan2(y2 - y1, x2 - x1);
  const ld = Math.hypot(x1 - me.rx, y1 - me.ry), pan = (x1 - me.rx) / 900;
  if (w.cat === 'knife') {
    if (!mine) Sfx.shot(wid, ld, pan);
    if (flag === 1) { impactBody(x2, y2, a, false); if (mine) { hitMark = now; Sfx.hit(); } }
    return;
  }
  const ml = muzzle(wid);
  const mx = x1 + Math.cos(a) * ml, my = y1 + Math.sin(a) * ml;
  if (!mine && first) { Sfx.shot(wid, ld, pan); addFlash(mx, my, a, w); ejectShell(x1, y1, a, w); }
  if (mine && first) { pendShots.shift(); }
  const len = Math.max(0, Math.hypot(x2 - mx, y2 - my));
  tracers.push({ x1: mx, y1: my, a, len, t: now, flag, wid, mine, team });
}

function updateEffects(dt, now) {
  for (const p of particles) {
    p.life += dt * 1000;
    if (p.type === 'shell') { p.vx *= 0.9; p.vy *= 0.9; p.rot += p.vr * dt; p.vr *= 0.92; }
    else if (p.type === 'spark') { p.vx *= 0.9; p.vy *= 0.9; }
    else if (p.type === 'blood') { p.vx *= 0.85; p.vy *= 0.85; }
    else { p.vx *= 0.94; p.vy *= 0.94; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'shell' && p.life >= p.max && dctx) { dctx.fillStyle = p.red ? 'rgba(170,40,30,0.6)' : 'rgba(200,160,60,0.55)'; dctx.save(); dctx.translate(p.x, p.y); dctx.rotate(p.rot); dctx.fillRect(-2.5 * p.size, -1 * p.size, 5 * p.size, 2 * p.size); dctx.restore(); }
  }
  particles = particles.filter((p) => p.life < p.max);
  flashes = flashes.filter((f) => now - f.t < 60);
  // трассеры: летят 7000 px/с, при прилёте — эффект попадания
  for (const t of tracers) {
    const trav = ((now - t.t) / 1000) * 7000;
    if (!t.done && trav >= t.len) {
      t.done = true; t.doneAt = now;
      const ex = t.x1 + Math.cos(t.a) * t.len, ey = t.y1 + Math.sin(t.a) * t.len;
      if (t.flag === 0) impactWall(ex, ey, t.a);
      else if (t.flag === 1) { impactBody(ex, ey, t.a, WEAPONS[t.wid].key === 'awp'); if (t.mine) { hitMark = now; Sfx.hit(); } }
    }
  }
  tracers = tracers.filter((t) => !t.done || now - t.doneAt < (WEAPONS[t.wid].key === 'awp' ? 700 : 40));
  spray = Math.max(0, spray - dt * 0.12);
}

function emitTrail(id, x, y, skin, now) {
  let ws2 = walkState.get(id);
  if (!ws2) { ws2 = { phase: 0, lx: x, ly: y, tx: x, ty: y, tt: 0, mv: 0, step: 0 }; walkState.set(id, ws2); }
  const d = Math.hypot(x - ws2.lx, y - ws2.ly);
  ws2.lx = x; ws2.ly = y;
  if (d > 60) return ws2; // телепорт (возрождение)
  ws2.phase += d * 0.16;
  ws2.mv += ((d > 0.3 ? 1 : 0) - ws2.mv) * 0.2;
  if (Math.hypot(x - ws2.tx, y - ws2.ty) > 3 && now - ws2.tt > 18) {
    const sk = SKINS[skin] || SKINS[0];
    P({ type: 'trail', x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, vx: 0, vy: 0, life: 0, max: 420, size: 7, color: sk.trail });
    ws2.tx = x; ws2.ty = y; ws2.tt = now;
  }
  return ws2;
}

// =====================================================================
// Отрисовка
// =====================================================================
let mapCache = null, mapCacheIdx = -1;
function buildMapCache() {
  const map = MAPS[mapIndex], T = C.TILE, th = map.theme;
  const c = document.createElement('canvas'); c.width = map.pw; c.height = map.ph;
  const g = c.getContext('2d');
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    if (!map.grid[y * map.W + x]) { g.fillStyle = (x + y) % 2 ? th.floor : th.floor2; g.fillRect(x * T, y * T, T, T); }
  }
  // мелкая текстура пола
  for (let i = 0; i < map.W * map.H * 2; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.035)`; g.fillRect(Math.random() * map.pw, Math.random() * map.ph, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  // тени от стен
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) if (map.grid[y * map.W + x]) g.fillRect(x * T + 6, y * T + 8, T, T);
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    if (!map.grid[y * map.W + x]) continue;
    g.fillStyle = th.wall; g.fillRect(x * T, y * T, T, T);
    g.fillStyle = th.wallTop; g.fillRect(x * T + 3, y * T + 3, T - 6, T - 10);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x * T + 3, y * T + 3, T - 6, 3);
  }
  for (const [team, col] of [['A', TEAM_COL[0]], ['B', TEAM_COL[1]]]) { g.fillStyle = col + '1c'; for (const [x, y] of map.spawns[team]) g.fillRect(x * T, y * T, T, T); }
  mapCache = c; mapCacheIdx = mapIndex;
  decal = document.createElement('canvas'); decal.width = map.pw; decal.height = map.ph; dctx = decal.getContext('2d'); decalIdx = mapIndex;
}

function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
function interpPlayers(now) {
  const rt = now - 100;
  if (!snaps.length) return [];
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].t <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const t = b.t === a.t ? 1 : Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)));
  const out = [];
  for (const [id, pb] of b.players) {
    const pa = a.players.get(id) || pb;
    const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 120;
    out.push({ ...pb, x: jump ? pb.x : pa.x + (pb.x - pa.x) * t, y: jump ? pb.y : pa.y + (pb.y - pa.y) * t, a: lerpAng(pa.a, pb.a, t) });
  }
  return out;
}
const fmtTime = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

let lastFrame = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (!menu.classList.contains('hidden')) { if (curTab === 'play') drawPreview(now); return; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const map = MAPS[mapIndex];
  ctx.fillStyle = map.theme.bg; ctx.fillRect(0, 0, W, H);
  if (!joined || !last) return;
  if (mapCacheIdx !== mapIndex || decalIdx !== mapIndex) buildMapCache();

  localFire(now);
  updateEffects(dt, now);

  me.rx += (me.x - me.rx) * 0.5; me.ry += (me.y - me.ry) * 0.5;
  const w = curW();
  const look = me.scoped && w.scope === 2 ? 0.55 : me.scoped ? 0.35 : 0.12;
  const tx = (mouse.x - W / 2) * look, ty = (mouse.y - H / 2) * look;
  camOff.x += (tx - camOff.x) * 0.12; camOff.y += (ty - camOff.y) * 0.12;
  shake *= 0.85;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const camX = Math.round(me.rx + camOff.x - W / 2 + sx), camY = Math.round(me.ry + camOff.y - H / 2 + sy);
  ctx.save(); ctx.translate(-camX, -camY);
  ctx.drawImage(mapCache, 0, 0);
  ctx.drawImage(decal, 0, 0);

  const plist = interpPlayers(now);
  const myAng = aimAngle();
  // шлейф
  for (const p of plist) {
    if (!p.alive) { walkState.delete(p.id); continue; }
    if (p.id === myId) continue;
    p.ws = emitTrail(p.id, p.x, p.y, p.skin, now);
  }
  let myWs = null;
  if (me.alive) {
    myWs = emitTrail(myId, me.rx, me.ry, SKEY[save.skin] ?? 0, now);
    if (myWs.mv > 0.5 && Math.floor(myWs.phase / Math.PI) !== myWs.step) { myWs.step = Math.floor(myWs.phase / Math.PI); Sfx.step(0.8); }
  }
  drawParticles(['trail'], 'lighter');
  drawParticles(['shell', 'dust']);

  // трассеры пуль
  for (const t of tracers) {
    const awp = WEAPONS[t.wid].key === 'awp';
    const trav = Math.min(t.len, ((now - t.t) / 1000) * 7000);
    const hx = t.x1 + Math.cos(t.a) * trav, hy = t.y1 + Math.sin(t.a) * trav;
    if (awp) { // дымный след AWP
      const k = t.done ? 1 - (now - t.doneAt) / 700 : 1;
      ctx.strokeStyle = `rgba(220,225,235,${0.25 * k})`; ctx.lineWidth = 3 + (1 - k) * 4;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(hx, hy); ctx.stroke();
    }
    if (t.done) continue;
    const tail = Math.min(trav, awp ? 180 : 90);
    const bx = hx - Math.cos(t.a) * tail, by = hy - Math.sin(t.a) * tail;
    const gr = ctx.createLinearGradient(bx, by, hx, hy);
    gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(1, 'rgba(255,245,210,0.95)');
    ctx.strokeStyle = gr; ctx.lineWidth = awp ? 2.6 : 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
  }

  // игроки
  for (const p of plist) {
    if (p.id === myId) continue;
    if (!p.alive) continue;
    const st = p.ws || walkState.get(p.id) || { phase: 0, mv: 0 };
    drawCharacter(ctx, { x: p.x, y: p.y, angle: p.a, skin: p.skin, wid: p.wid, walk: st.phase, moving: st.mv, team: p.team, scale: 1.15 });
    drawTag(p.x, p.y, roster.get(p.id)?.name || '', p.hp, false, p.team);
  }
  if (me.alive) {
    drawCharacter(ctx, { x: me.rx, y: me.ry, angle: myAng, skin: SKEY[save.skin] ?? 0, wid: curWid(), walk: myWs ? myWs.phase : 0, moving: myWs ? myWs.mv : 0, team: me.team, scale: 1.15 });
    drawTag(me.rx, me.ry, save.nick || 'Игрок', me.hp, true, me.team);
  }

  // вспышки выстрелов
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flashes) {
    const k = 1 - (now - f.t) / 60, s = f.big;
    const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 90 * s);
    gr.addColorStop(0, `rgba(255,200,120,${0.35 * k})`); gr.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, 90 * s, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    ctx.fillStyle = `rgba(255,230,150,${k})`;
    ctx.beginPath(); ctx.moveTo(0, -3 * s); ctx.lineTo(18 * s, 0); ctx.lineTo(0, 3 * s); ctx.lineTo(5 * s, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(8 * s, -7 * s); ctx.lineTo(6 * s, 0); ctx.lineTo(8 * s, 7 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  drawParticles(['spark'], 'lighter');
  drawParticles(['blood', 'smoke']);
  ctx.restore();

  if (hurtFlash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${hurtFlash * 0.45})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); hurtFlash = Math.max(0, hurtFlash - 0.04);
  }
  drawScope(w);
  drawHUD(now, plist);
}

function drawParticles(types, comp) {
  if (comp) ctx.globalCompositeOperation = comp;
  for (const p of particles) {
    if (!types.includes(p.type)) continue;
    const k = 1 - p.life / p.max;
    switch (p.type) {
      case 'trail': ctx.globalAlpha = k * k * 0.22; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, 7); ctx.fill(); break;
      case 'spark': ctx.globalAlpha = k; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); break;
      case 'dust': ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#b9b2a2'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - k) * p.grow, 0, 7); ctx.fill(); break;
      case 'smoke': ctx.globalAlpha = k * 0.13; ctx.fillStyle = '#d8d8d8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - k) * p.grow, 0, 7); ctx.fill(); break;
      case 'blood': ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = '#9b0f16'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); break;
      case 'shell': ctx.globalAlpha = 1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.red ? '#c0392b' : '#d9a740'; ctx.fillRect(-2.5 * p.size, -1 * p.size, 5 * p.size, 2 * p.size); ctx.fillStyle = '#f3d27a'; ctx.fillRect(1.5 * p.size, -1 * p.size, 1 * p.size, 2 * p.size); ctx.restore(); break;
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawTag(x, y, name, hp, isMe, team) {
  ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(name, x + 1, y - 31);
  ctx.fillStyle = isMe ? '#fff' : team === me.team ? '#cfe5ff' : '#ffd6d6'; ctx.fillText(name, x, y - 32);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 18, y - 28, 36, 4);
  ctx.fillStyle = hp > 50 ? '#5fd35f' : hp > 25 ? '#ffc94d' : '#ff5a5a'; ctx.fillRect(x - 18, y - 28, 36 * hp / 100, 4);
}

function drawScope(w) {
  if (!me.alive || !me.scoped || !w.scope) return;
  if (w.scope === 2) {
    const r = Math.min(W, H) * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
    const g = ctx.createRadialGradient(mouse.x, mouse.y, r * 0.7, mouse.x, mouse.y, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mouse.x - r, mouse.y); ctx.lineTo(mouse.x + r, mouse.y); ctx.moveTo(mouse.x, mouse.y - r); ctx.lineTo(mouse.x, mouse.y + r); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 70, 0, 7); ctx.stroke();
  }
}

function box(x, y, w, h) { ctx.fillStyle = 'rgba(10,12,16,0.78)'; rr(ctx, x, y, w, h, 10); ctx.fill(); }

function drawHUD(now, plist) {
  const m = last, info = me.info || {};
  const w = curW();
  // счёт
  ctx.textAlign = 'center'; box(W / 2 - 130, 10, 260, 50);
  ctx.font = 'bold 28px system-ui';
  ctx.fillStyle = TEAM_COL[0]; ctx.fillText(m.sc[0], W / 2 - 80, 46);
  ctx.fillStyle = TEAM_COL[1]; ctx.fillText(m.sc[1], W / 2 + 80, 46);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.fillText(m.st === 'play' ? fmtTime(m.tl) : '—', W / 2, 33);
  ctx.font = '11px system-ui'; ctx.fillStyle = '#9aa3b2'; ctx.fillText(MAPS[mapIndex].name + ' · до ' + C.SCORE_LIMIT, W / 2, 51);
  // деньги
  ctx.textAlign = 'left'; box(16, 14, 150, 38);
  ctx.font = 'bold 20px system-ui'; ctx.fillStyle = '#7ee787'; ctx.fillText('$ ' + save.money.toLocaleString('ru-RU'), 30, 40);
  // здоровье
  box(16, H - 70, 230, 54);
  ctx.font = 'bold 28px system-ui'; ctx.fillStyle = me.hp > 30 ? '#fff' : '#ff6b6b';
  ctx.fillText('✚ ' + (me.alive ? me.hp : 0), 30, H - 35);
  ctx.fillStyle = '#ffffff1a'; ctx.fillRect(130, H - 47, 100, 8);
  ctx.fillStyle = me.hp > 50 ? '#5fd35f' : me.hp > 25 ? '#ffc94d' : '#ff5a5a'; ctx.fillRect(130, H - 47, me.alive ? me.hp : 0, 8);
  ctx.font = '11px system-ui'; ctx.fillStyle = '#6c7585'; ctx.fillText('ping ' + ping + ' ms', 16, H - 78);
  // оружие
  const bx = W - 266;
  box(bx, H - 70, 250, 54);
  ctx.textAlign = 'left'; ctx.font = '600 14px system-ui'; ctx.fillStyle = '#aab2c0'; ctx.fillText(w.name, bx + 14, H - 47);
  ctx.textAlign = 'right';
  if (info.rl > 0) {
    ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#ffd166'; ctx.fillText('Перезарядка', bx + 236, H - 30);
    ctx.fillStyle = '#ffffff1a'; ctx.fillRect(bx + 14, H - 26, 120, 4); ctx.fillStyle = '#ffd166'; ctx.fillRect(bx + 14, H - 26, 120 * (1 - info.rl / w.reload), 4);
  } else if (w.cat === 'knife') { ctx.font = 'bold 26px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('∞', bx + 236, H - 28); }
  else { const a = localAmmo(); ctx.font = 'bold 26px system-ui'; ctx.fillStyle = a > w.mag * 0.2 ? '#fff' : '#ff6b6b'; ctx.fillText(a + ' / ' + w.mag, bx + 236, H - 28); }
  // слоты
  let sy = H - 80;
  for (let s = 2; s >= 0; s--) {
    const wid = me.wpn[s]; if (wid == null || wid < 0) continue;
    const act = s === me.slot;
    ctx.textAlign = 'right'; ctx.font = (act ? 'bold ' : '') + '13px system-ui'; ctx.fillStyle = act ? '#fff' : '#7d8696';
    ctx.fillText(`${s + 1}  ${WEAPONS[wid].name}`, W - 22, sy); sy -= 20;
  }
  // килфид
  let y = 22;
  for (const f of feed) {
    const age = now - f.t; if (age > 6000) continue;
    ctx.globalAlpha = Math.min(1, (6000 - age) / 800);
    ctx.textAlign = 'right'; ctx.font = '13px system-ui';
    if (f.kill) {
      const k = f.kill, mid = `  [${WEAPONS[k.w].name}]  `;
      const vw = ctx.measureText(k.vn).width, mw = ctx.measureText(mid).width, kw = ctx.measureText(k.kn).width;
      ctx.fillStyle = (k.k === myId || k.v === myId) ? 'rgba(80,20,20,0.75)' : 'rgba(10,12,16,0.7)'; ctx.fillRect(W - 26 - vw - mw - kw, y - 15, vw + mw + kw + 14, 22);
      ctx.fillStyle = TEAM_COL[k.vt === 'A' ? 0 : 1]; ctx.fillText(k.vn, W - 19, y);
      ctx.fillStyle = '#cfd5dd'; ctx.fillText(mid, W - 19 - vw, y);
      ctx.fillStyle = TEAM_COL[k.kt === 'A' ? 0 : 1]; ctx.fillText(k.kn, W - 19 - vw - mw, y);
    } else { ctx.fillStyle = f.c; ctx.fillText(f.s, W - 19, y); }
    y += 26;
  }
  ctx.globalAlpha = 1;
  floaters = floaters.filter((f) => now - f.t < 1500);
  for (const f of floaters) { const k = (now - f.t) / 1500; ctx.globalAlpha = 1 - k; ctx.textAlign = 'center'; ctx.font = 'bold 20px system-ui'; ctx.fillStyle = '#7ee787'; ctx.fillText(f.s, W / 2, H / 2 - 70 - k * 40); }
  ctx.globalAlpha = 1;
  drawMinimap(plist);

  if (!me.alive && m.st === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui'; ctx.fillText('Ты убит', W / 2, H / 2 - 20);
    ctx.font = '17px system-ui'; ctx.fillStyle = '#ccd';
    if (killedBy) ctx.fillText(`${killedBy.name} · ${killedBy.w}`, W / 2, H / 2 + 10);
    ctx.fillText('Возрождение через ' + Math.ceil((info.ri || 0) / 1000) + ' с', W / 2, H / 2 + 38);
  }
  if (m.st === 'end') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.font = 'bold 40px system-ui';
    if (m.w === 'D') { ctx.fillStyle = '#fff'; ctx.fillText('Ничья', W / 2, H / 2 - 130); }
    else { const t = m.w === 'A' ? 0 : 1; ctx.fillStyle = TEAM_COL[t]; ctx.fillText((t === me.team ? 'Победа! ' : 'Поражение. ') + TEAM_NAME[t] + ' выиграли', W / 2, H / 2 - 130); }
    ctx.font = '16px system-ui'; ctx.fillStyle = '#7ee787'; ctx.fillText(`+$${endBonus} за матч`, W / 2, H / 2 - 100);
    ctx.fillStyle = '#ccd'; ctx.fillText('Следующая карта: ' + MAPS[(mapIndex + 1) % MAPS.length].name + ' через ' + Math.ceil(m.tl / 1000) + ' с', W / 2, H / 2 - 76);
    drawBoard(H / 2 - 56);
  } else if (showBoard) drawBoard(90);

  // прицел
  if (me.alive && !(me.scoped && w.scope === 2) && !paused) {
    const base = me.scoped ? w.sspread : (myMoving() ? w.mspread : w.spread);
    const gap = 3 + (base + spray) * 260 * (Math.hypot(mouse.x - playerScreen().x, mouse.y - playerScreen().y) / 300 + 0.4);
    const len = 7, x = mouse.x, yy = mouse.y;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; crossLines(x, yy, gap, len);
    ctx.lineWidth = 1.6; ctx.strokeStyle = now - hitMark < 150 ? '#ff5050' : '#7dff8a'; crossLines(x, yy, gap, len);
    if (now - hitMark < 150) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(x + dx * 5, yy + dy * 5); ctx.lineTo(x + dx * 11, yy + dy * 11); } ctx.stroke(); }
  }
}
function myMoving() { for (const c in KEYMAP) if (keys[c]) return true; return false; }
function crossLines(x, y, g, l) { ctx.beginPath(); ctx.moveTo(x - g - l, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(x + g + l, y); ctx.moveTo(x, y - g - l); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, y + g + l); ctx.stroke(); }

function drawBoard(top) {
  const bw = Math.min(680, W - 40), x0 = W / 2 - bw / 2;
  const rows = [...roster.entries()].map(([id, r]) => ({ id, ...r }));
  ctx.fillStyle = 'rgba(12,14,19,0.93)'; rr(ctx, x0, top, bw, 300, 12); ctx.fill();
  for (let t = 0; t < 2; t++) {
    const list = rows.filter((r) => r.team === t).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const cx = x0 + (t === 0 ? 16 : bw / 2 + 8), cw = bw / 2 - 24;
    ctx.textAlign = 'left'; ctx.font = 'bold 16px system-ui'; ctx.fillStyle = TEAM_COL[t]; ctx.fillText(TEAM_NAME[t] + ' — ' + last.sc[t], cx, top + 30);
    ctx.font = '12px system-ui'; ctx.fillStyle = '#7d8696'; ctx.fillText('Игрок', cx, top + 54); ctx.textAlign = 'right'; ctx.fillText('У / С', cx + cw, top + 54);
    list.forEach((r, i) => {
      const yy = top + 80 + i * 40;
      if (r.id === myId) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(cx - 6, yy - 20, cw + 12, 30); }
      ctx.textAlign = 'left'; ctx.font = '14px system-ui'; ctx.fillStyle = r.bot ? '#8b93a3' : '#fff'; ctx.fillText(r.name, cx, yy);
      ctx.textAlign = 'right'; ctx.fillText(r.kills + ' / ' + r.deaths, cx + cw, yy);
    });
  }
}

function drawMinimap(plist) {
  const map = MAPS[mapIndex], s = 5, mw = map.W * s, mh = map.H * s, x0 = 16, y0 = H - 92 - mh;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(10,12,16,0.8)'; ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#5a6170';
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) if (map.grid[y * map.W + x]) ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
  const k = s / C.TILE;
  for (const p of plist) { if (!p.alive || p.team !== me.team || p.id === myId) continue; ctx.fillStyle = TEAM_COL[p.team]; ctx.fillRect(x0 + p.x * k - 2, y0 + p.y * k - 2, 4, 4); }
  if (me.alive) { ctx.fillStyle = '#fff'; ctx.fillRect(x0 + me.rx * k - 3, y0 + me.ry * k - 3, 6, 6); }
  ctx.globalAlpha = 1;
}

requestAnimationFrame(frame);
})();
