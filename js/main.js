// Arayüz: düğmeler, kaydırıcılar, hazır ayarlar, medya tuşları, uyku zamanlayıcı, görsel arka plan.
import { Motor } from './motor.js';
import { Akis } from './besteci.js';
import { keyName } from './kuram.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;

const STR = {
  tr: {
    tagline: 'Kendi kendine bestelenen, hiç bitmeyen house', start: 'Başlat', intro: 'Her parça o an yazılır; aynısı bir daha çalmaz. Arka planda açık bırak, sekmeyi küçültebilirsin.',
    vol: 'Ses', energy: 'Enerji', mood: 'Hava', calm: 'sakin', lively: 'hareketli', dark: 'loş', bright: 'aydınlık',
    p_sabah: 'Sabah', p_odak: 'Odak', p_aksam: 'Akşam', p_gece: 'Gece', p_uyku: 'Uyku', p_oto: 'Saate göre',
    keys: 'Boşluk çal/durdur · N sonraki · L sevdim · D sevmedim · F ekran modu',
    settings: 'Ayarlar', neighbor: 'Komşu modu', neighbor_d: 'Duvardan geçen derin bası keser, ritim yine duyulur.',
    amb: 'Ortam sesi', amb_d: 'Müziğin altına hafif bir oda dokusu.', a_yok: 'Yok', a_plak: 'Plak', a_yagmur: 'Yağmur', a_deniz: 'Deniz', a_somine: 'Şömine',
    sleep: 'Uyku zamanlayıcı', sleep_d: 'Son üçte birinde ses yavaşça kısılır, sonra durur.', off: 'Kapalı',
    wake: 'Ekranı açık tut', wake_d: 'Mac uyku moduna geçmesin.', screen: 'Ekran modu', screen_d: 'Tam ekran saat ve yavaş renkler.', open: 'Aç',
    lang: 'Dil', taste: 'Zevk hafızası', taste_d: 'Sevdim ve sevmedim düğmeleri sonraki parçaları yönlendirir.', reset: 'Sıfırla',
    write: 'Bize yaz', about: 'Her ses tarayıcında, o anda üretilir. Kayıt ya da örnek dosya yok.',
    preparing: 'Hazırlanıyor…', next: 'Sırada', left: 'kaldı', resetDone: 'Sıfırlandı',
    styles: { deep: 'Deep house', lofi: 'Lo-fi house', garage: 'Garage', minimal: 'Minimal', balearic: 'Balear', ambient: 'Ara · ambient' },
    inst: { rhodes: 'elektrik piyano', organ: 'org', juno: 'synth', dub: 'dub akor', mallet: 'tokmaklı', kalimba: 'kalimba', marimba: 'marimba', bell: 'çan', pluck: 'pluck', flute: 'flüt', vox: 'vokal' },
  },
  en: {
    tagline: 'Self-composing, never-ending house', start: 'Start', intro: 'Every track is written on the spot and never plays twice. Leave it running in the background; you can minimise the tab.',
    vol: 'Volume', energy: 'Energy', mood: 'Mood', calm: 'calm', lively: 'lively', dark: 'dim', bright: 'bright',
    p_sabah: 'Morning', p_odak: 'Focus', p_aksam: 'Evening', p_gece: 'Night', p_uyku: 'Sleep', p_oto: 'By time of day',
    keys: 'Space play/pause · N next · L like · D dislike · F screen mode',
    settings: 'Settings', neighbor: 'Neighbour mode', neighbor_d: 'Cuts the deep bass that travels through walls; the groove stays.',
    amb: 'Ambience', amb_d: 'A soft room texture under the music.', a_yok: 'None', a_plak: 'Vinyl', a_yagmur: 'Rain', a_deniz: 'Sea', a_somine: 'Fireplace',
    sleep: 'Sleep timer', sleep_d: 'Fades out slowly over the last third, then stops.', off: 'Off',
    wake: 'Keep screen on', wake_d: 'Stop the Mac from sleeping.', screen: 'Screen mode', screen_d: 'Full-screen clock and slow colours.', open: 'Open',
    lang: 'Language', taste: 'Taste memory', taste_d: 'Like and dislike steer the next tracks.', reset: 'Reset',
    write: 'Write to us', about: 'Every sound is generated in your browser, live. No recordings or samples.',
    preparing: 'Preparing…', next: 'Up next', left: 'left', resetDone: 'Reset',
    styles: { deep: 'Deep house', lofi: 'Lo-fi house', garage: 'Garage', minimal: 'Minimal', balearic: 'Balearic', ambient: 'Interlude · ambient' },
    inst: { rhodes: 'electric piano', organ: 'organ', juno: 'synth', dub: 'dub chords', mallet: 'mallet', kalimba: 'kalimba', marimba: 'marimba', bell: 'bell', pluck: 'pluck', flute: 'flute', vox: 'voice' },
  },
};

