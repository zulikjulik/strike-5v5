import * as THREE from 'three';
import { U, TEAM_COL, THEMES, buildWorld, tex } from './world.js';
import { makeGun, makeCharacter, poseCharacter, makeVMHands, envFor, makeGloveModel } from './models.js';

const S = window.Shared;
const { C, MAPS, WEAPONS, WKEY, SKINS, SKEY, FINISHES, CASES, RARITY } = S;
const Sfx = window.Sfx;
const TEAM_HEX = ['#4ea1ff', '#ff5a5a'];
const TEAM_NAME = ['Синие', 'Красные'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// =====================================================================
// Сохранение (в браузере игрока)
// =====================================================================
const SAVE_KEY = 'strike5v5_save';
function defSave() { return { money: C.START_MONEY, ownedW: ['knife', 'glock', 'usp'], ownedS: ['recruit'], primary: null, pistol: 'usp', skin: 'recruit', nick: '', music: 0.4, sfx: 0.8, sens: 0.5, fov: 80, quality: 'medium', inv: {}, eq: {}, freeCases: false, adminPass: '', uid: '', fullscreen: true }; }
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(defSave(), s); } catch {}
if (!['high', 'medium', 'low'].includes(save.quality)) save.quality = 'medium';
if (!save.uid) { save.uid = Math.random().toString(36).slice(2) + Date.now().toString(36); }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
function moneyUI() { $('money').textContent = save.money.toLocaleString('ru-RU'); }
function addMoney(n) { save.money += n; persist(); moneyUI(); }
function loadout() { return [save.primary ? WKEY[save.primary] : -1, WKEY[save.pistol] ?? WKEY.usp]; }
function finMap() { const o = {}; for (const k in save.eq) { const wid = WKEY[k]; const fid = save.eq[k]; if (wid != null && S.finishFits(fid, wid) && save.inv[fid] > 0) o[wid] = fid; } return o; }
function eqFid(wid) { const k = WEAPONS[wid]?.key; const f = save.eq[k]; return f != null && save.inv[f] > 0 && S.finishFits(f, wid) ? f : -1; }
function eqGlove() { const f = save.eq.gloves; return f != null && save.inv[f] > 0 && FINISHES[f] && FINISHES[f].w === 'gloves' ? f : -1; }
function toast(text, ms = 3500) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms); }

// =====================================================================
// Связь с сервером (одно соединение на всё время)
// =====================================================================
let ws = null, wsReady = false;
const pendingOut = [];
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); else pendingOut.push(o); }
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => { wsReady = true; ws.send(JSON.stringify({ t: 'hello', uid: save.uid })); while (pendingOut.length) ws.send(JSON.stringify(pendingOut.shift())); send({ t: 'rooms' }); if (save.adminPass) send({ t: 'admin', pass: save.adminPass }); };
  ws.onclose = () => { wsReady = false; if (joined) { joined = false; showMenu(); $('status').textContent = 'Соединение потеряно — переподключаюсь…'; } setTimeout(connect, 2000); };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
}
function onMsg(m) {
  switch (m.t) {
    case 'welcome': myId = m.id; snaps = []; pending = []; last = null; me.alive = false; me.info = {}; lastState = 'play'; feed = []; setWorld(m.m); joined = true; roomInfo = m.room; showGame(); break;
    case 'map': setWorld(m.m); feed.push({ s: 'Карта: ' + MAPS[m.m].name, c: '#ffd166', t: performance.now() }); break;
    case 's': if (joined) onSnap(m); break;
    case 'pong': ping = Math.round(performance.now() - m.c); break;
    case 'rooms': renderRooms(m.list); break;
    case 'err': $('status').textContent = m.msg; toast(m.msg); break;
    case 'left': break;
    case 'kicked': joined = false; showMenu(); toast(m.msg || 'Тебя кикнули с сервера'); break;
    case 'say': toast('Объявление: ' + m.text, 6000); if (joined) feed.push({ s: 'Админ: ' + m.text, c: '#ffd166', t: performance.now() }); break;
    case 'chat': chatLines.push({ n: m.n, tm: m.tm, s: m.s, team: m.team, dead: m.dead, t: performance.now() }); if (chatLines.length > 40) chatLines.shift(); Sfx.uiClick(); break;
    case 'admin': isAdmin = !!m.ok; if (!isAdmin && save.adminPass) { save.adminPass = ''; persist(); } renderAdmin(); if (m.ok) send({ t: 'adm', cmd: 'state' }); else if (curTab === 'admin') $('admErr').textContent = 'Неверный пароль'; break;
    case 'adm': admState = m.rooms; renderAdmin(); break;
    case 'market': marketList = m.list; renderMarket(); break;
    case 'sold_listed': if (save.inv[m.fid] > 0) { save.inv[m.fid]--; if (!save.inv[m.fid]) { delete save.inv[m.fid]; for (const k in save.eq) if (save.eq[k] === m.fid) delete save.eq[k]; } persist(); } toast('Предмет выставлен на продажу'); renderMarket(); refreshPreview(); break;
    case 'unlisted': save.inv[m.fid] = (save.inv[m.fid] || 0) + 1; persist(); toast('Лот снят, предмет вернулся в инвентарь'); renderMarket(); break;
    case 'bought': save.inv[m.fid] = (save.inv[m.fid] || 0) + 1; addMoney(-m.price); Sfx.buy(); toast('Куплено: ' + S.itemName(FINISHES[m.fid])); renderMarket(); break;
    case 'payout': addMoney(m.money); toast('Продано на рынке: ' + m.sold.map((x) => S.itemName(FINISHES[x.fid])).join(', ') + ` · +$${m.money.toLocaleString('ru-RU')}`, 7000); break;
  }
}
setInterval(() => { if (wsReady) send({ t: 'ping', c: performance.now() }); }, 2000);
setInterval(() => { if (wsReady && !joined && curTab === 'servers') send({ t: 'rooms' }); if (wsReady && isAdmin && curTab === 'admin') send({ t: 'adm', cmd: 'state' }); }, 3000);

// =====================================================================
// Рендеры
// =====================================================================
const glc = $('gl'), hud = $('hud'), h = hud.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(save.fov, 1, 0.05, 500); camera.rotation.order = 'YXZ';
scene.environment = envFor(renderer);
const vmScene = new THREE.Scene(); vmScene.environment = envFor(renderer);
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.7));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.5); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);
const vmFill = new THREE.DirectionalLight(0x9fc4ff, 0.6); vmFill.position.set(-1.5, 0.5, 0.5); vmScene.add(vmFill);
const vmFlashLight = new THREE.PointLight(0xffc070, 0, 3); vmFlashLight.position.set(0.2, -0.1, -0.8); vmScene.add(vmFlashLight);
const flashLight = new THREE.PointLight(0xffb060, 0, 10, 1.5); scene.add(flashLight);
const flashLight2 = new THREE.PointLight(0xffb060, 0, 10, 1.5); scene.add(flashLight2);

let W = 0, H = 0, DPR = 1;
function applyQuality() {
  const q = save.quality;
  renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 1.5) : q === 'medium' ? Math.min(devicePixelRatio, 1) : 0.75);
  renderer.shadowMap.enabled = q !== 'low';
  resize();
  if (world) setWorld(worldIdx, true);
}
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  renderer.setSize(W, H, false);
  hud.width = W * DPR; hud.height = H * DPR; hud.style.width = W + 'px'; hud.style.height = H + 'px';
  camera.aspect = W / H; camera.updateProjectionMatrix(); vmCam.aspect = W / H; vmCam.updateProjectionMatrix();
  for (const p of psys) p.mat.uniforms.scale.value = (H * renderer.getPixelRatio()) / 2;
}
addEventListener('resize', resize);

// Отрисовка картинок оружия/персонажей для меню (кэш)
let cardR = null;
const imgCache = {};
function snap(obj, w, hgt, camPos, look, fov) {
  if (!cardR) { cardR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); cardR.outputColorSpace = THREE.SRGBColorSpace; cardR.toneMapping = THREE.ACESFilmicToneMapping; cardR.toneMappingExposure = 1.1; }
  cardR.setSize(w, hgt, false);
  const sc = new THREE.Scene(); sc.environment = envFor(cardR); sc.add(new THREE.HemisphereLight(0xffffff, 0x9fb0c8, 2.6)); const l = new THREE.DirectionalLight(0xffffff, 3.2); l.position.set(2, 4, 3); sc.add(l); const l2 = new THREE.DirectionalLight(0x9fc4ff, 2.0); l2.position.set(-3, 1, -2); sc.add(l2); const l3 = new THREE.DirectionalLight(0xffffff, 1.2); l3.position.set(0, -2, 3); sc.add(l3); sc.add(obj);
  const cam = new THREE.PerspectiveCamera(fov, w / hgt, 0.01, 50); cam.position.copy(camPos); cam.lookAt(look);
  cardR.clear(); cardR.render(sc, cam); return cardR.domElement.toDataURL();
}
function gunImage(wid, fid = -1) {
  const k = 'g' + wid + '_' + fid; if (imgCache[k]) return imgCache[k];
  const g = makeGun(wid, fid); g.rotation.y = Math.PI / 2;
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const d = Math.max(size.x * 0.95, size.y * 2.1) + 0.04;
  return (imgCache[k] = snap(g, 360, 180, new THREE.Vector3(c.x, c.y + 0.03, c.z + d), c, 35));
}
function gloveImage(fid) {
  const k = 'gl' + fid; if (imgCache[k]) return imgCache[k];
  const g = makeGloveModel(fid);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  return (imgCache[k] = snap(g, 360, 180, new THREE.Vector3(c.x, c.y + size.y * 0.25, c.z + Math.max(size.x * 0.85, size.y * 1.7) + 0.02), c, 35));
}
function skinImage(id) {
  const k = 's' + id; if (imgCache[k]) return imgCache[k];
  const ch = makeCharacter(id, 0, WKEY.ak47); ch.rotation.y = Math.PI - 0.55;
  return (imgCache[k] = snap(ch, 360, 340, new THREE.Vector3(0, 1.05, 3.3), new THREE.Vector3(0, 0.92, 0), 30));
}

// Предпросмотр персонажа в меню
const pv = $('preview');
const pvR = new THREE.WebGLRenderer({ canvas: pv, alpha: true, antialias: true });
pvR.outputColorSpace = THREE.SRGBColorSpace; pvR.toneMapping = THREE.ACESFilmicToneMapping;
const pvScene = new THREE.Scene();
pvScene.environment = envFor(pvR);
pvScene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3550, 2.0));
const pvRim = new THREE.DirectionalLight(0x4ea1ff, 2.5); pvRim.position.set(-3, 3, -3); pvScene.add(pvRim);
const pvSun = new THREE.DirectionalLight(0xffffff, 2.4); pvSun.position.set(2, 4, 3); pvScene.add(pvSun);
const pvCam = new THREE.PerspectiveCamera(28, 0.75, 0.1, 50); pvCam.position.set(0, 1.15, 5.2); pvCam.lookAt(0, 0.95, 0);
const disc = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.9, 64), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.55 })); disc.rotation.x = -Math.PI / 2; pvScene.add(disc);
const disc2 = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ color: 0x0b1530, transparent: true, opacity: 0.6 })); disc2.rotation.x = -Math.PI / 2; disc2.position.y = 0.002; pvScene.add(disc2);
let pvChar = null, pvAng = Math.PI - 0.5;
function refreshPreview() {
  if (pvChar) pvScene.remove(pvChar);
  const wid = save.primary ? WKEY[save.primary] : WKEY[save.pistol];
  pvChar = makeCharacter(SKEY[save.skin] ?? 0, 0, wid, eqFid(wid)); pvChar.rotation.y = pvAng; pvScene.add(pvChar);
  const s = SKINS[SKEY[save.skin] ?? 0];
  $('skinName').textContent = s.name; $('skinNote').textContent = s.female ? 'Меньше хитбокс' : '';
  const kf = eqFid(WKEY.knife);
  $('knifeName').textContent = kf >= 0 ? S.itemName(FINISHES[kf]) : 'Нож';
  $('knifeImg').src = gunImage(WKEY.knife, kf);
}
function sizePreview() { const r = pv.getBoundingClientRect(); if (r.width > 10) { pvR.setPixelRatio(Math.min(devicePixelRatio, 2)); pvR.setSize(r.width, r.height, false); pvCam.aspect = r.width / r.height; pvCam.updateProjectionMatrix(); } }
addEventListener('resize', sizePreview);

