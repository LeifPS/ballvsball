// Ballboxen: Preise, Namen, Zeitfenster. Wird von Server und Client benutzt.
export const BOX_LIST = [
  { id: 'standard', name: 'Standard-Box', price: 100, cur: 'coins', col: '#d9a441', desc: 'Die klassischen Bälle.' },
  { id: 'weltraum', name: 'Weltraum-Box', price: 175, cur: 'coins', col: '#5b6ad0', desc: 'Monde, Ufos und schwarze Löcher.' },
  { id: 'kueche', name: 'Küchen-Box', price: 150, cur: 'coins', col: '#e0714f', desc: 'Pizza, Pfannen und scharfe Chilis.' },
  { id: 'sport', name: 'Spielzeug-Box', price: 150, cur: 'coins', col: '#4fae6a', desc: 'Sportgeräte und Spielzeug.' },
  { id: 'elemente', name: 'Wetter-Box', price: 200, cur: 'coins', col: '#4aa6c9', desc: 'Regen, Blitz, Lava und Wirbelsturm.' },
  { id: 'halloween', name: 'Halloween-Box', price: 10, cur: 'tokens', col: '#e8761d', desc: 'Nur bis Ende Oktober! Kostet Halloween-Marken.', until: Date.UTC(2026, 9, 31, 23, 0, 0) }
];
export const BOX_BY_ID = Object.fromEntries(BOX_LIST.map(b => [b.id, b]));
// 1. November 2026, 00:00 Uhr deutscher Zeit
export const EVENT_END = BOX_BY_ID.halloween.until;
export function boxActive(id, now) { const b = BOX_BY_ID[id]; return !!b && (!b.until || now < b.until); }
export function eventActive(now) { return now < EVENT_END; }