const PRESETS = {
  sabah: { energy: 0.45, mood: 0.8, focus: false },
  odak: { energy: 0.42, mood: 0.52, focus: true },
  aksam: { energy: 0.62, mood: 0.5, focus: false },
  gece: { energy: 0.36, mood: 0.24, focus: false },
  uyku: { energy: 0.1, mood: 0.35, focus: true },
};
// Saate göre hedef: [saat, enerji, hava]
const DAY = [[0, 0.24, 0.25], [5, 0.2, 0.4], [8, 0.45, 0.78], [11, 0.5, 0.62], [15, 0.55, 0.58], [18, 0.62, 0.5], [21, 0.42, 0.32], [24, 0.24, 0.25]];
function dayTarget() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  for (let i = 0; i < DAY.length - 1; i++) {
    const [h0, e0, m0] = DAY[i];
    const [h1, e1, m1] = DAY[i + 1];
    if (h >= h0 && h < h1) {
      const x = (h - h0) / (h1 - h0);
      return { energy: lerp(e0, e1, x), mood: lerp(m0, m1, x) };
    }
  }
  return { energy: 0.4, mood: 0.4 };
}

const loadS = () => {
  try {
    return JSON.parse(localStorage.getItem('sh-ayar')) || {};
  } catch {
    return {};
  }
};
const S = Object.assign({ vol: 0.7, energy: 0.5, mood: 0.5, preset: 'oto', neighbor: false, amb: 'yok', ambLevel: 0.4, lang: navigator.language?.startsWith('tr') ? 'tr' : 'en', wake: false }, loadS());
const saveS = () => {
  try {
    localStorage.setItem('sh-ayar', JSON.stringify(S));
  } catch {}
};
const t = (k) => STR[S.lang][k] ?? STR.tr[k] ?? k;

const motor = new Motor();
let akis = null;
let playing = false;
let current = null;
let liked = new Set();

// ---------- dil ----------
function applyLang() {
  document.documentElement.lang = S.lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const b of $('dil').children) b.classList.toggle('secili', b.dataset.l === S.lang);
  if (current) showTrack(current, true);
}

// ---------- kaydırıcılar ----------
function paintRange(el) {
  el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
}
for (const el of document.querySelectorAll('input[type=range]')) {
  paintRange(el);
  el.addEventListener('input', () => paintRange(el));
}
const setRange = (el, v) => {
  el.value = v;
  paintRange(el);
};

// ---------- enerji ve hava: kullanıcı ayarı + yavaş, kendiliğinden gezinme ----------
let target = { energy: S.energy, mood: S.mood, focus: false };
let live = { energy: S.energy, mood: S.mood };
const T0 = Math.random() * 1e4;
function wander(sec, salt) {
  // asal periyotlu (dakika) dalgaların toplamı: 1/f benzeri, hiç tam tekrar etmeyen gezinme
  const P = [7, 13, 29, 53];
  let s = 0;
  P.forEach((p, i) => (s += Math.sin(((sec + T0 * (salt + 1)) / (p * 60)) * 2 * Math.PI + i * 1.7) / (i + 1)));
  return s / 2.08;
}
function updateLive() {
  if (S.preset === 'oto') {
    const d = dayTarget();
    target.energy = d.energy;
    target.mood = d.mood;
  }
  const sec = performance.now() / 1000;
  const eT = clamp(target.energy + 0.08 * wander(sec, 0), 0, 1);
  const mT = clamp(target.mood + 0.1 * wander(sec, 1), 0, 1);
  live.energy += (eT - live.energy) * 0.05;
  live.mood += (mT - live.mood) * 0.05;
  if (akis) {
    akis.energy = live.energy;
    akis.mood = live.mood;
    akis.focus = target.focus;
  }
}
setInterval(updateLive, 2000);

