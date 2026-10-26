// Çevrimdışı deneme: gerçek çalma gibi 2 sn ileriyi kurar, render'ı durdurup devam ettirir.
import { Motor } from '../js/motor.js';
import { Akis, Track } from '../js/besteci.js';

export async function olc({ secs = 120, energy = 0.5, mood = 0.5, shortFirst = 0, outLen = 32, sr = 44100 } = {}, prog = {}) {
  const oc = new OfflineAudioContext(2, sr * secs, sr);
  const m = new Motor();
  m.init(oc);
  m.setVolume(1);
  const ak = new Akis(m);
  ak.energy = energy;
  ak.mood = mood;
  const dna = ak.pickNext(null);
  const tr = new Track(dna, m);
  await tr.prepare();
  tr.bus.out.gain.value = 1;
  ak.tracks.push(tr);
  ak.bpm = dna.bpm;
  if (shortFirst) tr.forceOutro(shortFirst, outLen);
  ak.nextBarTime = 0.05;
  const log = [];
  ak.on('track', (t) => log.push({ bar: ak.bar, style: t.d.style, bpm: t.d.bpm, key: t.d.tonic + ' ' + t.d.mode, chord: t.d.chordInst, lead: t.d.lead.inst, bass: t.d.bassType, prog: t.d.progId }));
  const step = 2;
  const schedule = async (until) => {
    while (ak.nextBarTime < until) {
      ak.playBar();
      const cur = ak.tracks[ak.tracks.length - 1];
      if (!ak.preparing && cur.startBar + cur.len - ak.bar <= cur.d.outroBars + 20) await ak.prepareNext(cur);
    }
  };
  await schedule(step * 2);
  for (let t = step; t < secs - 0.1; t += step) {
    const at = t;
    oc.suspend(at).then(async () => {
      prog.t = at;
      await schedule(at + step * 2);
      oc.resume();
    });
  }
  const t0 = performance.now();
  const buf = await oc.startRendering();
  const ms = performance.now() - t0;
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let peak = 0;
  let nan = 0;
  const blk = sr * 4;
  const curve = [];
  for (let i = 0; i + blk <= L.length; i += blk) {
    let s = 0;
    for (let j = i; j < i + blk; j++) {
      const a = L[j];
      const b = R[j];
      if (a !== a || b !== b) nan++;
      const p = Math.max(Math.abs(a), Math.abs(b));
      if (p > peak) peak = p;
      s += a * a + b * b;
    }
    curve.push(Math.round(10 * Math.log10(s / (2 * blk) + 1e-12)));
  }
  return { speed: +(secs / (ms / 1000)).toFixed(1), peakDb: +(20 * Math.log10(peak)).toFixed(1), nan, curve4s: curve.join(' '), log, buf };
}

// Yalnız kanal çıkışlarını kaydeder: WAV
export function wav(buf) {
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

// Bas payı: 120 Hz altının toplam içindeki payı (dB) ve sert tepe sayısı
export async function basPayi(buf) {
  const oc = new OfflineAudioContext(2, buf.length, buf.sampleRate);
  const src = oc.createBufferSource();
  src.buffer = buf;
  const lp = oc.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  const lp2 = oc.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.frequency.value = 120;
  src.connect(lp).connect(lp2).connect(oc.destination);
  src.start();
  const low = await oc.startRendering();
  const rms = (b) => {
    let s = 0;
    const L = b.getChannelData(0);
    for (let i = 0; i < L.length; i++) s += L[i] * L[i];
    return Math.sqrt(s / L.length);
  };
  let hot = 0;
  const L = buf.getChannelData(0);
  for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) > 0.5) hot++;
  return { lowShareDb: +(20 * Math.log10(rms(low) / rms(buf))).toFixed(1), totalDb: +(20 * Math.log10(rms(buf))).toFixed(1), hotPerSec: Math.round(hot / (L.length / buf.sampleRate)) };
}