// =====================================================================
// Меню: вкладки
// =====================================================================
const menu = $('menu');
let curTab = 'play', isAdmin = false, admState = [];
document.querySelectorAll('nav button[data-tab]').forEach((b) => b.onclick = () => {
  Sfx.init(); Sfx.uiClick(); openTab(b.dataset.tab);
});
function openTab(t) {
  curTab = t;
  document.querySelectorAll('nav button[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === t));
  for (const k of ['play', 'servers', 'arsenal', 'cases', 'inventory', 'market', 'skins', 'settings', 'admin']) $('tab-' + k).classList.toggle('hidden', k !== t);
  if (t === 'play') { fillSelects(); refreshPreview(); setTimeout(sizePreview, 0); }
  if (t === 'servers') send({ t: 'rooms' });
  if (t === 'arsenal') buildArsenal();
  if (t === 'cases') buildCases();
  if (t === 'inventory') buildInventory();
  if (t === 'skins') buildSkins();
  if (t === 'market') { send({ t: 'market' }); renderMarket(); }
  if (t === 'admin') { renderAdmin(); if (isAdmin) send({ t: 'adm', cmd: 'state' }); }
}
document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
// объёмный наклон карточек за курсором
document.addEventListener('mousemove', (e) => {
  if (joined) return;
  const c = e.target.closest && e.target.closest('.card');
  document.querySelectorAll('.card.tilt').forEach((x) => { if (x !== c) { x.classList.remove('tilt'); x.style.transform = ''; } });
  if (!c) return;
  const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
  c.classList.add('tilt'); c.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 12}deg) translateY(-4px)`;
});

$('name').value = save.nick;
$('name').oninput = () => { save.nick = $('name').value; persist(); };
moneyUI();
for (const [id, k] of [['volMusic', 'music'], ['volSfx', 'sfx'], ['sens', 'sens'], ['fov', 'fov']]) $(id).value = save[k];
$('quality').value = save.quality; $('fsOn').checked = save.fullscreen !== false;
$('fsOn').onchange = (e) => { save.fullscreen = e.target.checked; persist(); };
Sfx.setVolume('music', save.music); Sfx.setVolume('sfx', save.sfx);
$('volMusic').oninput = (e) => { save.music = +e.target.value; Sfx.setVolume('music', save.music); persist(); };
$('volSfx').oninput = (e) => { save.sfx = +e.target.value; Sfx.setVolume('sfx', save.sfx); persist(); };
$('sens').oninput = (e) => { save.sens = +e.target.value; persist(); };
$('fov').oninput = (e) => { save.fov = +e.target.value; persist(); };
$('quality').onchange = (e) => { save.quality = e.target.value; persist(); applyQuality(); };

function fillSelect(sel, slot) {
  const owned = WEAPONS.filter((w) => w.slot === slot && save.ownedW.includes(w.key));
  sel.innerHTML = (slot === 0 ? '<option value="">— нет (купи в Арсенале) —</option>' : '') + owned.map((w) => `<option value="${w.key}">${w.name}${eqFid(w.id) >= 0 ? ' · ' + esc(FINISHES[eqFid(w.id)].name) : ''}</option>`).join('');
  sel.value = (slot === 0 ? save.primary : save.pistol) || '';
}
function fillSelects() { fillSelect($('selPrimary'), 0); fillSelect($('selPistol'), 1); fillSelect($('pPrimary'), 0); fillSelect($('pPistol'), 1); }
function sendLoadout() { if (joined) send({ t: 'lo', lo: loadout(), fin: finMap() }); }
function onSel(slot, val) { if (slot === 0) save.primary = val || null; else save.pistol = val; persist(); fillSelects(); refreshPreview(); sendLoadout(); }
$('selPrimary').onchange = (e) => onSel(0, e.target.value);
$('selPistol').onchange = (e) => onSel(1, e.target.value);
$('pPrimary').onchange = (e) => onSel(0, e.target.value);
$('pPistol').onchange = (e) => onSel(1, e.target.value);
$('mapsRow').innerHTML = MAPS.map((m) => { const th = THEMES[m.theme]; const hex = (n) => '#' + n.toString(16).padStart(6, '0'); return `<div><i style="background:linear-gradient(180deg,${hex(th.sky)} 0 45%,${hex(th.tree[0])} 45% 70%,${hex(th.hemiG)} 70%)"></i>${m.name}</div>`; }).join('');

// ----- серверы -----
$('cMap').innerHTML = MAPS.map((m, i) => `<option value="${i}">${m.name}</option>`).join('');
$('refresh').onclick = () => { Sfx.uiClick(); send({ t: 'rooms' }); };
function profile() { save.nick = $('name').value.trim() || save.nick; persist(); return { name: save.nick || 'Игрок', skin: SKEY[save.skin] ?? 0, lo: loadout(), fin: finMap() }; }
$('quick').onclick = () => { Sfx.init(); enterFullscreen(); $('status').textContent = 'Подключение…'; send(Object.assign({ t: 'quick' }, profile())); };
$('cGo').onclick = () => { Sfx.uiClick(); enterFullscreen(); send(Object.assign({ t: 'create', room_name: $('cName').value.trim() || `Сервер ${save.nick || 'игрока'}`, pass: $('cPass').value.trim(), map: +$('cMap').value, bots: $('cBots').value === '1' }, profile())); };
function renderRooms(list) {
  const tb = $('rooms');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="5" style="color:#8ea3c7">Пока нет серверов. Создай свой или нажми «В БОЙ».</td></tr>'; return; }
  tb.innerHTML = list.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.locked ? ' 🔒' : ''}${r.official ? ' <span class="tag">быстрая</span>' : ''}${r.bots ? '' : ' <span class="tag">без ботов</span>'}</td><td>${MAPS[r.map]?.name || ''}</td><td>${r.players} / ${r.max}</td><td>${r.score[0]} : ${r.score[1]}</td>
    <td style="text-align:right">${r.locked ? `<input type="password" placeholder="пароль" data-pass="${r.id}" style="width:110px;padding:7px 9px;font-size:13px;margin-right:6px">` : ''}<button class="btn acc" data-join="${r.id}" ${r.players >= r.max ? 'disabled' : ''}>Зайти</button></td></tr>`).join('');
  tb.querySelectorAll('[data-join]').forEach((b) => b.onclick = () => { enterFullscreen(); const id = +b.dataset.join; const pi = tb.querySelector(`[data-pass="${id}"]`); send(Object.assign({ t: 'join', room: id, pass: pi ? pi.value : '' }, profile())); });
}

// ----- арсенал -----
const CATS = [['all', 'Всё'], ['pistol', 'Пистолеты'], ['smg', 'ПП'], ['shotgun', 'Дробовики'], ['rifle', 'Винтовки'], ['sniper', 'Снайперские'], ['mg', 'Пулемёт']];
let wcat = 'all';
const bar = (v) => `<div class="bar"><i style="width:${Math.round(Math.max(0.04, Math.min(1, v)) * 100)}%"></i></div>`;
function buildArsenal() {
  $('wcats').innerHTML = CATS.map(([k, n]) => `<button class="${k === wcat ? 'active' : ''}" data-c="${k}">${n}</button>`).join('');
  $('wcats').querySelectorAll('button').forEach((c) => c.onclick = () => { wcat = c.dataset.c; Sfx.uiClick(); buildArsenal(); });
  const list = WEAPONS.filter((w) => w.cat !== 'knife' && (wcat === 'all' || w.cat === wcat || (wcat === 'pistol' && w.cat === 'dual')));
  const g = $('wgrid'); g.innerHTML = '';
  for (const w of list) {
    const owned = save.ownedW.includes(w.key), eq = (w.slot === 0 ? save.primary : save.pistol) === w.key;
    const el = document.createElement('div'); el.className = 'card' + (eq ? ' eq' : '');
    const dps = (w.dmg * w.pellets) / 150, rate = Math.min(1, 1000 / w.fire / 14), acc = 1 - w.spread / 0.1, mob = (w.speed - 0.76) / 0.3;
    const tag = (w.key === 'awp' ? '<span class="tag gold">ИМБА</span>' : w.scope === 1 ? '<span class="tag">коллиматор</span>' : owned ? '<span class="tag">куплено</span>' : '') + (w.hs1 ? ' <span class="tag pink">ваншот в голову</span>' : '');
    el.innerHTML = `<img src="${gunImage(w.id, eqFid(w.id))}" alt=""><div class="nm">${w.name} ${tag}</div>
      <div class="stats"><span>Урон</span>${bar(dps)}<span>Скорострельн.</span>${bar(rate)}<span>Точность</span>${bar(acc)}<span>Мобильность</span>${bar(mob)}</div>
      ${owned ? (eq ? '<button class="btn" disabled>Выбрано</button>' : '<button class="btn blue">Выбрать</button>') : `<button class="btn acc" ${save.money < w.price ? 'disabled' : ''}>Купить · $${w.price.toLocaleString('ru-RU')}</button>`}`;
    el.querySelector('button').onclick = () => {
      if (!owned) { if (save.money < w.price) return; save.money -= w.price; save.ownedW.push(w.key); Sfx.buy(); } else Sfx.uiClick();
      if (w.slot === 0) save.primary = w.key; else save.pistol = w.key;
      persist(); moneyUI(); fillSelects(); buildArsenal(); sendLoadout();
    };
    g.appendChild(el);
  }
}

// ----- персонажи -----
function buildSkins() {
  const g = $('sgrid'); g.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.ownedS.includes(s.key), eq = save.skin === s.key;
    const el = document.createElement('div'); el.className = 'card skin' + (eq ? ' eq' : '');
    const tag = s.female ? '<span class="tag pink">меньше хитбокс</span>' : owned ? '<span class="tag">куплено</span>' : '';
    el.innerHTML = `<img src="${skinImage(s.id)}" alt=""><div class="nm">${s.name} ${tag}</div>
      ${owned ? (eq ? '<button class="btn" disabled>Надето</button>' : '<button class="btn blue">Надеть</button>') : `<button class="btn acc" ${save.money < s.price ? 'disabled' : ''}>Купить · $${s.price.toLocaleString('ru-RU')}</button>`}`;
    el.querySelector('button').onclick = () => {
      if (!owned) { if (save.money < s.price) return; save.money -= s.price; save.ownedS.push(s.key); Sfx.buy(); } else Sfx.uiClick();
      save.skin = s.key; persist(); moneyUI(); buildSkins(); refreshPreview();
    };
    g.appendChild(el);
  }
}

// ----- кейсы -----
function itemLabel(f) { return S.itemName(f); }
function itemImg(f) { return f.w === 'gloves' ? gloveImage(f.id) : gunImage(WKEY[f.w], f.id); }
function buildCases() {
  const box = $('caseList'); box.innerHTML = '';
  CASES.forEach((cs, ci) => {
    const items = FINISHES.filter((f) => f.case === ci).sort((a, b) => a.r - b.r);
    const price = save.freeCases ? 0 : cs.price;
    const el = document.createElement('div'); el.className = 'case';
    el.innerHTML = `<div class="box" style="background:linear-gradient(135deg,${cs.color},#1b2029)">${esc(cs.name.toUpperCase())}</div>
      <div class="items">${items.filter((f) => f.r < 5).map((f) => `<div style="border-color:${RARITY[f.r].color}"><img src="${itemImg(f)}" alt="">${esc(f.name)}</div>`).join('')}<div style="border-color:${RARITY[5].color}"><img src="${gunImage(WKEY.knife, -1)}" alt="">★ Нож или перчатки</div></div>
      <button class="btn acc" ${save.money < price ? 'disabled' : ''}>Открыть · $${price.toLocaleString('ru-RU')}</button>`;
    el.querySelector('button').onclick = () => openCase(ci);
    box.appendChild(el);
  });
}
let opening = false;
function openCase(ci) {
  const cs = CASES[ci], price = save.freeCases ? 0 : cs.price;
  if (opening || save.money < price) return;
  opening = true; Sfx.init(); addMoney(-price);
  const win = S.rollCase(ci);
  const N = 52, WIN_AT = 45, CW = 158;
  const items = [];
  for (let i = 0; i < N; i++) items.push(i === WIN_AT ? win : S.rollCase(ci));
  const reel = $('reel');
  reel.innerHTML = items.map((f) => `<div class="it" style="border-color:${RARITY[f.r].color}"><img src="${f.r === 5 ? gunImage(WKEY.knife, -1) : itemImg(f)}" alt=""><span>${f.r === 5 ? '★ Редкий особый' : esc(itemLabel(f))}</span></div>`).join('');
  $('opTitle').textContent = cs.name; $('opResult').classList.add('hidden'); $('opAgain').classList.add('hidden'); $('opClose').classList.add('hidden');
  $('opener').classList.remove('hidden');
  const wrapW = reel.parentElement.clientWidth;
  const target = WIN_AT * CW + CW / 2 - wrapW / 2 + (Math.random() - 0.5) * (CW * 0.7);
  const T0 = performance.now(), DUR = 6200;
  let lastIdx = -1;
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  reel.style.transform = 'translateX(0px)';
  const anim = (now) => {
    const t = Math.min(1, (now - T0) / DUR), x = target * ease(t);
    reel.style.transform = `translateX(${-x}px)`;
    const idx = Math.floor((x + wrapW / 2) / CW); if (idx !== lastIdx) { lastIdx = idx; Sfx.uiClick(); }
    if (t < 1) requestAnimationFrame(anim); else finish();
  };
  requestAnimationFrame(anim);
  function finish() {
    save.inv[win.id] = (save.inv[win.id] || 0) + 1; persist();
    if (win.r >= 4) Sfx.killDing(); else Sfx.buy();
    const r = $('opResult'); r.classList.remove('hidden');
    r.innerHTML = `<img src="${itemImg(win)}" alt=""><b style="color:${RARITY[win.r].color}">${esc(itemLabel(win))}</b><span style="color:#8ea3c7;font-size:13px">${RARITY[win.r].name}</span>`;
    $('opAgain').classList.remove('hidden'); $('opClose').classList.remove('hidden');
    $('opAgain').disabled = save.money < (save.freeCases ? 0 : cs.price);
    $('opAgain').onclick = () => { opening = false; openCase(ci); };
    $('opClose').onclick = () => { opening = false; $('opener').classList.add('hidden'); buildCases(); };
  }
}

// ----- инвентарь -----
function buildInventory() {
  const g = $('invGrid'); g.innerHTML = '';
  const ids = Object.keys(save.inv).map(Number).filter((id) => save.inv[id] > 0 && FINISHES[id]).sort((a, b) => FINISHES[b].r - FINISHES[a].r);
  if (!ids.length) { g.innerHTML = '<div class="note">Инвентарь пуст — открой кейс во вкладке «Кейсы».</div>'; return; }
  for (const id of ids) {
    const f = FINISHES[id], on = save.eq[f.w] === id;
    const el = document.createElement('div'); el.className = 'card' + (on ? ' eq' : '');
    el.innerHTML = `<img src="${itemImg(f)}" alt="">${save.inv[id] > 1 ? `<span class="cnt">×${save.inv[id]}</span>` : ''}<div class="nm" style="font-size:13px">${esc(itemLabel(f))}</div><span class="tag" style="align-self:flex-start;color:${RARITY[f.r].color}">${RARITY[f.r].name}</span>
      <button class="btn ${on ? '' : 'blue'}">${on ? 'Снять' : 'Надеть'}</button><div class="rar" style="background:${RARITY[f.r].color}"></div>`;
    el.querySelector('button').onclick = () => { Sfx.uiClick(); if (on) delete save.eq[f.w]; else save.eq[f.w] = id; persist(); buildInventory(); refreshPreview(); sendLoadout(); if (joined) buildVM(true); };
    g.appendChild(el);
  }
}

// ----- торговая площадка -----
let marketList = [];
function renderMarket() {
  if (curTab !== 'market') return;
  const mine = marketList.filter((l) => l.seller === save.uid), others = marketList.filter((l) => l.seller !== save.uid);
  const card = (l, own) => { const f = FINISHES[l.fid]; if (!f) return ''; return `<div class="card"><img src="${itemImg(f)}" alt=""><div class="nm" style="font-size:13px">${esc(itemLabel(f))}</div>
    <span class="tag" style="align-self:flex-start;color:${RARITY[f.r].color}">${RARITY[f.r].name}</span><div style="display:flex;justify-content:space-between;font-size:13px"><b>$${l.price.toLocaleString('ru-RU')}</b><span style="color:#8ea3c7">${esc(l.sname)}</span></div>
    ${own ? `<button class="btn" data-unlist="${l.id}">Снять с продажи</button>` : `<button class="btn acc" data-buy="${l.id}" ${save.money < l.price ? 'disabled' : ''}>Купить</button>`}<div class="rar" style="background:${RARITY[f.r].color}"></div></div>`; };
  $('mkList').innerHTML = others.length ? others.map((l) => card(l, false)).join('') : '<div class="note">Пока никто ничего не продаёт.</div>';
  $('mkMine').innerHTML = mine.length ? mine.map((l) => card(l, true)).join('') : '<div class="note">У тебя нет активных лотов.</div>';
  const ids = Object.keys(save.inv).map(Number).filter((id) => save.inv[id] > 0 && FINISHES[id]);
  const sel = $('mkItem'), prev = sel.value;
  sel.innerHTML = ids.length ? ids.map((id) => `<option value="${id}">${esc(itemLabel(FINISHES[id]))} (${RARITY[FINISHES[id].r].name})${save.inv[id] > 1 ? ' ×' + save.inv[id] : ''}</option>`).join('') : '<option value="">— инвентарь пуст —</option>';
  if (prev && ids.includes(+prev)) sel.value = prev;
  $('mkSell').disabled = !ids.length;
  document.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => { const l = marketList.find((x) => x.id === +b.dataset.buy); if (l && save.money >= l.price) send({ t: 'buy', id: l.id }); });
  document.querySelectorAll('[data-unlist]').forEach((b) => b.onclick = () => send({ t: 'unlist', id: +b.dataset.unlist }));
}
$('mkSell').onclick = () => { const fid = +$('mkItem').value, price = Math.floor(+$('mkPrice').value); if (!(save.inv[fid] > 0)) return; if (!(price >= 10)) { toast('Укажи цену от $10'); return; } send({ t: 'sell', fid, price, name: save.nick || 'Игрок' }); };
$('mkRefresh').onclick = () => { Sfx.uiClick(); send({ t: 'market' }); };

