// Сервер STRIKE 5×5 (3D): комнаты-серверы, матчи 5 на 5, боты, админ-панель, компенсация пинга.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');
const { C, MAPS, WEAPONS, WKEY, SKINS } = S;

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const THREE_PATH = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.min.js');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
if (!process.env.ADMIN_PASSWORD) console.log('ADMIN_PASSWORD не задан. Временный пароль админа: ' + ADMIN_PASSWORD);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  let fp;
  if (p === '/three.module.js') fp = THREE_PATH;
  else if (p.startsWith('/addons/')) { const base = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm'); fp = path.join(base, path.normalize(p.slice(8))); if (!fp.startsWith(base)) { res.writeHead(403); return res.end(); } }
  else { fp = path.join(PUBLIC, path.normalize(p)); if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); } }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const BOT_NAMES = ['Ястреб', 'Гром', 'Тень', 'Кобра', 'Волк', 'Сокол', 'Призрак', 'Медведь', 'Буря', 'Лис', 'Барс', 'Шторм', 'Клык', 'Ворон', 'Рысь'];
const KNIFE = WKEY.knife;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

function validLoadout(lo) {
  let p = Array.isArray(lo) ? lo[0] : -1, s = Array.isArray(lo) ? lo[1] : WKEY.usp;
  p = WEAPONS[p] && WEAPONS[p].slot === 0 ? p : -1;
  s = WEAPONS[s] && WEAPONS[s].slot === 1 ? s : WKEY.usp;
  return [p, s, KNIFE];
}
function validFin(fin) {
  const out = {};
  if (fin && typeof fin === 'object') for (const k in fin) { const wid = k | 0, fid = fin[k] | 0; if (S.finishFits(fid, wid)) out[wid] = fid; }
  return out;
}
function botLoadout() {
  const r = Math.random();
  let p;
  if (r < 0.05) p = WKEY.awp; else if (r < 0.12) p = WKEY.scout;
  else { const pool = WEAPONS.filter((w) => w.slot === 0 && w.price <= 7000 && w.cat !== 'sniper'); p = pool[Math.floor(Math.random() * pool.length)].id; }
  const pist = WEAPONS.filter((w) => w.slot === 1);
  return [p, pist[Math.floor(Math.random() * pist.length)].id, KNIFE];
}

// ---------------- Торговая площадка (хранится в data/market.json) ----------------
const DATA_DIR = path.join(__dirname, 'data'), MARKET_FILE = path.join(DATA_DIR, 'market.json');
let market = { seq: 1, listings: [], payouts: {} };
try { market = Object.assign(market, JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'))); } catch {}
let saveTimer = null;
function saveMarket() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(MARKET_FILE, JSON.stringify(market)); } catch (e) { console.log('market save error', e.message); } }, 500); }
const MARKET_FEE = 0.05;
function marketList() { return market.listings.slice().sort((a, b) => b.t - a.t); }
function payout(uid) {
  const po = market.payouts[uid]; if (!po) return;
  for (const c of clients) if (c.uid === uid) { c.send({ t: 'payout', money: po.money, sold: po.sold }); delete market.payouts[uid]; saveMarket(); return; }
}

let roomSeq = 1;
const rooms = new Map();
const clients = new Set();

class Room {
  constructor(opts) {
    this.id = roomSeq++;
    this.name = clean(opts.name, 24) || 'Сервер #' + this.id;
    this.pass = clean(opts.pass, 16);
    this.bots = opts.bots !== false;
    this.official = !!opts.official;
    this.owner = opts.owner || '';
    this.players = new Map();
    this.nextId = 1;
    this.mapIndex = Number.isInteger(opts.map) && MAPS[opts.map] ? opts.map : Math.floor(Math.random() * MAPS.length);
    this.shots = []; this.events = [];
    this.tick = 0; this.emptySince = Date.now();
    this.startRound();
  }
  get map() { return MAPS[this.mapIndex]; }
  humans() { return [...this.players.values()].filter((p) => !p.bot); }
  teamCount(team, humansOnly) { let n = 0; for (const p of this.players.values()) if (p.team === team && (!humansOnly || !p.bot)) n++; return n; }
  info() { return { id: this.id, name: this.name, map: this.mapIndex, players: this.humans().length, max: C.TEAM_SIZE * 2, locked: !!this.pass, bots: this.bots, official: this.official, score: [this.score.A, this.score.B] }; }

