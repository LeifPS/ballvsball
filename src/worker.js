// Einstieg: /api/* läuft im Worker, alles andere liefert Cloudflare als statische Dateien aus.
import { Store } from './store.js';
import { Game } from './game.js';
import { hash } from './hash.js';
export { Store, Game };

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
function out(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: JSON_H }); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const store = env.STORE.get(env.STORE.idFromName('main'));

    if (url.pathname === '/api/ws') {
      const game = env.GAME.get(env.GAME.idFromName('main'));
      return game.fetch(request);
    }
    if (url.pathname === '/api/replay' && request.method === 'GET') {   // öffentlicher Link zu einer geteilten Wiederholung
      const r = await store.replayGet(url.searchParams.get('t') || '');
      return out(r, r && r.err ? 404 : 200);
    }
    if (request.method !== 'POST') return out({ err: 'method' }, 405);
    const token = request.headers.get('x-token') || '';
    if (token.length < 20 || token.length > 100) return out({ err: 'auth' }, 401);
    let b = {};
    try { b = await request.json(); } catch (e) { b = {}; }
    if (!b || typeof b !== 'object') b = {};
    const tk = await hash(token);
    let r;
    switch (url.pathname) {
      case '/api/login': r = await store.login(tk, b.name); break;
      case '/api/me': r = await store.me(tk); break;
      case '/api/transfer/create': r = await store.transferCreate(tk); break;
      case '/api/transfer/redeem': r = await store.transferRedeem(tk, b.code); break;
      case '/api/delete': r = await store.deleteAccount(tk, b.name); break;
      case '/api/rename': r = await store.rename(tk, b.name); break;
      case '/api/testcoins': r = b.key === 'leif-test' ? await store.testCoins(tk) : { err: 'bad' }; break;
      case '/api/upgradeall': r = await store.upgradeAll(tk); break;
      case '/api/upgrade': r = await store.upgrade(tk, b.uid); break;
      case '/api/daily': r = await store.daily(tk); break;
      case '/api/box': r = await store.openBox(tk, b.box || 'standard'); break;
      case '/api/market/list': r = await store.marketList(tk, b.uid, b.price); break;
      case '/api/market/cancel': r = await store.marketCancel(tk, b.uid); break;
      case '/api/market/buy': r = await store.marketBuy(tk, b.uid); break;
      case '/api/market/browse': r = await store.marketBrowse(tk, b); break;
      case '/api/player': r = await store.playerInfo(tk, b.name); break;
      case '/api/solo': r = await store.soloState(tk); break;
      case '/api/solo/daily': r = await store.soloDaily(tk, b.uid); break;
      case '/api/solo/boss': r = await store.soloBoss(tk, b.uid, !!b.reset); break;
      case '/api/log': r = await store.logList(tk); break;
      case '/api/log/get': r = await store.logGet(tk, b.id); break;
      case '/api/log/share': r = await store.logShare(tk, b.id); break;
      case '/api/trades': r = await store.trades(tk); break;
      case '/api/trade/create': r = await store.tradeCreate(tk, b.to, b.give, b.want, b.coinsGive, b.coinsWant); break;
      case '/api/trade/answer': r = await store.tradeAnswer(tk, b.id, b.action); break;
      default: return out({ err: 'not_found' }, 404);
    }
    return out(r, r && r.err ? (r.err === 'auth' ? 401 : 400) : 200);
  }
};