// ----- админ -----
$('admGo').onclick = () => { save.adminPass = $('admPass').value; persist(); $('admErr').textContent = ''; send({ t: 'admin', pass: save.adminPass }); };
$('admSayGo').onclick = () => { const t = $('admSay').value.trim(); if (t) { send({ t: 'adm', cmd: 'say', text: t }); $('admSay').value = ''; } };
$('admMoney').onclick = () => { if (!isAdmin) return toast('Сначала войди в админ-панель'); addMoney(10000); toast('+$10 000'); };
$('admUnlock').onclick = () => { if (!isAdmin) return toast('Сначала войди в админ-панель'); save.ownedW = WEAPONS.map((w) => w.key); save.ownedS = SKINS.map((s) => s.key); persist(); fillSelects(); toast('Всё оружие и персонажи открыты'); };
$('admKnives').onclick = () => { if (!isAdmin) return toast('Сначала войди в админ-панель'); let n = 0; for (const f of FINISHES) if (f.w === 'knife' && !(save.inv[f.id] > 0)) { save.inv[f.id] = 1; n++; } persist(); buildInventory(); refreshPreview(); toast(n ? `Выдано ножей: ${n}` : 'Все ножи уже есть'); };
$('admSkins').onclick = () => { if (!isAdmin) return toast('Сначала войди в админ-панель'); let n = 0; for (const f of FINISHES) if (!(save.inv[f.id] > 0)) { save.inv[f.id] = 1; n++; } persist(); buildInventory(); refreshPreview(); toast(n ? `Выдано скинов: ${n}` : 'Все скины уже есть'); };
$('admGloves').onclick = () => { if (!isAdmin) return toast('Сначала войди в админ-панель'); let n = 0; for (const f of FINISHES) if (f.w === 'gloves' && !(save.inv[f.id] > 0)) { save.inv[f.id] = 1; n++; } persist(); buildInventory(); toast(n ? `Выдано перчаток: ${n}` : 'Все перчатки уже есть'); };
$('admFree').onclick = () => { if (!isAdmin) return; save.freeCases = !save.freeCases; persist(); renderAdmin(); };
function renderAdmin() {
  $('admLogin').classList.toggle('hidden', isAdmin); $('admBody').classList.toggle('hidden', !isAdmin);
  $('admFree').textContent = 'Бесплатные кейсы: ' + (save.freeCases ? 'вкл' : 'выкл');
  if (!isAdmin) return;
  const box = $('admRooms');
  if (!admState.length) { box.innerHTML = '<div class="note">Сейчас нет активных серверов.</div>'; return; }
  box.innerHTML = admState.map((r) => `<div class="panel" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>${esc(r.name)}${r.locked ? ' 🔒' : ''} · ${MAPS[r.map]?.name} · ${r.score[0]}:${r.score[1]}</b>
    <span style="display:flex;gap:6px;flex-wrap:wrap"><select data-map="${r.id}" style="width:auto">${MAPS.map((m, i) => `<option value="${i}" ${i === r.map ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
    <button class="btn" data-cmd="restart" data-r="${r.id}">Рестарт</button><button class="btn" data-cmd="bots" data-r="${r.id}" data-on="${r.bots ? 0 : 1}">Боты: ${r.bots ? 'вкл' : 'выкл'}</button><button class="btn red" data-cmd="close" data-r="${r.id}">Закрыть</button></span></div>
    <table style="margin-top:10px"><thead><tr><th>ИГРОК</th><th>КОМАНДА</th><th>У/С</th><th></th></tr></thead><tbody>${r.players.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.team === 'A' ? 'Синие' : 'Красные'}</td><td>${p.kills}/${p.deaths}</td><td style="text-align:right"><button class="btn red" data-cmd="kick" data-r="${r.id}" data-pid="${p.id}">Кикнуть</button></td></tr>`).join('') || '<tr><td colspan="4">нет игроков</td></tr>'}</tbody></table></div>`).join('');
  box.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => send({ t: 'adm', cmd: b.dataset.cmd, room: +b.dataset.r, pid: +(b.dataset.pid || 0), on: b.dataset.on === '1' }));
  box.querySelectorAll('[data-map]').forEach((s) => s.onchange = () => send({ t: 'adm', cmd: 'map', room: +s.dataset.map, map: +s.value }));
}

