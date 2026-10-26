// Tohumlu rastgelelik: aynı tohum aynı parçayı verir.

export function hash(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.f = mulberry32(this.seed);
  }
  range(a, b) {
    return a + (b - a) * this.f();
  }
  int(a, b) {
    return a + Math.floor(this.f() * (b - a + 1));
  }
  chance(p) {
    return this.f() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.f() * arr.length)];
  }
  // [[değer, ağırlık], ...] listesinden ağırlığa göre seçer
  weighted(pairs) {
    let sum = 0;
    for (const [, w] of pairs) sum += Math.max(0, w);
    let r = this.f() * sum;
    for (const [v, w] of pairs) {
      r -= Math.max(0, w);
      if (r <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
  gauss() {
    const u = 1 - this.f();
    const v = this.f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  fork(...salt) {
    return new Rng(hash(this.seed, ...salt));
  }
}

export const newSeed = () => (Math.random() * 4294967296) >>> 0;
