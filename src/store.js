// Datenhaltung: Konten, Bälle, Ballboxen, Markt, Handel (SQLite im Durable Object).
// Alle Methoden sind synchron und damit atomar. Fehler werden als { err: 'code' } zurückgegeben.
import { DurableObject } from 'cloudflare:workers';
import { DEFS, BALL_IDS, RARITY, ballsInBox, MAX_STARS } from '../public/js/engine.js';
import { BOX_BY_ID, boxActive, eventActive, EVENT_END, UP_COST } from '../public/js/boxes.js';
import { simBox } from '../public/js/boxsim.js';

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
const RAR_KEYS = ['gewoehnlich', 'selten', 'episch', 'legendaer'];
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
    if (!cols.includes('tokens')) this.sql.exec('ALTER TABLE users ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0');
  }

  /* ---------- Hilfen ---------- */
  userBy(tk) { return this.q('SELECT * FROM users WHERE token=?', tk)[0] || null; }
  userById(id) { return this.q('SELECT * FROM users WHERE id=?', id)[0] || null; }
  userByName(name) { return this.q('SELECT * FROM users WHERE name=?', name)[0] || null; }
  // Anzahl verschiedener Sorten unter den freien Bällen nach einer Änderung (drei verschiedene braucht jeder für die Auswahl)
  freeTypesAfter(id, remove, add) {
    const rm = new Set(remove || []), types = new Set();
    for (const b of this.q('SELECT uid,type FROM balls WHERE owner=? AND lock=0', id)) if (!rm.has(b.uid)) types.add(b.type);
    for (const uid of add || []) { const b = this.q('SELECT type FROM balls WHERE uid=?', uid)[0]; if (b) types.add(b.type); }
    return types.size;
  }
  levels(owner) {
    const lv = {};
    for (const r of this.q('SELECT type,stars FROM tstars WHERE owner=?', owner)) lv[r.type] = r.stars;
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
      id: u.id, name: u.name, coins: u.coins, tokens: live ? u.tokens : 0, wins: u.wins, losses: u.losses, boxes: u.boxes, streak: u.streak,
      dailyReady: u.last_daily < today, balls, now, eventEnd: EVENT_END
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
  testCoins(tk) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    this.q('UPDATE users SET coins=999999, tokens=999999 WHERE id=?', u.id);
    return { ok: true, me: this.profile(this.userBy(tk)) };
  }
  upgrade(tk, uid) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const b = this.q('SELECT * FROM balls WHERE uid=?', Number(uid))[0];
    if (!b || b.owner !== u.id) return { err: 'not_yours' };
    if (b.lock !== 0) return { err: 'locked' };
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
  inventory(userId) {
    const lv = this.levels(userId);
    return this.q('SELECT uid,type FROM balls WHERE owner=? AND lock=0', userId).map(b => ({ ...b, stars: lv[b.type] || 0 }));
  }
  reward(userId, coins, win, tokens) {
    const tk = eventActive(Date.now()) ? (tokens || 0) : 0;
    this.q('UPDATE users SET coins=coins+?, tokens=tokens+?, wins=wins+?, losses=losses+? WHERE id=?', coins, tk, win ? 1 : 0, win ? 0 : 1, userId);
    return tk;
  }

  /* ---------- Ballbox ---------- */
  openBox(tk, boxId) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const cfg = BOX_BY_ID[boxId];
    if (!cfg) return { err: 'box_unknown' };
    if (!boxActive(boxId, Date.now())) return { err: 'box_over' };
    const have = cfg.cur === 'tokens' ? u.tokens : u.coins;
    if (have < cfg.price) return { err: cfg.cur === 'tokens' ? 'no_tokens' : 'no_coins' };
    // Tutorial: wer noch keine drei Bälle hat, öffnet nur Standard-Boxen und bekommt nacheinander Stachel, Feuer und Bumerang
    const owned = new Set(this.q('SELECT type FROM balls WHERE owner=?', u.id).map(x => x.type));
    const tutorial = owned.size < MIN_FREE;
    if (tutorial && boxId !== 'standard') return { err: 'tutorial_box' };
    let rIdx = pickWeighted(RAR_KEYS.map(k => RARITY[k].weight)), reward;
    if (tutorial) {
      rIdx = 0;
      reward = TUTORIAL_BALLS.find(t => !owned.has(t));
    } else reward = randType(RAR_KEYS[rIdx], boxId);
    // Mitspieler in der Schüssel: auch mal seltene, damit man "knapp daneben" erlebt
    const decoyRar = () => RAR_KEYS[pickWeighted([40, 30, 20, 10])];
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
    if (rIdx < 3 && rnd() < .7) {
      const higher = RAR_KEYS.slice(rIdx + 1);
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
      const r = simBox(s, 10);
      if (r.order[0] !== winIdx) continue;
      if (baitIdx >= 0 && k < 600 && r.order[1] !== baitIdx && r.order[2] !== baitIdx) continue;
      seed = s;
    }
    if (seed < 0) {
      for (let k = 0; k < 5000 && seed < 0; k++) {
        const s = (base + 913 + k * 104729) % 2147483647;
        if (simBox(s, 10).order[0] === winIdx) seed = s;
      }
    }
    if (cfg.cur === 'tokens') this.q('UPDATE users SET tokens=tokens-?, boxes=boxes+1 WHERE id=?', cfg.price, u.id);
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
    let types = BALL_IDS;
    if (o.rarity && RARITY[o.rarity]) types = types.filter(t => DEFS[t].rarity === o.rarity);
    if (o.q) {
      const needle = String(o.q).toLowerCase().slice(0, 20);
      types = types.filter(t => DEFS[t].name.toLowerCase().includes(needle));
    }
    if (!types.length) return { ok: true, items: [], total: 0 };
    const ph = types.map(() => '?').join(',');
    const order = o.sort === 'new' ? 'b.listed_at DESC' : o.sort === 'high' ? 'b.price DESC' : 'b.price ASC, b.listed_at DESC';
    const page = Math.max(0, int(o.page || 0, 0, 1000) || 0);
    const items = this.q(`SELECT b.uid,b.type,b.stars,b.price,b.owner,u.name seller FROM balls b JOIN users u ON u.id=b.owner
      WHERE b.lock=1 AND b.type IN (${ph}) ORDER BY ${order} LIMIT 40 OFFSET ?`, ...types, page * 40);
    const total = this.q(`SELECT COUNT(*) c FROM balls WHERE lock=1 AND type IN (${ph})`, ...types)[0].c;
    return { ok: true, items: items.map(i => ({ uid: i.uid, type: i.type, stars: i.stars, price: i.price, seller: i.seller, mine: i.owner === u.id })), total };
  }

  /* ---------- Handel ---------- */
  playerInfo(tk, name) {
    const u = this.userBy(tk);
    if (!u) return { err: 'auth' };
    const p = this.userByName(String(name || '').trim());
    if (!p) return { err: 'no_player' };
    const balls = this.q('SELECT uid,type,stars FROM balls WHERE owner=? AND lock=0 ORDER BY uid', p.id);
    return { ok: true, player: { name: p.name, wins: p.wins, losses: p.losses, balls }, self: p.id === u.id };
  }
  tradeView(t, meId) {
    const ids = s => JSON.parse(s);
    const bt = list => list.map(uid => { const b = this.q('SELECT uid,type,stars FROM balls WHERE uid=?', uid)[0]; return b || { uid, type: null }; });
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
    return {
      ok: true, incoming: inc.map(t => this.tradeView(t, u.id)), outgoing: out.map(t => this.tradeView(t, u.id)),
      history: hist.map(t => this.tradeView(t, u.id))
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