// =====================================================================
// Частицы и эффекты
// =====================================================================
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
      vertexShader: 'attribute vec3 pcolor; attribute float psize; attribute float palpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.05,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC,vA*t.a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  add(o) { if (this.list.length < this.max) this.list.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0.92, grow: 0, life: 0, a: 1 }, o)); }
  clear() { this.list.length = 0; }
  update(dt) {
    const L = this.list; let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life += dt; if (p.life >= p.max) continue;
      p.vy -= p.g * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01 && p.g) { p.y = 0.01; p.vy *= -0.2; p.vx *= 0.5; p.vz *= 0.5; }
      const k = 1 - p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.c.r; this.col[n * 3 + 1] = p.c.g; this.col[n * 3 + 2] = p.c.b;
      this.size[n] = p.s + p.grow * (1 - k); this.alpha[n] = p.a * k;
      L[n++] = p;
    }
    L.length = n;
    for (const a of ['position', 'pcolor', 'psize', 'palpha']) this.geo.attributes[a].needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
}
const pAdd = new PSys(1500, true), pNorm = new PSys(1800, false);
const psys = [pAdd, pNorm];
const COL = { fire: new THREE.Color(1, 0.45, 0.12), soot: new THREE.Color(0.12, 0.12, 0.13), spark: new THREE.Color(1, 0.8, 0.4), dust: new THREE.Color(0.62, 0.58, 0.5), blood: new THREE.Color(0.55, 0.02, 0.04), smoke: new THREE.Color(0.82, 0.82, 0.82), chim: new THREE.Color(0.6, 0.6, 0.62) };
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const tracerGlow = new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
const tracerPool = [], glowPool = [], smokePool = [];
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(unitBox, tracerMat); m.visible = false; m.frustumCulled = false; scene.add(m); tracerPool.push(m); const g2 = new THREE.Mesh(unitBox, tracerGlow); g2.visible = false; g2.frustumCulled = false; scene.add(g2); glowPool.push(g2); }
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xdde3ec, transparent: true, opacity: 0.3, depthWrite: false })); m.visible = false; scene.add(m); smokePool.push(m); }
let tracers = [], smokes = [];
const flashMat = new THREE.SpriteMaterial({ map: tex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const flareMat = new THREE.MeshBasicMaterial({ map: tex('flare'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
// вспышка: звезда-спрайт + два перекрещенных «языка» пламени вдоль ствола
const flareGeo = new THREE.PlaneGeometry(0.35, 1);
function makeFlare() { const g = new THREE.Group(); for (const r of [0, Math.PI / 2]) { const h = new THREE.Group(); h.rotation.z = r; const pm = new THREE.Mesh(flareGeo, flareMat); pm.rotation.x = Math.PI / 2; pm.position.z = 0.5; pm.frustumCulled = false; h.add(pm); g.add(h); } return g; }
const flashPool = []; for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(flashMat); s.visible = false; scene.add(s); const fl = makeFlare(); fl.visible = false; scene.add(fl); flashPool.push({ s, fl, t: 0 }); }
let flashIdx = 0;
const holeMat = new THREE.MeshBasicMaterial({ map: tex('hole'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const bloodMat = new THREE.MeshBasicMaterial({ map: tex('blood'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const planeGeo = new THREE.PlaneGeometry(1, 1);
const holes = [], bloods = []; let holeIdx = 0, bloodIdx = 0;
for (let i = 0; i < 200; i++) { const m = new THREE.Mesh(planeGeo, holeMat.clone()); m.visible = false; scene.add(m); holes.push(m); }
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(planeGeo, bloodMat.clone()); m.visible = false; scene.add(m); bloods.push(m); }
// следы от пуль и кровь сами исчезают: держатся 20 с (кровь 14 с), затем плавно тают
const DECAL_LIFE = { hole: [20000, 3000], blood: [14000, 3000] };
function fadeDecals(now) {
  for (const [pool, [life, fade]] of [[holes, DECAL_LIFE.hole], [bloods, DECAL_LIFE.blood]]) for (const m of pool) {
    if (!m.visible) continue;
    const age = now - m.userData.t;
    if (age > life + fade) m.visible = false; else m.material.opacity = age > life ? 1 - (age - life) / fade : 1;
  }
}
const shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a740, metalness: 1, roughness: 0.3 }), shellGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.032, 8); shellGeo.rotateX(Math.PI / 2);
const shells = []; for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(shellGeo, shellMat); m.visible = false; scene.add(m); shells.push({ m, v: new THREE.Vector3(), life: 0, b: 0 }); }
const chipGeo = new THREE.BoxGeometry(0.02, 0.012, 0.016), chipMat = new THREE.MeshLambertMaterial({ color: 0x6a645c });
const chips = []; for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(chipGeo, chipMat); m.visible = false; scene.add(m); chips.push({ m, v: new THREE.Vector3(), life: 0 }); }
let chipIdx = 0;
let shellIdx = 0;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function placeDecal(pool, idx, p, n, size) { const m = pool[idx % pool.length]; m.userData.t = performance.now(); m.material.opacity = 1; m.position.set(p.x + n.x * 0.012, p.y + n.y * 0.012, p.z + n.z * 0.012); _v.copy(m.position).add(n); m.lookAt(_v); m.rotateZ(Math.random() * 6); m.scale.setScalar(size); m.visible = true; }
function ejectShell(pos, yaw) { const s = shells[shellIdx++ % shells.length]; s.m.position.copy(pos); s.m.visible = true; s.life = 0; s.b = 0; const r = yaw + Math.PI / 2; s.v.set(Math.cos(r) * 2.0 + (Math.random() - 0.5) * 0.6, 1.8 + Math.random() * 0.8, Math.sin(r) * 2.0 + (Math.random() - 0.5) * 0.6); s.m.rotation.set(Math.random() * 6, Math.random() * 6, 0); }
function muzzleFlash(pos, big, own, dir) {
  const f = flashPool[flashIdx++ % flashPool.length]; f.s.position.copy(pos); f.s.scale.setScalar(0.3 * big * (0.8 + Math.random() * 0.4)); f.s.material.rotation = Math.random() * 6; f.s.visible = true; f.t = performance.now();
  if (dir) { f.fl.position.copy(pos); f.fl.lookAt(_v2.copy(pos).add(dir)); f.fl.rotateZ(Math.random() * 3); f.fl.scale.set(0.5 * big, 0.5 * big, 0.55 * big * (0.8 + Math.random() * 0.5)); f.fl.visible = true; }
  const L = own ? flashLight : flashLight2; L.position.copy(pos); L.intensity = 9 * big; L.userData.t = performance.now();
  for (let i = 0; i < 3; i++) pNorm.add({ x: pos.x, y: pos.y, z: pos.z, vx: (dir ? dir.x * 0.6 : 0) + (Math.random() - 0.5) * 0.4, vy: 0.25 + Math.random() * 0.3, vz: (dir ? dir.z * 0.6 : 0) + (Math.random() - 0.5) * 0.4, max: 0.9 + Math.random() * 0.5, s: 0.1, grow: 0.7, c: COL.smoke, a: 0.16, drag: 0.94 });
}
// нормаль поверхности в точке попадания: у непрямоугольных объектов — по их точной форме
function surfNormal(end, q) {
  const n = S.hitNormal(MAPS[worldIdx], end.x / U, end.z / U, end.y / U);
  return n ? new THREE.Vector3(n[0], n[2], n[1]) : new THREE.Vector3(q[0], q[2], q[1]);
}
function impactWall(p, n) {
  placeDecal(holes, holeIdx++, p, n, 0.07 + Math.random() * 0.04);
  for (let i = 0; i < 10; i++) pAdd.add({ x: p.x, y: p.y, z: p.z, vx: n.x * 2.5 + (Math.random() - 0.5) * 5, vy: n.y * 2.5 + Math.random() * 3.5, vz: n.z * 2.5 + (Math.random() - 0.5) * 5, max: 0.12 + Math.random() * 0.25, s: 0.03 + Math.random() * 0.02, c: COL.spark, g: 9, drag: 0.95 });
  pAdd.add({ x: p.x + n.x * 0.02, y: p.y + n.y * 0.02, z: p.z + n.z * 0.02, max: 0.07, s: 0.25, c: COL.spark, a: 0.9 });
  for (let i = 0; i < 5; i++) pNorm.add({ x: p.x, y: p.y, z: p.z, vx: n.x * 1.1 + (Math.random() - 0.5) * 0.6, vy: n.y * 1.1 + Math.random() * 0.5, vz: n.z * 1.1 + (Math.random() - 0.5) * 0.6, max: 0.7 + Math.random() * 0.6, s: 0.12, grow: 0.6, c: COL.dust, a: 0.5, drag: 0.9 });
  for (let i = 0; i < 3; i++) { const c = chips[chipIdx++ % chips.length]; c.m.position.copy(p).addScaledVector(n, 0.02); c.m.visible = true; c.life = 0; c.v.set(n.x * 2 + (Math.random() - 0.5) * 2, n.y * 2 + Math.random() * 2.5, n.z * 2 + (Math.random() - 0.5) * 2); }
}
function impactBody(p, dir, big) {
  for (let i = 0; i < (big ? 22 : 12); i++) pNorm.add({ x: p.x, y: p.y, z: p.z, vx: dir.x * 2.2 + (Math.random() - 0.5) * 2, vy: Math.random() * 1.6, vz: dir.z * 2.2 + (Math.random() - 0.5) * 2, max: 0.5 + Math.random() * 0.35, s: 0.04 + Math.random() * 0.05, c: COL.blood, g: 9, a: 0.95, drag: 0.97 });
  pNorm.add({ x: p.x, y: p.y, z: p.z, vx: dir.x * 0.6, vy: 0.2, vz: dir.z * 0.6, max: 0.35, s: 0.18, grow: 0.8, c: COL.blood, a: 0.5, drag: 0.9 });
  const map = MAPS[worldIdx], L = Math.hypot(dir.x, dir.z) || 1;
  // брызги на стену позади цели
  const d3 = new THREE.Vector3(dir.x / L, -0.45, dir.z / L).normalize();
  const hit = S.ray3(map, p.x / U, p.z / U, p.y / U, d3.x, d3.z, d3.y, 110);
  if (hit.n && hit.t < 110) {
    const k = hit.t * U, hp = new THREE.Vector3(p.x + d3.x * k, p.y + d3.y * k, p.z + d3.z * k);
    const nn = S.hitNormal(map, hp.x / U, hp.z / U, hp.y / U) || hit.n;
    placeDecal(bloods, bloodIdx++, hp, new THREE.Vector3(nn[0], nn[2], nn[1]), 0.35 + Math.random() * 0.45);
  }
  // капли на земле рядом
  const g = S.ray3(map, p.x / U + dir.x / L * 8, p.z / U + dir.z / L * 8, p.y / U, 0, 0, -1, 200);
  if (g.n && g.n[2] > 0.7) placeDecal(bloods, bloodIdx++, new THREE.Vector3(p.x + dir.x / L * 8 * U, p.y - g.t * U, p.z + dir.z / L * 8 * U), new THREE.Vector3(0, 1, 0), 0.25 + Math.random() * 0.3);
}
// лужа крови под убитым (исчезает вместе с остальными следами)
function bloodPool(px, py, pz) {
  const g = S.ray3(MAPS[worldIdx], px, py, pz + 20, 0, 0, -1, 200);
  if (!g.n || g.n[2] < 0.7) return;
  for (let i = 0; i < 2; i++) placeDecal(bloods, bloodIdx++, new THREE.Vector3((px + (Math.random() - 0.5) * 10) * U, (pz + 20 - g.t) * U, (py + (Math.random() - 0.5) * 10) * U), new THREE.Vector3(0, 1, 0), 0.9 + Math.random() * 0.5);
}

// =====================================================================
// Мир, игра
// =====================================================================
let world = null, worldIdx = -1;
function setWorld(i, force) {
  if (i === worldIdx && world && !force) return;
  if (world) { scene.remove(world.root); world.root.traverse((o) => { if (o.isMesh || o.isPoints) { if (o.geometry && o.geometry !== unitBox && o.geometry !== planeGeo) o.geometry.dispose(); } }); }
  for (const o of others.values()) scene.remove(o.model); others.clear();
  for (const m of holes) m.visible = false; for (const m of bloods) m.visible = false;
  pAdd.clear(); pNorm.clear(); tracers = []; smokes = [];
  snaps = []; pending = []; lastState = 'play';
  world = buildWorld(scene, MAPS[i], save.quality); worldIdx = i;
  camera.far = world.far; camera.updateProjectionMatrix();
}

let myId = 0, joined = false, roomInfo = null;
let snaps = [], last = null, roster = new Map();
const me = { alive: false, hp: 100, team: 0, slot: 1, prevSlot: 0, wpn: [-1, WKEY.usp, WKEY.knife], scoped: false, unscopeAt: 0, info: {}, yaw: 0, pitch: 0 };
let pred = { x: 0, y: 0, z: 0, vz: 0, og: true }, prevPred = { ...pred }, predT = 0, deathPos = null, deathT = 0, deathYaw = 0, deathPitch = 0;
let pending = [], seq = 0, renderTick = 0;
let lastState = 'play', endBonus = 0, killedBy = null;
let feed = [], floaters = [], ping = 0, hurtFlash = 0, lastHp = 100, hitMark = 0, hitHead = false;
let chatLines = [], chatOpen = false, chatTeam = false, deathKiller = null, deathInfo = new Map(), spawnAsked = false;
const rec = { p: 0, y: 0, n: 0 };
const cam = { bob: 0, land: 0, landV: 0, roll: 0, viewZ: 0, punch: 0 };
const others = new Map();

function showGame() { menu.classList.add('hidden'); hud.classList.remove('hidden'); $('status').textContent = ''; Sfx.setInGame(true); camera.fov = save.fov; camera.updateProjectionMatrix(); buildVM(true); lockPointer(); }
function showMenu() {
  menu.classList.remove('hidden'); hud.classList.add('hidden'); $('pause').classList.add('hidden'); paused = false; Sfx.setInGame(false);
  fillSelects(); moneyUI(); openTab(curTab); if (document.pointerLockElement) document.exitPointerLock();
  vm.visible = false; for (const o of others.values()) scene.remove(o.model); others.clear(); tracers = []; smokes = [];
}
$('resume').onclick = () => { paused = false; $('pause').classList.add('hidden'); enterFullscreen(); lockPointer(); };
$('toMenu').onclick = () => { joined = false; send({ t: 'leave' }); showMenu(); leaveFullscreen(); };

const curWid = () => { const w = me.wpn[me.slot]; return w != null && w >= 0 ? w : WKEY.knife; };
const curW = () => WEAPONS[curWid()];

function onSnap(m) {
  const now = performance.now();
  if (m.r) roster = new Map(m.r.map((r) => [r[0], { name: r[1], team: r[2], kills: r[3], deaths: r[4], bot: r[5], skin: r[6] }]));
  const players = new Map();
  for (const p of m.p) players.set(p[0], { id: p[0], team: p[1], x: p[2], y: p[3], z: p[4], yaw: p[5], pitch: p[6], hp: p[7], alive: p[8], bot: p[9], wid: p[10], skin: p[11], sc: p[12], mv: p[13], fin: p[14], cr: p[15] });
  snaps.push({ t: now, tk: m.tk, players }); if (snaps.length > 30) snaps.shift();
  const prevInfo = me.info || {};
  last = m; me.info = m.me;
  if (m.me.wpn) me.wpn = m.me.wpn;
  if (m.me.rl > 0 && !(prevInfo.rl > 0)) { Sfx.reloadStart(); me.scoped = false; pendShots = []; reloadTotal = m.me.rl; anim = null; }
  if (!(m.me.rl > 0) && prevInfo.rl > 0 && m.me.ammo > (prevInfo.ammo ?? 0)) Sfx.reloadEnd();
  const sp = players.get(myId);
  if (sp) {
    me.team = sp.team; me.hp = sp.hp;
    if (sp.hp < lastHp && sp.alive) hurtFlash = 1;
    lastHp = sp.hp;
    if (!sp.alive) {
      if (me.alive) { deathPos = { x: pred.x, y: pred.y, z: pred.z }; deathT = now; deathYaw = me.yaw; deathPitch = me.pitch; spawnAsked = false; rec.p = rec.y = 0; rec.n = 0; onDeath(); }
      me.alive = false; pending = []; me.scoped = false;
    } else {
      const wasDead = !me.alive;
      me.alive = true;
      if (wasDead) { me.slot = m.me.slot; me.scoped = false; killedBy = null; pendShots = []; me.yaw = sp.yaw; me.pitch = 0; rec.p = rec.y = 0; rec.n = 0; buildVM(true); playAnim('draw', 500); hideDeath(); }
      pending = pending.filter((i) => i.s > m.me.seq);
      const st = { x: m.me.x, y: m.me.y, z: m.me.z, vx: m.me.vx, vy: m.me.vy, vz: m.me.vz, og: !!m.me.og, cr: !!m.me.cr };
      for (const i of pending) S.step(MAPS[worldIdx], st, i.k, i.a, i.fl, S.speedOf(i.wid, i.z), C.DT);
      if (wasDead || Math.hypot(st.x - pred.x, st.y - pred.y) > 60 || Math.abs(st.z - pred.z) > 40) prevPred = { ...st };
      pred = st;
    }
  }
  for (const s of m.sh) onShot(s, now);
  for (const ev of m.ev) {
    if (ev.t === 'kill') {
      feed.push({ kill: ev, t: now });
      if (ev.k === myId && ev.v !== myId) { const r = WEAPONS[ev.w].reward; addMoney(r); floaters.push({ s: `+$${r}  ${ev.vn}${ev.hs ? '  · ХЕДШОТ' : ''}`, t: now }); Sfx.killDing(); }
      if (ev.v === myId) { killedBy = { name: ev.kn, w: WEAPONS[ev.w].name, hs: ev.hs, self: ev.k === myId }; deathKiller = ev.k !== myId ? { x: ev.kx, y: ev.ky } : null; }
      const vp = players.get(ev.v); if (vp) { deathInfo.set(ev.v, { a: Math.atan2(vp.y - ev.ky, vp.x - ev.kx), hs: ev.hs, t: now }); const a = Math.atan2(vp.y - ev.ky, vp.x - ev.kx); setTimeout(() => bloodPool(vp.x + Math.cos(a) * 30, vp.y + Math.sin(a) * 30, vp.z), 700); }
    } else if (ev.t === 'msg') feed.push({ s: ev.s, c: '#cfd5dd', t: now });
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
  if (flag === 3) { impactBody(end, new THREE.Vector3(0, 0, 1), true); if (mine) { hitMark = now; hitHead = !!hs; Sfx.hit(); } return; }
  const ldx = x1 - pred.x, ldy = y1 - pred.y, ld = Math.hypot(ldx, ldy);
  const pan = ld > 1 ? Math.sin(Math.atan2(ldy, ldx) - me.yaw) : 0;
  if (w.cat === 'knife') {
    if (!mine) Sfx.whoosh(ld, pan, first === 2);
    if (flag === 1) { impactBody(end, new THREE.Vector3(x2 - x1, 0, y2 - y1).normalize(), false); if (mine) { hitMark = now; Sfx.hit(); } }
    return;
  }
  let start;
  if (mine) start = ownMuzzleWorld();
  else {
    const o = others.get(sid);
    if (o && o.model) { o.model.updateMatrixWorld(true); const g = o.model.userData.gun; start = g.localToWorld(g.userData.muzzle.clone()); }
    else start = new THREE.Vector3(x1 * U, z1 * U, y1 * U);
    if (first) { Sfx.shot(wid, ld, pan); if (!w.sil) muzzleFlash(start, w.key === 'awp' ? 1.6 : w.cat === 'shotgun' ? 1.4 : 1, false, _v.set(x2 - x1, z2 - z1, y2 - y1).normalize().clone()); ejectShell(start, Math.atan2(y2 - y1, x2 - x1)); }
  }
  if (mine && first) pendShots.shift();
  const dir = end.clone().sub(start); const len = dir.length(); if (len < 0.01) return; dir.normalize();
  tracers.push({ start, dir, len, t: now, flag, nn, end, wid, mine, hs });
  if (w.key === 'awp') smokes.push({ start, end, t: now });
}
function ownMuzzleWorld() { _v.set(0.12, -0.09, -0.6).applyQuaternion(camera.quaternion).add(camera.position); return _v.clone(); }

// =====================================================================
// Ввод
// =====================================================================
const KEYMAP = { KeyW: 1, ArrowUp: 1, KeyS: 2, ArrowDown: 2, KeyA: 4, ArrowLeft: 4, KeyD: 8, ArrowRight: 8 };
const keys = {}; let mouseDown = false, rmbDown = false, clickLatch = false, edgeAt = 0, reloadReq = false, jumpLatch = false, showBoard = false, paused = false, locked = false;
let swayX = 0, swayY = 0;
// Полный экран + Keyboard Lock: только так браузер отдаёт игре Ctrl+W, Ctrl+S и т.п.
const LOCK_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyC', 'KeyT', 'KeyN', 'Tab', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'Digit1', 'Digit2', 'Digit3'];
let keysLocked = false;
function enterFullscreen() {
  if (!save.fullscreen || document.fullscreenElement || !document.documentElement.requestFullscreen) { lockKeys(); return; }
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(lockKeys).catch(() => {});
}
function lockKeys() {
  if (!document.fullscreenElement || !navigator.keyboard || !navigator.keyboard.lock) return;
  navigator.keyboard.lock(LOCK_KEYS).then(() => { keysLocked = true; }).catch(() => { keysLocked = false; });
}
function leaveFullscreen() {
  try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch {}
  keysLocked = false;
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) keysLocked = false; else lockKeys(); });
let ctrlWarnAt = 0;
function lockPointer() { try { const p = glc.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === glc;
  if (!locked && joined && !paused && me.alive && !chatOpen) { paused = true; mouseDown = false; $('pause').classList.remove('hidden'); fillSelects(); }
});
glc.addEventListener('click', () => { if (joined && !locked && !paused && me.alive) { enterFullscreen(); lockPointer(); } });

// ----- экран смерти: выбор оружия и возрождение
let dsPrimary = null, dsPistol = null;
function onDeath() {
  mouseDown = false; rmbDown = false; paused = false; $('pause').classList.add('hidden');
  if (chatOpen) closeChat();
  if (document.pointerLockElement) document.exitPointerLock();
  dsPrimary = save.primary; dsPistol = save.pistol;
  setTimeout(() => { if (joined && !me.alive) showDeath(); }, 700);
}
function showDeath() {
  if (last && last.st !== 'play') return;
  const el = $('death'); el.classList.remove('hidden');
  $('dsKiller').innerHTML = killedBy ? (killedBy.self ? 'Ты погиб' : `Тебя убил <b>${esc(killedBy.name)}</b> · ${esc(killedBy.w)}${killedBy.hs ? ' · <span style="color:#ff6b6b">в голову</span>' : ''}`) : '';
  const row = (slot) => WEAPONS.filter((w) => w.slot === slot && save.ownedW.includes(w.key)).map((w) => { const on = (slot === 0 ? dsPrimary : dsPistol) === w.key; return `<button class="dw${on ? ' on' : ''}" data-k="${w.key}" data-s="${slot}"><img src="${gunImage(w.id, eqFid(w.id))}" alt=""><span>${w.name}</span></button>`; }).join('');
  $('dsPrim').innerHTML = `<button class="dw${!dsPrimary ? ' on' : ''}" data-k="" data-s="0"><span style="padding:22px 0">Без основного</span></button>` + row(0);
  $('dsPist').innerHTML = row(1);
  el.querySelectorAll('.dw').forEach((b) => b.onclick = () => { Sfx.uiClick(); if (+b.dataset.s === 0) dsPrimary = b.dataset.k || null; else dsPistol = b.dataset.k; showDeath(); });
}
function hideDeath() { $('death').classList.add('hidden'); }
function requestSpawn() {
  if (!joined || me.alive || spawnAsked || (me.info.ri || 0) > 0) return;
  save.primary = dsPrimary; save.pistol = dsPistol || save.pistol; persist(); fillSelects();
  send({ t: 'spawn', lo: loadout(), fin: finMap() }); spawnAsked = true;
  enterFullscreen(); lockPointer();
}
$('dsGo').onclick = () => { Sfx.uiClick(); requestSpawn(); };

// ----- чат
function openChat(team) { if (!joined) return; chatOpen = true; chatTeam = team; const i = $('chatIn'); $('chatBox').classList.remove('hidden'); $('chatTo').textContent = team ? 'КОМАНДЕ' : 'ВСЕМ'; $('chatTo').className = team ? 'team' : ''; i.value = ''; setTimeout(() => i.focus(), 0); for (const k in keys) keys[k] = false; mouseDown = false; }
function closeChat() { chatOpen = false; $('chatBox').classList.add('hidden'); $('chatIn').blur(); }
$('chatIn').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { const t = $('chatIn').value.trim(); if (t) send({ t: 'chat', text: t, team: chatTeam }); closeChat(); e.preventDefault(); }
  else if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
});
function selectSlot(s) {
  if (s === me.slot) return;
  const w = me.wpn[s]; if (w == null || w < 0) return;
  me.prevSlot = me.slot; me.slot = s; me.scoped = false; pendShots = []; localSwitchUntil = performance.now() + 350; Sfx.deploy(); buildVM(); playAnim('draw', WEAPONS[w].cat === 'knife' ? knifeT(0) : 450); if (WEAPONS[w].cat === 'knife') Sfx.flick();
}
addEventListener('keydown', (e) => {
  if (!joined || chatOpen) return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard = true; }
  if (paused) return;
  if ((e.code === 'KeyY' || e.code === 'KeyU') && !e.repeat) { e.preventDefault(); openChat(e.code === 'KeyU'); return; }
  if (!me.alive) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); requestSpawn(); } return; }
  if (e.code === 'KeyR') reloadReq = true;
  if (e.code === 'Space') { jumpLatch = true; e.preventDefault(); }
  if (e.code === 'Digit1') selectSlot(0);
  if (e.code === 'Digit2') selectSlot(1);
  if (e.code === 'Digit3') selectSlot(2);
  if (e.code === 'KeyQ') selectSlot(me.prevSlot);
  if (e.code === 'KeyM') Sfx.toggleMusic();
  if (e.code === 'KeyF') startInspect();
  if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'ShiftLeft') e.preventDefault();
  if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !keysLocked) ctrlWarnAt = performance.now();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') { e.preventDefault(); showBoard = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; rmbDown = false; });
