// Сервер онлайн-шутера 5 на 5. Авторитарный сервер, 30 тиков/с.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');
const { C, MAPS, WEAPONS, WKEY, SKINS } = S;

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const THREE_PATH = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.min.js');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  let fp;
  if (p === '/three.module.js') fp = THREE_PATH;
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
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1; // примерно -1..1, гуще к центру

function validLoadout(lo) {
  let p = Array.isArray(lo) ? lo[0] : -1, s = Array.isArray(lo) ? lo[1] : WKEY.usp;
  p = WEAPONS[p] && WEAPONS[p].slot === 0 ? p : -1;
  s = WEAPONS[s] && WEAPONS[s].slot === 1 ? s : WKEY.usp;
  return [p, s, KNIFE];
}

function botLoadout() {
  const prim = WEAPONS.filter((w) => w.slot === 0);
  let p;
  const r = Math.random();
  if (r < 0.05) p = WKEY.awp;
  else if (r < 0.12) p = WKEY.scout;
  else {
    const pool = prim.filter((w) => w.price <= 7000 && w.cat !== 'sniper');
    p = pool[Math.floor(Math.random() * pool.length)].id;
  }
  const pist = WEAPONS.filter((w) => w.slot === 1);
  return [p, pist[Math.floor(Math.random() * pist.length)].id, KNIFE];
}

let matchSeq = 1;
const matches = [];

class Match {
  constructor() {
    this.id = matchSeq++;
    this.players = new Map();
    this.nextId = 1;
    this.mapIndex = Math.floor(Math.random() * MAPS.length);
    this.shots = [];
    this.events = [];
    this.tickN = 0;
    this.startRound();
  }
  get map() { return MAPS[this.mapIndex]; }
  humans() { return [...this.players.values()].filter((p) => !p.bot); }
  teamCount(team, humansOnly) { let n = 0; for (const p of this.players.values()) if (p.team === team && (!humansOnly || !p.bot)) n++; return n; }

  newPlayer(name, team, bot, ws, skin, loadout) {
    const p = {
      id: this.nextId++, name, team, bot, ws,
      skin, hitR: SKINS[skin].hitR, headR: SKINS[skin].headR,
      loadout, nextLoadout: null, weapons: loadout.slice(), slot: 1,
      x: 0, y: 0, z: 0, vz: 0, og: true, angle: 0, pitch: 0, hp: C.HP, alive: false, respawnAt: 0,
      ammo: [0, 0, 0], reloadUntil: 0, switchUntil: 0, lastShot: 0, kills: 0, deaths: 0,
      queue: [], lastSeq: 0, fire: false, prevF: false, edgeAt: 0, moving: false, scoped: false, spray: 0,
      // бот
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
    let pick = list[0];
    for (const s of list) {
      const x = (s[0] + 0.5) * C.TILE, y = (s[1] + 0.5) * C.TILE;
      let free = true;
      for (const q of this.players.values()) if (q !== p && q.alive && Math.hypot(q.x - x, q.y - y) < C.R * 3) { free = false; break; }
      if (free) { pick = s; break; }
    }
    p.x = (pick[0] + 0.5) * C.TILE; p.y = (pick[1] + 0.5) * C.TILE;
    p.angle = p.team === 'A' ? 0 : Math.PI; p.pitch = 0; p.z = 0; p.vz = 0; p.og = true;
    p.hp = C.HP; p.alive = true; p.reloadUntil = 0; p.switchUntil = 0; p.queue.length = 0;
    p.scoped = false; p.spray = 0;
    p.path = null; p.tgtId = null; p.spawnProtect = Date.now() + 1500;
  }

  fillBots() {
    for (const team of ['A', 'B']) {
      while (this.teamCount(team) < C.TEAM_SIZE) {
        const used = new Set([...this.players.values()].map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has('[бот] ' + n)) || 'Бот';
        const skin = Math.floor(Math.random() * 7); // боты в мужских скинах
        this.newPlayer('[бот] ' + name, team, true, null, skin, botLoadout());
      }
      while (this.teamCount(team) > C.TEAM_SIZE) {
        const bot = [...this.players.values()].find((p) => p.team === team && p.bot);
        if (!bot) break;
        this.players.delete(bot.id);
      }
    }
  }

  addHuman(ws, name, skin, lo) {
    const a = this.teamCount('A', true), b = this.teamCount('B', true);
    const team = a <= b ? 'A' : 'B';
    const bot = [...this.players.values()].find((p) => p.team === team && p.bot);
    if (bot) this.players.delete(bot.id);
    const p = this.newPlayer(name, team, false, ws, skin, validLoadout(lo));
    this.fillBots();
    this.events.push({ t: 'msg', s: `${name} зашёл за ${team === 'A' ? 'синих' : 'красных'}` });
    return p;
  }

  removeHuman(p) {
    this.players.delete(p.id);
    this.events.push({ t: 'msg', s: `${p.name} вышел` });
    this.fillBots();
  }

  startRound() {
    this.score = { A: 0, B: 0 };
    this.endAt = Date.now() + C.MATCH_MS;
    this.state = 'play';
    this.winner = null;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; if (p.bot) p.loadout = botLoadout(); this.spawn(p); }
    this.fillBots();
    this.broadcast(JSON.stringify({ t: 'map', m: this.mapIndex }));
  }

