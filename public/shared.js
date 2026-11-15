// Общий код для сервера и клиента (3D-версия): карты, физика, лучи, оружие, скины.
// Единицы — «пиксели» сервера: 1 клетка = 48 = 2 метра, 24 = 1 метр. Ось z — высота.
(function (root) {
  const C = {
    TILE: 48, TICK: 30, DT: 1 / 30,
    SPEED: 125, R: 9, PH: 43, EYE: 38, JUMP_V: 245, G: 820,
    WALL_H: 72,
    HP: 100, RESPAWN_MS: 3000, SCORE_LIMIT: 50, MATCH_MS: 5 * 60 * 1000, INTERMISSION_MS: 8000, TEAM_SIZE: 5,
    START_MONEY: 3000, WIN_BONUS: 1500, LOSE_BONUS: 600,
    HEAD_MULT: 4,
  };
  // Типы клеток
  const T = { OUT: 0, WALL: 1, IN: 2, DOOR: 3, WIN: 4, CRATE: 5, TALL: 6 };
  // Твёрдые диапазоны высот по типам [низ, верх]
  const SOLID = {
    0: [], 1: [[0, 72]], 2: [[72, 90]], 3: [[53, 90]], 4: [[0, 22], [50, 90]], 5: [[0, 26]], 6: [[0, 52]],
  };
  const CRATE_TOP = 26;
  const CH = { '#': T.WALL, '.': T.OUT, 'A': T.OUT, ',': T.IN, 'D': T.DOOR, 'w': T.WIN, 'c': T.CRATE, 'C': T.TALL };

  // Левая половина (20 символов), правая — зеркало, A -> B.
  // # стена, . улица, , пол в доме (с крышей), D дверь, w окно, c ящик (можно запрыгнуть), C высокий ящик
  const DEFS = [
    {
      name: 'Деревня', theme: 'village',
      half: [
        '####################',
        '#AA.................',
        '#AA..#####w####.....',
        '#AA..#,,,,,,,,#..c..',
        '#....w,,,,,,,,D..c..',
        '#....#,,,,,,,,#.....',
        '#....###D######.....',
        '#.c.................',
        '#.cc.........#ww####',
        '#............#,,,,,,',
        '#..#w#D##....D,,,,,,',
        '#..#,,,,#....#,,,,,,',
        '#..w,,,,w....w,,,,,,',
        '#..#,,,,#....#,,,,,,',
        '#..##D###....D,,,,,,',
        '#............#,,,,,,',
        '#..c.........#ww####',
        '#.cC................',
        '#....###D######.....',
        '#....#,,,,,,,,#..c..',
        '#AA..w,,,,,,,,D..cC.',
        '#AA..#,,,,,,,,#.....',
        '#AA.......c.........',
        '####################',
      ],
    },
    {
      name: 'Пустыня', theme: 'desert',
      half: [
        '####################',
        '#AAA......#.........',
        '#AAA......#..####D##',
        '#.........#..#,,,,,,',
        '#..#####..#..w,,,,,,',
        '#..#,,,D.....#,,,,,,',
        '#..#,,,#.....###w###',
        '#..##w##............',
        '#...........c.......',
        '######..C...cc....##',
        '#.........#.......#,',
        '#.........#.......D,',
        '#...####..#.......#,',
        '#...#,,w..####....#,',
        '#...D,,#..........##',
        '#...####......c.....',
        '#.............cC....',
        '######..#####.......',
        '#.......#,,,#..####.',
        '#.......D,,,w..#,,D.',
        '#..cc...#,,,#..#,,#.',
        '#AAA....##D##..####.',
        '#AAA................',
        '####################',
      ],
    },
    {
      name: 'Город', theme: 'city',
      half: [
        '####################',
        '#AA.................',
        '#AA.####w####..#####',
        '#...#,,,,,,,#..#,,,,',
        '#...w,,,,,,,D..D,,,,',
        '#...#,,,,,,,#..#,,,,',
        '#...###D#####..##w##',
        '#...................',
        '#..c.....C..........',
        '####..#w##D#..c.....',
        '#.....#,,,,#........',
        '#.....w,,,,#..######',
        '#.....#,,,,D..D,,,,,',
        '#.....######..#,,,,,',
        '#.............#,,,,,',
        '#..cC.........###w##',
        '#...................',
        '#...#####D###...c...',
        '#...#,,,,,,,#...cc..',
        '#...w,,,,,,,w.......',
        '#...#,,,,,,,#..#####',
        '#AA.#####D###..D,,,,',
        '#AA............#,,,,',
        '####################',
      ],
    },
  ];

  function buildMap(def) {
    const rows = def.half.map((h) => {
      h = h.padEnd(20, '.').slice(0, 20);
      return h + h.split('').reverse().map((c) => (c === 'A' ? 'B' : c)).join('');
    });
    const H = rows.length, W = rows[0].length;
    const grid = new Uint8Array(W * H);
    const spawns = { A: [], B: [] };
    const floor = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = rows[y][x];
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c = '#';
      const t = CH[c] ?? T.OUT;
      grid[y * W + x] = t;
      if (c === 'A' || c === 'B') spawns[c].push([x, y]);
      if (t === T.OUT || t === T.IN || t === T.DOOR) floor.push([x, y]);
    }
    return { name: def.name, theme: def.theme, W, H, grid, spawns, floor, pw: W * C.TILE, ph: H * C.TILE };
  }
  const MAPS = DEFS.map(buildMap);

  function tileAt(map, tx, ty) { if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return T.WALL; return map.grid[ty * map.W + tx]; }
  // Для ботов и путей: проходима ли клетка пешком
  function walkable(t) { return t === T.OUT || t === T.IN || t === T.DOOR; }
  function isWall(map, tx, ty) { return !walkable(tileAt(map, tx, ty)); }

  function blocksBody(t, z) {
    if (t === T.WALL || t === T.WIN || t === T.TALL) return true;
    if (t === T.CRATE) return z < CRATE_TOP - 4;
    return false;
  }
  function collides(map, x, y, r, z) {
    const TL = C.TILE;
    const x0 = Math.floor((x - r) / TL), x1 = Math.floor((x + r) / TL);
    const y0 = Math.floor((y - r) / TL), y1 = Math.floor((y + r) / TL);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (blocksBody(tileAt(map, tx, ty), z)) return true;
    return false;
  }
  function groundAt(map, x, y, r, z) {
    const TL = C.TILE;
    const x0 = Math.floor((x - r) / TL), x1 = Math.floor((x + r) / TL);
    const y0 = Math.floor((y - r) / TL), y1 = Math.floor((y + r) / TL);
    let g = 0;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(map, tx, ty) === T.CRATE && z >= CRATE_TOP - 4) g = CRATE_TOP;
    return g;
  }
  function move(map, x, y, dx, dy, r, z) {
    const TL = C.TILE;
    if (dx) {
      let nx = x + dx;
      if (collides(map, nx, y, r, z)) {
        if (dx > 0) nx = Math.floor((nx + r) / TL) * TL - r - 0.01; else nx = (Math.floor((nx - r) / TL) + 1) * TL + r + 0.01;
        if (collides(map, nx, y, r, z)) nx = x;
      }
      x = nx;
    }
    if (dy) {
      let ny = y + dy;
      if (collides(map, x, ny, r, z)) {
        if (dy > 0) ny = Math.floor((ny + r) / TL) * TL - r - 0.01; else ny = (Math.floor((ny - r) / TL) + 1) * TL + r + 0.01;
        if (collides(map, x, ny, r, z)) ny = y;
      }
      y = ny;
    }
    return { x, y };
  }

  // Направление движения из клавиш (1=W 2=S 4=A 8=D) относительно взгляда yaw
  function moveDir(k, yaw) {
    let f = 0, s = 0;
    if (k & 1) f += 1; if (k & 2) f -= 1; if (k & 8) s += 1; if (k & 4) s -= 1;
    if (!f && !s) return [0, 0];
    const len = Math.hypot(f, s); f /= len; s /= len;
    return [Math.cos(yaw) * f + Math.cos(yaw + Math.PI / 2) * s, Math.sin(yaw) * f + Math.sin(yaw + Math.PI / 2) * s];
  }

  // Один шаг физики игрока. st: {x,y,z,vz,og}
  function step(map, st, k, yaw, jump, speed, dt) {
    const [mx, my] = moveDir(k, yaw);
    if (mx || my) { const r = move(map, st.x, st.y, mx * speed * dt, my * speed * dt, C.R, st.z); st.x = r.x; st.y = r.y; }
    const g = groundAt(map, st.x, st.y, C.R, st.z);
    if (st.og && jump) { st.vz = C.JUMP_V; st.og = false; }
    if (!st.og || st.z > g) {
      st.vz -= C.G * dt; st.z += st.vz * dt;
      if (st.z <= g) { st.z = g; st.vz = 0; st.og = true; } else st.og = false;
    }
    return !!(mx || my);
  }

  // 3D-луч по карте. Возвращает {t, n:[nx,ny,nz]} (нормаль поверхности) или t=max.
  function ray3(map, ox, oy, oz, dx, dy, dz, max) {
    const TL = C.TILE;
    let tx = Math.floor(ox / TL), ty = Math.floor(oy / TL);
    const sX = dx > 0 ? 1 : -1, sY = dy > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(TL / dx) : Infinity, tDY = dy !== 0 ? Math.abs(TL / dy) : Infinity;
    let tMX = dx > 0 ? ((tx + 1) * TL - ox) / dx : dx < 0 ? (ox - tx * TL) / -dx : Infinity;
    let tMY = dy > 0 ? ((ty + 1) * TL - oy) / dy : dy < 0 ? (oy - ty * TL) / -dy : Infinity;
    let tIn = 0, side = [0, 0, 0];
    for (let i = 0; i < 300 && tIn < max; i++) {
      const tOut = Math.min(tMX, tMY, max);
      const t = tileAt(map, tx, ty);
      const zA = oz + dz * tIn, zB = oz + dz * tOut;
      let best = Infinity, n = null;
      for (const [z0, z1] of SOLID[t]) {
        if (zA >= z0 && zA <= z1) { if (tIn < best) { best = tIn; n = side; } }
        else if (zA > z1 && zB < z1) { const tt = tIn + ((zA - z1) / (zA - zB)) * (tOut - tIn); if (tt < best) { best = tt; n = [0, 0, 1]; } }
        else if (zA < z0 && zB > z0) { const tt = tIn + ((z0 - zA) / (zB - zA)) * (tOut - tIn); if (tt < best) { best = tt; n = [0, 0, -1]; } }
      }
      if (zB < 0 && dz < 0) { const tt = -oz / dz; if (tt < best) { best = tt; n = [0, 0, 1]; } }
      if (best < Infinity) return { t: best, n };
      if (tOut >= max) break;
      if (tMX < tMY) { tIn = tMX; tMX += tDX; tx += sX; side = [-sX, 0, 0]; }
      else { tIn = tMY; tMY += tDY; ty += sY; side = [0, -sY, 0]; }
    }
    return { t: max, n: null };
  }

  // Попадание луча в игрока: тело — вертикальный цилиндр, голова — сфера
  function hitPlayer(ox, oy, oz, dx, dy, dz, q, br, hr) {
    let best = Infinity, head = false;
    // голова
    const hx = q.x - ox, hy = q.y - oy, hz = q.z + 39 - oz;
    const pb = hx * dx + hy * dy + hz * dz;
    const d2 = hx * hx + hy * hy + hz * hz - pb * pb;
    if (pb > 0 && d2 < hr * hr) { best = pb - Math.sqrt(hr * hr - d2); head = true; }
    // тело
    const a = dx * dx + dy * dy;
    if (a > 1e-6) {
      const fx = ox - q.x, fy = oy - q.y;
      const b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - br * br;
      const disc = b * b - 4 * a * c;
      if (disc > 0) {
        const sq = Math.sqrt(disc);
        let t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a);
        let z0 = -Infinity, z1 = Infinity;
        if (Math.abs(dz) > 1e-6) { z0 = (q.z - oz) / dz; z1 = (q.z + 34 - oz) / dz; if (z0 > z1) [z0, z1] = [z1, z0]; }
        else if (oz < q.z || oz > q.z + 34) { z0 = Infinity; }
        const lo = Math.max(t0, z0, 0), hi = Math.min(t1, z1);
        if (lo <= hi && lo < best) { best = lo; head = false; }
      }
    }
    return best < Infinity ? { t: best, head } : null;
  }

  // ---------- Оружие (арсенал CS 1.6) ----------
  // slot: 0 основное, 1 пистолет, 2 нож
  const WDEF = { slot: 0, price: 0, dmg: 20, fire: 100, mag: 30, reload: 2500, spread: 0.035, mspread: 0.07, sspread: 0, speed: 0.95, auto: true, pellets: 1, range: 1600, scope: 0, pierce: false, reward: 300, recoil: 0.004 };
  const WLIST = [
    { key: 'knife', name: 'Нож', cat: 'knife', slot: 2, dmg: 55, fire: 420, mag: 0, reload: 0, spread: 0, mspread: 0, speed: 1.06, range: 32, reward: 1500, recoil: 0 },
    { key: 'glock', name: 'Glock-18', cat: 'pistol', slot: 1, dmg: 18, fire: 140, mag: 20, reload: 2200, spread: 0.04, mspread: 0.06, speed: 1, auto: false, range: 1100, recoil: 0.006 },
    { key: 'usp', name: 'USP', cat: 'pistol', slot: 1, dmg: 25, fire: 170, mag: 12, reload: 2400, spread: 0.03, mspread: 0.05, speed: 1, auto: false, range: 1200, recoil: 0.007 },
    { key: 'p228', name: 'P228', cat: 'pistol', slot: 1, price: 1200, dmg: 28, fire: 165, mag: 13, reload: 2500, spread: 0.03, mspread: 0.055, speed: 1, auto: false, range: 1200, recoil: 0.007 },
    { key: 'fiveseven', name: 'Five-SeveN', cat: 'pistol', slot: 1, price: 1500, dmg: 25, fire: 140, mag: 20, reload: 2800, spread: 0.028, mspread: 0.05, speed: 1, auto: false, range: 1200, recoil: 0.006 },
    { key: 'elite', name: 'Dual Berettas', cat: 'dual', slot: 1, price: 1600, dmg: 24, fire: 115, mag: 30, reload: 3800, spread: 0.05, mspread: 0.07, speed: 1, auto: false, range: 1100, recoil: 0.007 },
    { key: 'deagle', name: 'Desert Eagle', cat: 'pistol', slot: 1, price: 1900, dmg: 52, fire: 300, mag: 7, reload: 2100, spread: 0.033, mspread: 0.09, speed: 1, auto: false, range: 1500, recoil: 0.02 },
    { key: 'tmp', name: 'TMP', cat: 'smg', price: 2500, dmg: 16, fire: 68, mag: 30, reload: 2100, spread: 0.05, mspread: 0.06, speed: 0.98, range: 1100, reward: 600 },
    { key: 'mac10', name: 'MAC-10', cat: 'smg', price: 2800, dmg: 18, fire: 72, mag: 30, reload: 3100, spread: 0.06, mspread: 0.07, speed: 0.98, range: 1000, reward: 600 },
    { key: 'mp5', name: 'MP5', cat: 'smg', price: 3000, dmg: 20, fire: 80, mag: 30, reload: 2600, spread: 0.038, mspread: 0.055, speed: 0.97, range: 1200, reward: 600 },
    { key: 'ump45', name: 'UMP45', cat: 'smg', price: 3400, dmg: 25, fire: 105, mag: 25, reload: 3500, spread: 0.04, mspread: 0.06, speed: 0.96, range: 1200, reward: 600 },
    { key: 'p90', name: 'P90', cat: 'smg', price: 4700, dmg: 20, fire: 68, mag: 50, reload: 3300, spread: 0.042, mspread: 0.06, speed: 0.96, range: 1200, reward: 300 },
    { key: 'm3', name: 'M3 Super 90', cat: 'shotgun', price: 3400, dmg: 15, pellets: 9, fire: 880, mag: 8, reload: 3000, spread: 0.13, mspread: 0.15, speed: 0.92, auto: false, range: 650, reward: 900, recoil: 0 },
    { key: 'xm1014', name: 'XM1014', cat: 'shotgun', price: 6000, dmg: 12, pellets: 8, fire: 260, mag: 7, reload: 2800, spread: 0.12, mspread: 0.14, speed: 0.92, range: 600, reward: 900, recoil: 0 },
    { key: 'galil', name: 'Galil', cat: 'rifle', price: 4000, dmg: 23, fire: 95, mag: 35, reload: 2900, spread: 0.035, mspread: 0.08, speed: 0.9 },
    { key: 'famas', name: 'FAMAS', cat: 'rifle', price: 4500, dmg: 24, fire: 92, mag: 25, reload: 3300, spread: 0.03, mspread: 0.075, speed: 0.9 },
    { key: 'ak47', name: 'AK-47', cat: 'rifle', price: 5000, dmg: 33, fire: 100, mag: 30, reload: 2400, spread: 0.034, mspread: 0.1, speed: 0.88, recoil: 0.006 },
    { key: 'm4a1', name: 'M4A1', cat: 'rifle', price: 6200, dmg: 28, fire: 92, mag: 30, reload: 3100, spread: 0.025, mspread: 0.075, speed: 0.9 },
    { key: 'sg552', name: 'SG 552', cat: 'rifle', price: 7000, dmg: 30, fire: 92, mag: 30, reload: 3000, spread: 0.026, mspread: 0.08, sspread: 0.012, scope: 1, speed: 0.86 },
    { key: 'aug', name: 'AUG', cat: 'rifle', price: 7000, dmg: 29, fire: 95, mag: 30, reload: 3300, spread: 0.024, mspread: 0.075, sspread: 0.01, scope: 1, speed: 0.87 },
    { key: 'scout', name: 'Scout', cat: 'sniper', price: 5500, dmg: 85, fire: 1250, mag: 10, reload: 2000, spread: 0.07, mspread: 0.12, sspread: 0.004, scope: 2, speed: 0.98, auto: false, range: 2200, recoil: 0 },
    { key: 'm249', name: 'M249', cat: 'mg', price: 11500, dmg: 27, fire: 78, mag: 100, reload: 4800, spread: 0.05, mspread: 0.1, speed: 0.8, range: 1500, recoil: 0.003 },
    { key: 'awp', name: 'AWP', cat: 'sniper', price: 15000, dmg: 150, fire: 1450, mag: 10, reload: 3000, spread: 0.13, mspread: 0.2, sspread: 0, scope: 2, speed: 0.82, auto: false, range: 2600, pierce: true, reward: 100, recoil: 0 },
  ];
  const WEAPONS = WLIST.map((w, i) => Object.assign({}, WDEF, w, { id: i }));
  const WKEY = {}; WEAPONS.forEach((w) => (WKEY[w.key] = w.id));

  // ---------- Скины ----------
  // hitR — радиус попадания. У женских скинов он меньше.
  const SKINS = [
    { key: 'recruit', name: 'Новобранец', price: 0, shirt: '#5b6b4a', vest: '#414c35', boots: '#2b2a26', skin: '#e0b089', hair: '#3b2a1a', hat: 'none', trail: '#d7e0c8' },
    { key: 'spetsnaz', name: 'Спецназ', price: 3000, shirt: '#2f3640', vest: '#1c2128', boots: '#15181c', skin: '#d9a77c', hair: '#2a2018', hat: 'helmet', hatColor: '#353c45', trail: '#90caf9' },
    { key: 'desert', name: 'Пустынный лис', price: 4500, shirt: '#c8a46a', vest: '#8d6e3f', boots: '#5a4126', skin: '#c68e5e', hair: '#1f160f', hat: 'cap', hatColor: '#a8834d', trail: '#ffcc80' },
    { key: 'urban', name: 'Городской', price: 6000, shirt: '#6d7480', vest: '#3a3e46', boots: '#1d1f23', skin: '#e8bd98', hair: '#5a3a22', hat: 'beanie', hatColor: '#1e1e22', trail: '#b0bec5' },
    { key: 'arctic', name: 'Арктика', price: 8000, shirt: '#e6edf1', vest: '#9fb3c0', boots: '#6f7f8a', skin: '#f0c9a6', hair: '#c9a46a', hat: 'helmet', hatColor: '#dfe7ec', trail: '#e1f5fe' },
    { key: 'night', name: 'Ночной охотник', price: 10000, shirt: '#1b1b22', vest: '#2e2e3c', boots: '#0d0d10', skin: '#d4a27a', hair: '#111', hat: 'mask', hatColor: '#121216', trail: '#b388ff' },
    { key: 'gold', name: 'Золотой', price: 13000, shirt: '#d4af37', vest: '#8c6d1f', boots: '#3d2f0c', skin: '#e0b089', hair: '#2a1d10', hat: 'helmet', hatColor: '#e6c14f', trail: '#ffd54f' },
    { key: 'lisa', name: 'Агент Лиза', price: 16000, female: true, shirt: '#263238', vest: '#3b4b53', boots: '#111', skin: '#f2c8a4', hair: '#f0cf6a', hat: 'none', trail: '#f48fb1' },
    { key: 'eva', name: 'Снайпер Ева', price: 20000, female: true, shirt: '#4e5d3a', vest: '#33402a', boots: '#2a2a20', skin: '#e3b28c', hair: '#7b3f1d', hat: 'none', trail: '#a5d6a7' },
    { key: 'valkyrie', name: 'Валькирия', price: 25000, female: true, shirt: '#7a1f2b', vest: '#3a0f15', boots: '#1a0a0c', skin: '#f5d2b5', hair: '#ececec', hat: 'none', trail: '#ff8a80' },
  ].map((s, i) => Object.assign({ id: i, female: false, hitR: s.female ? 7.5 : 10, headR: s.female ? 4.8 : 5.5 }, s));
  const SKEY = {}; SKINS.forEach((s) => (SKEY[s.key] = s.id));

  function speedOf(wid, scoped) {
    const w = WEAPONS[wid] || WEAPONS[0];
    return C.SPEED * w.speed * (scoped && w.scope ? 0.6 : 1);
  }
  function dirFrom(yaw, pitch) { const cp = Math.cos(pitch); return [Math.cos(yaw) * cp, Math.sin(yaw) * cp, Math.sin(pitch)]; }

  const api = { C, T, SOLID, CRATE_TOP, MAPS, WEAPONS, WKEY, SKINS, SKEY, tileAt, walkable, isWall, collides, groundAt, move, moveDir, step, ray3, hitPlayer, speedOf, dirFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
