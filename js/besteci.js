// Besteci: parça tasarlar, ölçü ölçü çalar, DJ gibi parçadan parçaya geçer.
import { Rng, hash, newSeed } from './rng.js';
import { MODES, modeWeights, diatonicChord, SHAPES, PROGS_MINOR, PROGS_MAJOR, PLANING, voiceChord, camelot } from './kuram.js';
import { renderKit } from './sesler.js';
import { trackName } from './adlar.js';

const lerp = (a, b, x) => a + (b - a) * x;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mod12 = (x) => ((x % 12) + 12) % 12;

// Kalıp harfleri: X vurgulu, x normal, o yumuşak, g hayalet, . boş
const VEL = { X: 1, x: 0.8, o: 0.55, g: 0.3 };
const hits = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i++) if (VEL[s[i]]) out.push([i, VEL[s[i]]]);
  return out;
};
// Notalı kalıp: harf nota, '-' uzatır, '.' sus
function notes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.') continue;
    if (ch === '-') {
      if (out.length) out[out.length - 1].len++;
      continue;
    }
    out.push({ s: i, len: 1, role: ch });
  }
  return out;
}
function euclid(k, n, rot) {
  const a = [];
  for (let i = 0; i < n; i++) a.push((i * k) % n < k ? 1 : 0);
  return a.map((_, i) => a[(i + rot) % n]);
}

// ---------- Türler (Attack Magazine "Beat Dissected", Kerri Chandler, DJ Boring analizleri) ----------
export const STYLES = {
  deep: {
    bpm: [118, 123], swing: [0.54, 0.6], energy: 0.55, mood: 0.45,
    chord: [['rhodes', 3], ['organ', 2], ['juno', 1.5], ['dub', 1]],
    pad: [['strings', 2], ['warm', 2], ['glass', 1], ['choir', 1], [null, 1]],
    bass: [['sub', 2], ['organ', 2], ['pluck', 1.5], ['fm', 1]],
    lead: [['rhodes', 1.2], ['kalimba', 1], ['marimba', 1], ['flute', 0.6], ['bell', 0.8], ['vox', 1], ['pluck', 0.7]],
    harmony: [['diatonic', 2], ['planing', 1.6]],
    size: [[4, 1], [5, 2], [6, 1.2]],
    bassPat: [0, 1, 2, 3, 4, 5, 6, 7],
    perc: ['congas', 'tamb', 'rim', 'bongo'],
    lofi: 0.12, hatC: 0.6, shaker: 0.6, ride: 0.35, snare: 0.2, twoStep: 0,
  },
  lofi: {
    bpm: [114, 121], swing: [0.55, 0.59], energy: 0.42, mood: 0.4,
    chord: [['rhodes', 3], ['juno', 1.5], ['organ', 1]],
    pad: [['warm', 2], ['strings', 1.5], ['choir', 1], [null, 1]],
    bass: [['sub', 2], ['pluck', 1.5], ['organ', 1]],
    lead: [['vox', 1.5], ['rhodes', 1], ['bell', 1], ['kalimba', 1], ['flute', 0.5]],
    harmony: [['diatonic', 2], ['planing', 1]],
    size: [[4, 1.5], [5, 2], [6, 0.8]],
    bassPat: [0, 1, 4, 7, 8],
    perc: ['tom', 'rim', 'tamb', 'congas'],
    lofi: 1, hatC: 0.9, shaker: 0.3, ride: 0.1, snare: 0.5, twoStep: 0,
  },
  garage: {
    bpm: [122, 127], swing: [0.6, 0.66], energy: 0.72, mood: 0.5,
    chord: [['organ', 3], ['rhodes', 1], ['juno', 1.2]],
    pad: [['strings', 1], ['warm', 1], [null, 2]],
    bass: [['organ', 2], ['fm', 2], ['sub', 1]],
    lead: [['vox', 2.5], ['marimba', 1], ['pluck', 1], ['bell', 0.6]],
    harmony: [['diatonic', 2], ['planing', 1]],
    size: [[4, 1], [5, 2], [6, 1]],
    bassPat: [3, 9, 10, 5],
    perc: ['rim', 'bongo', 'tamb'],
    lofi: 0.15, hatC: 0.8, shaker: 0.5, ride: 0.2, snare: 0.35, twoStep: 0.7,
  },
  minimal: {
    bpm: [120, 124], swing: [0.52, 0.58], energy: 0.5, mood: 0.32,
    chord: [['dub', 4], ['organ', 1], ['juno', 1]],
    pad: [['warm', 1], [null, 2]],
    bass: [['sub', 2], ['fm', 1]],
    lead: [['bell', 1], ['pluck', 1], ['marimba', 1], ['kalimba', 0.6]],
    harmony: [['diatonic', 1], ['planing', 2.5]],
    size: [[4, 1], [5, 1.5], [6, 1.5]],
    bassPat: [0, 2, 7, 11],
    perc: ['rim', 'clave', 'euclid'],
    lofi: 0.05, hatC: 0.5, shaker: 0.7, ride: 0.2, snare: 0, twoStep: 0,
  },
  balearic: {
    bpm: [106, 116], swing: [0.5, 0.54], energy: 0.38, mood: 0.75,
    chord: [['rhodes', 2], ['mallet', 1], ['juno', 1]],
    pad: [['strings', 2], ['glass', 2], ['choir', 1]],
    bass: [['fm', 1.5], ['sub', 1.5], ['pluck', 1]],
    lead: [['flute', 2], ['marimba', 2], ['kalimba', 1.5], ['bell', 1]],
    harmony: [['diatonic', 3], ['planing', 0.6]],
    size: [[4, 1.5], [5, 2], [6, 0.5]],
    bassPat: [1, 12, 2, 0],
    perc: ['congas', 'bongo', 'clave', 'tamb'],
    lofi: 0.1, hatC: 0.7, shaker: 0.9, ride: 0.15, snare: 0.4, twoStep: 0,
  },
  ambient: {
    bpm: [100, 124], swing: [0.5, 0.5], energy: 0.05, mood: 0.5,
    chord: [['rhodes', 2], ['mallet', 1]],
    pad: [['strings', 1.5], ['warm', 2], ['glass', 1.5], ['choir', 1]],
    bass: [['sub', 1]],
    lead: [['bell', 2], ['kalimba', 1.5], ['rhodes', 1], ['flute', 0.7]],
    harmony: [['diatonic', 2], ['planing', 1]],
    size: [[4, 1], [5, 2], [6, 1]],
    bassPat: [7],
    perc: [],
    lofi: 0.2, hatC: 0, shaker: 0, ride: 0, snare: 0, twoStep: 0,
  },
};