  curW(p) { return WEAPONS[p.weapons[p.slot]] || WEAPONS[KNIFE]; }

  // Пуля/дробина в 3D: возвращает стену и попадания по игрокам
  traceShot(p, yaw, pitch, w) {
    const [dx, dy, dz] = S.dirFrom(yaw, pitch);
    const oz = p.z + C.EYE;
    const wall = S.ray3(this.map, p.x, p.y, oz, dx, dy, dz, w.range);
    const hits = [];
    for (const q of this.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const h = S.hitPlayer(p.x, p.y, oz, dx, dy, dz, q, q.hitR, q.headR);
      if (h && h.t < wall.t) hits.push({ q, t: h.t, head: h.head });
    }
    hits.sort((u, v) => u.t - v.t);
    return { dx, dy, dz, oz, wall, hits };
  }

  shoot(p, now) {
    const w = this.curW(p);
    const wid = w.id;
    p.lastShot = now;
    if (w.cat === 'knife') {
      let best = null, bd = 1e9;
      for (const q of this.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const d = dist(p, q);
        if (d > w.range + q.hitR || Math.abs(q.z - p.z) > 30) continue;
        const a = Math.atan2(q.y - p.y, q.x - p.x);
        if (Math.abs(angDiff(p.angle, a)) > 0.9) continue;
        if (!this.los(p, q, d)) continue;
        if (d < bd) { bd = d; best = q; }
      }
      const ex = best ? best.x : p.x + Math.cos(p.angle) * w.range, ey = best ? best.y : p.y + Math.sin(p.angle) * w.range;
      this.shots.push([Math.round(p.x), Math.round(p.y), Math.round(p.z + C.EYE), Math.round(ex), Math.round(ey), Math.round(p.z + 28), 2, best ? 1 : 2, wid, p.id, 1, 0]);
      if (best) this.damage(p, best, w.dmg, wid, now, false);
      return;
    }
    p.ammo[p.slot]--;
    const scoped = p.scoped && w.scope;
    let base = scoped ? w.sspread : p.moving ? w.mspread : w.spread;
    base += p.spray;
    if (p.bot) base = base * 1.6 + 0.015;
    p.spray = Math.min(0.07, p.spray + w.recoil);
    for (let i = 0; i < w.pellets; i++) {
      const yaw = p.angle + gauss() * base, pitch = p.pitch + gauss() * base * 0.8 + (w.cat === 'knife' ? 0 : p.spray * 0.6);
      const tr = this.traceShot(p, yaw, pitch, w);
      let endT = tr.wall.t, flag = tr.wall.n ? 0 : 2, nrm = tr.wall.n;
      let dmg = w.dmg;
      const targets = w.pierce ? tr.hits : tr.hits.slice(0, 1);
      if (targets.length) {
        if (!w.pierce) { endT = targets[0].t; flag = 1; }
        for (const h of targets) {
          const fall = w.cat === 'shotgun' ? Math.max(0.35, 1 - h.t / w.range) : 1;
          this.damage(p, h.q, dmg * fall * (h.head ? C.HEAD_MULT : 1), wid, now, h.head);
          if (w.pierce) dmg *= 0.85;
        }
      }
      const nn = nrm ? (nrm[0] ? (nrm[0] > 0 ? 1 : 2) : nrm[1] ? (nrm[1] > 0 ? 3 : 4) : nrm[2] > 0 ? 5 : 6) : 0;
      const ex = p.x + tr.dx * endT, ey = p.y + tr.dy * endT, ez = tr.oz + tr.dz * endT;
      this.shots.push([Math.round(p.x), Math.round(p.y), Math.round(tr.oz), Math.round(ex), Math.round(ey), Math.round(ez), nn, flag, wid, p.id, i === 0 ? 1 : 0, targets[0] && targets[0].head ? 1 : 0]);
      if (w.pierce) for (const h of targets) this.shots.push([0, 0, 0, Math.round(p.x + tr.dx * h.t), Math.round(p.y + tr.dy * h.t), Math.round(tr.oz + tr.dz * h.t), 0, 3, wid, p.id, 0, h.head ? 1 : 0]);
    }
    if (w.scope === 2) p.scoped = false; // снайперки выходят из прицела после выстрела (как в CS)
  }

