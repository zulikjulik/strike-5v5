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
    verb = ctx.createConvolver(); verb.buffer = makeIR(1.8, 3);
    verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.5; verb.connect(verbOut); verbOut.connect(sfxBus);
    // эхо (отражение от зданий): задержка с обратной связью и фильтром
    echoIn = ctx.createGain(); const dl = ctx.createDelay(1); dl.delayTime.value = 0.21; const fb = ctx.createGain(); fb.gain.value = 0.32; const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1600;
    const eo = ctx.createGain(); eo.gain.value = 0.42; echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(eo); eo.connect(sfxBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function noise(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.start(t, Math.random() * 1.5, dur + 0.05); return s;
  }
  function env(g, t, peak, a, d) {
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
    const send = ctx.createGain(); send.gain.value = P.tail * (0.6 + (1 - k) * 0.8); lp.connect(send); send.connect(verbIn);
    const es = ctx.createGain(); es.gain.value = w.sil ? 0.05 : P.tail * 0.9; lp.connect(es); es.connect(echoIn);
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
    if (distPx < 40) { click(1300 * det, 0.22, 0.012); click(2400 * det, 0.12, 0.03); }
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
    const n = noise(t, 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 6;
    const g = ctx.createGain(); env(g, t, gain, 0.001, 0.04); n.connect(bp); bp.connect(g); g.connect(sfxBus);
  }
  function tone(freq, gain, dur, delay, type) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); env(g, t, gain, 0.003, dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  const shell = (distM) => { if (!ctx) return; const a = Math.max(0, 1 - distM / 14); if (a <= 0) return; const t = ctx.currentTime, f = 3200 + Math.random() * 2600; for (const [ff, d] of [[f, 0], [f * 1.48, 0.004]]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = ff; const g = ctx.createGain(); env(g, t + d, 0.05 * a, 0.001, 0.08); o.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + 0.12); } };
  const reloadStart = () => { click(2400, 0.5); click(900, 0.35, 0.08); };
  const reloadEnd = () => { click(3200, 0.5); click(1800, 0.45, 0.09); };
  const dry = () => click(4000, 0.4);
  const hit = () => tone(1700, 0.12, 0.05, 0, 'triangle');
  const killDing = () => { tone(880, 0.18, 0.12); tone(1320, 0.18, 0.2, 0.08); };
  const deploy = () => click(2000, 0.3);
  const buy = () => { tone(660, 0.15, 0.08); tone(990, 0.15, 0.15, 0.06); click(3000, 0.3, 0.02); };
  const uiClick = () => click(2500, 0.2);
  const step3 = (distPx, pan, k) => { if (!ctx) return; const a = Math.max(0, 1 - distPx / 700); if (a <= 0) return; const t = ctx.currentTime; const n = noise(t, 0.06), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const g = ctx.createGain(); env(g, t, 0.22 * a * a * (k || 1), 0.003, 0.06); const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; n.connect(lp); lp.connect(g); if (pn) { pn.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus); };
  const bolt = () => { click(1800, 0.35); click(2600, 0.35, 0.14); click(1200, 0.3, 0.3); };
  const inspect = () => { click(1500, 0.15); click(900, 0.12, 0.25); };
  const flick = () => { click(3500, 0.25); click(4200, 0.2, 0.06); };
  const step = (k) => { if (!ctx) return; const t = ctx.currentTime; const n = noise(t, 0.05), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); env(g, t, 0.12 * k, 0.003, 0.05); n.connect(lp); lp.connect(g); g.connect(sfxBus); };

  // ---------- Музыка: лёгкий синтвейв-эмбиент, 4 аккорда, процедурно ----------
  const BPM = 96, STEP = 60 / BPM / 4;
  const CHORDS = [ // ля минор: Am F C G
    { root: 45, notes: [57, 60, 64] }, { root: 41, notes: [57, 60, 65] }, { root: 48, notes: [55, 60, 64] }, { root: 43, notes: [55, 59, 62] },
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let mStep = 0, mNext = 0, mTimer = null, mDelay = null;

  function startMusic() {
    mDelay = ctx.createDelay(1); mDelay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.35; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2500;
    mDelay.connect(dl); dl.connect(fb); fb.connect(mDelay); dl.connect(musicBus);
    mNext = ctx.currentTime + 0.1;
    mTimer = setInterval(schedule, 25);
    applyMusicVol();
  }
  function mNoise(t, dur, type, f, gain, dest) {
    const n = noise(t, dur), fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ctx.createGain(); env(g, t, gain, 0.001, dur); n.connect(fl); fl.connect(g); g.connect(dest || musicBus);
  }
  function mOsc(t, freq, type, dur, gain, a, cutoff, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(dest || musicBus); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function schedule() {
    if (!ctx) return;
    while (mNext < ctx.currentTime + 0.12) {
      const s = mStep % 16, bar = Math.floor(mStep / 16), ch = CHORDS[bar % 4], sect = bar % 16;
      const t = mNext;
      const drums = sect >= 2 && !(sect >= 12 && sect < 14);
      // пэд
      if (s === 0) for (const n of ch.notes) for (const det of [-6, 6]) { const o = mOsc(t, mtof(n), 'sawtooth', STEP * 16 + 0.3, 0.035, 0.6, 900); o.detune.value = det; }
      // бас
      if (sect >= 1 && [0, 3, 6, 8, 11, 14].includes(s)) mOsc(t, mtof(ch.root), 'triangle', STEP * 2.2, 0.22, 0.005, 600);
      if (drums) {
        if (s === 0 || s === 8 || (s === 10 && bar % 2)) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ctx.createGain(); env(g, t, 0.5, 0.002, 0.18); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25); }
        if (s === 4 || s === 12) mNoise(t, 0.14, 'bandpass', 1800, 0.12);
        if (s % 2 === 0) mNoise(t, s === 14 ? 0.12 : 0.03, 'highpass', 7500, s % 4 === 2 ? 0.06 : 0.035);
      }
      // арпеджио
      if (sect >= 4 && s % 2 === 0) {
        const seq = [0, 1, 2, 1, 0, 2, 1, 2];
        const n = ch.notes[seq[(s / 2) % 8]] + 12;
        mOsc(t, mtof(n), 'square', STEP * 1.5, 0.03, 0.003, 2200, mDelay);
        mOsc(t, mtof(n), 'square', STEP * 1.5, 0.03, 0.003, 2200);
      }
      mNext += STEP; mStep++;
    }
  }
  function applyMusicVol() {
    if (!ctx) return;
    const v = musicOn ? vol.music * (inGame ? 0.55 : 1) * 0.5 : 0;
    musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  }

  window.Sfx = {
    init, shot, whoosh, shell, step3, bolt, inspect, flick, reloadStart, reloadEnd, dry, hit, killDing, deploy, buy, uiClick, step,
    setVolume(kind, v) { vol[kind] = v; if (!ctx) return; if (kind === 'sfx') sfxBus.gain.value = v; else applyMusicVol(); },
    setInGame(v) { inGame = v; applyMusicVol(); },
    toggleMusic() { musicOn = !musicOn; applyMusicVol(); return musicOn; },
    get musicOn() { return musicOn; },
  };
})();