  newPlayer(o) {
    const p = {
      id: this.nextId++, name: o.name, team: o.team, bot: !!o.bot, client: o.client || null,
      skin: o.skin, hitR: SKINS[o.skin].hitR, headR: SKINS[o.skin].headR,
      loadout: o.loadout, nextLoadout: null, fin: o.fin || {}, weapons: o.loadout.slice(), slot: 1,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, og: true, cr: false, spd: 0, mv: 0, heavy: false, angle: 0, pitch: 0, hp: C.HP, alive: false, respawnAt: 0,
      ammo: [0, 0, 0], reloadUntil: 0, switchUntil: 0, lastShot: 0, kills: 0, deaths: 0,
      queue: [], lastSeq: 0, fire: false, prevF: false, edgeAt: 0, moving: false, scoped: false, scopedAt: 0, spray: 0, rt: 0, wantSpawn: false, chatAt: 0,
      hist: [],
      path: null, repathAt: 0, tgtId: null, seenAt: 0, strafeDir: 1, strafeUntil: 0, stuck: 0, aimJitter: 0,
    };
    this.players.set(p.id, p);
    this.spawn(p);
    return p;
  }

  spawn(p) {
    const map = this.map;
    if (p.nextLoadout) { p.loadout = p.nextLoadout; p.nextLoadout = null; }
    p.weapons = p.loadout.slice();
    p.ammo = p.weapons.map((w) => (w >= 0 ? WEAPONS[w].mag : 0));
    p.slot = p.weapons[0] >= 0 ? 0 : 1;
    const list = map.spawns[p.team].slice().sort(() => Math.random() - 0.5);
    let pick = list[0], best = -1;
    for (const s of list) {
      const x = (s[0] + 0.5) * C.TILE, y = (s[1] + 0.5) * C.TILE;
      let near = 1e9;
      for (const q of this.players.values()) if (q !== p && q.alive) near = Math.min(near, Math.hypot(q.x - x, q.y - y));
      if (near > best) { best = near; pick = s; }
    }
    p.x = (pick[0] + 0.5) * C.TILE + (Math.random() - 0.5) * 14; p.y = (pick[1] + 0.5) * C.TILE + (Math.random() - 0.5) * 14;
    p.z = S.groundAt(map, p.x, p.y, C.R, 40); p.vx = 0; p.vy = 0; p.vz = 0; p.og = true; p.cr = false; p.spd = 0; p.mv = 0;
    p.angle = p.team === 'A' ? 0 : Math.PI; p.pitch = 0;
    p.hp = C.HP; p.alive = true; p.wantSpawn = false; p.reloadUntil = 0; p.inputAt = Date.now(); p.switchUntil = 0; p.queue.length = 0;
    p.scoped = false; p.spray = 0; p.hist = [];
    p.path = null; p.tgtId = null; p.spawnProtect = Date.now() + 1500; p.stuck = 0;
  }

  fillBots() {
    for (const team of ['A', 'B']) {
      const want = this.bots ? C.TEAM_SIZE : this.teamCount(team, true);
      while (this.teamCount(team) < want) {
        const used = new Set([...this.players.values()].map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has('[бот] ' + n)) || 'Бот';
        this.newPlayer({ name: '[бот] ' + name, team, bot: true, skin: Math.floor(Math.random() * 7), loadout: botLoadout() });
      }
      while (this.teamCount(team) > want) {
        const bot = [...this.players.values()].find((p) => p.team === team && p.bot);
        if (!bot) break;
        this.players.delete(bot.id);
      }
    }
  }

  addHuman(client, o) {
    const a = this.teamCount('A', true), b = this.teamCount('B', true);
    const team = a <= b ? 'A' : 'B';
    const bot = [...this.players.values()].find((p) => p.team === team && p.bot);
    if (bot) this.players.delete(bot.id);
    const skin = SKINS[o.skin] ? o.skin | 0 : 0;
    const p = this.newPlayer({ name: o.name, team, client, skin, loadout: validLoadout(o.lo), fin: validFin(o.fin) });
    this.fillBots();
    this.events.push({ t: 'msg', s: `${o.name} зашёл за ${team === 'A' ? 'синих' : 'красных'}` });
    return p;
  }
  removeHuman(p, why) {
    this.players.delete(p.id);
    this.events.push({ t: 'msg', s: `${p.name} ${why || 'вышел'}` });
    this.fillBots();
    if (!this.humans().length) this.emptySince = Date.now();
  }