  damage(p, q, dmg, wid, now, head) {
    if (q.spawnProtect > now || !q.alive) return;
    q.hp -= Math.round(dmg);
    if (q.hp <= 0) this.kill(p, q, now, wid, head);
  }

  kill(killer, victim, now, wid, head) {
    victim.alive = false; victim.hp = 0; victim.respawnAt = now + C.RESPAWN_MS; victim.deaths++;
    killer.kills++;
    this.score[killer.team]++;
    this.events.push({ t: 'kill', k: killer.id, v: victim.id, kn: killer.name, vn: victim.name, kt: killer.team, vt: victim.team, w: wid, hs: head ? 1 : 0 });
  }

  findPath(fromX, fromY, goal) {
    const map = this.map, W = map.W;
    const sx = Math.floor(fromX / C.TILE), sy = Math.floor(fromY / C.TILE);
    const start = sy * W + sx, end = goal[1] * W + goal[0];
    const prev = new Int32Array(W * map.H).fill(-1);
    prev[start] = start;
    const q = [start];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i];
      if (cur === end) break;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (S.isWall(map, nx, ny)) continue;
        const ni = ny * W + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (prev[end] === -1) return null;
    const out = [];
    for (let c = end; c !== start; c = prev[c]) out.push([((c % W) + 0.5) * C.TILE, (((c / W) | 0) + 0.5) * C.TILE]);
    return out.reverse();
  }

  botThink(b, now) {
    const map = this.map;
    // смена оружия: если основное пустое и идёт перезарядка — достать пистолет
    if (b.weapons[0] >= 0 && b.slot !== 0 && !b.tgtId) this.switchSlot(b, 0, now);
    let tgt = null, bd = 1e9;
    for (const q of this.players.values()) {
      if (q.team === b.team || !q.alive) continue;
      const d = dist(b, q);
      if (d > 1100 || d >= bd) continue;
      if (this.los(b, q, d)) { tgt = q; bd = d; }
    }
    const w = this.curW(b);
    let mx = 0, my = 0;
    b.scoped = false;
    if (tgt) {
      if (b.tgtId !== tgt.id) { b.tgtId = tgt.id; b.seenAt = now; b.aimJitter = (Math.random() - 0.5) * 0.5; }
      if (b.slot === 0 && b.ammo[0] === 0 && b.weapons[1] >= 0 && b.ammo[1] > 0) this.switchSlot(b, 1, now);
      b.aimJitter *= 0.93;
      const want = Math.atan2(tgt.y - b.y, tgt.x - b.x) + b.aimJitter;
      const d = angDiff(b.angle, want);
      const maxTurn = 6 * C.DT;
      b.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
      const wantP = Math.atan2(tgt.z + 30 - (b.z + C.EYE), bd) + b.aimJitter * 0.3;
      b.pitch += (wantP - b.pitch) * 0.3;
      const sniper = w.cat === 'sniper';
      b.fire = now - b.seenAt > (sniper ? 700 : 380) && Math.abs(d) < (sniper ? 0.06 : 0.18);
      if (sniper) { b.scoped = true; }
      else {
        if (now > b.strafeUntil) { b.strafeDir = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + 400 + Math.random() * 900; }
        mx = Math.cos(want + Math.PI / 2) * b.strafeDir * 0.7;
        my = Math.sin(want + Math.PI / 2) * b.strafeDir * 0.7;
        const close = w.cat === 'shotgun' ? 250 : w.cat === 'smg' ? 380 : 480;
        if (bd > close) { mx += Math.cos(want) * 0.6; my += Math.sin(want) * 0.6; }
      }
      b.path = null;
    } else {
      b.tgtId = null; b.fire = false;
      if (!b.path || !b.path.length || now > b.repathAt) {
        const enemy = b.team === 'A' ? 'B' : 'A';
        const pool = Math.random() < 0.45 ? map.spawns[enemy] : map.floor;
        const goal = pool[Math.floor(Math.random() * pool.length)];
        b.path = this.findPath(b.x, b.y, goal) || [];
        b.repathAt = now + 6000 + Math.random() * 4000;
      }
      if (b.path.length) {
        const [nx, ny] = b.path[0];
        if (Math.hypot(nx - b.x, ny - b.y) < 8) b.path.shift();
        else { const a = Math.atan2(ny - b.y, nx - b.x); mx = Math.cos(a); my = Math.sin(a); }
        const look = Math.atan2(my, mx);
        if (mx || my) b.angle += Math.max(-0.2, Math.min(0.2, angDiff(b.angle, look)));
        b.pitch *= 0.8;
      }
      if (w.mag && b.ammo[b.slot] < w.mag && !b.reloadUntil) b.reloadUntil = now + w.reload;
    }
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const sp = S.speedOf(w.id, b.scoped) * C.DT;
      const ox = b.x, oy = b.y;
      const r = S.move(map, b.x, b.y, mx * sp, my * sp, C.R, b.z);
      b.x = r.x; b.y = r.y;
      b.moving = true;
      if (Math.hypot(b.x - ox, b.y - oy) < 0.5) { if (++b.stuck > 12) { b.path = null; b.stuck = 0; b.strafeDir *= -1; } }
      else b.stuck = 0;
    } else b.moving = false;
  }

  los(a, q, d) {
    const ox = a.x, oy = a.y, oz = a.z + C.EYE;
    for (const hz of [q.z + 39, q.z + 22]) {
      const dx = q.x - ox, dy = q.y - oy, dz = hz - oz, L = Math.hypot(dx, dy, dz);
      if (S.ray3(this.map, ox, oy, oz, dx / L, dy / L, dz / L, L).t >= L - 2) return true;
    }
    return false;
  }

  switchSlot(p, slot, now) {
    if (slot === p.slot || p.weapons[slot] == null || p.weapons[slot] < 0) return;
    p.slot = slot; p.reloadUntil = 0; p.scoped = false; p.spray = 0;
    p.switchUntil = now + 350;
  }

  tick() {
    const now = Date.now();
    this.tickN++;
    if (this.state === 'play') {
      for (const p of this.players.values()) {
        if (!p.alive) { if (now >= p.respawnAt) this.spawn(p); continue; }
        if (p.bot) this.botThink(p, now);
        else {
          if (p.queue.length > 8) p.queue.splice(0, p.queue.length - 8);
          const steps = p.queue.splice(0, 3);
          p.moving = false;
          for (const inp of steps) {
            const slot = inp.w | 0;
            if (slot >= 0 && slot <= 2) this.switchSlot(p, slot, now);
            const w = this.curW(p);
            p.scoped = !!inp.z && !!w.scope;
            if (typeof inp.a === 'number' && isFinite(inp.a)) p.angle = inp.a;
            if (typeof inp.p === 'number' && isFinite(inp.p)) p.pitch = Math.max(-1.55, Math.min(1.55, inp.p));
            if (S.step(this.map, p, inp.k | 0, p.angle, !!inp.j, S.speedOf(w.id, p.scoped), C.DT)) p.moving = true;
            const f = !!inp.f;
            if (f && !p.prevF) p.edgeAt = now;
            p.prevF = f; p.fire = f;
            if (inp.r && !p.reloadUntil && w.mag && p.ammo[p.slot] < w.mag) { p.reloadUntil = now + w.reload; p.scoped = false; }
            p.lastSeq = inp.s | 0;
          }
        }
        const w = this.curW(p);
        if (p.reloadUntil && now >= p.reloadUntil) { p.ammo[p.slot] = w.mag; p.reloadUntil = 0; }
        if (!p.fire) p.spray = Math.max(0, p.spray - 0.004);
        const wantFire = p.bot ? p.fire : w.auto ? p.fire : now - p.edgeAt < 220;
        const cd = p.bot && !w.auto ? w.fire * 1.4 : w.fire;
        if (wantFire && !p.reloadUntil && now >= p.switchUntil && now - p.lastShot >= cd) {
          if (w.cat === 'knife' || p.ammo[p.slot] > 0) { this.shoot(p, now); p.edgeAt = 0; }
          else if (w.mag) p.reloadUntil = now + w.reload;
        }
      }
      if (this.score.A >= C.SCORE_LIMIT || this.score.B >= C.SCORE_LIMIT || now >= this.endAt) {
        this.state = 'end';
        this.winner = this.score.A === this.score.B ? 'D' : this.score.A > this.score.B ? 'A' : 'B';
        this.nextAt = now + C.INTERMISSION_MS;
      }
    } else if (now >= this.nextAt) {
      this.mapIndex = (this.mapIndex + 1) % MAPS.length;
      this.startRound();
    }
    this.send(now);
  }

  send(now) {
    const pl = [];
    for (const p of this.players.values())
      pl.push([p.id, p.team === 'A' ? 0 : 1, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z), Math.round(p.angle * 100) / 100, Math.round(p.pitch * 100) / 100, Math.max(0, p.hp), p.alive ? 1 : 0, p.bot ? 1 : 0, this.curW(p).id, p.skin, p.scoped ? 1 : 0, p.moving ? 1 : 0]);
    const base = {
      t: 's', p: pl, sc: [this.score.A, this.score.B],
      tl: this.state === 'play' ? Math.max(0, this.endAt - now) : Math.max(0, this.nextAt - now),
      st: this.state, w: this.winner, sh: this.shots, ev: this.events,
    };
    let roster = null;
    if (this.tickN % 15 === 0 || this.events.length) {
      roster = [...this.players.values()].map((p) => [p.id, p.name, p.team === 'A' ? 0 : 1, p.kills, p.deaths, p.bot ? 1 : 0, p.skin]);
    }
    for (const p of this.players.values()) {
      if (p.bot || !p.ws || p.ws.readyState !== 1) continue;
      const w = this.curW(p);
      const msg = Object.assign({}, base, {
        me: {
          id: p.id, seq: p.lastSeq, x: p.x, y: p.y, z: p.z, vz: p.vz, og: p.og ? 1 : 0, slot: p.slot, wpn: p.weapons, ammo: p.ammo[p.slot], mag: w.mag,
          rl: p.reloadUntil ? Math.max(0, p.reloadUntil - now) : 0, sw: Math.max(0, p.switchUntil - now),
          ri: p.alive ? 0 : Math.max(0, p.respawnAt - now),
        },
      });
      if (roster) msg.r = roster;
      p.ws.send(JSON.stringify(msg));
    }
    this.shots = [];
    this.events = [];
  }

  broadcast(str) {
    for (const p of this.players.values()) if (!p.bot && p.ws && p.ws.readyState === 1) p.ws.send(str);
  }
}

const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', (ws) => {
  let match = null, me = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !me) {
      const name = String(msg.name || 'Игрок').replace(/[<>]/g, '').trim().slice(0, 16) || 'Игрок';
      const skin = SKINS[msg.skin] ? msg.skin | 0 : 0;
      match = matches.find((m) => m.humans().length < C.TEAM_SIZE * 2);
      if (!match) { match = new Match(); matches.push(match); }
      me = match.addHuman(ws, name, skin, msg.lo);
      ws.send(JSON.stringify({ t: 'welcome', id: me.id, m: match.mapIndex, room: match.id }));
    } else if (msg.t === 'in' && me) {
      me.queue.push(msg);
    } else if (msg.t === 'lo' && me) {
      me.nextLoadout = validLoadout(msg.lo);
    } else if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', c: msg.c }));
    }
  });
  ws.on('close', () => {
    if (match && me) {
      match.removeHuman(me);
      if (match.humans().length === 0) matches.splice(matches.indexOf(match), 1);
    }
  });
});

setInterval(() => { for (const m of matches) m.tick(); }, 1000 / C.TICK);

server.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
