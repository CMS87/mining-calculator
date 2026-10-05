// 36-month cash flow for the site configured in the model (index.html).
// The model hands over the numbers that define the site (miners, hashprice,
// gas, generator terms, prices, running costs) through localStorage; this page
// only adds the deployment ramp, the halving and the discount rate. One company
// owns everything: every month is revenue − running costs − equipment.
// Pure functions only: cashflow.html and test/cashflow-model.test.mjs import this.

export const HORIZON_MONTHS = 36;
export const DAYS_PER_MONTH = 730 / 24;   // 30.42
export const HANDOFF_KEY = 'gas-to-btc-model';
export const NEXT_HALVING_BLOCK = 1050000;   // subsidy 3.125 → 1.5625 BTC, expected around April 2028

// Month (1 = this month) in which the next halving lands, from the current block height.
export const halvingMonthFromHeight = (height, blocksPerDay = 144) =>
  Number.isFinite(height) && height > 0 ? Math.max(1, Math.round((NEXT_HALVING_BLOCK - height) / blocksPerDay / DAYS_PER_MONTH) + 1) : null;

// Standard amortised payment; used to state the default generator loan exactly.
export const amortisedPayment = (principal, annualRatePct, months) => {
  const r = annualRatePct / 100 / 12;
  if (!(months > 0)) return 0;
  return r > 0 ? (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1) : principal / months;
};
const DEFAULT_RESERVE = 11680;                                   // (one top $20k + one major $40k) × 16 over 60,000 h ÷ 8,760 h/yr ÷ 12
const DEFAULT_LOAN = 16 * amortisedPayment(148000, 5, 60);       // $185,000 less 20% down, 5% over 60 months, 16 units
const DEFAULT_MAINTENANCE = 16 * 1500;

// What the model provides. These defaults equal the model page's own defaults
// (test/site-model.test.mjs proves it) so the page still works when opened
// directly, flagged as "not from the model".
export const defaultModel = {
  fromModel: false,
  containers: 4,
  minersPerContainer: 1549 / 4,       // 1,549 miners the generators can power (16 × 400 kW at 85%), spread over 4 containers
  minerLabel: '234 TH/s · 3.51 kW',
  thPerMiner: 234,
  kwPerMiner: 3.51,
  uptimePct: 100,
  hashprice: 39.5,
  poolPct: 0,
  gasPricePerMcf: 0.5,
  gasIndexLabel: 'custom',
  mcfPerDay: (1549 * 3.51 * 24 * 11500) / 1e6,   // 1,549 miners × 3.51 kW × 24 h × 11,500 BTU/kWh ÷ 1,000 BTU/scf = 1,500.6
  loadKw: 1549 * 3.51,
  otherOpexMonthly: 0,
  containerPrice: 90000,
  minerPricePerTh: 10,
  generatorMode: 'finance',
  generatorCount: 16,
  generatorLabel: '16 × 400 kW, finance + overhaul reserve',
  generatorOverhaulMonthly: DEFAULT_RESERVE,                     // included in the two amounts below
  generatorUpfront: 16 * 185000 * 0.2,                           // 20% down
  generatorMonthly: DEFAULT_LOAN + DEFAULT_MAINTENANCE + DEFAULT_RESERVE,
  generatorTermMonths: 60,
  generatorMonthlyAfter: DEFAULT_MAINTENANCE + DEFAULT_RESERVE
};

// What this page adds.
export const defaultOwn = {
  month1Boxes: 1,
  month2Boxes: 2,
  month3Boxes: 4,
  staffMonthly: 25000,
  minerRepairPerMiner: 7,
  setupPerBox: 26385,
  halvingMonth: 19,                 // April 2028 seen from October 2026; 0 = ignore the halving
  hashpriceAfterHalvingPct: 50,     // hashprice from the halving on, as % of today's: 50 = subsidy halves, price and difficulty unchanged; may exceed 100
  discountRatePct: 15               // per year, for the NPV
};

const num = (obj, key) => {
  const value = Number(obj[key]);
  return Number.isFinite(value) ? value : 0;
};
const pct = (obj, key) => Math.min(100, Math.max(0, num(obj, key))) / 100;