  startRound() {
    this.score = { A: 0, B: 0 };
    this.endAt = Date.now() + C.MATCH_MS;
    this.state = 'play'; this.winner = null;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; if (p.bot) p.loadout = botLoadout(); this.spawn(p); }
    this.fillBots();
    this.broadcast({ t: 'map', m: this.mapIndex });
  }
  setMap(i) { this.mapIndex = ((i % MAPS.length) + MAPS.length) % MAPS.length; this.startRound(); }

  curW(p) { return WEAPONS[p.weapons[p.slot]] || WEAPONS[KNIFE]; }

  // положение игрока q в прошлом (компенсация пинга)
  posAt(q, tk) {
    if (tk >= this.tick || !q.hist.length) return { x: q.x, y: q.y, z: q.z, cr: q.cr };
    const h = q.hist;
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1][0] <= tk) { const a = h[i - 1], b = h[i], f = b[0] === a[0] ? 1 : (tk - a[0]) / (b[0] - a[0]); return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, z: a[3] + (b[3] - a[3]) * f, cr: f < 0.5 ? a[4] : b[4] }; }
    }
    return { x: h[0][1], y: h[0][2], z: h[0][3], cr: h[0][4] };
  }
  rewindTick(p) { if (p.bot) return this.tick; return Math.max(this.tick - 18, Math.min(this.tick, p.rt || this.tick)); }

  traceShot(p, yaw, pitch, w, tk) {
    const [dx, dy, dz] = S.dirFrom(yaw, pitch);
    const oz = p.z + (p.cr ? C.EYEC : C.EYE);
    const wall = S.ray3(this.map, p.x, p.y, oz, dx, dy, dz, w.range);
    const hits = [];
    for (const q of this.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const pos = this.posAt(q, tk);
      const h = S.hitPlayer(p.x, p.y, oz, dx, dy, dz, pos, q.hitR, q.headR);
      if (h && h.t < wall.t) hits.push({ q, t: h.t, head: h.head });
    }
    hits.sort((u, v) => u.t - v.t);
    return { dx, dy, dz, oz, wall, hits };
  }

  los(a, q, d) {
    const ox = a.x, oy = a.y, oz = a.z + (a.cr ? C.EYEC : C.EYE);
    for (const hz of q.cr ? [q.z + 27, q.z + 15] : [q.z + 39, q.z + 22]) {
      const dx = q.x - ox, dy = q.y - oy, dz = hz - oz, L = Math.hypot(dx, dy, dz);
      if (S.ray3(this.map, ox, oy, oz, dx / L, dy / L, dz / L, L).t >= L - 2) return true;
    }
    return false;
  }

  shoot(p, now, heavy) {
    const w = this.curW(p), wid = w.id, tk = this.rewindTick(p);
    p.lastShot = now;
    if (w.cat === 'knife') {
      const range = heavy ? w.range * 0.85 : w.range;
      let best = null, bd = 1e9;
      for (const q of this.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const pos = this.posAt(q, tk);
        const d = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (d > range + q.hitR || Math.abs(pos.z - p.z) > 30) continue;
        if (Math.abs(angDiff(p.angle, Math.atan2(pos.y - p.y, pos.x - p.x))) > 0.9) continue;
        if (!this.los(p, q, d)) continue;
        if (d < bd) { bd = d; best = q; }
      }
      const ex = best ? best.x : p.x + Math.cos(p.angle) * range, ey = best ? best.y : p.y + Math.sin(p.angle) * range;
      let back = false;
      if (best) { const att = Math.atan2(best.y - p.y, best.x - p.x); back = Math.abs(angDiff(best.angle, att)) < 1.0; }
      this.shots.push([Math.round(p.x), Math.round(p.y), Math.round(p.z + C.EYE), Math.round(ex), Math.round(ey), Math.round(p.z + 28), 0, best ? 1 : 2, wid, p.id, heavy ? 2 : 1, back ? 1 : 0]);
      if (best) this.damage(p, best, heavy ? (back ? 180 : w.heavy) : (back ? 90 : w.dmg), wid, now, false);
      return;
    }
    p.ammo[p.slot]--;
    const scoped = !!((p.scoped || now - p.scopedAt < 200) && w.scope);
    // разброс: стоя пуля идёт почти точно в прицел; отдачу игрок видит как подброс прицела
    let base = S.inaccuracy(w, { spd: p.spd, og: p.og, cr: p.cr, scoped });
    if (w.cat !== 'shotgun' && w.cat !== 'sniper') base += p.spray * 0.18;
    if (p.bot) base = base * 1.5 + 0.02 + p.spray * 0.5;
    p.spray = Math.min(0.12, p.spray + w.kick);
    for (let i = 0; i < w.pellets; i++) {
      const yaw = p.angle + gauss() * base, pitch = p.pitch + gauss() * base * 0.8 + (p.bot ? p.spray * 0.3 : 0);
      const tr = this.traceShot(p, yaw, pitch, w, tk);
      let endT = tr.wall.t, flag = tr.wall.n ? 0 : 2, nrm = tr.wall.n;
      let dmg = w.dmg;
      const targets = w.pierce ? tr.hits : tr.hits.slice(0, 1);
      if (targets.length) {
        if (!w.pierce) { endT = targets[0].t; flag = 1; }
        for (const h of targets) {
          const fall = w.cat === 'shotgun' ? Math.max(0.35, 1 - h.t / w.range) : 1;
          this.damage(p, h.q, S.hitDamage(w, dmg * fall, h.head), wid, now, h.head);
          if (w.pierce) dmg *= 0.85;
        }
      }
      const nn = nrm ? (nrm[2] > 0.5 ? 5 : nrm[2] < -0.5 ? 6 : nrm[0] > 0.3 ? 1 : nrm[0] < -0.3 ? 2 : nrm[1] > 0.3 ? 3 : 4) : 0;
      const r1 = (v) => Math.round(v * 10) / 10;
      this.shots.push([Math.round(p.x), Math.round(p.y), Math.round(tr.oz), r1(p.x + tr.dx * endT), r1(p.y + tr.dy * endT), r1(tr.oz + tr.dz * endT), nn, flag, wid, p.id, i === 0 ? 1 : 0, targets[0] && targets[0].head ? 1 : 0]);
      if (w.pierce) for (const h of targets) this.shots.push([0, 0, 0, Math.round(p.x + tr.dx * h.t), Math.round(p.y + tr.dy * h.t), Math.round(tr.oz + tr.dz * h.t), 0, 3, wid, p.id, 0, h.head ? 1 : 0]);
    }
    if (w.scope === 2) { p.scoped = false; p.scopedAt = 0; }
  }

  damage(p, q, dmg, wid, now, head) {
    if (q.spawnProtect > now || !q.alive) return;
    q.hp -= Math.round(dmg);
    if (q.hp <= 0) this.kill(p, q, now, wid, head);
  }
  kill(killer, victim, now, wid, head) {
    victim.alive = false; victim.hp = 0; victim.respawnAt = now + (victim.bot ? C.RESPAWN_MS : 1500); victim.deaths++; victim.wantSpawn = false; victim.diedAt = now;
    if (killer !== victim) { killer.kills++; this.score[killer.team]++; }
    this.events.push({ t: 'kill', k: killer.id, v: victim.id, kn: killer.name, vn: victim.name, kt: killer.team, vt: victim.team, w: wid, hs: head ? 1 : 0, kx: Math.round(killer.x), ky: Math.round(killer.y) });
  }

  findPath(fromX, fromY, goal) {
    const map = this.map, W = map.W;
    const sx = Math.floor(fromX / C.TILE), sy = Math.floor(fromY / C.TILE);
    const start = sy * W + sx, end = goal[1] * W + goal[0];
    const prev = new Int32Array(W * map.H).fill(-1);
    prev[start] = start;
    const q = [start];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i]; if (cur === end) break;
      const cx = cur % W, cy = (cur / W) | 0;
      const fc = Math.max(0, S.floorAt(map, cx, cy));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        const fn = S.floorAt(map, nx, ny);
        if (fn < 0 || fn - fc > 30) continue;
        const ni = ny * W + nx; if (prev[ni] !== -1) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (prev[end] === -1) return null;
    const out = [];
    for (let c = end; c !== start; c = prev[c]) out.push([((c % W) + 0.5) * C.TILE, (((c / W) | 0) + 0.5) * C.TILE]);
    return out.reverse();
  }

  switchSlot(p, slot, now) {
    if (slot === p.slot || p.weapons[slot] == null || p.weapons[slot] < 0) return;
    p.slot = slot; p.reloadUntil = 0; p.scoped = false; p.spray = 0; p.switchUntil = now + 350;
  }

  botThink(b, now) {
    const map = this.map;
    if (b.weapons[0] >= 0 && b.slot !== 0 && !b.tgtId) this.switchSlot(b, 0, now);
    let tgt = null, bd = 1e9;
    for (const q of this.players.values()) {
      if (q.team === b.team || !q.alive) continue;
      const d = dist(b, q); if (d > 1100 || d >= bd) continue;
      if (this.los(b, q, d)) { tgt = q; bd = d; }
    }
    const w = this.curW(b);
    let mx = 0, my = 0, jump = false;
    b.scoped = false;
    if (tgt) {
      if (b.tgtId !== tgt.id) { b.tgtId = tgt.id; b.seenAt = now; b.aimJitter = (Math.random() - 0.5) * 0.5; }
      if (b.slot === 0 && b.ammo[0] === 0 && b.weapons[1] >= 0 && b.ammo[1] > 0) this.switchSlot(b, 1, now);
      b.aimJitter *= 0.93;
      const want = Math.atan2(tgt.y - b.y, tgt.x - b.x) + b.aimJitter;
      const d = angDiff(b.angle, want);
      b.angle += Math.max(-6 * C.DT, Math.min(6 * C.DT, d));
      const wantP = Math.atan2(tgt.z + 30 - (b.z + C.EYE), bd) + b.aimJitter * 0.3;
      b.pitch += (wantP - b.pitch) * 0.3;
      const sniper = w.cat === 'sniper';
      b.fire = now - b.seenAt > (sniper ? 700 : 380) && Math.abs(d) < (sniper ? 0.06 : 0.18);
      if (sniper) b.scoped = true;
      else {
        if (now > b.strafeUntil) { b.strafeDir = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + 400 + Math.random() * 900; }
        mx = Math.cos(want + Math.PI / 2) * b.strafeDir * 0.7; my = Math.sin(want + Math.PI / 2) * b.strafeDir * 0.7;
        const close = w.cat === 'shotgun' ? 250 : w.cat === 'smg' ? 380 : 480;
        if (bd > close) { mx += Math.cos(want) * 0.6; my += Math.sin(want) * 0.6; }
      }
      b.path = null;
    } else {
      b.tgtId = null; b.fire = false;
      if (!b.path || !b.path.length || now > b.repathAt) {
        const enemy = b.team === 'A' ? 'B' : 'A';
        const pool = Math.random() < 0.4 ? map.spawns[enemy] : map.floor;
        const goal = pool[Math.floor(Math.random() * pool.length)];
        b.path = this.findPath(b.x, b.y, goal) || [];
        b.repathAt = now + 6000 + Math.random() * 4000;
      }
      if (b.path.length) {
        const [nx, ny] = b.path[0];
        const d = Math.hypot(nx - b.x, ny - b.y);
        if (d < 8 || (d < 26 && Math.abs(b.z - S.floorAt(map, Math.floor(nx / C.TILE), Math.floor(ny / C.TILE))) <= C.STEP && Math.floor(nx / C.TILE) === Math.floor(b.x / C.TILE) && Math.floor(ny / C.TILE) === Math.floor(b.y / C.TILE))) b.path.shift();
        else {
          const a = Math.atan2(ny - b.y, nx - b.x); mx = Math.cos(a); my = Math.sin(a);
          const fz = S.floorAt(map, Math.floor(nx / C.TILE), Math.floor(ny / C.TILE));
          if (b.og && fz > b.z + C.STEP && d < 46) jump = true;
        }
        if (mx || my) b.angle += Math.max(-0.2, Math.min(0.2, angDiff(b.angle, Math.atan2(my, mx))));
        b.pitch *= 0.8;
      }
      if (w.mag && b.ammo[b.slot] < w.mag && !b.reloadUntil) b.reloadUntil = now + w.reload;
    }
    // боты ходят через ту же физику; застрял — прыгает
    const len = Math.hypot(mx, my);
    let k = 0, yaw = b.angle;
    if (len > 0) { yaw = Math.atan2(my, mx); k = 1; }
    if (b.stuck > 6 && b.og) { jump = true; b.stuck = 0; }
    b.spd = S.step(map, b, k, yaw, jump ? 1 : 0, S.speedOf(w.id, b.scoped), C.DT);
    b.moving = b.spd > 0.3; b.mv = b.spd < 0.1 ? 0 : 2;
    if (k && b.blocked) { b.stuck++; if (b.stuck > 30) { b.path = null; b.strafeDir *= -1; b.stuck = 0; } } else if (k) b.stuck = 0;
  }

  update() {
    const now = Date.now();
    this.tick++;
    if (this.state === 'play') {
      for (const p of this.players.values()) {
        if (!p.alive) { if (now >= p.respawnAt && (p.bot || p.wantSpawn || now - p.diedAt > 30000)) this.spawn(p); continue; }
        if (p.bot) this.botThink(p, now);
        else {
          if (p.queue.length > 15) p.queue.splice(0, p.queue.length - 15);
          const steps = p.queue.splice(0, p.queue.length > 4 ? 3 : 2);
          for (const inp of steps) {
            const slot = inp.w | 0;
            if (slot >= 0 && slot <= 2) this.switchSlot(p, slot, now);
            const w = this.curW(p);
            const sc = !!inp.z && !!w.scope;
            if (sc) p.scopedAt = now;
            p.scoped = sc;
            if (typeof inp.a === 'number' && isFinite(inp.a)) p.angle = inp.a;
            if (typeof inp.p === 'number' && isFinite(inp.p)) p.pitch = Math.max(-1.55, Math.min(1.55, inp.p));
            if (typeof inp.rt === 'number' && isFinite(inp.rt)) p.rt = inp.rt;
            const fl = (inp.j ? 1 : 0) | (inp.c ? 2 : 0) | (inp.wk ? 4 : 0);
            p.spd = S.step(this.map, p, inp.k | 0, p.angle, fl, S.speedOf(w.id, p.scoped), C.DT);
            p.moving = p.spd > 0.3; p.mv = p.spd < 0.1 ? 0 : (p.cr || inp.wk || p.spd < 0.6) ? 1 : 2;
            p.heavy = !!inp.h;
            const f = !!inp.f;
            if (f && !p.prevF) p.edgeAt = now;
            p.prevF = f; p.fire = f;
            if (inp.r && !p.reloadUntil && w.mag && p.ammo[p.slot] < w.mag) { p.reloadUntil = now + w.reload; p.scoped = false; }
            p.lastSeq = inp.s | 0;
          }
          if (steps.length) p.inputAt = now;
          // падение без ввода — только если клиент перестал присылать ввод (свернул вкладку), иначе ломается предсказание
          else if (!p.og && now - (p.inputAt || 0) > 400) S.step(this.map, p, 0, p.angle, p.cr ? 2 : 0, 0, C.DT);
        }
        const w = this.curW(p);
        if (p.reloadUntil && now >= p.reloadUntil) { p.ammo[p.slot] = w.mag; p.reloadUntil = 0; }
        if (!p.fire) p.spray = Math.max(0, p.spray - 0.004);
        const wantFire = p.bot ? p.fire : w.auto ? p.fire : now - p.edgeAt < 220;
        const cd = p.bot && !w.auto ? w.fire * 1.4 : w.fire;
        if (w.cat === 'knife' && p.heavy && !p.bot && now >= p.switchUntil && now - p.lastShot >= 1000) this.shoot(p, now, true);
        else if (wantFire && !p.reloadUntil && now >= p.switchUntil && now - p.lastShot >= cd) {
          if (w.cat === 'knife' || p.ammo[p.slot] > 0) { this.shoot(p, now, false); p.edgeAt = 0; }
          else if (w.mag) p.reloadUntil = now + w.reload;
        }
        if (p.z < -200) { p.hp = 0; this.kill(p, p, now, KNIFE, false); }
      }
      for (const p of this.players.values()) { p.hist.push([this.tick, p.x, p.y, p.z, p.cr]); if (p.hist.length > 24) p.hist.shift(); }
      if (this.score.A >= C.SCORE_LIMIT || this.score.B >= C.SCORE_LIMIT || now >= this.endAt) {
        this.state = 'end';
        this.winner = this.score.A === this.score.B ? 'D' : this.score.A > this.score.B ? 'A' : 'B';
        this.nextAt = now + C.INTERMISSION_MS;
      }
    } else if (now >= this.nextAt) this.setMap(this.mapIndex + 1);
    this.send(now);
  }

  send(now) {
    const pl = [];
    for (const p of this.players.values()) {
      const w = this.curW(p);
      pl.push([p.id, p.team === 'A' ? 0 : 1, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z), Math.round(p.angle * 100) / 100, Math.round(p.pitch * 100) / 100, Math.max(0, p.hp), p.alive ? 1 : 0, p.bot ? 1 : 0, w.id, p.skin, p.scoped ? 1 : 0, p.mv, p.fin[w.id] ?? -1, p.cr ? 1 : 0]);
    }
    const base = { t: 's', tk: this.tick, p: pl, sc: [this.score.A, this.score.B], tl: this.state === 'play' ? Math.max(0, this.endAt - now) : Math.max(0, this.nextAt - now), st: this.state, w: this.winner, sh: this.shots, ev: this.events };
    let roster = null;
    if (this.tick % 15 === 0 || this.events.length) roster = [...this.players.values()].map((p) => [p.id, p.name, p.team === 'A' ? 0 : 1, p.kills, p.deaths, p.bot ? 1 : 0, p.skin]);
    for (const p of this.players.values()) {
      if (p.bot || !p.client) continue;
      const w = this.curW(p);
      const msg = Object.assign({}, base, { me: { id: p.id, seq: p.lastSeq, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, og: p.og ? 1 : 0, cr: p.cr ? 1 : 0, slot: p.slot, wpn: p.weapons, ammo: p.ammo[p.slot], mag: w.mag, rl: p.reloadUntil ? Math.max(0, p.reloadUntil - now) : 0, sw: Math.max(0, p.switchUntil - now), ri: p.alive ? 0 : Math.max(0, p.respawnAt - now), ws: p.wantSpawn ? 1 : 0 } });
      if (roster) msg.r = roster;
      p.client.send(msg);
    }
    this.shots = []; this.events = [];
  }
  broadcast(obj) { for (const p of this.players.values()) if (!p.bot && p.client) p.client.send(obj); }
}

