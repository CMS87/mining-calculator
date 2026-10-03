import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDEXES, parseFredCsv, parseOilPriceApi, entry, buildSnapshot, fetchAll } from '../scripts/fetch-prices.mjs';
import { priceIndexes, pickDefault, mmbtuToMcf, describe } from '../public/price-feed.js';

test('FRED csv: latest numeric row wins, "." placeholders are skipped', () => {
  const csv = 'observation_date,DHHNGSP\n2026-09-26,3.21\n2026-09-29,3.18\n2026-09-30,.\n';
  assert.deepEqual(parseFredCsv(csv), { price: 3.18, asOf: '2026-09-29' });
  assert.equal(parseFredCsv('observation_date,DHHNGSP\n'), null);
});

test('OilPriceAPI response: nested or flat, negative prices kept', () => {
  assert.deepEqual(
    parseOilPriceApi({ status: 'success', data: { price: -1.25, code: 'NATURAL_GAS_WAHA', unit: 'mmbtu', created_at: '2026-10-02T20:30:00.000Z' } }),
    { price: -1.25, asOf: '2026-10-02' }
  );
  assert.deepEqual(parseOilPriceApi({ price: 3.1 }), { price: 3.1, asOf: null });
  assert.equal(parseOilPriceApi({ data: { price: 'n/a' } }), null);
  assert.equal(parseOilPriceApi(null), null);
});

test('entries carry the index metadata and an ok/unavailable status', () => {
  const waha = INDEXES.find(i => i.key === 'waha');
  const ok = entry(waha, { price: 1.67, asOf: '2026-10-02' });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.unit, 'USD/MMBtu');
  assert.equal(ok.sourceUrl, waha.sourceUrl);
  const down = entry(waha, null, 'OILPRICEAPI_KEY not set');
  assert.equal(down.status, 'unavailable');
  assert.equal(down.reason, 'OILPRICEAPI_KEY not set');
  assert.equal(down.price, undefined);
});

test('without a key, Henry Hub still loads and the OilPriceAPI indexes degrade with a reason', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return { ok: true, text: async () => 'observation_date,DHHNGSP\n2026-09-29,3.18\n', json: async () => ({}) };
  };
  const entries = await fetchAll({}, fakeFetch);
  const byKey = Object.fromEntries(entries.map(e => [e.key, e]));
  assert.equal(byKey.henryHub.status, 'ok');
  assert.equal(byKey.henryHub.price, 3.18);
  assert.equal(byKey.waha.status, 'unavailable');
  assert.equal(byKey.waha.reason, 'OILPRICEAPI_KEY not set');
  assert.equal(calls.length, 1, 'only FRED is called without a key');
});

test('with a key, the first code that answers wins and HTTP errors fall through to the next code', async () => {
  const fakeFetch = async (url, opts) => {
    if (url.includes('oilpriceapi')) assert.equal(opts.headers.Authorization, 'Token k');
    if (url.endsWith('by_code=NATURAL_GAS')) return { ok: false, status: 404, json: async () => ({}) };
    if (url.includes('by_code=NATURAL_GAS_USD')) return { ok: true, json: async () => ({ data: { price: 3.21, created_at: '2026-10-03T12:00:00Z' } }) };
    if (url.includes('NATURAL_GAS_WAHA')) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, text: async () => 'observation_date,DHHNGSP\n2026-09-29,3.18\n' };
  };
  const byKey = Object.fromEntries((await fetchAll({ OILPRICEAPI_KEY: 'k' }, fakeFetch)).map(e => [e.key, e]));
  assert.equal(byKey.nymexHH.price, 3.21);
  assert.equal(byKey.waha.status, 'unavailable');
  assert.equal(byKey.waha.reason, 'HTTP 500 for NATURAL_GAS_WAHA');
  assert.equal(byKey.henryHub.price, 3.18);
});

test('a network error becomes an unavailable entry, never a throw', async () => {
  const entries = await fetchAll({ OILPRICEAPI_KEY: 'k' }, async () => { throw new Error('boom'); });
  assert.ok(entries.every(e => e.status === 'unavailable' && e.reason === 'boom'));
});

test('price-feed: picks Waha, then Henry Hub, converts $/MMBtu to $/MCF by HHV', () => {
  const snapshot = buildSnapshot([
    entry(INDEXES[0], null, 'OILPRICEAPI_KEY not set'),
    entry(INDEXES[1], { price: 3.18, asOf: '2026-09-29' })
  ], new Date('2026-10-03T00:00:00Z'));
  assert.equal(snapshot.fetchedAt, '2026-10-03T00:00:00.000Z');
  assert.deepEqual(priceIndexes(snapshot).map(i => i.key), ['henryHub']);   // unavailable excluded
  assert.equal(pickDefault(snapshot).key, 'henryHub');
  assert.equal(pickDefault(null), null);
  const withWaha = buildSnapshot([entry(INDEXES[0], { price: 1.67, asOf: '2026-10-02' }), entry(INDEXES[1], { price: 3.18, asOf: '2026-09-29' })]);
  assert.equal(pickDefault(withWaha).key, 'waha');
  assert.equal(mmbtuToMcf(1.67, 1000), 1.67);
  assert.ok(Math.abs(mmbtuToMcf(2, 1050) - 2.1) < 1e-9);
  assert.equal(describe(pickDefault(withWaha)), 'Waha (West Texas): $1.67/MMBtu as of 2026-10-02');
  assert.equal(describe(null), 'custom price');
});
