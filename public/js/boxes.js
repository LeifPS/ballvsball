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
  { id: 'alles', name: 'Allesbox', price: 350, cur: 'coins', col: '#5fc27a', desc: 'Magnete, Fragezeichen und eine mythische Kobra.' },
  { id: 'klein', name: 'Kleinbox', price: 450, cur: 'coins', col: '#3a3a48', desc: 'Winzige Bälle mit großer Wirkung, dazu ein mythischer Riese.' },
  { id: 'brainrot', name: 'Brainrot-Box', price: 300, cur: 'coins', col: '#ff4fd8', desc: 'Italienische Meme-Monster: Tralalero, Tung Tung Sahur und eine mythische Kuh.', off: true },
  { id: 'gefuehl', name: 'Gefühlsbox', price: 450, cur: 'coins', col: '#e86aa8', desc: 'Fröhlich, wütend, ängstlich ...: elf Gefühle und der Gefühlsherrscher.' },
  { id: 'skin1', name: 'Farbtruhe', price: 300, cur: 'coins', col: '#ff9ac4', desc: 'Acht Ball-Skins: neue Farben, Funkenspuren und Sternenstaub. Ein Skin sieht anders aus, kann aber genau das Gleiche wie sein Ball.' },
  { id: 'skin2', name: 'Schatztruhe', price: 600, cur: 'coins', col: '#e0b030', desc: 'Acht Ball-Skins, darunter vier ganz neue Modelle und ein mythischer Skin mit eigenen Geräuschen.' },
  { id: 'herbst', name: 'Herbst-Box', price: 10, cur: 'tokens', col: '#d9822b', desc: 'Nur bis Sonntag! Laub, Pilze, ein Igel und die Vogelscheuche.', until: Date.UTC(2026, 10, 1, 23, 0, 0) },
  { id: 'sturm', name: 'Sturm-Box', price: 12, cur: 'tokens', col: '#5f7fa8', desc: 'Nur sieben Tage! Wind, Nebel, Gewitter und der Sturmkapitän.', until: Date.UTC(2026, 10, 4, 23, 0, 0) },
  { id: 'halloween', name: 'Halloween-Box', price: 10, cur: 'tokens', col: '#e8761d', desc: 'Nur bis Ende Oktober! Kostet Halloween-Marken.', until: Date.UTC(2026, 9, 31, 23, 0, 0) }
];
// Eigene Chancen (in %) für Boxen, denen Seltenheiten fehlen: Allesbox hat nur Selten, Episch und Mythisch; Episch und Mythisch behalten ihre Werte, Selten bekommt den Rest
export const BOX_RARITY = { alles: { selten: 89.5, episch: 10, mythisch: .5 }, skin1: { gewoehnlich: 50, selten: 32, episch: 18 }, skin2: { selten: 50, episch: 30, legendaer: 18.5, mythisch: 1.5 }, brainrot: { gewoehnlich: 45, selten: 30, episch: 17, legendaer: 7.5, mythisch: .5 } };
export const BOX_BY_ID = Object.fromEntries(BOX_LIST.map(b => [b.id, b]));
// 1. November 2026, 00:00 Uhr deutscher Zeit
export const EVENT_END = Math.max(...BOX_LIST.filter(b => b.until).map(b => b.until));   // Kürbis-Marken gibt es, solange irgendeine Ereignisbox läuft
export function boxActive(id, now) { const b = BOX_BY_ID[id]; return !!b && !b.off && (!b.until || now < b.until); }   // off: vorübergehend aus dem Shop genommen (Code bleibt)
export function eventActive(now) { return now < EVENT_END; }

// Sterne: Duplikate verbessern einen Ball (je Stern +8 % Leben und Schaden, höchstens 5 Sterne).
// Kosten = Anzahl gleicher freier Bälle, die dafür verbraucht werden; für alle Seltenheiten gleich.
export const UP_COST = {
  gewoehnlich: [2, 3, 4, 5, 6],
  selten: [2, 3, 4, 5, 6],
  episch: [2, 3, 4, 5, 6],
  legendaer: [2, 3, 4, 5, 6],
  mythisch: [2, 3, 4, 5, 6]
};
