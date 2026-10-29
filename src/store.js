// Datenhaltung: Konten, Bälle, Ballboxen, Markt, Handel (SQLite im Durable Object).
// Alle Methoden sind synchron und damit atomar. Fehler werden als { err: 'code' } zurückgegeben.
import { DurableObject } from 'cloudflare:workers';
import { DEFS, BALL_IDS, BOSS_IDS, SKIN_IDS, RARITY, ballsInBox, MAX_STARS, runFight } from '../public/js/engine.js';
import { mulberry } from '../public/js/core.js';
import { BOX_BY_ID, BOX_RARITY, boxActive, eventActive, EVENT_END, UP_COST, SKINDROP, SHARDS_WIN } from '../public/js/boxes.js';
import { simBox, layoutOf } from '../public/js/boxsim.js';

const START_COINS = 300;     // genau drei Standard-Boxen für das Tutorial
const TUTORIAL_BALLS = ['stachel', 'feuer', 'bumerang'];   // die ersten drei Bälle im Tutorial, in dieser Reihenfolge
const MIN_FREE = 3;          // mindestens so viele verschiedene freie Sorten müssen bleiben
const MARKET_FEE = 0.05;
const DAY = 86400000;

function rnd() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
function pickWeighted(weights) {
  let sum = 0;
  for (const w of weights) sum += w;
  let r = rnd() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}
const RAR_KEYS = ['gewoehnlich', 'selten', 'episch', 'legendaer', 'mythisch'];
const DECOY_W = [40, 30, 20, 10, 1];
function randType(rarity, box) {
  let list = ballsInBox(box).filter(id => DEFS[id].rarity === rarity);
  if (!list.length) list = ballsInBox(box);
  return list[Math.floor(rnd() * list.length)];
}
function cleanName(n) {
  if (typeof n !== 'string') return null;
  n = n.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}_\- ]{3,16}$/u.test(n)) return null;
  return n;
}
function int(v, min, max) {
  v = Math.floor(Number(v));
  if (!Number.isFinite(v) || v < min || v > max) return null;
  return v;
}

