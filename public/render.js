// Отрисовка персонажей (вид сверху) и иконок оружия (вид сбоку).
(function () {
  const { WEAPONS, SKINS } = Shared;
  const TEAM_COL = ['#4ea1ff', '#ff5a5a'];

  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1);
  }

  // Длина оружия в локальных координатах (для дульной вспышки)
  const GUN = {
    knife: { len: 16, col: '#c9ced6' }, pistol: { len: 13, col: '#2a2a2a' }, dual: { len: 13, col: '#3a3a3a' },
    smg: { len: 20, col: '#262626' }, shotgun: { len: 30, col: '#2b2b2b', wood: '#6e4424' },
    rifle: { len: 31, col: '#232323' }, sniper: { len: 40, col: '#2c3326' }, mg: { len: 33, col: '#2a2d2a' },
  };
  function gunInfo(wid) { const w = WEAPONS[wid] || WEAPONS[0]; return GUN[w.cat]; }
  function muzzle(wid) { const w = WEAPONS[wid] || WEAPONS[0]; return (7 + gunInfo(wid).len) * 1.15; }

  function drawGunTop(g, wid) {
    const w = WEAPONS[wid] || WEAPONS[0], G = GUN[w.cat], x0 = 7;
    g.lineJoin = 'round';
    if (w.cat === 'knife') {
      g.fillStyle = '#222'; g.fillRect(x0 + 2, 1, 6, 3.4);
      g.fillStyle = G.col; g.beginPath(); g.moveTo(x0 + 8, 0.5); g.lineTo(x0 + 22, 2.4); g.lineTo(x0 + 8, 4.6); g.closePath(); g.fill();
      return;
    }
    if (w.cat === 'dual') {
      for (const yy of [-6, 6]) { g.fillStyle = G.col; rr(g, x0, yy - 1.8, G.len, 3.6, 1.2); g.fill(); }
      return;
    }
    const L = G.len;
    let col = G.col;
    if (w.key === 'awp') col = '#3d5a3a';
    if (w.key === 'ak47' || w.key === 'galil') { g.fillStyle = '#6b3f1f'; rr(g, x0 - 6, -1.8, 10, 4.2, 1.5); g.fill(); }
    g.fillStyle = col; rr(g, x0, -2.2, L, 4.4, 1.5); g.fill();
    g.fillStyle = shade(col, 0.15); g.fillRect(x0 + 2, -1, L - 6, 1.2);
    if (w.cat === 'shotgun') { g.fillStyle = G.wood; rr(g, x0 + L * 0.45, -2.8, 9, 5.6, 2); g.fill(); }
    if (w.cat === 'mg') { g.fillStyle = '#3b4033'; rr(g, x0 + 5, -6, 9, 7, 1.5); g.fill(); }
    if (w.scope) { g.fillStyle = '#111'; rr(g, x0 + L * 0.25, -2.6, w.cat === 'sniper' ? 13 : 8, 5.2, 2.5); g.fill(); g.fillStyle = '#5ab0ff'; ell(g, x0 + L * 0.25 + (w.cat === 'sniper' ? 12 : 7), 0, 1, 1.6); }
    g.fillStyle = '#111'; g.fillRect(x0 + L - 2, -1.2, 3, 2.4);
  }

  // o: {x, y, angle, skin, wid, walk, moving(0..1), team, alpha, scale}
  function drawCharacter(g, o) {
    const s = SKINS[o.skin] || SKINS[0];
    const w = WEAPONS[o.wid] || WEAPONS[0];
    const fem = s.female;
    const sw = fem ? 25 : 30; // ширина плеч
    g.save();
    g.translate(o.x, o.y);
    if (o.scale) g.scale(o.scale, o.scale);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    // кольцо команды
    if (o.team >= 0) {
      g.strokeStyle = TEAM_COL[o.team]; g.globalAlpha = (o.alpha ?? 1) * 0.55; g.lineWidth = 2.2;
      g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = o.alpha ?? 1;
    }
    g.fillStyle = 'rgba(0,0,0,0.28)'; ell(g, 3, 4, 15, 13);
    g.rotate(o.angle);
    // ноги
    const st = Math.sin(o.walk || 0) * 7 * (o.moving || 0);
    g.fillStyle = s.boots;
    ell(g, 1 + st, -6.5, 7, 4); ell(g, 1 - st, 6.5, 7, 4);
    // оружие
    drawGunTop(g, o.wid);
    // корпус
    g.fillStyle = shade(s.shirt, -0.25); rr(g, -9.5, -sw / 2 - 0.5, 17, sw + 1, fem ? 8.5 : 7); g.fill();
    g.fillStyle = s.shirt; rr(g, -9, -sw / 2, 16, sw, fem ? 8 : 6.5); g.fill();
    g.fillStyle = s.vest; rr(g, -7, -sw / 2 + 5, 12, sw - 10, 4); g.fill();
    g.fillStyle = shade(s.vest, 0.15); g.fillRect(-6, -sw / 2 + 6, 10, 1.5); g.fillRect(-6, sw / 2 - 7.5, 10, 1.5);
    // руки
    const two = w.cat !== 'pistol' && w.cat !== 'knife' && w.cat !== 'dual';
    const handR = w.cat === 'dual' ? [12, 6] : [11, 1.5];
    const handL = w.cat === 'dual' ? [12, -6] : two ? [7 + GUN[w.cat].len * 0.6, -0.5] : w.cat === 'knife' ? [4, -sw / 2 + 1] : [10, -1.5];
    g.lineCap = 'round';
    const arm = (sy, cy, h) => {
      g.beginPath(); g.moveTo(0, sy); g.quadraticCurveTo(7, cy, h[0], h[1]);
      g.strokeStyle = shade(s.shirt, -0.4); g.lineWidth = (fem ? 5 : 6) + 2; g.stroke();
      g.strokeStyle = s.shirt; g.lineWidth = fem ? 5 : 6; g.stroke();
    };
    arm(sw / 2 - 3, sw / 2 - 1, handR); arm(-sw / 2 + 3, -sw / 2 + 2, handL);
    g.fillStyle = s.skin; ell(g, handR[0], handR[1], 2.8, 2.8); ell(g, handL[0], handL[1], 2.8, 2.8);
    // голова
    const hr = fem ? 6.3 : 6.8;
    if (fem) { g.fillStyle = s.hair; ell(g, -10.5, 0, 6, 3.4); ell(g, -6.5, 0, 4, 3); } // хвост
    g.fillStyle = s.skin; ell(g, 0, 0, hr, hr);
    g.fillStyle = shade(s.skin, -0.12); ell(g, hr - 0.8, 0, 1.6, 1.4); // нос
    switch (s.hat) {
      case 'helmet':
        g.fillStyle = s.hatColor; ell(g, -1, 0, hr + 1.3, hr + 1.3);
        g.fillStyle = shade(s.hatColor, 0.18); ell(g, -2.5, -2, 3.5, 2.5); break;
      case 'cap':
        g.fillStyle = s.hatColor; ell(g, -1, 0, hr + 0.4, hr + 0.4); ell(g, hr - 0.5, 0, 4, 5.5);
        g.fillStyle = shade(s.hatColor, -0.2); g.fillRect(-1.5, -hr, 1.2, hr * 2); break;
      case 'beanie':
        g.fillStyle = s.hatColor; ell(g, -1.3, 0, hr + 0.6, hr + 0.6);
        g.strokeStyle = shade(s.hatColor, 0.2); g.lineWidth = 1; g.beginPath(); g.arc(-1.3, 0, hr - 2, 0, Math.PI * 2); g.stroke(); break;
      case 'mask':
        g.fillStyle = s.hatColor; ell(g, -0.5, 0, hr + 0.5, hr + 0.5);
        g.fillStyle = '#e74c3c'; ell(g, hr - 2, -2.3, 1, 1); ell(g, hr - 2, 2.3, 1, 1); break;
      default:
        g.fillStyle = s.hair;
        if (fem) { g.beginPath(); g.arc(-0.5, 0, hr + 0.8, Math.PI * 0.35, Math.PI * 1.65); g.closePath(); g.fill(); ell(g, 0.5, 0, hr - 0.5, hr - 0.3); g.fillStyle = s.skin; ell(g, 3.2, 0, 3.3, 4.5); }
        else { ell(g, -1.8, 0, hr - 0.4, hr - 0.2); }
    }
    g.restore();
  }

  // Иконка оружия сбоку для магазина (в «юнитах», потом масштаб)
  function drawWeaponIcon(g, wid, W, H) {
    const w = WEAPONS[wid], k = w.key;
    g.clearRect(0, 0, W, H);
    const L = { pistol: 36, dual: 40, smg: 56, shotgun: 96, rifle: 86, sniper: 104, mg: 96, knife: 44 }[w.cat] + (k === 'deagle' ? 6 : 0) - (k === 'mac10' || k === 'tmp' ? 12 : 0);
    const sc = (W * 0.82) / Math.max(L, 62);
    g.save();
    g.translate(W / 2 - (L * sc) / 2, H * 0.44);
    g.scale(sc, sc);
    g.lineJoin = 'round';
    const BLK = '#25282e', DRK = '#17191d', MET = '#3a3f47', WOOD = '#7a4a26', WOOD2 = '#5e3519';
    const body = k === 'awp' ? '#3f5f3a' : k === 'deagle' ? '#9aa0a8' : k === 'aug' ? '#4a5546' : k === 'p90' ? '#2f3328' : BLK;
    const R = (x, y, w2, h, r, c) => { g.fillStyle = c; rr(g, x, y, w2, h, r); g.fill(); };
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
    const shine = (x, y, w2) => { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, w2, 1.2); };
    const guard = (x) => { g.strokeStyle = DRK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 2); g.quadraticCurveTo(x + 2, 8, x + 8, 3); g.stroke(); };
    const pistol = (dx, dy, len, col) => {
      g.save(); g.translate(dx, dy);
      R(0, -7, len, 6.5, 1.5, col); shine(2, -6, len - 4);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3 + i * 2, -6, 0.8, 4.5); }
      R(3, -1, len - 9, 3.5, 1, DRK);
      poly([[3, 1], [12, 1], [10.5, 17], [1.5, 17]], col === '#9aa0a8' ? '#2a2c30' : DRK);
      guard(11); g.fillStyle = DRK; g.fillRect(len - 1, -5.5, 2.5, 3);
      g.restore();
    };
    if (w.cat === 'knife') {
      R(0, -4, 16, 8, 3, '#2b2e33'); R(15, -6, 3, 12, 1, '#888');
      poly([[18, -4], [42, -1.5], [44, 0], [38, 3.5], [18, 4]], '#cfd5dd');
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(20, -2.5, 18, 1);
    } else if (w.cat === 'pistol') {
      pistol(0, 0, L, body);
    } else if (w.cat === 'dual') {
      pistol(8, -6, 34, '#3d4148'); pistol(0, 2, 34, BLK);
    } else if (w.cat === 'smg') {
      if (k === 'p90') {
        poly([[0, 6], [4, -6], [44, -6], [52, -2], [52, 4], [30, 6], [24, 16], [17, 16], [16, 6]], body);
        R(8, -10, 30, 4.5, 1.5, '#5b6155'); g.fillStyle = 'rgba(160,200,255,0.25)'; g.fillRect(10, -9, 26, 2);
        g.fillStyle = DRK; g.fillRect(52, -1.5, 5, 3);
      } else if (k === 'mac10' || k === 'tmp') {
        R(0, -7, 34, 10, 2, body); shine(2, -6, 30); g.fillStyle = DRK; g.fillRect(34, -4, 10, 3.5);
        poly([[8, 3], [15, 3], [14, 22], [8, 22]], DRK);
        if (k === 'tmp') { poly([[24, 3], [29, 3], [28, 13], [24, 13]], DRK); R(40, -6, 4, 9, 1, BLK); }
      } else {
        g.fillStyle = MET; g.fillRect(-12, -3, 13, 2); g.fillRect(-12, 3, 13, 2); R(-14, -4, 3, 10, 1, DRK);
        R(0, -7, 36, 11, 2, body); shine(2, -6, 32);
        R(36, -5, 12, 8, 2, k === 'ump45' ? BLK : '#2c2f35'); g.fillStyle = DRK; g.fillRect(48, -3, 8, 3);
        poly([[10, 4], [17, 4], [15, 18], [8, 18]], DRK); guard(17);
        if (k === 'mp5') poly([[24, 4], [29, 4], [33, 20], [28, 21]], DRK); else poly([[23, 4], [29, 4], [30, 20], [24, 20]], DRK);
      }
    } else if (w.cat === 'shotgun') {
      const stockC = k === 'm3' ? WOOD : BLK;
      poly([[0, -3], [24, -5], [24, 5], [0, 11]], stockC);
      R(22, -7, 22, 11, 2, body); shine(24, -6, 18);
      R(44, -6, 52, 3.5, 1, DRK); R(44, -1, 38, 3.5, 1, MET);
      R(52, -2.5, 18, 6.5, 2.5, k === 'm3' ? WOOD2 : '#33363c');
      poly([[26, 4], [32, 4], [30, 15], [24, 15]], DRK); guard(32);
    } else if (w.cat === 'rifle') {
      const wood = k === 'ak47' || k === 'galil';
      const bull = k === 'aug' || k === 'famas';
      if (bull) {
        poly([[0, 8], [0, -5], [50, -6], [56, -3], [56, 6], [40, 6], [36, 16], [30, 16], [30, 6], [8, 6]], body);
        g.fillStyle = DRK; g.fillRect(56, -3, 28, 3.5);
        poly([[14, 6], [20, 6], [22, 20], [15, 20]], DRK);
        if (k === 'famas') { g.strokeStyle = BLK; g.lineWidth = 3; g.beginPath(); g.moveTo(10, -5); g.lineTo(14, -12); g.lineTo(46, -12); g.lineTo(50, -6); g.stroke(); }
      } else {
        poly([[0, -3], [20, -6], [20, 5], [0, 11]], wood ? WOOD : k === 'm4a1' ? '#2a2d33' : BLK);
        if (k === 'm4a1') { g.fillStyle = BLK; g.fillRect(0, -3, 6, 14); }
        R(18, -7, 30, 11, 2, body); shine(20, -6, 26);
        R(48, -6, 20, 9, 2.5, wood ? WOOD2 : k === 'm4a1' ? '#2c3036' : MET);
        g.fillStyle = DRK; g.fillRect(68, -4, 18, 3); g.fillRect(84, -5.5, 3, 6);
        poly([[28, 4], [34, 4], [32, 17], [26, 17]], DRK); guard(34);
        if (k === 'ak47') { g.fillStyle = DRK; g.beginPath(); g.moveTo(38, 4); g.lineTo(44, 4); g.quadraticCurveTo(47, 14, 52, 22); g.lineTo(46, 24); g.quadraticCurveTo(41, 15, 38, 4); g.fill(); g.fillRect(60, -9, 2, 4); }
        else if (k === 'galil') { poly([[38, 4], [44, 4], [48, 21], [42, 22]], DRK); }
        else { poly([[38, 4], [44, 4], [45, 21], [39, 21]], DRK); }
        if (k === 'm4a1') { g.strokeStyle = BLK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, -7); g.lineTo(24, -12); g.lineTo(38, -12); g.lineTo(40, -7); g.stroke(); }
      }
      if (w.scope) { R(bull ? 22 : 26, -14, 18, 6, 2.5, '#111316'); g.fillStyle = '#5ab0ff'; g.fillRect(bull ? 39 : 43, -13, 1.5, 4); }
    } else if (w.cat === 'sniper') {
      const awp = k === 'awp';
      if (awp) poly([[0, -5], [6, -6], [22, -6], [22, 6], [14, 6], [10, 13], [0, 13]], body);
      else poly([[0, -3], [22, -5], [22, 5], [0, 11]], WOOD);
      R(20, -7, 30, 10, 2, awp ? body : BLK); shine(22, -6, 26);
      g.fillStyle = DRK; g.fillRect(50, -4.5, 50, awp ? 4 : 3);
      if (awp) R(96, -6, 9, 7, 1.5, DRK);
      R(26, -16, 28, 7, 3, '#121417'); R(24, -17, 5, 9, 1.5, '#121417'); R(51, -17.5, 6, 10, 1.5, '#121417');
      g.fillStyle = '#5ab0ff'; g.fillRect(56, -15, 1.5, 6);
      g.strokeStyle = MET; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 0); g.lineTo(44, 7); g.stroke();
      g.fillStyle = MET; g.beginPath(); g.arc(44.5, 8, 2, 0, 7); g.fill();
      poly([[24, 3], [30, 3], [28, 15], [22, 15]], awp ? body : DRK);
      g.fillStyle = DRK; g.fillRect(34, 3, 6, 6);
    } else if (w.cat === 'mg') {
      poly([[0, -4], [20, -6], [20, 6], [0, 12]], BLK);
      R(18, -9, 38, 15, 2.5, body); shine(20, -8, 34);
      R(30, 6, 16, 16, 2, '#3b4433'); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(31, 7, 14, 2);
      R(56, -6, 18, 9, 2, MET); g.fillStyle = DRK; g.fillRect(74, -4, 22, 3.5);
      g.strokeStyle = DRK; g.lineWidth = 2; g.beginPath(); g.moveTo(70, 2); g.lineTo(64, 18); g.moveTo(72, 2); g.lineTo(78, 18); g.stroke();
      g.strokeStyle = BLK; g.lineWidth = 3; g.beginPath(); g.moveTo(32, -9); g.lineTo(36, -14); g.lineTo(46, -14); g.stroke();
      poly([[22, 6], [28, 6], [26, 18], [20, 18]], DRK);
    }
    g.restore();
  }

  window.Draw = { drawCharacter, drawWeaponIcon, muzzle, TEAM_COL, rr, shade };
})();
