// Ballboxen: Preise, Namen, Zeitfenster. Wird von Server und Client benutzt.
export const BOX_LIST = [
  { id: 'standard', name: 'Standard-Box', price: 100, cur: 'coins', col: '#d9a441', desc: 'Die klassischen Bälle.' },
  { id: 'weltraum', name: 'Weltraum-Box', price: 175, cur: 'coins', col: '#5b6ad0', desc: 'Monde, Ufos und schwarze Löcher.' },
  { id: 'kueche', name: 'Küchen-Box', price: 150, cur: 'coins', col: '#e0714f', desc: 'Pizza, Pfannen und scharfe Chilis.' },
  { id: 'sport', name: 'Spielzeug-Box', price: 150, cur: 'coins', col: '#4fae6a', desc: 'Sportgeräte und Spielzeug.' },
  { id: 'elemente', name: 'Wetter-Box', price: 200, cur: 'coins', col: '#4aa6c9', desc: 'Regen, Blitz, Lava und Wirbelsturm.' },
  { id: 'ozean', name: 'Ozean-Box', price: 175, cur: 'coins', col: '#2f9fcf', desc: 'Krabben, Quallen und der mächtige Krake.' },
  { id: 'suess', name: 'Süßigkeiten-Box', price: 150, cur: 'coins', col: '#e85fa5', desc: 'Lollis, Donuts und der Zuckerkönig.' },
  { id: 'familie', name: 'Familien-Box', price: 300, cur: 'coins', col: '#e8725a', desc: 'Die ganze Familie: Menschen und Tiere.' },
  { id: 'dino', name: 'Dino-Box', price: 200, cur: 'coins', col: '#6aa84f', desc: 'Raptoren, Panzerechsen und der T-Rex.' },
  { id: 'halloween', name: 'Halloween-Box', price: 10, cur: 'tokens', col: '#e8761d', desc: 'Nur bis Ende Oktober! Kostet Halloween-Marken.', until: Date.UTC(2026, 9, 31, 23, 0, 0) }
];
export const BOX_BY_ID = Object.fromEntries(BOX_LIST.map(b => [b.id, b]));
// 1. November 2026, 00:00 Uhr deutscher Zeit
export const EVENT_END = BOX_BY_ID.halloween.until;
export function boxActive(id, now) { const b = BOX_BY_ID[id]; return !!b && (!b.until || now < b.until); }
export function eventActive(now) { return now < EVENT_END; }

// Sterne: Duplikate verbessern einen Ball (je Stern +8 % Leben und Schaden, höchstens 5 Sterne).
// Kosten = Anzahl gleicher freier Bälle, die dafür verbraucht werden; für alle Seltenheiten gleich.
export const UP_COST = {
  gewoehnlich: [2, 3, 4, 5, 6],
  selten: [2, 3, 4, 5, 6],
  episch: [2, 3, 4, 5, 6],
  legendaer: [2, 3, 4, 5, 6]
};
