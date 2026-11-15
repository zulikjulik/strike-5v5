// Общий код сервера и клиента: карты (с этажами), физика, лучи, оружие, скины, раскраски и кейсы.
// Единицы — «пиксели» сервера: 1 клетка = 48 = 2 м, 24 = 1 м. Ось z — высота.
(function (root) {
  const C = {
    TILE: 48, TICK: 30, DT: 1 / 30,
    SPEED: 125, R: 9, PH: 43, PHC: 30, EYE: 38, EYEC: 26, JUMP_V: 250, G: 820,
    FLOOR: 72, STEP: 8, RAMP_STEP: 16,
    HP: 100, RESPAWN_MS: 3000, SCORE_LIMIT: 50, MATCH_MS: 5 * 60 * 1000, INTERMISSION_MS: 9000, TEAM_SIZE: 5,
    START_MONEY: 3000, WIN_BONUS: 1500, LOSE_BONUS: 600, HEAD_MULT: 4,
    BED: 26, // высота кузова грузовика
  };

  // ---------------------------------------------------------------------
  // Карта: у каждой клетки — колонка твёрдых диапазонов высот [z0, z1, материал],
  // необязательный пандус-лестница и тип пола. Так получаются этажи, окна, двери.
  // ---------------------------------------------------------------------
  const W = 44, H = 26, HALF = 22;
  function col() { return { s: [], ramp: null, kind: 'out', spawn: null }; }
  function newGrid() { const g = []; for (let i = 0; i < W * H; i++) g.push(col()); return g; }
  function carve(s, a, b) {
    const out = [];
    for (const r of s) {
      if (r[1] <= a || r[0] >= b) { out.push(r); continue; }
      if (r[0] < a) out.push([r[0], a, r[2]]);
      if (r[1] > b) out.push([b, r[1], r[2]]);
    }
    return out;
  }

  // Построитель карты: операции задаются для левой половины, правая — зеркало.
  function Builder(theme) {
    const g = newGrid();
    const at = (x, y) => g[y * W + x];
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const set = (x, y, s, kind, extra) => { if (!ok(x, y)) return; const c = at(x, y); c.s = s; c.kind = kind || 'out'; c.ramp = null; c.spawn = null; Object.assign(c, extra || {}); };
    const trims = [], trucks = [], chimneys = [];
    const B = {
      g, at, trims, trucks, chimneys,
      wall(x0, y0, x1, y1, h = 72, mat = 'wall') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, [[0, h, mat]], 'wall'); },
      crate(x, y, tall) { set(x, y, [[0, tall ? 52 : 26, 'crate']], 'crate'); },
      barrel(x, y) { set(x, y, [[0, 30, 'barrel']], 'barrel'); },
      sand(x, y) { set(x, y, [[0, 30, 'sand']], 'sand'); },
      fence(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, [[0, 26, 'fence']], 'fence'); },
      tree(x, y) { set(x, y, [[0, 260, 'trunk']], 'tree'); },
      // одноэтажный дом: стены, окна, двери, крыша
      house(x0, y0, x1, y1, o = {}) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || y === y0 || y === y1;
          if (edge) set(x, y, [[0, 72, 'wall']], 'wall'); else set(x, y, [[64, 68, 'slab'], [68, 72, 'roof']], 'in');
        }
        for (const [x, y] of o.doors || []) { at(x, y).s = carve(at(x, y).s, 0, 53); at(x, y).kind = 'door'; trims.push([x, y, 53]); }
        for (const [x, y] of o.wins || []) { at(x, y).s = carve(at(x, y).s, 18, 58); trims.push([x, y, 18], [x, y, 58]); }
        if (o.chimney) chimneys.push([o.chimney[0], o.chimney[1], 72]);
      },
      // двухэтажный дом 7×5 с лестницей
      house2(x0, y0, o = {}) {
        const x1 = x0 + 6, y1 = y0 + 4;
        const ry = o.rampRow === 'bottom' ? y1 - 1 : y0 + 1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || y === y0 || y === y1;
          if (edge) {
            let s = [[0, 144, 'wall2']];
            const corner = (x === x0 || x === x1) && (y === y0 || y === y1);
            if (!corner && (x + y) % 2 === 1) { s = carve(s, 90, 130); trims.push([x, y, 90], [x, y, 130]); }
            set(x, y, s, 'wall');
          } else set(x, y, [[64, 72, 'slab'], [136, 140, 'slab'], [140, 144, 'roof']], 'in');
        }
        // лестница: x0+2..x0+4 по ряду ry, вверх к +x, площадка x0+5
        for (let i = 0; i < 3; i++) { const c = at(x0 + 2 + i, ry); c.s = [[136, 140, 'slab'], [140, 144, 'roof']]; c.ramp = { dx: 1, dy: 0, z0: i * 24, z1: (i + 1) * 24 }; }
        for (const [x, y] of o.doors || []) { at(x, y).s = carve(at(x, y).s, 0, 53); at(x, y).kind = 'door'; trims.push([x, y, 53]); }
        for (const [x, y] of o.wins || []) { at(x, y).s = carve(at(x, y).s, 18, 58); trims.push([x, y, 18], [x, y, 58]); }
      },
      // грузовик-спавн: кабина (x..x+1, y), кузов (x..x+1, y+1..y+3)
      truck(x, y) {
        for (let i = 0; i < 2; i++) {
          set(x + i, y, [[6, 62, 'cab']], 'cab');
          for (let j = 1; j <= 3; j++) set(x + i, y + j, [[10, C.BED, 'bed']], 'bed', { spawn: 'A' });
        }
        trucks.push({ x, y, team: 'A' });
      },
    };
    return B;
  }

  // Башня в центре карты: 3 этажа, две лестницы
  function tower(B) {
    const x0 = 18, x1 = 25, y0 = 9, y1 = 15, at = B.at;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = at(x, y); c.ramp = null; c.spawn = null;
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (edge) {
        let s = [[0, 216, 'tower']];
        const corner = (x === x0 || x === x1) && (y === y0 || y === y1);
        if (!corner && (x + y) % 2 === 0) { s = carve(s, 90, 130); s = carve(s, 162, 202); B.trims.push([x, y, 90], [x, y, 130], [x, y, 162], [x, y, 202]); }
        c.s = s; c.kind = 'wall';
      } else { c.s = [[64, 72, 'slab'], [136, 144, 'slab'], [208, 212, 'slab'], [212, 216, 'roof']]; c.kind = 'in'; }
    }
    // лестница 1→2: x=19, y=13..11, вверх к -y; площадка (19,10)
    for (let i = 0; i < 3; i++) { const c = at(19, 13 - i); c.s = [[136, 144, 'slab'], [208, 212, 'slab'], [212, 216, 'roof']]; c.ramp = { dx: 0, dy: -1, z0: i * 24, z1: (i + 1) * 24 }; }
    // лестница 2→3: x=24, y=11..13, вверх к +y; площадка (24,14)
    for (let i = 0; i < 3; i++) { const c = at(24, 11 + i); c.s = [[64, 72, 'slab'], [208, 212, 'slab'], [212, 216, 'roof']]; c.ramp = { dx: 0, dy: 1, z0: 72 + i * 24, z1: 72 + (i + 1) * 24 }; }
    for (const [x, y] of [[18, 10], [25, 14], [21, 9], [22, 9], [21, 15], [22, 15]]) { const c = at(x, y); c.s = carve([[0, 216, 'tower']], 0, 53); c.s = carve(c.s, 90, 130); c.s = carve(c.s, 162, 202); c.kind = 'door'; B.trims.push([x, y, 53]); }
    for (const [x, y] of [[18, 12], [18, 14], [25, 10], [25, 12]]) { const c = at(x, y); c.s = carve(c.s, 18, 58); B.trims.push([x, y, 18], [x, y, 58]); }
    // площадка вокруг башни свободна
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (x === x0 - 1 || x === x1 + 1 || y === y0 - 1 || y === y1 + 1) { const c = at(x, y); if (c.kind !== 'out') { c.s = []; c.kind = 'out'; c.ramp = null; } }
  }

  function mirror(B) {
    const g = B.g;
    for (let y = 0; y < H; y++) for (let x = 0; x < HALF; x++) {
      const src = g[y * W + x], dst = g[y * W + (W - 1 - x)];
      dst.s = src.s.map((r) => r.slice()); dst.kind = src.kind;
      dst.ramp = src.ramp ? { dx: -src.ramp.dx, dy: src.ramp.dy, z0: src.ramp.z0, z1: src.ramp.z1 } : null;
      dst.spawn = src.spawn === 'A' ? 'B' : src.spawn;
    }
    const tr = B.trims.slice(); for (const t of tr) if (t[0] < HALF) B.trims.push([W - 1 - t[0], t[1], t[2]]);
    for (const t of B.trucks.slice()) B.trucks.push({ x: W - 2 - t.x, y: t.y, team: 'B' });
    for (const c of B.chimneys.slice()) B.chimneys.push([W - 1 - c[0], c[1], c[2]]);
  }

  function border(B) {
    for (let x = 0; x < W; x++) { B.at(x, 0).s = [[0, 120, 'border']]; B.at(x, 0).kind = 'wall'; B.at(x, H - 1).s = [[0, 120, 'border']]; B.at(x, H - 1).kind = 'wall'; }
    for (let y = 0; y < H; y++) { B.at(0, y).s = [[0, 120, 'border']]; B.at(0, y).kind = 'wall'; B.at(W - 1, y).s = [[0, 120, 'border']]; B.at(W - 1, y).kind = 'wall'; }
  }

  // ---------------- пять карт ----------------
  const DEFS = [
    { name: 'Деревня', theme: 'village', build(B) {
      B.truck(2, 10);
      B.house2(6, 2, { doors: [[9, 6], [12, 4]], wins: [[6, 4]] });
      B.house2(6, 19, { doors: [[9, 19], [12, 21]], wins: [[6, 21]], rampRow: 'bottom' });
      B.house(14, 2, 17, 6, { doors: [[15, 6]], wins: [[17, 4]], chimney: [15, 3] });
      B.house(14, 19, 17, 23, { doors: [[15, 19]], wins: [[17, 21]], chimney: [16, 22] });
      B.fence(6, 9, 9, 9); B.fence(6, 16, 9, 16);
      B.crate(12, 11); B.crate(12, 12, true); B.crate(13, 14);
      B.tree(4, 5); B.tree(3, 20); B.tree(15, 9); B.tree(15, 16); B.tree(10, 13);
      B.barrel(19, 4); B.barrel(19, 21);
      B.crate(20, 7); B.crate(20, 18);
    } },
    { name: 'Пустыня', theme: 'desert', build(B) {
      B.truck(2, 11);
      B.house2(5, 3, { doors: [[8, 7], [11, 5]], wins: [[5, 5]] });
      B.house(5, 17, 10, 22, { doors: [[10, 19], [7, 17]], wins: [[5, 19], [8, 22]] });
      B.wall(13, 2, 13, 7); B.wall(13, 18, 13, 23);
      B.house(15, 3, 19, 6, { doors: [[17, 6]], wins: [[19, 4]] });
      B.house2(14, 18, { doors: [[17, 18], [14, 20]], wins: [[20, 20]], rampRow: 'bottom' });
      B.sand(9, 10); B.sand(9, 11); B.sand(9, 15); B.sand(9, 16);
      B.crate(12, 12); B.crate(12, 13, true); B.crate(16, 9); B.crate(16, 16);
      B.barrel(3, 3); B.barrel(3, 22); B.crate(20, 2); B.crate(20, 23, true);
    } },
    { name: 'Город', theme: 'city', build(B) {
      B.truck(2, 11);
      B.house2(5, 2, { doors: [[8, 6], [5, 4]], wins: [[11, 4]] });
      B.house2(5, 19, { doors: [[8, 19], [5, 21]], wins: [[11, 21]], rampRow: 'bottom' });
      B.house(13, 2, 18, 6, { doors: [[15, 6], [13, 4]], wins: [[18, 4]] });
      B.house(13, 19, 18, 23, { doors: [[15, 19], [13, 21]], wins: [[18, 21]] });
      B.wall(8, 10, 9, 10); B.wall(8, 15, 9, 15);
      B.crate(11, 12); B.crate(11, 13, true); B.barrel(15, 9); B.barrel(15, 16);
      B.crate(6, 12); B.crate(6, 13);
      B.tree(12, 8); B.tree(12, 17); B.crate(20, 2, true); B.crate(20, 23);
    } },
    { name: 'Осень', theme: 'autumn', build(B) {
      B.truck(2, 11);
      B.house2(6, 3, { doors: [[9, 7], [12, 5]], wins: [[6, 5]] });
      B.house(5, 17, 10, 22, { doors: [[10, 20], [7, 17]], wins: [[5, 19]], chimney: [7, 20] });
      B.house(14, 19, 18, 23, { doors: [[16, 19]], wins: [[18, 21]], chimney: [15, 22] });
      B.fence(14, 3, 14, 7); B.fence(15, 7, 17, 7);
      B.tree(4, 3); B.tree(4, 22); B.tree(12, 10); B.tree(12, 15); B.tree(16, 3); B.tree(16, 13); B.tree(9, 12); B.tree(19, 5); B.tree(19, 20);
      B.crate(13, 12); B.crate(13, 13, true); B.barrel(8, 14);
      B.crate(20, 2); B.crate(20, 23);
    } },
    { name: 'Зима', theme: 'winter', build(B) {
      B.truck(2, 10);
      B.house2(6, 2, { doors: [[9, 6], [12, 4]], wins: [[6, 4]] });
      B.house2(13, 19, { doors: [[16, 19], [13, 21]], wins: [[19, 21]], rampRow: 'bottom' });
      B.house(5, 18, 10, 22, { doors: [[7, 18], [10, 20]], wins: [[5, 20]], chimney: [8, 20] });
      B.house(15, 2, 19, 6, { doors: [[17, 6]], wins: [[19, 4]], chimney: [17, 3] });
      B.sand(9, 10); B.sand(10, 10); B.sand(9, 15); B.sand(10, 15);
      B.tree(4, 5); B.tree(3, 21); B.tree(13, 9); B.tree(13, 16); B.tree(16, 10); B.tree(11, 13);
      B.crate(14, 12); B.crate(14, 13, true); B.barrel(20, 7); B.barrel(20, 18);
    } },
  ];

  function buildMap(def) {
    const B = Builder(def.theme);
    def.build(B);
    mirror(B);
    tower(B);
    border(B);
    const spawns = { A: [], B: [] }, floor = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = B.at(x, y);
      if (c.spawn) spawns[c.spawn].push([x, y]);
      if (walkable(c)) floor.push([x, y]);
    }
    return { name: def.name, theme: def.theme, W, H, cols: B.g, spawns, floor, trims: B.trims, trucks: B.trucks, chimneys: B.chimneys, pw: W * C.TILE, ph: H * C.TILE };
  }

  const OOB = { s: [[0, 1e5, 'border']], ramp: null, kind: 'wall' };
  function colAt(map, tx, ty) { if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return OOB; return map.cols[ty * map.W + tx]; }
  // Можно ли пройти клетку по земле (для ботов)
  function walkable(c) {
    if (c.kind === 'bed') return true;
    if (c.ramp) return false;
    for (const r of c.s) if (r[1] > C.STEP && r[0] < C.PH + 2) return false;
    return true;
  }
  function isWall(map, tx, ty) { return !walkable(colAt(map, tx, ty)); }

  function rampSurf(c, tx, ty, x, y) {
    const TL = C.TILE, r = c.ramp;
    const fx = Math.max(0, Math.min(1, (x - tx * TL) / TL)), fy = Math.max(0, Math.min(1, (y - ty * TL) / TL));
    const f = r.dx > 0 ? fx : r.dx < 0 ? 1 - fx : r.dy > 0 ? fy : 1 - fy;
    return r.z0 + (r.z1 - r.z0) * f;
  }
  function tiles(x, y, r, fn) {
    const TL = C.TILE;
    const x0 = Math.floor((x - r) / TL), x1 = Math.floor((x + r) / TL), y0 = Math.floor((y - r) / TL), y1 = Math.floor((y + r) / TL);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (fn(tx, ty) === true) return true;
    return false;
  }
  function collides(map, x, y, r, z, ph = C.PH) {
    return tiles(x, y, r, (tx, ty) => {
      const c = colAt(map, tx, ty);
      for (const s of c.s) if (s[1] > z + C.STEP && s[0] < z + ph) return true;
      if (c.ramp && rampSurf(c, tx, ty, x, y) > z + C.RAMP_STEP && c.ramp.z0 < z + ph) return true;
      return false;
    });
  }
  function groundAt(map, x, y, r, z) {
    let g = 0;
    tiles(x, y, r, (tx, ty) => {
      const c = colAt(map, tx, ty);
      for (const s of c.s) if (s[1] <= z + C.STEP && s[1] > g) g = s[1];
      if (c.ramp) { const h = rampSurf(c, tx, ty, x, y); if (h <= z + C.RAMP_STEP && h > g) g = h; }
    });
    return g;
  }
  function ceilAt(map, x, y, r, z, ph = C.PH) {
    let cz = Infinity;
    tiles(x, y, r, (tx, ty) => { for (const s of colAt(map, tx, ty).s) if (s[0] >= z + ph - 1 && s[0] < cz) cz = s[0]; });
    return cz;
  }
  function move(map, x, y, dx, dy, r, z, ph = C.PH) {
    const TL = C.TILE;
    if (dx) {
      let nx = x + dx;
      if (collides(map, nx, y, r, z, ph)) {
        nx = dx > 0 ? Math.floor((nx + r) / TL) * TL - r - 0.01 : (Math.floor((nx - r) / TL) + 1) * TL + r + 0.01;
        if ((dx > 0 && nx < x) || (dx < 0 && nx > x) || collides(map, nx, y, r, z, ph)) nx = x;
      }
      x = nx;
    }
    if (dy) {
      let ny = y + dy;
      if (collides(map, x, ny, r, z, ph)) {
        ny = dy > 0 ? Math.floor((ny + r) / TL) * TL - r - 0.01 : (Math.floor((ny - r) / TL) + 1) * TL + r + 0.01;
        if ((dy > 0 && ny < y) || (dy < 0 && ny > y) || collides(map, x, ny, r, z, ph)) ny = y;
      }
      y = ny;
    }
    return { x, y };
  }
  function moveDir(k, yaw) {
    let f = 0, s = 0;
    if (k & 1) f += 1; if (k & 2) f -= 1; if (k & 8) s += 1; if (k & 4) s -= 1;
    if (!f && !s) return [0, 0];
    const len = Math.hypot(f, s); f /= len; s /= len;
    return [Math.cos(yaw) * f + Math.cos(yaw + Math.PI / 2) * s, Math.sin(yaw) * f + Math.sin(yaw + Math.PI / 2) * s];
  }
  // Шаг физики с инерцией. st: {x,y,z,vx,vy,vz,og,cr}. fl: 1 прыжок, 2 присед, 4 тихий шаг.
  // Возвращает скорость в долях от максимальной (0..1).
  function step(map, st, k, yaw, fl, speed, dt) {
    if (st.vx === undefined) { st.vx = 0; st.vy = 0; }
    if (fl & 2) st.cr = true;
    else if (st.cr && !collides(map, st.x, st.y, C.R, st.z, C.PH) && ceilAt(map, st.x, st.y, C.R, st.z, C.PHC) >= st.z + C.PH) st.cr = false;
    const ph = st.cr ? C.PHC : C.PH;
    const mul = st.cr ? 0.45 : (fl & 4) ? 0.52 : 1;
    const [mx, my] = moveDir(k, yaw);
    const ws = speed * mul, f = Math.min(1, (st.og ? 14 : 2.5) * dt);
    st.vx += (mx * ws - st.vx) * f; st.vy += (my * ws - st.vy) * f;
    if (!mx && !my && st.og && Math.hypot(st.vx, st.vy) < 4) { st.vx = 0; st.vy = 0; }
    st.blocked = false;
    if (st.vx || st.vy) {
      const tx = st.x + st.vx * dt, ty = st.y + st.vy * dt;
      const r = move(map, st.x, st.y, st.vx * dt, st.vy * dt, C.R, st.z, ph);
      if (Math.abs(r.x - tx) > 0.01) st.vx = 0;
      if (Math.abs(r.y - ty) > 0.01) st.vy = 0;
      st.blocked = !!(mx || my) && Math.hypot(r.x - st.x, r.y - st.y) < 0.3;
      st.x = r.x; st.y = r.y;
    }
    const g = groundAt(map, st.x, st.y, C.R, st.z);
    if (st.og && (fl & 1)) { st.vz = C.JUMP_V; st.og = false; }
    if (st.og) {
      if (g > st.z) st.z = g;
      else if (st.z - g <= 6) st.z = g;
      else { st.og = false; st.vz = 0; }
    }
    if (!st.og) {
      st.vz -= C.G * dt;
      let nz = st.z + st.vz * dt;
      if (st.vz > 0) { const cz = ceilAt(map, st.x, st.y, C.R, st.z, ph); if (nz + ph > cz) { nz = cz - ph; st.vz = 0; } }
      const g2 = groundAt(map, st.x, st.y, C.R, Math.max(st.z, nz));
      if (nz <= g2) { nz = g2; st.vz = 0; st.og = true; }
      st.z = nz;
    }
    return speed > 0 ? Math.min(1, Math.hypot(st.vx, st.vy) / speed) : 0;
  }

  // 3D-луч по карте: {t, n:[nx,ny,nz]} (n=null — улетело)
  function ray3(map, ox, oy, oz, dx, dy, dz, max) {
    const TL = C.TILE;
    let tx = Math.floor(ox / TL), ty = Math.floor(oy / TL);
    const sX = dx > 0 ? 1 : -1, sY = dy > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(TL / dx) : Infinity, tDY = dy !== 0 ? Math.abs(TL / dy) : Infinity;
    let tMX = dx > 0 ? ((tx + 1) * TL - ox) / dx : dx < 0 ? (ox - tx * TL) / -dx : Infinity;
    let tMY = dy > 0 ? ((ty + 1) * TL - oy) / dy : dy < 0 ? (oy - ty * TL) / -dy : Infinity;
    let tIn = 0, side = [0, 0, 0];
    for (let i = 0; i < 400 && tIn < max; i++) {
      if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) break;
      const tOut = Math.min(tMX, tMY, max);
      const c = map.cols[ty * map.W + tx];
      const zA = oz + dz * tIn, zB = oz + dz * tOut;
      let best = Infinity, n = null;
      for (const [z0, z1] of c.s) {
        if (zA >= z0 && zA <= z1) { if (tIn < best) { best = tIn; n = side; } }
        else if (zA > z1 && zB < z1) { const tt = tIn + ((zA - z1) / (zA - zB)) * (tOut - tIn); if (tt < best) { best = tt; n = [0, 0, 1]; } }
        else if (zA < z0 && zB > z0) { const tt = tIn + ((z0 - zA) / (zB - zA)) * (tOut - tIn); if (tt < best) { best = tt; n = [0, 0, -1]; } }
      }
      if (c.ramp) {
        const sa = rampSurf(c, tx, ty, ox + dx * tIn, oy + dy * tIn), sb = rampSurf(c, tx, ty, ox + dx * tOut, oy + dy * tOut);
        const ga = zA - sa, gb = zB - sb;
        if (ga < 0 && zA >= c.ramp.z0) { if (tIn < best) { best = tIn; n = side; } }
        else if (ga >= 0 && gb < 0) { const tt = tIn + (ga / (ga - gb)) * (tOut - tIn); if (tt < best) { best = tt; const r = c.ramp; n = [-r.dx * 0.45, -r.dy * 0.45, 0.9]; } }
      }
      if (zB < 0 && dz < 0) { const tt = -oz / dz; if (tt < best) { best = tt; n = [0, 0, 1]; } }
      if (best < Infinity) return { t: Math.max(0, best), n };
      if (tOut >= max) break;
      if (tMX < tMY) { tIn = tMX; tMX += tDX; tx += sX; side = [-sX, 0, 0]; }
      else { tIn = tMY; tMY += tDY; ty += sY; side = [0, -sY, 0]; }
    }
    if (dz < 0) { const tt = -oz / dz; if (tt < max) return { t: tt, n: [0, 0, 1] }; }
    return { t: max, n: null };
  }

  // Попадание луча в игрока: тело — цилиндр, голова — сфера. q: {x,y,z}
  function hitPlayer(ox, oy, oz, dx, dy, dz, q, br, hr) {
    let best = Infinity, head = false;
    const hx = q.x - ox, hy = q.y - oy, hz = q.z + (q.cr ? 27 : 39) - oz, top = q.cr ? 23 : 34;
    const pb = hx * dx + hy * dy + hz * dz;
    const d2 = hx * hx + hy * hy + hz * hz - pb * pb;
    if (pb > 0 && d2 < hr * hr) { best = pb - Math.sqrt(hr * hr - d2); head = true; }
    const a = dx * dx + dy * dy;
    if (a > 1e-6) {
      const fx = ox - q.x, fy = oy - q.y;
      const b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - br * br;
      const disc = b * b - 4 * a * c;
      if (disc > 0) {
        const sq = Math.sqrt(disc);
        const t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a);
        let z0 = -Infinity, z1 = Infinity;
        if (Math.abs(dz) > 1e-6) { z0 = (q.z - oz) / dz; z1 = (q.z + top - oz) / dz; if (z0 > z1) [z0, z1] = [z1, z0]; }
        else if (oz < q.z || oz > q.z + top) z0 = Infinity;
        const lo = Math.max(t0, z0, 0), hi = Math.min(t1, z1);
        if (lo <= hi && lo < best) { best = lo; head = false; }
      }
    }
    return best < Infinity ? { t: best, head } : null;
  }

  // ---------- Оружие (арсенал CS 1.6) ----------
  // slot: 0 основное, 1 пистолет, 2 нож
  const WDEF = { sil: false, slot: 0, price: 0, dmg: 20, fire: 100, mag: 30, reload: 2500, spread: 0.035, mspread: 0.07, sspread: 0, speed: 0.95, auto: true, pellets: 1, range: 1600, scope: 0, pierce: false, reward: 300, recoil: 0.004 };
  const WLIST = [
    { key: 'knife', name: 'Нож', cat: 'knife', slot: 2, dmg: 40, heavy: 65, fire: 420, mag: 0, reload: 0, spread: 0, mspread: 0, speed: 1.06, range: 32, reward: 1500, recoil: 0 },
    { key: 'glock', name: 'Glock-18', cat: 'pistol', slot: 1, dmg: 18, fire: 140, mag: 20, reload: 2200, spread: 0.04, mspread: 0.06, speed: 1, auto: false, range: 1100, recoil: 0.006 },
    { key: 'usp', name: 'USP-S', sil: true, cat: 'pistol', slot: 1, dmg: 25, fire: 170, mag: 12, reload: 2400, spread: 0.03, mspread: 0.05, speed: 1, auto: false, range: 1200, recoil: 0.007 },
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
    { key: 'm4a1', name: 'M4A1-S', sil: true, cat: 'rifle', price: 6200, dmg: 28, fire: 92, mag: 30, reload: 3100, spread: 0.025, mspread: 0.075, speed: 0.9 },
    { key: 'sg552', name: 'SG 552', cat: 'rifle', price: 7000, dmg: 30, fire: 92, mag: 30, reload: 3000, spread: 0.026, mspread: 0.08, sspread: 0.012, scope: 1, speed: 0.86 },
    { key: 'aug', name: 'AUG', cat: 'rifle', price: 7000, dmg: 29, fire: 95, mag: 30, reload: 3300, spread: 0.024, mspread: 0.075, sspread: 0.01, scope: 1, speed: 0.87 },
    { key: 'scout', name: 'Scout', cat: 'sniper', price: 5500, dmg: 85, fire: 1250, mag: 10, reload: 2000, spread: 0.07, mspread: 0.12, sspread: 0.004, scope: 2, speed: 0.98, auto: false, range: 2200, recoil: 0 },
    { key: 'm249', name: 'M249', cat: 'mg', price: 11500, dmg: 27, fire: 78, mag: 100, reload: 4800, spread: 0.05, mspread: 0.1, speed: 0.8, range: 1500, recoil: 0.003 },
    { key: 'awp', name: 'AWP', cat: 'sniper', price: 15000, dmg: 150, fire: 1450, mag: 10, reload: 3000, spread: 0.13, mspread: 0.2, sspread: 0, scope: 2, speed: 0.82, auto: false, range: 2600, pierce: true, reward: 100, recoil: 0 },
  ];
  // точность +25%: разброс и отдача ×0.75
  const WEAPONS = WLIST.map((w, i) => { const o = Object.assign({}, WDEF, w, { id: i }); const k = 0.75 * 0.95 * 1.1; o.spread *= k; o.mspread *= k; o.sspread *= k; o.recoil *= k; return o; });
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
  ].map((s, i) => Object.assign({ id: i, female: false, hitR: s.female ? 8.5 : 11, headR: s.female ? 5.2 : 6.3 }, s));
  const SKEY = {}; SKINS.forEach((s) => (SKEY[s.key] = s.id));


  // ---------- Раскраски оружия и кейсы (как в CS:GO) ----------
  const RARITY = [
    null,
    { name: 'Армейское', color: '#4b69ff', w: 0.7992 },
    { name: 'Запрещённое', color: '#8847ff', w: 0.1598 },
    { name: 'Засекреченное', color: '#d32ce6', w: 0.032 },
    { name: 'Тайное', color: '#eb4b4b', w: 0.0064 },
    { name: 'Редкий особый', color: '#e4ae39', w: 0.0026 },
  ];
  // pattern: solid | camo | tiger | carbon | fade | neon | gold | doppler | hex | snow
  const FLIST = [
    // кейс «Листопад»
    { w: 'glock', name: 'Осенний камуфляж', r: 1, case: 0, p: 'camo', c: ['#8a4b1f', '#c9772b', '#3d2b1a'] },
    { w: 'mp5', name: 'Ржавчина', r: 1, case: 0, p: 'camo', c: ['#7a3b1c', '#a65a2a', '#4a3324'] },
    { w: 'galil', name: 'Дюна', r: 1, case: 0, p: 'camo', c: ['#c8a46a', '#9b7b46', '#e3cf9e'] },
    { w: 'p90', name: 'Лесник', r: 1, case: 0, p: 'camo', c: ['#3f5a2c', '#6b7f3a', '#26301c'] },
    { w: 'famas', name: 'Кирпич', r: 1, case: 0, p: 'hex', c: ['#7a3527', '#a8503a', '#2d1a14'] },
    { w: 'usp', name: 'Неоновый пульс', r: 2, case: 0, p: 'neon', c: ['#14161c', '#00e5ff', '#ff3d8b'] },
    { w: 'm4a1', name: 'Мегаполис', r: 2, case: 0, p: 'hex', c: ['#5a6270', '#8fa0b5', '#2a2f37'] },
    { w: 'ump45', name: 'Тигр', r: 2, case: 0, p: 'tiger', c: ['#e08a1e', '#1a1a1a', '#f2b544'] },
    { w: 'ak47', name: 'Закат', r: 3, case: 0, p: 'fade', c: ['#ff3d2e', '#ff9f1c', '#ffd23f'] },
    { w: 'deagle', name: 'Карбон', r: 3, case: 0, p: 'carbon', c: ['#1c1d21', '#34363c', '#d4af37'] },
    { w: 'awp', name: 'Изумрудный змей', r: 4, case: 0, p: 'neon', c: ['#0f2a1a', '#2bff88', '#ffd23f'] },
    { w: 'ak47', name: 'Огненный листопад', r: 4, case: 0, p: 'fade', c: ['#b3170e', '#ff6a00', '#ffe066'] },
    { w: 'knife', model: 'karambit', name: 'Градиент', r: 5, case: 0, p: 'fade', c: ['#ff4fd8', '#7a5cff', '#ffd23f'] },
    { w: 'knife', model: 'butterfly', name: 'Допплер', r: 5, case: 0, p: 'doppler', c: ['#ff2e7e', '#3a1c71', '#1fd1f9'] },
    { w: 'knife', model: 'm9', name: 'Золото', r: 5, case: 0, p: 'gold', c: ['#f6d365', '#b8860b', '#fff2b0'] },
    // кейс «Метель»
    { w: 'scout', name: 'Снежный барс', r: 1, case: 1, p: 'snow', c: ['#e8eef2', '#9fb3c0', '#5f7280'] },
    { w: 'xm1014', name: 'Лёд', r: 1, case: 1, p: 'snow', c: ['#cfe8ff', '#7fb2e5', '#3a6ea5'] },
    { w: 'mac10', name: 'Мороз', r: 1, case: 1, p: 'camo', c: ['#dfe7ec', '#8a9aa6', '#4a5560'] },
    { w: 'fiveseven', name: 'Иней', r: 1, case: 1, p: 'snow', c: ['#f3f6f8', '#b8c7d1', '#6d7f8c'] },
    { w: 'aug', name: 'Северное сияние', r: 2, case: 1, p: 'fade', c: ['#00c9a7', '#4d8af0', '#c86dd7'] },
    { w: 'sg552', name: 'Пиксель', r: 2, case: 1, p: 'hex', c: ['#2d3a4a', '#5e7a99', '#a9c1d9'] },
    { w: 'elite', name: 'Серебро', r: 2, case: 1, p: 'gold', c: ['#e6e9ed', '#8e959c', '#ffffff'] },
    { w: 'm249', name: 'Буран', r: 3, case: 1, p: 'tiger', c: ['#e8eef2', '#3a4a5a', '#9fb3c0'] },
    { w: 'awp', name: 'Арктика', r: 3, case: 1, p: 'snow', c: ['#f5f8fa', '#1f6feb', '#9fb3c0'] },
    { w: 'ak47', name: 'Полярная ночь', r: 4, case: 1, p: 'neon', c: ['#0b1020', '#33e1ff', '#7c5cff'] },
    { w: 'deagle', name: 'Ледяной огонь', r: 4, case: 1, p: 'fade', c: ['#1fd1f9', '#ffffff', '#ff4f2e'] },
    { w: 'knife', model: 'karambit', name: 'Лёд', r: 5, case: 1, p: 'doppler', c: ['#1fd1f9', '#0b3d91', '#e0f7ff'] },
    { w: 'knife', model: 'butterfly', name: 'Градиент', r: 5, case: 1, p: 'fade', c: ['#ffd23f', '#ff3d8b', '#7c5cff'] },
    { w: 'knife', model: 'm9', name: 'Тёмная сталь', r: 5, case: 1, p: 'carbon', c: ['#16171a', '#2e3036', '#ff3d2e'] },
    // кейс «Дракон»
    { w: 'mp5', name: 'Пепел', r: 1, case: 2, p: 'marble', c: ['#3a3a3a', '#8a8a8a', '#c7c7c7'] },
    { w: 'galil', name: 'Уголь', r: 1, case: 2, p: 'lava', c: ['#1a1a1a', '#ff5a1f', '#3a1a10'] },
    { w: 'sg552', name: 'Жар', r: 1, case: 2, p: 'fade', c: ['#ff9f1c', '#ff3d2e', '#3a0f0f'] },
    { w: 'mac10', name: 'Чешуя', r: 1, case: 2, p: 'dragon', c: ['#2e7d32', '#a5d6a7', '#0b3d0b'] },
    { w: 'glock', name: 'Красный дракон', r: 2, case: 2, p: 'dragon', c: ['#b71c1c', '#ffca28', '#3e0000'] },
    { w: 'p90', name: 'Магма', r: 2, case: 2, p: 'lava', c: ['#1b0a05', '#ff6d00', '#ffd54f'] },
    { w: 'famas', name: 'Коготь', r: 2, case: 2, p: 'geo', c: ['#f5f5f5', '#ff5722', '#212121'] },
    { w: 'deagle', name: 'Пламя дракона', r: 3, case: 2, p: 'dragon', c: ['#ff6f00', '#ffd600', '#4e0000'] },
    { w: 'usp', name: 'Киберпанк', r: 3, case: 2, p: 'circuit', c: ['#0d0221', '#ff00e5', '#00f0ff'] },
    { w: 'awp', name: 'Огненный дракон', r: 4, case: 2, p: 'dragon', c: ['#d50000', '#ffab00', '#1a0000'] },
    { w: 'ak47', name: 'Вулкан', r: 4, case: 2, p: 'lava', c: ['#120804', '#ff3d00', '#ffea00'] },
    { w: 'knife', model: 'katana', name: 'Дракон', r: 5, case: 2, p: 'dragon', c: ['#c62828', '#ffc107', '#1a0000'] },
    { w: 'knife', model: 'machete', name: 'Лава', r: 5, case: 2, p: 'lava', c: ['#120804', '#ff3d00', '#ffea00'] },
    { w: 'knife', model: 'm9', name: 'Пламя', r: 5, case: 2, p: 'fade', c: ['#ff1744', '#ff9100', '#ffea00'] },
    { w: 'knife', model: 'karambit', name: 'Мрамор', r: 5, case: 2, p: 'marble', c: ['#ff4081', '#3d5afe', '#f5f5f5'] },
    // кейс «Галактика»
    { w: 'fiveseven', name: 'Комета', r: 1, case: 3, p: 'galaxy', c: ['#0d1b2a', '#4fc3f7', '#e1f5fe'] },
    { w: 'ump45', name: 'Орбита', r: 1, case: 3, p: 'hex', c: ['#1a237e', '#3949ab', '#9fa8da'] },
    { w: 'xm1014', name: 'Метеорит', r: 1, case: 3, p: 'marble', c: ['#263238', '#78909c', '#ffab40'] },
    { w: 'tmp', name: 'Луна', r: 1, case: 3, p: 'snow', c: ['#cfd8dc', '#90a4ae', '#eceff1'] },
    { w: 'm4a1', name: 'Звёздная пыль', r: 2, case: 3, p: 'galaxy', c: ['#1a0033', '#b388ff', '#ffffff'] },
    { w: 'aug', name: 'Квазар', r: 2, case: 3, p: 'fade', c: ['#00e5ff', '#651fff', '#f50057'] },
    { w: 'p228', name: 'Спутник', r: 2, case: 3, p: 'chrome', c: ['#eceff1', '#90a4ae', '#ffffff'] },
    { w: 'awp', name: 'Туманность', r: 3, case: 3, p: 'galaxy', c: ['#1a0033', '#ff4081', '#7c4dff'] },
    { w: 'm249', name: 'Чёрная дыра', r: 3, case: 3, p: 'galaxy', c: ['#000000', '#6200ea', '#ff6d00'] },
    { w: 'ak47', name: 'Галактика', r: 4, case: 3, p: 'galaxy', c: ['#0b0033', '#ff1744', '#00e5ff'] },
    { w: 'deagle', name: 'Сверхновая', r: 4, case: 3, p: 'fade', c: ['#ffffff', '#ffd600', '#ff3d00'] },
    { w: 'knife', model: 'butterfly', name: 'Галактика', r: 5, case: 3, p: 'galaxy', c: ['#0b0033', '#ff1744', '#00e5ff'] },
    { w: 'knife', model: 'bear', name: 'Туманность', r: 5, case: 3, p: 'galaxy', c: ['#1a0033', '#e040fb', '#40c4ff'] },
    { w: 'knife', model: 'flip', name: 'Космос', r: 5, case: 3, p: 'galaxy', c: ['#000814', '#00b4d8', '#ffffff'] },
    { w: 'knife', model: 'katana', name: 'Звёзды', r: 5, case: 3, p: 'galaxy', c: ['#03045e', '#ffd60a', '#ffffff'] },
    // кейс «Кибер»
    { w: 'mac10', name: 'Синтвейв', r: 1, case: 4, p: 'fade', c: ['#ff00e5', '#7c4dff', '#00e5ff'] },
    { w: 'xm1014', name: 'Код', r: 1, case: 4, p: 'circuit', c: ['#001b0a', '#00ff66', '#003314'] },
    { w: 'scout', name: 'Пиксель-арт', r: 1, case: 4, p: 'hex', c: ['#ff4081', '#ffd740', '#40c4ff'] },
    { w: 'elite', name: 'Неон', r: 1, case: 4, p: 'neon', c: ['#0a0a12', '#00e5ff', '#ff4081'] },
    { w: 'glock', name: 'Глитч', r: 2, case: 4, p: 'comic', c: ['#00e5ff', '#ff1744', '#ffea00'] },
    { w: 'p90', name: 'Азимут', r: 2, case: 4, p: 'geo', c: ['#fafafa', '#ff6d00', '#212121'] },
    { w: 'm249', name: 'Схема', r: 2, case: 4, p: 'circuit', c: ['#0d1117', '#58a6ff', '#1f6feb'] },
    { w: 'usp', name: 'Хром', r: 3, case: 4, p: 'chrome', c: ['#f5f5f5', '#9e9e9e', '#ffffff'] },
    { w: 'awp', name: 'Матрица', r: 3, case: 4, p: 'circuit', c: ['#000000', '#00ff41', '#003b00'] },
    { w: 'ak47', name: 'Неоновая революция', r: 4, case: 4, p: 'comic', c: ['#ff1744', '#00e5ff', '#ffea00'] },
    { w: 'm4a1', name: 'Рассвет-7', r: 4, case: 4, p: 'geo', c: ['#f5f5f5', '#ff6d00', '#212121'] },
    { w: 'knife', model: 'karambit', name: 'Хром', r: 5, case: 4, p: 'chrome', c: ['#f5f5f5', '#9e9e9e', '#ffffff'] },
    { w: 'knife', model: 'm9', name: 'Неон', r: 5, case: 4, p: 'neon', c: ['#05050f', '#00e5ff', '#ff00e5'] },
    { w: 'knife', model: 'bear', name: 'Кибер', r: 5, case: 4, p: 'circuit', c: ['#020617', '#22d3ee', '#a855f7'] },
    { w: 'knife', model: 'machete', name: 'Глитч', r: 5, case: 4, p: 'comic', c: ['#00e5ff', '#ff1744', '#ffea00'] },
    { w: 'knife', model: 'flip', name: 'Синтвейв', r: 5, case: 4, p: 'fade', c: ['#ff00e5', '#7c4dff', '#00e5ff'] },
    { w: 'knife', model: 'butterfly', name: 'Хром', r: 5, case: 4, p: 'chrome', c: ['#f5f5f5', '#9e9e9e', '#ffffff'] },
  ];
  const FINISHES = FLIST.map((f, i) => Object.assign({ id: i, model: null }, f));
  const CASES = [
    { key: 'leaf', name: 'Кейс «Листопад»', price: 2000, color: '#e0761e' },
    { key: 'blizzard', name: 'Кейс «Метель»', price: 3500, color: '#3a8bd8' },
    { key: 'dragon', name: 'Кейс «Дракон»', price: 5000, color: '#c0392b' },
    { key: 'galaxy', name: 'Кейс «Галактика»', price: 6000, color: '#5e35b1' },
    { key: 'cyber', name: 'Кейс «Кибер»', price: 7500, color: '#00acc1' },
  ];
  const KNIVES = { default: 'Нож', m9: 'Штык-нож M9', butterfly: 'Нож-бабочка', flip: 'Складной нож', bear: 'Медвежий нож', machete: 'Мачете', katana: 'Катана', karambit: 'Керамбит' };
  function itemName(f) { return f.w === 'knife' ? `★ ${KNIVES[f.model] || 'Нож'} | ${f.name}` : `${(WEAPONS[WKEY[f.w]] || {}).name} | ${f.name}`; }
  function rollCase(ci, rnd) {
    const items = FINISHES.filter((f) => f.case === ci);
    let x = (rnd || Math.random)(), tier = 1;
    for (let r = 5; r >= 1; r--) { x -= RARITY[r].w; if (x < 0) { tier = r; break; } }
    let pool = items.filter((f) => f.r === tier);
    if (!pool.length) pool = items.filter((f) => f.r === 1);
    return pool[Math.floor((rnd || Math.random)() * pool.length)];
  }
  // проверка: подходит ли раскраска к оружию
  function finishFits(fid, wid) { const f = FINISHES[fid], w = WEAPONS[wid]; return !!(f && w && f.w === w.key); }

  function speedOf(wid, scoped) {
    const w = WEAPONS[wid] || WEAPONS[0];
    return C.SPEED * w.speed * (scoped && w.scope ? 0.6 : 1);
  }
  function dirFrom(yaw, pitch) { const cp = Math.cos(pitch); return [Math.cos(yaw) * cp, Math.sin(yaw) * cp, Math.sin(pitch)]; }
  const MAPS = DEFS.map(buildMap);

  const api = { C, MAPS, WEAPONS, WKEY, SKINS, SKEY, FINISHES, CASES, RARITY, KNIVES, itemName, rollCase, finishFits, colAt, walkable, isWall, collides, groundAt, ceilAt, move, moveDir, step, ray3, hitPlayer, rampSurf, speedOf, dirFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
