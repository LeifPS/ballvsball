// Skins sind Gegenstände, keine Bälle: Sie stehen in DEFS nur für Anzeige, Boxen, Markt und Tausch (Name, Seltenheit, Box) und stehen nicht in BALL_IDS.
// Im Kampf trägt ein Ball seinen angelegten Skin als cfg.balls[].skin (Aussehen und Effekte), die Werte kommen vom Grundball.
import { DEFS } from './balls.js';
import { SKINS } from './skins.js';

for (const s of SKINS) {
  const b = DEFS[s.base];
  if (!b) throw new Error('Grundball fehlt: ' + s.base);
  DEFS[s.id] = Object.assign({}, b, { name: s.name, rarity: s.rarity, box: s.box, base: s.base, skin: true, desc: s.desc });
}