const DRUMS = {
  kick: ['x...x...x...x...'],
  kickAlt: ['x...x...x.g.x...', 'x...x...x...x..g', 'x...x.g.x...x...', 'x...x...x...x.g.'],
  kick2: ['x.........x.....', 'x.......x.x.....', 'x.........x..g..', 'x.....g...x.....'],
  hatO: ['..x...x...x...x.', '..x...x...x...o.', '..o...x...o...x.', '..x...x..xx...x.'],
  hatC: ['x...x...x...x...', 'x..gx..gx..gx..g', 'xg.gxg.gxg.gxg.g', '.g.g.g.g.g.g.g.g', 'o..go..go..go.gg'],
  hatCsolo: ['x.g.x.g.x.g.x.g.', 'xgogxgogxgogxgog', '..x...x...x...x.', 'x.gxx.gxx.gxx.gx'],
  shaker: ['gogogogogogogogo', 'goxogoxogoxogoxo', 'g.o.g.o.g.o.g.o.', 'ggogggogggogggog'],
  ride: ['..o...o...o...o.', 'o.g.o.g.o.g.o.g.', 'o...o...o...o...'],
};
const PERC = {
  congas: [
    { congaHi: '..o..x....o..x..', congaLo: '......x.......x.' },
    { congaHi: '...o..x....o..x.', congaLo: 'o.......o.......' },
    { congaHi: 'g.x.o.x.g.x.o.xg', congaLo: '' },
    { congaHi: '..x.....x.o.....', congaLo: '....o.o.....o.o.' },
  ],
  bongo: [{ bongo: 'x.o.x.oox.o.x.oo' }, { bongo: 'o.g.o.goo.g.o.go' }, { bongo: '..o.g.o...o.g.oo' }],
  rim: [{ rim: '...x..x...x..x..' }, { rim: '.x..x..x..x.x...' }, { rim: '..x..x..x...x...' }, { rim: '...o..o....o..o.' }],
  clave: [{ clave: 'x..x..x...x.x...' }, { clave: '..x..x...x..x...' }, { clave: 'x..x...x..x.....' }],
  tom: [{ tom: '...x..x..x.....x' }, { tom: '......x.......x.' }],
  tamb: [{ tamb: '.x....x..x....xx' }, { tamb: 'g.x.g.x.g.x.g.x.' }, { tamb: '....x.......x...' }],
};
const BASS_PATS = [
  '..R...R...R...R.', // 0 vuruşların arasına düşen bas
  'R...R...R...R.O.', // 1 kökler + süs
  '..R..F....R.O...', // 2 boşluklu gezinti
  'R..R..R...R..R..', // 3 3-3-4-3-3
  'R-......R-.R...A', // 4
  '..R-..R...R-..O.', // 5 org bas
  'R-..R-.FR-..O..A', // 6
  'R---....R---..F.', // 7 alt bas ostinatosu
  'R---------..R-.A', // 8 uzun
  'R..R..F...R..R..', // 9 garage
  '..R..R....R..R.O', // 10
  '..R.......R..F..', // 11 seyrek
  'R...F...O...F...', // 12 arpej
];
const FLOURISH = ['..O.', '.O.A', 'O.F.', '..FA', 'A...', '.FO.'];
const CHORD_RHYTHM = {
  stab: ['..x.............', '..x.......x.....', '..x...x.....x...', '...x..x...x.....', '..x..x....x.....', '..x...........n.', 'x.....x.....x...', '......x.......n.', '..x.......x...n.', '...x......x..x..'],
  organ: ['..x...x...x...x.', '.x..x..x..x...x.', '..x..x..x...x...', 'x..x..x...x..x..', '..x...x.....x...'],
  comp: ['x--.....x--..x..', 'x-----..x-......', 'x--...x--...x-..', '..x---....x---..', 'x-------..x---..', '..x-----......n-'],
  dub: ['..x.............', '...x............', '..x.......x.....', '......x.........', '..x.....x.......'],
  ambient: ['x---------------', 'x-------x-------'],
};
const VOX_CHOPS = ['..x...x.x.......', '....x.......x...', '..x.....x.x.....', '.......x..x...x.', 'x.......x.x.....'];
const VOWELS = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480] };

// ---------- Ses parametreleri: her parça kendi tınısını alır ----------
const rhodesP = (r) => ({
  ratio: r.pick([1, 1, 1, 2]), index: r.range(1.1, 2.4), indexFloor: r.range(0.08, 0.25), indexDecay: r.range(0.25, 0.7),
  tine: r.range(0.4, 1.2), tineRatio: r.pick([5.02, 7.01, 8.98]), decay: r.range(0.9, 2.2), release: r.range(0.08, 0.2),
});
const organP = (r) => ({ soft: r.chance(0.4), cutoff: r.range(1400, 3800), fdecay: r.range(0.04, 0.16), decay: r.range(0.08, 0.3), sustain: r.range(0.1, 0.4), release: r.range(0.05, 0.14) });
const junoP = (r) => ({ voices: r.int(2, 3), detune: r.range(8, 18), wave: r.pick(['softSaw', 'darkSaw', 'sawtooth']), cutoff: r.range(900, 2200), envAmt: r.range(1.2, 3), fdecay: r.range(0.05, 0.15), q: r.range(1, 3.5), attack: 0.004, decay: r.range(0.12, 0.3), sustain: r.range(0.15, 0.4), release: r.range(0.1, 0.25), level: 0.05 });
const dubP = (r) => ({ voices: 2, detune: r.range(5, 12), wave: r.pick(['darkSaw', 'organSoft', 'softSaw']), cutoff: r.range(700, 1500), envAmt: r.range(0.8, 2), fdecay: r.range(0.04, 0.1), q: r.range(1, 3), attack: 0.004, decay: r.range(0.08, 0.18), sustain: 0.05, release: r.range(0.08, 0.15), level: 0.06 });
const MALLETS = {
  kalimba: (r) => ({ ratio: r.pick([5.4, 7, 6.3]), index: r.range(0.6, 1.1), idecay: r.range(0.01, 0.025), decay: r.range(0.3, 0.55) }),
  marimba: (r) => ({ ratio: r.pick([4, 3.93, 10]), index: r.range(0.9, 1.6), idecay: r.range(0.008, 0.02), decay: r.range(0.15, 0.28) }),
  bell: (r) => ({ ratio: r.pick([3.5, 1.41, 2.76]), index: r.range(1.2, 2.4), idecay: r.range(0.15, 0.4), decay: r.range(0.6, 1.1) }),
  pluck: (r) => ({ ratio: r.pick([1, 2]), index: r.range(1.8, 3.2), idecay: r.range(0.04, 0.09), decay: r.range(0.18, 0.35) }),
};
const PADS = {
  strings: (r) => ({ voices: 3, detune: r.range(9, 16), wave: 'softSaw', cutoff: r.range(1400, 2800), attack: r.range(0.8, 2), release: r.range(1.5, 3), level: 0.028 }),
  warm: (r) => ({ voices: 2, octaves: [1, 0.5], detune: r.range(5, 10), wave: 'darkSaw', cutoff: r.range(700, 1500), attack: r.range(1, 2.5), release: r.range(2, 3.5), level: 0.045 }),
  glass: (r) => ({ voices: 2, wave: 'hollow', detune: r.range(4, 8), cutoff: r.range(2500, 4500), attack: r.range(0.5, 1.2), release: r.range(1.5, 2.5), level: 0.032 }),
  choir: (r) => ({ formants: VOWELS[r.pick(['u', 'o', 'a'])], attack: r.range(0.4, 0.9), release: r.range(0.8, 1.5) }),
};
const BASSES = {
  sub: (r) => ({ type: 'sub', sub: 1, top: r.range(0.25, 0.45), sustain: 0.85, decay: 0.4 }),
  organ: (r) => ({ type: 'organ', sub: 0.75, top: r.range(0.5, 0.75), sustain: r.range(0.4, 0.6), decay: r.range(0.15, 0.3) }),
  pluck: (r) => ({ type: 'pluck', sub: 0.85, top: r.range(0.35, 0.55), cutoff: r.range(280, 650), q: r.range(2, 6), fdecay: r.range(0.05, 0.14), sustain: r.range(0.5, 0.75), decay: r.range(0.2, 0.35) }),
  fm: (r) => ({ type: 'fm', sub: 0.7, top: r.range(0.4, 0.6), ratio: r.pick([1, 2, 0.5]), index: r.range(0.7, 1.8), fdecay: r.range(0.05, 0.15), sustain: r.range(0.5, 0.7), decay: r.range(0.2, 0.35) }),
};

function leadParams(r, inst) {
  if (inst === 'rhodes') return rhodesP(r);
  if (inst === 'flute') return { vibRate: r.range(4.6, 5.4), attack: r.range(0.05, 0.11), breath: r.range(0.25, 0.5) };
  if (inst === 'vox') return { formants: VOWELS[r.pick(['a', 'o', 'u', 'e'])].map((f) => f * r.range(1.05, 1.2)), attack: r.range(0.015, 0.05), release: r.range(0.12, 0.3) };
  return MALLETS[inst](r);
}

