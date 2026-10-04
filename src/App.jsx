import { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'
import { computeSite, buildHandoff, halvingMonthFromHeight, halvingMonthFromDate } from './siteModel.js'

// Gas to Bitcoin Calculator
// Adapted from Pecos Mining Calculator (AstroMiners)

// Whole dollars; negatives with a leading minus. `minus` renders a cost line:
// a positive cost shows as "-$x", a negative cost (income, e.g. paid-to-take gas) as "+$x".
// One source for the page's starting values; Reset to defaults applies exactly these.
const MODEL_DEFAULTS = {
  containerCount: 4, containerCostPerUnit: 90000, minersPerContainerOverride: 324, setupPerContainer: 26385, containerKw: 1400,
  selectedMinerPreset: 's21pro234', hashratePerUnit: 234, efficiency: 15.0, pricePerTh: 10,
  selectedGeneratorPreset: 'ngen400', generatorCount: 16, generatorSizeKw: 400, generatorMode: 'finance',
  generatorBuyPrice: 185000, generatorBuyMaintenance: 1500, generatorRentMonthly: 10500,
  generatorRtoMonthly: 13500, generatorRtoTerm: 28, generatorRtoEquityPct: 0.50, generatorRtoPostMaint: 1500,
  financeRate: 5.0, financeTerm: 60, financeDownPct: 20,
  generatorLifetimeHours: 60000, topOverhaulHours: 20000, topOverhaulCost: 20000, majorOverhaulHours: 40000, majorOverhaulCost: 40000,
  heatRate: 11500, hhv: 1000, wahaAdderStr: '0', generatorLoadPct: 0.85,
  poolFee: 0, curtailment: 0, otherOpex: 0, staffMonthly: 25000, minerRepairPerMiner: 7, hashprice: 39.5
}
const usd = (v) => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`
const minus = (v) => (v > 0 ? `-${usd(v)}` : v < 0 ? `+${usd(-v)}` : usd(0))

const Row = ({ label, note, value, cls, total }) => (
  <div className={`table-row${total ? ' total' : ''}`}>
    <span>{label}{note && <span style={{fontSize: '0.75rem', color: '#64748b', marginLeft: '6px'}}>{note}</span>}</span>
    <span className={cls}>{value}</span>
  </div>
)

// Monthly P&L at full build; `months` = 12 gives the same lines per year.
// Shared by the Power→BTC and Full Model tabs so both show identical numbers.
function PnLTable({ r, inputs, months = 1 }) {
  const k = months
  const { generatorMode, generatorCount, generatorSizeKw, minerRepairPerMiner, otherOpex, poolFee, curtailment } = inputs
  const modeLabel = { rent: 'rent', buy: 'maintenance', rto: 'rent-to-own payment', finance: 'loan payment + maintenance' }[generatorMode]
  const net = r.netMonthly * k
  const unit = months === 1 ? 'month' : months === 12 ? 'year' : `${months} months`
  return (
    <div className="simple-table">
      <Row label="Revenue from hashrate" note={`${(r.phs * (1 - (parseFloat(curtailment) || 0))).toFixed(1)} PH/s × $${(parseFloat(inputs.hashprice) || 0).toFixed(1)}/PH/day × ${months === 1 ? '30.4 days' : '365 days'}`} value={usd(r.grossRevenue * k)} cls="green" />
      {poolFee > 0 && <Row label="Pool fee" note={`${(poolFee * 100).toFixed(1)}% of revenue`} value={minus(r.poolMonthly * k)} cls="red" />}
      <Row label={r.gasMonthly < 0 ? 'Gas income' : 'Gas'} note={`${Math.round(r.mcfPerDay).toLocaleString()} MCF/day × $${r.gasPrice.toFixed(2)}/MCF`} value={minus(r.gasMonthly * k)} cls={r.gasMonthly < 0 ? 'green' : 'red'} />
      <Row label="Generators" note={`${generatorCount} × ${generatorSizeKw} kW, ${modeLabel}`} value={minus(r.generatorMonthly * k)} cls="red" />
      {r.overhaulReserveMonthly > 0 && <Row label="Overhaul reserve" note="owned generators: top and major overhauls spread over their life" value={minus(r.overhaulReserveMonthly * k)} cls="red" />}
      <Row label="Miner repairs" note={`${r.miners.toLocaleString()} × $${minerRepairPerMiner}/month`} value={minus(r.repairsMonthly * k)} cls="red" />
      <Row label="Staff & overhead" value={minus(r.staffMonthly * k)} cls="red" />
      {otherOpex > 0 && <Row label="Other opex" value={minus(otherOpex * k)} cls="red" />}
      <Row label={`Operating cash per ${unit}`} value={usd(net)} cls={net >= 0 ? 'green' : 'red'} total />
      {months === 12 && <Row label="Margin on revenue" value={r.grossRevenue > 0 ? `${((r.netMonthly / r.grossRevenue) * 100).toFixed(1)}%` : 'n/a'} />}
    </div>
  )
}

// What the equipment costs in full, what is paid in cash upfront, and the
// cash-on-cash simple payback that upfront cash implies.
function EquipmentTable({ r, inputs, paybackMonths }) {
  const { containerCount, containerCostPerUnit, setupPerContainer, generatorMode, generatorCount, financeDownPct, hashratePerUnit, pricePerTh } = inputs
  const generatorNote = {
    buy: `${generatorCount} × ${usd(r.generatorFullPrice / Math.max(generatorCount, 1))}, bought outright`,
    finance: `${generatorCount} × ${usd(r.generatorFullPrice / Math.max(generatorCount, 1))}; ${financeDownPct}% down (${usd(r.generatorCapex)}), ${usd(r.generatorFinanced)} in the loan payments`,
    rto: 'rent-to-own: not bought; paid through the monthly payments',
    rent: 'rented: not bought'
  }[generatorMode]
  return (
    <div className="simple-table">
      <Row label="Containers & electrical" note={`${containerCount} × ${usd(containerCostPerUnit)}`} value={usd(r.containerCapex)} />
      <Row label="Setup & commissioning" note={`${containerCount} × ${usd(parseFloat(setupPerContainer) || 0)}`} value={usd(r.setupCapex)} />
      <Row label="Generators" note={generatorNote} value={usd(r.generatorEquipment)} />
      <Row label="Miners" note={`${r.miners.toLocaleString()} × ${hashratePerUnit} TH × $${pricePerTh}/TH`} value={usd(r.asicCapex)} />
      <Row label="Equipment cost" note="everything the site owns, before financing" value={usd(r.equipmentCost)} cls="highlight" total />
      <Row label="Cash upfront" note={generatorMode === 'finance' ? 'equipment cost with the generator down payment instead of the full price' : generatorMode === 'buy' ? 'same as equipment cost' : 'containers, setup and miners; generators are paid monthly'} value={usd(r.cashUpfront)} cls="highlight" />
      <Row label="Simple payback (cash-on-cash)" note="cash upfront ÷ operating cash per month after generator payments; no ramp, no halving"
        value={paybackMonths === Infinity ? 'never at this operating cash' : `${paybackMonths.toFixed(1)} months`} cls="highlight" />
    </div>
  )
}

function App() {
  // Tab mode: 'gas' (Gas→Power), 'mining' (Power→BTC), 'full' (Full Model)
  const [mode, setMode] = useState('gas')
  const [hashpriceLoading, setHashpriceLoading] = useState(true)
  const [hashpriceUpdatedAt, setHashpriceUpdatedAt] = useState(null)
  // Gas index snapshot (prices.json, written at build time) + which index fills the price field
  const [gasFeed, setGasFeed] = useState(null)
  const [gasIndexKey, setGasIndexKey] = useState('custom')
  const restoredRef = useRef(false)   // inputs restored from the cash-flow hand-off: keep their gas price
  const touchedRef = useRef({ hashprice: false, gas: false })   // a feed must not overwrite what the user typed
  const liveHashpriceRef = useRef(null)
  const [handoffError, setHandoffError] = useState(null)
  const [hashpriceSource, setHashpriceSource] = useState('default')   // live | manual | saved | default

  // ====== CONTAINER & FACILITY ======
  const [containerCount, setContainerCount] = useState(MODEL_DEFAULTS.containerCount)  // 4 × 53ft containers
  const [containerKw, setContainerKw] = useState(MODEL_DEFAULTS.containerKw)   // electrical capacity of one 53-ft container (kW)
  const [containerCostPerUnit, setContainerCostPerUnit] = useState(MODEL_DEFAULTS.containerCostPerUnit)  // $90k per container
  const containerCapex = containerCostPerUnit * containerCount             // total auto-scales

  // ====== MINER SPECS (single set — no self/co split) ======
  const [selectedMinerPreset, setSelectedMinerPreset] = useState(MODEL_DEFAULTS.selectedMinerPreset)
  const [selectedGeneratorPreset, setSelectedGeneratorPreset] = useState(MODEL_DEFAULTS.selectedGeneratorPreset)
  const [hashratePerUnit, setHashratePerUnit] = useState(MODEL_DEFAULTS.hashratePerUnit)   // TH/s per unit (S21 Pro 234T)
  const [efficiency, setEfficiency] = useState(MODEL_DEFAULTS.efficiency)            // J/TH (3510W / 234TH)
  const [pricePerTh, setPricePerTh] = useState(MODEL_DEFAULTS.pricePerTh)              // $/TH

  // ====== CONTAINER PHYSICAL CAPACITY ======
  const pdusPerContainer = 28                                    // 28 PDUs per container (confirmed from wiring docs + photos)
  const outletsPerPdu = 12                                       // 12 C19/C20 outlets per PDU strip
  const maxMinersPerContainer = pdusPerContainer * outletsPerPdu // 336 hard cap — PDU slots are the bottleneck
  const [minersPerContainerOverride, setMinersPerContainerOverride] = useState(MODEL_DEFAULTS.minersPerContainerOverride) // settable by user

  // Derived miner values
  const minerPowerW = parseFloat(efficiency) * parseFloat(hashratePerUnit)  // Watts per miner
  const minerPowerKW = minerPowerW / 1000                                   // kW per miner
  const minersPerContainer = Math.min(minersPerContainerOverride, maxMinersPerContainer)
  const facilityMW = ((parseFloat(containerKw) || 0) * (parseInt(containerCount) || 0) / 1000).toFixed(1)

  // ====== MARKET ======
  const [hashprice, setHashprice] = useState(MODEL_DEFAULTS.hashprice)              // $/PH/day
  const [curtailment, setCurtailment] = useState(MODEL_DEFAULTS.curtailment)             // 0% curtailment default

  // ====== GAS-TO-POWER ======
  const [heatRate, setHeatRate] = useState(MODEL_DEFAULTS.heatRate)               // BTU/kWh (TGR400 spec)
  const [hhv, setHhv] = useState(MODEL_DEFAULTS.hhv)                          // BTU/scf
  const [wahaPriceStr, setWahaPriceStr] = useState('0.50')    // replaced by the live index when prices.json loads
  const wahaPrice = parseFloat(wahaPriceStr) || 0
  const [wahaAdderStr, setWahaAdderStr] = useState(MODEL_DEFAULTS.wahaAdderStr)         // ~$0
  const wahaAdder = parseFloat(wahaAdderStr) || 0
  const [generatorLoadPct, setGeneratorLoadPct] = useState(MODEL_DEFAULTS.generatorLoadPct)  // 85% sustained operating point

  // ====== GENERATORS (Taylor Power TGR400 defaults) ======
  const [generatorCount, setGeneratorCount] = useState(MODEL_DEFAULTS.generatorCount) // 4 containers × 4 gens
  const [generatorSizeKw, setGeneratorSizeKw] = useState(MODEL_DEFAULTS.generatorSizeKw)
  const [generatorMode, setGeneratorMode] = useState(MODEL_DEFAULTS.generatorMode)
  const [generatorRentMonthly, setGeneratorRentMonthly] = useState(MODEL_DEFAULTS.generatorRentMonthly)
  const [generatorBuyPrice, setGeneratorBuyPrice] = useState(MODEL_DEFAULTS.generatorBuyPrice)
  const [generatorBuyMaintenance, setGeneratorBuyMaintenance] = useState(MODEL_DEFAULTS.generatorBuyMaintenance)
  const [generatorRtoMonthly, setGeneratorRtoMonthly] = useState(MODEL_DEFAULTS.generatorRtoMonthly)
  const [generatorRtoTerm, setGeneratorRtoTerm] = useState(MODEL_DEFAULTS.generatorRtoTerm)
  const [generatorRtoEquityPct, setGeneratorRtoEquityPct] = useState(MODEL_DEFAULTS.generatorRtoEquityPct)
  const [generatorRtoPostMaint, setGeneratorRtoPostMaint] = useState(MODEL_DEFAULTS.generatorRtoPostMaint)
  const [financeRate, setFinanceRate] = useState(MODEL_DEFAULTS.financeRate)
  const [financeTerm, setFinanceTerm] = useState(MODEL_DEFAULTS.financeTerm)
  const [financeDownPct, setFinanceDownPct] = useState(MODEL_DEFAULTS.financeDownPct)
  const [generatorLifetimeHours, setGeneratorLifetimeHours] = useState(MODEL_DEFAULTS.generatorLifetimeHours)
  const [topOverhaulHours, setTopOverhaulHours] = useState(MODEL_DEFAULTS.topOverhaulHours)
  const [topOverhaulCost, setTopOverhaulCost] = useState(MODEL_DEFAULTS.topOverhaulCost)
  const [majorOverhaulHours, setMajorOverhaulHours] = useState(MODEL_DEFAULTS.majorOverhaulHours)
  const [majorOverhaulCost, setMajorOverhaulCost] = useState(MODEL_DEFAULTS.majorOverhaulCost)

  // ====== MINING EXTRAS ======
  const [poolFee, setPoolFee] = useState(MODEL_DEFAULTS.poolFee)
  const [otherOpex, setOtherOpex] = useState(MODEL_DEFAULTS.otherOpex)
  const [staffMonthly, setStaffMonthly] = useState(MODEL_DEFAULTS.staffMonthly)          // $/month, whole site
  const [minerRepairPerMiner, setMinerRepairPerMiner] = useState(MODEL_DEFAULTS.minerRepairPerMiner) // $/miner/month
  const [setupPerContainer, setSetupPerContainer] = useState(MODEL_DEFAULTS.setupPerContainer) // $/container, one-time

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
          const live = Math.round(calculatedHashprice * 10) / 10
          liveHashpriceRef.current = live
          if (!touchedRef.current.hashprice) { setHashprice(live); setHashpriceSource('live') }
          setHashpriceUpdatedAt(new Date())
        }
      } catch (err) {
        console.log('Using default hashprice, live fetch failed:', err.message)
      } finally {
        setHashpriceLoading(false)
      }
    }
    fetchHashprice()
  }, [])

  // Fill the gas price from the live index snapshot (Waha first, then Henry Hub).
  // The helper module lives in public/ so cashflow.html can share it; hence the URL import.
  const hhvRef = useRef(1000)
  hhvRef.current = parseFloat(hhv) || 1000   // current HHV for conversions that happen after a fetch resolves
  const applyGasIndex = (feed, index) => {
    setGasIndexKey(index.key)
    setWahaPriceStr(feed.mmbtuToMcf(index.price, hhvRef.current).toFixed(2))
  }
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    import(/* @vite-ignore */ `${base}price-feed.js`)
      .then(async (feed) => {
        const snapshot = await feed.loadPrices(base)
        setGasFeed({ feed, snapshot })
        const index = feed.pickDefault(snapshot)
        if (index && !restoredRef.current && !touchedRef.current.gas) applyGasIndex(feed, index)
      })
      .catch(err => console.log('Gas index feed unavailable:', err.message))
  }, [])
  // A changed HHV re-converts the selected index ($/MMBtu → $/MCF); a custom price is left alone
  useEffect(() => {
    if (!gasFeed || gasIndexKey === 'custom') return
    const index = gasFeed.feed.priceIndexes(gasFeed.snapshot).find(i => i.key === gasIndexKey)
    if (index) setWahaPriceStr(gasFeed.feed.mmbtuToMcf(index.price, parseFloat(hhv) || 1000).toFixed(2))
  }, [hhv])
  const gasIndexes = gasFeed ? gasFeed.feed.priceIndexes(gasFeed.snapshot) : []
  const selectedGasIndex = gasIndexes.find(i => i.key === gasIndexKey) || null

  // Hand-off with the cash-flow page. The model's inputs and the derived numbers the
  // cash flow needs are saved in localStorage when the user goes there, so both pages
  // use the same numbers, and the inputs are restored when the user comes back.
  const HANDOFF_KEY = 'gas-to-btc-model'
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null')
      const i = saved?.inputs
      if (!i) return
      restoredRef.current = true
      setContainerCount(i.containerCount); setContainerCostPerUnit(i.containerCostPerUnit)
      setMinersPerContainerOverride(i.minersPerContainerOverride)
      setSelectedMinerPreset(i.selectedMinerPreset); setHashratePerUnit(i.hashratePerUnit); setEfficiency(i.efficiency); setPricePerTh(i.pricePerTh)
      setSelectedGeneratorPreset(i.selectedGeneratorPreset); setGeneratorCount(i.generatorCount); setGeneratorSizeKw(i.generatorSizeKw)
      setGeneratorMode(i.generatorMode); setGeneratorRentMonthly(i.generatorRentMonthly); setGeneratorBuyPrice(i.generatorBuyPrice)
      setGeneratorBuyMaintenance(i.generatorBuyMaintenance); setGeneratorRtoMonthly(i.generatorRtoMonthly); setGeneratorRtoEquityPct(i.generatorRtoEquityPct)
      setGeneratorRtoPostMaint(i.generatorRtoPostMaint); setFinanceRate(i.financeRate); setFinanceTerm(i.financeTerm); setFinanceDownPct(i.financeDownPct)
      setHeatRate(i.heatRate); setHhv(i.hhv); setWahaPriceStr(i.wahaPriceStr); setWahaAdderStr(i.wahaAdderStr); setGasIndexKey(i.gasIndexKey ?? 'custom')
      setGeneratorLoadPct(i.generatorLoadPct); setPoolFee(i.poolFee); setCurtailment(i.curtailment); setOtherOpex(i.otherOpex)
      if (i.staffMonthly !== undefined) setStaffMonthly(i.staffMonthly)
      if (i.minerRepairPerMiner !== undefined) setMinerRepairPerMiner(i.minerRepairPerMiner)
      if (i.setupPerContainer !== undefined) setSetupPerContainer(i.setupPerContainer)
      if (i.generatorLifetimeHours !== undefined) {
        setGeneratorLifetimeHours(i.generatorLifetimeHours); setTopOverhaulHours(i.topOverhaulHours); setTopOverhaulCost(i.topOverhaulCost)
        setMajorOverhaulHours(i.majorOverhaulHours); setMajorOverhaulCost(i.majorOverhaulCost)
      }
      if (i.generatorRtoTerm !== undefined) setGeneratorRtoTerm(i.generatorRtoTerm)
      if (i.containerKw !== undefined) setContainerKw(i.containerKw)
      if (i.hashprice !== undefined) {
        setHashprice(i.hashprice)
        if (i.hashpriceIsManual) { touchedRef.current.hashprice = true; setHashpriceSource('manual') } else setHashpriceSource('saved')
      }
      if (i.gasIsManual) touchedRef.current.gas = true
    } catch (err) {
      console.log('Saved model not restored:', err.message)
    }
  }, [])
  const openCashflow = () => {
    const payload = buildHandoff(siteInputs, gasResults, {
      inputs: {
        containerCount, containerCostPerUnit, minersPerContainerOverride, containerKw, selectedMinerPreset, hashratePerUnit, efficiency, pricePerTh,
        selectedGeneratorPreset, generatorCount, generatorSizeKw, generatorMode, generatorRentMonthly, generatorBuyPrice, generatorBuyMaintenance,
        generatorRtoMonthly, generatorRtoEquityPct, generatorRtoPostMaint, financeRate, financeTerm, financeDownPct,
        heatRate, hhv, wahaPriceStr, wahaAdderStr, gasIndexKey, generatorLoadPct, poolFee, curtailment, otherOpex,
        staffMonthly, minerRepairPerMiner, setupPerContainer,
        generatorLifetimeHours, topOverhaulHours, topOverhaulCost, majorOverhaulHours, majorOverhaulCost, generatorRtoTerm,
        hashprice, hashpriceIsManual: touchedRef.current.hashprice, gasIsManual: touchedRef.current.gas
      },
      gasIndexLabel: selectedGasIndex ? `${selectedGasIndex.label} (${selectedGasIndex.asOf})` : 'custom',
      halvingMonth
    })
    try {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload))
      if (localStorage.getItem(HANDOFF_KEY) === null) throw new Error('storage unavailable')
    } catch (err) {
      setHandoffError(`The model could not be saved in this browser (${err.message}), so the cash flow would open with default numbers. Allow site storage or use another browser.`)
      return
    }
    setHandoffError(null)
    window.location.href = `${import.meta.env.BASE_URL}cashflow.html`
  }

  // Block height → month (this month = 1) of the next halving, handed to the cash-flow page
  const [blockHeight, setBlockHeight] = useState(null)
  useEffect(() => {
    fetch('https://mempool.space/api/blocks/tip/height')
      .then(r => r.text())
      .then(t => { const h = parseInt(t); if (h > 0) setBlockHeight(h) })
      .catch(err => console.log('Block height unavailable:', err.message))
  }, [])
  const halvingMonth = halvingMonthFromHeight(blockHeight) ?? halvingMonthFromDate()
  const halvingNote = (
    <span style={{display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: '4px'}}>
      Next halving ≈ block 1,050,000, April 2028 (about month {halvingMonth} from now): the block subsidy halves; with BTC price, difficulty and fees unchanged, hashprice drops by about half.
      Applied in the 36-month cash flow, not here.
    </span>
  )

  // What the hashprice field holds right now, and the way back to the live estimate
  const hashpriceNote = (() => {
    const small = (text) => <span style={{fontSize: '0.65rem', color: '#64748b', marginLeft: '6px'}}>{text}</span>
    if (hashpriceLoading) return small('Loading the live estimate…')
    const link = <a href="https://data.hashrateindex.com/network-data/bitcoin-hashprice-index" target="_blank" rel="noopener noreferrer" style={{fontSize: '0.7rem', color: '#fff', background: 'linear-gradient(135deg, #138a64, #0f7a57)', padding: '3px 10px', borderRadius: '4px', marginLeft: '8px', textDecoration: 'none', fontWeight: '600'}}>Index ↗</a>
    const live = liveHashpriceRef.current
    const useLive = live !== null && hashpriceSource !== 'live'
      ? <button type="button" className="link-button" style={{fontSize: '0.65rem', marginLeft: '6px'}} onClick={() => { touchedRef.current.hashprice = false; setHashprice(live); setHashpriceSource('live') }}>use live ${live}</button>
      : null
    const text = hashpriceSource === 'live' ? `Live estimate${hashpriceUpdatedAt ? `, updated ${hashpriceUpdatedAt.toLocaleTimeString()}` : ''}: subsidy × BTC price ÷ network hashrate, before fees.`
      : hashpriceSource === 'manual' ? 'Manual value.'
      : hashpriceSource === 'saved' ? 'Saved from your previous visit.'
      : 'Live estimate unavailable; default value.'
    return <>{link}{small(text)}{useLive}</>
  })()

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
  // Everything the page shows derives from src/siteModel.js (tested by hand in test/site-model.test.mjs)
  const siteInputs = {
    generatorLoadPct, generatorCount, generatorSizeKw, minerPowerKW, hashratePerUnit, minersPerContainer, containerCount, containerKw,
    heatRate, hhv, poolFee, curtailment, hashprice, wahaPrice, wahaAdder,
    generatorRtoMonthly, generatorRtoEquityPct, generatorRtoPostMaint, generatorBuyPrice, generatorBuyMaintenance, generatorRentMonthly,
    financeDownPct, financeRate, financeTerm, generatorMode, selectedMinerPreset,
    pricePerTh, containerCostPerUnit, setupPerContainer, minerRepairPerMiner, staffMonthly, otherOpex,
    generatorLifetimeHours, topOverhaulHours, topOverhaulCost, majorOverhaulHours, majorOverhaulCost
  }
  const gasResults = useMemo(() => computeSite(siteInputs), [
    containerCostPerUnit, containerCount, generatorLoadPct, financeDownPct, financeRate, financeTerm,
    generatorBuyMaintenance, generatorBuyPrice, generatorCount,
    generatorLifetimeHours, generatorMode, generatorRentMonthly,
    generatorRtoEquityPct, generatorRtoMonthly, generatorRtoPostMaint,
    generatorSizeKw, hashratePerUnit, hashprice,
    heatRate, hhv, majorOverhaulCost, majorOverhaulHours,
    minerPowerKW, otherOpex, staffMonthly, minerRepairPerMiner, setupPerContainer, poolFee, curtailment, pricePerTh,
    minersPerContainer, selectedMinerPreset, containerKw,
    topOverhaulCost, topOverhaulHours, wahaAdder, wahaPrice,
  ])

  // Simple payback: equipment ÷ monthly operating cash (the cash-flow page does it month by month)
  const paybackMonths = gasResults.paybackMonths
  const pnlInputs = {
    generatorMode, generatorCount, generatorSizeKw, hashprice, poolFee, minerRepairPerMiner,
    otherOpex: parseFloat(otherOpex) || 0, curtailment, containerCount, containerCostPerUnit, setupPerContainer, financeDownPct, hashratePerUnit, pricePerTh
  }

  // ====== MINER PRESET HANDLER ======
  const handleMinerPreset = (e) => {
    const presets = {
      s21pro234: { kw: 3.51, th: 234, pth: 10 },
      s21pro220: { kw: 3.3,  th: 220, pth: 9 },
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
      setSelectedMinerPreset(e.target.value)
    }
  }

  // ====== GENERATOR PRESET HANDLER ======
  const handleGeneratorPreset = (e) => {
    const val = e.target.value
    setSelectedGeneratorPreset(val)
    if (val === 'ngen400') {
      setGeneratorSizeKw(400); setHeatRate(11500)
      setGeneratorBuyPrice(185000); setGeneratorRtoMonthly(13500); setGeneratorRentMonthly(10500)
    } else if (val === 'cat3516') {
      setGeneratorSizeKw(1500); setHeatRate(9800)
      setGeneratorBuyPrice(850000); setGeneratorRtoMonthly(30000); setGeneratorRentMonthly(22000)
    }
  }

  const resetToDefaults = () => {
    const d = MODEL_DEFAULTS
    setContainerCount(d.containerCount); setContainerCostPerUnit(d.containerCostPerUnit); setMinersPerContainerOverride(d.minersPerContainerOverride); setSetupPerContainer(d.setupPerContainer); setContainerKw(d.containerKw)
    setSelectedMinerPreset(d.selectedMinerPreset); setHashratePerUnit(d.hashratePerUnit); setEfficiency(d.efficiency); setPricePerTh(d.pricePerTh)
    setSelectedGeneratorPreset(d.selectedGeneratorPreset); setGeneratorCount(d.generatorCount); setGeneratorSizeKw(d.generatorSizeKw); setGeneratorMode(d.generatorMode)
    setGeneratorBuyPrice(d.generatorBuyPrice); setGeneratorBuyMaintenance(d.generatorBuyMaintenance); setGeneratorRentMonthly(d.generatorRentMonthly)
    setGeneratorRtoMonthly(d.generatorRtoMonthly); setGeneratorRtoTerm(d.generatorRtoTerm); setGeneratorRtoEquityPct(d.generatorRtoEquityPct); setGeneratorRtoPostMaint(d.generatorRtoPostMaint)
    setFinanceRate(d.financeRate); setFinanceTerm(d.financeTerm); setFinanceDownPct(d.financeDownPct)
    setGeneratorLifetimeHours(d.generatorLifetimeHours); setTopOverhaulHours(d.topOverhaulHours); setTopOverhaulCost(d.topOverhaulCost); setMajorOverhaulHours(d.majorOverhaulHours); setMajorOverhaulCost(d.majorOverhaulCost)
    setHeatRate(d.heatRate); setHhv(d.hhv); setWahaAdderStr(d.wahaAdderStr); setGeneratorLoadPct(d.generatorLoadPct)
    setPoolFee(d.poolFee); setCurtailment(d.curtailment); setOtherOpex(d.otherOpex); setStaffMonthly(d.staffMonthly); setMinerRepairPerMiner(d.minerRepairPerMiner)
    touchedRef.current = { hashprice: false, gas: false }
    setHashprice(liveHashpriceRef.current ?? d.hashprice); setHashpriceSource(liveHashpriceRef.current !== null ? 'live' : 'default')
    const index = gasFeed ? gasFeed.feed.pickDefault(gasFeed.snapshot) : null
    if (index) applyGasIndex(gasFeed.feed, index); else { setGasIndexKey('custom'); setWahaPriceStr('0.50') }
    setHandoffError(null)
  }

  return (
    <div className="app">
      <header>
        <h1>Gas to Bitcoin Calculator</h1>
        <p className="subtitle">Gas &rarr; Power &rarr; Bitcoin</p>
        <button onClick={resetToDefaults} style={{marginTop:'12px', padding:'6px 16px', borderRadius:'6px', border:'1px solid #b9c7d6', background:'#fff', color:'#12365d', fontSize:'0.78rem', cursor:'pointer'}}>
          ↺ Reset to defaults
        </button>
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
        <button onClick={openCashflow}>
          36-Month Cash Flow &rarr;
        </button>
      </section>
      {handoffError && <p className="section-intro" style={{color: '#b91c1c', textAlign: 'center'}}>{handoffError}</p>}

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
                  <select className="preset-select" value={selectedGeneratorPreset} onChange={handleGeneratorPreset}>
                    <option value="ngen400">NGEN-400 / TGR400 (400kW, 11,500 BTU/kWh)</option>
                    <option value="cat3516">CAT G3516 (1.5MW, 9,800 BTU/kWh)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Generator Count</label>
                    <input type="number" value={generatorCount} onChange={e => { const v = parseInt(e.target.value); setGeneratorCount(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setGeneratorCount(1); }} />
                    {(() => {
                      const _miners = parseInt(minersPerContainerOverride) || 324
                      const _eff = parseFloat(efficiency) || 15
                      const _th = parseFloat(hashratePerUnit) || 234
                      const _kw = (_eff * _th) / 1000
                      const _genKw = parseFloat(generatorSizeKw) || 400
                      const _load = parseFloat(generatorLoadPct) || 0.85
                      const _containers = parseInt(containerCount) || 4
                      const _genCount = parseInt(generatorCount) || 16
                      const neededKwPerContainer = _miners * _kw
                      const gensPerContainer = Math.ceil(neededKwPerContainer / (_genKw * _load))
                      const suggestedCount = Math.max(gensPerContainer, 1) * _containers
                      return suggestedCount !== _genCount
                        ? <span style={{fontSize:'0.7rem', color:'#b45309', marginTop:'4px', display:'block'}}>Suggested: {suggestedCount} ({Math.max(gensPerContainer,1)}/container)</span>
                        : null
                    })()}
                  </div>
                  <div>
                    <label>Size per Generator (kW)</label>
                    <input type="number" value={generatorSizeKw} onChange={e => setGeneratorSizeKw(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorSizeKw(0); }} />
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
                    <input type="number" value={generatorRentMonthly} onChange={e => setGeneratorRentMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorRentMonthly(0); }} />
                  </div>
                )}

                {generatorMode === 'buy' && (
                  <>
                    <div className="input-row two-col">
                      <div>
                        <label>Purchase Price ($/unit)</label>
                        <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyPrice(0); }} />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyMaintenance(0); }} />
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
                      <input type="number" value={generatorRtoMonthly} onChange={e => setGeneratorRtoMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorRtoMonthly(0); }} />
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Equity Portion (%)</label>
                        <input type="number" value={(generatorRtoEquityPct * 100).toFixed(0)} onChange={e => setGeneratorRtoEquityPct(+e.target.value / 100)} />
                      </div>
                      <div>
                        <label>Post-Ownership Maint ($/unit/mo)</label>
                        <input type="number" value={generatorRtoPostMaint} onChange={e => setGeneratorRtoPostMaint(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorRtoPostMaint(0); }} />
                      </div>
                    </div>
                    <div className="result-row compact">
                      <span>Months to Ownership</span>
                      <span className="highlight">{gasResults.rtoOwns ? `${gasResults.rtoMonthsToOwn} months` : 'never (no equity share)'}</span>
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
                        <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyPrice(0); }} />
                      </div>
                      <div>
                        <label>Maintenance ($/unit/mo)</label>
                        <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyMaintenance(0); }} />
                      </div>
                    </div>
                    <div className="input-row two-col">
                      <div>
                        <label>Interest Rate (%)</label>
                        <input type="number" step="0.1" value={financeRate} onChange={e => setFinanceRate(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setFinanceRate(0); }} />
                      </div>
                      <div>
                        <label>Term (months)</label>
                        <input type="number" value={financeTerm} onChange={e => setFinanceTerm(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setFinanceTerm(0); }} />
                      </div>
                    </div>
                    <div className="input-row">
                      <label>Down Payment (%)</label>
                      <input type="number" value={financeDownPct} onChange={e => { setFinanceDownPct(e.target.value === "" ? 0 : (parseFloat(e.target.value) ?? 0)); }} />
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
                      <span style={{color: '#b91c1c'}}>{formatCurrencyFull(gasResults.financeTotalInterest)}</span>
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
                    <input type="number" value={heatRate} onChange={e => setHeatRate(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHeatRate(0); }} />
                  </div>
                  <div>
                    <label>HHV (BTU/scf)</label>
                    <input type="number" value={hhv} onChange={e => setHhv(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHhv(0); }} />
                  </div>
                </div>

                <div className="input-row">
                  <label>Gas Index</label>
                  <select className="preset-select" value={gasIndexKey} onChange={e => {
                    const index = gasIndexes.find(i => i.key === e.target.value)
                    if (index) applyGasIndex(gasFeed.feed, index); else setGasIndexKey('custom')
                  }}>
                    {gasIndexes.map(i => <option key={i.key} value={i.key}>{i.label} — ${i.price.toFixed(2)}/MMBtu ({i.asOf})</option>)}
                    <option value="custom">Custom</option>
                  </select>
                  {gasFeed && gasIndexes.length === 0 && <span style={{fontSize:'0.7rem', color:'#b45309'}}>No live index in this build — enter a price.</span>}
                </div>

                <div className="input-row two-col">
                  <div>
                    <label>Gas Price ($/MCF) {selectedGasIndex
                      ? <><a href={selectedGasIndex.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:"0.7rem",color:"#fff",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",padding:"2px 8px",borderRadius:"4px",marginLeft:"4px",textDecoration:"none",fontWeight:"600"}}>source ↗</a> <span style={{fontSize:'0.65rem',color:'#64748b',marginLeft:'4px'}}>as of {selectedGasIndex.asOf}, converted at {hhv} BTU/scf</span></>
                      : <span style={{fontSize:'0.65rem',color:'#64748b',marginLeft:'4px'}}>custom</span>}</label>
                    <input type="number" step="0.01" value={wahaPriceStr} onChange={e => { touchedRef.current.gas = true; setWahaPriceStr(e.target.value); setGasIndexKey('custom') }} />
                  </div>
                  <div>
                    <label>Adder ($/MCF)</label>
                    <input type="number" step="0.01" value={wahaAdderStr} onChange={e => setWahaAdderStr(e.target.value)} />
                  </div>
                </div>
                

                <div className="result-row compact">
                  <span>Gas Price (all-in)</span>
                  <span className="highlight">${gasResults.gasPrice.toFixed(2)}/MCF</span>
                </div>

                <div className="input-row" style={{marginTop: '12px'}}>
                  <label>Generator Load: <strong>{Math.round(generatorLoadPct * 100)}%</strong> <span style={{fontSize:'0.7rem', color:'#138a64'}}></span></label>
                  <input type="range" min="0.5" max="1" step="0.01" value={generatorLoadPct} onChange={e => setGeneratorLoadPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorLoadPct(0); }} />
                  <span style={{fontSize:'0.7rem', color:'#64748b'}}>Running below 100% extends generator life and reduces fuel burn</span>
                </div>

                <div className="result-row compact" style={{marginTop: '12px', borderTop: '1px solid rgba(100,116,139,0.25)', paddingTop: '8px'}}>
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

            {/* Lifecycle: overhauls the owner pays (buy, finance, rent-to-own) */}
            {generatorMode !== 'rent' && (
              <div className="card">
                <div className="card-header">
                  <h3>Generator Lifecycle</h3>
                </div>
                <div className="card-body">
                  <div className="input-row two-col">
                    <div>
                      <label>Lifetime (hours)</label>
                      <input type="number" value={generatorLifetimeHours} onChange={e => setGeneratorLifetimeHours(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorLifetimeHours(0); }} />
                    </div>
                    <div>
                      <label>Hours/Year</label>
                      <div className="computed-value">{gasResults.hoursPerYear.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                    </div>
                  </div>
                  <div className="input-row two-col">
                    <div>
                      <label>Top Overhaul @ (hours)</label>
                      <input type="number" value={topOverhaulHours} onChange={e => setTopOverhaulHours(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setTopOverhaulHours(0); }} />
                    </div>
                    <div>
                      <label>Cost ($)</label>
                      <input type="number" value={topOverhaulCost} onChange={e => setTopOverhaulCost(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setTopOverhaulCost(0); }} />
                    </div>
                  </div>
                  <div className="input-row two-col">
                    <div>
                      <label>Major Overhaul @ (hours)</label>
                      <input type="number" value={majorOverhaulHours} onChange={e => setMajorOverhaulHours(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setMajorOverhaulHours(0); }} />
                    </div>
                    <div>
                      <label>Cost ($)</label>
                      <input type="number" value={majorOverhaulCost} onChange={e => setMajorOverhaulCost(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setMajorOverhaulCost(0); }} />
                    </div>
                  </div>
                  <div className="result-row compact" style={{marginTop: '8px', borderTop: '1px solid rgba(100,116,139,0.25)', paddingTop: '8px'}}>
                    <span>Lifetime</span>
                    <span>{gasResults.lifetimeYears.toFixed(1)} years{gasResults.generatorLifeMonths < 36 ? <span style={{color:'#b91c1c', fontSize:'0.75rem', marginLeft:'6px'}}>ends before month 36; replacement is not modelled</span> : null}</span>
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
                <span className="stat-label">Cash power ¢/kWh</span>
                <span className="stat-value">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Gas Cost</span>
                <span className="stat-value red">{formatCurrency(gasResults.gasMonthly)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Generator Cost (incl. reserve)</span>
                <span className="stat-value red">{formatCurrency(gasResults.generatorMonthly + gasResults.overhaulReserveMonthly)}</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Total Monthly Power Cost</span>
                <span className="stat-value">{formatCurrency(gasResults.powerMonthly)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Annual Power Cost</span>
                <span className="stat-value">{formatCurrency(gasResults.powerMonthly * 12)}</span>
              </div>
            </div>

            <div className="simple-table" style={{marginTop: '20px'}}>
              <div className="table-row">
                <span>Miner Load</span>
                <span>{(gasResults.loadKw / 1000).toFixed(2)} MW × 730h = {(gasResults.loadKw * 730 / 1000).toFixed(0).toLocaleString()} MWh/month ({gasResults.mwGross > 0 ? Math.round(gasResults.loadKw / 10 / gasResults.mwGross) : 0}% of nameplate)</span>
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
              {gasResults.overhaulReserveMonthly > 0 && (
                <div className="table-row">
                  <span>Overhaul Reserve (owned generators)</span>
                  <span>{formatCurrencyFull(gasResults.totalOverhaulCost)} over {gasResults.lifetimeYears.toFixed(1)} years = {formatCurrencyFull(gasResults.overhaulReserveMonthly)}/mo</span>
                </div>
              )}
              <div className="table-row total">
                <span>Cash Power Cost <span style={{fontSize:'0.75rem', color:'#64748b', fontWeight: 400}}>(gas + generator payments + reserve; upfront purchases excluded)</span></span>
                <span className="highlight">{formatCurrencyFull(gasResults.powerMonthly)} ÷ {Math.round(gasResults.loadKw * 730).toLocaleString()} kWh = <strong>{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢/kWh</strong></span>
              </div>
            </div>



            {/* Generator Acquisition Comparison */}
            <h3 style={{marginTop: '32px', marginBottom: '8px'}}>Generator Acquisition Comparison</h3>
            <p className="section-intro">Four ways to pay for the same {generatorCount} generators, compared over the loan term on one basis: payments, maintenance and the overhaul reserve, and what the units are worth at the end if you own them.</p>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Rent</th>
                    <th>Finance ({financeRate}%)</th>
                    <th>RTO</th>
                    <th>Buy Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const c = gasResults.comparison
                    const modes = ['rent', 'finance', 'rto', 'buy']
                    const money = (v) => Number.isFinite(v) ? formatCurrencyFull(v) : '—'
                    const own = (m) => m.ownAfterMonths === null ? 'Never' : m.ownAfterMonths === 0 ? 'Day 1' : `${m.ownAfterMonths} months`
                    const note = (text) => <span style={{fontSize:'0.7rem', color:'#64748b'}}>{text}</span>
                    return (
                      <>
                        <tr><td className="row-label">Cash upfront</td>{modes.map(k => <td key={k}>{money(c[k].upfront)}</td>)}</tr>
                        <tr><td className="row-label">Per month {note('(payment + maintenance + overhaul reserve)')}</td>{modes.map(k => <td key={k}>{money(c[k].monthly)}</td>)}</tr>
                        <tr><td className="row-label">You own the generators after</td>{modes.map(k => <td key={k}>{own(c[k])}</td>)}</tr>
                        <tr><td className="row-label">Total paid over {c.horizonMonths} months {note('(upfront + payments + maintenance + reserve)')}</td>{modes.map(k => <td key={k}>{money(c[k].totalPaid)}</td>)}</tr>
                        <tr><td className="row-label">Interest or rent-to-own premium</td>{modes.map(k => <td key={k} style={{color: c[k].interest > 0 ? '#b91c1c' : '#138a64'}}>{money(c[k].interest)}</td>)}</tr>
                        <tr><td className="row-label">Generator value after {c.horizonMonths} months {note(`(straight line over a ${gasResults.lifetimeYears.toFixed(1)}-year life)`)}</td>{modes.map(k => <td key={k} style={{color: c[k].residual > 0 ? '#138a64' : '#64748b'}}>{money(c[k].residual)}</td>)}</tr>
                        <tr><td className="row-label"><strong>Net cost over {c.horizonMonths} months</strong> {note('(total paid − value kept)')}</td>{modes.map(k => <td key={k} style={{fontWeight: 700}}>{money(c[k].totalPaid - c[k].residual)}</td>)}</tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>


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
                  <select className="preset-select" value={selectedMinerPreset} onChange={handleMinerPreset}>
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
                    <input type="number" value={hashratePerUnit} onChange={e => setHashratePerUnit(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHashratePerUnit(0); }} />
                  </div>
                  <div>
                    <label>Efficiency (J/TH)</label>
                    <input type="number" step="0.1" value={efficiency} onChange={e => setEfficiency(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setEfficiency(0); }} />
                  </div>
                </div>
                <div className="input-row">
                  <label>ASIC Price ($/TH)</label>
                  <input type="number" value={pricePerTh} onChange={e => setPricePerTh(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setPricePerTh(0); }} />
                </div>
                <div className="result-row compact">
                  <span>Per Unit</span>
                  <span>{minerPowerKW.toFixed(2)} kW &nbsp;·&nbsp; <strong>{formatCurrencyFull(gasResults.asicPricePerUnit)}</strong>/unit</span>
                </div>
              </div>
            </div>

            {/* Containers & Deployment */}
            <div className="card">
              <div className="card-header">
                <h3>Containers & Deployment</h3>
              </div>
              <div className="card-body">
                <div className="input-row two-col">
                  <div>
                    <label>Containers (53ft)</label>
                    <input type="number" value={containerCount} onChange={e => { const v = parseInt(e.target.value); setContainerCount(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setContainerCount(1); }} />
                  </div>
                  <div>
                    <label>Miners per Container</label>
                    <input type="number" value={minersPerContainerOverride} onChange={e => { const v = parseInt(e.target.value); setMinersPerContainerOverride(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setMinersPerContainerOverride(1); }} />
                  </div>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Container & Electrical ($/container)</label>
                    <input type="number" value={containerCostPerUnit} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setContainerCostPerUnit(v); }} />
                  </div>
                  <div>
                    <label>Setup & Commissioning ($/container)</label>
                    <input type="number" value={setupPerContainer} onChange={e => setSetupPerContainer(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setSetupPerContainer(0); }} />
                  </div>
                </div>
                <div className="input-row">
                  <label>Electrical Capacity (kW per container)</label>
                  <input type="number" step="10" value={containerKw} onChange={e => setContainerKw(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) setContainerKw(1400); }} />
                  <span style={{fontSize:'0.7rem', color:'#64748b'}}>Miners are limited by generator power, container slots or this capacity, whichever is smallest: now {gasResults.limitedBy}.</span>
                </div>

                <div className="result-row compact" style={{marginTop:'8px', borderTop:'1px solid rgba(100,116,139,0.25)', paddingTop:'8px'}}>
                  <span>Net Available Power</span>
                  <span className="highlight">{gasResults.availableMw.toFixed(2)} MW @ {Math.round(generatorLoadPct*100)}% load</span>
                </div>
                <div className="result-row compact total">
                  <span>Miners <span style={{fontSize:'0.75rem', color:'#64748b', fontWeight: 400}}>(limited by {gasResults.limitedBy})</span></span>
                  <span className="highlight">{gasResults.miners.toLocaleString()} units</span>
                </div>
                <div className="result-row compact">
                  <span>Total Hashrate</span>
                  <span className="highlight">{gasResults.phs.toFixed(2)} PH/s</span>
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
                  <label>Hashprice ($/PH/day) {hashpriceNote}</label>
                  <input type="number" value={hashprice} onChange={e => { touchedRef.current.hashprice = true; setHashpriceSource('manual'); setHashprice(e.target.value) }} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHashprice(0); }} />
                  {halvingNote}
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
                <div className="input-row two-col">
                  <div>
                    <label>Staff & Overhead ($/month)</label>
                    <input type="number" value={staffMonthly} onChange={e => setStaffMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setStaffMonthly(0); }} />
                  </div>
                  <div>
                    <label>Miner Repairs ($/miner/month)</label>
                    <input type="number" step="0.5" value={minerRepairPerMiner} onChange={e => setMinerRepairPerMiner(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setMinerRepairPerMiner(0); }} />
                  </div>
                </div>
                <div className="input-row">
                  <label>Other Opex ($/month)</label>
                  <input type="number" value={otherOpex} onChange={e => { setOtherOpex(e.target.value === "" ? 0 : (parseFloat(e.target.value) ?? 0)); }} />
                </div>

                <div className="result-row compact" style={{borderTop: '1px solid rgba(100,116,139,0.25)', marginTop: '12px', paddingTop: '8px'}}>
                  <span>Monthly Revenue (after pool fee)</span>
                  <span className="green">{formatCurrencyFull(gasResults.monthlyRevenue)}</span>
                </div>
                <div className="result-row compact">
                  <span>Monthly Running Costs</span>
                  <span className="red">{formatCurrencyFull(gasResults.totalOpex)}</span>
                </div>
                <div className="result-row compact total">
                  <span>Operating Cash per Month</span>
                  <span style={{color: gasResults.netMonthly >= 0 ? '#138a64' : '#b91c1c', fontWeight: '700'}}>
                    {formatCurrencyFull(gasResults.netMonthly)}
                  </span>
                </div>
                <div className="result-row compact">
                  <span>Breakeven Hashprice</span>
                  <span>{gasResults.breakevenHashprice === null ? 'n/a' : `$${gasResults.breakevenHashprice.toFixed(1)}/PH/d`}</span>
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
                <span className="stat-label">Cash power ¢/kWh</span>
                <span className="stat-value">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Monthly Revenue</span>
                <span className="stat-value green">{formatCurrency(gasResults.monthlyRevenue)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Running Costs</span>
                <span className="stat-value red">{formatCurrency(gasResults.totalOpex)}</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Operating Cash</span>
                <span className="stat-value" style={{color: gasResults.netMonthly >= 0 ? '#138a64' : '#b91c1c'}}>
                  {formatCurrency(gasResults.netMonthly)}
                </span>
              </div>
            </div>
          </section>

          <section className="comparison-section">
            <h2>Monthly P&amp;L at full build</h2>
            <PnLTable r={gasResults} inputs={pnlInputs} months={1} />
            <p className="section-intro" style={{marginTop: '12px', marginBottom: 0}}>
              Per year at this rate: <strong>{usd(gasResults.netMonthly * 12)}</strong>.
              Month by month, with the deployment ramp and the equipment: <button type="button" className="link-button" onClick={openCashflow}>36-Month Cash Flow →</button>
            </p>
          </section>

          <section className="comparison-section">
            <h2>Equipment</h2>
            <EquipmentTable r={gasResults} inputs={pnlInputs} paybackMonths={paybackMonths} />
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
                  <label>Containers (53ft)</label>
                  <input type="number" value={containerCount} onChange={e => { const v = parseInt(e.target.value); setContainerCount(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setContainerCount(1); }} />
                </div>
                <div className="input-row" style={{marginTop: '-4px'}}>
                  <label>Miners per Container</label>
                  <input type="number" value={minersPerContainerOverride} onChange={e => { const v = parseInt(e.target.value); setMinersPerContainerOverride(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setMinersPerContainerOverride(1); }} />
                  <span style={{fontSize:'0.7rem', color:'#64748b'}}>Max {maxMinersPerContainer} ({pdusPerContainer} PDUs × {outletsPerPdu} outlets){minersPerContainerOverride > maxMinersPerContainer ? ' ⚠️ exceeds PDU cap' : ''}</span>
                </div>
                <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '-8px', marginBottom: '12px', paddingLeft: '4px'}}>
                  {containerCount} × {containerKw} kW = <strong>{facilityMW} MW</strong> of container capacity
                </div>
                <div className="input-row">
                  <label>Miner Model</label>
                  <select className="preset-select" value={selectedMinerPreset} onChange={handleMinerPreset}>
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
                    <input type="number" value={hashratePerUnit} onChange={e => setHashratePerUnit(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHashratePerUnit(0); }} />
                  </div>
                  <div>
                    <label>J/TH</label>
                    <input type="number" step="0.1" value={efficiency} onChange={e => setEfficiency(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setEfficiency(0); }} />
                  </div>
                </div>
                <div className="input-row">
                  <label>ASIC Price ($/TH)</label>
                  <input type="number" value={pricePerTh} onChange={e => setPricePerTh(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setPricePerTh(0); }} />
                </div>
                <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '4px', paddingLeft: '4px'}}>
                  {minersPerContainer} miners/container × {containerCount} = <strong>{(containerCount * minersPerContainer).toLocaleString()}</strong> miners ({pdusPerContainer} PDUs × {outletsPerPdu} outlets cap) |
                  Powered: <strong>{gasResults.miners.toLocaleString()}</strong> miners = {gasResults.phs.toFixed(1)} PH/s
                </div>
              </div>

              {/* Column 2: Power Generation */}
              <div className="control-group">
                <h3>Power Generation</h3>
                <div className="input-row">
                  <label>Generator Model</label>
                  <select className="preset-select" value={selectedGeneratorPreset} onChange={handleGeneratorPreset}>
                    <option value="ngen400">TGR400 (400kW)</option>
                    <option value="cat3516">CAT G3516 (1.5MW)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Count</label>
                    <input type="number" value={generatorCount} onChange={e => { const v = parseInt(e.target.value); setGeneratorCount(isNaN(v) ? "" : v); }} onBlur={e => { if (!e.target.value || e.target.value < 1) setGeneratorCount(1); }} />
                  </div>
                  <div>
                    <label>kW each</label>
                    <input type="number" value={generatorSizeKw} onChange={e => setGeneratorSizeKw(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorSizeKw(0); }} />
                  </div>
                </div>
                <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '-8px', marginBottom: '4px', paddingLeft: '4px'}}>
                  Fleet: <strong>{gasResults.fleetCapacityMw.toFixed(2)} MW</strong> × {Math.round(generatorLoadPct * 100)}% load = <strong>{gasResults.availableMw.toFixed(2)} MW</strong> to miners
                </div>
                <div className="input-row" style={{marginBottom: '12px'}}>
                  <label>Generator Load: <strong>{Math.round(generatorLoadPct * 100)}%</strong> <span style={{fontSize:'0.7rem', color:'#138a64'}}></span></label>
                  <input type="range" min="0.5" max="1" step="0.01" value={generatorLoadPct} onChange={e => setGeneratorLoadPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorLoadPct(0); }} />
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
                    <input type="number" value={generatorRentMonthly} onChange={e => setGeneratorRentMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorRentMonthly(0); }} />
                  </div>
                )}
                {generatorMode === 'buy' && (
                  <div className="input-row two-col">
                    <div>
                      <label>Buy Price ($/unit)</label>
                      <input type="number" value={generatorBuyPrice} onChange={e => setGeneratorBuyPrice(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyPrice(0); }} />
                    </div>
                    <div>
                      <label>Maint ($/unit/mo)</label>
                      <input type="number" value={generatorBuyMaintenance} onChange={e => setGeneratorBuyMaintenance(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorBuyMaintenance(0); }} />
                    </div>
                  </div>
                )}
                {generatorMode === 'rto' && (
                  <div className="input-row">
                    <label>RTO ($/generator/month)</label>
                    <input type="number" value={generatorRtoMonthly} onChange={e => setGeneratorRtoMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setGeneratorRtoMonthly(0); }} />
                  </div>
                )}
                {generatorMode === 'finance' && (
                  <div className="input-row two-col">
                    <div>
                      <label>Rate (%)</label>
                      <input type="number" step="0.1" value={financeRate} onChange={e => setFinanceRate(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setFinanceRate(0); }} />
                    </div>
                    <div>
                      <label>Term (mo)</label>
                      <input type="number" value={financeTerm} onChange={e => setFinanceTerm(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setFinanceTerm(0); }} />
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
                
              </div>

              {/* Column 3: Market & CAPEX */}
              <div className="control-group">
                <h3>Market & CAPEX</h3>
                <div className="input-row">
                  <label>Hashprice: $/PH/day {hashpriceNote}</label>
                  <input type="number" step="0.5" value={hashprice} onChange={e => { touchedRef.current.hashprice = true; setHashpriceSource('manual'); setHashprice(e.target.value) }} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setHashprice(0); }} />
                  {halvingNote}
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Pool Fee (%)</label>
                    <input type="number" step="0.1" value={(poolFee * 100).toFixed(1)} onChange={e => setPoolFee(+e.target.value / 100)} />
                  </div>
                  <div>
                    <label>Other Opex ($/mo)</label>
                    <input type="number" value={otherOpex} onChange={e => { setOtherOpex(e.target.value === "" ? 0 : (parseFloat(e.target.value) ?? 0)); }} />
                  </div>
                </div>
                <div className="input-row two-col">
                  <div>
                    <label>Staff & Overhead ($/mo)</label>
                    <input type="number" value={staffMonthly} onChange={e => setStaffMonthly(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setStaffMonthly(0); }} />
                  </div>
                  <div>
                    <label>Miner Repairs ($/miner/mo)</label>
                    <input type="number" step="0.5" value={minerRepairPerMiner} onChange={e => setMinerRepairPerMiner(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setMinerRepairPerMiner(0); }} />
                  </div>
                </div>

                <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(100,116,139,0.25)'}}>
                  <div className="input-row two-col">
                    <div>
                      <label>Container & Electrical ($/container)</label>
                      <input type="number" value={containerCostPerUnit} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setContainerCostPerUnit(v); }} />
                    </div>
                    <div>
                      <label>Setup ($/container)</label>
                      <input type="number" value={setupPerContainer} onChange={e => setSetupPerContainer(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v)) setSetupPerContainer(0); }} />
                    </div>
                  </div>
                  <div className="result-row compact">
                    <span>Generators upfront</span>
                    <span>{formatCurrencyFull(gasResults.generatorCapex)}</span>
                  </div>
                  <div className="result-row compact">
                    <span>Miners</span>
                    <span>{formatCurrencyFull(gasResults.asicCapex)}</span>
                  </div>
                  <div className="result-row compact total">
                    <span>Cash upfront</span>
                    <span className="highlight">{formatCurrencyFull(gasResults.cashUpfront)}</span>
                  </div>
                  <div className="result-row compact">
                    <span>Equipment cost (before financing)</span>
                    <span>{formatCurrencyFull(gasResults.equipmentCost)}</span>
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
                <span className="stat-label">Cash power ¢/kWh</span>
                <span className="stat-value">{(gasResults.powerCostPerKwh * 100).toFixed(2)}¢</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Gross Revenue</span>
                <span className="stat-value green">{formatCurrency(gasResults.monthlyRevenue)}/mo</span>
              </div>
              <div className="stat-card highlight-card">
                <span className="stat-label">Net Operating</span>
                <span className="stat-value" style={{color: gasResults.netMonthly >= 0 ? '#138a64' : '#b91c1c'}}>
                  {formatCurrency(gasResults.netMonthly)}/mo
                </span>
              </div>
            </div>
          </section>

          <section className="comparison-section">
            <h2>Monthly P&amp;L at full build</h2>
            <PnLTable r={gasResults} inputs={pnlInputs} months={1} />
          </section>

          <section className="comparison-section">
            <h2>Equipment</h2>
            <EquipmentTable r={gasResults} inputs={pnlInputs} paybackMonths={paybackMonths} />
            <p className="section-intro" style={{marginTop: '12px', marginBottom: 0}}>
              Month by month, with the deployment ramp: <button type="button" className="link-button" onClick={openCashflow}>36-Month Cash Flow →</button>
            </p>
          </section>

          <section className="comparison-section">
            <h2>Per year at this rate</h2>
            <PnLTable r={gasResults} inputs={pnlInputs} months={12} />
          </section>

          {/* Sensitivity Analysis */}
          <section className="comparison-section">
            <h2>Sensitivity — Operating Cash per Month</h2>
            <p className="section-intro">Gas price (rows) vs hashprice (columns), all other running costs as set. Negative gas = you get paid for gas — adds to cash.</p>
            <div className="sensitivity-table">
              <table>
                <thead>
                  <tr>
                    <th>Gas $/MCF \ Hashprice</th>
                    <th>$25/PH</th>
                    <th>$30/PH</th>
                    <th>$37/PH</th>
                    <th>$45/PH</th>
                    <th>$55/PH</th>
                  </tr>
                </thead>
                <tbody>
                  {[-6.00, -4.00, -2.00, 0, 0.50, 1.00, 2.00].map(gp => (
                    <tr key={gp}>
                      <td className="row-label" style={{color: gp < 0 ? '#138a64' : gp === 0 ? '#172033' : '#64748b'}}>
                        {gp < 0 ? `${gp.toFixed(2)} 💰` : `$${gp.toFixed(2)}`}/MCF
                      </td>
                      {[25, 30, 37, 45, 55].map(hp => {
                        const scenarioGasMonthly = gasResults.mcfPerDay * gp * (730 / 24)
                        const scenarioRevenue = gasResults.effectivePhs * hp * (730 / 24)
                        const scenarioNet = scenarioRevenue - scenarioGasMonthly - (gasResults.totalOpex - gasResults.gasMonthly)
                        const isCurrentScenario = Math.abs(gp - gasResults.gasPrice) < 0.26 && Math.abs(hp - hashprice) < 0.5
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
      </footer>
    </div>
  )
}

export default App
