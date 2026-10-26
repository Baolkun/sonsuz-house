// Enstrümanlar ve efektler. Hepsi Web Audio düğümleriyle sentezlenir; örnek kayıt yok.
import { midiHz } from './kuram.js';

export function curve(fn, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
}
export const tanhCurve = (k) => curve((x) => Math.tanh(k * x) / Math.tanh(k));

// Bir notanın düğümleri, son kaynak bitince sökülür (saatlerce çalınca bellek şişmesin)
function done(src, nodes) {
  src.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {}
    }
  };
}

export class Kit {
  constructor(ctx) {
    this.ctx = ctx;
    const sr = ctx.sampleRate;
    const nb = ctx.createBuffer(1, sr * 2, sr);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    const pw = (amps) => {
      const re = new Float32Array(amps.length + 1);
      const im = new Float32Array(amps.length + 1);
      amps.forEach((a, i) => (im[i + 1] = a));
      return ctx.createPeriodicWave(re, im);
    };
    this.waves = {
      organ: pw([1, 0.62, 0.36, 0.42, 0, 0.2, 0, 0.24]),
      organSoft: pw([1, 0.4, 0.18, 0.16, 0, 0.05]),
      softSaw: pw(Array.from({ length: 28 }, (_, i) => (1 / (i + 1)) * Math.exp(-i / 9))),
      darkSaw: pw(Array.from({ length: 16 }, (_, i) => (1 / (i + 1)) * Math.exp(-i / 4))),
      hollow: pw([1, 0, 0.33, 0, 0.18, 0, 0.1, 0, 0.05]),
      bassOrgan: pw([1, 0.55, 0.22, 0.12]),
      warm: pw([1, 0.28, 0.1, 0.04]),
    };
  }

  osc(type, f, t) {
    const o = this.ctx.createOscillator();
    if (this.waves[type]) o.setPeriodicWave(this.waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }

  noiseSrc(t) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random() * 1.5;
    return s;
  }

