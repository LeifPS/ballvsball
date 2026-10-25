# Ball gegen Ball

Handgezeichnetes Mobile-Browserspiel: Bälle sammeln, Ballboxen öffnen, online kämpfen, handeln.

## Aufbau
- `public/` - Client (statische Dateien, werden von Cloudflare ausgeliefert)
  - `js/core.js`, `balls.js`, `balls2.js`, `engine.js` - deterministische Kampf-Engine (läuft im Browser und auf dem Server identisch)
  - `js/boxsim.js` - Ballbox-Minispiel (deterministisch, der Server wählt den Seed)
  - `js/boxes.js` - Ballboxen (Preise, Halloween-Zeitfenster bis 31.10.)
  - `js/sk.js`, `ballart.js`, `art.js`, `render.js` - Handzeichen-Stil (wie Tonlinge), Bälle, Effekte, Arena
  - `js/audio.js` - Sound und Musik (WebAudio-Synthesizer)
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
- Selten: Schild (18 % Leben). Episch: Wut unter 50 % Leben. Legendär: Ultimative Fähigkeit unter 45 % Leben (siehe `perkStep` in `balls.js`).
- Sterne: Duplikate verbessern einen Ball (+8 % Leben und Schaden je Stern, max. 5; Kosten in `boxes.js`, `UP_COST`).