function kitParams(r, style, tonic, lofi) {
  // davul tonu parçanın tonuna (kök ya da beşli) akort edilir
  const cands = [tonic, tonic + 7]
    .map((pc) => {
      let f = 440 * 2 ** ((24 + mod12(pc) - 69) / 12);
      while (f < 42) f *= 2;
      while (f > 58) f /= 2;
      return f;
    })
    .filter((f) => f >= 42 && f <= 58);
  return {
    lofi, lofiRate: r.pick([22050, 26040, 32000]), bits: r.pick([10, 12, 12]),
    kick: { f0: r.range(110, 170), f1: cands.length ? r.pick(cands) : 48, pdec: r.range(0.03, 0.07), dec: r.range(0.22, 0.5), hold: r.range(0, 0.04), drive: r.range(1, 2.6), click: r.range(0.08, 0.4) },
    clap: { bp: r.range(900, 1700), q: r.range(1.1, 2.4), hits: r.int(3, 4), gap: r.range(0.008, 0.013), tail: r.range(0.08, 0.22) },
    snare: { f: r.range(170, 230), hp: r.range(1200, 2500), tail: r.range(0.05, 0.12) },
    hat: { tune: r.range(0.85, 1.35), noise: r.range(0.3, 1.2), bp: r.range(7000, 10500), hp: r.range(6000, 8500), closed: r.range(0.018, 0.05), open: r.range(0.12, 0.35) },
    ride: { bp: r.range(5000, 8000), tail: r.range(0.35, 0.7) },
    shaker: { bp: r.range(5000, 9000), attack: r.range(0.004, 0.015), tail: r.range(0.025, 0.06) },
    rim: { f: r.range(1300, 2100), tail: r.range(0.01, 0.03) },
    clave: { f: r.range(2100, 2900) },
    conga: { hi: r.range(270, 340), lo: r.range(180, 225), bongo: r.range(380, 480), tail: r.range(0.07, 0.13) },
    tom: { f: r.range(90, 150) },
  };
}

// Motif: akor seslerinin sırasına göre yazılır, böylece her akorda uyumlu kalır
function makeMotif(r, bars, density, inst) {
  const out = [];
  const maxLen = { flute: 6, vox: 3, rhodes: 4 }[inst] ?? 2;
  for (let b = 0; b < bars; b++) {
    const n = Math.max(1, Math.round(lerp(1.4, 4.6, density) + r.range(-0.8, 0.8)));
    const w = Array.from({ length: 16 }, (_, s) => (s % 4 === 0 ? 1 : s % 2 === 0 ? 1.3 : 0.45));
    if (b === 0) w[0] *= 0.6;
    const pos = [];
    for (let k = 0; k < n; k++) {
      const pairs = w.map((x, i) => [i, x]);
      const p = r.weighted(pairs);
      pos.push(p);
      w[p] = 0;
      if (p > 0) w[p - 1] *= 0.3;
      if (p < 15) w[p + 1] *= 0.3;
    }
    pos.sort((a, c) => a - c);
    for (const p of pos) out.push({ s: b * 16 + p });
  }
  let idx = r.int(1, 3);
  out.forEach((nt, k) => {
    const next = out[k + 1] ? out[k + 1].s : bars * 16;
    nt.len = clamp(next - nt.s, 1, maxLen);
    if (k > 0) idx = clamp(idx + r.weighted([[0, 2], [1, 3], [-1, 3], [2, 1], [-2, 1]]), 0, 6);
    nt.i = idx;
    nt.v = nt.s % 4 === 0 ? r.range(0.8, 1) : r.range(0.55, 0.85);
  });
  if (out.length > 1 && r.chance(0.6)) out[out.length - 1].i = r.pick([0, 2, 3]);
  return { bars, notes: out };
}
// Cevap motifi: aynı ritim, farklı bitiş
function answer(r, m) {
  const notes = m.notes.map((n) => ({ ...n }));
  const k = notes.length - 1;
  if (k >= 0) notes[k].i = clamp(notes[k].i + r.pick([-2, -1, 1, 2]), 0, 6);
  if (k >= 1 && r.chance(0.5)) notes[k - 1].i = clamp(notes[k - 1].i + r.pick([-1, 1]), 0, 6);
  return { bars: m.bars, notes };
}
// Küçük oynama: bir nota düşer, kayar ya da perdesi değişir
function vary(r, m) {
  const notes = m.notes.map((n) => ({ ...n }));
  const k = r.int(0, notes.length - 1);
  const kind = r.int(0, 2);
  if (kind === 0 && notes.length > 2) notes.splice(k, 1);
  else if (kind === 1) notes[k].i = clamp(notes[k].i + r.pick([-1, 1]), 0, 6);
  else if (notes[k].s % 16 < 15 && !notes.some((n) => n.s === notes[k].s + 1)) notes[k].s += 1;
  return { bars: m.bars, notes };
}

