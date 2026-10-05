// Site economics shown on the model page (index.html): power, miners, gas,
// generator terms, revenue, running costs, equipment and payback. Pure, so it
// can be tested by hand (test/site-model.test.mjs). `buildHandoff` is what the
// «36-Month Cash Flow» button saves for cashflow.html.

export const DAYS = 730 / 24   // 30.42 days in a 730-hour month
export const HOURS_PER_YEAR = 8760   // generators run around the clock; load % is capacity headroom, not run time
export const NEXT_HALVING_BLOCK = 1050000   // subsidy 3.125 → 1.5625 BTC
export const NEXT_HALVING_DATE = '2028-04-15'   // expected; refined from the live block height when available

const n = (v, fallback = 0) => {
  const x = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(x) ? x : fallback
}
const share = (v) => Math.min(1, Math.max(0, n(v)))   // a 0–1 fraction

// Overhaul events over a unit's life: a top overhaul at every `topHours`, a
// major at every `majorHours`; a major replaces the top due at the same hour,
// and nothing is done at the retirement hour itself. Counted arithmetically.
export const overhaulEvents = (lifetimeHours, topHours, majorHours) => {
  const countBelow = (interval) => interval > 0 && lifetimeHours > 0 ? Math.max(0, Math.ceil(lifetimeHours / interval) - 1) : 0
  const majors = countBelow(majorHours)
  let tops = countBelow(topHours)
  if (tops > 0 && majors > 0) {
    const ratio = majorHours / topHours
    if (Number.isInteger(ratio)) tops -= majors              // every major lands on a top hour
    else {
      let overlap = 0
      for (let k = 1; k <= majors && k <= 100000; k += 1) {  // bounded: majors are few for any sane input
        const q = (k * majorHours) / topHours
        if (Math.abs(q - Math.round(q)) < 1e-9) overlap += 1
      }
      tops -= overlap
    }
  }
  return { tops: Math.max(0, tops), majors }
}

