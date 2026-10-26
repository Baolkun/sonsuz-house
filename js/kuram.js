// Müzik kuramı: modlar, akorlar, akor dizileri, ses yürütme, Camelot çarkı.

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Her mod, ana (majör) dizisinden kaç yarım ton sonra başlar
export const MODES = {
  lydian: { steps: [0, 2, 4, 6, 7, 9, 11], parent: 5, minor: false },
  ionian: { steps: [0, 2, 4, 5, 7, 9, 11], parent: 0, minor: false },
  mixolydian: { steps: [0, 2, 4, 5, 7, 9, 10], parent: 7, minor: false },
  dorian: { steps: [0, 2, 3, 5, 7, 9, 10], parent: 2, minor: true },
  aeolian: { steps: [0, 2, 3, 5, 7, 8, 10], parent: 9, minor: true },
  phrygian: { steps: [0, 1, 3, 5, 7, 8, 10], parent: 4, minor: true },
};

// Ruh hali 0 (karanlık) … 1 (aydınlık) için mod ağırlıkları
export function modeWeights(mood) {
  const bell = (c, w) => Math.exp(-(((mood - c) / w) ** 2));
  return [
    ['phrygian', 0.35 * bell(0.0, 0.18)],
    ['aeolian', 1.0 * bell(0.2, 0.25)],
    ['dorian', 1.6 * bell(0.45, 0.3)],
    ['mixolydian', 0.7 * bell(0.65, 0.2)],
    ['ionian', 0.8 * bell(0.8, 0.2)],
    ['lydian', 0.9 * bell(0.95, 0.22)],
  ];
}

const NAMES_TR = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const NAMES_EN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MODE_TR = { lydian: 'lidya', ionian: 'majör', mixolydian: 'miksolidya', dorian: 'doryen', aeolian: 'minör', phrygian: 'frigya' };
const MODE_EN = { lydian: 'lydian', ionian: 'major', mixolydian: 'mixolydian', dorian: 'dorian', aeolian: 'minor', phrygian: 'phrygian' };

export function keyName(tonic, mode, lang = 'tr') {
  const pc = ((tonic % 12) + 12) % 12;
  return lang === 'tr' ? `${NAMES_TR[pc]} ${MODE_TR[mode]}` : `${NAMES_EN[pc]} ${MODE_EN[mode]}`;
}

// Camelot: aynı nota kümesi aynı sayı; komşu sayılar bir işaret farkı
export function camelot(tonic, mode) {
  const parent = (((tonic - MODES[mode].parent) % 12) + 12) % 12; // ana dizinin karar sesi
  const n = ((((parent - 11) * 7) % 12) + 12) % 12 + 1;
  return { n, letter: MODES[mode].minor ? 'A' : 'B', parent };
}

// Ölçek derecesi → yarım ton (oktav taşar)
export const deg = (steps, d) => steps[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

// Derece üzerine üçlülerle akor kurar, kulağı tırmalayan genişlemeleri atar
export function diatonicChord(modeName, degree, size) {
  const steps = MODES[modeName].steps;
  const root = deg(steps, degree);
  const iv = [0];
  for (let k = 1; k < size; k++) iv.push(deg(steps, degree + 2 * k) - root);
  const third = iv[1];
  return {
    root,
    tones: iv.filter((x, i) => {
      if (i === 4 && x === 13) return false; // küçük dokuzlu
      if (i === 5 && third === 4 && x === 17) return false; // majörde 11 kaçınılır
      if (i === 6 && x === 20) return false; // küçük on üçlü
      if (i === 2 && x === 6 && size < 5) return true;
      return true;
    }),
  };
}

// Paralel akor (chord memory) kalıpları: kök üstündeki aralıklar
export const SHAPES = {
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 10, 14, 17],
  m7: [0, 3, 7, 10],
  quartal: [0, 5, 10, 15],
  maj9: [0, 4, 7, 11, 14],
  six9: [0, 4, 9, 14],
  sus9: [0, 5, 10, 14],
  min11open: [0, 7, 10, 15, 17],
};

