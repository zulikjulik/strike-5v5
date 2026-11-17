// Звуки оружия (синтез: щелчок + тело выстрела + низкий удар + эхо) и фоновая музыка.
(function () {
  const { WEAPONS } = Shared;
  let ctx = null, master, sfxBus, musicBus, verb, verbIn, noiseBuf, echoIn;
  const vol = { sfx: 0.8, music: 0.4 };
  let musicOn = true, inGame = false;

  // Профили выстрелов: crack — частота щелчка, body — частота «тела», dur — длительность,
  // thump — частота низкого удара, td — его длительность, gain — громкость, tail — доля эха
  const PROF = {
    pistol: { crack: 3000, body: 1500, q: 0.8, dur: 0.13, thump: 170, td: 0.08, gain: 0.55, tail: 0.25 },
    deagle: { crack: 2600, body: 850, q: 0.7, dur: 0.26, thump: 105, td: 0.17, gain: 0.85, tail: 0.4 },
    smg: { crack: 3600, body: 1900, q: 0.9, dur: 0.1, thump: 180, td: 0.06, gain: 0.45, tail: 0.18 },
    shotgun: { crack: 2000, body: 650, q: 0.6, dur: 0.36, thump: 72, td: 0.24, gain: 1.0, tail: 0.45 },
    rifle: { crack: 3300, body: 1150, q: 0.7, dur: 0.17, thump: 120, td: 0.11, gain: 0.62, tail: 0.3 },
    ak: { crack: 2900, body: 900, q: 0.65, dur: 0.2, thump: 105, td: 0.13, gain: 0.7, tail: 0.32 },
    mg: { crack: 3000, body: 1000, q: 0.7, dur: 0.16, thump: 110, td: 0.1, gain: 0.6, tail: 0.28 },
    scout: { crack: 4200, body: 1300, q: 0.6, dur: 0.32, thump: 90, td: 0.2, gain: 0.8, tail: 0.5 },
    awp: { crack: 5000, body: 750, q: 0.5, dur: 0.65, thump: 52, td: 0.38, gain: 1.0, tail: 0.7 },
    sil: { crack: 6000, body: 1600, q: 1.2, dur: 0.07, thump: 220, td: 0.04, gain: 0.28, tail: 0.04 },
    silr: { crack: 5000, body: 1300, q: 1.0, dur: 0.09, thump: 180, td: 0.05, gain: 0.32, tail: 0.05 },
  };
  function profFor(w) {
    if (w.key === 'usp') return PROF.sil;
    if (w.key === 'm4a1') return PROF.silr;
    if (w.key === 'deagle') return PROF.deagle;
    if (w.key === 'ak47' || w.key === 'galil') return PROF.ak;
    if (w.key === 'awp') return PROF.awp;
    if (w.key === 'scout') return PROF.scout;
    return PROF[w.cat === 'dual' ? 'pistol' : w.cat] || PROF.rifle;
  }

  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 1;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = makeIR(0.45, 5);
    verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.1; verb.connect(verbOut); verbOut.connect(sfxBus);
    // эхо (отражение от зданий): задержка с обратной связью и фильтром
    echoIn = ctx.createGain();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function noise(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.start(t, Math.random() * 1.5, dur + 0.05); return s;
  }
  function env(g, t, peak, a, d) {
    if (!isFinite(peak) || !isFinite(t)) peak = 0.0001;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  let active = 0;
  // dist — расстояние до слушателя в пикселях, pan — -1..1
  function shot(wid, distPx, pan) {
    if (!ctx || active > 24) return;
    const w = WEAPONS[wid]; if (!w) return;
    if (w.cat === 'knife') return whoosh(distPx, pan);
    const P = profFor(w);
    const k = Math.max(0, 1 - distPx / (w.sil ? 900 : 2000));
    const v = P.gain * Math.pow(k, 1.4);
    if (v < 0.01) return;
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain(); out.gain.value = v;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + 14000 * k * k;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.connect(lp);
    if (pn) { pn.pan.value = Math.max(-1, Math.min(1, pan)); lp.connect(pn); pn.connect(sfxBus); } else lp.connect(sfxBus);
    const send = ctx.createGain(); send.gain.value = P.tail * (0.15 + (1 - k) * 0.35); lp.connect(send); send.connect(verbIn);
    const det = 0.94 + Math.random() * 0.12;
    // 1) щелчок
    const n1 = noise(t, 0.04), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.crack * det;
    const g1 = ctx.createGain(); env(g1, t, 0.9, 0.001, 0.035); n1.connect(hp); hp.connect(g1); g1.connect(out);
    // 2) тело
    const n2 = noise(t, P.dur), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = P.body * det; bp.Q.value = P.q;
    const g2 = ctx.createGain(); env(g2, t, 1.3, 0.002, P.dur); n2.connect(bp); bp.connect(g2); g2.connect(out);
    // 3) низкий удар
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(P.thump * 1.8 * det, t); o.frequency.exponentialRampToValueAtTime(P.thump * 0.45, t + P.td);
    const g3 = ctx.createGain(); env(g3, t, 1.1, 0.002, P.td); o.connect(g3); g3.connect(out);
    o.start(t); o.stop(t + P.td + 0.05);
    // низкий «бум» вблизи и механика затвора
    if (!w.sil && k > 0.35) { const ob = ctx.createOscillator(); ob.type = 'sine'; ob.frequency.setValueAtTime(P.thump * 0.7, t); ob.frequency.exponentialRampToValueAtTime(32, t + P.td * 2.2); const gb = ctx.createGain(); env(gb, t, 0.9 * k, 0.003, P.td * 2.2); ob.connect(gb); gb.connect(out); ob.start(t); ob.stop(t + P.td * 2.4); }
    if (w.sil) { const n4 = noise(t, 0.12), hp4 = ctx.createBiquadFilter(); hp4.type = 'highpass'; hp4.frequency.value = 3000; const g4 = ctx.createGain(); env(g4, t, 0.35, 0.002, 0.1); n4.connect(hp4); hp4.connect(g4); g4.connect(out); click(2600, 0.25 * v, 0.03); }
    active++; setTimeout(() => active--, (P.dur + 0.1) * 1000);
  }

  function whoosh(distPx, pan, heavy) {
    const k = Math.max(0, 1 - distPx / 900); if (k <= 0 || !ctx) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.2), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(heavy ? 300 : 500, t); bp.frequency.exponentialRampToValueAtTime(heavy ? 1800 : 3000, t + (heavy ? 0.28 : 0.16));
    const g = ctx.createGain(); env(g, t, (heavy ? 0.5 : 0.35) * k, 0.04, heavy ? 0.26 : 0.15); n.connect(bp); bp.connect(g); g.connect(sfxBus);
  }

  function click(freq, gain, delay) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const n = noise(t, 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4;
    const g = ctx.createGain(); env(g, t, gain, 0.001, 0.04); n.connect(bp); bp.connect(g); g.connect(sfxBus);
  }
  function tone(freq, gain, dur, delay, type) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); env(g, t, gain, 0.003, dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  const reloadStart = () => { click(2400, 0.5); click(900, 0.35, 0.08); };
  const reloadEnd = () => { click(3200, 0.5); click(1800, 0.45, 0.09); };
  const dry = () => click(4000, 0.4);
  const hit = () => { click(1100, 0.35); tone(220, 0.12, 0.05, 0, 'sine'); };
  const killDing = () => { tone(880, 0.18, 0.12); tone(1320, 0.18, 0.2, 0.08); };
  const deploy = () => click(2000, 0.3);
  const buy = () => { tone(660, 0.15, 0.08); tone(990, 0.15, 0.15, 0.06); click(3000, 0.3, 0.02); };
  const uiClick = () => click(2500, 0.2);
  const step3 = (distPx, pan, k) => { if (!ctx) return; const a = Math.max(0, 1 - distPx / 700); if (a <= 0) return; const t = ctx.currentTime; const n = noise(t, 0.06), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const g = ctx.createGain(); env(g, t, 0.22 * a * a * (k || 1), 0.003, 0.06); const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; n.connect(lp); lp.connect(g); if (pn) { pn.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus); };
  const bolt = () => { click(1800, 0.35); click(2600, 0.35, 0.14); click(1200, 0.3, 0.3); };
  const inspect = () => { click(1500, 0.15); click(900, 0.12, 0.25); };
  const flick = () => { click(3500, 0.25); click(4200, 0.2, 0.06); };
  const step = (k) => { if (!ctx) return; const t = ctx.currentTime; const n = noise(t, 0.05), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); env(g, t, 0.12 * k, 0.003, 0.05); n.connect(lp); lp.connect(g); g.connect(sfxBus); };

  // ---------- Музыка: мрачный кинематографичный эмбиент (ре минор, 84 BPM) ----------
  const BPM = 84, STEP = 60 / BPM / 4;
  const CHORDS = [ // Dm  Bb  Gm  A
    { root: 38, notes: [50, 53, 57, 62] }, { root: 34, notes: [50, 53, 58, 62] }, { root: 31, notes: [50, 55, 58, 62] }, { root: 33, notes: [49, 52, 57, 61] },
  ];
  const MEL = [74, 0, 0, 72, 0, 0, 69, 0, 70, 0, 0, 0, 69, 0, 65, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let mStep = 0, mNext = 0, mTimer = null, mDelay = null, mVerb = null;
  function startMusic() {
    mVerb = ctx.createConvolver(); mVerb.buffer = makeIR(3.2, 2.2); const vo = ctx.createGain(); vo.gain.value = 0.55; mVerb.connect(vo); vo.connect(musicBus);
    mDelay = ctx.createDelay(1); mDelay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    mDelay.connect(dl); dl.connect(fb); fb.connect(mDelay); dl.connect(mVerb);
    mNext = ctx.currentTime + 0.1;
    mTimer = setInterval(schedule, 25);
    applyMusicVol();
  }
  function mNoise(t, dur, type, f, gain, dest, q) {
    const n = noise(t, dur), fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, gain, 0.002, dur); n.connect(fl); fl.connect(g); g.connect(dest || musicBus); return g;
  }
  function mOsc(t, freq, type, dur, gain, a, cutoff, dest, sweep) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); if (sweep) fl.frequency.linearRampToValueAtTime(sweep, t + dur * 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.setValueAtTime(gain, t + Math.max(a, dur * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(dest || musicBus); o.start(t); o.stop(t + dur + 0.05);
    return { o, g };
  }
  function kick(t, k) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.3); const g = ctx.createGain(); env(g, t, 0.62 * k, 0.003, 0.42); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.5); }
  function tom(t, f) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.35); const g = ctx.createGain(); env(g, t, 0.28, 0.003, 0.4); o.connect(g); g.connect(musicBus); g.connect(mVerb); o.start(t); o.stop(t + 0.5); }
  function schedule() {
    if (!ctx) return;
    if (mNext < ctx.currentTime - 1) mNext = ctx.currentTime + 0.05;
    while (mNext < ctx.currentTime + 0.15) {
      try { scheduleStep(); } catch (e) { console.warn(e); }
      mNext += STEP; mStep++;
    }
  }
  function scheduleStep() {
    {
      const s = mStep % 16, bar = Math.floor(mStep / 16), ch = CHORDS[bar % 4], sect = bar % 24, t = mNext;
      const full = sect >= 4 && sect < 20, breakdown = sect >= 20;
      // тёплый пэд из расстроенных пил с медленным фильтром
      if (s === 0) for (const n of ch.notes) for (const det of [-9, 0, 9]) { const v = mOsc(t, mtof(n), 'sawtooth', STEP * 16 + 1.2, 0.016, 1.4, 380, mVerb, breakdown ? 700 : 1100); v.o.detune.value = det; }
      // низкий гул
      if (s === 0) mOsc(t, mtof(ch.root), 'sine', STEP * 16 + 0.4, 0.2, 0.8, 200);
      // пульсирующий бас восьмыми
      if (sect >= 2 && !breakdown && s % 2 === 0) mOsc(t, mtof(ch.root + 12), 'sawtooth', STEP * 1.8, s % 4 === 0 ? 0.09 : 0.06, 0.004, 240, null, 520);
      // ударные: глубокая бочка, малый с хвостом, шейкер
      if (full) {
        if (s === 0 || s === 10) kick(t, 1); if (s === 7 && bar % 2) kick(t, 0.6);
        if (s === 8) { mNoise(t, 0.22, 'bandpass', 1400, 0.16, musicBus, 0.8); mNoise(t, 0.3, 'bandpass', 1400, 0.12, mVerb, 0.8); }
        if (s % 2 === 1) mNoise(t, 0.05, 'highpass', 6500, s % 4 === 3 ? 0.035 : 0.02);
        if (bar % 4 === 3 && s >= 12) tom(t, [130, 110, 95, 80][s - 12]);
      } else if (!breakdown && sect >= 2 && s === 0) kick(t, 0.7);
      // редкая мелодия колокольчиком с эхом
      if (sect >= 8 && sect < 20 && MEL[s] && bar % 2 === 0) { const n = MEL[s] + (bar % 8 >= 4 ? -2 : 0); mOsc(t, mtof(n), 'triangle', STEP * 6, 0.05, 0.005, 2400, mDelay); mOsc(t, mtof(n), 'sine', STEP * 6, 0.04, 0.005, 3000); }
      // нарастающий шум перед частью
      if ((sect === 3 || sect === 19) && s === 0) { const g = mNoise(t, STEP * 16, 'bandpass', 900, 0.001, mVerb, 0.6); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + STEP * 15.5); g.gain.linearRampToValueAtTime(0.0001, t + STEP * 16); }
    }
  }
  function applyMusicVol() {
    if (!ctx) return;
    const v = musicOn ? vol.music * (inGame ? 0.55 : 1) * 0.5 : 0;
    musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  }

  window.Sfx = {
    init, shot, whoosh, step3, bolt, inspect, flick, reloadStart, reloadEnd, dry, hit, killDing, deploy, buy, uiClick, step,
    setVolume(kind, v) { vol[kind] = v; if (!ctx) return; if (kind === 'sfx') sfxBus.gain.value = v; else applyMusicVol(); },
    setInGame(v) { inGame = v; applyMusicVol(); },
    toggleMusic() { musicOn = !musicOn; applyMusicVol(); return musicOn; },
    get musicOn() { return musicOn; },
  };
})();
