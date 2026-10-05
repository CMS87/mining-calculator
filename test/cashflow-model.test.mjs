import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORIZON_MONTHS, DAYS_PER_MONTH, defaultModel, defaultOwn, modelFromHandoff, ownFromHandoff, boxesForMonth,
  generatorPayment, calculate, summarize, paybackMonth, sum, npvAtMonthly, npv, irrAnnualPct
} from '../public/cashflow-model.js';

test('handoff: the model\'s staff, repairs and setup become this page\'s defaults; missing ones stay', () => {
  assert.deepEqual(ownFromHandoff({ model: { staffMonthly: 30000, minerRepairPerMiner: 5, setupPerBox: 20000 } }),
    { staffMonthly: 30000, minerRepairPerMiner: 5, setupPerBox: 20000 });
  assert.deepEqual(ownFromHandoff({ model: { staffMonthly: 'x', setupPerBox: null } }), {});
  assert.deepEqual(ownFromHandoff(null), {});
  const own = { ...defaultOwn, ...ownFromHandoff({ model: { staffMonthly: 30000 } }) };
  assert.equal(own.staffMonthly, 30000);
  assert.equal(own.minerRepairPerMiner, defaultOwn.minerRepairPerMiner);
});

const close = (actual, expected, tol = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (±${tol})`);

test('handoff: the model payload maps onto the page model; a missing payload gives null', () => {
  const payload = {
    savedAt: '2026-10-04T12:00:00Z',
    model: { containers: 3, minersPerContainer: 300, hashprice: 41.2, gasPricePerMcf: -0.5, generatorMode: 'rto', generatorTermMonths: 28, generatorMonthly: 216000, generatorMonthlyAfter: 24000 }
  };
  const m = modelFromHandoff(payload);
  assert.equal(m.fromModel, true);
  assert.equal(m.containers, 3);
  assert.equal(m.hashprice, 41.2);
  assert.equal(m.gasPricePerMcf, -0.5);
  assert.equal(m.generatorTermMonths, 28);
  assert.equal(m.thPerMiner, defaultModel.thPerMiner);          // untouched keys keep defaults
  assert.equal(modelFromHandoff(null), null);
  assert.equal(modelFromHandoff({ model: {} }), null);
  assert.equal(modelFromHandoff({ model: { containers: 2, generatorTermMonths: null } }).generatorTermMonths, null);
});

test('halving: hashprice scales from the halving month on; month 0 ignores it; month estimate from height', async () => {
  const { halvingMonthFromHeight, NEXT_HALVING_BLOCK } = await import('../public/cashflow-model.js');
  const own = { ...defaultOwn, month1Boxes: 4, halvingMonth: 19, hashpriceAfterHalvingPct: 50 };
  const rows = calculate(defaultModel, own);
  assert.equal(rows[17].hashprice, defaultModel.hashprice);           // month 18
  assert.equal(rows[18].hashprice, defaultModel.hashprice / 2);       // month 19
  close(rows[18].revenue, rows[17].revenue / 2, 0.01);
  const none = calculate(defaultModel, { ...own, halvingMonth: 0 });
  assert.equal(none[35].hashprice, defaultModel.hashprice);
  const up = calculate(defaultModel, { ...own, hashpriceAfterHalvingPct: 150 });   // the price can more than double
  assert.equal(up[18].hashprice, defaultModel.hashprice * 1.5);
  const later = calculate(defaultModel, { ...own, halvingMonth: 40 });
  assert.equal(later[35].hashprice, defaultModel.hashprice);
  const s = summarize(defaultModel, own, rows);
  assert.equal(s.halvingMonth, 19);
  assert.equal(s.runIsBeforeHalving, true);
  assert.equal(summarize(defaultModel, { ...own, halvingMonth: 40 }, later).halvingMonth, null);
  // 1,050,000 − 971,000 = 79,000 blocks ≈ 548.6 days ≈ 18.0 months → month 19
  assert.equal(halvingMonthFromHeight(NEXT_HALVING_BLOCK - 79000), 19);
  assert.equal(halvingMonthFromHeight(NEXT_HALVING_BLOCK), 1);
  assert.equal(halvingMonthFromHeight(NaN), null);
  assert.deepEqual(ownFromHandoff({ model: { halvingMonth: 17 } }), { halvingMonth: 17 });
});

test('ramp is clamped to the model containers and never negative', () => {
  const model = { ...defaultModel, containers: 3 };
  const own = { ...defaultOwn, month1Boxes: -2, month2Boxes: 9, month3Boxes: 2.4 };
  assert.equal(boxesForMonth(model, own, 1), 0);
  assert.equal(boxesForMonth(model, own, 2), 3);
  assert.equal(boxesForMonth(model, own, 7), 2);
});

test('generator payment follows the term from acquisition: 28 payments, then the post-term amount', () => {
  const rto = { ...defaultModel, generatorMonthly: 216000, generatorTermMonths: 28, generatorMonthlyAfter: 24000 };
  assert.equal(generatorPayment(rto, 0), 216000);
  assert.equal(generatorPayment(rto, 27), 216000);
  assert.equal(generatorPayment(rto, 28), 24000);
  assert.equal(generatorPayment(defaultModel, 36), defaultModel.generatorMonthly);
});

test('generators bought with later containers pay their own term (cohorts), not the project month', () => {
  const model = { ...defaultModel, generatorUpfront: 0, generatorMonthly: 60000, generatorTermMonths: 24, generatorMonthlyAfter: 24000 };
  const rows = calculate(model, defaultOwn);                         // 1 → 2 → 4 containers in months 1, 2, 3
  close(rows[2].generators, 60000, 0.01);                            // month 3: all three cohorts in term
  close(rows[24].generators, 0.25 * 24000 + 0.75 * 60000, 0.01);     // month 25: the first container's quarter is done
  close(rows[25].generators, 0.5 * 24000 + 0.5 * 60000, 0.01);       // month 26: the second too
  close(rows[26].generators, 24000, 0.01);                           // month 27: all post-term
  const allAtOnce = calculate(model, { ...defaultOwn, month1Boxes: 4 });
  close(allAtOnce[23].generators, 60000, 0.01);
  close(allAtOnce[24].generators, 24000, 0.01);
});

test('month 1 with one box: every line by hand', () => {
  const model = { ...defaultModel, hashprice: 40, gasPricePerMcf: 1, poolPct: 2, uptimePct: 95 };
  const own = { ...defaultOwn, staffMonthly: 10000 };
  const [m1] = calculate(model, own);
  assert.equal(m1.boxes, 1);
  assert.equal(m1.miners, 387);                                          // round(387.25 × 1)
  const ph = (387 * 234 / 1000) * 0.95;                                  // 86.03
  close(m1.revenue, ph * 40 * DAYS_PER_MONTH, 0.01);
  close(m1.gas, defaultModel.mcfPerDay / 4 * 1 * DAYS_PER_MONTH, 0.01);                 // one quarter of the site's gas
  close(m1.generators, defaultModel.generatorMonthly / 4, 0.001);        // one quarter of the fleet's loan, maintenance and overhaul reserve
  assert.equal(m1.repairs, 387 * 7);
  assert.equal(m1.staff, 10000);
  close(m1.pool, m1.revenue * 0.02, 0.01);
  close(m1.costs, m1.gas + m1.generators + m1.repairs + m1.staff + m1.pool, 0.001);
  close(m1.operatingCash, m1.revenue - m1.costs, 0.001);
  assert.equal(m1.equipment.containers, 90000);
  close(m1.equipment.generators, defaultModel.generatorUpfront / 4, 0.001);   // the down payment, one quarter per container
  assert.equal(m1.equipment.miners, 387 * 234 * 10);
  assert.equal(m1.equipment.setup, 26385);
  close(m1.netCash, m1.operatingCash - m1.equipment.total, 0.001);
  assert.equal(m1.cumulative, m1.netCash);
});

test('rent/RTO/finance: no upfront when the model says so; term payment then post-term', () => {
  const finance = { ...defaultModel, generatorUpfront: 592000, generatorMonthly: 60000, generatorTermMonths: 24, generatorMonthlyAfter: 24000 };
  const rows = calculate(finance, { ...defaultOwn, month1Boxes: 4 });
  assert.equal(rows[0].equipment.generators, 592000);
  close(rows[23].generators, 60000, 0.01);
  close(rows[24].generators, 24000, 0.01);
  const rent = { ...defaultModel, generatorUpfront: 0, generatorMonthly: 168000, generatorTermMonths: null, generatorMonthlyAfter: 168000 };
  const rentRows = calculate(rent, defaultOwn);
  assert.equal(sum(rentRows, r => r.equipment.generators), 0);
  assert.equal(rentRows[35].generators, 168000);
});

test('ramp never shrinks and equipment is bought once per container', () => {
  const rows = calculate(defaultModel, { ...defaultOwn, month1Boxes: 4, month2Boxes: 2, month3Boxes: 4 });
  assert.deepEqual(rows.slice(0, 3).map(r => r.boxes), [4, 4, 4]);
  assert.equal(sum(rows, r => r.newBoxes), 4);
  const normal = calculate(defaultModel, defaultOwn);
  assert.deepEqual(normal.slice(0, 4).map(r => r.newBoxes), [1, 1, 2, 0]);
  close(sum(normal, r => r.equipment.total), 4 * (90000 + 148000 + 26385) + 1549 * 234 * 10, 0.01);   // 4,682,200 cash upfront (finance: 20% down)
  assert.deepEqual(normal.slice(0, 4).map(r => r.miners), [387, 775, 1549, 1549]);   // whole miners; the batches sum to the model's 1,549
  assert.equal(normal.length, HORIZON_MONTHS);
});

test('cumulative is the running sum of net cash', () => {
  let running = 0;
  for (const r of calculate(defaultModel, defaultOwn)) {
    running += r.netCash;
    close(r.cumulative, running, 0.001);
  }
});

test('payback needs an investment first and cumulative cash that stays non-negative', () => {
  const rows = [
    { month: 1, equipment: { total: 100 }, cumulative: -10 }, { month: 2, equipment: { total: 0 }, cumulative: 1 },
    { month: 3, equipment: { total: 0 }, cumulative: -1 }, { month: 4, equipment: { total: 0 }, cumulative: 5 }
  ];
  assert.equal(paybackMonth(rows), 4);
  assert.equal(paybackMonth([{ month: 1, equipment: { total: 0 }, cumulative: 0 }]), null);
});

test('breakeven hashprice zeroes run-rate operating cash; null when revenue cannot respond', () => {
  const rows = calculate(defaultModel, defaultOwn);
  const { breakevenHashprice } = summarize(defaultModel, defaultOwn, rows);
  const run = calculate(defaultModel, defaultOwn, breakevenHashprice).find(r => r.boxes === 4);
  close(run.operatingCash, 0, 0.01);
  const dead = { ...defaultModel, uptimePct: 0 };
  assert.equal(summarize(dead, defaultOwn, calculate(dead, defaultOwn)).breakevenHashprice, null);
});

test('IRR and NPV by hand: month 1 counts as today; effective annual rates', () => {
  const tenPctAYear = (1.1 ** 12 - 1) * 100;                                  // 10%/month = 213.84%/year
  close(npvAtMonthly(0.1, [-100, 110]), 0, 1e-9);
  close(irrAnnualPct([-100, 110]), tenPctAYear, 1e-6);
  close(irrAnnualPct([-100, 0, 121]), tenPctAYear, 1e-6);
  close(irrAnnualPct([-1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1120]), 12, 1e-6);   // 12% after exactly one year
  close(npv(0, [-100, 60, 60]), 20, 1e-9);                                     // at 0% the NPV is the sum
  close(npv(12, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100]), 100 / 1.12, 1e-9); // $100 in month 13 = $100 one year out
  close(npv(15, [-100, 50]), -100 + 50 / 1.15 ** (1 / 12), 1e-9);
});

test('IRR is n/a without a sign change, with nothing invested, or when two rates zero the NPV', () => {
  assert.equal(irrAnnualPct([-100, -50]), null);
  assert.equal(irrAnnualPct([100, 50]), null);
  assert.equal(irrAnnualPct([0, 0]), null);
  close(irrAnnualPct([-100, 30]), (0.3 ** 12 - 1) * 100, 1e-6);  // 30 cents back on the dollar: −70%/month ≈ −100%/year, still a number
  // −100 + 230/(1+r) − 132/(1+r)² = 0 at r = 10% and r = 20% a month: two rates, no answer
  close(npvAtMonthly(0.1, [-100, 230, -132]), 0, 1e-9);
  close(npvAtMonthly(0.2, [-100, 230, -132]), 0, 1e-9);
  assert.equal(irrAnnualPct([-100, 230, -132]), null);
});

test('summary IRR and NPV come from the net cash series: NPV at 0% is the 36-month cash, NPV at the IRR is zero', () => {
  const rows = calculate(defaultModel, defaultOwn);
  const flows = rows.map(r => r.netCash);
  const s = summarize(defaultModel, defaultOwn, rows);
  assert.ok(s.irrPct > 0, `default case should earn a positive IRR, got ${s.irrPct}`);
  close(npv(0, flows), s.horizonNet, 0.01);
  close(npv(s.irrPct, flows), 0, 1);
  close(s.npv, npv(15, flows), 0.01);                                       // default discount rate 15%/year
  assert.ok(s.npv < s.horizonNet);                                          // discounting at 15% takes value off the cash sum
  const dearer = summarize(defaultModel, { ...defaultOwn, discountRatePct: 30 }, rows);
  assert.ok(dearer.npv < s.npv);
  assert.equal(dearer.irrPct, s.irrPct);                                    // the IRR does not depend on the discount rate
  const never = { ...defaultModel, hashprice: 1 };
  assert.equal(summarize(never, defaultOwn, calculate(never, defaultOwn)).irrPct, null);
  const nothing = summarize(defaultModel, { ...defaultOwn, month1Boxes: 0, month2Boxes: 0, month3Boxes: 0 }, calculate(defaultModel, { ...defaultOwn, month1Boxes: 0, month2Boxes: 0, month3Boxes: 0 }));
  assert.equal(nothing.irrPct, null);
  assert.equal(nothing.npv, 0);
});

test('summary: counts containers actually bought and reports a payback within the horizon or null', () => {
  const s = summarize(defaultModel, defaultOwn, calculate(defaultModel, defaultOwn));
  assert.equal(s.boxesBought, 4);
  close(s.equipment, 4682200, 1);
  assert.ok(s.paybackMonth === null || (s.paybackMonth >= 1 && s.paybackMonth <= 36));
  const five = summarize({ ...defaultModel, containers: 5 }, defaultOwn, calculate({ ...defaultModel, containers: 5 }, defaultOwn));
  assert.equal(five.boxesBought, 4);                                      // the ramp tops out at 4
  assert.ok(s.powerCostPerKwh > 0);
});