// Akor dizisi kalıpları (derece, 0 = birinci derece); kaynak: Kerri Chandler,
// Masters At Work, DJ Boring analizleri ve yaygın deep house pratiği
export const PROGS_MINOR = [
  [0, 3],
  [0, 4],
  [0, 6],
  [0, 5],
  [0, 3, 4, 3],
  [0, 6, 5, 6],
  [0, 5, 2, 6],
  [0, 2, 4, 3],
  [0, 4, 3, 4],
  [3, 0],
  [0, 3, 0, 4],
  [0, 2, 6, 3],
  [1, 4, 0, 0],
  [0, 6, 3, 4],
  [5, 6, 0, 0],
  [0, 4, 5, 3],
];
export const PROGS_MAJOR = [
  [0, 3],
  [3, 2],
  [3, 2, 1, 0],
  [1, 4, 0, 0],
  [0, 1],
  [0, 6],
  [0, 3, 1, 4],
  [3, 4, 2, 5],
  [0, 4, 5, 3],
  [0, 2, 3, 3],
  [3, 0, 1, 0],
  [5, 3, 0, 4],
  [0, 6, 3, 0],
];
// Paralel kalıp için kök hareketleri (yarım ton)
export const PLANING = [
  [0, -2],
  [0, 5],
  [0, -3, -5, -2],
  [0, 3, 5, 3],
  [0, -4, -5, -2],
  [0, 2],
  [0, -5],
  [0, 7, 5, 3],
  [0, -2, -4, -5],
  [0, 3],
];

// Ses yürütme: önceki akora en az hareketle gelen dizilişi seçer
export function voiceChord(pcsAbs, lo, hi, prev, rng, opts = {}) {
  // pcsAbs: akor seslerinin yarım ton değerleri (oktav fark etmez)
  const pcs = [...new Set(pcsAbs.map((x) => ((x % 12) + 12) % 12))];
  const cands = [];
  for (let base = lo; base < lo + 12; base++) {
    for (let rot = 0; rot < pcs.length; rot++) {
      const order = pcs.slice(rot).concat(pcs.slice(0, rot));
      const v = [];
      let cur = base - 1;
      for (const pc of order) {
        let n = cur + 1;
        while (((n % 12) + 12) % 12 !== pc) n++;
        v.push(n);
        cur = n;
      }
      if (v[0] !== base) continue;
      cands.push(v);
      if (v.length >= 4) {
        // açık diziliş: üstten ikinci ses bir oktav aşağı
        const d2 = v.slice();
        d2[d2.length - 2] -= 12;
        d2.sort((a, b) => a - b);
        cands.push(d2);
      }
    }
  }
  let best = null;
  let bestScore = Infinity;
  const center = opts.center ?? (lo + hi) / 2 + 3;
  for (const v of cands) {
    if (v[0] < lo || v[v.length - 1] > hi) continue;
    let s = 0;
    // pes bölgede sık aralık çamurlaşır
    for (let i = 1; i < v.length; i++) {
      const gap = v[i] - v[i - 1];
      if (v[i - 1] < 55 && gap < 3) s += 6;
      if (gap === 1) s += 2.5;
    }
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    s += Math.abs(mean - center) * 0.35;
    if (prev && prev.length) {
      const a = prev.slice().sort((x, y) => x - y);
      const n = Math.max(a.length, v.length);
      for (let i = 0; i < n; i++) {
        const x = a[Math.min(i, a.length - 1)];
        const y = v[Math.min(i, v.length - 1)];
        s += Math.abs(x - y) * 0.6;
      }
      s += Math.abs(a[a.length - 1] - v[v.length - 1]) * 0.4; // üst ses yumuşak gitsin
    }
    s += rng.f() * 1.2;
    if (s < bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best || pcs.map((pc) => lo + pc);
}