addEventListener('beforeunload', (e) => { if (joined && !keysLocked) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('mousemove', (e) => {
  if (!joined || paused || !locked || !me.alive) return;
  const zoomK = camera.fov / save.fov, k = 0.0007 + save.sens * 0.0042;
  me.yaw += e.movementX * k * zoomK; me.pitch -= e.movementY * k * zoomK;
  me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch));
  swayX += e.movementX * 0.0004; swayY += e.movementY * 0.0004;
});
glc.addEventListener('mousedown', (e) => {
  if (!joined || paused) return;
  if (e.button === 0) { mouseDown = true; clickLatch = true; edgeAt = performance.now(); }
  if (e.button === 2) { rmbDown = true; if (curW().scope && me.alive && !(me.info.rl > 0)) { me.scoped = !me.scoped; me.unscopeAt = 0; Sfx.uiClick(); } }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmbDown = false; });
glc.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (!joined || paused) return;
  let i = me.slot;
  for (let n = 0; n < 3; n++) { i = (i + (e.deltaY > 0 ? 1 : 2)) % 3; const w = me.wpn[i]; if (w != null && w >= 0) { selectSlot(i); break; } }
}, { passive: true });

let moving = false, spdFrac = 0, quiet = false, stepAcc = 0;
setInterval(() => {
  if (!joined || !wsReady) return;
  let k = 0; if (!paused) for (const c in KEYMAP) if (keys[c]) k |= KEYMAP[c];
  const playing = last && last.st === 'play';
  const f = !paused && playing && (mouseDown || clickLatch) ? 1 : 0;
  clickLatch = false;
  if (me.unscopeAt && performance.now() >= me.unscopeAt) { me.scoped = false; me.unscopeAt = 0; }
  const crouch = !paused && (keys.ControlLeft || keys.ControlRight || keys.KeyC) ? 1 : 0, walk = !paused && keys.ShiftLeft ? 1 : 0;
  const heavy = !paused && playing && rmbDown && curW().cat === 'knife' ? 1 : 0;
  const aimP = Math.max(-1.55, Math.min(1.55, me.pitch + rec.p));
  const inp = { t: 'in', s: ++seq, k: playing && !chatOpen ? k : 0, a: Math.round((me.yaw + rec.y) * 1000) / 1000, p: Math.round(aimP * 1000) / 1000, f, h: heavy, r: reloadReq ? 1 : 0, w: me.slot, z: me.scoped ? 1 : 0, j: jumpLatch && playing ? 1 : 0, c: crouch, wk: walk, rt: Math.round(renderTick * 10) / 10 };
  reloadReq = false; jumpLatch = false;
  send(inp);
  if (me.alive && playing) {
    inp.wid = curWid(); pending.push(inp);
    prevPred = { ...pred }; predT = performance.now();
    const wasOg = pred.og;
    inp.fl = (inp.j ? 1 : 0) | (inp.c ? 2 : 0) | (inp.wk ? 4 : 0);
    spdFrac = S.step(MAPS[worldIdx], pred, inp.k, inp.a, inp.fl, S.speedOf(inp.wid, inp.z), C.DT);
    moving = spdFrac > 0.3; quiet = !!(inp.wk || pred.cr);
    if (pred.og && spdFrac > 0.6 && !quiet) { stepAcc += spdFrac * C.DT; if (stepAcc > 0.34) { stepAcc = 0; Sfx.step(0.8); } }
    if (inp.j && wasOg && !pred.og) Sfx.step(1.2);
    if (!wasOg && pred.og) { Sfx.step(1.5); const v = -(pred.land || 0); cam.landV -= Math.min(1, v / 700) * 1.6; pred.land = 0; }
  } else moving = false;
}, 1000 / C.TICK);

let localLast = 0, localHeavy = 0, localSwitchUntil = 0, pendShots = [], dryAt = 0, spray = 0, reloadTotal = 1, kick = 0, slashSide = 0;
function localAmmo() { const now = performance.now(); pendShots = pendShots.filter((t) => now - t < 500); return Math.max(0, (me.info.ammo ?? 0) - pendShots.length); }
function localFire(now) {
  if (!me.alive || paused || !last || last.st !== 'play') return;
  const w = curW();
  const want = w.auto ? mouseDown : now - edgeAt < 220;
  if (w.cat === 'knife' && rmbDown && now >= localSwitchUntil && now - localLast >= 1000 && now - localHeavy >= 1000) { localHeavy = now; localLast = now; playAnim('stab', 650); Sfx.whoosh(0, 0, true); return; }
  if (!want || now < localSwitchUntil || me.info.rl > 0 || now - localLast < w.fire) return;
  if (w.cat !== 'knife' && localAmmo() <= 0) { if (now - dryAt > 300) { Sfx.dry(); dryAt = now; } edgeAt = 0; return; }
  localLast = now; edgeAt = 0;
  if (w.cat === 'knife') { slashSide = 1 - slashSide; playAnim(slashSide ? 'slashA' : 'slashB', 320); Sfx.whoosh(0, 0, false); return; }
  Sfx.shot(w.id, 0, 0);
  if (w.cat === 'pistol' || w.cat === 'dual') playAnim('slide', 120);
  else if (w.cat === 'sniper') { playAnim('bolt', 900); setTimeout(() => Sfx.bolt(), 250); }
  else if (w.cat === 'shotgun' && !w.auto) { playAnim('pump', 700); setTimeout(() => Sfx.reloadStart(), 250); }
  pendShots.push(now);
  const big = w.key === 'awp' ? 1.6 : w.cat === 'shotgun' ? 1.4 : w.cat === 'pistol' ? 0.8 : 1;
  if (!(me.scoped && w.scope === 2) && !w.sil) { vmFlash.visible = true; vmFlash.userData.t = now; vmFlash.material.rotation = Math.random() * 6; vmFlash.scale.setScalar(0.2 * big * (0.8 + Math.random() * 0.4)); vmFlare.visible = true; vmFlare.rotation.z = Math.random() * 3; vmFlare.scale.set(0.16 * big, 0.16 * big, 0.2 * big * (0.7 + Math.random() * 0.6)); vmFlashLight.intensity = 4; }
  else if (w.sil && !(me.scoped && w.scope === 2)) { for (let k = 0; k < 2; k++) pNorm.add({ x: ownMuzzleWorld().x, y: ownMuzzleWorld().y, z: ownMuzzleWorld().z, vx: (Math.random() - 0.5) * 0.3, vy: 0.3, vz: (Math.random() - 0.5) * 0.3, max: 0.8, s: 0.05, grow: 0.3, c: COL.smoke, a: 0.12, drag: 0.94 }); }
  flashLight.position.copy(ownMuzzleWorld()); flashLight.intensity = 5 * big; flashLight.userData.t = now;
  ejectShell(ownMuzzleWorld(), me.yaw);
  kick = Math.min(1, kick + (w.key === 'awp' ? 1 : w.cat === 'shotgun' ? 0.8 : w.cat === 'sniper' ? 0.7 : w.cat === 'pistol' ? 0.35 : 0.25) * (me.scoped && w.scope === 1 ? 0.5 : 1));
  // отдача: прицел подбрасывает по узору, пуля летит туда, куда смотрит прицел
  const i = rec.n++, PAT = [0, 0.1, 0.3, 0.6, 0.85, 0.7, 0.2, -0.4, -0.9, -1.25, -1.1, -0.5, 0.3, 1.0, 1.35, 1.15, 0.5, -0.3, -1.0, -1.3];
  const vk = (i < 1 ? 0.55 : i < 9 ? 1 : 0.3) * (me.scoped && w.scope === 1 ? 0.8 : 1) * (pred.cr ? 0.85 : 1);
  rec.p = Math.min(0.16, rec.p + w.kick * vk * (0.92 + Math.random() * 0.16));
  rec.y += w.kickH * (PAT[i % PAT.length] - (i ? PAT[(i - 1) % PAT.length] : 0)) + (Math.random() - 0.5) * w.kickH * 0.3;
  cam.punch = Math.min(0.05, cam.punch + w.kick * 0.5);
  if (w.scope === 2) me.unscopeAt = now + 160; // держим прицел, пока выстрел не ушёл на сервер
}