// ---------- Parça tasarımı ----------
export function designTrack(seed, c) {
  const r = new Rng(seed);
  const E = c.energy;
  const M = c.mood;
  const T = c.taste || {};
  const tw = (k) => Math.exp(clamp(T[k] || 0, -2, 2) * 0.5);
  let style = c.ambient ? 'ambient' : null;
  if (!style) {
    const pairs = Object.entries(STYLES)
      .filter(([k]) => k !== 'ambient')
      .map(([k, s]) => [k, Math.exp(-(((E - s.energy) / 0.28) ** 2)) * Math.exp(-(((M - s.mood) / 0.4) ** 2)) * tw('s:' + k) + 0.03]);
    style = r.weighted(pairs);
  }
  const S = STYLES[style];
  const prev = c.prev && c.prev.style !== 'ambient' ? c.prev : c.prev;

  // tempo: enerjiye göre aralıkta, öncekine yakın
  let bpm = lerp(S.bpm[0], S.bpm[1], clamp(E + r.range(-0.25, 0.25), 0, 1));
  if (prev) bpm = clamp(bpm, prev.bpm - 4, prev.bpm + 4);
  bpm = Math.round(bpm * 2) / 2;
  const swing = r.range(S.swing[0], S.swing[1]);

  // ton: Camelot çarkında komşu
  const mw = modeWeights(clamp(M + (S.mood - 0.5) * 0.4 + r.range(-0.15, 0.15), 0, 1));
  const mode = r.weighted(mw);
  let parent;
  if (prev) {
    const step = r.weighted([[0, 0.3], [1, 0.3], [-1, 0.3], [2, E > 0.55 ? 0.12 : 0.03]]);
    parent = mod12(prev.cam.parent + 7 * step);
  } else parent = r.int(0, 11);
  const tonic = mod12(parent + MODES[mode].parent);
  const cam = camelot(tonic, mode);
  const minor = MODES[mode].minor;

  // armoni
  const harmonyType = r.weighted(S.harmony);
  let chords;
  let progId;
  if (harmonyType === 'diatonic') {
    const list = minor ? PROGS_MINOR : PROGS_MAJOR;
    const recent = new Set((c.history || []).slice(-6).map((h) => h.prog));
    let pi = r.int(0, list.length - 1);
    for (let k = 0; k < 4 && recent.has((minor ? 'm' : 'M') + pi); k++) pi = r.int(0, list.length - 1);
    progId = (minor ? 'm' : 'M') + pi;
    const size = r.weighted(S.size);
    chords = list[pi].map((d) => {
      const ch = diatonicChord(mode, d, size);
      let tones = ch.tones.slice();
      if (tones.length >= 5 && r.chance(0.5)) tones = tones.filter((x) => x !== 7); // beşliyi at
      return { root: ch.root, pcs: tones.map((x) => ch.root + x) };
    });
  } else {
    const shapes = minor ? ['m9', 'm11', 'quartal', 'min11open', 'm7'] : ['maj9', 'six9', 'sus9', 'quartal'];
    const shape = r.pick(shapes);
    const pi = r.int(0, PLANING.length - 1);
    progId = 'p' + pi + shape;
    chords = PLANING[pi].map((mv) => ({ root: mv, pcs: SHAPES[shape].map((x) => mv + x) }));
  }
  const n = chords.length;
  const upc = style === 'ambient' ? r.pick([4, 8]) : n === 2 ? r.pick([2, 2, 4, 1]) : r.pick([2, 2, 4]);

  // ses yürütme
  const voicing = [];
  const padVoicing = [];
  let pv = null;
  let pp = null;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const abs = chords[i].pcs.map((x) => x + tonic);
      const upper = abs.filter((x) => mod12(x - chords[i].root - tonic) !== 0 || abs.length <= 3);
      pv = voiceChord(upper.length >= 3 ? upper : abs, 52, 77, pv, r);
      pp = voiceChord(abs, 46, 72, pp, r, { center: 60 });
      voicing[i] = pv;
      padVoicing[i] = pp;
    }
  }

  // enstrümanlar
  const pick = (list, prefix) => r.weighted(list.map(([v, w]) => [v, w * tw(prefix + v)]));
  const chordInst = pick(S.chord, 'c:');
  const padInst = pick(S.pad, 'p:');
  const bassType = pick(S.bass, 'b:');
  const leadInst = pick(S.lead, 'l:');
  let lead2Inst = pick(S.lead, 'l:');
  if (lead2Inst === leadInst) lead2Inst = pick(S.lead, 'l:');
  const chordP = chordInst === 'rhodes' ? rhodesP(r) : chordInst === 'organ' ? organP(r) : chordInst === 'juno' ? junoP(r) : chordInst === 'dub' ? dubP(r) : MALLETS.pluck(r);
  const rhythmSet = chordInst === 'rhodes' ? r.pick(['comp', 'stab']) : chordInst === 'organ' ? r.pick(['organ', 'stab']) : chordInst === 'dub' ? 'dub' : style === 'ambient' ? 'ambient' : 'stab';
  const rset = style === 'ambient' ? CHORD_RHYTHM.ambient : CHORD_RHYTHM[rhythmSet];
  const chordRhythm = [r.pick(rset), r.pick(rset)];
  const bassPatId = r.pick(S.bassPat);
  const bassMain = BASS_PATS[bassPatId];
  const bassAlt = bassMain.slice(0, 12) + r.pick(FLOURISH);

  const density = clamp(0.25 + E * 0.5 + r.range(-0.15, 0.15) - (c.focus ? 0.2 : 0), 0.1, 0.9);
  const motif = makeMotif(r, r.pick([1, 2, 2]), density, leadInst);
  const motif2 = makeMotif(r, r.pick([1, 2]), density * 0.8, lead2Inst);

  // davullar
  const twoStep = r.chance(S.twoStep);
  const lofi = r.chance(S.lofi);
  const percKinds = r.shuffle(S.perc);
  const percPart = (kind) => {
    if (!kind) return null;
    if (kind === 'euclid') {
      const inst = r.pick(['rim', 'clave', 'bongo']);
      const e = euclid(r.pick([3, 5, 7]), 16, r.int(0, 15));
      return { [inst]: e.map((x, i) => (x ? (i % 4 === 0 ? 'x' : 'o') : '.')).join('') };
    }
    return r.pick(PERC[kind]);
  };
  const drums = {
    kick: twoStep ? [r.pick(DRUMS.kick2), r.pick(DRUMS.kick2)] : [DRUMS.kick[0], r.pick(DRUMS.kickAlt)],
    hatO: [r.pick(DRUMS.hatO), r.pick(DRUMS.hatO)],
    hatC: [r.pick(DRUMS.hatC), r.pick(DRUMS.hatC)],
    hatCsolo: r.pick(DRUMS.hatCsolo),
    shaker: r.pick(DRUMS.shaker),
    ride: r.pick(DRUMS.ride),
    perc1: percPart(percKinds[0]),
    perc2: percPart(percKinds[1]),
    snare: r.chance(S.snare),
    choke: r.chance(0.6),
    clapEarly: r.range(0, 0.006),
  };

  // katmanlar
  const layers = new Set(['kick', 'clap', 'hatO', 'bass', 'chords']);
  if (r.chance(S.hatC)) layers.add('hatC');
  if (r.chance(S.shaker)) layers.add('shaker');
  if (drums.perc1) layers.add('perc1');
  if (drums.perc2 && r.chance(0.6)) layers.add('perc2');
  if (r.chance(S.ride)) layers.add('ride');
  if (padInst) layers.add('pad');
  layers.add('lead');
  if (r.chance(0.55)) layers.add('lead2');
  if (leadInst !== 'vox' && r.chance(style === 'garage' ? 0.6 : 0.25)) layers.add('vox');
  if (style === 'ambient') {
    for (const l of ['kick', 'clap', 'hatO', 'hatC', 'shaker', 'perc1', 'perc2', 'ride', 'vox']) layers.delete(l);
    if (!padInst) layers.add('pad');
    if (r.chance(0.5)) layers.delete('bass');
  }
  const padI = padInst || (style === 'ambient' ? 'warm' : null);

  const introBars = style === 'ambient' ? 16 : r.pick([16, 16, 32]);
  const outroBars = style === 'ambient' ? 16 : r.pick([16, 16, 32]);
  const segs = arrange(r, { layers, introBars, outroBars, style, energy: E });

  const fx = {
    rt60: style === 'ambient' ? r.range(2.6, 3.2) : r.range(1.4, 2.8), size: r.range(0.3, 0.9), damp: r.range(1.2, 3.5), revLevel: r.range(0.75, 1.1),
    delayTime: (60 / bpm) * r.pick([0.75, 0.75, 0.5, 1, 1.5]), delayFb: chordInst === 'dub' ? r.range(0.55, 0.66) : r.range(0.25, 0.45), delayLP: r.range(2200, 4200), delayLevel: r.range(0.6, 1),
    chorusRate: r.range(0.2, 0.6), chorusDepth: r.range(0.0012, 0.0028), bassDrive: r.range(1.3, 2.6),
    lofi, wowRate: r.range(0.3, 0.8), wowDepth: r.range(0.0005, 0.0013), flutterRate: r.range(5.5, 9), lofiCut: r.range(4800, 8000),
  };

  return {
    seed, style, bpm, swing, tonic, mode, cam, minor, progId, harmonyType,
    harmony: { chords, n, upc, voicing, padVoicing },
    chordInst, chordP, chordRhythm, chordLen: r.range(1.2, 2.2), strum: chordInst === 'rhodes' || chordInst === 'mallet' ? r.range(0.004, 0.012) : 0.001,
    padInst: padI, padP: padI ? PADS[padI](r) : null,
    bassType, bassP: BASSES[bassType](r), bassPatId, bassMain, bassAlt, pedal: r.chance(0.12), glide: r.chance(0.35),
    lead: { inst: leadInst, p: leadParams(r, leadInst), motif, motifB: answer(r, motif), motifV: vary(r, motif), lo: leadInst === 'rhodes' ? 62 : 67 },
    lead2: { inst: lead2Inst, p: leadParams(r, lead2Inst), motif: motif2, motifB: answer(r, motif2), motifV: vary(r, motif2), lo: lead2Inst === 'rhodes' ? 62 : 69 },
    vox: { kind: r.pick(['chop', 'ooh']), p: leadParams(r, 'vox'), pat: r.pick(VOX_CHOPS) },
    drums, layers, segs, len: segs.reduce((a, s) => a + s.len, 0), introBars, outroBars,
    kitP: kitParams(r, style, tonic, lofi), fx,
    drift: { p1: r.pick([23, 29, 31, 37]), p2: r.pick([41, 43, 47, 53]), ph1: r.range(0, 6.28), ph2: r.range(0, 6.28) },
    levels: { chords: r.range(0.85, 1.1), lead: r.range(0.85, 1.1), pad: r.range(0.85, 1.15) },
    name: { tr: trackName(seed, 'tr'), en: trackName(seed, 'en') },
  };
}

