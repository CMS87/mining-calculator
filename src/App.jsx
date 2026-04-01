import { useState, useMemo, useEffect } from 'react'
import './App.css'

// Ozona Stranded Gas to Bitcoin Calculator
// Adapted from Pecos Mining Calculator (AstroMiners)

function App() {
  // Tab mode: 'gas' (Gas→Power), 'mining' (Power→BTC), 'full' (Full Model)
  const [mode, setMode] = useState('full')
  const [hashpriceLoading, setHashpriceLoading] = useState(true)

  // ====== CONTAINER & FACILITY ======
  const [containerCount, setContainerCount] = useState(4)  // 4 × 53ft containers
  const containerMW = 1.4                                   // 1.4 MW per container (fixed)
  const [containerCapex, setContainerCapex] = useState(600000)  // 4 containers × $150k

  // ====== MINER SPECS (single set — no self/co split) ======
  const [hashratePerUnit, setHashratePerUnit] = useState(234)   // TH/s per unit (S21 Pro 234T)
  const [efficiency, setEfficiency] = useState(15.0)            // J/TH (3510W / 234TH)
  const [pricePerTh, setPricePerTh] = useState(12)              // $/TH

  // ====== CONTAINER PHYSICAL CAPACITY ======
  const pdusPerContainer = 28                                    // 28 PDUs per container (confirmed from wiring docs + photos)
  const outletsPerPdu = 12                                       // 12 C19/C20 outlets per PDU strip
  const maxMinersPerContainer = pdusPerContainer * outletsPerPdu // 336 hard cap — PDU slots are the bottleneck
  const [minersPerContainerOverride, setMinersPerContainerOverride] = useState(324) // settable by user

  // Derived miner values
  const minerPowerW = efficiency * hashratePerUnit               // Watts per miner
  const minerPowerKW = minerPowerW / 1000                        // kW per miner
  const minersPerContainer = Math.min(minersPerContainerOverride, maxMinersPerContainer)
  const facilityMW = (containerCount * containerMW).toFixed(1)

  // ====== MARKET ======
  const [hashprice, setHashprice] = useState(39.5)              // $/PH/day
  const [curtailment, setCurtailment] = useState(0.05)          // 5% curtailment

  // ====== GAS-TO-POWER ======
  const [gasAvailable, setGasAvailable] = useState(500)         // MCF/day placeholder until Ed confirms
  const [heatRate, setHeatRate] = useState(11500)               // BTU/kWh (TGR400 spec)
  const [hhv, setHhv] = useState(1000)                          // BTU/scf
  const [wahaPrice, setWahaPrice] = useState(0)                 // ~$0 stranded gas
  const [wahaAdder, setWahaAdder] = useState(0)                 // ~$0
  const [generatorLoadPct, setGeneratorLoadPct] = useState(0.80)  // 80% = Ed's preferred operating point

  // ====== GENERATORS (Taylor Power TGR400 defaults) ======
  const [generatorCount, setGeneratorCount] = useState(12)
  const [generatorSizeKw, setGeneratorSizeKw] = useState(400)
  const [generatorMode, setGeneratorMode] = useState('rto')
  const [generatorRentMonthly, setGeneratorRentMonthly] = useState(9500)
  const [generatorBuyPrice, setGeneratorBuyPrice] = useState(171205)
  const [generatorBuyMaintenance, setGeneratorBuyMaintenance] = useState(1500)
  const [generatorRtoMonthly, setGeneratorRtoMonthly] = useState(12500)
  const [generatorRtoTerm, setGeneratorRtoTerm] = useState(28)
  const [generatorRtoEquityPct, setGeneratorRtoEquityPct] = useState(0.50)
  const [generatorRtoPostMaint, setGeneratorRtoPostMaint] = useState(1500)
  const [financeRate, setFinanceRate] = useState(5.0)
  const [financeTerm, setFinanceTerm] = useState(60)
  const [financeDownPct, setFinanceDownPct] = useState(20)
  const [generatorLifetimeHours, setGeneratorLifetimeHours] = useState(60000)
  const [topOverhaulHours, setTopOverhaulHours] = useState(20000)
  const [topOverhaulCost, setTopOverhaulCost] = useState(20000)
  const [majorOverhaulHours, setMajorOverhaulHours] = useState(40000)
  const [majorOverhaulCost, setMajorOverhaulCost] = useState(40000)

  // ====== MINING EXTRAS ======
  const [poolFee, setPoolFee] = useState(0)
  const [otherOpex, setOtherOpex] = useState(0)

  // ====== REVENUE SHARE (no party splits yet — just net profit) ======

  // Fetch live hashprice on mount (calculated from BTC price and network hashrate)
  useEffect(() => {
    const fetchHashprice = async () => {
      try {
        const [priceRes, hashrateRes] = await Promise.all([
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
          fetch('https://mempool.space/api/v1/mining/hashrate/3d')
        ])
        const priceData = await priceRes.json()
        const hashrateData = await hashrateRes.json()
        const btcPrice = priceData?.bitcoin?.usd
        const networkHashrate = hashrateData?.currentHashrate
        if (btcPrice && networkHashrate) {
          const blockReward = 3.125
          const blocksPerDay = 144
          const networkHashratePH = networkHashrate / 1e15
          const calculatedHashprice = (blockReward * btcPrice * blocksPerDay) / networkHashratePH
          setHashprice(Math.round(calculatedHashprice * 10) / 10)
        }
      } catch (err) {
        console.log('Using default hashprice, live fetch failed:', err.message)
      } finally {
        setHashpriceLoading(false)
      }
    }
    fetchHashprice()
  }, [])

  const formatCurrency = (val) => {
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}k`
    return `${sign}$${abs.toFixed(0)}`
  }
  const formatCurrencyFull = (val) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
  const formatNumber = (val) => val.toLocaleString()

  // ====== GAS-TO-POWER + MINING CALCULATIONS ======
  const gasResults = useMemo(() => {
    const cleanLoadPct = Math.min(Math.max(generatorLoadPct, 0.1), 1.0)

    // Fleet capacity is the source of truth
    const fleetCapacityMw = (generatorCount * generatorSizeKw) / 1000
    const mwGross = fleetCapacityMw

    // Calculate gas required for this fleet
    const kwhPerDay = mwGross * 1000 * 24
    const btuPerDay = kwhPerDay * heatRate
    const mcfPerDay = btuPerDay / (hhv * 1000)

    // Net available power at generator load %
    const availableMw = mwGross * cleanLoadPct
    const totalKw = availableMw * 1000
    const miners = Math.max(Math.floor(totalKw / minerPowerKW), 0)
    const phs = (miners * hashratePerUnit) / 1000
    const effectivePhs = phs * (1 - poolFee)
    const gasPrice = wahaPrice + wahaAdder
    const gasMonthly = mcfPerDay * gasPrice * (730 / 24)

    let generatorMonthly = 0
    let generatorCapex = 0
    let generatorEquityBuilt = 0

    // RTO calculations
    const rtoEquityPerMonth = generatorRtoMonthly * generatorRtoEquityPct
    const rtoMonthsToOwn = generatorBuyPrice > 0 ? Math.ceil(generatorBuyPrice / rtoEquityPerMonth) : 0
    const rtoTotalPaid = generatorRtoMonthly * rtoMonthsToOwn * generatorCount
    const rtoPremium = rtoTotalPaid - (generatorBuyPrice * generatorCount)
    const rtoPostOwnershipMonthly = generatorRtoPostMaint * generatorCount

    // Financing calculations
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
    const financePostOwnershipMonthly = generatorBuyMaintenance * generatorCount

    if (generatorMode === 'rent') {
      generatorMonthly = generatorRentMonthly * generatorCount
    } else if (generatorMode === 'buy') {
      generatorMonthly = generatorBuyMaintenance * generatorCount
      generatorCapex = generatorBuyPrice * generatorCount
    } else if (generatorMode === 'rto') {
      generatorMonthly = generatorRtoMonthly * generatorCount
      generatorEquityBuilt = generatorRtoMonthly * generatorRtoEquityPct * generatorCount * rtoMonthsToOwn
    } else if (generatorMode === 'finance') {
      generatorMonthly = financeMonthlyPayment + (generatorBuyMaintenance * generatorCount)
      generatorCapex = financeDownPayment
    }

    // ASIC CAPEX
    const asicPricePerUnit = pricePerTh * hashratePerUnit
    const asicCapex = miners * asicPricePerUnit
    const totalCapex = containerCapex + generatorCapex + asicCapex

    const monthlyRevenue = effectivePhs * hashprice * (730 / 24)
    const totalOpex = gasMonthly + generatorMonthly + otherOpex
    const netMonthly = monthlyRevenue - totalOpex

    // Effective $/kWh from gas-to-power
    const kwhPerMonth = availableMw * 730 * 1000
    const powerCostPerKwh = kwhPerMonth > 0 ? (gasMonthly + generatorMonthly) / kwhPerMonth : 0

    // Breakeven hashprice
    const breakevenHashprice = effectivePhs > 0 ? totalOpex / (effectivePhs * (730 / 24)) : 0

    // Annual projection
    const annualRevenue = monthlyRevenue * 12
    const annualOpex = totalOpex * 12
    const annualNet = netMonthly * 12

    // Grid power comparison
    const gridEquivalentPerKwh = kwhPerMonth > 0 ? totalOpex / kwhPerMonth : 0

    // Generator lifecycle
    const hoursPerYear = 24 * 365 * cleanLoadPct
    const lifetimeYears = generatorLifetimeHours / hoursPerYear
    const topOverhaulYears = topOverhaulHours / hoursPerYear
    const majorOverhaulYears = majorOverhaulHours / hoursPerYear
    const topOverhaulCount = Math.floor(generatorLifetimeHours / topOverhaulHours)
    const majorOverhaulCount = Math.floor(generatorLifetimeHours / majorOverhaulHours)
    const totalTopOverhaulCost = topOverhaulCount * topOverhaulCost * generatorCount
    const totalMajorOverhaulCost = majorOverhaulCount * majorOverhaulCost * generatorCount
    const totalOverhaulCost = totalTopOverhaulCost + totalMajorOverhaulCost
    const annualOverhaulCost = lifetimeYears > 0 ? totalOverhaulCost / lifetimeYears : 0

    return {
      mcfPerDay, mwGross, availableMw, fleetCapacityMw, miners, phs, effectivePhs,
      gasPrice, gasMonthly, generatorMonthly, generatorCapex, asicCapex, asicPricePerUnit,
      totalCapex, generatorEquityBuilt, monthlyRevenue, totalOpex, netMonthly,
      powerCostPerKwh, breakevenHashprice, annualRevenue, annualOpex, annualNet,
      gridEquivalentPerKwh,
      hoursPerYear, lifetimeYears, topOverhaulYears, majorOverhaulYears,
      topOverhaulCount, majorOverhaulCount, totalOverhaulCost, annualOverhaulCost,
      rtoEquityPerMonth, rtoMonthsToOwn, rtoTotalPaid, rtoPremium, rtoPostOwnershipMonthly,
      financeAmountPerUnit, financeDownPayment, financeMonthlyPayment, financePaymentPerUnit,
      financeTotalPaid, financeTotalInterest, financePostOwnershipMonthly,
    }
  }, [
    containerCapex, generatorLoadPct, financeDownPct, financeRate, financeTerm,
    generatorBuyMaintenance, generatorBuyPrice, generatorCount,
    generatorLifetimeHours, generatorMode, generatorRentMonthly,
    generatorRtoEquityPct, generatorRtoMonthly, generatorRtoPostMaint,
    generatorRtoTerm, generatorSizeKw, hashratePerUnit, hashprice,
    heatRate, hhv, majorOverhaulCost, majorOverhaulHours,
    minerPowerKW, efficiency, otherOpex, poolFee, pricePerTh,
    topOverhaulCost, topOverhaulHours, wahaAdder, wahaPrice,
  ])

  // Payback period
  const paybackMonths = gasResults.netMonthly > 0 && gasResults.totalCapex > 0 ? gasResults.totalCapex / gasResults.netMonthly : Infinity

  // ====== MINER PRESET HANDLER ======
  const handleMinerPreset = (e) => {
    const presets = {
      s21pro234: { kw: 3.51, th: 234, pth: 12 },
      s21pro220: { kw: 3.3,  th: 220, pth: 11 },
      s21xp:    { kw: 3.645, th: 270, pth: 16 },
      s21:      { kw: 3.5,  th: 200, pth: 10 },
      t21:      { kw: 3.61, th: 190, pth: 9 },
      s19xp:    { kw: 3.01, th: 141, pth: 8 },
      s19pro:   { kw: 3.25, th: 110, pth: 6 },
      m66s:     { kw: 5.5,  th: 298, pth: 14 },
      m63s:     { kw: 7.2,  th: 390, pth: 15 },
      m60s:     { kw: 3.42, th: 186, pth: 11 },
      m60:      { kw: 3.22, th: 172, pth: 10 },
      m50spp:   { kw: 3.13, th: 146, pth: 8 },
      m50sp:    { kw: 3.1,  th: 138, pth: 7 },
    }
    const p = presets[e.target.value]
    if (p) {
      setEfficiency((p.kw * 1000) / p.th)
      setHashratePerUnit(p.th)
      setPricePerTh(p.pth)
    }
  }

  // ====== GENERATOR PRESET HANDLER ======
  const handleGeneratorPreset = (e) => {
    if (e.target.value === 'ngen400') {
      setGeneratorSizeKw(400); setHeatRate(11500)
      setGeneratorBuyPrice(171205); setGeneratorRtoMonthly(12500); setGeneratorRentMonthly(9500)
    } else if (e.target.value === 'cat3516') {
      setGeneratorSizeKw(1600); setHeatRate(9800)
      setGeneratorBuyPrice(450000); setGeneratorRtoMonthly(25000); setGeneratorRentMonthly(18000)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Bedrock Development &mdash; Gas to Bitcoin Calculator</h1>
        <p className="subtitle">Stranded Gas &rarr; Power &rarr; Bitcoin</p>
      </header>

      {/* Mode Toggle */}
      <section className="scenario-toggle">
        <button className={mode === 'gas' ? 'active' : ''} onClick={() => setMode('gas')}>
          Gas&rarr;Power
        </button>
        <button className={mode === 'mining' ? 'active' : ''} onClick={() => setMode('mining')}>
          Power&rarr;BTC
        </button>
        <button className={mode === 'full' ? 'active' : ''} onClick={() => setMode('full')}>
          Full Model
        </button>
      </section>

      {/* ============ GAS→POWER TAB ============ */}
      {mode === 'gas' && (
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
                  <select className="preset-select" defaultValue="ngen400" onChange={handleGeneratorPreset}>
                    <option value="ngen400">NGEN-400 / TGR400 (400kW, 11,500 BTU/kWh)</option>
                    <option value="cat3516">CAT G3516 (1.6MW, 9,800 BTU/kWh)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Generator Count</label>
                    <input type="number" value={generatorCount} onChange={e => setGeneratorCount(+e.target.value)} />
                  </div>
                  <div>
                    <label>Size per Generator (kW)</label>
                    <input type="number" value={generatorSizeKw} onChange={e => setGeneratorSizeKw(+e.target.value)} />
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
                    <label>Gas Index ($/MCF)</label>
                    <input type="number" step="0.01" value={wahaPrice} onChange={e => setWahaPrice(+e.target.value)} />
                  </div>
                  <div>
                    <label>Adder ($/MCF)</label>
                    <input type="number" step="0.01" value={wahaAdder} onChange={e => setWahaAdder(+e.target.value)} />
                  </div>
                </div>
                <div className="info-row" style={{color: '#4ade80', fontWeight: '600', fontSize: '0.8rem'}}>
                  Gas cost: ~$0 (stranded)
                </div>

                <div className="result-row compact">
                  <span>Gas Price (all-in)</span>
                  <span className="highlight">${gasResults.gasPrice.toFixed(2)}/MCF</span>
                </div>

                <div className="input-row" style={{marginTop: '12px'}}>
                  <label>Generator Load: <strong>{Math.round(generatorLoadPct * 100)}%</strong> <span style={{fontSize:'0.7rem', color:'#4ade80'}}>(Ed runs at ~80%)</span></label>
                  <input type="range" min="0.5" max="1" step="0.01" value={generatorLoadPct} onChange={e => setGeneratorLoadPct(+e.target.value)} />
                  <span style={{fontSize:'0.7rem', color:'#94a3b8'}}>Running below 100% extends generator life and reduces fuel burn</span>
                </div>

                <div className="input-row">
                  <label>Available Gas (MCF/day)</label>
                  <input type="number" value={gasAvailable} onChange={e => setGasAvailable(+e.target.value)} />
                  <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>Placeholder until Ed confirms</span>
                </div>

                <div className="result-row compact" style={{marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '8px'}}>
                  <span>Gas Required</span>
                  <span className={gasResults.mcfPerDay <= gasAvailable ? 'highlight' : ''} style={{color: gasResults.mcfPerDay > gasAvailable ? '#ef4444' : undefined}}>
                    {gasResults.mcfPerDay.toFixed(0)} MCF/day {gasResults.mcfPerDay > gasAvailable ? '(exceeds available!)' : ''}
                  </span>
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
                <span>{gasResults.availableMw.toFixed(2)} MW × 730h = {(gasResults.availableMw * 730).toFixed(0).toLocaleString()} MWh/month</span>
              </div>
              <div className="table-row">
                <span>Gas Consumption</span>
                <span>{gasResults.mcfPerDay.toFixed(0)} MCF/day × 30.42d = {(gasResults.mcfPerDay * (730 / 24)).toFixed(0).toLocaleString()} MCF/month</span>
              </div>
              <div className="table-row">
                <span>Gas Cost</span>
                <span>{(gasResults.mcfPerDay * (730 / 24)).toFixed(0).toLocaleString()} MCF × ${gasResults.gasPrice.toFixed(2)} = {formatCurrencyFull(gasResults.gasMonthly)}</span>
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
                <span className="highlight">{formatCurrencyFull(gasResults.gasMonthly + gasResults.generatorMonthly)} ÷ {(gasResults.availableMw * 730 * 1000).toLocaleString()} kWh = <strong>{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢/kWh</strong></span>
              </div>
            </div>

            {/* Grid Comparison */}
            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>vs Grid @ 4¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.04 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.04
                    ? `Saving ${formatCurrency((0.04 - gasResults.powerCostPerKwh) * gasResults.availableMw * 730 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.04) * gasResults.availableMw * 730 * 1000)}/mo more`}
                </span>
              </div>
              <div className="table-row">
                <span>vs Grid @ 5¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.05 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.05
                    ? `Saving ${formatCurrency((0.05 - gasResults.powerCostPerKwh) * gasResults.availableMw * 730 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.05) * gasResults.availableMw * 730 * 1000)}/mo more`}
                </span>
              </div>
              <div className="table-row">
                <span>vs Grid @ 6¢/kWh</span>
                <span style={{color: gasResults.powerCostPerKwh < 0.06 ? '#22c55e' : '#ef4444'}}>
                  {gasResults.powerCostPerKwh < 0.06
                    ? `Saving ${formatCurrency((0.06 - gasResults.powerCostPerKwh) * gasResults.availableMw * 730 * 1000)}/mo`
                    : `Costing ${formatCurrency((gasResults.powerCostPerKwh - 0.06) * gasResults.availableMw * 730 * 1000)}/mo more`}
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

      {/* ============ POWER→BTC TAB ============ */}
      {mode === 'mining' && (
        <>
          <section className="gas-hero">
            <div>
              <h2>Power to Bitcoin Mining</h2>
              <p className="section-intro">Configure mining hardware and see revenue output. Power costs come from the Gas&rarr;Power configuration.</p>
            </div>
          </section>

          <section className="gas-grid">
            {/* Mining Hardware */}
            <div className="card">
              <div className="card-header">
                <h3>Mining Hardware</h3>
              </div>
              <div className="card-body">
                <div className="input-row">
                  <label>Miner Model</label>
                  <select className="preset-select" defaultValue="s21pro234" onChange={handleMinerPreset}>
                    <optgroup label="Bitmain Antminer">
                      <option value="s21pro234">S21 Pro 234T (234 TH/s, 3.51kW, 15 J/TH) — NEW</option>
                      <option value="s21pro220">S21 Pro 220T (220 TH/s, 3.3kW, 15 J/TH)</option>
                      <option value="s21xp">S21 XP (270 TH/s, 3.645kW, 13.5 J/TH)</option>
                      <option value="s21">S21 (200 TH/s, 3.5kW, 17.5 J/TH)</option>
                      <option value="t21">T21 (190 TH/s, 3.61kW, 19.0 J/TH)</option>
                      <option value="s19xp">S19 XP (141 TH/s, 3.01kW, 21.4 J/TH)</option>
                      <option value="s19pro">S19 Pro (110 TH/s, 3.25kW, 29.5 J/TH)</option>
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
                    <input type="number" value={hashratePerUnit} onChange={e => setHashratePerUnit(+e.target.value)} />
                  </div>
                  <div>
                    <label>Efficiency (J/TH)</label>
                    <input type="number" step="0.1" value={efficiency} onChange={e => setEfficiency(+e.target.value)} />
                  </div>
                </div>

                <div className="result-row compact">
                  <span>Power per Unit</span>
                  <span>{minerPowerKW.toFixed(2)} kW ({minerPowerW.toFixed(0)} W)</span>
                </div>

                <div className="input-row" style={{marginTop: '12px'}}>
                  <label>ASIC Price ($/TH)</label>
                  <input type="number" value={pricePerTh} onChange={e => setPricePerTh(+e.target.value)} />
                </div>
                <div className="result-row compact">
                  <span>Price per Unit</span>
                  <span>${pricePerTh}/TH × {hashratePerUnit} TH/s = <strong>{formatCurrencyFull(gasResults.asicPricePerUnit)}</strong></span>
                </div>
              </div>
            </div>

            {/* Containers & Deployment */}
            <div className="card">
              <div className="card-header">
                <h3>Containers & Deployment</h3>
              </div>
              <div className="card-body">
                <div className="input-row">
                  <label>Containers (53ft)</label>
                  <input type="number" min="1" value={containerCount} onChange={e => setContainerCount(+e.target.value)} />
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Miners per Container</label>
                    <input type="number" min="1" max={maxMinersPerContainer} value={minersPerContainerOverride} onChange={e => setMinersPerContainerOverride(+e.target.value)} />
                  </div>
                  <div style={{paddingTop: '22px'}}>
                    <span style={{fontSize: '0.72rem', color: '#94a3b8'}}>Max {maxMinersPerContainer} ({pdusPerContainer} PDUs × {outletsPerPdu})</span>
                    {minersPerContainerOverride > maxMinersPerContainer && <span style={{color:'#ef4444', fontSize:'0.72rem'}}> ⚠️ exceeds PDU cap</span>}
                  </div>
                </div>
                <div className="result-row compact">
                  <span>Container Capacity</span>
                  <span>{containerCount} × {containerMW} MW = <strong>{facilityMW} MW</strong></span>
                </div>
                <div className="result-row compact">
                  <span>Total Miners</span>
                  <span><strong>{(containerCount * minersPerContainer).toLocaleString()}</strong> ({minersPerContainer}/container)</span>
                </div>
                <div className="result-row compact">
                  <span>Container Capacity (miners)</span>
                  <span>{(containerCount * minersPerContainer).toLocaleString()} total</span>
                </div>

                <div className="result-row compact" style={{borderTop: '1px solid rgba(148,163,184,0.2)', marginTop: '8px', paddingTop: '8px'}}>
                  <span>Generator Fleet</span>
                  <span>{generatorCount} × {generatorSizeKw} kW = {gasResults.fleetCapacityMw.toFixed(2)} MW</span>
                </div>
                <div className="result-row compact">
                  <span>Net Available Power</span>
                  <span className="highlight">{gasResults.availableMw.toFixed(2)} MW</span>
                </div>
                <div className="result-row compact total">
                  <span>Miners Powered</span>
                  <span className="highlight">{gasResults.miners.toLocaleString()} units</span>
                </div>
                <div className="result-row compact">
                  <span>Total Hashrate</span>
                  <span className="highlight">{gasResults.phs.toFixed(2)} PH/s</span>
                </div>
                <div className="result-row compact">
                  <span>Effective $/kWh</span>
                  <span className="highlight">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
                </div>

                <div style={{fontSize: '0.7rem', color: '#94a3b8', marginTop: '8px'}}>
                  Phase 1: {facilityMW} MW capacity (can scale to 40 MW)
                </div>
              </div>
            </div>

            {/* Revenue & Market */}
            <div className="card">
              <div className="card-header">
                <h3>Revenue & Market</h3>
              </div>
              <div className="card-body">
                <div className="input-row">
                  <label>Hashprice ($/PH/day) {hashpriceLoading ? <span style={{fontSize: '0.7rem', color: '#fbbf24', marginLeft: '8px'}}>Loading...</span> : <a href="https://data.hashrateindex.com/network-data/bitcoin-hashprice-index" target="_blank" rel="noopener noreferrer" style={{fontSize: '0.7rem', color: '#fff', background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '3px 10px', borderRadius: '4px', marginLeft: '8px', textDecoration: 'none', fontWeight: '600'}}>Live ↗</a>}</label>
                  <input type="number" value={hashprice} onChange={e => setHashprice(+e.target.value)} />
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Pool Fee (%)</label>
                    <input type="number" step="0.1" value={(poolFee * 100).toFixed(1)} onChange={e => setPoolFee(+e.target.value / 100)} />
                  </div>
                  <div>
                    <label>Curtailment (%)</label>
                    <input type="number" step="0.5" value={(curtailment * 100).toFixed(1)} onChange={e => setCurtailment(+e.target.value / 100)} />
                  </div>
                </div>
                <div className="input-row">
                  <label>Other Opex ($/month)</label>
                  <input type="number" value={otherOpex} onChange={e => setOtherOpex(+e.target.value)} />
                </div>

                <div className="result-row compact" style={{borderTop: '1px solid rgba(148,163,184,0.2)', marginTop: '12px', paddingTop: '8px'}}>
                  <span>Monthly Revenue (gross)</span>
                  <span className="green">{formatCurrencyFull(gasResults.monthlyRevenue)}</span>
                </div>
                <div className="result-row compact">
                  <span>Monthly Power Cost</span>
                  <span className="red">{formatCurrencyFull(gasResults.gasMonthly + gasResults.generatorMonthly)}</span>
                </div>
                <div className="result-row compact total">
                  <span>Net Operating Income</span>
                  <span style={{color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700'}}>
                    {formatCurrencyFull(gasResults.netMonthly)}
                  </span>
                </div>
                <div className="result-row compact">
                  <span>Breakeven Hashprice</span>
                  <span>${gasResults.breakevenHashprice.toFixed(1)}/PH/d</span>
                </div>
              </div>
            </div>
          </section>

          {/* Mining Results Summary */}
          <section className="results-section">
            <h2>Mining Output</h2>
            <div className="stat-grid">
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
                <span className="stat-label">Power + Gas Cost</span>
                <span className="stat-value red">{formatCurrency(gasResults.gasMonthly + gasResults.generatorMonthly)}</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Net Operating</span>
                <span className="stat-value" style={{color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444'}}>
                  {formatCurrency(gasResults.netMonthly)}
                </span>
              </div>
            </div>

            {/* CAPEX Summary */}
            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>Container CAPEX ({containerCount} × $150k)</span>
                <span>{formatCurrencyFull(containerCapex)}</span>
              </div>
              {gasResults.generatorCapex > 0 && (
                <div className="table-row">
                  <span>Generator CAPEX ({generatorMode === 'buy' ? 'Purchase' : `${financeDownPct}% Down`})</span>
                  <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
                </div>
              )}
              <div className="table-row">
                <span>Miner CAPEX ({gasResults.miners.toLocaleString()} × {formatCurrencyFull(gasResults.asicPricePerUnit)})</span>
                <span>{formatCurrencyFull(gasResults.asicCapex)}</span>
              </div>
              <div className="table-row total">
                <span>Total CAPEX</span>
                <span className="highlight">{formatCurrencyFull(gasResults.totalCapex)}</span>
              </div>
              <div className="table-row">
                <span>Payback Period</span>
                <span className="highlight">
                  {paybackMonths === Infinity ? 'N/A' : `${paybackMonths.toFixed(1)} months`}
                </span>
              </div>
            </div>
          </section>

          {/* Revenue Share */}
          <section className="comparison-section">
            <h2>Revenue Share</h2>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '600px', margin: '0 auto'}}>
              <div style={{background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(15,23,42,0.9) 100%)', border: '2px solid rgba(34,197,94,0.5)', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
                <div style={{fontSize: '2rem', fontWeight: '700', color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444'}}>{formatCurrency(gasResults.netMonthly)}</div>
                <div style={{fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Net Monthly Profit</div>
              </div>
              <div style={{background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(15,23,42,0.9) 100%)', border: '2px solid rgba(59,130,246,0.5)', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
                <div style={{fontSize: '2rem', fontWeight: '700', color: gasResults.annualNet >= 0 ? '#3b82f6' : '#ef4444'}}>{formatCurrency(gasResults.annualNet)}</div>
                <div style={{fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px'}}>Net Annual Profit</div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ============ FULL MODEL TAB ============ */}
      {mode === 'full' && (
        <>
          {/* Configuration Section */}
          <section className="controls-section">
            <h2>Model Configuration</h2>
            <div className="controls-grid">
              {/* Column 1: Site & Mining */}
              <div className="control-group">
                <h3>Site & Mining</h3>
                <div className="input-row">
                  <label>Containers (53ft, {containerMW} MW each)</label>
                  <input type="number" min="1" value={containerCount} onChange={e => setContainerCount(+e.target.value)} />
                </div>
                <div className="input-row" style={{marginTop: '-4px'}}>
                  <label>Miners per Container</label>
                  <input type="number" min="1" max={maxMinersPerContainer} value={minersPerContainerOverride} onChange={e => setMinersPerContainerOverride(+e.target.value)} />
                  <span style={{fontSize:'0.7rem', color:'#94a3b8'}}>Max {maxMinersPerContainer} ({pdusPerContainer} PDUs × {outletsPerPdu} outlets){minersPerContainerOverride > maxMinersPerContainer ? ' ⚠️ exceeds PDU cap' : ''}</span>
                </div>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '-8px', marginBottom: '12px', paddingLeft: '4px'}}>
                  {containerCount} × {containerMW} MW = <strong>{facilityMW} MW</strong> capacity (can scale to 40 MW)
                </div>
                <div className="input-row">
                  <label>Miner Model</label>
                  <select className="preset-select" defaultValue="s21pro234" onChange={handleMinerPreset}>
                    <optgroup label="Bitmain Antminer">
                      <option value="s21pro234">S21 Pro 234T (234 TH/s, 3.51kW)</option>
                      <option value="s21pro220">S21 Pro 220T (220 TH/s, 3.3kW)</option>
                      <option value="s21xp">S21 XP (270 TH/s, 3.645kW)</option>
                      <option value="s21">S21 (200 TH/s, 3.5kW)</option>
                      <option value="t21">T21 (190 TH/s, 3.61kW)</option>
                      <option value="s19xp">S19 XP (141 TH/s, 3.01kW)</option>
                      <option value="s19pro">S19 Pro (110 TH/s, 3.25kW)</option>
                    </optgroup>
                    <optgroup label="MicroBT Whatsminer">
                      <option value="m63s">M63S Hyd (390 TH/s, 7.2kW)</option>
                      <option value="m66s">M66S Hyd (298 TH/s, 5.5kW)</option>
                      <option value="m60s">M60S (186 TH/s, 3.42kW)</option>
                      <option value="m60">M60 (172 TH/s, 3.22kW)</option>
                      <option value="m50spp">M50S++ (146 TH/s, 3.13kW)</option>
                      <option value="m50sp">M50S+ (138 TH/s, 3.1kW)</option>
                    </optgroup>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>TH/s per unit</label>
                    <input type="number" value={hashratePerUnit} onChange={e => setHashratePerUnit(+e.target.value)} />
                  </div>
                  <div>
                    <label>J/TH</label>
                    <input type="number" step="0.1" value={efficiency} onChange={e => setEfficiency(+e.target.value)} />
                  </div>
                </div>
                <div className="input-row">
                  <label>ASIC Price ($/TH)</label>
                  <input type="number" value={pricePerTh} onChange={e => setPricePerTh(+e.target.value)} />
                </div>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', paddingLeft: '4px'}}>
                  {minersPerContainer} miners/container × {containerCount} = <strong>{(containerCount * minersPerContainer).toLocaleString()}</strong> miners ({pdusPerContainer} PDUs × {outletsPerPdu} outlets cap) |
                  Powered: <strong>{gasResults.miners.toLocaleString()}</strong> miners = {gasResults.phs.toFixed(1)} PH/s
                </div>
              </div>

              {/* Column 2: Power Generation */}
              <div className="control-group">
                <h3>Power Generation</h3>
                <div className="input-row">
                  <label>Generator Model</label>
                  <select className="preset-select" defaultValue="ngen400" onChange={handleGeneratorPreset}>
                    <option value="ngen400">TGR400 (400kW)</option>
                    <option value="cat3516">CAT G3516 (1.6MW)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Count</label>
                    <input type="number" value={generatorCount} onChange={e => setGeneratorCount(+e.target.value)} />
                  </div>
                  <div>
                    <label>kW each</label>
                    <input type="number" value={generatorSizeKw} onChange={e => setGeneratorSizeKw(+e.target.value)} />
                  </div>
                </div>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '-8px', marginBottom: '4px', paddingLeft: '4px'}}>
                  Fleet: <strong>{gasResults.fleetCapacityMw.toFixed(2)} MW</strong> × {Math.round(generatorLoadPct * 100)}% load = <strong>{gasResults.availableMw.toFixed(2)} MW</strong> to miners
                </div>
                <div className="input-row" style={{marginBottom: '12px'}}>
                  <label>Generator Load: <strong>{Math.round(generatorLoadPct * 100)}%</strong> <span style={{fontSize:'0.7rem', color:'#4ade80'}}>(Ed's ~80%)</span></label>
                  <input type="range" min="0.5" max="1" step="0.01" value={generatorLoadPct} onChange={e => setGeneratorLoadPct(+e.target.value)} />
                </div>

                <div className="pill-toggle small">
                  <button className={generatorMode === 'rent' ? 'active' : ''} onClick={() => setGeneratorMode('rent')}>Rent</button>
                  <button className={generatorMode === 'buy' ? 'active' : ''} onClick={() => setGeneratorMode('buy')}>Buy</button>
                  <button className={generatorMode === 'rto' ? 'active' : ''} onClick={() => setGeneratorMode('rto')}>RTO</button>
                  <button className={generatorMode === 'finance' ? 'active' : ''} onClick={() => setGeneratorMode('finance')}>Finance</button>
                </div>

                {generatorMode === 'rent' && (
                  <div className="input-row">
                    <label>$/generator/month</label>
                    <input type="number" value={generatorRentMonthly} onChange={e => setGeneratorRentMonthly(+e.target.value)} />
                  </div>
                )}
                {generatorMode === 'buy' && (
                  <div className="input-row two-col">
                    <div>
                      <label>Buy Price ($/unit)</label>
                      <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(+e.target.value)} />
                    </div>
                    <div>
                      <label>Maint ($/unit/mo)</label>
                      <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(+e.target.value)} />
                    </div>
                  </div>
                )}
                {generatorMode === 'rto' && (
                  <div className="input-row">
                    <label>RTO ($/generator/month)</label>
                    <input type="number" value={generatorRtoMonthly} onChange={e => setGeneratorRtoMonthly(+e.target.value)} />
                  </div>
                )}
                {generatorMode === 'finance' && (
                  <div className="input-row two-col">
                    <div>
                      <label>Rate (%)</label>
                      <input type="number" step="0.1" value={financeRate} onChange={e => setFinanceRate(+e.target.value)} />
                    </div>
                    <div>
                      <label>Term (mo)</label>
                      <input type="number" value={financeTerm} onChange={e => setFinanceTerm(+e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="result-row compact total" style={{marginTop: '8px'}}>
                  <span>Monthly Generator Cost</span>
                  <span className="highlight">{formatCurrencyFull(gasResults.generatorMonthly)}</span>
                </div>
                <div className="result-row compact">
                  <span>Effective $/kWh</span>
                  <span className="highlight">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
                </div>
                <div className="info-row" style={{color: '#4ade80', fontWeight: '600', fontSize: '0.8rem'}}>
                  Gas cost: ~$0 (stranded)
                </div>
              </div>

              {/* Column 3: Market & CAPEX */}
              <div className="control-group">
                <h3>Market & CAPEX</h3>
                <div className="input-row">
                  <label>Hashprice: $/PH/day {hashpriceLoading ? <span style={{fontSize: '0.65rem', color: '#fbbf24'}}>Loading...</span> : <a href="https://data.hashrateindex.com/network-data/bitcoin-hashprice-index" target="_blank" rel="noopener noreferrer" style={{fontSize: '0.65rem', color: '#fff', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '2px 8px', borderRadius: '4px', marginLeft: '4px', textDecoration: 'none', fontWeight: '600'}}>Live ↗</a>}</label>
                  <input type="number" min="1" step="0.5" value={hashprice} onChange={e => setHashprice(+e.target.value)} />
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Pool Fee (%)</label>
                    <input type="number" step="0.1" value={(poolFee * 100).toFixed(1)} onChange={e => setPoolFee(+e.target.value / 100)} />
                  </div>
                  <div>
                    <label>Other Opex ($/mo)</label>
                    <input type="number" value={otherOpex} onChange={e => setOtherOpex(+e.target.value)} />
                  </div>
                </div>

                <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.2)'}}>
                  <div className="input-row">
                    <label>Container CAPEX ($)</label>
                    <input
                      type="text"
                      value={containerCapex.toLocaleString()}
                      onChange={e => setContainerCapex(+e.target.value.replace(/,/g, ''))}
                    />
                  </div>
                  <div style={{fontSize: '0.7rem', color: '#94a3b8', marginTop: '-8px', marginBottom: '8px', paddingLeft: '4px'}}>
                    {containerCount} containers × $150k = ${(containerCapex / 1000).toFixed(0)}k
                  </div>
                  <div className="result-row compact">
                    <span>Generator CAPEX</span>
                    <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
                  </div>
                  <div className="result-row compact">
                    <span>Miner CAPEX</span>
                    <span>{formatCurrencyFull(gasResults.asicCapex)}</span>
                  </div>
                  <div className="result-row compact total">
                    <span>Total CAPEX</span>
                    <span className="highlight">{formatCurrencyFull(gasResults.totalCapex)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Key Metrics */}
          <section className="results-section">
            <h2>Key Metrics</h2>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Net Power</span>
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
                <span className="stat-label">Gross Revenue</span>
                <span className="stat-value green">{formatCurrency(gasResults.monthlyRevenue)}/mo</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Net Operating</span>
                <span className="stat-value" style={{color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444'}}>
                  {formatCurrency(gasResults.netMonthly)}/mo
                </span>
              </div>
            </div>
          </section>

          {/* Revenue Share */}
          <section className="comparison-section">
            <h2>Revenue Share</h2>
            <div className="simple-table">
              <div className="table-row">
                <span>Gross BTC Revenue</span>
                <span className="green">{formatCurrencyFull(gasResults.monthlyRevenue)}</span>
              </div>
              {gasResults.gasMonthly > 0 && (
                <div className="table-row">
                  <span>Gas Cost ({gasResults.mcfPerDay.toFixed(0)} MCF/day × ${gasResults.gasPrice.toFixed(2)})</span>
                  <span className="red">-{formatCurrencyFull(gasResults.gasMonthly)}</span>
                </div>
              )}
              <div className="table-row">
                <span>Generator Cost ({generatorMode.toUpperCase()}: {generatorCount} × {generatorSizeKw}kW)</span>
                <span className="red">-{formatCurrencyFull(gasResults.generatorMonthly)}</span>
              </div>
              {otherOpex > 0 && (
                <div className="table-row">
                  <span>Other Operating Expenses</span>
                  <span className="red">-{formatCurrencyFull(otherOpex)}</span>
                </div>
              )}
              <div className="table-row total">
                <span>Net Profit</span>
                <span style={{color: gasResults.netMonthly >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '1.1rem'}}>
                  {formatCurrencyFull(gasResults.netMonthly)}
                </span>
              </div>
            </div>
          </section>

          {/* CAPEX Summary */}
          <section className="comparison-section">
            <h2>CAPEX Summary</h2>
            <div className="simple-table">
              <div className="table-row">
                <span>Container CAPEX ({containerCount} × $150k)</span>
                <span>{formatCurrencyFull(containerCapex)}</span>
              </div>
              {gasResults.generatorCapex > 0 && (
                <div className="table-row">
                  <span>Generator CAPEX ({generatorMode === 'buy' ? 'Purchase' : `${financeDownPct}% Down`})</span>
                  <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
                </div>
              )}
              <div className="table-row">
                <span>Miner CAPEX ({gasResults.miners.toLocaleString()} miners × {formatCurrencyFull(gasResults.asicPricePerUnit)})</span>
                <span>{formatCurrencyFull(gasResults.asicCapex)}</span>
              </div>
              <div className="table-row total">
                <span>Total Upfront CAPEX</span>
                <span className="highlight">{formatCurrencyFull(gasResults.totalCapex)}</span>
              </div>
              <div className="table-row">
                <span>Payback Period</span>
                <span className="highlight">
                  {paybackMonths === Infinity ? 'N/A' : `${paybackMonths.toFixed(1)} months`}
                </span>
              </div>
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
              {gasResults.gasMonthly > 0 && (
                <div className="table-row">
                  <span>Annual Gas Cost</span>
                  <span className="red">{formatCurrency(gasResults.gasMonthly * 12)}</span>
                </div>
              )}
              <div className="table-row">
                <span>Annual Generator Cost</span>
                <span className="red">{formatCurrency(gasResults.generatorMonthly * 12)}</span>
              </div>
              {otherOpex > 0 && (
                <div className="table-row">
                  <span>Annual Other Opex</span>
                  <span className="red">{formatCurrency(otherOpex * 12)}</span>
                </div>
              )}
              <div className="table-row total">
                <span>Annual Net Operating Income</span>
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
            <h2>Sensitivity Analysis — Net Monthly Profit</h2>
            <p className="section-intro">How net profit changes with gas price and hashprice</p>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Gas Price \ Hashprice</th>
                    <th>$25/PH</th>
                    <th>$30/PH</th>
                    <th>$37/PH</th>
                    <th>$45/PH</th>
                    <th>$55/PH</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 0.50, 1.00, 1.50, 2.00].map(gp => (
                    <tr key={gp}>
                      <td className="row-label">${gp.toFixed(2)}/MCF</td>
                      {[25, 30, 37, 45, 55].map(hp => {
                        const scenarioGasMonthly = gasResults.mcfPerDay * gp * (730 / 24)
                        const scenarioRevenue = gasResults.effectivePhs * hp * (730 / 24)
                        const scenarioNet = scenarioRevenue - scenarioGasMonthly - gasResults.generatorMonthly - otherOpex
                        const isCurrentScenario = Math.abs(gp - gasResults.gasPrice) < 0.01 && Math.abs(hp - hashprice) < 0.5

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

          {/* Navigation */}
          <div className="next-step">
            <button onClick={() => setMode('gas')}>Gas&rarr;Power Details</button>
            <button onClick={() => setMode('mining')} style={{marginLeft: '12px'}}>Power&rarr;BTC Details</button>
          </div>
        </>
      )}

      <footer>
        <p>Projections based on current market assumptions. Actual results will vary with BTC price, network difficulty, and operational factors.</p>
        <p className="company">Bedrock Development</p>
      </footer>
    </div>
  )
}

export default App