// =====================================================================
// Оружие в руках и анимации
// =====================================================================
const vm = new THREE.Group(); vm.scale.setScalar(0.62); vm.visible = false; vmScene.add(vm);
const vmPivot = new THREE.Group(); vm.add(vmPivot);
const vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); vmFlash.visible = false;
let vmKey = '', vmGun = null, anim = null;
function playAnim(type, dur) { anim = { type, t0: performance.now(), dur }; }
const KNIFE_T = { butterfly: [950, 2700], flip: [700, 2200], karambit: [750, 2300], katana: [800, 2400], machete: [750, 2300] };
function knifeT(i) { const k = vmGun && vmGun.userData.knife; return (KNIFE_T[k] || [700, 2200])[i]; }
function startInspect() { if (!joined || !me.alive || me.scoped || (me.info && me.info.rl > 0)) return; const w = curW(); playAnim('inspect', w.cat === 'knife' ? knifeT(1) : 2300); Sfx.inspect(); }
const vmFlare = makeFlare(); vmFlare.visible = false;
function buildVM(force) {
  const wid = curWid(), fid = eqFid(wid), gl = eqGlove(), key = wid + '_' + fid + '_' + save.skin + '_' + gl;
  if (!force && key === vmKey && vmGun) return;
  vmKey = key; vmPivot.clear();
  const s = SKINS[SKEY[save.skin] ?? 0], w = WEAPONS[wid];
  vmGun = makeGun(wid, fid, true); vmPivot.add(vmGun);
  vmPivot.add(makeVMHands(w, vmGun, s, gl));
  if (w.cat !== 'knife') {
    vmFlash.position.copy(vmGun.userData.muzzle).add(new THREE.Vector3(0, 0, -0.03)); vmGun.add(vmFlash);
    vmFlare.position.copy(vmGun.userData.muzzle); vmFlare.rotation.set(0, Math.PI, 0); vmGun.add(vmFlare);
  }
  vmPivot.traverse((o) => { o.frustumCulled = false; });
  vmGun.userData.homeP = vmGun.position.clone(); vmGun.userData.homeQ = vmGun.quaternion.clone();
}
// ---- Анимации ножей: вращение модели вокруг точки (кольцо карамбита, рукоять, ось клинка) ----
const _ax = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }, _kq = new THREE.Quaternion(), _kv = new THREE.Vector3();
function spinKnife(g, px, py, pz, axis, ang) {
  const u = g.userData; _kq.setFromAxisAngle(_ax[axis], ang);
  g.quaternion.copy(u.homeQ).multiply(_kq);
  _kv.set(px, py, pz).applyQuaternion(_kq).negate().add(new THREE.Vector3(px, py, pz)).multiply(g.scale).applyQuaternion(u.homeQ);
  g.position.copy(u.homeP).add(_kv);
}
const clamp01 = (t) => Math.max(0, Math.min(1, t)), seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3), easeIn = (t) => t * t * t;
// пружинящий доводчик: чуть перелетает и возвращается
const springT = (t) => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12;
function knifeAnim(type, p, u, g, o) {
  const k = u.knife, bp = u.bladePivot, h2 = u.handle2;
  if (type === 'draw') {
    const rise = easeOut(seg(p, 0, 0.45));
    o.y -= (1 - rise) * 0.16; o.rx -= (1 - rise) * 0.7;
    if (k === 'butterfly') {
      // закрытый нож → откидываем «кусачую» ручку → переворачиваем клинок вместе с ней
      const a = ease(seg(p, 0.12, 0.45)), b = springT(seg(p, 0.45, 0.85));
      if (bp) bp.rotation.x = Math.PI + Math.PI * b;
      if (h2) h2.rotation.x = Math.PI * a + Math.PI * b;
      o.rz += Math.sin(seg(p, 0.1, 0.9) * Math.PI * 2) * 0.35; o.ry += bump(seg(p, 0.4, 0.95)) * 0.25;
    } else if (k === 'flip') {
      if (bp) bp.rotation.x = -Math.PI * (1 - springT(seg(p, 0.2, 0.6)));
      o.rx += bump(seg(p, 0.15, 0.55)) * 0.35;
    } else if (k === 'karambit') {
      spinKnife(g, 0, -0.004, 0.11, 'x', -Math.PI * 2 * easeOut(seg(p, 0.05, 0.85)));
    } else if (k === 'katana' || k === 'machete') {
      const e = easeOut(seg(p, 0, 0.9)); o.ry -= (1 - e) * 1.1; o.rz += (1 - e) * 0.6; o.x += (1 - e) * 0.06;
    } else {
      // подброс ножа: один оборот вокруг рукояти и ловля
      const t = seg(p, 0.05, 0.8); spinKnife(g, 0, 0, 0.045, 'x', -Math.PI * 2 * ease(t)); o.y += bump(t) * 0.05;
    }
    return;
  }
  // inspect
  if (k === 'butterfly') {
    // закрыть (клинок с ручкой назад, затем ручку), повертеть закрытый нож, снова открыть
    const c1 = ease(seg(p, 0.08, 0.3)), c2 = ease(seg(p, 0.3, 0.45)), o1 = ease(seg(p, 0.6, 0.72)), o2 = springT(seg(p, 0.72, 0.88));
    let th = -Math.PI * c1 + Math.PI * o2, hb = -Math.PI * c1 - Math.PI * c2 + Math.PI * o1 + Math.PI * o2;
    if (bp) bp.rotation.x = th; if (h2) h2.rotation.x = hb;
    const show = bump(seg(p, 0.42, 0.66)); o.ry += show * 0.4; o.rz -= show * 0.3; o.rx += show * 0.15;
    o.rz += Math.sin(seg(p, 0.05, 0.5) * Math.PI * 2) * 0.25 + Math.sin(seg(p, 0.58, 0.95) * Math.PI * 2) * 0.3;
    o.ry += bump(seg(p, 0.85, 1)) * 0.3;
  } else if (k === 'flip') {
    const close = ease(seg(p, 0.08, 0.3)), open = springT(seg(p, 0.55, 0.68));
    if (bp) bp.rotation.x = -Math.PI * 0.97 * (close - open);
    const sh = bump(seg(p, 0.25, 0.55)); o.ry += sh * 0.8; o.rz += sh * 0.4;
    const ad = bump(seg(p, 0.66, 1)); o.ry += ad * 1.0; o.rz -= ad * 0.35; o.x -= ad * 0.04; o.y += ad * 0.02;
  } else if (k === 'karambit') {
    spinKnife(g, 0, -0.004, 0.11, 'x', -Math.PI * 4 * ease(seg(p, 0.08, 0.45)));
    const ad = bump(seg(p, 0.45, 1)); o.ry += ad * 1.0; o.rz += ad * 0.5; o.x -= ad * 0.04; o.rx -= bump(seg(p, 0.05, 0.5)) * 0.25;
  } else if (k === 'katana' || k === 'machete') {
    const a = bump(seg(p, 0, 0.55)), b = bump(seg(p, 0.45, 1));
    o.ry += a * 0.9; o.rz += a * 0.5; o.x -= a * 0.05; o.y += a * 0.03;
    spinKnife(g, 0, 0, 0.045, 'z', Math.PI * ease(seg(p, 0.35, 0.6)) - Math.PI * ease(seg(p, 0.75, 0.95)));
    o.rx -= b * 0.35; o.ry -= b * 0.25;
  } else {
    // поворот к себе, прокрутка вокруг оси клинка, переброс и возврат
    const a = bump(seg(p, 0, 0.5)), b = bump(seg(p, 0.5, 1));
    o.ry += a * 1.0; o.rz += a * 0.45; o.x -= a * 0.045; o.y += a * 0.02;
    if (p <= 0.55) spinKnife(g, 0, 0, 0.045, 'z', Math.PI * 2 * ease(seg(p, 0.3, 0.55)));
    else spinKnife(g, 0, 0, 0.045, 'x', -Math.PI * 2 * ease(seg(p, 0.6, 0.85)));
    o.rx -= b * 0.3; o.ry -= b * 0.4; o.rz -= b * 0.3; o.y += bump(seg(p, 0.6, 0.85)) * 0.05;
  }
}
const VM_BASE = { pistol: [0.085, -0.07, -0.42, 0.04], dual: [0.0, -0.07, -0.42, 0], knife: [0.13, -0.12, -0.3, 0], smg: [0.125, -0.095, -0.27, 0.1], rifle: [0.13, -0.098, -0.25, 0.11], shotgun: [0.13, -0.095, -0.24, 0.11], sniper: [0.13, -0.095, -0.24, 0.1], mg: [0.135, -0.1, -0.25, 0.11] };
const KNIFE_ROT = [1.2, 0.18, -0.12]; // нож стоит вертикально: клинок вверх, лёгкий наклон к центру
const KS = [1.1]; // масштаб ножа в руке
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const bump = (t) => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
let vmPhase = 0, adsK = 0;
function updateVM(now, dt) {
  const w = curW(), info = me.info || {}, u = vmGun ? vmGun.userData : {};
  vm.visible = joined && me.alive && !(me.scoped && w.scope === 2);
  const ads = me.scoped && w.scope === 1 && !(info.rl > 0);
  adsK += ((ads ? 1 : 0) - adsK) * Math.min(1, dt * 14);
  if (u.dot) u.dot.visible = adsK > 0.6;
  if (!vm.visible || !vmGun) return;
  const knife = w.cat === 'knife';
  const b = VM_BASE[w.cat];
  const sp = moving && pred.og ? spdFrac : 0;
  vmPhase += dt * (quiet ? 6 : 9) * sp;
  swayX *= 0.85; swayY *= 0.85; kick *= Math.pow(0.0008, dt);
  let x = b[0] + Math.sin(vmPhase) * 0.012 * sp * (1 - adsK) - swayX, y = b[1] - Math.abs(Math.cos(vmPhase)) * 0.01 * sp * (1 - adsK) + swayY - (pred.cr ? 0.01 : 0), z = b[2] + kick * 0.07;
  let rx = kick * 0.18, ry = (b[3] || 0) * (1 - adsK), rz = cam.roll * 1.6;
  y += cam.land * 0.25;
  const longK = u.knife === 'katana' || u.knife === 'machete';
  vmPivot.scale.setScalar(knife ? KS[0] * (u.knife === 'katana' ? 0.8 : u.knife === 'machete' ? 0.9 : 1) : 1);
  if (knife) { rx += KNIFE_ROT[0]; ry += KNIFE_ROT[1]; rz += KNIFE_ROT[2]; if (longK) { x += 0.02; y -= 0.03; } }
  // сброс подвижных частей
  if (u.mag) u.mag.position.copy(u.magHome);
  if (u.slide) { u.slide.position.copy(u.slideHome); u.slide.rotation.set(0, 0, 0); }
  if (u.bladePivot) u.bladePivot.rotation.set(0, 0, 0);
  if (u.homeP) { vmGun.position.copy(u.homeP); vmGun.quaternion.copy(u.homeQ); }
  if (u.handle2) u.handle2.rotation.set(0, 0, 0);
  // перезарядка: магазин выходит и возвращается, затвор передёргивается
  if (info.rl > 0 && !knife) {
    const p = Math.max(0, Math.min(1, 1 - info.rl / reloadTotal)), d = bump(p);
    rx -= d * 0.45; y -= d * 0.07; rz += d * 0.55; ry -= d * 0.15;
    if (u.mag) { const out = p < 0.3 ? p / 0.3 : p < 0.55 ? 1 : p < 0.8 ? 1 - (p - 0.55) / 0.25 : 0; u.mag.position.y -= out * 0.22; u.mag.position.z += out * 0.05; u.mag.rotation.x = out * 0.4; }
    if (u.slide && p > 0.82) { const q = (p - 0.82) / 0.18; u.slide.position.z += bump(q) * 0.05; }
  } else if (u.mag) u.mag.rotation.x = 0;
  // смена оружия
  if (info.sw > 0 || now < localSwitchUntil) { const s = Math.max(info.sw || 0, localSwitchUntil - now) / 350; y -= s * 0.25; rx -= s * 0.6; }
  if (anim) {
    const p = (now - anim.t0) / anim.dur;
    if (p >= 1) anim = null;
    else switch (anim.type) {
      case 'draw': case 'inspect': {
        if (knife) { const o = { x, y, z, rx, ry, rz }; knifeAnim(anim.type, p, u, vmGun, o); ({ x, y, z, rx, ry, rz } = o); break; }
        if (anim.type === 'draw') {
          const e = ease(p);
          y -= (1 - e) * 0.18; rx -= (1 - e) * 0.9;
          if (u.slide && w.cat !== 'sniper') u.slide.position.z += bump(Math.max(0, (p - 0.5) * 2)) * 0.04;
        } else {
          const e = bump(p);
          ry += e * 0.95; rz += e * 0.45; x -= e * 0.05; y += e * 0.02; rx += Math.sin(p * Math.PI * 2) * 0.12 * e;
        }
        break;
      }
      case 'slashA': case 'slashB': {
        const dir = anim.type === 'slashA' ? 1 : -1, e = Math.sin(p * Math.PI);
        ry += dir * (p * 2 - 1) * 1.2 * e + dir * 0.4 * e; rz += dir * 0.6 * e; x -= dir * 0.08 * e; z -= 0.08 * e; rx -= 0.2 * e;
        break;
      }
      case 'stab': {
        const back = p < 0.35 ? p / 0.35 : 0, fwd = p >= 0.35 ? bump((p - 0.35) / 0.65) : 0;
        z += back * 0.06 - fwd * 0.2; rx += back * 0.35 - fwd * 0.5; y += fwd * 0.03; ry -= fwd * 0.2;
        break;
      }
      case 'slide': if (u.slide) u.slide.position.z += bump(p) * 0.035; break;
      case 'pump': if (u.slide && p > 0.3) { u.slide.position.z += bump((p - 0.3) / 0.7) * 0.09; rz += bump((p - 0.3) / 0.7) * 0.15; } break;
      case 'bolt': if (p > 0.25 && u.slide) { const q = (p - 0.25) / 0.75, up = bump(Math.min(1, q * 1.4)); u.slide.rotation.z = up * 1.2; u.slide.position.z += bump(q) * 0.07; rz += up * 0.25; y -= up * 0.02; } break;
    }
  }
  if (adsK > 0.001 && u.sight) {
    const sg = u.sight, sc = vm.scale.x;
    const ax = -sg.x * sc, ay = -sg.y * sc, az = -0.2 - sg.z * sc;
    x += (ax - x) * adsK; y += (ay - y) * adsK; z += (az + kick * 0.03 - z) * adsK; rx *= 1 - adsK * 0.7; ry *= 1 - adsK; rz *= 1 - adsK;
  }
  vm.position.set(x, y, z); vm.rotation.set(rx, ry, rz);
  if (vmFlash.visible && now - vmFlash.userData.t > 45) { vmFlash.visible = false; vmFlare.visible = false; }
  vmFlashLight.intensity = Math.max(0, vmFlashLight.intensity - dt * 60);
}

// =====================================================================
// Кадр
// =====================================================================
function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
function interpPlayers(now) {
  const rt = now - 100; if (!snaps.length) return [];
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].t <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const t = b.t === a.t ? 1 : Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)));
  renderTick = a.tk + (b.tk - a.tk) * t;
  const out = [];
  for (const [id, pb] of b.players) {
    const pa = a.players.get(id) || pb; const jump = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 120;
    out.push({ ...pb, x: jump ? pb.x : pa.x + (pb.x - pa.x) * t, y: jump ? pb.y : pa.y + (pb.y - pa.y) * t, z: jump ? pb.z : pa.z + (pb.z - pa.z) * t, yaw: lerpAng(pa.yaw, pb.yaw, t), pitch: pa.pitch + (pb.pitch - pa.pitch) * t });
  }
  return out;
}

