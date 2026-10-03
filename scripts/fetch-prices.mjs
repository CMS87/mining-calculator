#!/usr/bin/env node
// Build-time snapshot of the gas indexes the calculator offers.
// Writes public/prices.json; the pages read it as a same-origin file, so no
// API key ever reaches the browser. A source that fails is recorded as
// "unavailable" with a reason — the build never fails because a feed is down.
//
//   OILPRICEAPI_KEY=... node scripts/fetch-prices.mjs
//
// Henry Hub spot needs no key (EIA series republished by FRED). Waha and the
// NYMEX front month come from OilPriceAPI (free tier, 50 requests/day).

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const INDEXES = [
  {
    key: 'waha', label: 'Waha (West Texas)', kind: 'price', provider: 'oilpriceapi',
    codes: ['NATURAL_GAS_WAHA'], source: 'NGI daily index via OilPriceAPI',
    sourceUrl: 'https://www.oilpriceapi.com/live/waha-natural-gas-price'
  },
  {
    key: 'henryHub', label: 'Henry Hub spot (EIA)', kind: 'price', provider: 'fred',
    series: 'DHHNGSP', source: 'EIA daily spot via FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DHHNGSP'
  },
  {
    key: 'nymexHH', label: 'NYMEX Henry Hub front month', kind: 'price', provider: 'oilpriceapi',
    codes: ['NATURAL_GAS', 'NATURAL_GAS_USD'], source: 'NYMEX via OilPriceAPI',
    sourceUrl: 'https://www.oilpriceapi.com/live/natural-gas-futures'
  }
  // No Waha−Henry Hub basis entry: the API's WAHA_HH code answers HTTP 400, and
  // subtracting the two prices above would mix dates (EIA spot lags a week).
];

const FETCH_TIMEOUT_MS = 15000;

// FRED CSV: header line, then "YYYY-MM-DD,value" rows; missing values are ".".
// Returns the latest row with a numeric value.
export const parseFredCsv = (text) => {
  const rows = String(text).trim().split('\n').map(line => line.trim().split(','));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const [date, value] = rows[i];
    const price = Number(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && Number.isFinite(price)) return { price, asOf: date };
  }
  return null;
};

// OilPriceAPI /v1/prices/latest: { status, data: { price, code, unit, created_at } }.
// Tolerates the price living at the top level. Zero and negative prices are
// valid (Waha trades negative).
export const parseOilPriceApi = (json) => {
  const data = json?.data ?? json;
  const price = Number(data?.price);
  if (!Number.isFinite(price)) return null;
  const stamp = data.created_at ?? data.timestamp ?? data.date ?? null;
  return { price, asOf: typeof stamp === 'string' ? stamp.slice(0, 10) : null };
};

export const entry = (def, result, reason) => ({
  key: def.key, label: def.label, kind: def.kind, unit: 'USD/MMBtu',
  source: def.source, sourceUrl: def.sourceUrl,
  ...(result ? { status: 'ok', price: result.price, asOf: result.asOf } : { status: 'unavailable', reason })
});

export const buildSnapshot = (entries, now = new Date()) => ({
  fetchedAt: now.toISOString(),
  indexes: Object.fromEntries(entries.map(e => [e.key, e]))
});

const fetchIndex = async (def, env, fetchImpl = fetch) => {
  try {
    if (def.provider === 'fred') {
      const res = await fetchImpl(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${def.series}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return entry(def, null, `HTTP ${res.status} from FRED`);
      const parsed = parseFredCsv(await res.text());
      return parsed ? entry(def, parsed) : entry(def, null, 'no numeric row in FRED csv');
    }
    const key = env.OILPRICEAPI_KEY;
    if (!key) return entry(def, null, 'OILPRICEAPI_KEY not set');
    let reason = 'no code tried';
    for (const code of def.codes) {
      const res = await fetchImpl(`https://api.oilpriceapi.com/v1/prices/latest?by_code=${code}`, {
        headers: { Authorization: `Token ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!res.ok) { reason = `HTTP ${res.status} for ${code}`; continue; }
      const parsed = parseOilPriceApi(await res.json());
      if (parsed) return entry(def, parsed);
      reason = `no price in response for ${code}`;
    }
    return entry(def, null, reason);
  } catch (err) {
    return entry(def, null, err.message);
  }
};

export const fetchAll = (env, fetchImpl = fetch) => Promise.all(INDEXES.map(def => fetchIndex(def, env, fetchImpl)));

const main = async () => {
  const entries = await fetchAll(process.env);
  const snapshot = buildSnapshot(entries);
  const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'prices.json');
  await writeFile(out, JSON.stringify(snapshot, null, 2) + '\n');
  for (const e of entries) {
    console.log(e.status === 'ok' ? `${e.key}: ${e.price} ${e.unit} as of ${e.asOf}` : `${e.key}: unavailable (${e.reason})`);
  }
  console.log(`wrote ${out}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