// Maps the payload written by the model page to this page's model shape.
export const modelFromHandoff = (payload) => {
  const m = payload?.model;
  if (!m || !Number.isFinite(Number(m.containers))) return null;
  const model = { ...defaultModel, fromModel: true, savedAt: payload.savedAt ?? null };
  for (const key of Object.keys(defaultModel)) {
    if (key === 'fromModel') continue;
    if (m[key] !== undefined && m[key] !== null) model[key] = typeof defaultModel[key] === 'string' ? String(m[key]) : m[key];
  }
  model.generatorTermMonths = m.generatorTermMonths === null || m.generatorTermMonths === undefined ? null : Number(m.generatorTermMonths);
  return model;
};

// The model also carries defaults for this page's own inputs (staff, repairs, setup).
export const ownFromHandoff = (payload) => {
  const m = payload?.model;
  const own = {};
  if (!m) return own;
  for (const key of ['staffMonthly', 'minerRepairPerMiner', 'setupPerBox', 'halvingMonth']) {
    if (Number.isFinite(Number(m[key])) && m[key] !== null) own[key] = Number(m[key]);
  }
  return own;
};

export const boxesForMonth = (model, own, month) => {
  const cap = Math.max(0, Math.round(num(model, 'containers')));
  const raw = month === 1 ? num(own, 'month1Boxes') : month === 2 ? num(own, 'month2Boxes') : num(own, 'month3Boxes');
  return Math.max(0, Math.min(cap, Math.round(raw)));
};

// Generator payment for units acquired `monthsSince` months ago (0 = the month
// they went live): the term payment while the term runs (rent and buy: no
// term, the same every month), then the post-term amount.
export const generatorPayment = (model, monthsSince) => {
  const term = model.generatorTermMonths;
  return term === null || term === undefined || monthsSince < term ? num(model, 'generatorMonthly') : num(model, 'generatorMonthlyAfter');
};

export const calculate = (model, own, overrideHashprice) => {
  const containers = Math.max(0, Math.round(num(model, 'containers')));
  const baseHashprice = overrideHashprice ?? num(model, 'hashprice');
  const halvingMonth = Math.round(num(own, 'halvingMonth'));
  const afterHalving = Math.max(0, num(own, 'hashpriceAfterHalvingPct')) / 100;
  const minerPrice = num(model, 'thPerMiner') * num(model, 'minerPricePerTh');
  const rows = [];
  const cohorts = [];   // { share, start }: generators bought with each batch of containers pay their own term
  let previousBoxes = 0;
  let cumulative = 0;

  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    // Containers stay online once deployed, so each one's equipment is bought once.
    const prevBoxes = previousBoxes;
    const boxes = Math.max(prevBoxes, boxesForMonth(model, own, month));
    const newBoxes = boxes - prevBoxes;
    previousBoxes = boxes;
    const share = containers > 0 ? boxes / containers : 0;
    if (newBoxes > 0 && containers > 0) cohorts.push({ share: newBoxes / containers, start: month });

    // From the halving on, each PH earns the chosen share of today's hashprice.
    const hashprice = halvingMonth > 0 && month >= halvingMonth ? baseHashprice * afterHalving : baseHashprice;
    // Whole miners: the model's total spread over the containers, rounded as batches go live
    const miners = Math.round(num(model, 'minersPerContainer') * boxes);
    const newMiners = miners - Math.round(num(model, 'minersPerContainer') * prevBoxes);
    const ph = (miners * num(model, 'thPerMiner')) / 1000 * pct(model, 'uptimePct');
    const kwh = num(model, 'loadKw') * share * 730;
    const revenue = ph * hashprice * DAYS_PER_MONTH;

    const gas = num(model, 'mcfPerDay') * share * num(model, 'gasPricePerMcf') * DAYS_PER_MONTH;
    const generators = cohorts.reduce((t, c) => t + generatorPayment(model, month - c.start) * c.share, 0);
    const repairs = miners * num(own, 'minerRepairPerMiner');
    const staff = boxes > 0 ? num(own, 'staffMonthly') + num(model, 'otherOpexMonthly') : 0;
    const pool = revenue * pct(model, 'poolPct');
    const costs = gas + generators + repairs + staff + pool;
    const operatingCash = revenue - costs;

    const equipment = {
      containers: newBoxes * num(model, 'containerPrice'),
      generators: containers > 0 ? newBoxes * num(model, 'generatorUpfront') / containers : 0,
      miners: newMiners * minerPrice,
      setup: newBoxes * num(own, 'setupPerBox')
    };
    equipment.total = equipment.containers + equipment.generators + equipment.miners + equipment.setup;

    const netCash = operatingCash - equipment.total;
    cumulative += netCash;
    rows.push({
      month, boxes, newBoxes, miners, ph, kwh, hashprice,
      revenue, gas, generators, repairs, staff, pool, costs, operatingCash,
      equipment, netCash, cumulative
    });
  }
  return rows;
};