// Bölümler: her 8 ölçülük cümle sonunda tek değişiklik
function arrange(r, d) {
  const segs = [];
  const has = (l) => d.layers.has(l);
  const push = (sec, on, extra = {}) => {
    const start = segs.reduce((a, s) => a + s.len, 0);
    segs.push({ start, len: 8, sec, on: new Set([...on].filter(has)), alt: new Set(extra.alt || []), fill: extra.fill ?? null, index: segs.length });
  };
  if (d.style === 'ambient') {
    const order = ['pad', 'chords', 'bass', 'lead', 'lead2'];
    const st = new Set(['pad']);
    const nPh = r.int(4, 6);
    for (let i = 0; i < nPh; i++) {
      if (i > 0 && i < nPh - 1) {
        const nx = order.find((l) => has(l) && !st.has(l));
        if (nx) st.add(nx);
      }
      if (i === nPh - 1) {
        st.delete('lead');
        st.delete('lead2');
      }
      push('amb', st);
    }
    return segs;
  }
  const fills = ['drop', 'conga', 'tom', 'open', 'clap'];
  const smallFill = () => r.pick(fills);
  const firstHat = has('hatC') && r.chance(0.4) ? 'hatC' : 'hatO';
  const state = new Set(['kick', firstHat]);
  const introQ = r.shuffle(['hatO', 'hatC', 'perc1', 'shaker'].filter((l) => has(l) && !state.has(l)));
  introQ.push('clap');
  const introPh = d.introBars / 8;
  for (let i = 0; i < introPh; i++) {
    if (i > 0 && introQ.length) state.add(introQ.shift());
    push('intro', state, { fill: i === introPh - 1 ? 'big' : smallFill() });
  }
  while (introQ.length) state.add(introQ.shift());
  // A bölümü: bas ve akorlar girer, sonra pad, melodi
  const aPh = r.int(3, 5);
  const aQ = r.chance(0.5) ? ['chords', 'pad', 'lead', 'perc2'] : ['pad', 'chords', 'lead', 'perc2'];
  state.add('bass');
  if (r.chance(0.5)) state.add(aQ.shift());
  for (let i = 0; i < aPh; i++) {
    if (i > 0) {
      const nx = aQ.find((l) => has(l) && !state.has(l));
      if (nx) state.add(nx);
    }
    push('a', state, { fill: i === aPh - 1 ? 'big' : smallFill(), alt: i % 2 ? ['hats'] : [] });
  }
  for (const l of aQ) if (has(l)) state.add(l);
  // ara: davul ve bas çekilir, pad ve melodi kalır
  const brPh = r.chance(0.6) ? 1 : 2;
  const brk = new Set([...state].filter((l) => !['kick', 'bass', 'clap', 'perc2', 'ride', 'shaker'].includes(l)));
  brk.add('pad');
  if (r.chance(0.5)) brk.delete('hatC');
  for (let i = 0; i < brPh; i++) push('break', brk, { fill: i === brPh - 1 ? 'sweep' : null });
  // B bölümü: zirve katmanları teker teker
  const bPh = r.int(3, 5);
  const peak = r.shuffle(['ride', 'lead2', 'vox']).filter(has);
  if (peak.length) state.add(peak.shift());
  const altCycle = r.shuffle(['chords', 'hats', 'bass', 'chords']);
  for (let i = 0; i < bPh; i++) {
    const alt = [];
    if (i > 0) {
      if (peak.length && r.chance(0.6)) state.add(peak.shift());
      else alt.push(altCycle[i % altCycle.length]);
    }
    push('b', state, { fill: i === bPh - 1 ? 'big' : smallFill(), alt });
  }
  // çıkış: melodiler, sonra akorlar çekilir; davul ve bas DJ geçişine kalır
  const outPh = d.outroBars / 8;
  const removeOrder = [['lead', 'lead2', 'vox'], ['chords', 'pad'], ['perc2', 'ride'], ['shaker']];
  for (let i = 0; i < outPh; i++) {
    for (const l of removeOrder[Math.min(i, removeOrder.length - 1)]) state.delete(l);
    push('outro', state, { fill: smallFill() });
  }
  return segs;
}

// ---------- Çalan parça ----------
export class Track {
  constructor(dna, motor) {
    this.d = dna;
    this.m = motor;
    this.len = dna.len;
    this.segs = dna.segs.map((s) => ({ ...s, on: new Set(s.on), alt: new Set(s.alt) }));
    this.mute = new Set();
    this.ready = false;
    this.startBar = 0;
    this.overlapIn = 0;
  }

  async prepare() {
    const d = this.d;
    const m = this.m;
    this.kit = d.style === 'ambient' ? {} : await renderKit(m.ctx.sampleRate, d.kitP);
    const bus = m.makeTrackBus(d.fx, new Rng(hash(d.seed, 'ir')));
    this.bus = bus;
    const pr = new Rng(hash(d.seed, 'pan'));
    const ch = bus.channel;
    const L = d.levels;
    this.ch = {
      kick: ch('kick', { level: 0.9, group: 'drums' }),
      clap: ch('clap', { level: 0.42, group: 'drums', rev: 0.22, pan: pr.range(-0.05, 0.05) }),
      snare: ch('snare', { level: 0.3, group: 'drums', rev: 0.18 }),
      hatO: ch('hatO', { level: 0.2, group: 'drums', pan: pr.range(0.05, 0.25), rev: 0.04 }),
      hatC: ch('hatC', { level: 0.16, group: 'drums', pan: pr.range(-0.3, -0.05) }),
      shaker: ch('shaker', { level: 0.11, group: 'drums', pan: pr.range(0.2, 0.45), rev: 0.05 }),
      perc1: ch('perc1', { level: 0.22, group: 'drums', pan: pr.range(-0.45, -0.15), rev: 0.15, del: 0.06 }),
      perc2: ch('perc2', { level: 0.18, group: 'drums', pan: pr.range(0.15, 0.45), rev: 0.2 }),
      ride: ch('ride', { level: 0.07, group: 'drums', pan: pr.range(0.1, 0.35), rev: 0.06 }),
      fx: ch('fx', { level: 0.22, group: 'music', rev: 0.6 }),
      bass: ch('bass', { level: 0.82, group: 'bass' }),
      chords: ch('chords', { level: 0.55 * L.chords, group: 'chorus', rev: 0.3, del: d.chordInst === 'dub' ? 0.6 : 0.16, filter: { type: 'lowpass', freq: 4000, q: 0.5 } }),
      pad: ch('pad', { level: 0.5 * L.pad, group: 'chorus', rev: 0.45, filter: { type: 'lowpass', freq: 2500, q: 0.5 } }),
      lead: ch('lead', { level: 0.42 * L.lead, group: 'music', rev: 0.32, del: 0.28, pan: pr.range(-0.25, 0.1) }),
      lead2: ch('lead2', { level: 0.36 * L.lead, group: 'music', rev: 0.38, del: 0.24, pan: pr.range(0.05, 0.3) }),
      vox: ch('vox', { level: 0.34, group: 'music', rev: 0.5, del: 0.3, pan: pr.range(-0.15, 0.15) }),
    };
    this.pumpDepth = { bass: pr.range(0.45, 0.7), music: pr.range(0.15, 0.35), rel: pr.range(0.05, 0.09) };
    this.ready = true;
  }

  dispose() {
    try {
      this.bus.dispose();
    } catch {}
  }

  segAt(b) {
    for (const s of this.segs) if (b >= s.start && b < s.start + s.len) return s;
    return null;
  }

  chordIndex(b, half) {
    const H = this.d.harmony;
    return Math.floor((b * 2 + half) / H.upc) % H.n;
  }

  bassRoot(rel) {
    return 28 + mod12(this.d.tonic + rel - 4);
  }

  // canlı katmanlar: cümle başında enerji ve odak ayarına göre süzülür
  liveLayers(seg, ak) {
    const E = ak.energy;
    const gate = { hatC: 0.15, shaker: 0.28, perc1: 0.2, perc2: 0.5, ride: 0.56, lead2: 0.4, vox: 0.3, clap: 0.06 };
    const out = new Set();
    for (const l of seg.on) {
      if (gate[l] != null && E < gate[l]) continue;
      out.add(l);
    }
    if (ak.focus) {
      if (seg.index % 2 === 1) {
        out.delete('lead');
        out.delete('lead2');
      }
      out.delete('vox');
    }
    return out;
  }

