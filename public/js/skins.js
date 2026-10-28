// Ball-Skins: gleiche Werte und Fähigkeiten wie der Grundball, nur anderes Aussehen. Je seltener der Skin, desto mehr ist neu:
// gewöhnlich: andere Farbe | selten: dazu eigene Partikel an den Geschossen | episch: dazu ein Leuchten und Schimmern am Ball
// legendär: dazu ein ganz neues Modell | mythisch: dazu eigene Geräusche
export const SKINS = [
  // Farbtruhe
  { id: 'goldstachel', base: 'stachel', name: 'Goldstachel', rarity: 'gewoehnlich', box: 'skin1', tint: '#ffd24a', a: .55, desc: 'Der Stachelball in glänzendem Gold.' },
  { id: 'eisfeuer', base: 'feuer', name: 'Eisfeuer', rarity: 'gewoehnlich', box: 'skin1', tint: '#6fd8ff', a: .6, desc: 'Der Feuerball mit eiskalter blauer Flamme.' },
  { id: 'minzkaktus', base: 'kaktus', name: 'Minzkaktus', rarity: 'gewoehnlich', box: 'skin1', tint: '#8ff0c0', a: .5, desc: 'Der Kaktusball in frischem Minzgrün.' },
  { id: 'rosabumerang', base: 'bumerang', name: 'Rosa Bumerang', rarity: 'selten', box: 'skin1', tint: '#ff7ab8', a: .55, trail: { col: '#ff7ab8', kind: 'heart' }, desc: 'Der Bumerang in Rosa, seine Geschosse hinterlassen Herzen.' },
  { id: 'lavarakete', base: 'rakete', name: 'Lavarakete', rarity: 'selten', box: 'skin1', tint: '#c0301e', a: .55, trail: { col: '#ff8a2a', kind: 'ember' }, desc: 'Der Raketenball glüht wie Lava und sprüht Funken.' },
  { id: 'neonwirbel', base: 'wirbel', name: 'Neonwirbel', rarity: 'selten', box: 'skin1', tint: '#3dff7a', a: .5, trail: { col: '#3dff7a', kind: 'dot' }, desc: 'Der Wirbelball in grellem Neon, mit leuchtender Spur.' },
  { id: 'mondmagier', base: 'magier', name: 'Mondmagier', rarity: 'episch', box: 'skin1', tint: '#3a4a9a', a: .5, trail: { col: '#cfe0ff', kind: 'star' }, aura: { col: '#cfe0ff', kind: 'star', n: 4 }, desc: 'Der Magier im Mondlicht, umgeben von Sternenstaub.' },
  { id: 'regenbogenstachel', base: 'stachel', name: 'Regenbogenstachel', rarity: 'episch', box: 'skin1', tint: 'rainbow', a: .55, trail: { col: 'rainbow', kind: 'star' }, aura: { col: 'rainbow', kind: 'star', n: 4 }, desc: 'Der Stachelball in allen Farben, mit funkelnden Sternen.' },
  // Schatztruhe
  { id: 'kristallkaktus', base: 'kaktus', name: 'Kristallkaktus', rarity: 'selten', box: 'skin2', tint: '#b8e8ff', a: .6, trail: { col: '#b8e8ff', kind: 'shard' }, desc: 'Der Kaktus aus Eis, seine Stacheln splittern wie Kristall.' },
  { id: 'schattenfeuer', base: 'feuer', name: 'Schattenfeuer', rarity: 'selten', box: 'skin2', tint: '#6a2a9a', a: .6, trail: { col: '#b36cff', kind: 'ember' }, desc: 'Der Feuerball mit violetter Schattenflamme.' },
  { id: 'bluetenbumerang', base: 'bumerang', name: 'Blütenbumerang', rarity: 'episch', box: 'skin2', tint: '#ffb0d0', a: .55, trail: { col: '#ff9ac4', kind: 'flower' }, aura: { col: '#ffd0e4', kind: 'flower', n: 4 }, desc: 'Der Bumerang im Frühling: Blütenblätter wirbeln um ihn.' },
  { id: 'sternenrakete', base: 'rakete', name: 'Sternenrakete', rarity: 'episch', box: 'skin2', tint: '#ffd45a', a: .5, trail: { col: '#ffe27a', kind: 'star' }, aura: { col: '#fff2a0', kind: 'star', n: 4 }, desc: 'Der Raketenball in Gold, eine Sternschnuppe auf Besuch.' },
  { id: 'drachenstachel', base: 'stachel', name: 'Drachenstachel', rarity: 'legendaer', box: 'skin2', model: true, trail: { col: '#ff6a2a', kind: 'ember' }, aura: { col: '#ffb04a', kind: 'ember', n: 5 }, desc: 'Ein kleiner Drache mit Flügeln statt Stacheln. Neues Modell.' },
  { id: 'phoenixfeuer', base: 'feuer', name: 'Phönixfeuer', rarity: 'legendaer', box: 'skin2', model: true, trail: { col: '#ffb02a', kind: 'ember' }, aura: { col: '#ffd45a', kind: 'ember', n: 5 }, desc: 'Der Feuerball als Feuervogel. Neues Modell.' },
  { id: 'piratenbumerang', base: 'bumerang', name: 'Piratenbumerang', rarity: 'legendaer', box: 'skin2', model: true, trail: { col: '#ffe14a', kind: 'dot' }, aura: { col: '#ffe14a', kind: 'star', n: 3 }, desc: 'Der Bumerang als Piratenkapitän mit Augenklappe. Neues Modell.' },
  { id: 'kosmosmagier', base: 'magier', name: 'Kosmosmagier', rarity: 'mythisch', box: 'skin2', model: true, trail: { col: 'rainbow', kind: 'star' }, aura: { col: 'rainbow', kind: 'star', n: 7 }, snd: { cast: 'skin_kosmos_cast', hit: 'skin_kosmos_hit' }, desc: 'Der Magier, der die Sterne selbst ruft. Neues Modell und eigene Geräusche.' }
];
export const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
