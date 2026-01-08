import { useState, useMemo } from 'react'
import './App.css'

function App() {
  // Check URL params: ?gas=true shows gas/power tabs (hidden by default for investor sharing)
  const urlParams = new URLSearchParams(window.location.search)
  const showGas = urlParams.get('gas') === 'true'

  // Presentation Mode: 'models' (explain business), 'deal' (structure investment), or 'gas' (gas-to-power)
  const [mode, setMode] = useState('models')

  // Facility Inputs (fixed for Pecos 15 MW)
  const [facilityMW, setFacilityMW] = useState(15)
  const [curtailment, setCurtailment] = useState(0.05)  // 5% curtailment = 95% uptime
  const [energyPrice, setEnergyPrice] = useState(4.5)   // ¢/kWh
  const [hashprice, setHashprice] = useState(37)        // $/PH/day
  const [monthlyOpex, setMonthlyOpex] = useState(50000)

  // CAPEX - Site & Build-up (same for both models)
  const [siteBuildCost, setSiteBuildCost] = useState(3000000)  // $3M for site + infrastructure

  // Miner Specs (based on S21 Pro)
  const [minerPowerKW, setMinerPowerKW] = useState(3.40)        // kW per unit
  const [hashratePerUnit, setHashratePerUnit] = useState(220)   // TH/s per unit
  const [pricePerTh, setPricePerTh] = useState(11)              // $/TH

  // Co-Mining hashrate share
  const [coMiningShare, setCoMiningShare] = useState(0.30)  // 30% of hashrate

  // Model Mix: 0 = 100% Co-Mining, 1 = 100% Self-Mining
  const [modelMix, setModelMix] = useState(0.5)  // 50/50 Co-Mining + Self-Mining

  // Gas-to-Power inputs
  const [gasInputMode, setGasInputMode] = useState('gas') // 'gas' = MCF/day, 'power' = MW
  const [gasFlowMcf, setGasFlowMcf] = useState(3000)      // MCF per day
  const [powerMw, setPowerMw] = useState(4.8)             // MW capacity input
  const [heatRate, setHeatRate] = useState(11500)         // BTU/kWh (NGEN-400 spec: 4600 scf/hr ÷ 400kW)
  const [hhv, setHhv] = useState(1000)                    // BTU/scf (standard natural gas)
  const [wahaPrice, setWahaPrice] = useState(1.50)        // $/MCF Waha index
  const [wahaAdder, setWahaAdder] = useState(0.45)        // $/MCF adder (Fluxigor $0.17 + transport)
  const [availability, setAvailability] = useState(0.95)  // uptime %
  const [parasiticLoad, setParasiticLoad] = useState(0.05)
  const [loadFactor, setLoadFactor] = useState(1)

  // Generator economics (defaults: Taylor Power TGR400/NGEN-400)
  const [generatorCount, setGeneratorCount] = useState(12)
  const [generatorSizeKw, setGeneratorSizeKw] = useState(400)
  const [generatorMode, setGeneratorMode] = useState('rto') // rent | buy | rto | finance
  const [generatorRentMonthly, setGeneratorRentMonthly] = useState(9500)      // $/mo no maintenance
  const [generatorBuyPrice, setGeneratorBuyPrice] = useState(171205)          // Taylor Power quote
  const [generatorBuyMaintenance, setGeneratorBuyMaintenance] = useState(1500) // $/mo if owned
  const [generatorRtoMonthly, setGeneratorRtoMonthly] = useState(12500)       // $/mo includes maintenance
  const [generatorRtoTerm, setGeneratorRtoTerm] = useState(28)                // months to ownership
  const [generatorRtoEquityPct, setGeneratorRtoEquityPct] = useState(0.50)    // 50% toward purchase
  const [generatorRtoPostMaint, setGeneratorRtoPostMaint] = useState(1500)    // $/mo maintenance after ownership

  // Financing option
  const [financeRate, setFinanceRate] = useState(8.5)                         // annual interest rate %
  const [financeTerm, setFinanceTerm] = useState(60)                          // loan term in months
  const [financeDownPct, setFinanceDownPct] = useState(20)                    // down payment %

  // Generator lifecycle (for Buy mode cost projections)
  const [generatorLifetimeHours, setGeneratorLifetimeHours] = useState(60000) // total hours
  const [topOverhaulHours, setTopOverhaulHours] = useState(20000)             // hours between top overhauls
  const [topOverhaulCost, setTopOverhaulCost] = useState(20000)               // $ per top overhaul
  const [majorOverhaulHours, setMajorOverhaulHours] = useState(40000)         // hours between major overhauls
  const [majorOverhaulCost, setMajorOverhaulCost] = useState(40000)           // $ per major overhaul

  // ASIC CAPEX - uses pricePerTh and hashratePerUnit from Business Models (no separate state)

  // Mining extras
  const [poolFee, setPoolFee] = useState(0)
  const [otherOpex, setOtherOpex] = useState(0)

  // Deal Structure - Separate splits for each model
  // Co-Mining splits (lower capital, lower investor share)
  const [coPhase1Pct, setCoPhase1Pct] = useState(0.70)   // 70% until ROI
  const [coPhase2Pct, setCoPhase2Pct] = useState(0.50)   // 50% after ROI

  // Self-Mining splits (higher capital, higher investor share)
  const [selfPhase1Pct, setSelfPhase1Pct] = useState(0.85)  // 85% until ROI
  const [selfPhase2Pct, setSelfPhase2Pct] = useState(0.50)  // 50% after ROI

  // Calculations - compute BOTH models for comparison
  const results = useMemo(() => {
    // Facility base calculations
    const miners = Math.floor(facilityMW * 1000 / minerPowerKW)
    const totalHashratePH = (miners * hashratePerUnit) / 1000  // PH/s
    const effectiveHashratePH = totalHashratePH * (1 - curtailment)  // after curtailment
    const minerCost = miners * hashratePerUnit * pricePerTh
    const uptime = 1 - curtailment

    // CAPEX breakdown
    const coMiningCapex = siteBuildCost  // Co-Mining: only site, no miners
    const selfMiningCapex = siteBuildCost + minerCost  // Self-Mining: site + miners

    // ========== CO-MINING MODEL ==========
    const coHashratePH = effectiveHashratePH * coMiningShare
    const coGrossRevenue = coHashratePH * hashprice * 30
    const coPowerCost = (energyPrice / 100) * minerPowerKW * miners * 720 * uptime * coMiningShare
    const coNetMonthly = coGrossRevenue - coPowerCost - monthlyOpex
    const coAnnualNet = coNetMonthly * 12

    // ========== SELF-MINING MODEL ==========
    const selfHashratePH = effectiveHashratePH  // 100%
    const selfGrossRevenue = selfHashratePH * hashprice * 30
    const selfPowerCost = (energyPrice / 100) * minerPowerKW * miners * 720 * uptime
    const selfNetMonthly = selfGrossRevenue - selfPowerCost - monthlyOpex
    const selfAnnualNet = selfNetMonthly * 12

    // ========== DEAL STRUCTURE (separate splits per model) ==========
    // Co-Mining Deal (70/30 default)
    const coPhase1Investor = coNetMonthly * coPhase1Pct
    const coPhase1Operator = coNetMonthly * (1 - coPhase1Pct)
    const coPhase2Investor = coNetMonthly * coPhase2Pct
    const coPhase2Operator = coNetMonthly * (1 - coPhase2Pct)
    const coPayback = coPhase1Investor > 0 ? coMiningCapex / coPhase1Investor : Infinity
    const coROI = coMiningCapex > 0 ? (coPhase1Investor * 12 / coMiningCapex * 100) : 0

    // Self-Mining Deal (85/15 default)
    const selfPhase1Investor = selfNetMonthly * selfPhase1Pct
    const selfPhase1Operator = selfNetMonthly * (1 - selfPhase1Pct)
    const selfPhase2Investor = selfNetMonthly * selfPhase2Pct
    const selfPhase2Operator = selfNetMonthly * (1 - selfPhase2Pct)
    const selfPayback = selfPhase1Investor > 0 ? selfMiningCapex / selfPhase1Investor : Infinity
    const selfROI = selfMiningCapex > 0 ? (selfPhase1Investor * 12 / selfMiningCapex * 100) : 0

    // ========== HYBRID MODEL (Mixed) ==========
    const mixCapex = coMiningCapex * (1 - modelMix) + selfMiningCapex * modelMix
    const mixHashratePH = coHashratePH * (1 - modelMix) + selfHashratePH * modelMix
    const mixGrossRevenue = coGrossRevenue * (1 - modelMix) + selfGrossRevenue * modelMix
    const mixPowerCost = coPowerCost * (1 - modelMix) + selfPowerCost * modelMix
    const mixNetMonthly = mixGrossRevenue - mixPowerCost - monthlyOpex
    const mixAnnualNet = mixNetMonthly * 12
    // Blend the investor percentages based on mix
    const mixPhase1Pct = coPhase1Pct * (1 - modelMix) + selfPhase1Pct * modelMix
    const mixPhase2Pct = coPhase2Pct * (1 - modelMix) + selfPhase2Pct * modelMix
    const mixPhase1Investor = mixNetMonthly * mixPhase1Pct
    const mixPhase1Operator = mixNetMonthly * (1 - mixPhase1Pct)
    const mixPhase2Investor = mixNetMonthly * mixPhase2Pct
    const mixPhase2Operator = mixNetMonthly * (1 - mixPhase2Pct)
    const mixPayback = mixPhase1Investor > 0 ? mixCapex / mixPhase1Investor : Infinity
    const mixROI = mixCapex > 0 ? (mixPhase1Investor * 12 / mixCapex * 100) : 0

    return {
      // Facility
      miners,
      totalHashratePH,
      effectiveHashratePH,
      minerCost,
      uptime,
      // CAPEX
      coMiningCapex,
      selfMiningCapex,
      // Co-Mining
      coHashratePH,
      coGrossRevenue,
      coPowerCost,
      coNetMonthly,
      coAnnualNet,
      coPhase1Investor,
      coPhase1Operator,
      coPhase2Investor,
      coPhase2Operator,
      coPayback,
      coROI,
      // Self-Mining
      selfHashratePH,
      selfGrossRevenue,
      selfPowerCost,
      selfNetMonthly,
      selfAnnualNet,
      selfPhase1Investor,
      selfPhase1Operator,
      selfPhase2Investor,
      selfPhase2Operator,
      selfPayback,
      selfROI,
      // Hybrid/Mix
      mixCapex,
      mixHashratePH,
      mixGrossRevenue,
      mixPowerCost,
      mixNetMonthly,
      mixAnnualNet,
      mixPhase1Pct,
      mixPhase2Pct,
      mixPhase1Investor,
      mixPhase1Operator,
      mixPhase2Investor,
      mixPhase2Operator,
      mixPayback,
      mixROI,
    }
  }, [facilityMW, curtailment, energyPrice, hashprice, monthlyOpex,
      siteBuildCost, minerPowerKW, hashratePerUnit, pricePerTh,
      coPhase1Pct, coPhase2Pct, selfPhase1Pct, selfPhase2Pct, coMiningShare, modelMix])

  const formatCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`
    return `$${val.toFixed(0)}`
  }

  // Full precision currency (no abbreviation)
  const formatCurrencyFull = (val) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`

  const formatNumber = (val) => val.toLocaleString()

  const gasResults = useMemo(() => {
    const cleanAvailability = Math.min(Math.max(availability, 0), 1)
    const cleanParasitic = Math.min(Math.max(parasiticLoad, 0), 0.5)
    const cleanLoadFactor = Math.min(Math.max(loadFactor, 0), 1.2)

    // Fleet capacity is the source of truth
    const fleetCapacityMw = (generatorCount * generatorSizeKw) / 1000
    const mwGross = fleetCapacityMw

    // Calculate gas required for this fleet
    // MW → kWh/day → BTU/day → scf/day → MCF/day
    const kwhPerDay = mwGross * 1000 * 24
    const btuPerDay = kwhPerDay * heatRate
    const mcfPerDay = btuPerDay / (hhv * 1000)

    // Net available power after losses
    const availableMw = mwGross * cleanAvailability * (1 - cleanParasitic) * cleanLoadFactor
    const totalKw = availableMw * 1000
    const miners = Math.max(Math.floor(totalKw / minerPowerKW), 0)
    const phs = (miners * hashratePerUnit) / 1000
    const effectivePhs = phs * (1 - poolFee)
    const gasPrice = wahaPrice + wahaAdder
    const gasMonthly = mcfPerDay * gasPrice * 30

    let generatorMonthly = 0
    let generatorCapex = 0
    let generatorEquityBuilt = 0

    // RTO calculations
    const rtoEquityPerMonth = generatorRtoMonthly * generatorRtoEquityPct // equity per generator per month
    const rtoMonthsToOwn = generatorBuyPrice > 0 ? Math.ceil(generatorBuyPrice / rtoEquityPerMonth) : 0
    const rtoTotalPaid = generatorRtoMonthly * rtoMonthsToOwn * generatorCount
    const rtoPremium = rtoTotalPaid - (generatorBuyPrice * generatorCount) // cost above purchase price
    const rtoPostOwnershipMonthly = generatorRtoPostMaint * generatorCount // after you own them

    // Financing calculations (standard amortization formula)
    const financeAmountPerUnit = generatorBuyPrice * (1 - financeDownPct / 100)
    const financeDownPayment = generatorBuyPrice * (financeDownPct / 100) * generatorCount
    const financeMonthlyRate = financeRate / 100 / 12
    const financePaymentPerUnit = financeMonthlyRate > 0
      ? (financeAmountPerUnit * financeMonthlyRate * Math.pow(1 + financeMonthlyRate, financeTerm)) /
        (Math.pow(1 + financeMonthlyRate, financeTerm) - 1)
      : financeAmountPerUnit / financeTerm
    const financeMonthlyPayment = financePaymentPerUnit * generatorCount
    const financeTotalPaid = (financePaymentPerUnit * financeTerm * generatorCount) + financeDownPayment
    const financeTotalInterest = financeTotalPaid - (generatorBuyPrice * generatorCount)
    const financePostOwnershipMonthly = generatorBuyMaintenance * generatorCount // after loan paid off

    if (generatorMode === 'rent') {
      generatorMonthly = generatorRentMonthly * generatorCount
    } else if (generatorMode === 'buy') {
      generatorMonthly = generatorBuyMaintenance * generatorCount
      generatorCapex = generatorBuyPrice * generatorCount
    } else if (generatorMode === 'rto') {
      generatorMonthly = generatorRtoMonthly * generatorCount
      generatorEquityBuilt = generatorRtoMonthly * generatorRtoEquityPct * generatorCount * rtoMonthsToOwn
    } else if (generatorMode === 'finance') {
      generatorMonthly = financeMonthlyPayment + (generatorBuyMaintenance * generatorCount) // loan + maintenance
      generatorCapex = financeDownPayment // only down payment is upfront CAPEX
    }

    // ASIC CAPEX - calculated from $/TH × TH/s (same as Business Models)
    const asicPricePerUnit = pricePerTh * hashratePerUnit
    const asicCapex = miners * asicPricePerUnit
    const totalCapex = generatorCapex + asicCapex

    const monthlyRevenue = effectivePhs * hashprice * 30
    const totalOpex = gasMonthly + generatorMonthly + otherOpex
    const netMonthly = monthlyRevenue - totalOpex

    // Effective $/kWh from gas-to-power
    const kwhPerMonth = availableMw * 24 * 30 * 1000
    const powerCostPerKwh = kwhPerMonth > 0 ? (gasMonthly + generatorMonthly) / kwhPerMonth : 0

    // Breakeven hashprice (where net = 0)
    const breakevenHashprice = effectivePhs > 0 ? totalOpex / (effectivePhs * 30) : 0

    // Annual projection
    const annualRevenue = monthlyRevenue * 12
    const annualOpex = totalOpex * 12
    const annualNet = netMonthly * 12

    // Payback period (months)
    const paybackMonths = netMonthly > 0 && totalCapex > 0 ? totalCapex / netMonthly : Infinity

    // Grid power comparison: what grid $/kWh would match this cost?
    const gridEquivalentPerKwh = kwhPerMonth > 0 ? totalOpex / kwhPerMonth : 0

    // Generator lifecycle calculations
    const hoursPerYear = 24 * 365 * cleanAvailability // ~8,322 hrs/yr at 95%
    const lifetimeYears = generatorLifetimeHours / hoursPerYear
    const topOverhaulYears = topOverhaulHours / hoursPerYear
    const majorOverhaulYears = majorOverhaulHours / hoursPerYear
    // Number of overhauls over lifetime (per generator)
    const topOverhaulCount = Math.floor(generatorLifetimeHours / topOverhaulHours)
    const majorOverhaulCount = Math.floor(generatorLifetimeHours / majorOverhaulHours)
    // Total overhaul costs over lifetime (all generators)
    const totalTopOverhaulCost = topOverhaulCount * topOverhaulCost * generatorCount
    const totalMajorOverhaulCost = majorOverhaulCount * majorOverhaulCost * generatorCount
    const totalOverhaulCost = totalTopOverhaulCost + totalMajorOverhaulCost
    // Annualized overhaul cost
    const annualOverhaulCost = lifetimeYears > 0 ? totalOverhaulCost / lifetimeYears : 0

    return {
      mcfPerDay,
      mwGross,
      availableMw,
      fleetCapacityMw,
      miners,
      phs,
      effectivePhs,
      gasPrice,
      gasMonthly,
      generatorMonthly,
      generatorCapex,
      asicCapex,
      asicPricePerUnit,
      totalCapex,
      generatorEquityBuilt,
      monthlyRevenue,
      totalOpex,
      netMonthly,
      powerCostPerKwh,
      breakevenHashprice,
      annualRevenue,
      annualOpex,
      annualNet,
      paybackMonths,
      gridEquivalentPerKwh,
      // Lifecycle
      hoursPerYear,
      lifetimeYears,
      topOverhaulYears,
      majorOverhaulYears,
      topOverhaulCount,
      majorOverhaulCount,
      totalOverhaulCost,
      annualOverhaulCost,
      // RTO post-ownership
      rtoEquityPerMonth,
      rtoMonthsToOwn,
      rtoTotalPaid,
      rtoPremium,
      rtoPostOwnershipMonthly,
      // Financing
      financeAmountPerUnit,
      financeDownPayment,
      financeMonthlyPayment,
      financePaymentPerUnit,
      financeTotalPaid,
      financeTotalInterest,
      financePostOwnershipMonthly,
    }
  }, [
    availability,
    financeDownPct,
    financeRate,
    financeTerm,
    generatorBuyMaintenance,
    generatorBuyPrice,
    generatorCount,
    generatorLifetimeHours,
    generatorMode,
    generatorRentMonthly,
    generatorRtoEquityPct,
    generatorRtoMonthly,
    generatorRtoPostMaint,
    generatorRtoTerm,
    generatorSizeKw,
    hashratePerUnit,
    hashprice,
    heatRate,
    hhv,
    loadFactor,
    majorOverhaulCost,
    majorOverhaulHours,
    minerPowerKW,
    otherOpex,
    parasiticLoad,
    poolFee,
    pricePerTh,
    topOverhaulCost,
    topOverhaulHours,
    wahaAdder,
    wahaPrice,
  ])

  return (
    <div className="app">
      <header>
        <h1>Pecos 15 MW Bitcoin Mining</h1>
        <p className="subtitle">Astro Solutions LLC</p>
      </header>

      {/* Mode Toggle */}
      <section className="scenario-toggle">
        {showGas && (
          <>
            <button
              className={mode === 'power' ? 'active' : ''}
              onClick={() => setMode('power')}
            >
              Power Generation
            </button>
            <button
              className={mode === 'gas' ? 'active' : ''}
              onClick={() => setMode('gas')}
            >
              Gas-to-Power Mining
            </button>
          </>
        )}
        <button
          className={mode === 'models' ? 'active' : ''}
          onClick={() => setMode('models')}
        >
          Business Models
        </button>
        <button
          className={mode === 'deal' ? 'active' : ''}
          onClick={() => setMode('deal')}
        >
          Deal Structure
        </button>
      </section>

      {/* ============ POWER GENERATION CALCULATOR ============ */}
      {mode === 'power' && (
        <>
          <section className="gas-hero">
            <div>
              <h2>Power Generation Economics</h2>
              <p className="section-intro">Calculate gas-to-power costs, generator fleet economics, and effective $/kWh.</p>
            </div>
          </section>

          <section className="gas-grid">
            {/* Generator Fleet */}
            <div className="card">
              <div className="card-header">
                <h3>Generator Fleet</h3>
              </div>
              <div className="card-body">
                <div className="input-row">
                  <label>Generator Model</label>
                  <select
                    className="preset-select"
                    defaultValue="ngen400"
                    onChange={e => {
                      if (e.target.value === 'ngen400') {
                        setGeneratorSizeKw(400)
                        setHeatRate(11500)
                        setGeneratorBuyPrice(171205)
                        setGeneratorRtoMonthly(12500)
                        setGeneratorRentMonthly(9500)
                      } else if (e.target.value === 'cat3516') {
                        setGeneratorSizeKw(1600)
                        setHeatRate(9800)
                        setGeneratorBuyPrice(450000)
                        setGeneratorRtoMonthly(25000)
                        setGeneratorRentMonthly(18000)
                      }
                    }}
                  >
                    <option value="ngen400">NGEN-400 / TGR400 (400kW, 11,500 BTU/kWh)</option>
                    <option value="cat3516">CAT G3516 (1.6MW, 9,800 BTU/kWh)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Generator Count</label>
                    <input
                      type="number"
                      value={generatorCount}
                      onChange={e => setGeneratorCount(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Size per Generator (kW)</label>
                    <input
                      type="number"
                      value={generatorSizeKw}
                      onChange={e => setGeneratorSizeKw(+e.target.value)}
                    />
                  </div>
                </div>

                <div className="result-row compact total">
                  <span>Fleet Capacity</span>
                  <span className="highlight">{gasResults.fleetCapacityMw.toFixed(2)} MW</span>
                </div>

                <div className="pill-toggle small" style={{marginTop: '12px'}}>
                  <button className={generatorMode === 'rent' ? 'active' : ''} onClick={() => setGeneratorMode('rent')}>Rent</button>
                  <button className={generatorMode === 'buy' ? 'active' : ''} onClick={() => setGeneratorMode('buy')}>Buy</button>
                  <button className={generatorMode === 'rto' ? 'active' : ''} onClick={() => setGeneratorMode('rto')}>RTO</button>
                  <button className={generatorMode === 'finance' ? 'active' : ''} onClick={() => setGeneratorMode('finance')}>Finance</button>
                </div>

                {generatorMode === 'rent' && (
                  <div className="input-row">
                    <label>Rent ($/generator/month)</label>
                    <input type="number" value={generatorRentMonthly} onChange={e => setGeneratorRentMonthly(+e.target.value)} />
                  </div>
                )}

                {generatorMode === 'buy' && (
                  <>
                    <div className="input-row two-col">
                      <div>
                        <label>Purchase Price ($/unit)</label>
                        <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(+e.target.value)} />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(+e.target.value)} />
                      </div>
                    </div>
                    <div className="result-row compact">
                      <span>Generator CAPEX</span>
                      <span className="highlight">{formatCurrencyFull(gasResults.generatorCapex)}</span>
                    </div>
                  </>
                )}

                {generatorMode === 'rto' && (
                  <>
                    <div className="input-row">
                      <label>RTO Payment ($/generator/month)</label>
                      <input type="number" value={generatorRtoMonthly} onChange={e => setGeneratorRtoMonthly(+e.target.value)} />
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Equity Portion (%)</label>
                        <input type="number" value={(generatorRtoEquityPct * 100).toFixed(0)} onChange={e => setGeneratorRtoEquityPct(+e.target.value / 100)} />
                      </div>
                      <div>
                        <label>Post-Ownership Maint ($/unit/mo)</label>
                        <input type="number" value={generatorRtoPostMaint} onChange={e => setGeneratorRtoPostMaint(+e.target.value)} />
                      </div>
                    </div>
                    <div className="result-row compact">
                      <span>Months to Ownership</span>
                      <span className="highlight">{gasResults.rtoMonthsToOwn} months</span>
                    </div>
                    <div className="result-row compact">
                      <span>Total Paid (fleet)</span>
                      <span>{formatCurrencyFull(gasResults.rtoTotalPaid)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Post-Ownership Cost</span>
                      <span className="green">{formatCurrencyFull(gasResults.rtoPostOwnershipMonthly)}/mo</span>
                    </div>
                  </>
                )}

                {generatorMode === 'finance' && (
                  <>
                    <div className="input-row two-col">
                      <div>
                        <label>Purchase Price ($/unit)</label>
                        <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(+e.target.value)} />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(+e.target.value)} />
                      </div>
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Interest Rate (%)</label>
                        <input type="number" step="0.1" value={financeRate} onChange={e => setFinanceRate(+e.target.value)} />
                      </div>
                      <div>
                        <label>Term (months)</label>
                        <input type="number" value={financeTerm} onChange={e => setFinanceTerm(+e.target.value)} />
                      </div>
                    </div>
                    <div className="input-row">
                      <label>Down Payment (%)</label>
                      <input type="number" value={financeDownPct} onChange={e => setFinanceDownPct(+e.target.value)} />
                    </div>
                    <div className="result-row compact">
                      <span>Down Payment</span>
                      <span>{formatCurrencyFull(gasResults.financeDownPayment)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Monthly Loan Payment</span>
                      <span className="highlight">{formatCurrencyFull(gasResults.financeMonthlyPayment)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Total Interest</span>
                      <span style={{color: '#ef4444'}}>{formatCurrencyFull(gasResults.financeTotalInterest)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Post-Loan Cost</span>
                      <span className="green">{formatCurrencyFull(gasResults.financePostOwnershipMonthly)}/mo</span>
                    </div>
                  </>
                )}

                <div className="result-row compact total">
                  <span>Monthly Generator Cost</span>
                  <span className="highlight">{formatCurrencyFull(gasResults.generatorMonthly)}</span>
                </div>
              </div>
            </div>

            {/* Gas & Efficiency */}
            <div className="card">
              <div className="card-header">
                <h3>Gas & Efficiency</h3>
              </div>
              <div className="card-body">
                <div className="input-row two-col">
                  <div>
                    <label>Heat Rate (BTU/kWh)</label>
                    <input type="number" value={heatRate} onChange={e => setHeatRate(+e.target.value)} />
                  </div>
                  <div>
                    <label>HHV (BTU/scf)</label>
                    <input type="number" value={hhv} onChange={e => setHhv(+e.target.value)} />
                  </div>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Waha Index ($/MCF)</label>
                    <input type="number" step="0.01" value={wahaPrice} onChange={e => setWahaPrice(+e.target.value)} />
                  </div>
                  <div>
                    <label>Adder ($/MCF)</label>
                    <input type="number" step="0.01" value={wahaAdder} onChange={e => setWahaAdder(+e.target.value)} />
                  </div>
                </div>

                <div className="result-row compact">
                  <span>Gas Price (all-in)</span>
                  <span className="highlight">${gasResults.gasPrice.toFixed(2)}/MCF</span>
                </div>

                <div className="input-row two-col" style={{marginTop: '12px'}}>
                  <div>
                    <label>Availability ({Math.round(availability * 100)}%)</label>
                    <input type="range" min="0.8" max="1" step="0.01" value={availability} onChange={e => setAvailability(+e.target.value)} />
                  </div>
                  <div>
                    <label>Parasitic Load ({Math.round(parasiticLoad * 100)}%)</label>
                    <input type="range" min="0" max="0.2" step="0.01" value={parasiticLoad} onChange={e => setParasiticLoad(+e.target.value)} />
                  </div>
                </div>

                <div className="result-row compact" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                  <span>Gas Required</span>
                  <span className="highlight">{gasResults.mcfPerDay.toFixed(0)} MCF/day</span>
                </div>
                <div className="result-row compact">
                  <span>Net Power Output</span>
                  <span className="highlight">{gasResults.availableMw.toFixed(2)} MW</span>
                </div>
                <div className="result-row compact">
                  <span>Monthly Gas Cost</span>
                  <span className="highlight">{formatCurrencyFull(gasResults.gasMonthly)}</span>
                </div>
              </div>
            </div>

            {/* Lifecycle (Buy mode only) */}
            {generatorMode === 'buy' && (
              <div className="card">
                <div className="card-header">
                  <h3>Generator Lifecycle</h3>
                </div>
                <div className="card-body">
                  <div className="input-row two-col">
                    <div>
                      <label>Lifetime (hours)</label>
                      <input type="number" value={generatorLifetimeHours} onChange={e => setGeneratorLifetimeHours(+e.target.value)} />
                    </div>
                    <div>
                      <label>Hours/Year</label>
                      <div className="computed-value">{gasResults.hoursPerYear.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                    </div>
                  </div>
                  <div className="input-row two-col">
                    <div>
                      <label>Top Overhaul @ (hours)</label>
                      <input type="number" value={topOverhaulHours} onChange={e => setTopOverhaulHours(+e.target.value)} />
                    </div>
                    <div>
                      <label>Cost ($)</label>
                      <input type="number" value={topOverhaulCost} onChange={e => setTopOverhaulCost(+e.target.value)} />
                    </div>
                  </div>
                  <div className="input-row two-col">
                    <div>
                      <label>Major Overhaul @ (hours)</label>
                      <input type="number" value={majorOverhaulHours} onChange={e => setMajorOverhaulHours(+e.target.value)} />
                    </div>
                    <div>
                      <label>Cost ($)</label>
                      <input type="number" value={majorOverhaulCost} onChange={e => setMajorOverhaulCost(+e.target.value)} />
                    </div>
                  </div>

                  <div className="result-row compact" style={{marginTop: '8px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                    <span>Lifetime</span>
                    <span>{gasResults.lifetimeYears.toFixed(1)} years</span>
                  </div>
                  <div className="result-row compact">
                    <span>Top Overhauls</span>
                    <span>{gasResults.topOverhaulCount}× @ {formatCurrencyFull(topOverhaulCost)} (every {gasResults.topOverhaulYears.toFixed(1)} yrs)</span>
                  </div>
                  <div className="result-row compact">
                    <span>Major Overhauls</span>
                    <span>{gasResults.majorOverhaulCount}× @ {formatCurrencyFull(majorOverhaulCost)} (every {gasResults.majorOverhaulYears.toFixed(1)} yrs)</span>
                  </div>
                  <div className="result-row compact total">
                    <span>Total Overhaul Cost (lifetime)</span>
                    <span className="highlight">{formatCurrencyFull(gasResults.totalOverhaulCost)}</span>
                  </div>
                  <div className="result-row compact">
                    <span>Annualized</span>
                    <span>{formatCurrencyFull(gasResults.annualOverhaulCost)}/yr</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Power Generation Results */}
          <section className="results-section">
            <h2>Power Generation Summary</h2>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Fleet Capacity</span>
                <span className="stat-value">{gasResults.fleetCapacityMw.toFixed(2)} MW</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Net Output</span>
                <span className="stat-value">{gasResults.availableMw.toFixed(2)} MW</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Gas Required</span>
                <span className="stat-value">{gasResults.mcfPerDay.toFixed(0)} MCF/day</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Effective $/kWh</span>
                <span className="stat-value">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Gas Cost</span>
                <span className="stat-value red">{formatCurrency(gasResults.gasMonthly)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Generator Cost</span>
                <span className="stat-value red">{formatCurrency(gasResults.generatorMonthly)}</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Total Monthly Cost</span>
                <span className="stat-value">{formatCurrency(gasResults.gasMonthly + gasResults.generatorMonthly)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Annual Power Cost</span>
                <span className="stat-value">{formatCurrency((gasResults.gasMonthly + gasResults.generatorMonthly) * 12)}</span>
              </div>
            </div>

            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>Power Output</span>
                <span>{gasResults.availableMw.toFixed(2)} MW × 24h × 30d = {(gasResults.availableMw * 24 * 30).toFixed(0).toLocaleString()} MWh/month</span>
              </div>
              <div className="table-row">
                <span>Gas Consumption</span>
                <span>{gasResults.mcfPerDay.toFixed(0)} MCF/day × 30d = {(gasResults.mcfPerDay * 30).toFixed(0).toLocaleString()} MCF/month</span>
              </div>
              <div className="table-row">
                <span>Gas Cost</span>
                <span>{(gasResults.mcfPerDay * 30).toFixed(0).toLocaleString()} MCF × ${gasResults.gasPrice.toFixed(2)} = {formatCurrencyFull(gasResults.gasMonthly)}</span>
              </div>
              <div className="table-row">
                <span>Generator Cost ({generatorMode.toUpperCase()})</span>
                <span>
                  {generatorMode === 'rent' && `${generatorCount} units × $${generatorRentMonthly.toLocaleString()}/mo = ${formatCurrencyFull(gasResults.generatorMonthly)}`}
                  {generatorMode === 'buy' && `${generatorCount} units × $${generatorBuyMaintenance.toLocaleString()}/mo (maint) = ${formatCurrencyFull(gasResults.generatorMonthly)}`}
                  {generatorMode === 'rto' && `${generatorCount} units × $${generatorRtoMonthly.toLocaleString()}/mo = ${formatCurrencyFull(gasResults.generatorMonthly)}`}
                  {generatorMode === 'finance' && `Loan ${formatCurrencyFull(gasResults.financeMonthlyPayment)} + Maint ${formatCurrencyFull(generatorBuyMaintenance * generatorCount)} = ${formatCurrencyFull(gasResults.generatorMonthly)}`}
                </span>
              </div>
              <div className="table-row total">
                <span>Effective Power Cost</span>
                <span className="highlight">{formatCurrencyFull(gasResults.gasMonthly + gasResults.generatorMonthly)} ÷ {(gasResults.availableMw * 24 * 30 * 1000).toLocaleString()} kWh = <strong>{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢/kWh</strong></span>
              </div>
            </div>

            {/* Grid Comparison */}
            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>vs Grid @ 4¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.04 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.04
                    ? `Saving ${formatCurrency((0.04 - gasResults.powerCostPerKwh) * gasResults.availableMw * 24 * 30 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.04) * gasResults.availableMw * 24 * 30 * 1000)}/mo more`}
                </span>
              </div>
              <div className="table-row">
                <span>vs Grid @ 5¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.05 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.05
                    ? `Saving ${formatCurrency((0.05 - gasResults.powerCostPerKwh) * gasResults.availableMw * 24 * 30 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.05) * gasResults.availableMw * 24 * 30 * 1000)}/mo more`}
                </span>
              </div>
              <div className="table-row">
                <span>vs Grid @ 6¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.06 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.06
                    ? `Saving ${formatCurrency((0.06 - gasResults.powerCostPerKwh) * gasResults.availableMw * 24 * 30 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.06) * gasResults.availableMw * 24 * 30 * 1000)}/mo more`}
                </span>
              </div>
            </div>

            {/* Acquisition Comparison Table */}
            <h3 style={{marginTop: '32px', marginBottom: '16px'}}>Generator Acquisition Comparison</h3>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Rent</th>
                    <th>Buy</th>
                    <th>RTO</th>
                    <th>Finance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Upfront Cost</td>
                    <td>$0</td>
                    <td>{formatCurrencyFull(generatorBuyPrice * generatorCount)}</td>
                    <td>$0</td>
                    <td>{formatCurrencyFull(gasResults.financeDownPayment)}</td>
                  </tr>
                  <tr>
                    <td>Monthly Payment</td>
                    <td>{formatCurrencyFull(generatorRentMonthly * generatorCount)}</td>
                    <td>{formatCurrencyFull(generatorBuyMaintenance * generatorCount)}</td>
                    <td>{formatCurrencyFull(generatorRtoMonthly * generatorCount)}</td>
                    <td>{formatCurrencyFull(gasResults.financeMonthlyPayment + generatorBuyMaintenance * generatorCount)}</td>
                  </tr>
                  <tr>
                    <td>Own After</td>
                    <td>Never</td>
                    <td>Day 1</td>
                    <td>{gasResults.rtoMonthsToOwn} months</td>
                    <td>{financeTerm} months</td>
                  </tr>
                  <tr>
                    <td>Post-Ownership Cost</td>
                    <td>N/A</td>
                    <td>{formatCurrencyFull(generatorBuyMaintenance * generatorCount)}/mo</td>
                    <td>{formatCurrencyFull(gasResults.rtoPostOwnershipMonthly)}/mo</td>
                    <td>{formatCurrencyFull(gasResults.financePostOwnershipMonthly)}/mo</td>
                  </tr>
                  <tr>
                    <td>Total Cost (5yr)</td>
                    <td>{formatCurrencyFull(generatorRentMonthly * generatorCount * 60)}</td>
                    <td>{formatCurrencyFull(generatorBuyPrice * generatorCount + generatorBuyMaintenance * generatorCount * 60)}</td>
                    <td>{formatCurrencyFull(gasResults.rtoTotalPaid + gasResults.rtoPostOwnershipMonthly * Math.max(0, 60 - gasResults.rtoMonthsToOwn))}</td>
                    <td>{formatCurrencyFull(gasResults.financeTotalPaid + gasResults.financePostOwnershipMonthly * Math.max(0, 60 - financeTerm))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CAPEX Summary (Buy mode) */}
            {generatorMode === 'buy' && (
              <div className="simple-table" style={{marginTop: '20px'}}>
                <div className="table-row">
                  <span>Generator CAPEX</span>
                  <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
                </div>
                <div className="table-row">
                  <span>Lifetime Overhaul Cost</span>
                  <span>{formatCurrencyFull(gasResults.totalOverhaulCost)}</span>
                </div>
                <div className="table-row total">
                  <span>Total Ownership Cost ({gasResults.lifetimeYears.toFixed(1)} yrs)</span>
                  <span className="highlight">{formatCurrencyFull(gasResults.generatorCapex + gasResults.totalOverhaulCost)}</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ============ GAS-TO-POWER MINING CALCULATOR ============ */}
      {mode === 'gas' && (
        <>
          <section className="gas-hero">
            <div>
              <h2>Gas-to-Power Bitcoin Mining</h2>
              <p className="section-intro">Size your generator fleet — gas requirements and mining output calculate automatically.</p>
            </div>
          </section>

          <section className="gas-grid">
            {/* Generator Fleet - Primary Input */}
            <div className="card">
              <div className="card-header">
                <h3>Generator Fleet</h3>
              </div>
              <div className="card-body">
                {/* Generator Preset */}
                <div className="input-row">
                  <label>Generator Model</label>
                  <select
                    value="ngen400"
                    onChange={e => {
                      if (e.target.value === 'ngen400') {
                        setGeneratorSizeKw(400)
                        setHeatRate(11500)
                        setGeneratorBuyPrice(171205)
                        setGeneratorRtoMonthly(12500)
                        setGeneratorRentMonthly(9500)
                      } else if (e.target.value === 'cat3516') {
                        setGeneratorSizeKw(1600)
                        setHeatRate(9800)
                        setGeneratorBuyPrice(450000)
                        setGeneratorRtoMonthly(25000)
                        setGeneratorRentMonthly(18000)
                      } else if (e.target.value === 'custom') {
                        // keep current values
                      }
                    }}
                    className="preset-select"
                  >
                    <option value="ngen400">NGEN-400 / TGR400 (400kW)</option>
                    <option value="cat3516">CAT G3516 (1.6MW)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Generator Count</label>
                    <input
                      type="number"
                      value={generatorCount}
                      onChange={e => setGeneratorCount(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Size per Generator (kW)</label>
                    <input
                      type="number"
                      value={generatorSizeKw}
                      onChange={e => setGeneratorSizeKw(+e.target.value)}
                    />
                  </div>
                </div>


                <div className="pill-toggle small">
                  <button
                    className={generatorMode === 'rent' ? 'active' : ''}
                    onClick={() => setGeneratorMode('rent')}
                  >
                    Rent
                  </button>
                  <button
                    className={generatorMode === 'buy' ? 'active' : ''}
                    onClick={() => setGeneratorMode('buy')}
                  >
                    Buy
                  </button>
                  <button
                    className={generatorMode === 'rto' ? 'active' : ''}
                    onClick={() => setGeneratorMode('rto')}
                  >
                    RTO
                  </button>
                  <button
                    className={generatorMode === 'finance' ? 'active' : ''}
                    onClick={() => setGeneratorMode('finance')}
                  >
                    Finance
                  </button>
                </div>

                {generatorMode === 'rent' && (
                  <>
                    <div className="input-row">
                      <label>Rent ($/generator/month)</label>
                      <input
                        type="number"
                        value={generatorRentMonthly}
                        onChange={e => setGeneratorRentMonthly(+e.target.value)}
                      />
                    </div>
                    <div className="info-row">
                      Note: Add maintenance costs to "Other Opex" below
                    </div>
                  </>
                )}

                {generatorMode === 'buy' && (
                  <>
                    <div className="input-row two-col">
                      <div>
                        <label>Purchase Price ($/unit)</label>
                        <input
                          type="number"
                          value={generatorBuyPrice}
                          onChange={e => setGeneratorBuyPrice(+e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input
                          type="number"
                          value={generatorBuyMaintenance}
                          onChange={e => setGeneratorBuyMaintenance(+e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="result-row compact">
                      <span>Generator CAPEX</span>
                      <span className="highlight">{formatCurrency(gasResults.generatorCapex)}</span>
                    </div>

                    {/* Lifecycle & Overhauls */}
                    <div className="info-row" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                      Generator Lifecycle & Overhauls
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Lifetime (hours)</label>
                        <input
                          type="number"
                          value={generatorLifetimeHours}
                          onChange={e => setGeneratorLifetimeHours(+e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Hours/Year (computed)</label>
                        <div className="computed-value">{gasResults.hoursPerYear.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                      </div>
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Top Overhaul (hours)</label>
                        <input
                          type="number"
                          value={topOverhaulHours}
                          onChange={e => setTopOverhaulHours(+e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Top Overhaul Cost ($)</label>
                        <input
                          type="number"
                          value={topOverhaulCost}
                          onChange={e => setTopOverhaulCost(+e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Major Overhaul (hours)</label>
                        <input
                          type="number"
                          value={majorOverhaulHours}
                          onChange={e => setMajorOverhaulHours(+e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Major Overhaul Cost ($)</label>
                        <input
                          type="number"
                          value={majorOverhaulCost}
                          onChange={e => setMajorOverhaulCost(+e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="result-row compact">
                      <span>Lifetime</span>
                      <span>{gasResults.lifetimeYears.toFixed(1)} years ({generatorLifetimeHours.toLocaleString()} hrs)</span>
                    </div>
                    <div className="result-row compact">
                      <span>Top Overhauls</span>
                      <span>{gasResults.topOverhaulCount}× per unit @ {formatCurrencyFull(topOverhaulCost)} (every {gasResults.topOverhaulYears.toFixed(1)} yrs)</span>
                    </div>
                    <div className="result-row compact">
                      <span>Major Overhauls</span>
                      <span>{gasResults.majorOverhaulCount}× per unit @ {formatCurrencyFull(majorOverhaulCost)} (every {gasResults.majorOverhaulYears.toFixed(1)} yrs)</span>
                    </div>
                    <div className="result-row compact total">
                      <span>Total Overhaul Cost (fleet lifetime)</span>
                      <span className="highlight">{formatCurrencyFull(gasResults.totalOverhaulCost)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Annualized Overhaul Cost</span>
                      <span>{formatCurrencyFull(gasResults.annualOverhaulCost)}/yr</span>
                    </div>
                  </>
                )}

                {generatorMode === 'rto' && (
                  <>
                    <div className="input-row">
                      <label>RTO Payment ($/generator/month) - includes maintenance</label>
                      <input
                        type="number"
                        value={generatorRtoMonthly}
                        onChange={e => setGeneratorRtoMonthly(+e.target.value)}
                      />
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Equity Portion (%)</label>
                        <input
                          type="number"
                          value={(generatorRtoEquityPct * 100).toFixed(0)}
                          onChange={e => setGeneratorRtoEquityPct(+e.target.value / 100)}
                        />
                      </div>
                      <div>
                        <label>Post-Ownership Maintenance ($/unit/mo)</label>
                        <input
                          type="number"
                          value={generatorRtoPostMaint}
                          onChange={e => setGeneratorRtoPostMaint(+e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="info-row" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                      RTO Economics
                    </div>
                    <div className="result-row compact">
                      <span>Purchase Price (per unit)</span>
                      <span>{formatCurrencyFull(generatorBuyPrice)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Equity Built per Month</span>
                      <span>{formatCurrencyFull(gasResults.rtoEquityPerMonth)}/unit</span>
                    </div>
                    <div className="result-row compact total">
                      <span>Months to Ownership</span>
                      <span className="highlight">{gasResults.rtoMonthsToOwn} months</span>
                    </div>
                    <div className="result-row compact">
                      <span>Total Paid (fleet)</span>
                      <span>{formatCurrencyFull(gasResults.rtoTotalPaid)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Premium Over Purchase</span>
                      <span style={{color: gasResults.rtoPremium > 0 ? '#ef4444' : '#22c55e'}}>
                        {formatCurrencyFull(gasResults.rtoPremium)} ({((gasResults.rtoPremium / (generatorBuyPrice * generatorCount)) * 100).toFixed(1)}%)
                      </span>
                    </div>

                    <div className="info-row" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                      After Ownership ({gasResults.rtoMonthsToOwn}+ months)
                    </div>
                    <div className="result-row compact">
                      <span>Monthly Generator Cost</span>
                      <span className="highlight green">{formatCurrencyFull(gasResults.rtoPostOwnershipMonthly)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Savings vs RTO Period</span>
                      <span className="green">{formatCurrencyFull(gasResults.generatorMonthly - gasResults.rtoPostOwnershipMonthly)}/mo</span>
                    </div>
                  </>
                )}

                {generatorMode === 'finance' && (
                  <>
                    <div className="input-row two-col">
                      <div>
                        <label>Purchase Price ($/unit)</label>
                        <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(+e.target.value)} />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(+e.target.value)} />
                      </div>
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Interest Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={financeRate}
                          onChange={e => setFinanceRate(+e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Term (months)</label>
                        <input
                          type="number"
                          value={financeTerm}
                          onChange={e => setFinanceTerm(+e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="input-row">
                      <label>Down Payment (%)</label>
                      <input
                        type="number"
                        value={financeDownPct}
                        onChange={e => setFinanceDownPct(+e.target.value)}
                      />
                    </div>

                    <div className="info-row" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                      Financing Details
                    </div>
                    <div className="result-row compact">
                      <span>Fleet Purchase Price</span>
                      <span>{formatCurrencyFull(generatorBuyPrice * generatorCount)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Down Payment ({financeDownPct}%)</span>
                      <span>{formatCurrencyFull(gasResults.financeDownPayment)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Financed Amount</span>
                      <span>{formatCurrencyFull(gasResults.financeAmountPerUnit * generatorCount)}</span>
                    </div>
                    <div className="result-row compact total">
                      <span>Monthly Loan Payment</span>
                      <span className="highlight">{formatCurrencyFull(gasResults.financeMonthlyPayment)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Total Interest Over Term</span>
                      <span style={{color: '#ef4444'}}>{formatCurrencyFull(gasResults.financeTotalInterest)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Total Cost (incl. interest)</span>
                      <span>{formatCurrencyFull(gasResults.financeTotalPaid)}</span>
                    </div>

                    <div className="info-row" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                      After Loan Paid ({financeTerm}+ months)
                    </div>
                    <div className="result-row compact">
                      <span>Monthly Generator Cost</span>
                      <span className="highlight green">{formatCurrencyFull(gasResults.financePostOwnershipMonthly)}</span>
                    </div>
                    <div className="result-row compact">
                      <span>Savings vs Loan Period</span>
                      <span className="green">{formatCurrencyFull(gasResults.generatorMonthly - gasResults.financePostOwnershipMonthly)}/mo</span>
                    </div>
                  </>
                )}

                <div className="result-row compact total">
                  <span>Monthly Generator Cost</span>
                  <span className="highlight">{formatCurrency(gasResults.generatorMonthly)}</span>
                </div>
              </div>
            </div>

            {/* Power & Gas - Computed from Fleet */}
            <div className="card">
              <div className="card-header">
                <h3>Power & Gas (Computed)</h3>
              </div>
              <div className="card-body">
                <div className="result-row compact">
                  <span>Fleet Capacity</span>
                  <span className="highlight">{gasResults.fleetCapacityMw.toFixed(2)} MW</span>
                </div>
                <div className="result-row compact">
                  <span>Gas Required</span>
                  <span className="highlight">{gasResults.mcfPerDay.toFixed(0)} MCF/day</span>
                </div>
                <div className="result-row compact">
                  <span>Net Available (after losses)</span>
                  <span className="highlight">{gasResults.availableMw.toFixed(2)} MW</span>
                </div>

                <div className="input-row two-col" style={{marginTop: '12px'}}>
                  <div>
                    <label>Heat Rate (BTU/kWh)</label>
                    <input
                      type="number"
                      value={heatRate}
                      onChange={e => setHeatRate(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>HHV (BTU/scf)</label>
                    <input
                      type="number"
                      value={hhv}
                      onChange={e => setHhv(+e.target.value)}
                    />
                  </div>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Availability ({Math.round(availability * 100)}%)</label>
                    <input
                      type="range"
                      min="0.8"
                      max="1"
                      step="0.01"
                      value={availability}
                      onChange={e => setAvailability(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Parasitic Load ({Math.round(parasiticLoad * 100)}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="0.2"
                      step="0.01"
                      value={parasiticLoad}
                      onChange={e => setParasiticLoad(+e.target.value)}
                    />
                  </div>
                </div>
                <div className="input-row">
                  <label>Load Factor ({Math.round(loadFactor * 100)}%)</label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.1"
                    step="0.01"
                    value={loadFactor}
                    onChange={e => setLoadFactor(+e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Gas Pricing */}
            <div className="card">
              <div className="card-header">
                <h3>Gas Pricing</h3>
              </div>
              <div className="card-body">
                <div className="input-row two-col">
                  <div>
                    <label>Waha Index ($/MCF)</label>
                    <input
                      type="number"
                      value={wahaPrice}
                      onChange={e => setWahaPrice(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Adder ($/MCF)</label>
                    <input
                      type="number"
                      value={wahaAdder}
                      onChange={e => setWahaAdder(+e.target.value)}
                    />
                  </div>
                </div>
                <div className="result-row compact">
                  <span>Gas Price (all-in)</span>
                  <span className="highlight">${gasResults.gasPrice.toFixed(2)}/MCF</span>
                </div>
              </div>
            </div>

            {/* Mining Assumptions */}
            <div className="card">
              <div className="card-header">
                <h3>Mining Assumptions</h3>
              </div>
              <div className="card-body">
                {/* Miner Preset */}
                <div className="input-row">
                  <label>Miner Model</label>
                  <select
                    className="preset-select"
                    defaultValue="s21pro"
                    onChange={e => {
                      const presets = {
                        // Bitmain Antminer
                        s21pro:   { kw: 3.4,  th: 220, pth: 11 },
                        s21xp:    { kw: 3.15, th: 270, pth: 16 },
                        s21:      { kw: 3.5,  th: 200, pth: 10 },
                        s19xp:    { kw: 3.01, th: 141, pth: 8 },
                        t21:      { kw: 3.0,  th: 190, pth: 9 },
                        // MicroBT Whatsminer
                        m66s:     { kw: 5.5,  th: 298, pth: 14 },
                        m63s:     { kw: 7.2,  th: 390, pth: 15 },
                        m60s:     { kw: 3.42, th: 186, pth: 11 },
                        m60:      { kw: 3.22, th: 172, pth: 10 },
                        m50spp:   { kw: 3.13, th: 146, pth: 8 },
                        m50sp:    { kw: 3.1,  th: 138, pth: 7 },
                      }
                      const p = presets[e.target.value]
                      if (p) {
                        setMinerPowerKW(p.kw)
                        setHashratePerUnit(p.th)
                        setPricePerTh(p.pth)
                      }
                    }}
                  >
                    <optgroup label="Bitmain Antminer">
                      <option value="s21pro">S21 Pro (220 TH/s, 3.4kW, 15.5 J/TH)</option>
                      <option value="s21xp">S21 XP Hyd (270 TH/s, 3.15kW, 11.7 J/TH)</option>
                      <option value="s21">S21 (200 TH/s, 3.5kW, 17.5 J/TH)</option>
                      <option value="t21">T21 (190 TH/s, 3.0kW, 15.8 J/TH)</option>
                      <option value="s19xp">S19 XP (141 TH/s, 3.01kW, 21.4 J/TH)</option>
                    </optgroup>
                    <optgroup label="MicroBT Whatsminer">
                      <option value="m63s">M63S Hyd (390 TH/s, 7.2kW, 18.5 J/TH)</option>
                      <option value="m66s">M66S Hyd (298 TH/s, 5.5kW, 18.5 J/TH)</option>
                      <option value="m60s">M60S (186 TH/s, 3.42kW, 18.4 J/TH)</option>
                      <option value="m60">M60 (172 TH/s, 3.22kW, 18.7 J/TH)</option>
                      <option value="m50spp">M50S++ (146 TH/s, 3.13kW, 21.4 J/TH)</option>
                      <option value="m50sp">M50S+ (138 TH/s, 3.1kW, 22.5 J/TH)</option>
                    </optgroup>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Hashrate (TH/s)</label>
                    <input
                      type="number"
                      value={hashratePerUnit}
                      onChange={e => setHashratePerUnit(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Power (kW)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={minerPowerKW}
                      onChange={e => setMinerPowerKW(+e.target.value)}
                    />
                  </div>
                </div>

                <div className="result-row compact">
                  <span>Efficiency</span>
                  <span>{((minerPowerKW * 1000) / hashratePerUnit).toFixed(1)} J/TH ({((minerPowerKW * 1000) / hashratePerUnit).toFixed(1)} W/TH)</span>
                </div>

                {/* ASIC Pricing */}
                <div className="input-row" style={{marginTop: '12px'}}>
                  <label>ASIC Price ($/TH)</label>
                  <input
                    type="number"
                    value={pricePerTh}
                    onChange={e => setPricePerTh(+e.target.value)}
                  />
                </div>

                <div className="result-row compact">
                  <span>Price per Unit</span>
                  <span>${pricePerTh}/TH × {hashratePerUnit} TH/s = <strong>{formatCurrencyFull(gasResults.asicPricePerUnit)}</strong></span>
                </div>

                <div className="result-row compact" style={{borderTop: '1px solid rgba(148,163,184,0.2)', marginTop: '8px', paddingTop: '8px'}}>
                  <span>Miners Supported</span>
                  <span className="highlight">{gasResults.miners.toLocaleString()} units</span>
                </div>
                <div className="result-row compact">
                  <span>Total Hashrate</span>
                  <span className="highlight">{gasResults.phs.toFixed(2)} PH/s</span>
                </div>
                <div className="result-row compact total">
                  <span>ASIC CAPEX</span>
                  <span className="highlight">{formatCurrencyFull(gasResults.asicCapex)}</span>
                </div>

                {/* Revenue inputs */}
                <div className="input-row two-col" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '12px'}}>
                  <div>
                    <label>Hashprice ($/PH/day)</label>
                    <input
                      type="number"
                      value={hashprice}
                      onChange={e => setHashprice(+e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Pool Fee (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={(poolFee * 100).toFixed(1)}
                      onChange={e => setPoolFee(+e.target.value / 100)}
                    />
                  </div>
                </div>

                <div className="input-row">
                  <label>Other Opex ($/month)</label>
                  <input
                    type="number"
                    value={otherOpex}
                    onChange={e => setOtherOpex(+e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="results-section">
            <h2>Results Summary</h2>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Gross Power</span>
                <span className="stat-value">{gasResults.mwGross.toFixed(2)} MW</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Gas Required</span>
                <span className="stat-value">{gasResults.mcfPerDay.toFixed(0)} MCF/day</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Net Available</span>
                <span className="stat-value">{gasResults.availableMw.toFixed(2)} MW</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Miners</span>
                <span className="stat-value">{gasResults.miners.toLocaleString()}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Hashrate</span>
                <span className="stat-value">{gasResults.phs.toFixed(2)} PH/s</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Effective $/kWh</span>
                <span className="stat-value">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Revenue</span>
                <span className="stat-value green">{formatCurrency(gasResults.monthlyRevenue)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Gas Cost (30d)</span>
                <span className="stat-value red">{formatCurrency(gasResults.gasMonthly)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Generator Cost</span>
                <span className="stat-value red">{formatCurrency(gasResults.generatorMonthly)}</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Net Monthly</span>
                <span className="stat-value" style={{color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444'}}>
                  {formatCurrency(gasResults.netMonthly)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Breakeven Hashprice</span>
                <span className="stat-value">${gasResults.breakevenHashprice.toFixed(1)}/PH/d</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Grid Equivalent</span>
                <span className="stat-value">{(gasResults.gridEquivalentPerKwh * 100).toFixed(2)}¢/kWh</span>
              </div>
            </div>

            {/* CAPEX & Payback */}
            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>
                  {generatorMode === 'buy' && 'Generator CAPEX (Purchase)'}
                  {generatorMode === 'finance' && `Generator CAPEX (${financeDownPct}% Down)`}
                  {generatorMode === 'rent' && 'Generator CAPEX (Rent - N/A)'}
                  {generatorMode === 'rto' && 'Generator CAPEX (RTO - N/A)'}
                </span>
                <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
              </div>
              <div className="table-row">
                <span>ASIC CAPEX ({gasResults.miners.toLocaleString()} × {formatCurrencyFull(gasResults.asicPricePerUnit)})</span>
                <span>{formatCurrencyFull(gasResults.asicCapex)}</span>
              </div>
              <div className="table-row total">
                <span>Total Upfront CAPEX</span>
                <span className="highlight">{formatCurrencyFull(gasResults.totalCapex)}</span>
              </div>
              <div className="table-row">
                <span>Payback Period</span>
                <span className="highlight">
                  {gasResults.paybackMonths === Infinity ? 'N/A' : `${gasResults.paybackMonths.toFixed(1)} months`}
                </span>
              </div>
            </div>

            {/* Operations Summary */}
            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>Gas Price (all-in)</span>
                <span className="highlight">${gasResults.gasPrice.toFixed(2)}/MCF</span>
              </div>
              <div className="table-row">
                <span>Heat Rate</span>
                <span>{heatRate.toLocaleString()} BTU/kWh</span>
              </div>
              <div className="table-row">
                <span>Generator Fleet</span>
                <span>{generatorCount} × {generatorSizeKw} kW ({gasResults.fleetCapacityMw.toFixed(2)} MW)</span>
              </div>
              <div className="table-row">
                <span>Availability / Parasitic / Load</span>
                <span>{Math.round(availability * 100)}% / {Math.round(parasiticLoad * 100)}% / {Math.round(loadFactor * 100)}%</span>
              </div>
              {generatorMode === 'rto' && (
                <>
                  <div className="table-row">
                    <span>RTO Months to Own</span>
                    <span className="highlight">{gasResults.rtoMonthsToOwn} months</span>
                  </div>
                  <div className="table-row">
                    <span>RTO Total Cost (fleet)</span>
                    <span>{formatCurrencyFull(gasResults.rtoTotalPaid)}</span>
                  </div>
                  <div className="table-row total">
                    <span>Post-Ownership Monthly</span>
                    <span className="green">{formatCurrencyFull(gasResults.rtoPostOwnershipMonthly)}/mo</span>
                  </div>
                </>
              )}
              {generatorMode === 'finance' && (
                <>
                  <div className="table-row">
                    <span>Finance Term</span>
                    <span>{financeTerm} months @ {financeRate}%</span>
                  </div>
                  <div className="table-row">
                    <span>Total Interest</span>
                    <span style={{color: '#ef4444'}}>{formatCurrencyFull(gasResults.financeTotalInterest)}</span>
                  </div>
                  <div className="table-row total">
                    <span>Post-Loan Monthly</span>
                    <span className="green">{formatCurrencyFull(gasResults.financePostOwnershipMonthly)}/mo</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Year 1 Annual Projection */}
          <section className="comparison-section">
            <h2>Year 1 Projection</h2>
            <div className="simple-table">
              <div className="table-row">
                <span>Annual Revenue</span>
                <span className="green">{formatCurrency(gasResults.annualRevenue)}</span>
              </div>
              <div className="table-row">
                <span>Annual Gas Cost</span>
                <span className="red">{formatCurrency(gasResults.gasMonthly * 12)}</span>
              </div>
              <div className="table-row">
                <span>Annual Generator Cost</span>
                <span className="red">{formatCurrency(gasResults.generatorMonthly * 12)}</span>
              </div>
              <div className="table-row">
                <span>Annual Other Opex</span>
                <span className="red">{formatCurrency(otherOpex * 12)}</span>
              </div>
              <div className="table-row total">
                <span>Annual Net Profit</span>
                <span className="highlight" style={{color: gasResults.annualNet >= 0 ? '#22c55e' : '#ef4444'}}>
                  {formatCurrency(gasResults.annualNet)}
                </span>
              </div>
              <div className="table-row">
                <span>Profit Margin</span>
                <span>
                  {gasResults.annualRevenue > 0
                    ? `${((gasResults.annualNet / gasResults.annualRevenue) * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </section>

          {/* Sensitivity Analysis */}
          <section className="comparison-section">
            <h2>Sensitivity Analysis - Net Monthly Profit</h2>
            <p className="section-intro">How net profit changes with gas price and hashprice</p>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Gas Price \ Hashprice</th>
                    <th>$30/PH</th>
                    <th>$37/PH</th>
                    <th>$45/PH</th>
                    <th>$55/PH</th>
                  </tr>
                </thead>
                <tbody>
                  {[1.50, 1.95, 2.50, 3.00].map(gp => (
                    <tr key={gp}>
                      <td className="row-label">${gp.toFixed(2)}/MCF</td>
                      {[30, 37, 45, 55].map(hp => {
                        // Calculate for this scenario
                        const scenarioGasMonthly = gasResults.mcfPerDay * gp * 30
                        const scenarioRevenue = gasResults.effectivePhs * hp * 30
                        const scenarioNet = scenarioRevenue - scenarioGasMonthly - gasResults.generatorMonthly - otherOpex
                        const isCurrentScenario = Math.abs(gp - gasResults.gasPrice) < 0.01 && hp === hashprice

                        return (
                          <td key={hp} className={`${scenarioNet < 0 ? 'negative' : ''} ${isCurrentScenario ? 'current' : ''}`}>
                            {formatCurrency(scenarioNet)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Grid Power Comparison */}
          <section className="comparison-section">
            <h2>Grid Power Comparison</h2>
            <p className="section-intro">What would grid power need to cost to match your gas-to-power economics?</p>
            <div className="simple-table">
              <div className="table-row">
                <span>Your Effective Power Cost</span>
                <span className="highlight">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢/kWh</span>
              </div>
              <div className="table-row">
                <span>Total Monthly Power (at {gasResults.availableMw.toFixed(2)} MW)</span>
                <span>{(gasResults.availableMw * 24 * 30).toFixed(0).toLocaleString()} MWh</span>
              </div>
              <div className="table-row">
                <span>Breakeven Grid Rate (same total cost)</span>
                <span className="highlight">{(gasResults.gridEquivalentPerKwh * 100).toFixed(2)}¢/kWh</span>
              </div>
              <div className="table-row total">
                <span>Advantage vs 5¢/kWh Grid</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.05 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.05
                    ? `Saving ${formatCurrency((0.05 - gasResults.powerCostPerKwh) * gasResults.availableMw * 24 * 30 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.05) * gasResults.availableMw * 24 * 30 * 1000)}/mo more`
                  }
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ============ PART 1: BUSINESS MODELS ============ */}
      {mode === 'models' && (
        <>
          {/* Market Assumptions - TOP */}
          <section className="controls-section">
            <h2>Market Assumptions</h2>
            <div className="controls-grid">
              <div className="control-group">
                <h3>Site & Build-up</h3>
                <div className="input-row">
                  <label>Site + Infrastructure: {formatCurrency(siteBuildCost)}</label>
                  <input
                    type="text"
                    value={siteBuildCost.toLocaleString()}
                    onChange={e => setSiteBuildCost(+e.target.value.replace(/,/g, ''))}
                  />
                </div>
                <div className="input-row">
                  <label>Monthly OPEX: ${monthlyOpex.toLocaleString()}</label>
                  <input
                    type="text"
                    value={monthlyOpex.toLocaleString()}
                    onChange={e => setMonthlyOpex(+e.target.value.replace(/,/g, ''))}
                  />
                </div>
              </div>
              <div className="control-group">
                <h3>Market Conditions</h3>
                <div className="input-row">
                  <label>Hashprice: ${hashprice}/PH/day</label>
                  <input type="range" min="20" max="60" step="1" value={hashprice} onChange={e => setHashprice(+e.target.value)} />
                </div>
                <div className="input-row">
                  <label>Energy: {energyPrice}¢/kWh</label>
                  <input type="range" min="3" max="8" step="0.5" value={energyPrice} onChange={e => setEnergyPrice(+e.target.value)} />
                </div>
                <div className="input-row">
                  <label>Curtailment: {(curtailment * 100).toFixed(0)}%</label>
                  <input type="range" min="0" max="0.15" step="0.01" value={curtailment} onChange={e => setCurtailment(+e.target.value)} />
                </div>
                <div className="input-row">
                  <label>Hosting Fee (hashrate share): {Math.round(coMiningShare * 100)}%</label>
                  <input type="range" min="0.20" max="0.50" step="0.05" value={coMiningShare} onChange={e => setCoMiningShare(+e.target.value)} />
                  <span style={{fontSize: '0.75rem', color: '#64748b'}}>Share we earn from hosting third-party miners</span>
                </div>
              </div>
              <div className="control-group">
                <h3>ASIC Specs</h3>
                <div className="input-row">
                  <label>Power: {minerPowerKW} kW/unit</label>
                  <input type="range" min="3.0" max="4.0" step="0.05" value={minerPowerKW} onChange={e => setMinerPowerKW(+e.target.value)} />
                </div>
                <div className="input-row">
                  <label>Hashrate: {hashratePerUnit} TH/s</label>
                  <input type="range" min="180" max="280" step="10" value={hashratePerUnit} onChange={e => setHashratePerUnit(+e.target.value)} />
                </div>
                <div className="input-row">
                  <label>Price: ${pricePerTh}/TH</label>
                  <input type="range" min="5" max="20" step="0.5" value={pricePerTh} onChange={e => setPricePerTh(+e.target.value)} />
                </div>
                <div className="capex-summary">
                  Miners: {formatCurrency(results.minerCost)}
                </div>
              </div>
            </div>
          </section>

          {/* The Facility */}
          <section className="comparison-section">
            <h2>The Facility</h2>
            <div className="simple-table">
              <div className="table-row">
                <span>Power Capacity</span>
                <span className="highlight">{facilityMW} MW</span>
              </div>
              <div className="table-row">
                <span>Mining Containers (325 miners each)</span>
                <span className="highlight">{Math.ceil(results.miners / 325)} containers</span>
              </div>
              <div className="table-row">
                <span>ASIC Miners (@ {minerPowerKW} kW each)</span>
                <span>{results.miners.toLocaleString()} units</span>
              </div>
              <div className="table-row">
                <span>Total Hashrate</span>
                <span>{results.totalHashratePH.toFixed(0)} PH/s</span>
              </div>
              <div className="table-row">
                <span>Effective Hashrate ({(results.uptime * 100).toFixed(0)}% uptime)</span>
                <span className="highlight">{results.effectiveHashratePH.toFixed(0)} PH/s</span>
              </div>
            </div>
          </section>

          {/* Two Models Explained */}
          <section className="models-comparison">
            <h2>Two Business Models</h2>

            <div className="model-cards">
              {/* Co-Mining Card */}
              <div className="model-card co-mining">
                <h3>Co-Mining (Hosting)</h3>
                <p className="model-desc">We host third-party miners and earn a share of their hashrate as payment for infrastructure and operations.</p>

                <div className="capex-breakdown">
                  <div className="capex-line">
                    <span>Site & Build-up</span>
                    <span>{formatCurrency(siteBuildCost)}</span>
                  </div>
                  <div className="capex-line muted">
                    <span>Miners</span>
                    <span>$0 (3rd party)</span>
                  </div>
                  <div className="capex-line total">
                    <span>Total CAPEX</span>
                    <span>{formatCurrency(results.coMiningCapex)}</span>
                  </div>
                </div>

                <div className="model-stats">
                  <div className="stat">
                    <span className="stat-label">Our Hashrate Share</span>
                    <span className="stat-value">{Math.round(coMiningShare * 100)}%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Effective Hashrate</span>
                    <span className="stat-value">{results.coHashratePH.toFixed(0)} PH/s</span>
                  </div>
                </div>

                <div className="model-benefits">
                  <h4>Benefits</h4>
                  <ul>
                    <li>Lower capital requirement</li>
                    <li>Miners bear equipment risk</li>
                    <li>Stable hosting revenue stream</li>
                    <li>No ASIC procurement needed</li>
                  </ul>
                </div>

                <div className="model-pnl">
                  <h4>Monthly P&L</h4>
                  <div className="pnl-row">
                    <span>Revenue</span>
                    <span className="green">${formatNumber(Math.round(results.coGrossRevenue))}</span>
                  </div>
                  <div className="pnl-row">
                    <span>Power ({Math.round(coMiningShare * 100)}%)</span>
                    <span className="red">−${formatNumber(Math.round(results.coPowerCost))}</span>
                  </div>
                  <div className="pnl-row">
                    <span>OPEX</span>
                    <span className="red">−${formatNumber(monthlyOpex)}</span>
                  </div>
                  <div className="pnl-row total">
                    <span>Net Profit</span>
                    <span className={results.coNetMonthly >= 0 ? 'highlight' : 'red'}>
                      ${formatNumber(Math.round(results.coNetMonthly))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Self-Mining Card */}
              <div className="model-card self-mining">
                <h3>Self-Mining</h3>
                <p className="model-desc">We own and operate all mining equipment, capturing 100% of the hashrate and mining rewards.</p>

                <div className="capex-breakdown">
                  <div className="capex-line">
                    <span>Site & Build-up</span>
                    <span>{formatCurrency(siteBuildCost)}</span>
                  </div>
                  <div className="capex-line">
                    <span>Miners ({results.miners.toLocaleString()} units)</span>
                    <span>{formatCurrency(results.minerCost)}</span>
                  </div>
                  <div className="capex-line total">
                    <span>Total CAPEX</span>
                    <span>{formatCurrency(results.selfMiningCapex)}</span>
                  </div>
                </div>

                <div className="model-stats">
                  <div className="stat">
                    <span className="stat-label">Our Hashrate Share</span>
                    <span className="stat-value">100%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Effective Hashrate</span>
                    <span className="stat-value">{results.selfHashratePH.toFixed(0)} PH/s</span>
                  </div>
                </div>

                <div className="model-benefits">
                  <h4>Benefits</h4>
                  <ul>
                    <li>Maximum revenue capture</li>
                    <li>Full control of operations</li>
                    <li>BTC accumulation strategy</li>
                    <li>Higher profit margins</li>
                  </ul>
                </div>

                <div className="model-pnl">
                  <h4>Monthly P&L</h4>
                  <div className="pnl-row">
                    <span>Revenue</span>
                    <span className="green">${formatNumber(Math.round(results.selfGrossRevenue))}</span>
                  </div>
                  <div className="pnl-row">
                    <span>Power (100%)</span>
                    <span className="red">−${formatNumber(Math.round(results.selfPowerCost))}</span>
                  </div>
                  <div className="pnl-row">
                    <span>OPEX</span>
                    <span className="red">−${formatNumber(monthlyOpex)}</span>
                  </div>
                  <div className="pnl-row total">
                    <span>Net Profit</span>
                    <span className={results.selfNetMonthly >= 0 ? 'highlight' : 'red'}>
                      ${formatNumber(Math.round(results.selfNetMonthly))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Side-by-Side Comparison */}
          <section className="comparison-section">
            <h2>Model Comparison</h2>
            <div className="comparison-table">
              <div className="table-header">
                <span></span>
                <span className="col-co">Co-Mining</span>
                <span className="col-self">Self-Mining</span>
              </div>
              <div className="table-row">
                <span className="col-label">CAPEX</span>
                <span className="col-co">{formatCurrency(results.coMiningCapex)}</span>
                <span className="col-self">{formatCurrency(results.selfMiningCapex)}</span>
              </div>
              <div className="table-row">
                <span className="col-label">Hashrate</span>
                <span className="col-co">{results.coHashratePH.toFixed(0)} PH/s</span>
                <span className="col-self">{results.selfHashratePH.toFixed(0)} PH/s</span>
              </div>
              <div className="table-row">
                <span className="col-label">Monthly Revenue</span>
                <span className="col-co">${formatNumber(Math.round(results.coGrossRevenue))}</span>
                <span className="col-self">${formatNumber(Math.round(results.selfGrossRevenue))}</span>
              </div>
              <div className="table-row">
                <span className="col-label">Monthly Power Cost</span>
                <span className="col-co">${formatNumber(Math.round(results.coPowerCost))}</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPowerCost))}</span>
              </div>
              <div className="table-row total">
                <span className="col-label">Monthly Net Profit</span>
                <span className="col-co highlight">${formatNumber(Math.round(results.coNetMonthly))}</span>
                <span className="col-self highlight">${formatNumber(Math.round(results.selfNetMonthly))}</span>
              </div>
              <div className="table-row">
                <span className="col-label">Annual Net Profit</span>
                <span className="col-co">${formatNumber(Math.round(results.coAnnualNet))}</span>
                <span className="col-self">${formatNumber(Math.round(results.selfAnnualNet))}</span>
              </div>
            </div>
          </section>

          {/* Model Mixer */}
          <section className="mixer-section">
            <h2>Business Model Mix</h2>
            <p className="section-intro">Choose how much capacity to allocate to hosting (Co-Mining) vs owning miners (Self-Mining)</p>

            <div className="mixer-control">
              <div className="mixer-labels">
                <span className="co-label">100% Co-Mining</span>
                <span className="mix-label">Hybrid</span>
                <span className="self-label">100% Self-Mining</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={modelMix}
                onChange={e => setModelMix(+e.target.value)}
                className="mixer-slider"
              />
              <div className="mixer-value">
                {modelMix === 0 ? '100% Co-Mining' :
                 modelMix === 1 ? '100% Self-Mining' :
                 `${((1 - modelMix) * 100).toFixed(0)}% Co-Mining / ${(modelMix * 100).toFixed(0)}% Self-Mining`}
              </div>
            </div>

            <div className="mix-result">
              <h3>Blended Scenario</h3>
              <div className="mix-stats">
                <div className="mix-stat">
                  <span className="mix-stat-label">CAPEX</span>
                  <span className="mix-stat-value">{formatCurrency(results.mixCapex)}</span>
                </div>
                <div className="mix-stat">
                  <span className="mix-stat-label">Hashrate</span>
                  <span className="mix-stat-value">{results.mixHashratePH.toFixed(0)} PH/s</span>
                </div>
                <div className="mix-stat">
                  <span className="mix-stat-label">Monthly Revenue</span>
                  <span className="mix-stat-value green">${formatNumber(Math.round(results.mixGrossRevenue))}</span>
                </div>
                <div className="mix-stat">
                  <span className="mix-stat-label">Power Cost</span>
                  <span className="mix-stat-value red">${formatNumber(Math.round(results.mixPowerCost))}</span>
                </div>
                <div className="mix-stat highlight-stat">
                  <span className="mix-stat-label">Net Monthly</span>
                  <span className="mix-stat-value">${formatNumber(Math.round(results.mixNetMonthly))}</span>
                </div>
                <div className="mix-stat highlight-stat">
                  <span className="mix-stat-label">Annual Net</span>
                  <span className="mix-stat-value">${formatNumber(Math.round(results.mixAnnualNet))}</span>
                </div>
              </div>

            </div>
          </section>

          <div className="next-step">
            <button onClick={() => setMode('deal')}>
              Continue to Deal Structure →
            </button>
          </div>
        </>
      )}

      {/* ============ PART 2: DEAL STRUCTURE ============ */}
      {mode === 'deal' && (
        <>
          {/* Investor Returns Callout - Clarifies this is investor-level, not project-level */}
          <section className="investor-callout">
            <h3>Investor-Level</h3>
            <p className="callout-note">
              All returns shown are <strong>your share</strong> — what you actually receive, not project totals.
            </p>
            <div className="waterfall-highlight">
              <h4 style={{color: '#f59e0b', marginBottom: '12px', fontSize: '0.9rem'}}>Preferential Return Structure</h4>
              <div className="waterfall-phases">
                <div className="waterfall-phase">
                  <h4>Phase 1: Until Capital Recovery</h4>
                  <p className="phase-detail" style={{color: '#22c55e'}}>
                    You receive {(results.mixPhase1Pct * 100).toFixed(0)}% of profits
                  </p>
                  <p style={{color: '#64748b', fontSize: '0.8rem', marginTop: '2px'}}>
                    (Blended: {(coPhase1Pct * 100).toFixed(0)}% Co-Mining + {(selfPhase1Pct * 100).toFixed(0)}% Self-Mining)
                  </p>
                  <p style={{color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px'}}>
                    → ${formatNumber(Math.round(results.mixPhase1Investor))}/month until payback (~{results.mixPayback.toFixed(0)} mo)
                  </p>
                </div>
                <div className="waterfall-phase">
                  <h4>Phase 2: After Capital Recovery</h4>
                  <p className="phase-detail">
                    Your share becomes {(results.mixPhase2Pct * 100).toFixed(0)}%
                  </p>
                  <p style={{color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px'}}>
                    → ${formatNumber(Math.round(results.mixPhase2Investor))}/month ongoing
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="comparison-section">
            <h2>Profit Split (Investor vs Astro)</h2>
            <p className="section-intro">How net profits are divided between you (investor) and Astro (operator)</p>

            <div className="deal-models">
              {/* Co-Mining Splits */}
              <div className="deal-model co-deal">
                <h3>Co-Mining Deal</h3>
                <p className="deal-desc">Lower capital ({formatCurrency(results.coMiningCapex)}) → Lower your share</p>

                <div className="phase-splits">
                  <div className="phase-split">
                    <h4>Phase 1: Until ROI</h4>
                    <div className="split-visual">
                      <div className="split-bar">
                        <div className="investor-bar" style={{width: `${coPhase1Pct * 100}%`}}>
                          {Math.round(coPhase1Pct * 100)}%
                        </div>
                        <div className="operator-bar" style={{width: `${(1 - coPhase1Pct) * 100}%`}}>
                          {Math.round((1 - coPhase1Pct) * 100)}%
                        </div>
                      </div>
                    </div>
                    <input type="range" min="0.5" max="0.90" step="0.05" value={coPhase1Pct} onChange={e => setCoPhase1Pct(+e.target.value)} />
                  </div>

                  <div className="phase-split">
                    <h4>Phase 2: After ROI</h4>
                    <div className="split-visual">
                      <div className="split-bar">
                        <div className="investor-bar" style={{width: `${coPhase2Pct * 100}%`}}>
                          {Math.round(coPhase2Pct * 100)}%
                        </div>
                        <div className="operator-bar" style={{width: `${(1 - coPhase2Pct) * 100}%`}}>
                          {Math.round((1 - coPhase2Pct) * 100)}%
                        </div>
                      </div>
                    </div>
                    <input type="range" min="0.2" max="0.7" step="0.05" value={coPhase2Pct} onChange={e => setCoPhase2Pct(+e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Self-Mining Splits */}
              <div className="deal-model self-deal">
                <h3>Self-Mining Deal</h3>
                <p className="deal-desc">Higher capital ({formatCurrency(results.selfMiningCapex)}) → Higher your share</p>

                <div className="phase-splits">
                  <div className="phase-split">
                    <h4>Phase 1: Until ROI</h4>
                    <div className="split-visual">
                      <div className="split-bar">
                        <div className="investor-bar" style={{width: `${selfPhase1Pct * 100}%`}}>
                          {Math.round(selfPhase1Pct * 100)}%
                        </div>
                        <div className="operator-bar" style={{width: `${(1 - selfPhase1Pct) * 100}%`}}>
                          {Math.round((1 - selfPhase1Pct) * 100)}%
                        </div>
                      </div>
                    </div>
                    <input type="range" min="0.6" max="0.95" step="0.05" value={selfPhase1Pct} onChange={e => setSelfPhase1Pct(+e.target.value)} />
                  </div>

                  <div className="phase-split">
                    <h4>Phase 2: After ROI</h4>
                    <div className="split-visual">
                      <div className="split-bar">
                        <div className="investor-bar" style={{width: `${selfPhase2Pct * 100}%`}}>
                          {Math.round(selfPhase2Pct * 100)}%
                        </div>
                        <div className="operator-bar" style={{width: `${(1 - selfPhase2Pct) * 100}%`}}>
                          {Math.round((1 - selfPhase2Pct) * 100)}%
                        </div>
                      </div>
                    </div>
                    <input type="range" min="0.3" max="0.7" step="0.05" value={selfPhase2Pct} onChange={e => setSelfPhase2Pct(+e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="split-legend">
              <span className="legend-investor">■ Your Share</span>
              <span className="legend-operator">■ Astro Share</span>
            </div>
          </section>

          {/* Deal Comparison */}
          <section className="investor-section">
            <h2>Investor Returns by Model</h2>
            <div className="investor-comparison" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
              {/* Co-Mining Deal */}
              <div className="investor-scenario">
                <h3>Co-Mining Deal</h3>
                <div className="investor-grid" style={{gridTemplateColumns: '1fr'}}>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Investment</span>
                    <span className="investor-value big">{formatCurrency(results.coMiningCapex)}</span>
                  </div>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Payback</span>
                    <span className="investor-value big">{results.coPayback.toFixed(1)} mo</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Annual ROI</span>
                    <span className="investor-value">{results.coROI.toFixed(0)}%</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 1 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.coPhase1Investor))}</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 2 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.coPhase2Investor))}</span>
                  </div>
                </div>
              </div>

              {/* Blended Deal */}
              <div className="investor-scenario">
                <h3>Blended Deal ({((1 - modelMix) * 100).toFixed(0)}/{(modelMix * 100).toFixed(0)})</h3>
                <div className="investor-grid" style={{gridTemplateColumns: '1fr'}}>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Investment</span>
                    <span className="investor-value big">{formatCurrency(results.mixCapex)}</span>
                  </div>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Payback</span>
                    <span className="investor-value big">{results.mixPayback.toFixed(1)} mo</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Annual ROI</span>
                    <span className="investor-value">{results.mixROI.toFixed(0)}%</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 1 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.mixPhase1Investor))}</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 2 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.mixPhase2Investor))}</span>
                  </div>
                </div>
              </div>

              {/* Self-Mining Deal */}
              <div className="investor-scenario">
                <h3>Self-Mining Deal</h3>
                <div className="investor-grid" style={{gridTemplateColumns: '1fr'}}>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Investment</span>
                    <span className="investor-value big">{formatCurrency(results.selfMiningCapex)}</span>
                  </div>
                  <div className="investor-card highlight-card">
                    <span className="investor-label">Payback</span>
                    <span className="investor-value big">{results.selfPayback.toFixed(1)} mo</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Annual ROI</span>
                    <span className="investor-value">{results.selfROI.toFixed(0)}%</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 1 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.selfPhase1Investor))}</span>
                  </div>
                  <div className="investor-card">
                    <span className="investor-label">Phase 2 Monthly</span>
                    <span className="investor-value">${formatNumber(Math.round(results.selfPhase2Investor))}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Full Breakdown Table */}
          <section className="comparison-section">
            <h2>Complete Deal Breakdown</h2>
            <div className="comparison-table">
              <div className="table-header">
                <span></span>
                <span className="col-co">Co-Mining</span>
                <span className="col-self">Self-Mining</span>
              </div>
              <div className="table-row">
                <span className="col-label">Total Investment</span>
                <span className="col-co">{formatCurrency(results.coMiningCapex)}</span>
                <span className="col-self">{formatCurrency(results.selfMiningCapex)}</span>
              </div>
              <div className="table-row">
                <span className="col-label">Monthly Net Profit</span>
                <span className="col-co">${formatNumber(Math.round(results.coNetMonthly))}</span>
                <span className="col-self">${formatNumber(Math.round(results.selfNetMonthly))}</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 1 Split</span>
                <span className="col-co">{Math.round(coPhase1Pct * 100)}% / {Math.round((1 - coPhase1Pct) * 100)}%</span>
                <span className="col-self">{Math.round(selfPhase1Pct * 100)}% / {Math.round((1 - selfPhase1Pct) * 100)}%</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 1 - Your Monthly</span>
                <span className="col-co highlight">${formatNumber(Math.round(results.coPhase1Investor))}/mo</span>
                <span className="col-self highlight">${formatNumber(Math.round(results.selfPhase1Investor))}/mo</span>
              </div>
              <div className="table-row total">
                <span className="col-label">Payback Period</span>
                <span className="col-co highlight">{results.coPayback.toFixed(1)} months</span>
                <span className="col-self highlight">{results.selfPayback.toFixed(1)} months</span>
              </div>
              <div className="table-row">
                <span className="col-label">Annual ROI (Phase 1)</span>
                <span className="col-co">{results.coROI.toFixed(0)}%</span>
                <span className="col-self">{results.selfROI.toFixed(0)}%</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 2 - Your Share</span>
                <span className="col-co">{Math.round(coPhase2Pct * 100)}%</span>
                <span className="col-self">{Math.round(selfPhase2Pct * 100)}%</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 2 - Your Monthly</span>
                <span className="col-co">${formatNumber(Math.round(results.coPhase2Investor))}/mo</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPhase2Investor))}/mo</span>
              </div>
            </div>
          </section>

          {/* Sensitivity Table */}
          <section className="comparison-section">
            <h2>Sensitivity Analysis - Investor Payback (Months)</h2>
            <p className="section-intro">
              Based on blended model ({((1 - modelMix) * 100).toFixed(0)}% Co-Mining / {(modelMix * 100).toFixed(0)}% Self-Mining)
              with {(results.mixPhase1Pct * 100).toFixed(0)}% investor share
            </p>
            <div className="sensitivity-legend" style={{display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '0.85rem'}}>
              <span style={{color: '#22c55e'}}>■ Under 36 months</span>
              <span style={{color: '#f59e0b'}}>■ 36-48 months</span>
              <span style={{color: '#ef4444'}}>■ Over 48 months</span>
            </div>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Energy \ Hashprice</th>
                    <th>$30/PH</th>
                    <th>$37/PH</th>
                    <th>$45/PH</th>
                    <th>$50/PH</th>
                    <th>$55/PH</th>
                    <th>$60/PH</th>
                  </tr>
                </thead>
                <tbody>
                  {[3.5, 4.0, 4.5, 5.0, 5.5].map(ep => (
                    <tr key={ep}>
                      <td className="row-label">{ep}¢/kWh</td>
                      {[30, 37, 45, 50, 55, 60].map(hp => {
                        // Calculate for this scenario
                        const uptime = 1 - curtailment
                        const miners = Math.floor(facilityMW * 1000 / minerPowerKW)
                        const totalHashratePH = (miners * hashratePerUnit) / 1000
                        const effectiveHashratePH = totalHashratePH * uptime
                        const minerCost = miners * hashratePerUnit * pricePerTh
                        const coMiningCapex = siteBuildCost
                        const selfMiningCapex = siteBuildCost + minerCost
                        const mixCapex = coMiningCapex * (1 - modelMix) + selfMiningCapex * modelMix

                        // Co-Mining
                        const coHashratePH = effectiveHashratePH * coMiningShare
                        const coGrossRevenue = coHashratePH * hp * 30
                        const coPowerCost = (ep / 100) * minerPowerKW * miners * 720 * uptime * coMiningShare
                        const coNetMonthly = coGrossRevenue - coPowerCost - monthlyOpex
                        const coInvestor = coNetMonthly * coPhase1Pct

                        // Self-Mining
                        const selfGrossRevenue = effectiveHashratePH * hp * 30
                        const selfPowerCost = (ep / 100) * minerPowerKW * miners * 720 * uptime
                        const selfNetMonthly = selfGrossRevenue - selfPowerCost - monthlyOpex
                        const selfInvestor = selfNetMonthly * selfPhase1Pct

                        // Blended
                        const mixInvestor = coInvestor * (1 - modelMix) + selfInvestor * modelMix
                        const mixPayback = mixInvestor > 0 ? (mixCapex / mixInvestor) : null
                        const isCurrentScenario = Math.abs(ep - energyPrice) < 0.01 && hp === hashprice

                        // Color coding based on payback
                        let cellColor = '#ef4444' // red for >48mo
                        if (mixPayback && mixPayback <= 36) cellColor = '#22c55e' // green
                        else if (mixPayback && mixPayback <= 48) cellColor = '#f59e0b' // yellow

                        return (
                          <td
                            key={hp}
                            className={isCurrentScenario ? 'current' : ''}
                            style={{
                              color: mixInvestor <= 0 ? '#ef4444' : cellColor,
                              fontWeight: isCurrentScenario ? '700' : '400',
                              backgroundColor: isCurrentScenario ? 'rgba(59, 130, 246, 0.2)' : 'transparent'
                            }}
                          >
                            {mixPayback ? `${mixPayback.toFixed(0)}` : 'N/A'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="next-step">
            <button onClick={() => setMode('models')}>
              ← Back to Business Models
            </button>
          </div>
        </>
      )}

      <footer>
        <p>Projections based on current market assumptions. Actual results will vary with BTC price, network difficulty, and operational factors.</p>
        <p className="company">Astro Solutions LLC</p>
      </footer>
    </div>
  )
}

export default App
