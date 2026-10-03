// Reads the gas index snapshot (public/prices.json, written at build time by
// scripts/fetch-prices.mjs) and converts it for the pages. Pure helpers plus
// one fetch; shared by the React app and cashflow.html.

export const loadPrices = async (baseUrl = './') => {
  try {
    const res = await fetch(`${baseUrl}prices.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

// Indexes that are a usable gas price (not a spread) and were fetched OK.
export const priceIndexes = (snapshot) =>
  Object.values(snapshot?.indexes ?? {}).filter(i => i.kind === 'price' && i.status === 'ok');

// Waha first (the stranded-gas case), then Henry Hub; null when nothing is live.
export const pickDefault = (snapshot, preferred = ['waha', 'henryHub', 'nymexHH']) => {
  const live = priceIndexes(snapshot);
  return preferred.map(key => live.find(i => i.key === key)).find(Boolean) ?? live[0] ?? null;
};

// Indexes are quoted in $/MMBtu; the calculators price gas in $/MCF.
// $/MCF = $/MMBtu × HHV (BTU/scf) ÷ 1000.
export const mmbtuToMcf = (priceMmbtu, hhvBtuPerScf) => priceMmbtu * (hhvBtuPerScf / 1000);

export const describe = (index) =>
  index ? `${index.label}: $${index.price.toFixed(2)}/MMBtu as of ${index.asOf ?? 'n/a'}` : 'custom price';