  // Rhodes: iki operatörlü FM gövde + kısa "tine" çınlaması; hız parlaklığı artırır
  rhodes(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const car = c.createOscillator();
    car.frequency.setValueAtTime(f, t);
    const mod = c.createOscillator();
    mod.frequency.setValueAtTime(f * p.ratio, t);
    const mg = c.createGain();
    const reg = Math.min(1, Math.max(0.35, 1.25 - (midi - 48) / 48)); // tizde daha az FM
    const I0 = p.index * (0.35 + 0.95 * vel) * f * reg;
    mg.gain.setValueAtTime(I0, t);
    mg.gain.setTargetAtTime(I0 * p.indexFloor, t + 0.004, p.indexDecay);
    mod.connect(mg).connect(car.frequency);
    const amp = c.createGain();
    const peak = 0.2 * (0.3 + 0.7 * vel) * (1 - Math.max(0, midi - 72) / 60);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.003);
    amp.gain.setTargetAtTime(peak * 0.45, t + 0.004, 0.25);
    amp.gain.setTargetAtTime(0, t + 0.5, p.decay);
    amp.gain.setTargetAtTime(0, t + dur, p.release);
    car.connect(amp).connect(out);
    const tine = c.createOscillator();
    tine.frequency.setValueAtTime(f * p.tineRatio, t);
    const tg = c.createGain();
    tg.gain.setValueAtTime(p.tine * vel * 0.06, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + 0.05 * vel);
    tine.connect(tg).connect(out);
    const end = t + dur + p.release * 6;
    for (const o of [car, mod]) {
      o.start(t);
      o.stop(end);
    }
    tine.start(t);
    tine.stop(t + 0.2);
    done(car, [car, mod, mg, amp]);
    done(tine, [tine, tg]);
  }

  // Org akoru (Korg M1 house org tadında): kısa, parlak, süzgeçli
  organ(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const o = this.osc(p.soft ? 'organSoft' : 'organ', f, t);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    const cut = p.cutoff * (0.6 + 0.8 * vel);
    lp.frequency.setValueAtTime(cut * 2.2, t);
    lp.frequency.setTargetAtTime(cut, t + 0.002, p.fdecay);
    const amp = c.createGain();
    const peak = 0.15 * (0.4 + 0.6 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.003);
    amp.gain.setTargetAtTime(peak * p.sustain, t + 0.006, p.decay);
    amp.gain.setTargetAtTime(0, t + dur, p.release);
    o.connect(lp).connect(amp).connect(out);
    o.start(t);
    o.stop(t + dur + p.release * 6);
    done(o, [o, lp, amp]);
  }

  // Testere yığını: Juno tarzı kısa akor ya da yavaş açılan pad
  saws(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const amp = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = p.q ?? 0.7;
    const cut = p.cutoff * (0.7 + 0.6 * vel);
    if (p.envAmt) {
      lp.frequency.setValueAtTime(cut * (1 + p.envAmt), t);
      lp.frequency.setTargetAtTime(cut, t + 0.002, p.fdecay);
    } else lp.frequency.setValueAtTime(cut, t);
    const peak = (p.level ?? 0.06) * (0.5 + 0.5 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.attack);
    if (p.decay) amp.gain.setTargetAtTime(peak * p.sustain, t + p.attack, p.decay);
    amp.gain.setTargetAtTime(0, t + Math.max(dur, p.attack), p.release);
    const end = t + Math.max(dur, p.attack) + p.release * 6;
    const nodes = [amp, lp];
    let first = null;
    for (let i = 0; i < p.voices; i++) {
      const o = this.osc(p.wave || 'softSaw', f * (p.octaves?.[i] ?? 1), t);
      const spread = p.voices > 1 ? (i / (p.voices - 1) - 0.5) * 2 : 0;
      o.detune.setValueAtTime(spread * p.detune + (Math.random() - 0.5) * 3, t);
      o.connect(lp);
      o.start(t);
      o.stop(end);
      nodes.push(o);
      first = first || o;
    }
    lp.connect(amp).connect(out);
    done(first, nodes);
  }

  // Bas: sinüs alt + tür sesi; kayma (glide) desteği
  bass(out, t, midi, dur, vel, p, from) {
    const c = this.ctx;
    const f = midiHz(midi);
    const amp = c.createGain();
    const peak = 0.34 * (0.55 + 0.45 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.006);
    amp.gain.setTargetAtTime(peak * p.sustain, t + 0.01, p.decay);
    amp.gain.setTargetAtTime(0, t + dur, 0.03);
    const end = t + dur + 0.25;
    const nodes = [amp];
    const glide = (o, mul) => {
      if (from != null) {
        o.frequency.setValueAtTime(midiHz(from) * mul, t);
        o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.06);
      }
    };
    const sub = c.createOscillator();
    sub.frequency.setValueAtTime(f, t);
    glide(sub, 1);
    const subG = c.createGain();
    subG.gain.value = p.sub;
    sub.connect(subG).connect(amp);
    nodes.push(sub, subG);
    let top;
    if (p.type === 'pluck') {
      top = this.osc('sawtooth', f, t);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = p.q;
      const cut = p.cutoff * (0.7 + 0.6 * vel);
      lp.frequency.setValueAtTime(cut * 3, t);
      lp.frequency.setTargetAtTime(cut, t + 0.003, p.fdecay);
      top.connect(lp);
      const tg = c.createGain();
      tg.gain.value = p.top;
      lp.connect(tg).connect(amp);
      nodes.push(lp, tg);
    } else if (p.type === 'fm') {
      top = c.createOscillator();
      top.frequency.setValueAtTime(f, t);
      const m = c.createOscillator();
      m.frequency.setValueAtTime(f * p.ratio, t);
      glide(m, p.ratio);
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * p.index * (0.5 + vel), t);
      mg.gain.setTargetAtTime(f * p.index * 0.15, t + 0.004, p.fdecay);
      m.connect(mg).connect(top.frequency);
      m.start(t);
      m.stop(end);
      const tg = c.createGain();
      tg.gain.value = p.top;
      top.connect(tg).connect(amp);
      nodes.push(m, mg, tg);
    } else {
      top = this.osc(p.type === 'organ' ? 'bassOrgan' : 'warm', f, t);
      const tg = c.createGain();
      tg.gain.value = p.top;
      top.connect(tg).connect(amp);
      nodes.push(tg);
    }
    glide(top, 1);
    nodes.push(top);
    amp.connect(out);
    sub.start(t);
    sub.stop(end);
    top.start(t);
    top.stop(end);
    done(sub, nodes);
  }

  // Tokmaklı sesler: kalimba, marimba, çan, pluck (FM, hızlı sönen indeks)
  mallet(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const car = c.createOscillator();
    car.frequency.setValueAtTime(f, t);
    const mod = c.createOscillator();
    mod.frequency.setValueAtTime(f * p.ratio, t);
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * p.index * (0.4 + 0.8 * vel), t);
    mg.gain.setTargetAtTime(0, t + 0.001, p.idecay);
    mod.connect(mg).connect(car.frequency);
    const amp = c.createGain();
    const peak = 0.16 * (0.35 + 0.65 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.002);
    amp.gain.setTargetAtTime(0, t + 0.003, p.decay);
    car.connect(amp).connect(out);
    const end = t + p.decay * 7;
    car.start(t);
    mod.start(t);
    car.stop(end);
    mod.stop(end);
    done(car, [car, mod, mg, amp]);
  }

  // Flüt: üçgen dalga + nefes gürültüsü + gecikmeli vibrato
  flute(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    const lfo = c.createOscillator();
    lfo.frequency.value = p.vibRate;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
    lfo.connect(lg).connect(o.frequency);
    const amp = c.createGain();
    const peak = 0.11 * (0.5 + 0.5 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.attack);
    amp.gain.setTargetAtTime(0, t + dur, 0.09);
    o.connect(amp).connect(out);
    const n = this.noiseSrc(t);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 2.5;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(peak * p.breath, t + 0.03);
    ng.gain.setTargetAtTime(peak * p.breath * 0.3, t + 0.05, 0.1);
    ng.gain.setTargetAtTime(0, t + dur, 0.06);
    n.connect(bp).connect(ng).connect(out);
    const end = t + dur + 0.6;
    for (const s of [o, lfo, n]) {
      s.start(t);
      s.stop(end);
    }
    done(o, [o, lfo, lg, amp, n, bp, ng]);
  }

  // Formant vokal: testere → üç bant geçiren (ünlü harf) → zarf
  vox(out, t, midi, dur, vel, p) {
    const c = this.ctx;
    const f = midiHz(midi);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.3);
    lfo.connect(lg).connect(o.frequency);
    const amp = c.createGain();
    const peak = 0.07 * (0.5 + 0.5 * vel);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.attack);
    amp.gain.setTargetAtTime(0, t + dur, p.release);
    const nodes = [o, lfo, lg, amp];
    const gains = [1, 0.5, 0.22];
    p.formants.forEach((ff, i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = 9 + i * 3;
      const g = c.createGain();
      g.gain.value = gains[i] * 3.2;
      o.connect(bp).connect(g).connect(amp);
      nodes.push(bp, g);
    });
    amp.connect(out);
    const end = t + dur + p.release * 6;
    o.start(t);
    lfo.start(t);
    o.stop(end);
    lfo.stop(end);
    done(o, nodes);
  }

  // Örneği çal (davullar önceden üretilmiş tampondan)
  hit(out, buf, t, vel, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vel;
    s.connect(g).connect(out);
    s.start(t);
    done(s, [s, g]);
  }

  // Gürültü süpürmesi: geçişlerde yükselen ya da alçalan nefes
  sweep(out, t, dur, up, level) {
    const c = this.ctx;
    const n = this.noiseSrc(t);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(up ? 400 : 6000, t);
    f.frequency.exponentialRampToValueAtTime(up ? 6000 : 300, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    if (up) {
      g.gain.exponentialRampToValueAtTime(level, t + dur * 0.97);
      g.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      g.gain.linearRampToValueAtTime(level, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    n.connect(f).connect(g).connect(out);
    n.start(t);
    n.stop(t + dur + 0.05);
    done(n, [n, f, g]);
  }
}

// ---------- Davullar: her parça için yeniden ayarlanıp çevrimdışı üretilir ----------

async function render(sr, dur, build, crush) {
  const oc = new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
  build(oc, oc.destination);
  const buf = await oc.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak > 0 ? 0.9 / peak : 1;
  const q = crush ? 2 ** (crush - 1) : 0;
  for (let i = 0; i < d.length; i++) {
    let v = d[i] * k;
    if (q) v = Math.round(v * q) / q;
    d[i] = v;
  }
  // son 5 ms yumuşak kapanış: tık sesi olmasın
  const fade = Math.min(d.length, Math.floor(sr * 0.005));
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  return buf;
}

function noiseNode(oc, dur) {
  const b = oc.createBuffer(1, Math.ceil(dur * oc.sampleRate), oc.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = oc.createBufferSource();
  s.buffer = b;
  return s;
}

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export async function renderKit(baseRate, P) {
  const sr = P.lofi ? P.lofiRate : baseRate;
  const crush = P.lofi ? P.bits : 0;
  const kit = {};
  const K = P.kick;
  kit.kick = await render(sr, K.dec * 2.6 + 0.05, (oc, out) => {
    const o = oc.createOscillator();
    o.frequency.setValueAtTime(K.f0, 0);
    o.frequency.exponentialRampToValueAtTime(K.f1, K.pdec);
    o.frequency.linearRampToValueAtTime(K.f1 * 0.94, K.dec * 2);
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(1, 0.0015);
    g.gain.setValueAtTime(1, 0.01 + K.hold);
    g.gain.setTargetAtTime(0, 0.01 + K.hold, K.dec / 2.2);
    const ws = oc.createWaveShaper();
    ws.curve = tanhCurve(K.drive);
    o.connect(g).connect(ws).connect(out);
    o.start(0);
    const n = noiseNode(oc, 0.01);
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const ng = oc.createGain();
    ng.gain.setValueAtTime(K.click, 0);
    ng.gain.exponentialRampToValueAtTime(0.001, 0.008);
    n.connect(hp).connect(ng).connect(out);
    n.start(0);
  }, crush);

  const C = P.clap;
  kit.clap = await render(sr, C.tail * 5 + 0.06, (oc, out) => {
    const n = noiseNode(oc, C.tail * 5 + 0.06);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = C.bp;
    bp.Q.value = C.q;
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    for (let i = 0; i < C.hits; i++) {
      const at = i * C.gap;
      g.gain.setValueAtTime(0.85, at);
      g.gain.setTargetAtTime(0.05, at + 0.001, 0.0035);
    }
    const tailAt = C.hits * C.gap;
    g.gain.setValueAtTime(1, tailAt);
    g.gain.setTargetAtTime(0, tailAt + 0.001, C.tail);
    n.connect(bp).connect(hp).connect(g).connect(out);
    n.start(0);
  }, crush);

  const S = P.snare;
  kit.snare = await render(sr, 0.5, (oc, out) => {
    const o = oc.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(S.f * 1.6, 0);
    o.frequency.exponentialRampToValueAtTime(S.f, 0.03);
    const og = oc.createGain();
    og.gain.setValueAtTime(0.8, 0);
    og.gain.setTargetAtTime(0, 0.005, 0.04);
    o.connect(og).connect(out);
    o.start(0);
    const n = noiseNode(oc, 0.5);
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = S.hp;
    const ng = oc.createGain();
    ng.gain.setValueAtTime(0.7, 0);
    ng.gain.setTargetAtTime(0, 0.004, S.tail);
    n.connect(hp).connect(ng).connect(out);
    n.start(0);
  }, crush);

  const H = P.hat;
  const metal = (oc, out, dur, tau, level, bpF, hpF) => {
    const sum = oc.createGain();
    sum.gain.value = 0.25;
    for (const f of METAL) {
      const o = oc.createOscillator();
      o.type = 'square';
      o.frequency.value = f * H.tune;
      o.connect(sum);
      o.start(0);
    }
    const n = noiseNode(oc, dur);
    const ng = oc.createGain();
    ng.gain.value = H.noise;
    n.connect(ng).connect(sum);
    n.start(0);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpF;
    bp.Q.value = 0.9;
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpF;
    hp.Q.value = 1.2;
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(level, 0.001);
    g.gain.setTargetAtTime(0, 0.002, tau);
    sum.connect(bp).connect(hp).connect(g).connect(out);
  };
  kit.hatC = await render(sr, H.closed * 6 + 0.02, (oc, out) => metal(oc, out, H.closed * 6 + 0.02, H.closed, 1, H.bp, H.hp), crush);
  kit.hatO = await render(sr, H.open * 5 + 0.02, (oc, out) => metal(oc, out, H.open * 5 + 0.02, H.open, 1, H.bp * 0.9, H.hp * 0.95), crush);
  kit.ride = await render(sr, 1.6, (oc, out) => metal(oc, out, 1.6, P.ride.tail, 1, P.ride.bp, P.ride.bp * 0.7), crush);

  const SH = P.shaker;
  kit.shaker = await render(sr, SH.tail * 6 + 0.03, (oc, out) => {
    const n = noiseNode(oc, 0.4);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = SH.bp;
    bp.Q.value = 1.1;
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(1, SH.attack);
    g.gain.setTargetAtTime(0, SH.attack, SH.tail);
    n.connect(bp).connect(g).connect(out);
    n.start(0);
  }, crush);

  const R = P.rim;
  kit.rim = await render(sr, 0.15, (oc, out) => {
    for (const [mul, type, lvl] of [[1, 'triangle', 1], [0.29, 'sine', 0.6]]) {
      const o = oc.createOscillator();
      o.type = type;
      o.frequency.value = R.f * mul;
      const g = oc.createGain();
      g.gain.setValueAtTime(lvl, 0);
      g.gain.setTargetAtTime(0, 0.001, R.tail);
      o.connect(g).connect(out);
      o.start(0);
    }
  }, crush);

  kit.clave = await render(sr, 0.2, (oc, out) => {
    const o = oc.createOscillator();
    o.frequency.value = P.clave.f;
    const g = oc.createGain();
    g.gain.setValueAtTime(1, 0);
    g.gain.setTargetAtTime(0, 0.001, 0.028);
    o.connect(g).connect(out);
    o.start(0);
  }, crush);

  const drumTone = (f, tau, slap) => (oc, out) => {
    const o = oc.createOscillator();
    o.frequency.setValueAtTime(f * 1.35, 0);
    o.frequency.exponentialRampToValueAtTime(f, 0.025);
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(1, 0.002);
    g.gain.setTargetAtTime(0, 0.004, tau);
    o.connect(g).connect(out);
    o.start(0);
    const n = noiseNode(oc, 0.03);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const ng = oc.createGain();
    ng.gain.setValueAtTime(slap, 0);
    ng.gain.exponentialRampToValueAtTime(0.001, 0.012);
    n.connect(bp).connect(ng).connect(out);
    n.start(0);
  };
  const CG = P.conga;
  kit.congaHi = await render(sr, CG.tail * 6, drumTone(CG.hi, CG.tail, 0.25), crush);
  kit.congaLo = await render(sr, CG.tail * 6, drumTone(CG.lo, CG.tail * 1.2, 0.18), crush);
  kit.bongo = await render(sr, CG.tail * 4, drumTone(CG.bongo, CG.tail * 0.7, 0.3), crush);
  kit.tom = await render(sr, 0.7, (oc, out) => {
    for (const [mul, lvl] of [[1, 1], [1.5, 0.35]]) {
      const o = oc.createOscillator();
      o.frequency.setValueAtTime(P.tom.f * mul * 1.6, 0);
      o.frequency.exponentialRampToValueAtTime(P.tom.f * mul, 0.12);
      const g = oc.createGain();
      g.gain.setValueAtTime(lvl, 0);
      g.gain.setTargetAtTime(0, 0.003, 0.11);
      o.connect(g).connect(out);
      o.start(0);
    }
  }, crush);
  kit.tamb = await render(sr, 0.35, (oc, out) => {
    const n = noiseNode(oc, 0.35);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 8500;
    bp.Q.value = 2;
    const g = oc.createGain();
    g.gain.setValueAtTime(0, 0);
    for (let i = 0; i < 3; i++) {
      g.gain.setValueAtTime(1 - i * 0.25, i * 0.012);
      g.gain.setTargetAtTime(0.1, i * 0.012 + 0.001, 0.006);
    }
    g.gain.setTargetAtTime(0, 0.04, 0.05);
    n.connect(bp).connect(g).connect(out);
    n.start(0);
  }, crush);
  return kit;
}

// ---------- Efektler ----------

// Üretilmiş yankı (impulse response): yoğun, yüksek frekansları zamanla sönen gürültü
export function makeIR(ctx, rt60, size, damp, rng) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * Math.min(3.2, rt60 * 1.1));
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * (0.008 + 0.02 * size));
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / rt60);
      const fc = 9000 * Math.exp(-t * damp) + 700;
      const a = Math.exp((-2 * Math.PI * fc) / sr);
      lp = a * lp + (1 - a) * (rng.f() * 2 - 1);
      d[i] = lp * env * (t < 0.002 ? t / 0.002 : 1);
    }
    // erken yansımalar
    for (let k = 0; k < 7; k++) {
      const at = pre + Math.floor(sr * (0.004 + rng.f() * 0.05 * (0.5 + size)));
      if (at < len) d[at] += (rng.f() < 0.5 ? -1 : 1) * (0.5 - k * 0.05);
    }
  }
  return buf;
}