function choosePreset(p) {
  S.preset = p;
  for (const b of $('hazir').children) b.classList.toggle('secili', b.dataset.p === p);
  if (p === 'oto') {
    const d = dayTarget();
    target = { ...d, focus: false };
  } else if (PRESETS[p]) target = { ...PRESETS[p] };
  setRange($('enerji'), target.energy);
  setRange($('hava'), target.mood);
  S.energy = target.energy;
  S.mood = target.mood;
  saveS();
}
$('hazir').addEventListener('click', (e) => {
  const p = e.target.closest('button')?.dataset.p;
  if (p) choosePreset(p);
});
$('enerji').addEventListener('input', (e) => {
  target.energy = S.energy = +e.target.value;
  S.preset = null;
  for (const b of $('hazir').children) b.classList.remove('secili');
  saveS();
});
$('hava').addEventListener('input', (e) => {
  target.mood = S.mood = +e.target.value;
  S.preset = null;
  for (const b of $('hazir').children) b.classList.remove('secili');
  saveS();
});
$('ses').addEventListener('input', (e) => {
  S.vol = +e.target.value;
  applyVolume();
  saveS();
});

// ---------- uyku zamanlayıcı ----------
let sleepEnd = 0;
let sleepLen = 0;
let sleepFade = 1;
function applyVolume() {
  motor.setVolume(S.vol * sleepFade);
}
$('uyku').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = +b.dataset.m;
  for (const x of $('uyku').children) x.classList.toggle('secili', x === b);
  sleepLen = m * 60;
  sleepEnd = m ? Date.now() + m * 60000 : 0;
  sleepFade = 1;
  applyVolume();
  tickSleep();
});
function tickSleep() {
  if (!sleepEnd) {
    $('uykuKalan').textContent = '';
    return;
  }
  const left = (sleepEnd - Date.now()) / 1000;
  if (left <= 0) {
    sleepEnd = 0;
    if (playing) togglePlay();
    sleepFade = 1;
    applyVolume();
    for (const x of $('uyku').children) x.classList.toggle('secili', x.dataset.m === '0');
    $('uykuKalan').textContent = '';
    return;
  }
  const third = sleepLen / 3;
  const f = left < third ? left / third : 1;
  sleepFade = f * f; // kulak için yumuşak: sona doğru daha hızlı iner
  applyVolume();
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60);
  $('uykuKalan').textContent = `${mm}:${String(ss).padStart(2, '0')} ${t('left')}`;
}
setInterval(tickSleep, 1000);

// ---------- ayarlar ----------
$('ayarlarBtn').onclick = () => ($('ayarlar').hidden = false);
$('kapat').onclick = () => ($('ayarlar').hidden = true);
$('ayarlar').addEventListener('click', (e) => {
  if (e.target === $('ayarlar')) $('ayarlar').hidden = true;
});
$('komsu').checked = S.neighbor;
$('komsu').onchange = (e) => {
  S.neighbor = e.target.checked;
  motor.setNeighbor(S.neighbor);
  saveS();
};
function markAmb() {
  for (const b of $('ortam').children) b.classList.toggle('secili', b.dataset.a === S.amb);
}
$('ortam').addEventListener('click', (e) => {
  const a = e.target.closest('button')?.dataset.a;
  if (!a) return;
  S.amb = a;
  markAmb();
  motor.setAmbience(S.amb, S.ambLevel);
  saveS();
});
setRange($('ortamSes'), S.ambLevel);
$('ortamSes').addEventListener('input', (e) => {
  S.ambLevel = +e.target.value;
  motor.setAmbience(S.amb, S.ambLevel);
  saveS();
});
$('dil').addEventListener('click', (e) => {
  const l = e.target.closest('button')?.dataset.l;
  if (!l) return;
  S.lang = l;
  saveS();
  applyLang();
});
$('sifirla').onclick = () => {
  try {
    localStorage.removeItem('sh-zevk');
  } catch {}
  if (akis) akis.taste = {};
  $('sifirla').textContent = t('resetDone');
  setTimeout(() => ($('sifirla').textContent = t('reset')), 1500);
};