  // Parçayı yakın cümle başında bitişe yönelt (Sonraki / Sevmedim)
  forceOutro(fromBar, outLen) {
    const kept = [];
    for (const s of this.segs) {
      if (s.start >= fromBar) break;
      if (s.start + s.len > fromBar) kept.push({ ...s, len: fromBar - s.start });
      else kept.push(s);
    }
    const last = kept[kept.length - 1] || this.segs[0];
    const st = new Set(last.on);
    for (const l of ['kick', 'hatO', 'clap', 'bass']) if (this.d.layers.has(l)) st.add(l);
    let start = fromBar;
    for (let i = 0; i < outLen / 8; i++) {
      for (const l of i === 0 ? ['lead', 'lead2', 'vox'] : ['chords', 'pad', 'perc2', 'ride']) st.delete(l);
      kept.push({ start, len: 8, sec: 'outro', on: new Set(st), alt: new Set(), fill: 'drop', index: kept.length });
      start += 8;
    }
    this.segs = kept;
    this.len = start;
    this.d.outroBars = outLen;
  }

  // Geçiş gecikirse çıkışı uzat
  extend(bars) {
    const last = this.segs[this.segs.length - 1];
    for (let i = 0; i < bars / 8; i++) {
      this.segs.push({ ...last, start: this.len, len: 8, index: this.segs.length, on: new Set(last.on), alt: new Set() });
      this.len += 8;
    }
  }

  playBar(b, t0, BAR, ak) {
    const d = this.d;
    const seg = this.segAt(b);
    if (!seg) return;
    const inSeg = b - seg.start;
    if (inSeg === 0 || !seg.live) seg.live = this.liveLayers(seg, ak);
    const on = (l) => seg.live.has(l) && !this.mute.has(l);
    const r = new Rng(hash(d.seed, 'bar', b));
    const s16 = BAR / 16;
    const sw = (d.swing - 0.5) * 2 * s16;
    const T = (s) => t0 + s * s16 + (s % 2 ? sw : 0);
    const H = () => r.gauss() * 0.0025;
    const E = ak.energy;
    const lastBar = inSeg === seg.len - 1;
    const fill = lastBar ? seg.fill : null;
    const C = this.ch;
    const kit = this.kit;
    const K = this.m.kit;
    const H2 = d.harmony;

    // yavaş kayma: asal periyotlu iki dalga, parça boyunca tını hiç durmaz
    const dr = d.drift;
    const wave = 0.5 + 0.3 * Math.sin((2 * Math.PI * b) / dr.p1 + dr.ph1) + 0.2 * Math.sin((2 * Math.PI * b) / dr.p2 + dr.ph2);
    let bright = clamp(0.3 + 0.45 * E + 0.3 * (wave - 0.5) + 0.15 * (ak.mood - 0.5), 0.08, 1);
    if (seg.sec === 'break') bright *= 0.7 + 0.3 * (inSeg / seg.len);
    C.chords.filter.frequency.setTargetAtTime(lerp(1100, 7000, bright), t0, BAR / 2);
    C.pad.filter.frequency.setTargetAtTime(lerp(600, 4200, bright), t0, BAR);
    C.chords.rev.gain.setTargetAtTime(0.22 + 0.18 * (1 - wave), t0, BAR);
    C.lead.del.gain.setTargetAtTime(0.18 + 0.2 * wave, t0, BAR);

    const pump = (t) => {
      const P = this.pumpDepth;
      for (const [g, dep] of [[this.bus.pumpBass.gain, P.bass], [this.bus.pumpMusic.gain, P.music]]) {
        g.setTargetAtTime(1 - dep, t, 0.004);
        g.setTargetAtTime(1, t + 0.025, P.rel);
      }
    };
    const hit = (chan, buf, t, v, rate = 1) => {
      if (buf) K.hit(chan.input, buf, t, v, rate);
    };

    // ---- davullar ----
    const drums = d.drums;
    if (on('kick') && kit.kick) {
      let pat = drums.kick[inSeg % 4 === 3 && r.chance(0.6) ? 1 : 0];
      if (fill === 'drop') pat = pat.slice(0, 12) + '....';
      if (fill === 'big' && E > 0.5 && r.chance(0.5)) pat = 'x.x.x.x.x.x.x.x.';
      for (const [s, v] of hits(pat)) {
        const t = T(s);
        hit(C.kick, kit.kick, t, v * (0.92 + 0.08 * r.f()));
        if (v > 0.5) pump(t);
      }
    }
    if (on('clap') && kit.clap) {
      let pat = '....x.......x...';
      if (fill === 'clap') pat = '....x.......x.oo';
      for (const [s, v] of hits(pat)) {
        const t = T(s) - drums.clapEarly + H();
        hit(C.clap, kit.clap, t, v * (0.85 + 0.15 * r.f()));
        if (drums.snare) hit(C.snare, kit.snare, t + 0.002, v * 0.7);
      }
    }
    const hatVel = 0.75 + 0.35 * E;
    const ghostP = 0.35 + 0.6 * E;
    if (on('hatO') && kit.hatO) {
      let pat = drums.hatO[seg.alt.has('hats') ? 1 : 0];
      if (fill === 'open') pat = pat.slice(0, 14) + 'x.';
      for (const [s, v] of hits(pat)) {
        if (v < 0.4 && r.f() > ghostP) continue;
        hit(C.hatO, kit.hatO, T(s) + H(), v * hatVel * (0.85 + 0.15 * r.f()));
      }
    }
    if (on('hatC') && kit.hatC) {
      const pat = on('hatO') ? drums.hatC[seg.alt.has('hats') ? 1 : 0] : drums.hatCsolo;
      for (const [s, v] of hits(pat)) {
        if (v < 0.4 && r.f() > ghostP) continue;
        hit(C.hatC, kit.hatC, T(s) + H(), v * hatVel * (0.8 + 0.2 * r.f()));
      }
    }
    if (on('shaker') && kit.shaker) {
      for (const [s, v] of hits(drums.shaker)) {
        if (v < 0.4 && r.f() > ghostP) continue;
        hit(C.shaker, kit.shaker, T(s) + H() - 0.002, v * (0.7 + 0.3 * E) * (0.8 + 0.2 * r.f()));
      }
    }
    if (on('ride') && kit.ride) {
      for (const [s, v] of hits(drums.ride)) hit(C.ride, kit.ride, T(s) + H(), v * (0.8 + 0.2 * r.f()));
    }
    for (const pn of ['perc1', 'perc2']) {
      const part = drums[pn];
      if (!part || !on(pn)) continue;
      for (const [inst, pat] of Object.entries(part)) {
        if (!pat || !kit[inst]) continue;
        for (const [s, v] of hits(pat)) {
          if (inSeg % 4 === 3 && r.chance(0.15)) continue;
          hit(C[pn], kit[inst], T(s) + H(), v * (0.75 + 0.25 * r.f()));
        }
      }
    }
    // dolgular
    if (fill === 'conga' && kit.congaHi) {
      [12, 13, 14, 15].forEach((s, k) => hit(C.perc1, k % 2 ? kit.congaLo : kit.congaHi, T(s) + H(), 0.5 + 0.1 * k));
    }
    if (fill === 'tom' && kit.tom) {
      [10, 12, 14].forEach((s, k) => hit(C.perc2, kit.tom, T(s) + H(), 0.6, 1 - k * 0.1));
    }
    if (fill === 'big' && kit.tom && r.chance(0.5)) {
      [12, 13, 14, 15].forEach((s, k) => hit(C.perc2, kit.tom, T(s) + H(), 0.45 + 0.08 * k, 1.1 - k * 0.07));
    }
    if (fill === 'sweep' || (fill === 'big' && r.chance(0.4))) K.sweep(C.fx.input, t0, BAR, true, 0.1);
    if (inSeg === 0 && seg.sec === 'b' && this.segs[seg.index - 1]?.sec === 'break') K.sweep(C.fx.input, t0, BAR * 2, false, 0.08);

    // ---- bas ----
    if (on('bass')) {
      const pat = inSeg % 4 === 3 ? d.bassAlt : d.bassMain;
      let prevNote = null;
      let prevEnd = -1;
      for (const nt of notes(pat)) {
        const ci = this.chordIndex(b, nt.s >= 8 ? 1 : 0);
        const ch = H2.chords[ci];
        const nx = H2.chords[this.chordIndex(b + 1, 0)];
        const root = this.bassRoot(d.pedal ? 0 : ch.root);
        const rel = ch.pcs.map((x) => mod12(x - ch.root));
        let m = root;
        if (nt.role === 'O') m = root + 12;
        else if (nt.role === 'F') m = root + 7;
        else if (nt.role === '7') m = root + (rel.includes(11) ? 11 : 10);
        else if (nt.role === '3') m = root + (rel.includes(3) ? 3 : 4);
        else if (nt.role === 'A') m = this.bassRoot(nx.root) - 1;
        else if (nt.role === 'N') m = this.bassRoot(nx.root);
        if (m > 52) m -= 12;
        const vel = (nt.s % 4 === 0 ? 0.95 : 0.82) * (0.9 + 0.1 * r.f());
        const from = d.glide && prevNote != null && prevEnd === nt.s && prevNote !== m ? prevNote : null;
        K.bass(C.bass.input, T(nt.s) + H(), m, nt.len * s16 * 0.9, vel, d.bassP, from);
        prevNote = m;
        prevEnd = nt.s + nt.len;
      }
    }

    // ---- akorlar ----
    if (on('chords')) {
      const pat = d.chordRhythm[seg.alt.has('chords') ? 1 : 0];
      for (const nt of notes(pat)) {
        const ci = nt.role === 'n' ? this.chordIndex(b + 1, 0) : this.chordIndex(b, nt.s >= 8 ? 1 : 0);
        const v = H2.voicing[ci];
        const dur = (nt.len > 1 ? nt.len : d.chordLen) * s16;
        const vel = (nt.s % 4 === 2 ? 0.85 : 0.75) * (0.85 + 0.15 * r.f()) * (0.85 + 0.25 * E);
        const t = T(nt.s) + H();
        v.forEach((mm, k) => this.playChordNote(C.chords.input, t + k * d.strum * r.range(0.6, 1.3), mm, dur, vel * (k === v.length - 1 ? 1 : 0.85)));
      }
    }
    if (on('pad') && d.padInst) {
      const newly = inSeg === 0 && !this.padWas;
      for (const h of [0, 1]) {
        const u = b * 2 + h;
        const pos = u % H2.upc;
        if (pos !== 0 && !(newly && h === 0)) continue;
        const ci = this.chordIndex(b, h);
        const dur = ((H2.upc - pos) * BAR) / 2;
        for (const mm of H2.padVoicing[ci]) this.playPad(C.pad.input, t0 + (h * BAR) / 2, mm, dur * 1.02);
      }
    }
    this.padWas = on('pad');

    // ---- melodiler: çağrı ve cevap ----
    const l1 = on('lead');
    const l2 = on('lead2');
    if (l1 || l2) {
      const q = inSeg % 4;
      const who = l1 && l2 ? (q < 2 ? 'lead' : 'lead2') : l1 ? 'lead' : 'lead2';
      const L = d[who];
      let mot = L.motif;
      if (!(l1 && l2) && q >= 2) mot = L.motifB;
      if (inSeg % 8 >= 6) mot = L.motifV;
      const mb = (inSeg % 2) % mot.bars;
      const lo = L.lo;
      for (const nt of mot.notes) {
        if (nt.s < mb * 16 || nt.s >= mb * 16 + 16) continue;
        const s = nt.s - mb * 16;
        const ch = H2.chords[this.chordIndex(b, s >= 8 ? 1 : 0)];
        const pcs = ch.pcs.map((x) => mod12(x + d.tonic));
        const list = [];
        for (let mm = lo; mm < lo + 26; mm++) if (pcs.includes(mod12(mm))) list.push(mm);
        const mm = list[clamp(nt.i, 0, list.length - 1)];
        this.playLead(C[who].input, L, T(s) + H(), mm, nt.len * s16, nt.v * (0.85 + 0.15 * r.f()));
      }
    }
    if (on('vox')) {
      const V = d.vox;
      if (V.kind === 'chop') {
        for (const nt of notes(V.pat)) {
          const ci = this.chordIndex(b, nt.s >= 8 ? 1 : 0);
          const v = H2.voicing[ci];
          const mm = v[v.length - 1 - (nt.s % 3 === 0 ? 0 : 1)] ?? v[v.length - 1];
          K.vox(C.vox.input, T(nt.s) + H(), mm, s16 * r.range(1.2, 2.2), 0.8, V.p);
        }
      } else {
        for (const h of [0, 1]) {
          if ((b * 2 + h) % H2.upc !== 0) continue;
          const v = H2.voicing[this.chordIndex(b, h)];
          const dur = (H2.upc * BAR) / 2;
          for (const mm of v.slice(-2)) K.vox(C.vox.input, t0 + (h * BAR) / 2, mm, dur * 0.95, 0.6, { ...V.p, attack: 0.5, release: 0.8 });
        }
      }
    }
  }

