// Straight one-company gas-to-bitcoin cash flow.
// The company owns the containers, generators and miners; every month is
// revenue − operating costs − capex. No equipment payouts, no revenue sharing.
// Pure functions only: the page (cashflow.html) and the tests both import this.

export const HORIZON_MONTHS = 36;

export const defaults = {
  containers: 4,
  month1Boxes: 1,
  month2Boxes: 2,
  month3Boxes: 4,
  minersPerContainer: 324,
  thPerMiner: 234,
  kwPerMiner: 3.51,
  parasiticKw: 50,
  uptimePct: 95,
  hashprice: 36,
  daysPerMonth: 30.42,
  heatRate: 11500,
  hhv: 1000,
  gasPrice: 0.5,
  poolPct: 2,
  genMaintPerKwh: 0.005,
  minerRepairPerMiner: 7,
  staffMonthly: 25000,
  generatorRentPerBox: 0,
  containerCapexPerBox: 90000,
  generatorCapexPerBox: 740000,
  minerPricePerTh: 10,
  setupPerBox: 26385
};

const num = (inputs, key) => {
  const value = Number(inputs[key]);
  return Number.isFinite(value) ? value : 0;
};

// Percent inputs are clamped so a typo (150 % uptime) cannot inflate the result.
const pct = (inputs, key) => Math.min(100, Math.max(0, num(inputs, key)));

export const boxesForMonth = (inputs, month) => {
  const cap = Math.max(0, Math.round(num(inputs, 'containers')));
  const raw = month === 1 ? num(inputs, 'month1Boxes')
    : month === 2 ? num(inputs, 'month2Boxes')
    : num(inputs, 'month3Boxes');
  return Math.max(0, Math.min(cap, Math.round(raw)));
};

// Gas burned by one container per day, from its electrical load and the
// generator heat rate: kWh/day × BTU/kWh ÷ BTU/scf ÷ 1000 scf/MCF.
export const mcfPerBoxDay = (inputs) => {
  const loadKw = num(inputs, 'minersPerContainer') * num(inputs, 'kwPerMiner') + num(inputs, 'parasiticKw');
  const hhv = num(inputs, 'hhv');
  return hhv > 0 ? (loadKw * 24 * num(inputs, 'heatRate')) / (hhv * 1000) : 0;
};

export const calculate = (inputs, overrideHashprice) => {
  const days = num(inputs, 'daysPerMonth');
  const hashprice = overrideHashprice ?? num(inputs, 'hashprice');
  const uptime = pct(inputs, 'uptimePct') / 100;
  const poolShare = pct(inputs, 'poolPct') / 100;
  const loadKwPerBox = num(inputs, 'minersPerContainer') * num(inputs, 'kwPerMiner') + num(inputs, 'parasiticKw');
  const gasPerBoxDay = mcfPerBoxDay(inputs);
  const minerPrice = num(inputs, 'minerPricePerTh') * num(inputs, 'thPerMiner');

  const rows = [];
  let previousBoxes = 0;
  let cumulative = 0;

  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    // Containers stay online once deployed, so the ramp can only grow and
    // equipment is bought exactly once per container.
    const boxes = Math.max(previousBoxes, boxesForMonth(inputs, month));
    const newBoxes = boxes - previousBoxes;
    previousBoxes = boxes;

    const miners = boxes * num(inputs, 'minersPerContainer');
    const loadKw = boxes * loadKwPerBox;
    const kwh = loadKw * 24 * days;
    const ph = (miners * num(inputs, 'thPerMiner') / 1000) * uptime;
    const revenue = ph * hashprice * days;

    const gas = boxes * gasPerBoxDay * num(inputs, 'gasPrice') * days;
    const pool = revenue * poolShare;
    const genMaint = kwh * num(inputs, 'genMaintPerKwh');
    const minerRepair = miners * num(inputs, 'minerRepairPerMiner');
    const genRent = boxes * num(inputs, 'generatorRentPerBox');
    const staff = num(inputs, 'staffMonthly');
    const opexTotal = gas + pool + genMaint + minerRepair + genRent + staff;
    const operatingCash = revenue - opexTotal;

    const capexContainers = newBoxes * num(inputs, 'containerCapexPerBox');
    const capexGenerators = newBoxes * num(inputs, 'generatorCapexPerBox');
    const capexMiners = newBoxes * num(inputs, 'minersPerContainer') * minerPrice;
    const capexSetup = newBoxes * num(inputs, 'setupPerBox');
    const capexTotal = capexContainers + capexGenerators + capexMiners + capexSetup;

    const netCash = operatingCash - capexTotal;
    cumulative += netCash;

    rows.push({
      month, boxes, newBoxes, miners, loadKw, kwh, ph,
      revenue, gas, pool, genMaint, minerRepair, genRent, staff, opexTotal, operatingCash,
      capexContainers, capexGenerators, capexMiners, capexSetup, capexTotal,
      netCash, cumulative
    });
  }
  return rows;
};

export const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

// First month at the final fleet size (the ramp never shrinks, so this is the
// stabilised operation); the first month if nothing is ever deployed.
export const runRateRow = (rows) => {
  const fleet = rows[rows.length - 1].boxes;
  return rows.find(row => row.boxes === fleet) || rows[0];
};

// First month, after equipment has been bought, whose cumulative cash is >= 0
// and stays there; null if never (or if nothing was ever bought).
export const paybackMonth = (rows) => {
  let invested = 0;
  for (let i = 0; i < rows.length; i += 1) {
    invested += rows[i].capexTotal;
    if (invested > 0 && rows[i].cumulative >= 0 && rows.slice(i).every(row => row.cumulative >= 0)) return rows[i].month;
  }
  return null;
};

// Hashprice at which run-rate OPERATING cash is exactly zero (equipment excluded).
// revenue × (1 − pool) = non-pool costs  ⇒  hashprice = costs ÷ (PH × days × (1 − pool)).
// null when revenue cannot respond to hashprice (no hashrate, 100 % pool fee).
export const breakevenHashprice = (inputs, rows) => {
  const run = runRateRow(rows);
  const nonPoolCosts = run.opexTotal - run.pool;
  const divisor = run.ph * num(inputs, 'daysPerMonth') * (1 - pct(inputs, 'poolPct') / 100);
  return divisor > 0 ? nonPoolCosts / divisor : null;
};

export const summarize = (inputs, rows) => {
  const run = runRateRow(rows);
  const powerCosts = run.gas + run.genMaint + run.genRent;
  return {
    run,
    purchasedBoxes: sum(rows, 'newBoxes'),
    totalCapex: sum(rows, 'capexTotal'),
    paybackMonth: paybackMonth(rows),
    breakevenHashprice: breakevenHashprice(inputs, rows),
    powerCostPerKwh: run.kwh > 0 ? powerCosts / run.kwh : 0,
    operatingCostPerKwh: run.kwh > 0 ? run.opexTotal / run.kwh : 0,
    year1Net: sum(rows.slice(0, 12), 'netCash'),
    horizonNet: rows[rows.length - 1].cumulative
  };
};