export const sum = (rows, pick) => rows.reduce((t, r) => t + pick(r), 0);

// First month at the final fleet size; the first month if nothing is ever deployed.
export const runRateRow = (rows) => {
  const fleet = rows[rows.length - 1].boxes;
  return rows.find(r => r.boxes === fleet) || rows[0];
};

// First month, after equipment was bought, whose cumulative cash is >= 0 and stays there.
export const paybackMonth = (rows) => {
  let invested = 0;
  for (let i = 0; i < rows.length; i += 1) {
    invested += rows[i].equipment.total;
    if (invested > 0 && rows[i].cumulative >= 0 && rows.slice(i).every(r => r.cumulative >= 0)) return rows[i].month;
  }
  return null;
};

// Hashprice at which run-rate OPERATING cash is zero (equipment excluded):
// revenue × (1 − pool) = other costs  ⇒  hashprice = other costs ÷ (PH × days × (1 − pool)).
export const breakevenHashprice = (model, rows) => {
  const run = runRateRow(rows);
  const divisor = run.ph * DAYS_PER_MONTH * (1 - pct(model, 'poolPct'));
  return divisor > 0 ? (run.costs - run.pool) / divisor : null;
};

// Discounting: the net cash of month m is discounted m − 1 months, so month 1,
// when the first equipment is bought, counts as today. Annual rates are
// effective: monthly = (1 + annual)^(1/12) − 1.
export const npvAtMonthly = (monthlyRate, flows) =>
  flows.reduce((total, flow, i) => total + flow / Math.pow(1 + monthlyRate, i), 0);
export const monthlyFromAnnualPct = (annualPct) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
export const annualPctFromMonthly = (monthly) => (Math.pow(1 + monthly, 12) - 1) * 100;
export const npv = (annualPct, flows) => npvAtMonthly(monthlyFromAnnualPct(annualPct), flows);

// Annual IRR in %: the rate at which the net cash flows discount to zero.
// Monthly rates from −99% to +100% are scanned for a sign change of the NPV,
// then bisected. null when no rate does it (never pays back, or nothing was
// invested) or when more than one does (cash turns negative again later):
// then the number would mean nothing, and the page says so.
export const irrAnnualPct = (flows) => {
  if (!flows.some(f => f < 0) || !flows.some(f => f > 0)) return null;
  const LO = -0.99, HI = 1, STEPS = 796;             // 0.25% steps
  const at = (k) => LO + ((HI - LO) * k) / STEPS;
  const brackets = [];
  let prev = npvAtMonthly(at(0), flows);
  for (let k = 1; k <= STEPS; k += 1) {
    const value = npvAtMonthly(at(k), flows);
    if ((prev < 0 && value >= 0) || (prev > 0 && value <= 0)) brackets.push([at(k - 1), at(k)]);
    prev = value;
  }
  if (brackets.length !== 1) return null;
  let [lo, hi] = brackets[0];
  const loSign = Math.sign(npvAtMonthly(lo, flows));
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (Math.sign(npvAtMonthly(mid, flows)) === loSign) lo = mid; else hi = mid;
  }
  return annualPctFromMonthly((lo + hi) / 2);
};

export const summarize = (model, own, rows) => {
  const run = runRateRow(rows);
  const halvingMonth = Math.round(num(own, 'halvingMonth'));
  const flows = rows.map(r => r.netCash);
  return {
    irrPct: irrAnnualPct(flows),
    npv: npv(Math.max(0, num(own, 'discountRatePct')), flows),
    run,
    halvingMonth: halvingMonth > 0 && halvingMonth <= HORIZON_MONTHS ? halvingMonth : null,
    runIsBeforeHalving: halvingMonth > 0 && run.month < halvingMonth,
    boxesBought: sum(rows, r => r.newBoxes),
    equipment: sum(rows, r => r.equipment.total),
    paybackMonth: paybackMonth(rows),
    breakevenHashprice: breakevenHashprice(model, rows),
    powerCostPerKwh: run.kwh > 0 ? (run.gas + run.generators) / run.kwh : 0,
    year1Net: sum(rows.slice(0, 12), r => r.netCash),
    horizonNet: rows[rows.length - 1].cumulative
  };
};