export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.init());
  }
  q(sql, ...args) { return this.sql.exec(sql, ...args).toArray(); }
  init() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, name TEXT UNIQUE COLLATE NOCASE NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, last_daily INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
      boxes INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS balls(
      uid INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL, type TEXT NOT NULL,
      lock INTEGER NOT NULL DEFAULT 0, price INTEGER NOT NULL DEFAULT 0, listed_at INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS balls_owner ON balls(owner)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS balls_market ON balls(lock, price)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS trades(
      id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
      give TEXT NOT NULL, want TEXT NOT NULL, coins_give INTEGER NOT NULL DEFAULT 0, coins_want INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS trades_to ON trades(to_id, status)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS trades_from ON trades(from_id, status)');
    const cols = this.q('PRAGMA table_info(users)').map(c => c.name);
    const bcols = this.q('PRAGMA table_info(balls)').map(c => c.name);
    if (!bcols.includes('stars')) this.sql.exec('ALTER TABLE balls ADD COLUMN stars INTEGER NOT NULL DEFAULT 0');
    // Sterne gehören zur Sorte, nicht zum einzelnen Exemplar: alte Exemplar-Sterne auf die Sorte (höchster Wert) übertragen
    this.sql.exec('CREATE TABLE IF NOT EXISTS tstars(owner INTEGER NOT NULL, type TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner,type))');
    this.sql.exec('INSERT INTO tstars(owner,type,stars) SELECT owner,type,MAX(stars) FROM balls WHERE stars>0 GROUP BY owner,type ON CONFLICT(owner,type) DO UPDATE SET stars=MAX(stars,excluded.stars)');
    this.sql.exec('UPDATE balls SET stars=0 WHERE stars>0');
    this.sql.exec('CREATE TABLE IF NOT EXISTS transfers(code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS battles(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, ts INTEGER NOT NULL, sum TEXT NOT NULL, rec TEXT NOT NULL, share TEXT)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS battles_user ON battles(user_id, id)');
    if (!cols.includes('free_boxes')) this.sql.exec('ALTER TABLE users ADD COLUMN free_boxes INTEGER NOT NULL DEFAULT 0');
    this.sql.exec('CREATE TABLE IF NOT EXISTS equip(owner INTEGER NOT NULL, type TEXT NOT NULL, skin_uid INTEGER NOT NULL, PRIMARY KEY(owner,type))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS solo(user_id INTEGER NOT NULL, kind TEXT NOT NULL, day INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(user_id,kind))');
    if (!cols.includes('tokens')) this.sql.exec('ALTER TABLE users ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('shards')) this.sql.exec('ALTER TABLE users ADD COLUMN shards INTEGER NOT NULL DEFAULT 0');
  }

  /* ---------- Hilfen ---------- */
  userBy(tk) { return this.q('SELECT * FROM users WHERE token=?', tk)[0] || null; }
  userById(id) { return this.q('SELECT * FROM users WHERE id=?', id)[0] || null; }
  userByName(name) { return this.q('SELECT * FROM users WHERE name=?', name)[0] || null; }
  // Anzahl verschiedener Sorten unter den freien Bällen nach einer Änderung (drei verschiedene braucht jeder für die Auswahl)
  freeTypesAfter(id, remove, add) {
    const rm = new Set(remove || []), types = new Set();
    for (const b of this.q('SELECT uid,type FROM balls WHERE owner=? AND lock=0', id)) if (!rm.has(b.uid) && !DEFS[b.type].skin) types.add(b.type);
    for (const uid of add || []) { const b = this.q('SELECT type FROM balls WHERE uid=?', uid)[0]; if (b && !DEFS[b.type].skin) types.add(b.type); }
    return types.size;
  }
  levels(owner) {
    const lv = {};
    for (const r of this.q('SELECT type,stars FROM tstars WHERE owner=?', owner)) lv[r.type] = r.stars;
    // Skins haben die Sterne ihres Grundballs
    for (const r of this.q('SELECT DISTINCT type FROM balls WHERE owner=?', owner)) { const d = DEFS[r.type]; if (d && d.base) lv[r.type] = lv[d.base] || 0; }
    return lv;
  }
  freeCount(id) { return this.q('SELECT COUNT(*) c FROM balls WHERE owner=? AND lock=0', id)[0].c; }
  giveBall(owner, type) {
    const r = this.q('INSERT INTO balls(owner,type) VALUES(?,?) RETURNING uid', owner, type);
    return { uid: r[0].uid, type };
  }
  profile(u) {
    const lv = this.levels(u.id);
    const balls = this.q('SELECT uid,type,lock,price FROM balls WHERE owner=? ORDER BY uid', u.id).map(b => ({ ...b, stars: lv[b.type] || 0 }));
    const now = Date.now(), today = Math.floor(now / DAY);
    const live = eventActive(now);
    if (!live && u.tokens) this.q('UPDATE users SET tokens=0 WHERE id=?', u.id);
    return {
      id: u.id, name: u.name, coins: u.coins, tokens: live ? u.tokens : 0, shards: u.shards || 0, wins: u.wins, losses: u.losses, boxes: u.boxes, streak: u.streak,
      dailyReady: u.last_daily < today, freeBoxes: u.free_boxes || 0, equip: this.equipMap(u.id), balls, now, eventEnd: EVENT_END
    };
  }

  /* ---------- Konto ---------- */
  login(tk, name) {
    let u = this.userBy(tk);
    if (!u) {
      if (!name) return { err: 'need_name' };
      const nm = cleanName(name);
      if (!nm) return { err: 'name_invalid' };
      if (this.userByName(nm)) return { err: 'name_taken' };
      this.q('INSERT INTO users(token,name,coins,created) VALUES(?,?,?,?)', tk, nm, START_COINS, Date.now());
      u = this.userBy(tk);
    }
    return { ok: true, me: this.profile(u) };
  }
  me(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    return { ok: true, me: this.profile(u) };
  }
  auth(tk) {
    const u = this.userBy(tk);
    return u ? { id: u.id, name: u.name } : null;
  }
  rename(tk, name) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const nm = cleanName(name);
    if (!nm) return { err: 'name_invalid' };
    const other = this.userByName(nm);
    if (other && other.id !== u.id) return { err: 'name_taken' };
    this.q('UPDATE users SET name=? WHERE id=?', nm, u.id);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  // Konto endgültig löschen: Name zur Bestätigung eintippen. Offene Tausche werden geschlossen, Bälle und Marktangebote verschwinden.
  deleteAccount(tk, name) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    if (String(name || '').trim() !== u.name) return { err: 'confirm_name' };
    for (const t of this.q("SELECT * FROM trades WHERE status='pending' AND (from_id=? OR to_id=?)", u.id, u.id)) this.closeTrade(t, 'cancelled');
    this.q('DELETE FROM balls WHERE owner=?', u.id);
    this.q('DELETE FROM tstars WHERE owner=?', u.id);
    this.q('DELETE FROM users WHERE id=?', u.id);
    return { ok: true };
  }
  // Spielstand auf ein anderes Gerät: Das alte Gerät erzeugt einen Code (10 Minuten gültig, einmalig). Das neue Gerät löst ihn ein und übernimmt das Konto, das alte Gerät wird dabei abgemeldet.
  transferCreate(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', now = Date.now();
    this.q('DELETE FROM transfers WHERE user_id=? OR expires<?', u.id, now);
    let code;
    do { code = ''; const r = crypto.getRandomValues(new Uint8Array(8)); for (const x of r) code += A[x % A.length]; } while (this.q('SELECT 1 FROM transfers WHERE code=?', code).length);
    this.q('INSERT INTO transfers(code,user_id,expires) VALUES(?,?,?)', code, u.id, now + 10 * 60 * 1000);
    return { ok: true, code, secs: 600 };
  }
  transferRedeem(tk, code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const t = this.q('SELECT * FROM transfers WHERE code=?', code)[0];
    if (!t || t.expires < Date.now()) return { err: 'code_bad' };
    const a = this.userById(t.user_id);
    if (!a) return { err: 'code_bad' };
    const b = this.userBy(tk);
    if (b && b.id === a.id) { this.q('DELETE FROM transfers WHERE code=?', code); return { ok: true, me: this.profile(a) }; }
    // Hat dieses Gerät schon ein Konto mit Fortschritt, wird es nicht überschrieben
    if (b) {
      if (b.wins + b.losses + b.boxes > 0) return { err: 'has_progress' };
      for (const x of this.q("SELECT * FROM trades WHERE status='pending' AND (from_id=? OR to_id=?)", b.id, b.id)) this.closeTrade(x, 'cancelled');
      this.q('DELETE FROM balls WHERE owner=?', b.id);
      this.q('DELETE FROM tstars WHERE owner=?', b.id);
      this.q('DELETE FROM users WHERE id=?', b.id);
    }
    this.q('UPDATE users SET token=? WHERE id=?', tk, a.id);
    this.q('DELETE FROM transfers WHERE user_id=?', a.id);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  daily(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const today = Math.floor(Date.now() / DAY);
    if (u.last_daily >= today) return { err: 'daily_taken' };
    const streak = u.last_daily === today - 1 ? u.streak + 1 : 1;
    const gain = 50 + 10 * Math.min(streak - 1, 5);
    const tk5 = eventActive(Date.now()) ? 5 : 0;
    this.q('UPDATE users SET coins=coins+?, tokens=tokens+?, last_daily=?, streak=? WHERE id=?', gain, tk5, today, streak, u.id);
    return { ok: true, gain, tokens: tk5, streak, me: this.profile(this.userBy(tk)) };
  }
  /* ---------- Einzelspieler: Tägliche Herausforderung und Bossrennen ---------- */
  soloDefs(day) {
    const r = mulberry((day * 2654435761) >>> 0), pool = BALL_IDS.filter(id => DEFS[id].rarity !== 'mythisch' && !DEFS[id].noSolo);
    const w = { gewoehnlich: 3, selten: 3, episch: 2, legendaer: 1 }, wp = pool.map(id => w[DEFS[id].rarity] || 1), tot = wp.reduce((a, b) => a + b, 0);
    let x = r() * tot, opp = pool[0]; for (let i = 0; i < pool.length; i++) { x -= wp[i]; if (x <= 0) { opp = pool[i]; break; } }
    const rules = [{ id: 'any', text: 'Beliebiger Ball' }, { id: 'low', text: 'Nur gewöhnliche und seltene Bälle' }, { id: 'nostar', text: 'Nur Bälle ohne Sterne' }];
    const bpool = BOSS_IDS, boss = bpool[Math.floor(r() * bpool.length)];
    return { daily: { opp, oppStars: day % 3, rule: rules[day % 3] }, boss: { type: boss, hpMul: DEFS[boss].bossHp, stars: 2 } };
  }
  // Gleicher Start für alle: Seed und Startwinkel hängen nur vom Tag (und beim Boss vom Versuch) ab
  soloSeed(day, salt) { const r = mulberry(((day * 7919 + salt * 104729) ^ 0x9e3779b9) >>> 0); return { seed: Math.floor(r() * 2000000000) + 1, d0: Math.round(r() * 3600) / 10, d1: Math.round(r() * 3600) / 10 }; }
  soloGet(userId, kind, day) {
    const r = this.q('SELECT day,data FROM solo WHERE user_id=? AND kind=?', userId, kind)[0];
    return r && r.day === day ? JSON.parse(r.data) : null;
  }
  soloPut(userId, kind, day, data) { this.q('INSERT INTO solo(user_id,kind,day,data) VALUES(?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET day=excluded.day, data=excluded.data', userId, kind, day, JSON.stringify(data)); }
  soloState(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const day = Math.floor(Date.now() / DAY), d = this.soloDefs(day);
    const dd = this.soloGet(u.id, 'daily', day) || { claimed: false, tries: 0 }, bb = this.soloGet(u.id, 'boss', day) || { claimed: false, frac: 1, used: [], runs: 0 };
    return { ok: true, day, daily: Object.assign({}, d.daily, dd), boss: Object.assign({}, d.boss, bb) };
  }
  soloBall(u, uid) {
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id) return { err: 'not_yours' };
    if (b.lock !== 0) return { err: 'locked' };
    if (DEFS[b.type].skin) return { err: 'no_skin_fight' };
    return { ball: b, stars: this.levels(u.id)[b.type] || 0 };
  }
  soloDaily(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const day = Math.floor(Date.now() / DAY), d = this.soloDefs(day).daily, st = this.soloGet(u.id, 'daily', day) || { claimed: false, tries: 0 };
    const sb = this.soloBall(u, uid); if (sb.err) return sb;
    const rar = DEFS[sb.ball.type].rarity;
    if (d.rule.id === 'low' && !['gewoehnlich', 'selten'].includes(rar)) return { err: 'rule' };
    if (d.rule.id === 'nostar' && sb.stars > 0) return { err: 'rule' };
    const sd = this.soloSeed(day, 1), cfg = { seed: sd.seed, total: 2, balls: [{ slot: 0, type: sb.ball.type, team: 0, deg: sd.d0, stars: sb.stars, skin: this.equipMap(u.id)[sb.ball.type] }, { slot: 1, type: d.opp, team: 1, deg: sd.d1, stars: d.oppStars }] };
    const res = runFight(cfg), win = res.winner === 0;
    st.tries++;
    let reward = null;
    if (win && !st.claimed) { st.claimed = true; reward = { coins: 100, freeBox: 1 }; this.q('UPDATE users SET coins=coins+?, free_boxes=free_boxes+? WHERE id=?', 100, 1, u.id); }
    this.soloPut(u.id, 'daily', day, st);
    return { ok: true, cfg, steps: res.steps, winner: res.winner, reward, state: this.soloState(tk) , me: this.profile(this.userBy(tk)) };
  }
  soloBoss(tk, uid, reset) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const day = Math.floor(Date.now() / DAY), d = this.soloDefs(day).boss;
    let st = this.soloGet(u.id, 'boss', day) || { claimed: false, frac: 1, used: [], runs: 0 };
    if (reset) { st.frac = 1; st.used = []; st.runs++; this.soloPut(u.id, 'boss', day, st); return { ok: true, state: this.soloState(tk) }; }
    if (st.used.length >= 3 || st.frac <= 0) return { err: 'boss_done' };
    const sb = this.soloBall(u, uid); if (sb.err) return sb;
    if (st.used.includes(Number(uid)) || st.used.some(x => { const o = this.q('SELECT type FROM balls WHERE uid=?', x)[0]; return o && o.type === sb.ball.type; })) return { err: 'boss_used' };
    const sd = this.soloSeed(day, 2 + st.used.length), cfg = { seed: sd.seed, total: 2, balls: [{ slot: 0, type: sb.ball.type, team: 0, deg: sd.d0, stars: sb.stars, skin: this.equipMap(u.id)[sb.ball.type] }, { slot: 1, type: d.type, team: 1, deg: sd.d1, stars: d.stars, hpMul: d.hpMul, hpFrac: st.frac }] };
    const res = runFight(cfg), win = res.winner === 0;
    st.used.push(Number(uid)); st.frac = win ? 0 : Math.max(.02, res.frac[1] || .02);
    let reward = null;
    if (win && !st.claimed) { st.claimed = true; reward = { coins: 150, freeBox: 1 }; this.q('UPDATE users SET coins=coins+?, free_boxes=free_boxes+? WHERE id=?', 150, 1, u.id); }
    this.soloPut(u.id, 'boss', day, st);
    return { ok: true, cfg, steps: res.steps, winner: res.winner, reward, state: this.soloState(tk), me: this.profile(this.userBy(tk)) };
  }
  /* ---------- Skins: Gegenstände, die man einem Ball (nach Sorte) zuweist ---------- */
  equipMap(owner) {
    const m = {};
    for (const r of this.q('SELECT e.type AS type, b.type AS skin FROM equip e JOIN balls b ON b.uid=e.skin_uid WHERE e.owner=? AND b.owner=? AND b.lock=0', owner, owner)) { const d = DEFS[r.skin]; if (d && d.base === r.type) m[r.type] = r.skin; }
    return m;
  }
  skinEquip(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id) return { err: 'not_yours' };
    const d = DEFS[b.type];
    if (!d || !d.skin) return { err: 'no_skin' };
    if (b.lock !== 0) return { err: 'locked' };
    if (!this.q('SELECT 1 FROM balls WHERE owner=? AND type=?', u.id, d.base).length) return { err: 'no_base' };
    this.q('INSERT INTO equip(owner,type,skin_uid) VALUES(?,?,?) ON CONFLICT(owner,type) DO UPDATE SET skin_uid=excluded.skin_uid', u.id, d.base, b.uid);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  skinUnequip(tk, type) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    this.q('DELETE FROM equip WHERE owner=? AND type=?', u.id, String(type));
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  /* ---------- Kampflog: alle vergangenen Spiele, Wiederholung und Teilen ---------- */
  logBattle(userId, rec) {
    try {
      const me = rec.players.find(p => p.slot === rec.you);
      const myTeam = me ? me.team : 0;
      const mine = [], res = [];
      for (const r of rec.rounds) {
        const b = r.cfg.balls.find(x => x.slot === rec.you);
        mine.push(b ? b.type : '');
        res.push(rec.ffa ? ((r.losers || []).length ? ((r.losers || []).includes(myTeam) ? -1 : 1) : 0) : r.winner < 0 ? 0 : r.winner === myTeam ? 1 : -1);
      }
      const sum = { mode: rec.mode, n: rec.n, ffa: !!rec.ffa, friendly: !!rec.friendly, win: !!rec.win, place: rec.place || 0, opp: rec.players.filter(p => p.slot !== rec.you).map(p => (p.bot ? p.name + ' (Bot)' : p.name)), mine, res };
      const ts = Date.now();
      this.q('INSERT INTO battles(user_id,ts,sum,rec) VALUES(?,?,?,?)', userId, ts, JSON.stringify(sum), JSON.stringify({ ts, mode: rec.mode, n: rec.n, ffa: !!rec.ffa, friendly: !!rec.friendly, win: !!rec.win, place: rec.place || 0, you: rec.you, players: rec.players, rounds: rec.rounds }));
      this.q('DELETE FROM battles WHERE user_id=? AND id NOT IN (SELECT id FROM battles WHERE user_id=? ORDER BY id DESC LIMIT 200)', userId, userId);
    } catch (e) { console.log('logBattle', e); }
  }
  logList(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const rows = this.q('SELECT id,ts,sum,share FROM battles WHERE user_id=? ORDER BY id DESC LIMIT 100', u.id);
    return { ok: true, items: rows.map(r => Object.assign({ id: r.id, ts: r.ts, shared: !!r.share }, JSON.parse(r.sum))) };
  }
  logGet(tk, id) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const r = this.q('SELECT rec,share FROM battles WHERE id=? AND user_id=?', Number(id), u.id)[0];
    if (!r) return { err: 'not_found' };
    return { ok: true, rec: JSON.parse(r.rec), share: r.share };
  }
  logShare(tk, id) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const r = this.q('SELECT id,share FROM battles WHERE id=? AND user_id=?', Number(id), u.id)[0];
    if (!r) return { err: 'not_found' };
    let t = r.share;
    if (!t) { const a = crypto.getRandomValues(new Uint8Array(9)); t = ''; for (const x of a) t += 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]; this.q('UPDATE battles SET share=? WHERE id=?', t, r.id); }
    return { ok: true, token: t };
  }
  replayGet(token) {
    if (typeof token !== 'string' || token.length < 6 || token.length > 20) return { err: 'not_found' };
    const r = this.q('SELECT rec FROM battles WHERE share=?', token)[0];
    if (!r) return { err: 'not_found' };
    return { ok: true, rec: JSON.parse(r.rec) };
  }
  testCoins(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    this.q('UPDATE users SET coins=999999, tokens=999999, shards=999999 WHERE id=?', u.id);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  // Skindrop: kostet Skin-Splitter. Vier Klicks, jeder steigt mit Chance p eine Seltenheit auf (Start gewöhnlich); am Ende kommt ein zufälliger Skin dieser Seltenheit
  openSkinDrop(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    if ((u.shards || 0) < SKINDROP.price) return { err: 'no_shards' };
    const steps = []; let lv = 0;
    for (let i = 0; i < SKINDROP.clicks; i++) { const up = lv < 4 && Math.random() < SKINDROP.q[lv]; if (up) lv++; steps.push(up); }
    const rar = ['gewoehnlich', 'selten', 'episch', 'legendaer', 'mythisch'][lv], pool = SKIN_IDS.filter(id => DEFS[id].rarity === rar);
    const id = pool[Math.floor(Math.random() * pool.length)];
    this.q('UPDATE users SET shards=shards-? WHERE id=?', SKINDROP.price, u.id);
    const ball = this.giveBall(u.id, id);
    return { ok: true, steps, level: lv, rarity: rar, ball, me: this.profile(this.userBy(tk)) };
  }
  upgrade(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id) return { err: 'not_yours' };
    if (b.lock !== 0) return { err: 'locked' };
    if (DEFS[b.type] && DEFS[b.type].base) return { err: 'skin_noup' };   // Skins haben die Sterne ihres Grundballs
    const stars = this.levels(u.id)[b.type] || 0;
    if (stars >= MAX_STARS) return { err: 'max_stars' };
    const cost = UP_COST[DEFS[b.type].rarity][stars];
    const fod = this.q('SELECT uid FROM balls WHERE owner=? AND type=? AND lock=0 AND uid<>? ORDER BY uid DESC LIMIT ?', u.id, b.type, b.uid, cost);
    if (fod.length < cost) return { err: 'need_dupes' };
    if (this.freeTypesAfter(u.id, fod.map(f => f.uid), []) < MIN_FREE) return { err: 'min_balls' };
    for (const f of fod) this.q('DELETE FROM balls WHERE uid=?', f.uid);
    this.q('INSERT INTO tstars(owner,type,stars) VALUES(?,?,?) ON CONFLICT(owner,type) DO UPDATE SET stars=excluded.stars', u.id, b.type, stars + 1);
    return { ok: true, uid: b.uid, stars: stars + 1, cost, me: this.profile(this.userBy(tk)) };
  }
  // Alles verbessern: jede Sorte so weit wie möglich; ein Exemplar bleibt immer übrig, nur freie Duplikate werden verbraucht
  upgradeAll(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const lv = this.levels(u.id);
    let steps = 0, used = 0;
    const types = [...new Set(this.q('SELECT type FROM balls WHERE owner=? AND lock=0', u.id).map(b => b.type))];
    for (const type of types) {
      if (DEFS[type].base) continue;   // Skins haben die Sterne ihres Grundballs
      let stars = lv[type] || 0;
      const free = this.q('SELECT uid FROM balls WHERE owner=? AND type=? AND lock=0 ORDER BY uid', u.id, type).map(b => b.uid);
      let avail = free.length - 1;   // das erste Exemplar bleibt
      const start = stars;
      while (stars < MAX_STARS) {
        const cost = UP_COST[DEFS[type].rarity][stars];
        if (avail < cost) break;
        for (let i = 0; i < cost; i++) this.q('DELETE FROM balls WHERE uid=?', free.pop());
        avail -= cost; used += cost; stars++; steps++;
      }
      if (stars > start) this.q('INSERT INTO tstars(owner,type,stars) VALUES(?,?,?) ON CONFLICT(owner,type) DO UPDATE SET stars=excluded.stars', u.id, type, stars);
    }
    if (!steps) return { err: 'need_dupes' };
    return { ok: true, steps, used, me: this.profile(this.userBy(tk)) };
  }
  inventory(userId) {
    const lv = this.levels(userId), eq = this.equipMap(userId);
    return this.q('SELECT uid,type FROM balls WHERE owner=? AND lock=0', userId).filter(b => !DEFS[b.type].skin).map(b => ({ ...b, stars: lv[b.type] || 0, ...(eq[b.type] ? { skin: eq[b.type] } : {}) }));
  }
  reward(userId, coins, win, tokens) {
    const tk = eventActive(Date.now()) ? (tokens || 0) : 0;
    this.q('UPDATE users SET coins=coins+?, tokens=tokens+?, shards=shards+?, wins=wins+?, losses=losses+? WHERE id=?', coins, tk, win ? SHARDS_WIN : 0, win ? 1 : 0, win ? 0 : 1, userId);
    return tk;
  }

  /* ---------- Ballbox ---------- */
  openBox(tk, boxId) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const cfg = BOX_BY_ID[boxId];
    if (!cfg) return { err: 'box_unknown' };
    if (!boxActive(boxId, Date.now())) return { err: 'box_over' };
    const useFree = boxId === 'standard' && u.free_boxes > 0;   // kostenlose Standard-Box (Belohnung der Einzelspieler-Modi)
    const have = cfg.cur === 'tokens' ? u.tokens : u.coins;
    if (!useFree && have < cfg.price) return { err: cfg.cur === 'tokens' ? 'no_tokens' : 'no_coins' };
    // Tutorial: wer noch keine drei Bälle hat, öffnet nur Standard-Boxen und bekommt nacheinander Stachel, Feuer und Bumerang
    const owned = new Set(this.q('SELECT type FROM balls WHERE owner=?', u.id).map(x => x.type).filter(t => !DEFS[t].skin));
    const tutorial = owned.size < MIN_FREE;
    if (tutorial && boxId !== 'standard') return { err: 'tutorial_box' };
    const present = RAR_KEYS.map(k => ballsInBox(boxId).some(id => DEFS[id].rarity === k));   // nur Seltenheiten, die diese Box wirklich hat
    let rIdx = pickWeighted(RAR_KEYS.map((k, i) => present[i] ? ((BOX_RARITY[boxId] || {})[k] ?? RARITY[k].weight) : 0)), reward;
    if (tutorial) {
      rIdx = 0;
      reward = TUTORIAL_BALLS.find(t => !owned.has(t));
    } else reward = randType(RAR_KEYS[rIdx], boxId);
    // Mitspieler in der Schüssel: auch mal seltene, damit man "knapp daneben" erlebt
    const decoyRar = () => RAR_KEYS[pickWeighted(DECOY_W.map((w, i) => present[i] ? w : 0))];
    // Keine zwei gleichen Bälle in der Schüssel (soweit die Box genug verschiedene hat), nie Bälle aus anderen Boxen
    const used = new Set([reward]), cands = [];
    for (let i = 0; i < 10; i++) {
      let t;
      for (let tr = 0; tr < 60; tr++) { t = randType(decoyRar(), boxId); if (!used.has(t)) break; }
      if (used.has(t)) {   // kleine Theme-Box: lieber Bälle der Box doppelt nehmen als fremde Bälle aus anderen Boxen
        const own = ballsInBox(boxId), rest = own.filter(x => !used.has(x)), alt = own.filter(x => x !== reward);
        const from = rest.length ? rest : alt.length ? alt : own;
        t = from[Math.floor(rnd() * from.length)];
      }
      cands.push(t); used.add(t);
    }
    const winIdx = Math.floor(rnd() * 10);
    cands[winIdx] = reward;
    // Bait: ein besserer Ball soll knapp Zweiter oder Dritter werden
    let baitIdx = -1;
    if (rIdx < RAR_KEYS.length - 1 && rnd() < .7) {
      const higher = RAR_KEYS.slice(rIdx + 1).filter(k => present[RAR_KEYS.indexOf(k)]);
      const w = higher.map((k, i) => i === 0 ? 55 : 30 / i);
      let bt;
      for (let tr = 0; tr < 60; tr++) { bt = randType(higher[pickWeighted(w)], boxId); if (!cands.includes(bt) || tr === 59) break; }
      do { baitIdx = Math.floor(rnd() * 10); } while (baitIdx === winIdx);
      const dup = cands.indexOf(bt);
      if (dup >= 0 && dup !== baitIdx && dup !== winIdx) cands[dup] = cands[baitIdx];
      cands[baitIdx] = bt;
    }
    let seed = -1;
    const base = Math.floor(rnd() * 2000000000);
    for (let k = 0; k < 900 && seed < 0; k++) {
      const s = (base + k * 7919) % 2147483647;
      const r = simBox(s, 10, layoutOf(boxId));
      if (r.reached < 1 || r.order[0] !== winIdx || r.times[0] > 13) continue;   // der Gewinner soll nicht ewig brauchen
      if (baitIdx >= 0 && k < 600 && r.order[1] !== baitIdx && r.order[2] !== baitIdx) continue;
      seed = s;
    }
    if (seed < 0) {
      for (let k = 0; k < 5000 && seed < 0; k++) {
        const s = (base + 913 + k * 104729) % 2147483647;
        const r2 = simBox(s, 10, layoutOf(boxId));
        if (r2.reached > 0 && r2.order[0] === winIdx) seed = s;
      }
    }
    if (useFree) this.q('UPDATE users SET free_boxes=free_boxes-1, boxes=boxes+1 WHERE id=?', u.id);
    else if (cfg.cur === 'tokens') this.q('UPDATE users SET tokens=tokens-?, boxes=boxes+1 WHERE id=?', cfg.price, u.id);
    else this.q('UPDATE users SET coins=coins-?, boxes=boxes+1 WHERE id=?', cfg.price, u.id);
    const ball = this.giveBall(u.id, reward);
    return { ok: true, box: boxId, seed, cands, win: winIdx, ball, rarity: DEFS[reward].rarity, me: this.profile(this.userBy(tk)) };
  }

  /* ---------- Markt ---------- */
  marketList(tk, uid, price) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const p = int(price, 10, 100000);
    if (p === null) return { err: 'price_invalid' };
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id) return { err: 'not_yours' };
    if (b.lock !== 0) return { err: 'locked' };
    if (this.freeTypesAfter(u.id, [b.uid], []) < MIN_FREE) return { err: 'min_balls' };
    this.q('UPDATE balls SET lock=1, price=?, listed_at=? WHERE uid=?', p, Date.now(), b.uid);
    return { ok: true, me: this.profile(u) };
  }
  marketCancel(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id || b.lock !== 1) return { err: 'not_yours' };
    this.q('UPDATE balls SET lock=0, price=0 WHERE uid=?', b.uid);
    return { ok: true, me: this.profile(u) };
  }
  marketBuy(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const b = this.q('SELECT * FROM balls WHERE uid=? AND lock=1', Number(uid))[0];
    if (!b) return { err: 'gone' };
    if (b.owner === u.id) return { err: 'own' };
    if (u.coins < b.price) return { err: 'no_coins' };
    const fee = Math.max(1, Math.floor(b.price * MARKET_FEE));
    this.q('UPDATE users SET coins=coins-? WHERE id=?', b.price, u.id);
    this.q('UPDATE users SET coins=coins+? WHERE id=?', b.price - fee, b.owner);
    this.q('UPDATE balls SET owner=?, lock=0, price=0 WHERE uid=?', u.id, b.uid);
    return { ok: true, type: b.type, me: this.profile(this.userBy(tk)) };
  }
  marketBrowse(tk, o) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    let types = Object.keys(DEFS).filter(t => !DEFS[t].boss);   // Bälle und Skins
    if (o.rarity && RARITY[o.rarity]) types = types.filter(t => DEFS[t].rarity === o.rarity);
    if (o.q) {
      const needle = String(o.q).toLowerCase().slice(0, 20);
      types = types.filter(t => DEFS[t].name.toLowerCase().includes(needle));
    }
    if (!types.length) return { ok: true, items: [], total: 0 };
    // SQLite erlaubt höchstens 100 Platzhalter: bei vielen Sorten lieber die ausgeschlossenen Sorten angeben
    let cond, args;
    if (types.length > 80) { const ex = Object.keys(DEFS).filter(t => !types.includes(t) && !DEFS[t].boss); cond = ex.length ? 'b.type NOT IN (' + ex.map(() => '?').join(',') + ')' : '1=1'; args = ex; }
    else { cond = 'b.type IN (' + types.map(() => '?').join(',') + ')'; args = types; }
    const order = o.sort === 'new' ? 'b.listed_at DESC' : o.sort === 'high' ? 'b.price DESC' : 'b.price ASC, b.listed_at DESC';
    const page = Math.max(0, int(o.page || 0, 0, 1000) || 0);
    const items = this.q(`SELECT b.uid,b.type,b.stars,b.price,b.owner,u.name seller FROM balls b JOIN users u ON u.id=b.owner
      WHERE b.lock=1 AND ${cond} ORDER BY ${order} LIMIT 40 OFFSET ?`, ...args, page * 40);
    const total = this.q(`SELECT COUNT(*) c FROM balls b WHERE b.lock=1 AND ${cond}`, ...args)[0].c;
    return { ok: true, items: items.map(i => ({ uid: i.uid, type: i.type, stars: i.stars, price: i.price, seller: i.seller, mine: i.owner === u.id })), total };
  }

  /* ---------- Handel ---------- */
  playerInfo(tk, name) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const p = this.userByName(String(name || '').trim());
    if (!p) return { err: 'no_player' };
    // Bälle, die du selbst nicht besitzt (nicht entdeckt hast), bleiben für dich verdeckt
    const known = this.knownTypes(u.id);
    const balls = this.q('SELECT uid,type,stars FROM balls WHERE owner=? AND lock=0 ORDER BY uid', p.id).map(b => known.has(b.type) ? b : { uid: b.uid, type: null, stars: 0 });
    return { ok: true, player: { name: p.name, wins: p.wins, losses: p.losses, balls }, self: p.id === u.id };
  }
  knownTypes(userId) { return new Set(this.q('SELECT DISTINCT type FROM balls WHERE owner=?', userId).map(r => r.type)); }
  tradeView(t, meId, known) {
    const ids = s => JSON.parse(s);
    known = known || this.knownTypes(meId);
    const bt = list => list.map(uid => { const b = this.q('SELECT uid,type,stars FROM balls WHERE uid=?', uid)[0]; return b && known.has(b.type) ? b : { uid, type: null, stars: 0 }; });
    const from = this.userById(t.from_id), to = this.userById(t.to_id);
    return {
      id: t.id, from: from ? from.name : '?', to: to ? to.name : '?', mine: t.from_id === meId,
      give: bt(ids(t.give)), want: bt(ids(t.want)), coinsGive: t.coins_give, coinsWant: t.coins_want,
      status: t.status, created: t.created
    };
  }
  trades(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const now = Date.now();
    for (const t of this.q("SELECT * FROM trades WHERE status='pending' AND created<?", now - 7 * DAY)) this.closeTrade(t, 'expired');
    const inc = this.q("SELECT * FROM trades WHERE to_id=? AND status='pending' ORDER BY id DESC", u.id);
    const out = this.q("SELECT * FROM trades WHERE from_id=? AND status='pending' ORDER BY id DESC", u.id);
    const hist = this.q("SELECT * FROM trades WHERE (from_id=? OR to_id=?) AND status!='pending' ORDER BY closed DESC LIMIT 12", u.id, u.id);
    const known = this.knownTypes(u.id);
    return {
      ok: true, incoming: inc.map(t => this.tradeView(t, u.id, known)), outgoing: out.map(t => this.tradeView(t, u.id, known)),
      history: hist.map(t => this.tradeView(t, u.id, known))
    };
  }
  closeTrade(t, status) {
    for (const uid of JSON.parse(t.give)) this.q('UPDATE balls SET lock=0 WHERE uid=? AND lock=2', uid);
    this.q('UPDATE trades SET status=?, closed=? WHERE id=?', status, Date.now(), t.id);
  }
  tradeCreate(tk, toName, give, want, coinsGive, coinsWant) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const to = this.userByName(String(toName || '').trim());
    if (!to) return { err: 'no_player' };
    if (to.id === u.id) return { err: 'self' };
    give = Array.isArray(give) ? [...new Set(give.map(Number))].slice(0, 8) : [];
    want = Array.isArray(want) ? [...new Set(want.map(Number))].slice(0, 8) : [];
    const cg = int(coinsGive || 0, 0, 1000000), cw = int(coinsWant || 0, 0, 1000000);
    if (cg === null || cw === null) return { err: 'price_invalid' };
    if (!give.length && !want.length && !cg && !cw) return { err: 'empty' };
    if (cg > u.coins) return { err: 'no_coins' };
    for (const uid of give) {
      const b = this.q('SELECT * FROM balls WHERE uid=?', uid)[0];
      if (!b || b.owner !== u.id || b.lock !== 0) return { err: 'not_yours' };
    }
    for (const uid of want) {
      const b = this.q('SELECT * FROM balls WHERE uid=?', uid)[0];
      if (!b || b.owner !== to.id || b.lock !== 0) return { err: 'not_theirs' };
    }
    if (this.freeTypesAfter(u.id, give, want) < MIN_FREE) return { err: 'min_balls' };
    const pend = this.q("SELECT COUNT(*) c FROM trades WHERE from_id=? AND status='pending'", u.id)[0].c;
    if (pend >= 10) return { err: 'too_many' };
    for (const uid of give) this.q('UPDATE balls SET lock=2 WHERE uid=?', uid);
    this.q('INSERT INTO trades(from_id,to_id,give,want,coins_give,coins_want,created) VALUES(?,?,?,?,?,?,?)',
      u.id, to.id, JSON.stringify(give), JSON.stringify(want), cg, cw, Date.now());
    return { ok: true };
  }
  tradeAnswer(tk, id, action) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const t = this.q('SELECT * FROM trades WHERE id=? AND status=?', Number(id), 'pending')[0];
    if (!t) return { err: 'gone' };
    if (action === 'cancel') {
      if (t.from_id !== u.id) return { err: 'not_yours' };
      this.closeTrade(t, 'cancelled');
      return { ok: true };
    }
    if (t.to_id !== u.id) return { err: 'not_yours' };
    if (action === 'decline') { this.closeTrade(t, 'declined'); return { ok: true }; }
    if (action !== 'accept') return { err: 'bad' };
    const from = this.userById(t.from_id);
    const give = JSON.parse(t.give), want = JSON.parse(t.want);
    for (const uid of give) {
      const b = this.q('SELECT * FROM balls WHERE uid=?', uid)[0];
      if (!b || b.owner !== from.id || b.lock !== 2) { this.closeTrade(t, 'cancelled'); return { err: 'gone' }; }
    }
    for (const uid of want) {
      const b = this.q('SELECT * FROM balls WHERE uid=?', uid)[0];
      if (!b || b.owner !== u.id || b.lock !== 0) return { err: 'not_yours' };
    }
    if (from.coins < t.coins_give) return { err: 'their_coins' };
    if (u.coins < t.coins_want) return { err: 'no_coins' };
    if (this.freeTypesAfter(u.id, want, give) < MIN_FREE) return { err: 'min_balls' };
    if (this.freeTypesAfter(from.id, [], want) < MIN_FREE) return { err: 'their_min' };
    for (const uid of give) this.q('UPDATE balls SET owner=?, lock=0, price=0 WHERE uid=?', u.id, uid);
    for (const uid of want) this.q('UPDATE balls SET owner=?, lock=0, price=0 WHERE uid=?', from.id, uid);
    this.q('UPDATE users SET coins=coins-?+? WHERE id=?', t.coins_give, t.coins_want, from.id);
    this.q('UPDATE users SET coins=coins+?-? WHERE id=?', t.coins_give, t.coins_want, u.id);
    this.q('UPDATE trades SET status=?, closed=? WHERE id=?', 'accepted', Date.now(), t.id);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
}