function roomList() { return [...rooms.values()].map((r) => r.info()).sort((a, b) => b.official - a.official || b.players - a.players); }
function quickRoom() {
  let best = null;
  for (const r of rooms.values()) if (!r.pass && r.humans().length < C.TEAM_SIZE * 2 && (!best || r.humans().length > best.humans().length)) best = r;
  if (!best) { best = new Room({ name: 'Быстрая игра #' + roomSeq, official: true }); rooms.set(best.id, best); }
  return best;
}

const wss = new WebSocketServer({ server, maxPayload: 8192 });
wss.on('connection', (ws) => {
  const client = { ws, room: null, me: null, admin: false, uid: '', send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  clients.add(client);
  const leave = (why) => {
    if (client.room && client.me) { const r = client.room; r.removeHuman(client.me, why); }
    client.room = null; client.me = null;
  };
  const join = (room, msg) => {
    leave();
    const name = clean(msg.name, 16) || 'Игрок';
    client.room = room; client.me = room.addHuman(client, { name, skin: msg.skin | 0, lo: msg.lo, fin: msg.fin });
    client.send({ t: 'welcome', id: client.me.id, m: room.mapIndex, room: room.info() });
  };
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'rooms': client.send({ t: 'rooms', list: roomList() }); break;
      case 'quick': join(quickRoom(), msg); break;
      case 'join': {
        const r = rooms.get(msg.room | 0);
        if (!r) return client.send({ t: 'err', msg: 'Сервер не найден' });
        if (r.pass && r.pass !== clean(msg.pass, 16) && !client.admin) return client.send({ t: 'err', msg: 'Неверный пароль' });
        if (r.humans().length >= C.TEAM_SIZE * 2) return client.send({ t: 'err', msg: 'Сервер заполнен' });
        join(r, msg); break;
      }
      case 'create': {
        if (rooms.size >= 40) return client.send({ t: 'err', msg: 'Слишком много серверов, попробуй позже' });
        const r = new Room({ name: msg.room_name, pass: msg.pass, bots: msg.bots !== false, map: msg.map | 0, owner: clean(msg.name, 16) });
        rooms.set(r.id, r); join(r, msg); break;
      }
      case 'leave': leave(); client.send({ t: 'left' }); break;
      case 'in': if (client.me) client.me.queue.push(msg); break;
      case 'lo': if (client.me) { client.me.nextLoadout = validLoadout(msg.lo); client.me.fin = validFin(msg.fin); } break;
      case 'spawn': if (client.me && !client.me.alive) { const me = client.me; if (msg.lo) me.nextLoadout = validLoadout(msg.lo); if (msg.fin) me.fin = validFin(msg.fin); me.wantSpawn = true; } break;
      case 'chat': {
        const me = client.me, r = client.room; if (!me || !r) break;
        const text = clean(msg.text, 120); const now = Date.now();
        if (!text || now - me.chatAt < 700) break;
        me.chatAt = now;
        const out = { t: 'chat', id: me.id, n: me.name, tm: me.team === 'A' ? 0 : 1, s: text, team: msg.team ? 1 : 0, dead: me.alive ? 0 : 1 };
        for (const q of r.humans()) if (q.client && (!msg.team || q.team === me.team)) q.client.send(out);
        break;
      }
      case 'ping': client.send({ t: 'pong', c: msg.c }); break;
      case 'hello': client.uid = clean(msg.uid, 40); if (client.uid) payout(client.uid); break;
      case 'market': client.send({ t: 'market', list: marketList() }); break;
      case 'sell': {
        const fid = msg.fid | 0, price = Math.floor(+msg.price);
        if (!client.uid || !S.FINISHES[fid]) return client.send({ t: 'err', msg: 'Не удалось выставить предмет' });
        if (!(price >= 10 && price <= 1000000)) return client.send({ t: 'err', msg: 'Цена от $10 до $1 000 000' });
        if (market.listings.filter((l) => l.seller === client.uid).length >= 30) return client.send({ t: 'err', msg: 'Максимум 30 лотов' });
        const l = { id: market.seq++, fid, price, seller: client.uid, sname: clean(msg.name, 16) || 'Игрок', t: Date.now() };
        market.listings.push(l); saveMarket();
        client.send({ t: 'sold_listed', id: l.id, fid }); client.send({ t: 'market', list: marketList() }); break;
      }
      case 'buy': {
        const i = market.listings.findIndex((l) => l.id === (msg.id | 0));
        if (i < 0) return client.send({ t: 'err', msg: 'Лот уже продан или снят' });
        const l = market.listings[i];
        if (l.seller === client.uid) return client.send({ t: 'err', msg: 'Это твой лот' });
        market.listings.splice(i, 1);
        const po = market.payouts[l.seller] || (market.payouts[l.seller] = { money: 0, sold: [] });
        po.money += Math.floor(l.price * (1 - MARKET_FEE)); po.sold.push({ fid: l.fid, price: l.price });
        saveMarket(); payout(l.seller);
        client.send({ t: 'bought', fid: l.fid, price: l.price }); client.send({ t: 'market', list: marketList() }); break;
      }
      case 'unlist': {
        const i = market.listings.findIndex((l) => l.id === (msg.id | 0) && l.seller === client.uid);
        if (i < 0) return client.send({ t: 'err', msg: 'Лот не найден' });
        const l = market.listings.splice(i, 1)[0]; saveMarket();
        client.send({ t: 'unlisted', fid: l.fid }); client.send({ t: 'market', list: marketList() }); break;
      }
      case 'admin': client.admin = clean(msg.pass, 64) === ADMIN_PASSWORD; client.send({ t: 'admin', ok: client.admin }); break;
      case 'adm': if (client.admin) admin(client, msg); break;
    }
  });
  ws.on('close', () => { leave(); clients.delete(client); });
});