export function makeChorus(ctx, rate, depth, delay, wet) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1 - wet * 0.5;
  input.connect(dry).connect(output);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  lfo.start();
  const nodes = [input, output, dry, lfo];
  [-1, 1].forEach((side) => {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = delay;
    const lg = ctx.createGain();
    lg.gain.value = depth * side;
    lfo.connect(lg).connect(d.delayTime);
    const pan = ctx.createStereoPanner();
    pan.pan.value = side * 0.8;
    const g = ctx.createGain();
    g.gain.value = wet;
    input.connect(d).connect(pan).connect(g).connect(output);
    nodes.push(d, lg, pan, g);
  });
  return { input, output, nodes, stop: () => lfo.stop() };
}

export function makePingPong(ctx, time, fb, lpF) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 350;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lpF;
  const dl = ctx.createDelay(2);
  const dr = ctx.createDelay(2);
  dl.delayTime.value = time;
  dr.delayTime.value = time;
  const fl = ctx.createGain();
  const fr = ctx.createGain();
  fl.gain.value = fb;
  fr.gain.value = fb;
  const pl = ctx.createStereoPanner();
  const pr = ctx.createStereoPanner();
  pl.pan.value = -0.7;
  pr.pan.value = 0.7;
  input.connect(hp).connect(lp).connect(dl);
  dl.connect(pl).connect(output);
  dl.connect(fl).connect(dr);
  dr.connect(pr).connect(output);
  dr.connect(fr).connect(dl);
  return { input, output, dl, dr, nodes: [input, output, hp, lp, dl, dr, fl, fr, pl, pr] };
}
