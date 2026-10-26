// Ses motoru: ana zincir, parça kanalları, zamanlayıcı, ortam sesleri.
import { Kit, tanhCurve, makeIR, makeChorus, makePingPong } from './sesler.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Motor {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.neighbor = false;
  }

  init(ctxOverride) {
    if (this.ctx) return;
    const c = ctxOverride || new AudioContext({ latencyHint: 'playback' });
    this.ctx = c;
    this.kit = new Kit(c);
    this.in = c.createGain();
    this.in.gain.value = 0.9;
    const biq = (type, f, q, g) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q != null) b.Q.value = q;
      if (g != null) b.gain.value = g;
      return b;
    };
    this.hp1 = biq('highpass', 22, 0.707);
    this.hp2 = biq('highpass', 22, 0.707);
    this.low = biq('lowshelf', 130, null, 0);
    this.mud = biq('peaking', 320, 0.9, -1.5);
    this.high = biq('highshelf', 7500, null, 0);
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 2.2;
    this.comp.attack.value = 0.025;
    this.comp.release.value = 0.3;
    this.clip = c.createWaveShaper();
    this.clip.curve = tanhCurve(1.15);
    this.clip.oversample = '2x';
    this.lim = c.createDynamicsCompressor();
    this.lim.threshold.value = -5;
    this.lim.knee.value = 0;
    this.lim.ratio.value = 20;
    this.lim.attack.value = 0.003;
    this.lim.release.value = 0.25;
    this.trim = c.createGain();
    this.trim.gain.value = 0.72;
    this.vol = c.createGain();
    this.an = c.createAnalyser();
    this.an.fftSize = 2048;
    this.an.smoothingTimeConstant = 0.8;
    this.in.connect(this.hp1).connect(this.hp2).connect(this.low).connect(this.mud).connect(this.high);
    this.high.connect(this.comp).connect(this.clip).connect(this.lim).connect(this.trim).connect(this.vol);
    this.vol.connect(this.an);
    this.vol.connect(c.destination);
    this.amb = c.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.hp1);
    this.setVolume(this.volume);
    this.setNeighbor(this.neighbor);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Ses düğmesi; kısık seste bas ve tizi yarım ISO 226 eğrisi kadar telafi eder
  setVolume(v) {
    this.volume = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = v * v;
    this.vol.gain.setTargetAtTime(g, t, 0.08);
    const db = g > 0 ? 20 * Math.log10(g) : -60;
    const below = clamp(-db / 10, 0, 4);
    const lowBoost = this.neighbor ? -4 : clamp(below * 1.6, 0, 6);
    this.low.gain.setTargetAtTime(lowBoost, t, 0.1);
    this.high.gain.setTargetAtTime(clamp(below * 0.7, 0, 2.5), t, 0.1);
  }

  // Komşu modu: duvardan geçen derin bası keser (24 dB/oktav, ~100 Hz)
  setNeighbor(on) {
    this.neighbor = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = on ? 105 : 22;
    this.hp1.frequency.setTargetAtTime(f, t, 0.2);
    this.hp2.frequency.setTargetAtTime(f, t, 0.2);
    this.setVolume(this.volume);
  }

  // Parçanın kendi kanalları ve efektleri; DJ geçişinde iki parça yan yana çalar
  makeTrackBus(fx, rng) {
    const c = this.ctx;
    const nodes = [];
    const g = (v = 1) => {
      const n = c.createGain();
      n.gain.value = v;
      nodes.push(n);
      return n;
    };
    const biq = (type, f, q = 0.707) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      nodes.push(b);
      return b;
    };
    const out = g(0);
    const djHP = biq('highpass', 18);
    const djLP = biq('lowpass', 20000);
    djHP.connect(djLP).connect(out);
    out.connect(this.in);
    const mix = g(1);
    let tail = mix;
    const lfos = [];
    if (fx.lofi) {
      // bant kayması (wow/flutter) + kararmış tiz + hafif doyum
      const wow = c.createDelay(0.05);
      wow.delayTime.value = 0.012;
      nodes.push(wow);
      for (const [rate, depth] of [[fx.wowRate, fx.wowDepth], [fx.flutterRate, fx.wowDepth * 0.12]]) {
        const o = c.createOscillator();
        o.frequency.value = rate;
        const og = g(depth);
        o.connect(og).connect(wow.delayTime);
        o.start();
        lfos.push(o);
        nodes.push(o);
      }
      const lp = biq('lowpass', fx.lofiCut, 0.5);
      const sat = c.createWaveShaper();
      sat.curve = tanhCurve(1.6);
      nodes.push(sat);
      mix.connect(wow).connect(lp).connect(sat);
      tail = sat;
    }
    tail.connect(djHP);

    const drums = g(1);
    drums.connect(mix);
    const pumpBass = g(1);
    pumpBass.connect(mix);
    const pumpMusic = g(1);
    pumpMusic.connect(mix);
    const bassSat = c.createWaveShaper();
    bassSat.curve = tanhCurve(fx.bassDrive);
    bassSat.oversample = '2x';
    nodes.push(bassSat);
    const bassLP = biq('lowpass', 2400, 0.5);
    bassSat.connect(bassLP).connect(pumpBass);

    const conv = c.createConvolver();
    conv.buffer = makeIR(c, fx.rt60, fx.size, fx.damp, rng);
    nodes.push(conv);
    const revHP = biq('highpass', 260);
    const revRet = g(fx.revLevel);
    conv.connect(revHP).connect(revRet).connect(pumpMusic);

    const pp = makePingPong(c, fx.delayTime, fx.delayFb, fx.delayLP);
    nodes.push(...pp.nodes);
    const delRet = g(fx.delayLevel);
    pp.output.connect(delRet).connect(pumpMusic);

    const ch = makeChorus(c, fx.chorusRate, fx.chorusDepth, 0.014, 0.5);
    nodes.push(...ch.nodes);
    ch.output.connect(pumpMusic);

    const chans = {};
    const groups = { drums, bass: bassSat, music: pumpMusic, chorus: ch.input };
    const channel = (name, o) => {
      const input = g(o.level);
      let head = input;
      let filter = null;
      if (o.filter) {
        filter = biq(o.filter.type, o.filter.freq, o.filter.q ?? 0.7);
        input.connect(filter);
        head = filter;
      }
      const pan = c.createStereoPanner();
      pan.pan.value = o.pan ?? 0;
      nodes.push(pan);
      head.connect(pan).connect(groups[o.group]);
      const rev = g(o.rev ?? 0);
      head.connect(rev).connect(conv);
      const del = g(o.del ?? 0);
      head.connect(del).connect(pp.input);
      chans[name] = { input, filter, pan, rev, del };
      return chans[name];
    };

    return {
      out,
      djHP,
      djLP,
      pumpBass,
      pumpMusic,
      pp,
      revRet,
      delRet,
      chans,
      channel,
      dispose: () => {
        for (const o of lfos) {
          try {
            o.stop();
          } catch {}
        }
        ch.stop();
        for (const n of nodes) {
          try {
            n.disconnect();
          } catch {}
        }
      },
    };
  }

  // Arka plan sekmesinde de düzenli atan saat (Worker içindeki zamanlayıcı kısılmaz)
  startTicker(fn) {
    if (!this.worker) {
      const src = 'let id=null;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    }
    this.worker.onmessage = fn;
    this.worker.postMessage(40);
  }

  stopTicker() {
    if (this.worker) this.worker.postMessage(0);
  }

  // ---------- Ortam sesleri: plak cızırtısı, yağmur, deniz, şömine ----------
  setAmbience(kind, level) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    this.amb.gain.setTargetAtTime(kind === 'yok' ? 0 : level, t, 0.6);
    if (kind === this.ambKind) return;
    this.ambKind = kind;
    const old = this.ambNodes || [];
    setTimeout(() => {
      for (const n of old) {
        try {
          n.stop?.();
          n.disconnect();
        } catch {}
      }
    }, 2500);
    const fadeIn = c.createGain();
    fadeIn.gain.setValueAtTime(0, t);
    fadeIn.gain.linearRampToValueAtTime(1, t + 2);
    fadeIn.connect(this.amb);
    if (old.length) {
      const prevFade = old[0];
      prevFade.gain.setTargetAtTime(0, t, 0.5);
    }
    this.ambNodes = [fadeIn];
    if (kind === 'yok') return;
    const sr = c.sampleRate;
    const loops = AMB[kind](sr);
    loops.forEach(({ data, pan, gain }) => {
      const b = c.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      const s = c.createBufferSource();
      s.buffer = b;
      s.loop = true;
      const p = c.createStereoPanner();
      p.pan.value = pan;
      const g = c.createGain();
      g.gain.value = gain;
      s.connect(g).connect(p).connect(fadeIn);
      s.start(t, Math.random() * (data.length / sr));
      this.ambNodes.push(s, g, p);
    });
  }
}