// ---------- ekranı açık tut ----------
let lock = null;
async function wantLock() {
  if (!S.wake || !playing || document.hidden || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
  } catch {}
}
$('uyanik').checked = S.wake;
$('uyanik').onchange = (e) => {
  S.wake = e.target.checked;
  saveS();
  if (S.wake) wantLock();
  else if (lock) lock.release();
};
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) wantLock();
});

// ---------- ekran modu ----------
function openScreen() {
  $('ekran').hidden = false;
  $('ayarlar').hidden = true;
  document.documentElement.requestFullscreen?.().catch(() => {});
  updateClock();
}
function closeScreen() {
  $('ekran').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
$('ekranBtn').onclick = openScreen;
$('ekran').onclick = closeScreen;
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) $('ekran').hidden = true;
});
function updateClock() {
  const d = new Date();
  const s = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  $('saat').textContent = s;
  $('ekranSaat').textContent = s;
}
setInterval(updateClock, 5000);
updateClock();

// ---------- parça bilgisi ----------
function showTrack(tr, instant) {
  current = tr;
  const d = tr.d;
  const L = STR[S.lang];
  const name = d.name[S.lang];
  const set = () => {
    $('ad').textContent = name;
    $('ekranAd').textContent = name;
    $('tur').textContent = L.styles[d.style];
    const inst = [L.inst[d.chordInst], L.inst[d.lead.inst]].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
    $('bilgi').textContent = `${keyName(d.tonic, d.mode, S.lang)} · ${d.bpm} BPM · ${inst}`;
    $('ad').classList.remove('soluk');
  };
  if (instant) set();
  else {
    $('ad').classList.add('soluk');
    setTimeout(set, 1200);
  }
  $('sevdim').classList.toggle('aktif', liked.has(d.seed));
  $('sonraki').textContent = '';
  palette.to(d);
  mediaMeta(d);
  document.title = `${name} · Sonsuz House`;
}

// ---------- medya tuşları (Mac klavyesi, Kontrol Merkezi) ----------
function artwork(d) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const [a, b] = colorsFor(d);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(20,17,15,.85)';
  g.beginPath();
  g.arc(128, 128, 22, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL('image/png');
}
function mediaMeta(d) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: d.name[S.lang],
      artist: 'Sonsuz House',
      album: `${STR[S.lang].styles[d.style]} · ${keyName(d.tonic, d.mode, S.lang)}`,
      artwork: [{ src: artwork(d), sizes: '256x256', type: 'image/png' }],
    });
  } catch {}
}
if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  try {
    ms.setActionHandler('play', () => !playing && togglePlay());
    ms.setActionHandler('pause', () => playing && togglePlay());
    ms.setActionHandler('stop', () => playing && togglePlay());
    ms.setActionHandler('nexttrack', () => next());
  } catch {}
}

// ---------- çal / durdur / geç / beğen ----------
async function begin() {
  $('basla').disabled = true;
  $('basla').textContent = t('preparing');
  motor.init();
  if (motor.ctx.state !== 'running') await motor.ctx.resume();
  motor.setNeighbor(S.neighbor);
  applyVolume();
  akis = new Akis(motor);
  updateLive();
  live = { energy: target.energy, mood: target.mood };
  updateLive();
  akis.on('track', (tr) => showTrack(tr));
  akis.on('queued', (tr) => {
    $('sonraki').textContent = `${t('next')}: ${tr.d.name[S.lang]}`;
  });
  akis.on('bar', ({ BAR }) => palette.beat(BAR));
  await akis.start();
  if (S.amb !== 'yok') motor.setAmbience(S.amb, S.ambLevel);
  playing = true;
  $('giris').hidden = true;
  $('ana').hidden = false;
  $('cal').classList.remove('durdu');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  wantLock();
}

