// Skin-Truhen: jeder Skin ist ein eigener "Ball" mit den Werten und Fähigkeiten seines Grundballs (siehe skins.js). Im Kampf wird er zum Grundball (addBall), nur Aussehen und Geräusche bleiben.
import { DEFS, BALL_IDS } from './balls.js';
import { SKINS } from './skins.js';

for (const s of SKINS) {
  const b = DEFS[s.base];
  if (!b) throw new Error('Grundball fehlt: ' + s.base);
  DEFS[s.id] = Object.assign({}, b, { name: s.name, rarity: s.rarity, box: s.box, base: s.base, skin: true, desc: s.desc + ' ' + b.desc });
  BALL_IDS.push(s.id);
}
