# Ball gegen Ball

Handgezeichnetes Mobile-Browserspiel: Bälle sammeln, Ballboxen öffnen, online kämpfen, handeln.

## Aufbau
- `public/` - Client (statische Dateien, werden von Cloudflare ausgeliefert)
  - `js/core.js`, `balls.js`, `engine.js` - deterministische Kampf-Engine (läuft im Browser und auf dem Server identisch)
  - `js/boxsim.js` - Ballbox-Minispiel (deterministisch, der Server wählt den Seed)
  - `js/pen.js`, `art.js`, `render.js` - Zeichen-Engine, alle Grafiken, Arena
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