// Döngü uzunlukları birbirine bölünmez; üst üste binince tekrar duyulmaz
function onePole(fc, sr) {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  let y = 0;
  return (x) => (y = a * y + (1 - a) * x);
}
function seamless(d, sr) {
  const n = Math.floor(sr * 0.3);
  for (let i = 0; i < n; i++) {
    const w = i / n;
    d[i] = d[i] * w + d[d.length - n + i] * (1 - w);
  }
  return d.subarray(0, d.length - n);
}

const AMB = {
  plak(sr) {
    const make = (sec, seedPop) => {
      const d = new Float32Array(Math.floor(sr * sec));
      const hiss = onePole(5000, sr);
      const crackleF = onePole(3000, sr);
      let pop = 0;
      for (let i = 0; i < d.length; i++) {
        let v = hiss(Math.random() * 2 - 1) * 0.035;
        if (Math.random() < 0.0009 * seedPop) pop = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 0.9 : 0.35);
        v += crackleF(pop);
        pop *= 0.55;
        d[i] = v;
      }
      return seamless(d, sr);
    };
    return [
      { data: make(7.37, 1), pan: -0.3, gain: 0.8 },
      { data: make(9.71, 0.7), pan: 0.3, gain: 0.8 },
    ];
  },
  yagmur(sr) {
    const make = (sec) => {
      const d = new Float32Array(Math.floor(sr * sec));
      const lp = onePole(3500, sr);
      const lp2 = onePole(900, sr);
      let drop = 0;
      let dropF = onePole(4000, sr);
      let swell = 0.7;
      for (let i = 0; i < d.length; i++) {
        if (i % 2400 === 0) swell = 0.6 + 0.4 * Math.random();
        const w = Math.random() * 2 - 1;
        let v = lp(w) * 0.32 * swell + lp2(w) * 0.25;
        if (Math.random() < 0.0012) {
          drop = (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? -1 : 1);
          dropF = onePole(1500 + Math.random() * 5000, sr);
        }
        v += dropF(drop) * 0.6;
        drop *= 0.93;
        d[i] = v;
      }
      return seamless(d, sr);
    };
    return [
      { data: make(11.3), pan: -0.45, gain: 0.9 },
      { data: make(13.7), pan: 0.45, gain: 0.9 },
    ];
  },
  deniz(sr) {
    const make = (sec) => {
      const d = new Float32Array(Math.floor(sr * sec));
      const n = d.length;
      // dalga zarfları: 6–11 sn aralıklı yumuşak kabarmalar
      const env = new Float32Array(n);
      let pos = 0;
      while (pos < n) {
        const len = Math.floor(sr * (6 + Math.random() * 5));
        const peak = 0.5 + Math.random() * 0.5;
        for (let i = 0; i < len && pos + i < n; i++) {
          const x = i / len;
          env[pos + i] = Math.max(env[pos + i], peak * Math.sin(Math.PI * Math.min(1, x * 1.6)) ** 2 * (x < 0.62 ? 1 : 1 - (x - 0.62) / 0.38));
        }
        pos += Math.floor(len * 0.75);
      }
      let y1 = 0;
      let y2 = 0;
      for (let i = 0; i < n; i++) {
        const fc = 300 + 2200 * env[i];
        const a = Math.exp((-2 * Math.PI * fc) / sr);
        const w = Math.random() * 2 - 1;
        y1 = a * y1 + (1 - a) * w;
        y2 = a * y2 + (1 - a) * y1;
        d[i] = y2 * (0.15 + 0.85 * env[i]) * 0.9;
      }
      return seamless(d, sr);
    };
    return [
      { data: make(23.9), pan: -0.35, gain: 1 },
      { data: make(31.1), pan: 0.35, gain: 0.8 },
    ];
  },
  somine(sr) {
    const make = (sec) => {
      const d = new Float32Array(Math.floor(sr * sec));
      const rumble = onePole(400, sr);
      const crack = onePole(6000, sr);
      let pop = 0;
      let burst = 0;
      for (let i = 0; i < d.length; i++) {
        if (Math.random() < 0.00002) burst = sr * (0.05 + Math.random() * 0.3);
        const rate = burst > 0 ? 0.004 : 0.0003;
        if (burst > 0) burst--;
        if (Math.random() < rate) pop = (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.6);
        d[i] = rumble(Math.random() * 2 - 1) * 0.3 + crack(pop) * 0.9;
        pop *= 0.7;
      }
      return seamless(d, sr);
    };
    return [
      { data: make(8.9), pan: -0.2, gain: 0.9 },
      { data: make(12.1), pan: 0.25, gain: 0.7 },
    ];
  },
};
