import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORIZON_MONTHS, DAYS_PER_MONTH, defaultModel, defaultOwn, modelFromHandoff, boxesForMonth,
  generatorPayment, calculate, summarize, paybackMonth, sum
} from '../public/cashflow-model.js';

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

test('ramp is clamped to the model containers and never negative', () => {
  const model = { ...defaultModel, containers: 3 };
  const own = { ...defaultOwn, month1Boxes: -2, month2Boxes: 9, month3Boxes: 2.4 };
  assert.equal(boxesForMonth(model, own, 1), 0);
  assert.equal(boxesForMonth(model, own, 2), 3);
  assert.equal(boxesForMonth(model, own, 7), 2);
});

test('generator payment follows the term: during, then after; no term means always the same', () => {
  const rto = { ...defaultModel, generatorMonthly: 216000, generatorTermMonths: 28, generatorMonthlyAfter: 24000 };
  assert.equal(generatorPayment(rto, 1), 216000);
  assert.equal(generatorPayment(rto, 28), 216000);
  assert.equal(generatorPayment(rto, 29), 24000);
  assert.equal(generatorPayment(defaultModel, 36), defaultModel.generatorMonthly);
});

test('month 1 with one box: every line by hand', () => {
  const model = { ...defaultModel, hashprice: 40, gasPricePerMcf: 1, poolPct: 2, uptimePct: 95 };
  const own = { ...defaultOwn, staffMonthly: 10000 };
  const [m1] = calculate(model, own);
  assert.equal(m1.boxes, 1);
  assert.equal(m1.miners, 324);
  const ph = (324 * 234 / 1000) * 0.95;                                  // 72.0252
  close(m1.revenue, ph * 40 * DAYS_PER_MONTH, 0.01);
  close(m1.gas, 1254.5 / 4 * 1 * DAYS_PER_MONTH, 0.01);                 // one quarter of the site's gas
  close(m1.generators, 24000 / 4, 0.001);                                // one quarter of the fleet's upkeep
  assert.equal(m1.repairs, 324 * 7);
  assert.equal(m1.staff, 10000);
  close(m1.pool, m1.revenue * 0.02, 0.01);
  close(m1.costs, m1.gas + m1.generators + m1.repairs + m1.staff + m1.pool, 0.001);
  close(m1.operatingCash, m1.revenue - m1.costs, 0.001);
  assert.equal(m1.equipment.containers, 90000);
  assert.equal(m1.equipment.generators, 2960000 / 4);
  assert.equal(m1.equipment.miners, 324 * 234 * 10);
  assert.equal(m1.equipment.setup, 26385);
  close(m1.netCash, m1.operatingCash - m1.equipment.total, 0.001);
  assert.equal(m1.cumulative, m1.netCash);
});

test('rent/RTO/finance: no upfront when the model says so; term payment then post-term', () => {
  const finance = { ...defaultModel, generatorUpfront: 592000, generatorMonthly: 60000, generatorTermMonths: 24, generatorMonthlyAfter: 24000 };
  const rows = calculate(finance, { ...defaultOwn, month1Boxes: 4 });
  assert.equal(rows[0].equipment.generators, 592000);
  assert.equal(rows[23].generators, 60000);
  assert.equal(rows[24].generators, 24000);
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
  close(sum(normal, r => r.equipment.total), 4 * (90000 + 740000 + 758160 + 26385), 0.01);
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

test('summary: counts containers actually bought and reports a payback within the horizon or null', () => {
  const s = summarize(defaultModel, defaultOwn, calculate(defaultModel, defaultOwn));
  assert.equal(s.boxesBought, 4);
  close(s.equipment, 6458180, 1);
  assert.ok(s.paybackMonth === null || (s.paybackMonth >= 1 && s.paybackMonth <= 36));
  const five = summarize({ ...defaultModel, containers: 5 }, defaultOwn, calculate({ ...defaultModel, containers: 5 }, defaultOwn));
  assert.equal(five.boxesBought, 4);                                      // the ramp tops out at 4
  assert.ok(s.powerCostPerKwh > 0);
});
