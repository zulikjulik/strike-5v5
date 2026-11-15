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

  const api = { C, MAPS, isWall, collides, move, rayWall, keyDir };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
