import { useState, useMemo } from 'react'
import './App.css'

function App() {
  // Presentation Mode: 'models' (explain business) or 'deal' (structure investment)
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

  const formatNumber = (val) => val.toLocaleString()

  return (
    <div className="app">
      <header>
        <h1>Pecos 15 MW Bitcoin Mining</h1>
        <p className="subtitle">Astro Solutions LLC</p>
      </header>

      {/* Mode Toggle */}
      <section className="scenario-toggle">
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
                  <label>Co-Mining Share: {Math.round(coMiningShare * 100)}%</label>
                  <input type="range" min="0.20" max="0.50" step="0.05" value={coMiningShare} onChange={e => setCoMiningShare(+e.target.value)} />
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
            <h2>Mix the Models</h2>
            <p className="section-intro">Blend Co-Mining and Self-Mining to find the optimal capital/return balance</p>

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
          <section className="comparison-section">
            <h2>Investment Structure</h2>
            <p className="section-intro">Different splits for different capital commitments</p>

            <div className="deal-models">
              {/* Co-Mining Splits */}
              <div className="deal-model co-deal">
                <h3>Co-Mining Deal</h3>
                <p className="deal-desc">Lower capital ({formatCurrency(results.coMiningCapex)}) → Lower investor share</p>

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
                <p className="deal-desc">Higher capital ({formatCurrency(results.selfMiningCapex)}) → Higher investor share</p>

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
              <span className="legend-investor">■ Investor</span>
              <span className="legend-operator">■ Operator</span>
            </div>
          </section>

          {/* Blended Scenario */}
          <section className="mixer-section">
            <h2>Blended Scenario</h2>
            <p className="section-intro">Mix Co-Mining and Self-Mining to customize the deal</p>

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
              <h3>Blended Investor Returns</h3>
              <div className="mix-stats">
                <div className="mix-stat highlight-stat">
                  <span className="mix-stat-label">Investment</span>
                  <span className="mix-stat-value">{formatCurrency(results.mixCapex)}</span>
                </div>
                <div className="mix-stat highlight-stat">
                  <span className="mix-stat-label">Payback</span>
                  <span className="mix-stat-value">{results.mixPayback.toFixed(1)} mo</span>
                </div>
                <div className="mix-stat highlight-stat">
                  <span className="mix-stat-label">Annual ROI</span>
                  <span className="mix-stat-value">{results.mixROI.toFixed(0)}%</span>
                </div>
              </div>
              <div className="blended-returns" style={{marginTop: '16px'}}>
                <div className="blended-return">
                  <span>Phase 1 Split</span>
                  <span>{(results.mixPhase1Pct * 100).toFixed(0)}% / {((1 - results.mixPhase1Pct) * 100).toFixed(0)}%</span>
                </div>
                <div className="blended-return">
                  <span>Phase 1 Investor</span>
                  <span className="highlight">${formatNumber(Math.round(results.mixPhase1Investor))}/mo</span>
                </div>
                <div className="blended-return">
                  <span>Phase 2 Split</span>
                  <span>{(results.mixPhase2Pct * 100).toFixed(0)}% / {((1 - results.mixPhase2Pct) * 100).toFixed(0)}%</span>
                </div>
                <div className="blended-return">
                  <span>Phase 2 Investor</span>
                  <span>${formatNumber(Math.round(results.mixPhase2Investor))}/mo</span>
                </div>
              </div>
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
                <span className="col-label">Phase 1 - Investor</span>
                <span className="col-co">${formatNumber(Math.round(results.coPhase1Investor))}/mo</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPhase1Investor))}/mo</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 1 - Operator</span>
                <span className="col-co">${formatNumber(Math.round(results.coPhase1Operator))}/mo</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPhase1Operator))}/mo</span>
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
                <span className="col-label">Phase 2 Split</span>
                <span className="col-co">{Math.round(coPhase2Pct * 100)}% / {Math.round((1 - coPhase2Pct) * 100)}%</span>
                <span className="col-self">{Math.round(selfPhase2Pct * 100)}% / {Math.round((1 - selfPhase2Pct) * 100)}%</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 2 - Investor</span>
                <span className="col-co">${formatNumber(Math.round(results.coPhase2Investor))}/mo</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPhase2Investor))}/mo</span>
              </div>
              <div className="table-row">
                <span className="col-label">Phase 2 - Operator</span>
                <span className="col-co">${formatNumber(Math.round(results.coPhase2Operator))}/mo</span>
                <span className="col-self">${formatNumber(Math.round(results.selfPhase2Operator))}/mo</span>
              </div>
            </div>
          </section>

          {/* Sensitivity Table */}
          <section className="comparison-section">
            <h2>Sensitivity Analysis - Payback Period (Months)</h2>
            <p className="section-intro">Based on current blended model ({((1 - modelMix) * 100).toFixed(0)}% Co-Mining / {(modelMix * 100).toFixed(0)}% Self-Mining)</p>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Energy \ Hashprice</th>
                    <th>$30/PH</th>
                    <th>$38/PH</th>
                    <th>$60/PH</th>
                  </tr>
                </thead>
                <tbody>
                  {[4, 4.5, 5.5].map(ep => (
                    <tr key={ep}>
                      <td className="row-label">{ep}¢/kWh</td>
                      {[30, 38, 60].map(hp => {
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
                        const isCurrentScenario = ep === energyPrice && hp === hashprice

                        return (
                          <td key={hp} className={`${mixInvestor <= 0 ? 'negative' : ''} ${isCurrentScenario ? 'current' : ''}`}>
                            {mixPayback ? `${mixPayback.toFixed(1)} mo` : 'N/A'}
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
