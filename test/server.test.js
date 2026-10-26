// Integrationstest gegen "wrangler dev" (Port 8787): node test/server.test.js
const B = 'http://localhost:8787';
const tok = () => crypto.randomUUID() + crypto.randomUUID();
async function api(path, token, body) {
  const r = await fetch(B + path, { method: 'POST', headers: { 'x-token': token, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}
const ok = (c, m) => { if (!c) { console.log('FEHLER:', m); process.exitCode = 1; } else console.log('ok  ', m); };

// Tutorial: nach dem Anlegen drei Standard-Boxen öffnen (je ein neuer gewöhnlicher Ball)
async function start(t, name) {
  let x = await api('/api/login', t, { name });
  for (let i = 0; i < 3; i++) x = await api('/api/box', t, {});
  return x;
}
const t1 = tok(), t2 = tok();
const n1 = 'Tst' + Math.floor(Math.random() * 1e6), n2 = 'Tsu' + Math.floor(Math.random() * 1e6);
let r = await api('/api/login', t1, { name: n1 });
ok(r.ok && r.me.balls.length === 0 && r.me.coins === 300, 'Konto anlegen: 0 Bälle, 300 Münzen');
r = await api('/api/box', t1, { box: 'weltraum' });
ok(r.err === 'tutorial_box', 'Tutorial: nur Standard-Box erlaubt');
const tut = new Set(), { DEFS } = await import('../public/js/engine.js');
for (let i = 0; i < 3; i++) {
  r = await api('/api/box', t1, {});
  ok(r.ok && DEFS[r.ball.type].rarity === 'gewoehnlich' && !tut.has(r.ball.type), 'Tutorial-Box ' + (i + 1) + ': neuer gewöhnlicher Ball ' + (r.ball && r.ball.type));
  tut.add(r.ball.type);
  const { simBox } = await import('../public/js/boxsim.js');
  ok(simBox(r.seed, 10).order[0] === r.win, 'Box-Seed liefert den Gewinner auf Platz 1');
}
ok(r.me.coins === 0 && r.me.balls.length === 3, 'Tutorial fertig: 3 Bälle, 0 Münzen');
r = await api('/api/login', t2, { name: n1 });
ok(r.err === 'name_taken', 'Name doppelt abgelehnt');
r = await start(t2, n2);
ok(r.ok, 'zweites Konto');
r = await api('/api/daily', t1);
ok(r.ok && r.gain === 50, 'Tagesbelohnung 50');
r = await api('/api/daily', t1);
ok(r.err === 'daily_taken', 'Tagesbelohnung nur einmal');
r = await api('/api/box', t1, {});
ok(r.err === 'no_coins', 'Box: zu wenig Münzen');
await api('/api/testcoins', t1, { key: 'leif-test' });
r = await api('/api/box', t1, {});
ok(r.ok && r.me.balls.length === 4, 'vierter Ball für den Markttest');
let me = (await api('/api/me', t1)).me;
const b6 = me.balls[me.balls.length - 1];
const coins1 = me.coins;
r = await api('/api/market/list', t1, { uid: b6.uid, price: 40 });
ok(r.ok, 'Ball auf den Markt gestellt');
r = await api('/api/market/browse', t2, {});
ok(r.ok && r.items.some(i => i.uid === b6.uid), 'Zweiter Spieler sieht das Angebot');
await api('/api/daily', t2);
r = await api('/api/market/buy', t2, { uid: b6.uid });
ok(r.ok && r.me.coins === 10, 'gekauft: 50-40 Münzen');
me = (await api('/api/me', t1)).me;
ok(me.coins === coins1 + 38, 'Verkäufer bekommt 38 (5 % Gebühr): ' + me.coins);
// Handel
const p2 = (await api('/api/me', t2)).me;
r = await api('/api/trade/create', t1, { to: n2, give: [me.balls[0].uid], want: [p2.balls.find(b => !me.balls.some(m => m.type === b.type)).uid] });
ok(r.ok, 'Tauschangebot');
r = await api('/api/trades', t2);
ok(r.incoming.length === 1, 'Angebot kommt an');
r = await api('/api/trade/answer', t2, { id: r.incoming[0].id, action: 'accept' });
ok(r.ok, 'Tausch angenommen');
// Mindestanzahl
me = (await api('/api/me', t1)).me;
let free = me.balls.filter(b => b.lock === 0);
for (let i = 0; i < free.length - 3; i++) await api('/api/market/list', t1, { uid: free[i].uid, price: 999 });
r = await api('/api/market/list', t1, { uid: free[free.length - 1].uid, price: 999 });
ok(r.err === 'min_balls', 'mindestens 3 freie Bälle bleiben');

// Theme-Boxen und Halloween-Marken
{
  const { ballsInBox } = await import('../public/js/engine.js');
  const { EVENT_END } = await import('../public/js/boxes.js');
  const t3 = tok();
  let x = await start(t3, 'Tbx' + Math.floor(Math.random() * 1e6));
  x = await api('/api/box', t3, { box: 'gibtsnicht' });
  ok(x.err === 'box_unknown', 'unbekannte Box abgelehnt');
  x = await api('/api/box', t3, { box: 'halloween' });
  ok(x.err === 'no_tokens' || x.err === 'box_over', 'Halloween-Box ohne Marken: ' + x.err);
  x = await api('/api/daily', t3);
  const live = Date.now() < EVENT_END;
  ok(x.ok && x.me.tokens === (live ? 5 : 0), 'Tagesbelohnung gibt Halloween-Marken (Event ' + (live ? 'aktiv' : 'vorbei') + '): ' + x.me.tokens);
  if (live) { x = await api('/api/box', t3, { box: 'halloween' }); ok(x.err === 'no_tokens', 'Halloween-Box mit 5 Marken noch zu teuer'); }
  x = await api('/api/testcoins', t3, { key: 'leif-test' });
  x = await api('/api/box', t3, { box: 'weltraum' });
  ok(x.ok && x.me.coins === 999999 - 175 && x.box === 'weltraum' && ballsInBox('weltraum').includes(x.ball.type), 'Weltraum-Box: 175 Münzen, Ball aus der Box: ' + (x.ball && x.ball.type));
}
// Sterne
{
  const t = tok();
  let x = await start(t, 'Tst' + Math.floor(Math.random() * 1e6));
  x = await api('/api/testcoins', t, { key: 'leif-test' });
  let me = x.me, dup = null;
  for (let i = 0; i < 40 && !dup; i++) {
    x = await api('/api/box', t, { box: 'standard' }); me = x.me;
    const by = {}; for (const b of me.balls) (by[b.type] = by[b.type] || []).push(b);
    dup = Object.values(by).find(l => l.length >= 3) || null;
  }
  ok(!!dup, 'Duplikate durch Boxen bekommen');
  if (dup) {
    x = await api('/api/upgrade', t, { uid: dup[0].uid });
    ok(x.ok && x.stars === 1 && x.me.balls.length === me.balls.length - x.cost, 'Verbessern: 1 Stern, ' + x.cost + ' Duplikate verbraucht');
    const b = x.me.balls.find(q => q.uid === dup[0].uid);
    ok(b && b.stars === 1, 'Stern am Ball gespeichert');
    ok(x.me.balls.filter(q => q.type === b.type).every(q => q.stars === 1), 'Sterne gelten für alle Exemplare der Sorte');
    x = await api('/api/upgrade', t, { uid: 999999999 });
    ok(x.err === 'not_yours', 'fremder Ball nicht verbesserbar');
  }
}
// Boxen: keine doppelten Bälle in der Schüssel
{
  const { ballsInBox } = await import('../public/js/engine.js');
  const t = tok(); let x = await start(t, 'Tdp' + Math.floor(Math.random() * 1e6));
  await api('/api/testcoins', t, { key: 'leif-test' });
  let dups = 0;
  for (let i = 0; i < 25; i++) { x = await api('/api/box', t, { box: ['standard', 'weltraum', 'kueche', 'sport', 'elemente'][i % 5] }); if (x.box === 'standard' && new Set(x.cands).size !== 10) dups++; if (x.cands.some(c => !ballsInBox(x.box).includes(c))) dups++; if (x.cands[x.win] !== x.ball.type) dups++; }
  ok(dups === 0, 'Ballbox: 10 verschiedene Bälle, Gewinner stimmt (Fehler: ' + dups + ')');
}
// Botkampf
function connect(token) {
  return new Promise(res => {
    const ws = new WebSocket('ws://localhost:8787/api/ws');
    const msgs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); msgs.push(m); ws._h && ws._h(m); };
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', token })); res(ws); };
    ws.msgs = msgs;
  });
}
const { runFight } = await import('../public/js/engine.js');
const ws = await connect(t1);
let rounds = 0, end = null, t0 = Date.now(), fightOk = true;
ws._h = m => {
  if (m.t === 'queued') console.log('  in Warteschlange');
  if (m.t === 'pick_phase') ws.send(JSON.stringify({ t: 'pick', uid: m.hand[0].uid }));
  if (m.t === 'reveal') ws.send(JSON.stringify({ t: 'dir', deg: 33 }));
  if (m.t === 'fight') {
    rounds++;
    const rr = runFight(m.cfg);
    if (rr.winner !== m.winner || rr.steps !== m.steps) fightOk = false;
    ws.send(JSON.stringify({ t: 'ready' }));
  }
  if (m.t === 'match_end') end = m;
};
await new Promise(r => setTimeout(r, 300));
const before = (await api('/api/me', t1)).me.coins;
ws.send(JSON.stringify({ t: 'queue', mode: 1 }));
while (!end && Date.now() - t0 < 120000) await new Promise(r => setTimeout(r, 200));
ok(!!end, 'Match nach ' + Math.round((Date.now() - t0) / 1000) + ' s beendet (' + rounds + ' Runden, Bot-Fill ca. 15 s)');
ok(fightOk, 'Client-Simulation stimmt mit Server-Ergebnis überein');
if (end) {
  const after = (await api('/api/me', t1)).me.coins;
  ok(after - before === end.coins && end.coins === (end.win ? 20 : 3), 'Belohnung gebucht: ' + end.coins);
}
process.exit(process.exitCode || 0);