async function togglePlay() {
  if (!akis) return;
  if (playing) {
    akis.pause();
    await motor.ctx.suspend();
    playing = false;
    if (lock) lock.release();
  } else {
    await motor.ctx.resume();
    akis.resume();
    playing = true;
    wantLock();
  }
  $('cal').classList.toggle('durdu', !playing);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
function next() {
  if (!akis || !playing) return;
  if (akis.skip()) pop($('sonrakiBtn'));
}
function like() {
  if (!akis || !current || liked.has(current.d.seed)) return;
  liked.add(current.d.seed);
  akis.like(current, 1);
  $('sevdim').classList.add('aktif');
  pop($('sevdim'));
}
function dislike() {
  if (!akis || !current) return;
  akis.like(current, -1);
  pop($('sevmedim'));
  next();
}

$('basla').onclick = begin;
$('cal').onclick = togglePlay;
$('sonrakiBtn').onclick = next;
$('sevdim').onclick = like;
$('sevmedim').onclick = dislike;
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const k = e.key.toLowerCase();
  if (k === ' ' && akis) {
    e.preventDefault();
    togglePlay();
  } else if (k === 'n') next();
  else if (k === 'l') like();
  else if (k === 'd') dislike();
  else if (k === 'f' && akis) ($('ekran').hidden ? openScreen() : closeScreen());
  else if (k === 'escape') {
    $('ayarlar').hidden = true;
  }
});

// ---------- görsel arka plan: tona ve havaya göre yavaş renk bulutları ----------
function colorsFor(d) {
  const hue = (d.tonic * 30 + 20) % 360;
  const light = d.style === 'ambient' ? 0.9 : 1;
  const warm = MODE_WARM[d.mode] ?? 0.5;
  const h2 = (hue + 40 + warm * 50) % 360;
  return [`hsl(${hue} ${45 + warm * 20}% ${30 * light}%)`, `hsl(${h2} ${40 + warm * 25}% ${22 * light}%)`, hue, h2, warm];
}
const MODE_WARM = { phrygian: 0.1, aeolian: 0.3, dorian: 0.5, mixolydian: 0.65, ionian: 0.8, lydian: 0.95 };

const palette = (() => {
  const cv = $('bg');
  const g = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let cur = { h1: 25, h2: 340, s: 45, l: 0.2 };
  let tgt = { ...cur };
  let pulse = 0;
  const blobs = Array.from({ length: 4 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.35 + Math.random() * 0.3, sx: 0.00003 + Math.random() * 0.00005, sy: 0.00003 + Math.random() * 0.00005, ph: Math.random() * 6, k: i }));
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.width = Math.round(innerWidth * dpr * 0.5);
    H = cv.height = Math.round(innerHeight * dpr * 0.5);
  }
  addEventListener('resize', resize);
  resize();
  const buf = new Uint8Array(64);
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 50) return; // 20 kare/sn yeter, işlemciyi yormasın
    last = now;
    for (const k of ['h1', 'h2', 's', 'l']) {
      let dlt = tgt[k] - cur[k];
      if (k[0] === 'h') dlt = ((dlt + 540) % 360) - 180;
      cur[k] += dlt * 0.01;
    }
    if (motor.an && playing) {
      motor.an.getByteFrequencyData(buf);
      const low = (buf[1] + buf[2] + buf[3]) / 765;
      pulse += (low - pulse) * 0.2;
    }
    g.fillStyle = '#14110f';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const x = (0.5 + 0.45 * Math.sin(now * b.sx + b.ph)) * W;
      const y = (0.5 + 0.45 * Math.cos(now * b.sy + b.ph * 1.3)) * H;
      const r = b.r * Math.max(W, H) * (1 + pulse * 0.06);
      const hue = b.k % 2 ? cur.h2 : cur.h1;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = (0.32 + pulse * 0.08) * (b.k > 1 ? 0.6 : 1);
      gr.addColorStop(0, `hsla(${hue} ${cur.s}% ${cur.l * 100 + 15}% / ${a})`);
      gr.addColorStop(1, `hsla(${hue} ${cur.s}% 10% / 0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
  return {
    to(d) {
      const [, , h1, h2, warm] = colorsFor(d);
      tgt = { h1, h2, s: 35 + warm * 25, l: d.style === 'ambient' ? 0.14 : 0.2 + live.energy * 0.08 };
    },
    beat() {},
  };
})();

// ---------- başlangıç ----------
setRange($('ses'), S.vol);
markAmb();
for (const x of $('uyku').children) x.classList.toggle('secili', x.dataset.m === '0');
if (PRESETS[S.preset] || S.preset === 'oto') choosePreset(S.preset);
else {
  target = { energy: S.energy, mood: S.mood, focus: false };
  setRange($('enerji'), S.energy);
  setRange($('hava'), S.mood);
}
applyLang();