function admin(client, m) {
  const r = rooms.get(m.room | 0);
  switch (m.cmd) {
    case 'state':
      return client.send({ t: 'adm', rooms: [...rooms.values()].map((x) => Object.assign(x.info(), { players: x.humans().map((p) => ({ id: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths })) })) });
    case 'kick': if (r) { const p = r.players.get(m.pid | 0); if (p && p.client) { const c = p.client; r.removeHuman(p, 'кикнут админом'); c.room = null; c.me = null; c.send({ t: 'kicked' }); } } break;
    case 'map': if (r) r.setMap(m.map | 0); break;
    case 'restart': if (r) r.startRound(); break;
    case 'bots': if (r) { r.bots = !!m.on; r.fillBots(); } break;
    case 'close': if (r) { for (const p of r.humans()) { const c = p.client; c.room = null; c.me = null; c.send({ t: 'kicked', msg: 'Сервер закрыт админом' }); } rooms.delete(r.id); } break;
    case 'say': { const text = clean(m.text, 120); if (text) for (const c of clients) c.send({ t: 'say', text }); break; }
  }
  admin(client, { cmd: 'state' });
}

setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (!r.humans().length) { if (now - r.emptySince > 60000) rooms.delete(r.id); continue; }
    r.update();
  }
}, 1000 / C.TICK);

server.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