  playChordNote(out, t, m, dur, vel) {
    const d = this.d;
    const K = this.m.kit;
    if (d.chordInst === 'rhodes') K.rhodes(out, t, m, dur, vel, d.chordP);
    else if (d.chordInst === 'organ') K.organ(out, t, m, dur, vel, d.chordP);
    else if (d.chordInst === 'mallet') K.mallet(out, t, m, dur, vel, d.chordP);
    else K.saws(out, t, m, dur, vel, d.chordP);
  }

  playPad(out, t, m, dur) {
    const d = this.d;
    const K = this.m.kit;
    if (d.padInst === 'choir') K.vox(out, t, m, dur, 0.55, d.padP);
    else K.saws(out, t, m, dur, 0.8, d.padP);
  }

  playLead(out, L, t, m, dur, vel) {
    const K = this.m.kit;
    if (L.inst === 'rhodes') K.rhodes(out, t, m, Math.max(dur, 0.25), vel, L.p);
    else if (L.inst === 'flute') K.flute(out, t, m, Math.max(dur, 0.18), vel, L.p);
    else if (L.inst === 'vox') K.vox(out, t, m, Math.max(dur, 0.15), vel, L.p);
    else K.mallet(out, t, m, dur, vel, L.p);
  }

  summary() {
    const d = this.d;
    return { style: d.style, prog: d.progId, chordInst: d.chordInst, padInst: d.padInst, bassType: d.bassType, bassPat: d.bassPatId, leadInst: d.lead.inst, tonic: d.tonic, mode: d.mode, bpm: d.bpm, name: d.name, cam: d.cam, seed: d.seed, at: Date.now() };
  }
}

