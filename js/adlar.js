// Parça adları: tohumdan şiirsel, ekleri uğraştırmayan kalıplar.
import { Rng } from './rng.js';

const TR = {
  sifat: ['Lacivert', 'Ilık', 'Sessiz', 'Uzak', 'Yumuşak', 'Sisli', 'Altın', 'Tuzlu', 'Yavaş', 'Loş', 'Mavi', 'Turuncu', 'Sıcak', 'Serin', 'Eski', 'Yarım', 'Derin', 'Hafif', 'Kadife', 'Gümüş', 'Buğulu', 'Sakin', 'Dalgın', 'Uykulu', 'Gizli', 'Mor', 'Bulutlu', 'Rüzgârlı', 'Nemli', 'Islak', 'Kehribar', 'Pastel', 'Solgun', 'Parlak', 'Gece', 'Erken', 'Geç', 'Son', 'İlk', 'Kırık', 'Bitmeyen', 'Usul'],
  isim: ['Balkon', 'Pencere', 'Tramvay', 'Rıhtım', 'Asfalt', 'Çatı', 'Sokak', 'Vapur', 'Liman', 'Kumsal', 'Plak', 'Radyo', 'Perde', 'Sahil', 'Köprü', 'Fener', 'Yağmur', 'Dalga', 'Bahçe', 'Kahve', 'Mum', 'Oda', 'Koridor', 'Merdiven', 'Ada', 'Tepe', 'Gölge', 'Işık', 'Neon', 'Taksi', 'Gar', 'Otel', 'Havuz', 'Kaset', 'Mektup', 'Sis', 'Akşamüstü', 'Şafak', 'Gece', 'Saat', 'Ay', 'Yaz', 'Kış', 'Ekim', 'Bulut', 'Teras', 'Çay', 'Martı', 'Lamba', 'Avlu'],
  yer: ['Moda', 'Karaköy', 'Kuzguncuk', 'Bodrum', 'Kaş', 'Alaçatı', 'Cihangir', 'Ayvalık', 'Bozcaada', 'Kalamış', 'Arnavutköy', 'Fethiye', 'Datça', 'Assos', 'Bebek', 'Galata', 'Urla', 'Kadıköy', 'Akyaka', 'Çeşme'],
};
const EN = {
  sifat: ['Indigo', 'Warm', 'Quiet', 'Distant', 'Soft', 'Misty', 'Golden', 'Salty', 'Slow', 'Dim', 'Blue', 'Amber', 'Velvet', 'Silver', 'Hazy', 'Calm', 'Drowsy', 'Hidden', 'Violet', 'Cloudy', 'Windy', 'Humid', 'Wet', 'Pastel', 'Pale', 'Late', 'Early', 'Last', 'First', 'Endless', 'Gentle', 'Faded', 'Lazy', 'Neon'],
  isim: ['Balcony', 'Window', 'Tram', 'Pier', 'Asphalt', 'Rooftop', 'Street', 'Ferry', 'Harbour', 'Shore', 'Record', 'Radio', 'Curtain', 'Bridge', 'Lighthouse', 'Rain', 'Wave', 'Garden', 'Coffee', 'Candle', 'Room', 'Hallway', 'Stairs', 'Island', 'Hill', 'Shadow', 'Light', 'Taxi', 'Station', 'Hotel', 'Pool', 'Tape', 'Letter', 'Fog', 'Dusk', 'Dawn', 'Night', 'Moon', 'Summer', 'Winter', 'October', 'Cloud', 'Terrace', 'Gull', 'Lamp', 'Courtyard'],
  yer: ['Lisbon', 'Ibiza', 'Kyoto', 'Marseille', 'Naples', 'Tangier', 'Havana', 'Brooklyn', 'Detroit', 'Chicago', 'Kreuzberg', 'Montreal', 'Athens', 'Istanbul', 'Bodrum', 'Reykjavík', 'Osaka', 'Malmö'],
};

const pad2 = (n) => String(n).padStart(2, '0');

export function trackName(seed, lang = 'tr') {
  const r = new Rng(seed ^ 0x9e3779b9);
  const W = lang === 'tr' ? TR : EN;
  const s = r.pick(W.sifat);
  const i = r.pick(W.isim);
  let i2 = r.pick(W.isim);
  if (i2 === i) i2 = r.pick(W.isim);
  const y = r.pick(W.yer);
  const time = `${pad2(r.pick([0, 1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23]))}:${pad2(r.int(0, 59))}`;
  const and = lang === 'tr' ? 've' : 'and';
  const forms = [
    () => `${s} ${i}`,
    () => `${s} ${i}`,
    () => `${i}, ${time}`,
    () => `${i} ${and} ${i2}`,
    () => `${y}, ${time}`,
    () => `${s} ${y}`,
    () => `${i} ${r.int(2, 909)}`,
    () => `${y} ${i}`,
  ];
  return r.pick(forms)();
}