let lastFrame = performance.now(), menuAng = Math.random() * 6, chimT = 0, smokeT = 0, eyeH = C.EYE;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (!world) return;
  const inMenu = !joined;
  if (inMenu) {
    // фон меню: медленный облёт живой карты
    const map = MAPS[worldIdx];
    menuAng += dt * 0.05;
    const cx = map.pw * U / 2, cz = map.ph * U / 2;
    if (world.indoor) { const x = cx + Math.sin(menuAng * 1.7) * 14; camera.position.set(x, 3.0, 7.5 * C.TILE * U + Math.sin(menuAng * 3) * 0.5); camera.lookAt(x + 10 * Math.cos(menuAng * 1.7), 2.2, cz); }
    else if (map.theme === 'baku') { camera.position.set(cx + Math.cos(menuAng) * 30, 14, cz + Math.sin(menuAng) * 20); camera.lookAt(cx, 9, cz); }
    else { camera.position.set(cx + Math.cos(menuAng) * 34, 17, cz + Math.sin(menuAng) * 24); camera.lookAt(cx, 3, cz); }
    if (window.__debugCam) { camera.position.set(...window.__debugCam.p); camera.lookAt(...window.__debugCam.l); }
    if (Math.abs(camera.fov - 60) > 0.1) { camera.fov = 60; camera.updateProjectionMatrix(); }
    world.update(dt, camera.position);
    emitChimneys(dt);
    pAdd.update(dt); pNorm.update(dt);
    renderer.clear(); renderer.render(scene, camera);
    if (curTab === 'play' && !menu.classList.contains('hidden')) disc.material.opacity = 0.45 + Math.sin(now / 500) * 0.15;
    if (curTab === 'play' && pvChar && !menu.classList.contains('hidden')) { pvAng += dt * 0.5; pvChar.rotation.y = pvAng; pvChar.userData.upper.rotation.x = Math.sin(now / 900) * 0.12; pvR.render(pvScene, pvCam); }
    return;
  }
  if (!last) return;
  localFire(now);
  const plist = interpPlayers(now);
  const seen = new Set();
  for (const p of plist) {
    if (p.id === myId) continue;
    seen.add(p.id);
    let o = others.get(p.id);
    if (!o || o.wid !== p.wid || o.skin !== p.skin || o.team !== p.team || o.fin !== p.fin) {
      if (o) scene.remove(o.model);
      o = { model: makeCharacter(p.skin, p.team, p.wid, p.fin), wid: p.wid, skin: p.skin, team: p.team, fin: p.fin, trailT: 0, deadAt: 0 };
      scene.add(o.model); others.set(p.id, o);
    }
    if (!p.alive) { if (!o.deadAt) o.deadAt = now; } else o.deadAt = 0;
    o.model.visible = p.alive || now - o.deadAt < 6200;
    const di = deathInfo.get(p.id);
    poseCharacter(o.model, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, moving: p.mv && p.alive, mv: p.mv, cr: p.cr, alive: p.alive, fallA: di && now - di.t < 3000 ? di.a : undefined, hs: di && di.hs }, dt);
    if (p.alive && p.mv === 2) { o.stepT = (o.stepT || 0) + dt; if (o.stepT > 0.36) { o.stepT = 0; const dx = p.x - pred.x, dy = p.y - pred.y; Sfx.step3(Math.hypot(dx, dy, (p.z - pred.z) * 2), Math.sin(Math.atan2(dy, dx) - me.yaw), 1); } }
    if (p.alive && p.mv && now - o.trailT > 30) {
      o.trailT = now; const c = new THREE.Color(SKINS[p.skin]?.trail || '#ffffff');
      pAdd.add({ x: p.x * U + (Math.random() - 0.5) * 0.2, y: p.z * U + 0.08 + Math.random() * 0.1, z: p.y * U + (Math.random() - 0.5) * 0.2, vy: 0.25, max: 0.5, s: 0.32, c, a: 0.3, drag: 0.96 });
    }
  }
  for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.model); others.delete(id); }

  const w = curW();
  const a = Math.min(1, (now - predT) / (1000 / C.TICK));
  let cx, cy, cz;
  // отдача возвращается, когда не стреляешь
  if (now - localLast > Math.max(110, w.fire * 1.25)) { const k = Math.exp(-dt * 6.5); rec.p *= k; rec.y *= k; if (rec.p < (w.kick || 0.01) * 0.35) rec.n = 0; }
  cam.punch *= Math.exp(-dt * 14);
  // приземление (пружина), покачивание головы, крен при стрейфе
  cam.landV += (-cam.land * 120 - cam.landV * 14) * dt; cam.land += cam.landV * dt;
  const spd = Math.hypot(pred.vx || 0, pred.vy || 0), side = ((pred.vx || 0) * Math.cos(me.yaw + Math.PI / 2) + (pred.vy || 0) * Math.sin(me.yaw + Math.PI / 2)) / C.SPEED;
  cam.roll += (-side * 0.018 - cam.roll) * Math.min(1, dt * 8);
  if (me.alive && pred.og && spd > 20) cam.bob += dt * (6 + (spd / C.SPEED) * 5); else cam.bob += (Math.round(cam.bob / Math.PI) * Math.PI - cam.bob) * Math.min(1, dt * 6);
  const bobA = me.alive && pred.og ? Math.min(1, spd / C.SPEED) * (quiet ? 0.5 : 1) : 0;
  if (me.alive) {
    eyeH += ((pred.cr ? C.EYEC : C.EYE) - eyeH) * Math.min(1, dt * 14);
    cx = prevPred.x + (pred.x - prevPred.x) * a; cy = prevPred.y + (pred.y - prevPred.y) * a;
    const tz = prevPred.z + (pred.z - prevPred.z) * a;
    cam.viewZ = pred.og && tz > cam.viewZ && tz - cam.viewZ < 30 ? cam.viewZ + (tz - cam.viewZ) * Math.min(1, dt * 16) : tz;
    cz = cam.viewZ + eyeH + Math.abs(Math.sin(cam.bob)) * 0.6 * bobA + cam.land * 16;
    const ox = Math.cos(me.yaw + Math.PI / 2) * Math.sin(cam.bob) * 0.35 * bobA, oy = Math.sin(me.yaw + Math.PI / 2) * Math.sin(cam.bob) * 0.35 * bobA;
    cx += ox; cy += oy;
    camera.rotation.set(me.pitch + rec.p + kick * 0.02 + cam.punch, -(me.yaw + rec.y) - Math.PI / 2, cam.roll);
  } else {
    // камера падает вместе с телом, затем поворачивается к убийце
    const d = deathPos || pred, t = (now - deathT) / 1000, k = Math.min(1, Math.pow(t / 0.55, 2));
    const b = t > 0.55 && t < 0.8 ? Math.sin(((t - 0.55) / 0.25) * Math.PI) * 0.06 : 0;
    cx = d.x; cy = d.y; cz = d.z + C.EYE * (1 - k * 0.82) + b * 10;
    let yaw = deathYaw, pitch = deathPitch * (1 - k) - k * 0.15;
    if (deathKiller && t > 1.1) { const want = Math.atan2(deathKiller.y - d.y, deathKiller.x - d.x); const e = Math.min(1, (t - 1.1) / 0.8), ee = e * e * (3 - 2 * e); let dd = want - deathYaw; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; yaw = deathYaw + dd * ee; pitch = pitch * (1 - ee) + 0.12 * ee; }
    camera.rotation.set(pitch, -yaw - Math.PI / 2, k * 0.55 * (deathKiller && t > 1.1 ? 1 - Math.min(1, (t - 1.1) / 0.8) * 0.7 : 1));
  }
  camera.position.set(cx * U, cz * U, cy * U);
  const fovT = me.alive && me.scoped ? (w.key === 'awp' ? 20 : w.key === 'scout' ? 26 : save.fov * 0.68) : save.fov;
  if (Math.abs(camera.fov - fovT) > 0.1) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 18); camera.updateProjectionMatrix(); }
  spray = Math.max(0, spray - dt * 0.12);

  for (const f of flashPool) if (f.s.visible && now - f.t > 50) { f.s.visible = false; f.fl.visible = false; }
  for (const c of chips) { if (!c.m.visible) continue; c.life += dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 12; if (c.m.position.y < 0.01 && c.v.y < 0) { c.m.position.y = 0.01; c.v.multiplyScalar(0.3); c.v.y *= -0.5; } if (c.life > 2.5) c.m.visible = false; }
  emitFires(dt);
  fadeDecals(now);
  for (const L of [flashLight, flashLight2]) if (L.intensity > 0 && now - (L.userData.t || 0) > 60) L.intensity = 0;
  for (const s of shells) {
    if (!s.m.visible) continue;
    s.life += dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 15;
    const gz = S.groundAt(MAPS[worldIdx], s.m.position.x / U, s.m.position.z / U, 1, s.m.position.y / U + 2) * U + 0.01;
    if (s.m.position.y < gz) { s.m.position.y = gz;  s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
    if (s.life > 4) s.m.visible = false;
  }
  tracerPool.forEach((m) => (m.visible = false)); glowPool.forEach((m) => (m.visible = false));
  let ti = 0;
  tracers = tracers.filter((t) => {
    const trav = ((now - t.t) / 1000) * 290;
    if (trav >= t.len) {
      if (!t.done) {
        t.done = true;
        if (t.flag === 0 && NRM[t.nn]) impactWall(t.end, surfNormal(t.end, NRM[t.nn]));
        else if (t.flag === 1) { impactBody(t.end, t.dir, WEAPONS[t.wid].key === 'awp'); if (t.mine) { hitMark = now; hitHead = !!t.hs; Sfx.hit(); } }
      }
      return false;
    }
    if (ti < tracerPool.length) {
      const tail = Math.min(trav, WEAPONS[t.wid].key === 'awp' ? 6 : 3);
      const gm = glowPool[ti], m = tracerPool[ti++]; const head = _v.copy(t.start).addScaledVector(t.dir, trav);
      m.position.copy(head).addScaledVector(t.dir, -tail / 2); m.scale.set(0.012, 0.012, tail);
      m.lookAt(_v2.copy(head).add(t.dir)); m.visible = true;
      gm.position.copy(m.position); gm.quaternion.copy(m.quaternion); gm.scale.set(0.045, 0.045, tail * 0.8); gm.visible = true;
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
  world.update(dt, camera.position);
  emitChimneys(dt);
  pAdd.update(dt); pNorm.update(dt);
  updateVM(now, dt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
  drawHUD(now, plist);
}
let fireT = 0;
function emitFires(dt) {
  fireT += dt; if (fireT < 0.05 || !world.fires.length) return; fireT = 0;
  for (const f of world.fires) {
    pAdd.add({ x: f.x + (Math.random() - 0.5) * 1.2, y: f.y, z: f.z + (Math.random() - 0.5) * 1.2, vx: (Math.random() - 0.5) * 0.3, vy: 1.2 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 0.3, max: 0.6 + Math.random() * 0.4, s: 0.5, grow: -0.3, c: COL.fire, a: 0.7, drag: 0.98 });
    if (Math.random() < 0.5) pNorm.add({ x: f.x + (Math.random() - 0.5), y: f.y + 1.2, z: f.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 0.3, vy: 0.8 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.3, max: 3.5, s: 0.6, grow: 2.2, c: COL.soot, a: 0.35, drag: 0.99 });
  }
}
function emitChimneys(dt) {
  smokeT += dt;
  if (smokeT > 0.35 && world.smokes) { smokeT = 0; for (const c of world.smokes) { const far = c.y > 6 ? 1 : 0.45; pNorm.add({ x: c.x + (Math.random() - 0.5) * 2 * far, y: c.y, z: c.z + (Math.random() - 0.5) * 2 * far, vx: 1.2 + Math.random() * 0.6, vy: (2.2 + Math.random()) * far, vz: (Math.random() - 0.5) * 0.6, max: 9, s: 3.5 * far, grow: 6 * far, c: COL.soot, a: 0.42, drag: 0.995 }); } }
  chimT += dt; if (chimT < 0.12) return; chimT = 0;
  for (const c of world.chimneys) pNorm.add({ x: c.x + (Math.random() - 0.5) * 0.2, y: c.y, z: c.z + (Math.random() - 0.5) * 0.2, vx: 0.3 + Math.random() * 0.2, vy: 0.9 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.2, max: 4, s: 0.5, grow: 2.2, c: COL.chim, a: 0.35, drag: 0.99 });
}

// =====================================================================
// HUD
// =====================================================================
const fmtTime = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function box(x, y, bw, bh, accent) {
  h.save(); h.shadowColor = 'rgba(0,0,0,0.45)'; h.shadowBlur = 14; h.shadowOffsetY = 4;
  const g = h.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, 'rgba(22,34,62,0.82)'); g.addColorStop(1, 'rgba(8,13,28,0.82)');
  h.fillStyle = g; rr(h, x, y, bw, bh, 12); h.fill(); h.restore();
  h.strokeStyle = accent || 'rgba(96,165,250,0.35)'; h.lineWidth = 1; rr(h, x + 0.5, y + 0.5, bw - 1, bh - 1, 12); h.stroke();
  const hl = h.createLinearGradient(0, y, 0, y + bh * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.12)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); h.fillStyle = hl; rr(h, x + 1, y + 1, bw - 2, bh * 0.5, 11); h.fill();
}
function drawHUD(now, plist) {
  h.setTransform(DPR, 0, 0, DPR, 0, 0); h.clearRect(0, 0, W, H);
  const m = last, info = me.info || {}, w = curW();
  if (me.alive && me.scoped && w.scope === 2) {
    const r = Math.min(W, H) * 0.46, X = W / 2, Y = H / 2;
    h.fillStyle = '#000'; h.beginPath(); h.rect(0, 0, W, H); h.arc(X, Y, r, 0, Math.PI * 2, true); h.fill('evenodd');
    const g = h.createRadialGradient(X, Y, r * 0.78, X, Y, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)'); h.fillStyle = g; h.beginPath(); h.arc(X, Y, r, 0, 7); h.fill();
    h.strokeStyle = '#000'; h.lineWidth = 2; h.beginPath(); h.moveTo(X - r, Y); h.lineTo(X - 14, Y); h.moveTo(X + 14, Y); h.lineTo(X + r, Y); h.moveTo(X, Y - r); h.lineTo(X, Y - 14); h.moveTo(X, Y + 14); h.lineTo(X, Y + r); h.stroke();
    h.lineWidth = 1; h.beginPath(); h.moveTo(X - 14, Y); h.lineTo(X + 14, Y); h.moveTo(X, Y - 14); h.lineTo(X, Y + 14); h.stroke();
    for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { h.fillStyle = '#000'; h.beginPath(); h.arc(X + s * i * r * 0.15, Y, 2, 0, 7); h.fill(); h.beginPath(); h.arc(X, Y + s * i * r * 0.15, 2, 0, 7); h.fill(); }
    const gd = h.createRadialGradient(X, Y, 0, X, Y, 9); gd.addColorStop(0, 'rgba(255,60,60,1)'); gd.addColorStop(0.35, 'rgba(255,0,0,0.8)'); gd.addColorStop(1, 'rgba(255,0,0,0)'); h.fillStyle = gd; h.beginPath(); h.arc(X, Y, 9, 0, 7); h.fill();
  }
  if (hurtFlash > 0) { const g = h.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${hurtFlash * 0.5})`); h.fillStyle = g; h.fillRect(0, 0, W, H); hurtFlash = Math.max(0, hurtFlash - 0.04); }
  h.textAlign = 'center'; h.font = '600 12px Inter, system-ui';
  for (const p of plist) {
    if (p.id === myId || !p.alive || p.team !== me.team) continue;
    _v.set(p.x * U, (p.z + 50) * U, p.y * U).project(camera);
    if (_v.z > 1 || _v.z < -1) continue;
    const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
    h.fillStyle = 'rgba(0,0,0,0.5)'; h.fillText(roster.get(p.id)?.name || '', sx + 1, sy + 1);
    h.fillStyle = TEAM_HEX[me.team]; h.fillText(roster.get(p.id)?.name || '', sx, sy);
    h.beginPath(); h.moveTo(sx - 5, sy + 5); h.lineTo(sx + 5, sy + 5); h.lineTo(sx, sy + 11); h.fill();
  }
  h.textAlign = 'center'; box(W / 2 - 140, 10, 280, 52);
  h.font = 'bold 30px Rajdhani, system-ui'; h.fillStyle = TEAM_HEX[0]; h.fillText(m.sc[0], W / 2 - 88, 47); h.fillStyle = TEAM_HEX[1]; h.fillText(m.sc[1], W / 2 + 88, 47);
  h.fillStyle = '#fff'; h.font = 'bold 20px Rajdhani, system-ui'; h.fillText(m.st === 'play' ? fmtTime(m.tl) : '—', W / 2, 33);
  h.font = '11px Inter, system-ui'; h.fillStyle = '#c9d0db'; h.fillText(MAPS[worldIdx].name + ' · до ' + C.SCORE_LIMIT, W / 2, 52);
  h.textAlign = 'left'; box(16, 14, 186, 38); h.font = 'bold 22px Rajdhani, system-ui'; h.fillStyle = '#7ee787'; h.fillText('$ ' + save.money.toLocaleString('ru-RU'), 30, 41);
  drawRadar(plist);
  box(16, H - 70, 230, 54);
  h.font = 'bold 30px Rajdhani, system-ui'; h.fillStyle = me.hp > 30 ? '#eaf2ff' : '#ff6b6b'; h.fillText('✚ ' + (me.alive ? me.hp : 0), 30, H - 33);
  h.fillStyle = 'rgba(255,255,255,0.1)'; rr(h, 130, H - 48, 100, 9, 4); h.fill();
  if (me.alive && me.hp > 0) { const hg = h.createLinearGradient(130, 0, 230, 0); if (me.hp > 50) { hg.addColorStop(0, '#22d3ee'); hg.addColorStop(1, '#3b82f6'); } else if (me.hp > 25) { hg.addColorStop(0, '#facc15'); hg.addColorStop(1, '#f59e0b'); } else { hg.addColorStop(0, '#f87171'); hg.addColorStop(1, '#dc2626'); } h.fillStyle = hg; rr(h, 130, H - 48, Math.max(6, me.hp), 9, 4); h.fill(); }
  h.font = '11px Inter, system-ui'; h.fillStyle = '#e8ecf2'; h.fillText('ping ' + ping + ' ms' + (roomInfo ? ' · ' + roomInfo.name : ''), 16, H - 78);
  const bx2 = W - 266; box(bx2, H - 70, 250, 54);
  const fidNow = eqFid(w.id);
  h.textAlign = 'left'; h.font = '600 13px Inter, system-ui'; h.fillStyle = fidNow >= 0 ? RARITY[FINISHES[fidNow].r].color : '#c9d0db'; h.fillText(fidNow >= 0 ? S.itemName(FINISHES[fidNow]) : w.name, bx2 + 14, H - 47);
  h.textAlign = 'right';
  if (info.rl > 0) { h.font = 'bold 18px Rajdhani, system-ui'; h.fillStyle = '#5ef0ff'; h.fillText('Перезарядка', bx2 + 236, H - 30); h.fillStyle = '#ffffff22'; h.fillRect(bx2 + 14, H - 26, 120, 4); h.fillStyle = '#22d3ee'; h.fillRect(bx2 + 14, H - 26, 120 * (1 - info.rl / reloadTotal), 4); }
  else if (w.cat === 'knife') { h.font = 'bold 28px Rajdhani, system-ui'; h.fillStyle = '#fff'; h.fillText('∞', bx2 + 236, H - 27); }
  else { const am = localAmmo(); h.font = 'bold 28px Rajdhani, system-ui'; h.fillStyle = am > w.mag * 0.2 ? '#fff' : '#ff6b6b'; h.fillText(am + ' / ' + w.mag, bx2 + 236, H - 27); }
  let sy = H - 82;
  for (let s = 2; s >= 0; s--) { const wid = me.wpn[s]; if (wid == null || wid < 0) continue; const act = s === me.slot; h.font = (act ? 'bold ' : '') + '13px Inter, system-ui'; h.fillStyle = act ? '#fff' : '#d5dbe4'; h.strokeStyle = 'rgba(0,0,0,0.6)'; h.lineWidth = 3; h.strokeText(`${s + 1}  ${WEAPONS[wid].name}`, W - 22, sy); h.fillText(`${s + 1}  ${WEAPONS[wid].name}`, W - 22, sy); sy -= 20; }
  let y = 22;
  for (const f of feed) {
    const age = now - f.t; if (age > 6000) continue;
    h.globalAlpha = Math.min(1, (6000 - age) / 800); h.textAlign = 'right'; h.font = '13px Inter, system-ui';
    if (f.kill) {
      const k = f.kill, mid = `  [${WEAPONS[k.w].name}${k.hs ? ' ⌖' : ''}]  `;
      const vw = h.measureText(k.vn).width, mw = h.measureText(mid).width, kw = h.measureText(k.kn).width;
      h.fillStyle = (k.k === myId || k.v === myId) ? 'rgba(90,20,20,0.8)' : 'rgba(14,17,22,0.7)'; h.fillRect(W - 26 - vw - mw - kw, y - 15, vw + mw + kw + 14, 22);
      h.fillStyle = TEAM_HEX[k.vt === 'A' ? 0 : 1]; h.fillText(k.vn, W - 19, y);
      h.fillStyle = k.hs ? '#ffd166' : '#e8ecf2'; h.fillText(mid, W - 19 - vw, y);
      h.fillStyle = TEAM_HEX[k.kt === 'A' ? 0 : 1]; h.fillText(k.kn, W - 19 - vw - mw, y);
    } else { const tw = h.measureText(f.s).width; h.fillStyle = 'rgba(14,17,22,0.7)'; h.fillRect(W - 26 - tw, y - 15, tw + 14, 22); h.fillStyle = f.c; h.fillText(f.s, W - 19, y); }
    y += 26;
  }
  h.globalAlpha = 1;
  floaters = floaters.filter((f) => now - f.t < 1500);
  for (const f of floaters) { const k = (now - f.t) / 1500; h.globalAlpha = 1 - k; h.textAlign = 'center'; h.font = 'bold 22px Rajdhani, system-ui'; h.fillStyle = '#7ee787'; h.strokeStyle = 'rgba(0,0,0,0.6)'; h.lineWidth = 4; h.strokeText(f.s, W / 2, H / 2 - 80 - k * 40); h.fillText(f.s, W / 2, H / 2 - 80 - k * 40); }
  h.globalAlpha = 1;
  const ads = me.scoped && w.scope === 1;
  if (me.alive && !(me.scoped && w.scope === 2) && !ads && !paused && w.cat !== 'knife') {
    const base = S.inaccuracy(w, { spd: spdFrac, og: pred.og, cr: pred.cr, scoped: me.scoped }) + rec.n * 0.0012;
    crossGap += (3 + base * (H / 2) / Math.tan((camera.fov * Math.PI) / 360) - crossGap) * Math.min(1, (1 / 60) * 18);
    h.lineWidth = 3.2; h.strokeStyle = 'rgba(0,0,0,0.6)'; cross(W / 2, H / 2, crossGap, 7);
    h.lineWidth = 1.7; h.strokeStyle = '#5ef0ff'; cross(W / 2, H / 2, crossGap, 7);
    h.fillStyle = '#5ef0ff'; h.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);
  } else if (me.alive && w.cat === 'knife') { h.fillStyle = '#5ef0ff'; h.fillRect(W / 2 - 1.5, H / 2 - 1.5, 3, 3); }
  if (now - hitMark < 160) { h.strokeStyle = hitHead ? '#ff4040' : '#fff'; h.lineWidth = 2; h.beginPath(); for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { h.moveTo(W / 2 + dx * 6, H / 2 + dy * 6); h.lineTo(W / 2 + dx * 13, H / 2 + dy * 13); } h.stroke(); }
  if (!me.alive && m.st === 'play') {
    const k = Math.min(1, (now - deathT) / 900), g = h.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, `rgba(40,0,0,${0.15 * k})`); g.addColorStop(1, `rgba(60,0,0,${0.6 * k})`); h.fillStyle = g; h.fillRect(0, 0, W, H);
    const ri = info.ri || 0, el = $('dsGo');
    if (el) { el.disabled = ri > 0 || spawnAsked; el.textContent = spawnAsked ? 'Возрождение…' : ri > 0 ? `Возродиться через ${Math.ceil(ri / 1000)}` : 'Возродиться · Пробел'; }
    if (m.st === 'play' && $('death').classList.contains('hidden') && now - deathT > 800) showDeath();
  }
  if (me.alive || m.st !== 'play') { if (!$('death').classList.contains('hidden')) hideDeath(); }
  // чат
  { const list = chatLines.filter((c) => chatOpen || now - c.t < 10000).slice(-7); let cy = H - 110 - list.length * 22;
    h.textAlign = 'left'; h.font = '600 14px Inter, system-ui';
    for (const c of list) { const age = now - c.t; h.globalAlpha = chatOpen ? 1 : Math.min(1, (10000 - age) / 1000); const pre = (c.dead ? '☠ ' : '') + (c.team ? '[команде] ' : '') + c.n + ': '; const pw = h.measureText(pre).width, tw = h.measureText(c.s).width;
      h.fillStyle = 'rgba(8,13,28,0.6)'; rr(h, 14, cy - 15, pw + tw + 16, 21, 6); h.fill();
      h.fillStyle = TEAM_HEX[c.tm]; h.fillText(pre, 22, cy); h.fillStyle = '#eaf2ff'; h.fillText(c.s, 22 + pw, cy); cy += 22; }
    h.globalAlpha = 1; }
  if (m.st === 'end') {
    h.fillStyle = 'rgba(0,0,0,0.6)'; h.fillRect(0, 0, W, H);
    h.textAlign = 'center'; h.font = 'bold 44px Rajdhani, system-ui';
    if (m.w === 'D') { h.fillStyle = '#fff'; h.fillText('НИЧЬЯ', W / 2, H / 2 - 130); }
    else { const t = m.w === 'A' ? 0 : 1; h.fillStyle = TEAM_HEX[t]; h.fillText((t === me.team ? 'ПОБЕДА! ' : 'ПОРАЖЕНИЕ. ') + TEAM_NAME[t] + ' выиграли', W / 2, H / 2 - 130); }
    h.font = '16px Inter, system-ui'; h.fillStyle = '#7ee787'; h.fillText(`+$${endBonus} за матч`, W / 2, H / 2 - 100);
    h.fillStyle = '#e8ecf2'; h.fillText('Следующая карта: ' + MAPS[(worldIdx + 1) % MAPS.length].name + ' через ' + Math.ceil(m.tl / 1000) + ' с', W / 2, H / 2 - 76);
    drawBoard(H / 2 - 56);
  } else if (showBoard) drawBoard(90);
  if (!keysLocked && now - ctrlWarnAt < 4000) {
    h.textAlign = 'center'; h.font = '600 14px Inter, system-ui'; const t = 'Не в полноэкранном режиме Ctrl+W закроет вкладку. Приседай на C или кликни по экрану — игра развернётся.';
    const tw = h.measureText(t).width; h.fillStyle = 'rgba(160,30,30,0.85)'; h.fillRect(W / 2 - tw / 2 - 14, 72, tw + 28, 30); h.fillStyle = '#fff'; h.fillText(t, W / 2, 92);
  }
  if (!locked && !paused && joined && me.alive && !chatOpen) {
    h.fillStyle = 'rgba(0,0,0,0.5)'; h.fillRect(0, H / 2 + 60, W, 44);
    h.textAlign = 'center'; h.fillStyle = '#fff'; h.font = 'bold 16px Inter, system-ui'; h.fillText('Кликни по экрану, чтобы управлять мышью', W / 2, H / 2 + 88);
  }
}
let crossGap = 6;
function cross(x, y, g, l) { h.beginPath(); h.moveTo(x - g - l, y); h.lineTo(x - g, y); h.moveTo(x + g, y); h.lineTo(x + g + l, y); h.moveTo(x, y - g - l); h.lineTo(x, y - g); h.moveTo(x, y + g); h.lineTo(x, y + g + l); h.stroke(); }
function drawBoard(top) {
  const bw = Math.min(680, W - 40), x0 = W / 2 - bw / 2;
  const rows = [...roster.entries()].map(([id, r]) => ({ id, ...r }));
  h.fillStyle = 'rgba(14,17,22,0.92)'; rr(h, x0, top, bw, 300, 12); h.fill();
  for (let t = 0; t < 2; t++) {
    const list = rows.filter((r) => r.team === t).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const cx = x0 + (t === 0 ? 16 : bw / 2 + 8), cw = bw / 2 - 24;
    h.textAlign = 'left'; h.font = 'bold 18px Rajdhani, system-ui'; h.fillStyle = TEAM_HEX[t]; h.fillText(TEAM_NAME[t] + ' — ' + last.sc[t], cx, top + 30);
    h.font = '12px Inter, system-ui'; h.fillStyle = '#9aa3b2'; h.fillText('Игрок', cx, top + 54); h.textAlign = 'right'; h.fillText('У / С', cx + cw, top + 54);
    list.forEach((r, i) => {
      const yy = top + 80 + i * 40;
      if (r.id === myId) { h.fillStyle = 'rgba(255,255,255,0.08)'; h.fillRect(cx - 6, yy - 20, cw + 12, 30); }
      h.textAlign = 'left'; h.font = '14px Inter, system-ui'; h.fillStyle = r.bot ? '#9aa3b2' : '#fff'; h.fillText(r.name, cx, yy);
      h.textAlign = 'right'; h.fillText(r.kills + ' / ' + r.deaths, cx + cw, yy);
    });
  }
}
function drawRadar(plist) {
  const map = MAPS[worldIdx], R = 85, cx = 16 + R, cy = 64 + R, sc = R / (C.TILE * 9);
  h.save(); h.beginPath(); h.arc(cx, cy, R, 0, 7); h.fillStyle = 'rgba(14,17,22,0.62)'; h.fill(); h.clip();
  h.translate(cx, cy); h.rotate(-Math.PI / 2 - me.yaw); h.scale(sc, sc);
  const src = me.alive ? pred : (deathPos || pred);
  h.translate(-src.x, -src.y);
  const TL = C.TILE, tx0 = Math.floor(src.x / TL) - 13, tx1 = tx0 + 26, ty0 = Math.floor(src.y / TL) - 13, ty1 = ty0 + 26;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const c = S.colAt(map, tx, ty);
    if (c.kind === 'out') continue;
    h.fillStyle = c.kind === 'in' || c.kind === 'door' ? 'rgba(160,170,190,0.35)' : c.kind === 'bed' || c.kind === 'cab' ? '#6b8a5a' : c.kind === 'crate' || c.kind === 'barrel' || c.kind === 'sand' || c.kind === 'fence' ? '#8a6a3c' : c.kind === 'tree' ? '#3f6a2a' : '#7a8395';
    h.fillRect(tx * TL, ty * TL, TL + 0.5, TL + 0.5);
  }
  for (const p of plist) { if (!p.alive || p.team !== me.team || p.id === myId) continue; h.fillStyle = TEAM_HEX[p.team]; h.beginPath(); h.arc(p.x, p.y, 14, 0, 7); h.fill(); }
  h.restore();
  h.fillStyle = '#fff'; h.beginPath(); h.moveTo(cx, cy - 7); h.lineTo(cx + 5, cy + 5); h.lineTo(cx - 5, cy + 5); h.closePath(); h.fill();
  h.strokeStyle = 'rgba(255,255,255,0.25)'; h.lineWidth = 1; h.beginPath(); h.arc(cx, cy, R, 0, 7); h.stroke();
}

// старт
applyQuality();
setWorld(Math.floor(Math.random() * MAPS.length));
connect();
openTab('play');
requestAnimationFrame(frame);
window.__game = { renderer, me, rec, cam, vm, vmPivot, vmCam, others, buildVM, get world() { return world; }, get pred() { return pred; }, scene, camera, setWorld, openTab, save, get worldIdx() { return worldIdx; }, VM_BASE, KNIFE_ROT, KS, animAt(type, p) { anim = { type, t0: performance.now() - p * 1e6, dur: 1e6 }; } };
