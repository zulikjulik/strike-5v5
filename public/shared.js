// Общий код для сервера и клиента: карты, константы, коллизии, лучи.
(function (root) {
  const C = {
    TILE: 48,
    TICK: 30,
    DT: 1 / 30,
    SPEED: 230,
    R: 14,
    HP: 100,
    FIRE_MS: 110,
    DMG: 22,
    MAG: 30,
    RELOAD_MS: 1800,
    SPREAD: 0.03,
    BOT_SPREAD: 0.075,
    RANGE: 1600,
    RESPAWN_MS: 3000,
    SCORE_LIMIT: 50,
    MATCH_MS: 5 * 60 * 1000,
    INTERMISSION_MS: 8000,
    TEAM_SIZE: 5,
    START_MONEY: 3000,
    WIN_BONUS: 1500,
    LOSE_BONUS: 600,
  };

  // Левая половина карты (20 символов). Правая — зеркало, A -> B.
  // '#' стена, '.' пол, 'A' спавн команды A.
  const DEFS = [
    {
      name: 'Склад',
      theme: { floor: '#3a3e44', floor2: '#363a40', wall: '#7a6548', wallTop: '#9b8360', bg: '#1d1f23' },
      half: [
        '####################',
        '#AA.................',
        '#AA.....##..........',
        '#AA.....##.....##...',
        '#.......##.....##...',
        '#...................',
        '####...........#####',
        '#......####.........',
        '#......#............',
        '#..##..#.....##.....',
        '#..##........##.....',
        '#.............#.....',
        '#....######...#.....',
        '#.............#.....',
        '#..##........##.....',
        '#..##..#.....##.....',
        '#......#............',
        '#......####.........',
        '####...........#####',
        '#...................',
        '#.......##.....##...',
        '#AA.....##.....##...',
        '#AA.................',
        '####################',
      ],
    },
    {
      name: 'Пустыня',
      theme: { floor: '#c9a96e', floor2: '#c2a267', wall: '#8a6a3c', wallTop: '#a8834d', bg: '#3b2e1c' },
      half: [
        '####################',
        '#AAA......#.........',
        '#AAA......#.........',
        '#.........#....#####',
        '#..####...#.........',
        '#..#................',
        '#..#.......####.....',
        '#..........#........',
        '#......#...#........',
        '######.#...#...##...',
        '#......#.......##...',
        '#..............##...',
        '#...####............',
        '#...#...............',
        '#...#.....#####.....',
        '#.........#.........',
        '#.........#.........',
        '######....#...#.....',
        '#.............#.....',
        '#..####.......#.....',
        '#.....#.......####..',
        '#AAA..#.............',
        '#AAA..#.............',
        '####################',
      ],
    },
    {
      name: 'Город',
      theme: { floor: '#4a4f57', floor2: '#454a52', wall: '#2b2f36', wallTop: '#5b6270', bg: '#15171b' },
      half: [
        '####################',
        '#AA.................',
        '#AA..####..####..###',
        '#....####..####..#..',
        '#....####..####.....',
        '#...................',
        '#..####..#####..##..',
        '#..####..#####..##..',
        '#..####.........##..',
        '#........##.........',
        '####.....##..####...',
        '#..............#....',
        '#..##..####....#....',
        '#..##..####.........',
        '#..........######...',
        '####................',
        '#.....###.......#...',
        '#.....###..###..#...',
        '#..........###......',
        '#..####.........##..',
        '#..####..####...##..',
        '#AA......####.......',
        '#AA.................',
        '####################',
      ],
    },
  ];

  function buildMap(def) {
    const rows = def.half.map((h) => {
      h = h.padEnd(20, '.').slice(0, 20);
      const mirror = h.split('').reverse().map((c) => (c === 'A' ? 'B' : c)).join('');
      return h + mirror;
    });
    const H = rows.length, W = rows[0].length;
    const grid = new Uint8Array(W * H);
    const spawns = { A: [], B: [] };
    const floor = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let c = rows[y][x];
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c = '#';
        grid[y * W + x] = c === '#' ? 1 : 0;
        if (c === 'A' || c === 'B') spawns[c].push([x, y]);
        if (c !== '#') floor.push([x, y]);
      }
    }
    return { name: def.name, theme: def.theme, W, H, grid, spawns, floor, pw: W * C.TILE, ph: H * C.TILE };
  }

  const MAPS = DEFS.map(buildMap);

  function isWall(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return true;
    return map.grid[ty * map.W + tx] === 1;
  }

  function collides(map, x, y, r) {
    const T = C.TILE;
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
    const y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (isWall(map, tx, ty)) return true;
    return false;
  }

  // Движение квадратного коллайдера по осям раздельно.
  function move(map, x, y, dx, dy, r) {
    const T = C.TILE;
    if (dx) {
      let nx = x + dx;
      if (collides(map, nx, y, r)) {
        if (dx > 0) nx = Math.floor((nx + r) / T) * T - r - 0.01;
        else nx = (Math.floor((nx - r) / T) + 1) * T + r + 0.01;
        if (collides(map, nx, y, r)) nx = x;
      }
      x = nx;
    }
    if (dy) {
      let ny = y + dy;
      if (collides(map, x, ny, r)) {
        if (dy > 0) ny = Math.floor((ny + r) / T) * T - r - 0.01;
        else ny = (Math.floor((ny - r) / T) + 1) * T + r + 0.01;
        if (collides(map, x, ny, r)) ny = y;
      }
      y = ny;
    }
    return { x, y };
  }

  // Луч до стены (DDA). Возвращает дистанцию.
  function rayWall(map, x, y, a, max) {
    const T = C.TILE;
    const dx = Math.cos(a), dy = Math.sin(a);
    let tx = Math.floor(x / T), ty = Math.floor(y / T);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(T / dx) : Infinity;
    const tDY = dy !== 0 ? Math.abs(T / dy) : Infinity;
    let tMX = dx > 0 ? ((tx + 1) * T - x) / dx : dx < 0 ? (x - tx * T) / -dx : Infinity;
    let tMY = dy > 0 ? ((ty + 1) * T - y) / dy : dy < 0 ? (y - ty * T) / -dy : Infinity;
    let t = 0;
    for (let i = 0; i < 400 && t < max; i++) {
      if (tMX < tMY) { t = tMX; tMX += tDX; tx += stepX; }
      else { t = tMY; tMY += tDY; ty += stepY; }
      if (isWall(map, tx, ty)) return Math.min(t, max);
    }
    return max;
  }

  // Вектор движения из битовой маски клавиш: 1=W 2=S 4=A 8=D
  function keyDir(k) {
    let mx = 0, my = 0;
    if (k & 1) my -= 1;
    if (k & 2) my += 1;
    if (k & 4) mx -= 1;
    if (k & 8) mx += 1;
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    return [mx, my];
  }

  // ---------- Оружие (арсенал CS 1.6) ----------
  // slot: 0 основное, 1 пистолет, 2 нож
  const WDEF = { slot: 0, price: 0, dmg: 20, fire: 100, mag: 30, reload: 2500, spread: 0.035, mspread: 0.07, sspread: 0, speed: 0.95, auto: true, pellets: 1, range: 1600, scope: 0, pierce: false, reward: 300, recoil: 0.004 };
  const WLIST = [
    { key: 'knife', name: 'Нож', cat: 'knife', slot: 2, dmg: 55, fire: 420, mag: 0, reload: 0, spread: 0, mspread: 0, speed: 1.06, range: 50, reward: 1500, recoil: 0 },
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
  ].map((s, i) => Object.assign({ id: i, female: false, hitR: s.female ? 12 : 16 }, s));
  const SKEY = {}; SKINS.forEach((s) => (SKEY[s.key] = s.id));

  function speedOf(wid, scoped) {
    const w = WEAPONS[wid] || WEAPONS[0];
    return C.SPEED * w.speed * (scoped && w.scope ? 0.6 : 1);
  }

  const api = { C, MAPS, WEAPONS, WKEY, SKINS, SKEY, isWall, collides, move, rayWall, keyDir, speedOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