// Every input the page holds, as numbers (inputs arrive as strings while typing).
export const computeSite = (p) => {
  const generatorLoadPct = n(p.generatorLoadPct, 0.85)
  const generatorCount = Math.max(0, Math.round(n(p.generatorCount))), generatorSizeKw = n(p.generatorSizeKw)
  const minerPowerKW = n(p.minerPowerKW), hashratePerUnit = n(p.hashratePerUnit)
  const containerCount = Math.max(0, Math.round(n(p.containerCount)))
  const containerKw = n(p.containerKw, 1400) > 0 ? n(p.containerKw, 1400) : 1400   // electrical capacity of one container
  const heatRate = n(p.heatRate), hhv = n(p.hhv) > 0 ? n(p.hhv) : 1000
  const poolFee = share(p.poolFee), curtailment = share(p.curtailment), hashprice = n(p.hashprice)
  const wahaPrice = n(p.wahaPrice), wahaAdder = n(p.wahaAdder)
  const generatorRtoMonthly = n(p.generatorRtoMonthly), generatorRtoEquityPct = share(p.generatorRtoEquityPct)
  const generatorRtoPostMaint = n(p.generatorRtoPostMaint), generatorBuyPrice = n(p.generatorBuyPrice)
  const generatorBuyMaintenance = n(p.generatorBuyMaintenance), generatorRentMonthly = n(p.generatorRentMonthly)
  const financeDownPct = Math.min(100, Math.max(0, n(p.financeDownPct))), financeRate = n(p.financeRate)
  const financeTerm = Math.max(0, Math.round(n(p.financeTerm)))
  const pricePerTh = n(p.pricePerTh), containerCostPerUnit = n(p.containerCostPerUnit), setupPerContainer = n(p.setupPerContainer)
  const minerRepairPerMiner = n(p.minerRepairPerMiner), staffMonthly = n(p.staffMonthly), otherOpex = n(p.otherOpex)
  const generatorLifetimeHours = n(p.generatorLifetimeHours), topOverhaulHours = n(p.topOverhaulHours), topOverhaulCost = n(p.topOverhaulCost)
  const majorOverhaulHours = n(p.majorOverhaulHours), majorOverhaulCost = n(p.majorOverhaulCost)
  const generatorMode = ['rent', 'buy', 'rto', 'finance'].includes(p.generatorMode) ? p.generatorMode : 'buy'

  const cleanLoadPct = Math.min(Math.max(generatorLoadPct || 0.85, 0.1), 1.0)

  // Power: nameplate, usable at the planning load. Each container holds as
  // many miners as its electrical capacity allows; the site runs the smaller
  // of that and what the generators can power.
  const fleetCapacityMw = generatorCount * generatorSizeKw / 1000
  const mwGross = fleetCapacityMw
  const availableMw = mwGross * cleanLoadPct
  const totalKw = availableMw * 1000
  const minersByPower = minerPowerKW > 0 ? Math.max(Math.floor(totalKw / minerPowerKW), 0) : 0
  const minersPerContainer = minerPowerKW > 0 ? Math.floor(containerKw / minerPowerKW) : 0
  const minersByContainerKw = minersPerContainer * containerCount
  const miners = Math.min(minersByPower, minersByContainerKw)
  const limitedBy = miners === 0 ? 'none' : minersByPower < minersByContainerKw ? 'generator power' : 'container capacity'

  // Gas is burned for the load the miners actually draw, not for generator nameplate
  const loadKw = miners * minerPowerKW
  const kwhPerDay = loadKw * 24
  const btuPerDay = kwhPerDay * heatRate
  const mcfPerDay = btuPerDay / (hhv * 1000)
  const phs = (miners * hashratePerUnit) / 1000
  const effectivePhs = phs * (1 - poolFee) * (1 - curtailment)
  const gasPrice = wahaPrice + wahaAdder
  const gasMonthly = mcfPerDay * gasPrice * DAYS

  // Rent-to-own: the equity share of each payment buys the unit; with no equity it is never owned
  const rtoEquityPerMonth = generatorRtoMonthly * generatorRtoEquityPct
  const rtoMonthsToOwn = generatorBuyPrice > 0 && rtoEquityPerMonth > 0 ? Math.ceil(generatorBuyPrice / rtoEquityPerMonth) : Infinity
  const rtoOwns = Number.isFinite(rtoMonthsToOwn)
  const rtoTotalPaid = rtoOwns ? generatorRtoMonthly * rtoMonthsToOwn * generatorCount : Infinity
  const rtoPremium = rtoOwns ? rtoTotalPaid - (generatorBuyPrice * generatorCount) : Infinity
  const rtoPostOwnershipMonthly = generatorRtoPostMaint * generatorCount

  // Finance: amortised payment on the amount after the down payment. A zero term is a cash purchase.
  const financeIsCash = financeTerm === 0
  const financeAmountPerUnit = financeIsCash ? 0 : generatorBuyPrice * (1 - financeDownPct / 100)
  const financeDownPayment = financeIsCash ? generatorBuyPrice * generatorCount : generatorBuyPrice * (financeDownPct / 100) * generatorCount
  const financeMonthlyRate = financeRate / 100 / 12
  const financePaymentPerUnit = financeIsCash ? 0
    : financeMonthlyRate > 0
      ? (financeAmountPerUnit * financeMonthlyRate * Math.pow(1 + financeMonthlyRate, financeTerm)) /
        (Math.pow(1 + financeMonthlyRate, financeTerm) - 1)
      : financeAmountPerUnit / financeTerm
  const financeMonthlyPayment = financePaymentPerUnit * generatorCount
  const financeTotalPaid = financePaymentPerUnit * financeTerm * generatorCount + financeDownPayment
  const financeTotalInterest = financeTotalPaid - (generatorBuyPrice * generatorCount)
  const financePostOwnershipMonthly = generatorBuyMaintenance * generatorCount

  // Generator lifecycle: overhauls over the unit's life, spread evenly, paid by
  // whoever owns the units — this company unless it rents. 60,000 hours at
  // 8,760 hours a year is 6.8 years; the first top overhaul lands in year 3.
  const hoursPerYear = HOURS_PER_YEAR
  const lifetimeYears = generatorLifetimeHours / hoursPerYear
  const topOverhaulYears = topOverhaulHours / hoursPerYear
  const majorOverhaulYears = majorOverhaulHours / hoursPerYear
  const events = overhaulEvents(generatorLifetimeHours, topOverhaulHours, majorOverhaulHours)
  const topOverhaulCount = events.tops
  const majorOverhaulCount = events.majors
  const totalOverhaulCost = (topOverhaulCount * topOverhaulCost + majorOverhaulCount * majorOverhaulCost) * generatorCount
  const annualOverhaulCost = lifetimeYears > 0 ? totalOverhaulCost / lifetimeYears : 0
  const ownsGenerators = generatorMode !== 'rent'
  const overhaulReserveMonthly = ownsGenerators ? annualOverhaulCost / 12 : 0
  const generatorLifeMonths = lifetimeYears * 12   // the cash flow runs 36 months; replacement is not modelled

  // What the generators cost per month in each mode, and what is paid upfront
  let generatorMonthly = 0      // payment or maintenance during the term (buy/rent: every month)
  let generatorCapex = 0        // cash paid upfront
  let generatorEquityBuilt = 0
  if (generatorMode === 'rent') {
    generatorMonthly = generatorRentMonthly * generatorCount
  } else if (generatorMode === 'buy') {
    generatorMonthly = generatorBuyMaintenance * generatorCount
    generatorCapex = generatorBuyPrice * generatorCount
  } else if (generatorMode === 'rto') {
    generatorMonthly = generatorRtoMonthly * generatorCount
    generatorEquityBuilt = rtoOwns ? generatorRtoMonthly * generatorRtoEquityPct * generatorCount * rtoMonthsToOwn : 0
  } else if (generatorMode === 'finance') {
    generatorMonthly = financeMonthlyPayment + (generatorBuyMaintenance * generatorCount)
    generatorCapex = financeDownPayment
  }

  // Equipment: what the site's equipment costs in full, and what is paid upfront in cash.
  // Rented or rent-to-own generators are not bought, so they are not equipment cost.
  const containerCapex = containerCostPerUnit * containerCount
  const asicPricePerUnit = pricePerTh * hashratePerUnit
  const asicCapex = miners * asicPricePerUnit
  const setupCapex = setupPerContainer * containerCount
  const generatorFullPrice = generatorBuyPrice * generatorCount
  const generatorEquipment = generatorMode === 'buy' || generatorMode === 'finance' ? generatorFullPrice : 0
  const equipmentCost = containerCapex + setupCapex + generatorEquipment + asicCapex
  const cashUpfront = containerCapex + setupCapex + generatorCapex + asicCapex
  const generatorFinanced = generatorEquipment - generatorCapex
  const totalCapex = cashUpfront   // kept under its old name for the page

  // Revenue before the pool fee, the fee as its own line, then the running costs
  const grossRevenue = phs * (1 - curtailment) * hashprice * DAYS
  const monthlyRevenue = effectivePhs * hashprice * DAYS   // net of pool fee
  const poolMonthly = grossRevenue - monthlyRevenue
  const repairsMonthly = miners * minerRepairPerMiner
  const totalOpex = gasMonthly + generatorMonthly + overhaulReserveMonthly + repairsMonthly + staffMonthly + otherOpex
  const netMonthly = monthlyRevenue - totalOpex

  // Cash cost of power per kWh delivered to miners: gas, generator payments and
  // the overhaul reserve. Upfront purchases are not in it, so modes with more
  // cash upfront show a lower figure.
  const kwhPerMonth = loadKw * 730
  const powerMonthly = gasMonthly + generatorMonthly + overhaulReserveMonthly
  const powerCostPerKwh = kwhPerMonth > 0 ? powerMonthly / kwhPerMonth : 0

  // Breakeven hashprice: running costs ÷ (effective PH × days); null when revenue cannot respond
  const breakevenHashprice = effectivePhs > 0 ? totalOpex / (effectivePhs * DAYS) : null

  const annualRevenue = monthlyRevenue * 12
  const annualOpex = totalOpex * 12
  const annualNet = netMonthly * 12

  // Cash-on-cash simple payback: cash upfront ÷ monthly operating cash after generator payments
  const paybackMonths = netMonthly > 0 && cashUpfront > 0 ? cashUpfront / netMonthly : Infinity

  // Acquisition comparison over one common horizon (the loan term), every mode
  // on the same basis: payments + maintenance + overhaul reserve, and the value
  // of the units at the end if the company owns them by then.
  const horizon = financeTerm > 0 ? financeTerm : 60
  const residualFraction = lifetimeYears > 0 ? Math.max(1 - (horizon / 12) / lifetimeYears, 0) : 0
  const reserveOverHorizon = (annualOverhaulCost / 12) * horizon
  const maintenanceOverHorizon = generatorBuyMaintenance * generatorCount * horizon
  const rtoMonthsInHorizon = Math.min(horizon, rtoMonthsToOwn)
  const comparison = {
    horizonMonths: horizon,
    rent: {
      upfront: 0, monthly: generatorRentMonthly * generatorCount, ownAfterMonths: null,
      totalPaid: generatorRentMonthly * generatorCount * horizon, interest: 0, residual: 0
    },
    finance: {
      upfront: financeDownPayment, monthly: financeMonthlyPayment + generatorBuyMaintenance * generatorCount + annualOverhaulCost / 12,
      ownAfterMonths: financeIsCash ? 0 : financeTerm,
      totalPaid: financeTotalPaid + maintenanceOverHorizon + reserveOverHorizon, interest: financeTotalInterest,
      residual: generatorFullPrice * residualFraction
    },
    rto: {
      upfront: 0, monthly: generatorRtoMonthly * generatorCount + annualOverhaulCost / 12,
      ownAfterMonths: rtoOwns ? rtoMonthsToOwn : null,
      totalPaid: generatorRtoMonthly * generatorCount * rtoMonthsInHorizon + rtoPostOwnershipMonthly * Math.max(0, horizon - rtoMonthsInHorizon) + reserveOverHorizon,
      interest: rtoOwns ? rtoPremium : Infinity,
      residual: rtoOwns && rtoMonthsToOwn <= horizon ? generatorFullPrice * residualFraction : 0
    },
    buy: {
      upfront: generatorFullPrice, monthly: generatorBuyMaintenance * generatorCount + annualOverhaulCost / 12, ownAfterMonths: 0,
      totalPaid: generatorFullPrice + maintenanceOverHorizon + reserveOverHorizon, interest: 0,
      residual: generatorFullPrice * residualFraction
    }
  }

  return {
    mcfPerDay, mwGross, availableMw, loadKw, fleetCapacityMw, containerKw, miners, minersPerContainer, minersByPower, minersByContainerKw, limitedBy, phs, effectivePhs,
    gasPrice, gasMonthly, generatorMonthly, generatorCapex, asicCapex, asicPricePerUnit,
    containerCapex, setupCapex, generatorFullPrice, generatorEquipment, generatorFinanced, equipmentCost, cashUpfront, totalCapex, generatorEquityBuilt,
    grossRevenue, poolMonthly, repairsMonthly, staffMonthly, otherOpexMonthly: otherOpex,
    ownsGenerators, overhaulReserveMonthly, generatorLifeMonths, powerMonthly,
    monthlyRevenue, totalOpex, netMonthly, paybackMonths,
    powerCostPerKwh, breakevenHashprice, annualRevenue, annualOpex, annualNet,
    hoursPerYear, lifetimeYears, topOverhaulYears, majorOverhaulYears,
    topOverhaulCount, majorOverhaulCount, totalOverhaulCost, annualOverhaulCost,
    rtoEquityPerMonth, rtoMonthsToOwn, rtoOwns, rtoTotalPaid, rtoPremium, rtoPostOwnershipMonthly,
    financeIsCash, financeAmountPerUnit, financeDownPayment, financeMonthlyPayment, financePaymentPerUnit,
    financeTotalPaid, financeTotalInterest, financePostOwnershipMonthly,
    comparison
  }
}

