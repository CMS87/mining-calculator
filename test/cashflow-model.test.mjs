import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORIZON_MONTHS, defaults, calculate, summarize, mcfPerBoxDay, boxesForMonth, paybackMonth, sum
} from '../public/cashflow-model.js';

const close = (actual, expected, tolerance = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} (±${tolerance})`);

test('gas per box follows load × heat rate ÷ HHV', () => {
  // 324 × 3.51 + 50 = 1187.24 kW → ×24 ×11500 ÷ 1e6 = 327.68 MCF/day
  close(mcfPerBoxDay(defaults), 327.68, 0.01);
  assert.equal(mcfPerBoxDay({ ...defaults, hhv: 0 }), 0);
});

test('ramp is clamped to the container count and never negative', () => {
  const inputs = { ...defaults, containers: 3, month1Boxes: -2, month2Boxes: 9, month3Boxes: 2.4 };
  assert.equal(boxesForMonth(inputs, 1), 0);
  assert.equal(boxesForMonth(inputs, 2), 3);
  assert.equal(boxesForMonth(inputs, 7), 2);
});

test('containers stay online: a shrinking ramp buys each container once', () => {
  const rows = calculate({ ...defaults, month1Boxes: 4, month2Boxes: 2, month3Boxes: 4 });
  assert.deepEqual(rows.slice(0, 3).map(r => r.boxes), [4, 4, 4]);
  assert.equal(sum(rows, 'newBoxes'), 4);
  assert.equal(summarize(defaults, rows).purchasedBoxes, 4);
});

test('month 1 with one box: every line is revenue − costs − capex, by hand', () => {
  const inputs = { ...defaults, daysPerMonth: 30, hashprice: 40, gasPrice: 1, staffMonthly: 10000 };
  const [m1] = calculate(inputs);
  assert.equal(m1.boxes, 1);
  assert.equal(m1.miners, 324);
  const ph = (324 * 234 / 1000) * 0.95;                        // 72.0252
  close(m1.revenue, ph * 40 * 30, 0.01);                       // 86,430.24
  close(m1.gas, 327.68 * 1 * 30, 0.5);                         // 9,830
  close(m1.pool, m1.revenue * 0.02, 0.01);
  close(m1.genMaint, 1187.24 * 24 * 30 * 0.005, 0.01);         // 4,274.06
  assert.equal(m1.minerRepair, 324 * 7);
  assert.equal(m1.genRent, 0);
  assert.equal(m1.staff, 10000);
  close(m1.opexTotal, m1.gas + m1.pool + m1.genMaint + m1.minerRepair + m1.staff, 0.001);
  close(m1.operatingCash, m1.revenue - m1.opexTotal, 0.001);
  assert.equal(m1.capexContainers, 90000);
  assert.equal(m1.capexGenerators, 740000);
  assert.equal(m1.capexMiners, 324 * 234 * 10);
  assert.equal(m1.capexSetup, 26385);
  close(m1.netCash, m1.operatingCash - m1.capexTotal, 0.001);
  assert.equal(m1.cumulative, m1.netCash);
});

test('capex is charged only for boxes that are new that month', () => {
  const rows = calculate(defaults);
  assert.deepEqual(rows.slice(0, 4).map(r => r.newBoxes), [1, 1, 2, 0]);
  assert.equal(rows[3].capexTotal, 0);
  assert.equal(sum(rows, 'capexTotal'), 4 * (90000 + 740000 + 324 * 234 * 10 + 26385));
  assert.equal(rows.length, HORIZON_MONTHS);
});

test('percent inputs are clamped to 0–100', () => {
  const [over] = calculate({ ...defaults, uptimePct: 150, poolPct: -5 });
  const [full] = calculate({ ...defaults, uptimePct: 100, poolPct: 0 });
  close(over.revenue, full.revenue, 0.001);
  assert.equal(over.pool, 0);
});

test('cumulative cash is the running sum of net cash', () => {
  const rows = calculate(defaults);
  let running = 0;
  for (const row of rows) {
    running += row.netCash;
    close(row.cumulative, running, 0.001);
  }
});

test('payback is the first month cumulative cash stays non-negative after investing', () => {
  const rows = [
    { month: 1, capexTotal: 100, cumulative: -10 }, { month: 2, capexTotal: 0, cumulative: 1 },
    { month: 3, capexTotal: 0, cumulative: -1 }, { month: 4, capexTotal: 0, cumulative: 5 },
    { month: 5, capexTotal: 0, cumulative: 9 }
  ];
  assert.equal(paybackMonth(rows), 4);
  assert.equal(paybackMonth([{ month: 1, capexTotal: 100, cumulative: -1 }]), null);
  // No investment yet: month 1 at zero cash is not a payback.
  assert.equal(paybackMonth([{ month: 1, capexTotal: 0, cumulative: 0 }, { month: 2, capexTotal: 50, cumulative: 10 }]), 2);
  assert.equal(paybackMonth([{ month: 1, capexTotal: 0, cumulative: 0 }]), null);
});

test('breakeven hashprice zeroes run-rate operating cash, null when revenue cannot respond', () => {
  const rows = calculate(defaults);
  const { breakevenHashprice } = summarize(defaults, rows);
  const atBreakeven = calculate(defaults, breakevenHashprice);
  const run = atBreakeven.find(r => r.boxes === 4);
  close(run.operatingCash, 0, 0.01);
  const dead = { ...defaults, uptimePct: 0 };
  assert.equal(summarize(dead, calculate(dead)).breakevenHashprice, null);
  const allPool = { ...defaults, poolPct: 100 };
  assert.equal(summarize(allPool, calculate(allPool)).breakevenHashprice, null);
});

test('run rate is the first month at the final fleet size', () => {
  const rows = calculate({ ...defaults, containers: 5 });   // ramp still tops out at 4
  const s = summarize({ ...defaults, containers: 5 }, rows);
  assert.equal(s.run.month, 3);
  assert.equal(s.run.boxes, 4);
  assert.equal(s.purchasedBoxes, 4);
  const empty = { ...defaults, month1Boxes: 0, month2Boxes: 0, month3Boxes: 0 };
  assert.equal(summarize(empty, calculate(empty)).run.month, 1);
});

test('generator rent is a per-box monthly cost', () => {
  const inputs = { ...defaults, generatorRentPerBox: 1000, generatorCapexPerBox: 0 };
  const rows = calculate(inputs);
  assert.equal(rows[2].genRent, 4000);
  assert.equal(rows[2].capexGenerators, 0);
});

test('summary totals come from the rows', () => {
  const rows = calculate(defaults);
  const s = summarize(defaults, rows);
  assert.equal(s.run.month, 3);
  close(s.year1Net, sum(rows.slice(0, 12), 'netCash'), 0.001);
  close(s.horizonNet, rows[35].cumulative, 0.001);
  assert.ok(s.paybackMonth === null || (s.paybackMonth >= 1 && s.paybackMonth <= 36));
  assert.ok(s.powerCostPerKwh > 0 && s.operatingCostPerKwh > s.powerCostPerKwh);
});