// ---------- Akış: parçaları sıraya dizer, saati sürer, geçişleri yapar ----------
const load = (k, def) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? def;
  } catch {
    return def;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const camDist = (a, b) => {
  const x = Math.abs(a - b) % 12;
  return Math.min(x, 12 - x);
};

export class Akis {
  constructor(motor) {
    this.m = motor;
    this.energy = 0.5;
    this.mood = 0.5;
    this.focus = false;
    this.tracks = [];
    this.bar = 0;
    this.bpm = 120;
    this.nextBarTime = 0;
    this.history = load('sh-gecmis', []);
    this.taste = load('sh-zevk', {});
    this.untilAmbient = 4 + Math.floor(Math.random() * 4);
    this.handlers = {};
    this.lead = null;
    this.running = false;
  }

  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
  }
  emit(ev, x) {
    for (const fn of this.handlers[ev] || []) fn(x);
  }

  ctxInfo(prev, ambient) {
    return { prev, energy: this.energy, mood: this.mood, focus: this.focus, taste: this.taste, history: this.history, ambient };
  }

  // Aday parçalar arasından: öncekine yakın, son çalınanlardan farklı, zevke uygun olanı seç
  pickNext(prev) {
    const ambient = this.energy < 0.1 || (prev && prev.style !== 'ambient' && this.untilAmbient <= 0);
    let best = null;
    let bestS = -Infinity;
    const recent = this.history.slice(-8);
    for (let i = 0; i < (ambient ? 3 : 10); i++) {
      const dna = designTrack(newSeed(), this.ctxInfo(prev, ambient));
      let s = 0;
      if (prev) {
        if (dna.style !== 'ambient' && prev.style !== 'ambient') s -= Math.max(0, Math.abs(dna.bpm - prev.bpm) - 2) * 1.5;
        const cd = camDist(dna.cam.n, prev.cam.n);
        s -= cd === 0 ? 0.4 : cd === 1 ? 0 : cd === 2 ? 1.5 : 4;
      }
      recent.forEach((h, k) => {
        const w = (k + 1) / recent.length;
        if (h.style === dna.style) s -= 0.7 * w;
        if (h.prog === dna.progId) s -= 2 * w;
        if (h.chordInst === dna.chordInst) s -= 0.5 * w;
        if (h.leadInst === dna.lead.inst) s -= 0.5 * w;
        if (h.bassPat === dna.bassPatId) s -= 0.6 * w;
        if (h.tonic === dna.tonic && h.mode === dna.mode) s -= 0.8 * w;
      });
      if (dna.style !== 'ambient') s -= Math.abs(STYLES[dna.style].energy - this.energy) * 2;
      const T = this.taste;
      for (const k of ['s:' + dna.style, 'c:' + dna.chordInst, 'l:' + dna.lead.inst, 'p:' + dna.padInst, 'b:' + dna.bassType]) s += (T[k] || 0) * 0.8;
      s += Math.random() * 1.2;
      if (s > bestS) {
        bestS = s;
        best = dna;
      }
    }
    if (best.style === 'ambient') this.untilAmbient = 4 + Math.floor(Math.random() * 4);
    else this.untilAmbient--;
    return best;
  }

  async start() {
    const m = this.m;
    this.running = true;
    if (!this.tracks.length) {
      const dna = this.pickNext(null);
      const tr = new Track(dna, m);
      await tr.prepare();
      tr.startBar = this.bar;
      tr.bus.out.gain.setValueAtTime(0, m.now);
      tr.bus.out.gain.linearRampToValueAtTime(1, m.now + 6);
      this.tracks.push(tr);
      this.bpm = dna.bpm;
      this.remember(tr);
    }
    this.nextBarTime = m.now + 0.15;
    m.startTicker(() => this.tick());
  }

  pause() {
    this.running = false;
    this.m.stopTicker();
  }

  resume() {
    this.running = true;
    this.nextBarTime = this.m.now + 0.12;
    this.m.startTicker(() => this.tick());
  }

  tick() {
    const c = this.m.ctx;
    if (!this.running || !c || c.state !== 'running') return;
    const now = c.currentTime;
    if (this.nextBarTime < now - 0.05) this.nextBarTime = now + 0.1; // donmadan dönüş: kaçanları çalma
    const horizon = document.hidden ? 3 : 0.7;
    let guard = 0;
    while (this.nextBarTime < now + horizon && guard++ < 4) this.playBar();
    this.maybePrepare();
  }

  leadAt(b) {
    let lead = null;
    for (const tr of this.tracks) if (b >= tr.startBar + tr.overlapIn / 2 && b < tr.startBar + tr.len) lead = tr;
    return lead || this.tracks[0] || null;
  }

  playBar() {
    const b = this.bar;
    const t = this.nextBarTime;
    const lead = this.leadAt(b);
    if (lead) this.bpm += clamp(lead.d.bpm - this.bpm, -0.12, 0.12);
    const BAR = 240 / this.bpm;
    const act = this.tracks.filter((tr) => tr.ready && b >= tr.startBar && b < tr.startBar + tr.len);
    // DJ geçişi: bas değişimi, alçak/yüksek geçiren süzgeçler, ses dengesi
    for (let i = 1; i < act.length; i++) {
      const A = act[i - 1];
      const B = act[i];
      const ov = B.overlapIn;
      const k = b - B.startBar;
      if (k < 0 || k >= ov) continue;
      const half = ov / 2;
      const x = k / half;
      const BB = B.bus;
      const AB = A.bus;
      BB.out.gain.setTargetAtTime(k < half ? lerp(0.45, 1, x) : 1, t, BAR / 3);
      BB.djHP.frequency.setTargetAtTime(k < half ? 18 * (380 / 18) ** (1 - x) : 18, t, BAR / 3);
      if (k < half) B.mute.add('bass');
      else B.mute.delete('bass');
      if (k >= half) {
        A.mute.add('bass');
        AB.djHP.frequency.setTargetAtTime(18 * (320 / 18) ** ((k - half) / half), t, BAR / 3);
      }
      const fadeFrom = ov - Math.min(8, half);
      if (k >= fadeFrom) AB.out.gain.setTargetAtTime(lerp(1, 0, (k - fadeFrom + 1) / (ov - fadeFrom)), t, BAR / 3);
    }
    for (const tr of act) {
      try {
        tr.playBar(b - tr.startBar, t, BAR, this);
      } catch (e) {
        console.error(e);
      }
    }
    if (lead && lead !== this.lead) {
      this.lead = lead;
      this.emit('track', lead);
    }
    // biten parçaları sök
    for (const tr of this.tracks.slice()) {
      if (b >= tr.startBar + tr.len + 1) {
        this.tracks.splice(this.tracks.indexOf(tr), 1);
        setTimeout(() => tr.dispose(), 9000);
      }
    }
    this.emit('bar', { bar: b, t, BAR });
    this.bar++;
    this.nextBarTime += BAR;
  }

  maybePrepare() {
    if (this.preparing) return;
    const cur = this.tracks[this.tracks.length - 1];
    if (!cur) return;
    const left = cur.startBar + cur.len - this.bar;
    if (left <= cur.d.outroBars + 20) this.prepareNext(cur);
  }

  async prepareNext(cur) {
    this.preparing = true;
    try {
      const dna = this.pickNext(cur.d);
      const tr = new Track(dna, this.m);
      await tr.prepare();
      const ov = Math.min(cur.d.outroBars, dna.introBars);
      tr.overlapIn = ov;
      let start = cur.startBar + cur.len - ov;
      if (start < this.bar + 1) {
        const extra = Math.ceil((this.bar + 2 - start) / 8) * 8;
        cur.extend(extra);
        start += extra;
      }
      tr.startBar = start;
      this.tracks.push(tr);
      this.remember(tr);
      this.emit('queued', tr);
    } catch (e) {
      console.error(e);
    }
    this.preparing = false;
  }

  remember(tr) {
    this.history.push(tr.summary());
    if (this.history.length > 60) this.history = this.history.slice(-60);
    save('sh-gecmis', this.history);
  }

  // Sonraki parçaya geç: çıkış en yakın 4 ölçülük sınırda başlar
  skip(quick = false) {
    const cur = this.tracks[this.tracks.length - 1];
    if (!cur || this.preparing) return false;
    const rel = this.bar - cur.startBar;
    if (cur.overlapIn && rel < cur.overlapIn) return false; // geçiş zaten sürüyor
    const from = Math.ceil((rel + 2) / 4) * 4;
    cur.forceOutro(from, quick ? 8 : 16);
    this.prepareNext(cur);
    return true;
  }

  like(tr, dir) {
    if (!tr) return;
    const d = tr.d;
    const step = dir > 0 ? 0.35 : -0.45;
    for (const k of ['s:' + d.style, 'c:' + d.chordInst, 'l:' + d.lead.inst, 'p:' + d.padInst, 'b:' + d.bassType]) {
      this.taste[k] = clamp((this.taste[k] || 0) + step, -2, 2);
    }
    save('sh-zevk', this.taste);
  }
}