// Month in which the next halving lands, counting this month as 1: days away ÷ 30.42, floored.
export const halvingMonthFromDays = (daysAway) =>
  Number.isFinite(daysAway) ? Math.max(1, Math.floor(daysAway / DAYS) + 1) : null
export const halvingMonthFromHeight = (height, blocksPerDay = 144) =>
  Number.isFinite(height) && height > 0 ? halvingMonthFromDays((NEXT_HALVING_BLOCK - height) / blocksPerDay) : null
export const halvingMonthFromDate = (now = new Date(), expected = NEXT_HALVING_DATE) =>
  halvingMonthFromDays((new Date(expected) - now) / 86400000)

// Generator terms the cash flow needs: what is paid upfront, per month during the
// term, for how many months, and per month afterwards. Rent and buy have no term;
// a rent-to-own that never builds equity has none either. The overhaul reserve
// rides along with the monthly amounts when the company owns the units.
export const generatorTerms = (p, r) => {
  const reserve = r.overhaulReserveMonthly
  return {
    rent: { upfront: 0, monthly: r.generatorMonthly, termMonths: null, monthlyAfter: r.generatorMonthly },
    buy: { upfront: r.generatorCapex, monthly: r.generatorMonthly + reserve, termMonths: null, monthlyAfter: r.generatorMonthly + reserve },
    rto: {
      upfront: 0, monthly: r.generatorMonthly + reserve,
      termMonths: r.rtoOwns ? r.rtoMonthsToOwn : null,
      monthlyAfter: (r.rtoOwns ? r.rtoPostOwnershipMonthly : r.generatorMonthly) + reserve
    },
    finance: {
      upfront: r.generatorCapex, monthly: r.generatorMonthly + reserve,
      termMonths: r.financeIsCash ? null : Math.max(0, Math.round(n(p.financeTerm))),
      monthlyAfter: r.financePostOwnershipMonthly + reserve
    }
  }[['rent', 'buy', 'rto', 'finance'].includes(p.generatorMode) ? p.generatorMode : 'buy']
}

