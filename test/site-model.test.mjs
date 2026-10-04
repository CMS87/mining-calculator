import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSite, generatorTerms, buildHandoff, overhaulEvents, halvingMonthFromHeight, halvingMonthFromDays, halvingMonthFromDate
} from '../src/siteModel.js';
import { modelFromHandoff, ownFromHandoff, calculate as cashflow, defaultOwn, defaultModel } from '../public/cashflow-model.js';

const close = (actual, expected, tol = 0.5, msg = '') =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} ${actual} ≠ ${expected} (±${tol})`);

// The page's defaults (Reset to defaults), gas at a custom $0.50/MCF.
export const defaults = {
  containerCount: 4, containerCostPerUnit: 90000, setupPerContainer: 26385, minersPerContainer: 324,
  selectedMinerPreset: 's21pro234', hashratePerUnit: 234, minerPowerKW: 3.51, pricePerTh: 10,
  generatorCount: 16, generatorSizeKw: 400, generatorLoadPct: 0.85, heatRate: 11500, hhv: 1000,
  generatorMode: 'finance', generatorBuyPrice: 185000, generatorBuyMaintenance: 1500, generatorRentMonthly: 10500,
  generatorRtoMonthly: 13500, generatorRtoEquityPct: 0.5, generatorRtoPostMaint: 1500,
  financeRate: 5.0, financeTerm: 60, financeDownPct: 20,
  wahaPrice: 0.5, wahaAdder: 0, hashprice: 36, poolFee: 0, curtailment: 0, otherOpex: 0,
  staffMonthly: 25000, minerRepairPerMiner: 7,
  generatorLifetimeHours: 60000, topOverhaulHours: 20000, topOverhaulCost: 20000, majorOverhaulHours: 40000, majorOverhaulCost: 40000
};

// Hand figures for the defaults
const RESERVE = (20000 + 40000) * 16 / (60000 / 8760) / 12;   // one top (20k h) + one major (40k h) per unit over 6.85 years = 11,679/month

test('power and miners: 16 × 400 kW at 85% runs 1,296 slot-limited miners drawing 4.55 MW', () => {
  const r = computeSite(defaults);
  close(r.fleetCapacityMw, 6.4, 1e-9);
  close(r.availableMw, 5.44, 1e-9);
  assert.equal(r.minersByPower, Math.floor(5440 / 3.51));   // 1,549
  assert.equal(r.minersByPdu, 1296);
  assert.equal(r.miners, 1296);
  close(r.loadKw, 1296 * 3.51, 1e-6);                        // 4,548.96 kW
  close(r.phs, 303.264, 1e-9);
});

test('gas: burned for the load drawn, 1,255.5 MCF/day at 11,500 BTU/kWh and 1,000 BTU/scf', () => {
  const r = computeSite(defaults);
  close(r.mcfPerDay, (4548.96 * 24 * 11500) / 1e6, 0.01);    // 1,255.51
  close(r.gasMonthly, 1255.51 * 0.5 * (730 / 24), 0.5);     // 19,094
  assert.ok(r.mcfPerDay < 1766 * 0.72);                      // nameplate (6.4 MW) would have given 1,766
  const paid = computeSite({ ...defaults, wahaPrice: -1.25 });
  close(paid.gasMonthly, -1255.51 * 1.25 * (730 / 24), 0.5); // negative gas = income
  // a zero or blank HHV falls back to 1,000 BTU/scf instead of making gas free
  close(computeSite({ ...defaults, hhv: 0 }).mcfPerDay, r.mcfPerDay, 1e-9);
  close(computeSite({ ...defaults, hhv: 1200 }).mcfPerDay, r.mcfPerDay / 1.2, 1e-9);
});

test('finance: 20% down, 5% over 60 months → $2,793 per unit, $44,687 per month, $592,000 down', () => {
  const r = computeSite(defaults);
  const rate = 0.05 / 12, n = 60, principal = 148000;
  const payment = (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);  // 2,792.96
  close(r.financePaymentPerUnit, payment, 0.01);
  close(r.financeMonthlyPayment, payment * 16, 0.1);          // 44,687
  assert.equal(r.financeDownPayment, 592000);
  close(r.financeTotalPaid, payment * 60 * 16 + 592000, 1);   // 3,273,244
  close(r.financeTotalInterest, r.financeTotalPaid - 2960000, 1);
  close(r.generatorMonthly, payment * 16 + 24000, 0.1);       // loan + maintenance = 68,687
  assert.equal(r.generatorCapex, 592000);
  close(computeSite({ ...defaults, financeRate: 0 }).financePaymentPerUnit, 148000 / 60, 1e-6);
  // a zero term is a cash purchase: everything upfront, no payment, nothing financed
  const cash = computeSite({ ...defaults, financeTerm: 0 });
  assert.equal(cash.financeIsCash, true);
  assert.equal(cash.financeMonthlyPayment, 0);
  assert.equal(cash.financeDownPayment, 2960000);
  assert.equal(cash.generatorCapex, 2960000);
  assert.equal(cash.generatorFinanced, 0);
});

test('RTO: $13,500/month with 50% equity owns a $185,000 unit after 28 months; no equity never owns', () => {
  const r = computeSite({ ...defaults, generatorMode: 'rto' });
  assert.equal(r.rtoEquityPerMonth, 6750);
  assert.equal(r.rtoMonthsToOwn, 28);
  assert.equal(r.rtoOwns, true);
  assert.equal(r.rtoTotalPaid, 13500 * 28 * 16);               // 6,048,000
  assert.equal(r.rtoPremium, 6048000 - 2960000);               // 3,088,000
  assert.equal(r.rtoPostOwnershipMonthly, 24000);
  assert.equal(r.generatorMonthly, 13500 * 16);
  assert.equal(r.generatorCapex, 0);
  const never = computeSite({ ...defaults, generatorMode: 'rto', generatorRtoEquityPct: 0 });
  assert.equal(never.rtoOwns, false);
  assert.equal(never.rtoMonthsToOwn, Infinity);
  const terms = generatorTerms({ ...defaults, generatorMode: 'rto', generatorRtoEquityPct: 0 }, never);
  assert.equal(terms.termMonths, null);
  close(terms.monthlyAfter, 13500 * 16 + RESERVE, 0.01);       // keeps paying rent-to-own forever
});

test('rent and buy', () => {
  const rent = computeSite({ ...defaults, generatorMode: 'rent' });
  assert.equal(rent.generatorMonthly, 10500 * 16);
  assert.equal(rent.generatorCapex, 0);
  assert.equal(rent.overhaulReserveMonthly, 0);
  const buy = computeSite({ ...defaults, generatorMode: 'buy' });
  assert.equal(buy.generatorMonthly, 1500 * 16);
  assert.equal(buy.generatorCapex, 185000 * 16);
});

test('overhauls: events before retirement, a major replaces the top due at the same hour; generators run 8,760 h/year', () => {
  assert.deepEqual(overhaulEvents(60000, 20000, 40000), { tops: 1, majors: 1 });   // 20k top, 40k major, nothing at 60k
  assert.deepEqual(overhaulEvents(80000, 20000, 40000), { tops: 2, majors: 1 });   // 20k, 40k major, 60k top
  assert.deepEqual(overhaulEvents(60000, 0, 40000), { tops: 0, majors: 1 });
  assert.deepEqual(overhaulEvents(60000, 20000, 0), { tops: 2, majors: 0 });
  assert.deepEqual(overhaulEvents(60000, 15000, 40000), { tops: 3, majors: 1 });   // 15k, 30k, 45k tops; 40k major (not a top hour)
  assert.deepEqual(overhaulEvents(60000, 0.000001, 0.000002).majors > 1e9, true);  // absurd inputs count arithmetically, no loop
  assert.equal(computeSite(defaults).generatorLifeMonths > 36, true);
  const r = computeSite(defaults);
  assert.equal(r.hoursPerYear, 8760);
  close(r.lifetimeYears, 60000 / 8760, 1e-9);                  // 6.85 years
  assert.equal(r.topOverhaulCount, 1);
  assert.equal(r.majorOverhaulCount, 1);
  assert.equal(r.totalOverhaulCost, (20000 + 40000) * 16);     // 960,000 per fleet life
  close(r.overhaulReserveMonthly, RESERVE, 0.01);             // 11,679/month
  assert.equal(computeSite({ ...defaults, generatorMode: 'rent' }).overhaulReserveMonthly, 0);
  assert.equal(computeSite({ ...defaults, topOverhaulCost: 0, majorOverhaulCost: 0 }).overhaulReserveMonthly, 0);
  // the planning load does not change running hours or the reserve
  close(computeSite({ ...defaults, generatorLoadPct: 0.6 }).overhaulReserveMonthly, RESERVE, 0.01);
});

test('revenue, running costs, operating cash and payback by hand (finance, gas $0.50, hashprice $36)', () => {
  const r = computeSite(defaults);
  close(r.grossRevenue, 332074, 1);                            // 303.264 PH × $36 × 30.42
  assert.equal(r.poolMonthly, 0);
  assert.equal(r.repairsMonthly, 1296 * 7);                    // 9,072
  assert.equal(r.staffMonthly, 25000);
  close(r.totalOpex, 19094.3 + 68687.4 + RESERVE + 9072 + 25000, 3);   // 133,533
  close(r.netMonthly, 332074 - 133533, 4);                             // 198,541
  // equipment: what it costs in full vs what is paid in cash upfront
  assert.equal(r.containerCapex, 360000);
  assert.equal(r.setupCapex, 4 * 26385);                       // 105,540
  assert.equal(r.asicCapex, 1296 * 234 * 10);                  // 3,032,640
  assert.equal(r.generatorFullPrice, 2960000);
  close(r.equipmentCost, 360000 + 105540 + 2960000 + 3032640, 0.01);  // 6,458,180
  close(r.cashUpfront, 360000 + 105540 + 592000 + 3032640, 0.01);     // 4,090,180
  assert.equal(r.generatorFinanced, 2960000 - 592000);                // 2,368,000 in the loan
  close(r.paybackMonths, 4090180 / r.netMonthly, 1e-6);        // cash-on-cash ≈ 20.6 months
  close(r.powerCostPerKwh, (r.gasMonthly + r.generatorMonthly + r.overhaulReserveMonthly) / (4548.96 * 730), 1e-9);
  close(r.breakevenHashprice, r.totalOpex / (303.264 * (730 / 24)), 1e-9);
  const pooled = computeSite({ ...defaults, poolFee: 0.02 });
  close(pooled.poolMonthly, pooled.grossRevenue * 0.02, 0.01);
  close(pooled.monthlyRevenue, pooled.grossRevenue * 0.98, 0.01);
  // rent-to-own and rent are not equipment cost; buy is
  assert.equal(computeSite({ ...defaults, generatorMode: 'rto' }).generatorEquipment, 0);
  assert.equal(computeSite({ ...defaults, generatorMode: 'buy' }).equipmentCost, computeSite({ ...defaults, generatorMode: 'buy' }).cashUpfront);
});

test('acquisition comparison: every mode over the same 60 months, with maintenance and reserve', () => {
  const r = computeSite(defaults);
  const c = r.comparison;
  assert.equal(c.horizonMonths, 60);
  const maint = 1500 * 16 * 60, reserve = RESERVE * 60;
  close(c.rent.totalPaid, 10500 * 16 * 60, 1);                 // 10,080,000; no reserve: renter does not pay overhauls
  close(c.buy.totalPaid, 2960000 + maint + reserve, 1);
  close(c.finance.totalPaid, r.financeTotalPaid + maint + reserve, 1);
  close(c.rto.totalPaid, 13500 * 16 * 28 + 24000 * 32 + reserve, 1);
  assert.equal(c.rto.ownAfterMonths, 28);
  assert.equal(c.finance.ownAfterMonths, 60);
  assert.equal(c.buy.ownAfterMonths, 0);
  assert.equal(c.rent.ownAfterMonths, null);
  const residual = 1 - 5 / (60000 / 8760);                     // 27% after 5 of 6.85 years
  close(c.buy.residual, 2960000 * residual, 1);
  close(c.finance.residual, 2960000 * residual, 1);
  close(c.rto.residual, 2960000 * residual, 1);                // owned at month 28 < 60
  assert.equal(c.rent.residual, 0);
  assert.equal(computeSite({ ...defaults, generatorRtoEquityPct: 0 }).comparison.rto.residual, 0);
});

test('string inputs (as typed) give the same numbers as numeric ones', () => {
  const typed = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]));
  const a = computeSite(defaults), b = computeSite(typed);
  for (const key of ['miners', 'mcfPerDay', 'gasMonthly', 'generatorMonthly', 'cashUpfront', 'netMonthly', 'paybackMonths']) {
    close(b[key], a[key], 1e-6, key);
  }
});

test('impossible inputs: nothing runs without miner power or generators; percentages are bounded', () => {
  for (const p of [{ ...defaults, minerPowerKW: 0 }, { ...defaults, generatorCount: 0 }]) {
    const r = computeSite(p);
    assert.equal(r.miners, 0);
    assert.equal(r.mcfPerDay, 0);
    assert.equal(r.monthlyRevenue, 0);
    assert.equal(r.breakevenHashprice, null);
    assert.equal(r.paybackMonths, Infinity);
  }
  const over = computeSite({ ...defaults, poolFee: 1.5, curtailment: -0.2 });
  assert.equal(over.monthlyRevenue, 0);
  close(over.grossRevenue, computeSite(defaults).grossRevenue, 0.01);
});

test('the cash-flow page reproduces the model page: same site, same month at full build, all four modes', () => {
  for (const mode of ['rent', 'buy', 'rto', 'finance']) {
    const p = { ...defaults, generatorMode: mode, poolFee: 0.02, otherOpex: 1000, hashprice: 45 };
    const r = computeSite(p);
    const payload = buildHandoff(p, r, { halvingMonth: 19 });
    const model = modelFromHandoff(payload);
    const own = { ...defaultOwn, month3Boxes: model.containers, ...ownFromHandoff(payload) };
    const rows = cashflow(model, own);
    const full = rows.find(row => row.boxes === 4);               // month 3, before the halving
    close(full.revenue - full.pool, r.monthlyRevenue, 0.01, `${mode}: revenue`);
    close(full.gas, r.gasMonthly, 0.01, `${mode}: gas`);
    close(full.generators, r.generatorMonthly + r.overhaulReserveMonthly, 0.01, `${mode}: generators incl. reserve`);
    close(full.operatingCash, r.netMonthly, 0.01, `${mode}: operating cash`);
    const equipment = rows.reduce((t, row) => t + row.equipment.total, 0);
    close(equipment, r.cashUpfront, 0.01, `${mode}: cash upfront`);
  }
});

test('the cash-flow page opened directly matches the model page at its defaults (finance, $39.5, custom $0.50 gas)', () => {
  const p = { ...defaults, hashprice: 39.5 };
  const r = computeSite(p);
  const expected = buildHandoff(p, r, { halvingMonth: 19 }).model;
  for (const key of ['containers', 'minersPerContainer', 'thPerMiner', 'kwPerMiner', 'uptimePct', 'hashprice', 'poolPct', 'gasPricePerMcf',
    'loadKw', 'containerPrice', 'minerPricePerTh', 'generatorMode', 'generatorCount', 'generatorUpfront', 'generatorTermMonths']) {
    assert.deepEqual(defaultModel[key], expected[key], key);
  }
  for (const key of ['mcfPerDay', 'generatorMonthly', 'generatorMonthlyAfter', 'generatorOverhaulMonthly']) {
    close(defaultModel[key], expected[key], 0.01, key);
  }
});

test('generator terms carried to the cash flow: upfront, during the term, after it', () => {
  const r = computeSite(defaults);
  const reserve = r.overhaulReserveMonthly;
  assert.deepEqual(generatorTerms(defaults, r), { upfront: 592000, monthly: r.generatorMonthly + reserve, termMonths: 60, monthlyAfter: 24000 + reserve });
  const rto = { ...defaults, generatorMode: 'rto' };
  assert.deepEqual(generatorTerms(rto, computeSite(rto)), { upfront: 0, monthly: 216000 + reserve, termMonths: 28, monthlyAfter: 24000 + reserve });
  const rent = { ...defaults, generatorMode: 'rent' };
  assert.equal(generatorTerms(rent, computeSite(rent)).termMonths, null);
  const cash = { ...defaults, financeTerm: 0 };
  assert.deepEqual(generatorTerms(cash, computeSite(cash)), { upfront: 2960000, monthly: 24000 + reserve, termMonths: null, monthlyAfter: 24000 + reserve });
});

test('halving month: this month is 1; 20 days away is still month 1; 79,000 blocks (≈548 days) is month 19', () => {
  assert.equal(halvingMonthFromDays(20), 1);
  assert.equal(halvingMonthFromDays(30.4), 1);
  assert.equal(halvingMonthFromDays(30.5), 2);
  assert.equal(halvingMonthFromHeight(1050000 - 79000), 19);
  assert.equal(halvingMonthFromHeight(1050000), 1);
  assert.equal(halvingMonthFromHeight(null), null);
  assert.equal(halvingMonthFromDate(new Date('2026-10-04'), '2028-04-15'), 19);
  assert.equal(halvingMonthFromDate(new Date('2028-04-10'), '2028-04-15'), 1);
});
