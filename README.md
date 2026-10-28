# Ball gegen Ball


Handgezeichnetes Mobile-Browserspiel: Bälle sammeln, Ballboxen öffnen, online kämpfen, handeln.

## Aufbau
- `public/` - Client (statische Dateien, werden von Cloudflare ausgeliefert)
  - `js/core.js`, `balls.js`, `balls2.js`, `engine.js` - deterministische Kampf-Engine (läuft im Browser und auf dem Server identisch)
  - `js/boxsim.js` - Ballbox-Minispiel (deterministisch, der Server wählt den Seed)
  - `js/boxes.js` - Ballboxen (Preise, Halloween-Zeitfenster bis 31.10.)
  - `js/sk.js`, `ballart.js`, `art.js`, `render.js` - Handzeichen-Stil (wie Tonlinge), Bälle, Effekte, Arena
  - `js/audio.js` - Sound: Effekte und Hintergrundmusik (Menü und Kampf, als Schleifen mit Überblendung) sind KI-erzeugte Aufnahmen aus `public/audio/` (ElevenLabs Sound Effects und Music, zugeschnitten und normalisiert)
  - `js/ui.js` - Oberfläche
  - `js/tuning.js` - automatisch berechnete Schadens-Faktoren (`npm run balance`)
- `src/worker.js` - Einstieg (`/api/*`)
- `src/store.js` - Durable Object `Store`: Konten, Bälle, Ballboxen, Markt, Handel (SQLite)
- `src/game.js` - Durable Object `Game`: Warteschlange, Freundesräume, Kämpfe per WebSocket, Bots
- `tools/` - Balancing-Werkzeuge, `test/` - Tests

## Befehle
- `npm run dev` - lokal starten (wrangler dev)
- `npm test` - Engine- und Ballbox-Tests
- `node test/server.test.js` - Integrationstest gegen `npm run dev`
- `node tools/balance.js` / `node tools/tune.js` - Balancing prüfen / neu berechnen

Deployment: Push auf `main` (Cloudflare Worker Build). Keine weiteren Ressourcen nötig, die Datenbank liegt in Durable Objects.

## Seltenheit und Sterne
- Epische und legendäre Bälle haben eine zweite, stärkere Fähigkeit zusätzlich zur ersten (`public/js/balls3.js`). Es gibt keine gemeinsamen Seltenheits-Effekte.
- Sterne: Duplikate verbessern einen Ball (+8 % Leben und Schaden je Stern, max. 5; Kosten in `boxes.js`, `UP_COST`).

## Kleinbox und Gefühlsbox (Mythisch)

- `public/js/balls7.js`: 15 neue Bälle (Kleinbox: Kleiner Stachel, Kleiner Helfer, Kleiner Explus, Kleiner Großer; Gefühlsbox: Fröhlich, Wütend, Gelassen, Verlegen, Ängstlich, Neugierig, Stolz, Neidisch, Liebend, Gefühlsball, Gefühlsherrscher). `TUNE` enthält die Stellschrauben für Explus und Herrscher.
- Neue Seltenheit **Mythisch** (Gewicht 0,5, Bots haben nie welche, im Kampf Auswahlgewicht 3).
- Dropper pro Box (`LAYOUTS` in `public/js/boxsim.js`): Gitter, Fangkörbe, Kanonen, Wind, Flummi.
- Balancing: `node tools/autotune7.js <ball>` sucht den dm-Faktor, `node tools/quick.js <ball>` zeigt die Siegquote, `node tools/boxstats.js` prüft die Dropper.

## Dropper-Editor

`/editor/dropper` (Datei `public/editor/dropper.html`): Am PC im Browser einen Dropper bauen. Werkzeuge für Nägel, Bumper, Flummi, Propeller, Wände, Bretter, Gitterablagen, Blöcke, Gitter, Fangkörbe, Kanonen und Wind. Die Statistik zeigt, wie oft ein Ball unten ankommt und wo Bälle hängen bleiben, die Vorschau nutzt die Spielgrafik. Export als JSON; eingebunden wird er über `DEFS_DROPPER` in `public/js/boxsim.js`.

## Ereignisboxen, Skins, Einzelspieler, Kampflog
- **Ereignisboxen** (`public/js/boxes.js`, Feld `until`): Halloween, Herbst (bis Sonntag), Sturm (7 Tage). Alle bezahlen mit Kürbissen. Mit `off: true` wird eine Box abgeschaltet (Brainrot).
- **Ball-Skins** (`public/js/skins.js`, `balls9.js`): Jeder Skin ist ein eigener handelbarer "Ball", wird im Kampf aber zum Grundball (`addBall`). Gewöhnlich: Farbe, Selten: Geschoss-Partikel, Episch: Leuchten, Legendär: neues Modell, Mythisch: eigene Geräusche. Truhen: `skin1` (Farbtruhe), `skin2` (Schatztruhe).
- **Dropper-Themen** (`public/js/dropskin.js`): eigene Optik je Box (Hintergrund, Nägel, Bumper, Brett, Kreisel, Becher, Wand).
- **Einzelspieler** (`/api/solo*`, `store.js`): tägliche Herausforderung und Bossrennen, Belohnung Münzen und eine Gratis-Standard-Box. Bosse haben `hpMul` und `hpFrac` in der Kampf-Konfiguration.
- **Kampflog** (`/api/log*`, Tabelle `battles`): die letzten 200 Kämpfe, Statistik, Wiederholung je Runde, öffentlicher Link `/#replay=TOKEN` (`GET /api/replay?t=TOKEN`).