// The payload saved for cashflow.html: raw inputs (to restore the page) and the
// derived numbers (so both pages use the same site).
export const buildHandoff = (p, r, extra = {}) => {
  const containers = Math.max(0, Math.round(n(p.containerCount)))
  const terms = generatorTerms(p, r)
  return {
    savedAt: extra.savedAt ?? new Date().toISOString(),
    inputs: extra.inputs ?? {},
    model: {
      containers,
      minersPerContainer: containers > 0 ? r.miners / containers : 0,
      minerLabel: p.selectedMinerPreset === 'custom' ? 'Custom miner' : `${n(p.hashratePerUnit)} TH/s · ${n(p.minerPowerKW).toFixed(2)} kW`,
      thPerMiner: n(p.hashratePerUnit),
      kwPerMiner: n(p.minerPowerKW),
      uptimePct: (1 - share(p.curtailment)) * 100,
      hashprice: n(p.hashprice),
      poolPct: share(p.poolFee) * 100,
      gasPricePerMcf: r.gasPrice,
      gasIndexLabel: extra.gasIndexLabel ?? 'custom',
      mcfPerDay: r.mcfPerDay,
      loadKw: r.loadKw,
      otherOpexMonthly: n(p.otherOpex),
      staffMonthly: n(p.staffMonthly),
      minerRepairPerMiner: n(p.minerRepairPerMiner),
      setupPerBox: n(p.setupPerContainer),
      halvingMonth: extra.halvingMonth ?? halvingMonthFromDate(),
      containerPrice: n(p.containerCostPerUnit),
      minerPricePerTh: n(p.pricePerTh),
      generatorMode: p.generatorMode,
      generatorCount: Math.max(0, Math.round(n(p.generatorCount))),
      generatorLabel: `${Math.max(0, Math.round(n(p.generatorCount)))} × ${n(p.generatorSizeKw)} kW, ${p.generatorMode}${r.overhaulReserveMonthly > 0 ? ' + overhaul reserve' : ''}`,
      generatorOverhaulMonthly: r.overhaulReserveMonthly,
      generatorUpfront: terms.upfront,
      generatorMonthly: terms.monthly,
      generatorTermMonths: terms.termMonths,
      generatorMonthlyAfter: terms.monthlyAfter
    }
  }
}
