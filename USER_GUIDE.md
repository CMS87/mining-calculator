# Ozona Gas-to-Bitcoin Calculator — User Guide

**Bedrock Development | Stranded Gas → Power → Bitcoin**

---

## What This Tool Does

This calculator models the economics of converting stranded natural gas at the Ozona site into Bitcoin mining revenue. Enter your site specs, pick your hardware, and instantly see profitability, payback period, and sensitivity to market conditions.

---

## The Three Tabs

### 1. Gas → Power
Models your power generation setup — generators, gas consumption, and effective cost per kWh.

### 2. Power → BTC
Models the mining side — hardware selection, hashrate, revenue, and CAPEX.

### 3. Full Model *(default)*
Everything combined in one view. Start here.

---

## Key Inputs — Full Model

### Site & Mining

| Field | What to enter | Default |
|---|---|---|
| **Containers** | Number of 53ft data containers | 4 (5.6 MW) |
| **Miner Model** | Pick from preset list or choose Custom | S21 Pro 234T |
| **TH/s per unit** | Hashrate of each miner | 234 |
| **J/TH** | Power efficiency of each miner | 15.0 |
| **ASIC Price $/TH** | Current market price per terahash | $12 |

### Power Generation

| Field | What to enter | Default |
|---|---|---|
| **Generator Model** | TGR400 (400kW) or CAT G3516 (1.6MW) | TGR400 |
| **Count** | Number of generators on site | 12 |
| **kW each** | Output per generator | 400 kW |
| **Mode** | Rent / Buy / RTO / Finance | RTO |
| **RTO $/mo** | Monthly RTO payment per generator | $12,500 |

> **Gas cost is ~$0** — stranded gas at Ozona has near-zero cost, which is the core advantage of this site.

### Market & CAPEX

| Field | What to enter | Default |
|---|---|---|
| **Hashprice** | $/PH/day — auto-fetched live from market | Live |
| **Pool Fee** | Mining pool fee (%) | 0% |
| **Container CAPEX** | Total cost for all containers | $600k (4 × $150k) |

---

## Miner Presets

| Model | TH/s | kW | J/TH | Notes |
|---|---|---|---|---|
| S21 Pro 234T | 234 | 3.51 | 15.0 | Latest flagship — recommended |
| S21 Pro 220T | 220 | 3.30 | 15.0 | Prior variant / used units |
| S21 XP | 270 | 3.645 | 13.5 | Air cooled flagship |
| S21 | 200 | 3.50 | 17.5 | Air cooled, entry tier |
| T21 | 190 | 3.61 | 19.0 | Budget option |
| S19 XP | 141 | 3.01 | 21.4 | Older gen, still efficient |
| S19 Pro | 110 | 3.25 | 29.5 | Repair shop units |
| M63S Hyd | 390 | 7.20 | 18.5 | Hydro, very high density |
| M66S Hyd | 298 | 5.50 | 18.5 | Hydro cooling required |
| M60S | 186 | 3.42 | 18.4 | Air cooled MicroBT |
| M60 | 172 | 3.22 | 18.7 | Air cooled MicroBT |
| M50S++ | 146 | 3.13 | 21.4 | Older MicroBT |
| M50S+ | 138 | 3.10 | 22.5 | Older MicroBT |

---

## Generator Presets

| Model | kW | Heat Rate | Buy Price | RTO/mo | Notes |
|---|---|---|---|---|---|
| TGR400 / NGEN-400 | 400 | 11,500 BTU/kWh | $171,205 | $12,500 | Taylor Power — current plan |
| CAT G3516 | 1,600 | 9,800 BTU/kWh | $450,000 | $25,000 | Large unit, better efficiency |

**Generator Acquisition Modes:**
- **Rent** — monthly payment, never own. Lowest upfront, highest long-term cost.
- **Buy** — purchase outright. Own day 1, pay maintenance only.
- **RTO** (Rent-to-Own) — monthly payments, 50% builds equity. Own after ~28 months. *Current plan.*
- **Finance** — loan with down payment and interest. Own after term ends.

---

## Key Output Metrics

| Metric | What it means |
|---|---|
| **Net Power** | Power available to miners after losses (MW) |
| **Miners** | Number of ASICs that can run on available power |
| **Hashrate** | Total mining power in PH/s |
| **Effective $/kWh** | All-in power cost including generator payments |
| **Gross Revenue** | Monthly BTC mining revenue before costs |
| **Net Operating** | Monthly profit after all operating costs |
| **Total CAPEX** | Upfront investment (containers + generators + miners) |
| **Payback Period** | Months to recover CAPEX at current profit rate |

---

## Sensitivity Table

The bottom section shows how **net monthly profit** changes across different gas prices and hashprice scenarios. Your current inputs are highlighted.

- **Rows** = gas price ($/MCF) — Ozona is $0 stranded
- **Columns** = hashprice ($/PH/day) — tied to BTC price and network difficulty
- **Red cells** = losing money | **White cells** = profitable

---

## What to Update When Ed's Numbers Arrive

Once Ed sends transformer + cable pricing:

1. **Gas Available** (Gas→Power tab) — enter MCF/day confirmed from site
2. **Generator Count** — confirm final fleet size
3. **Generator Mode** — confirm RTO vs rent vs buy decision
4. **Container CAPEX** — update if transformer/cable adds to infrastructure cost

---

## Sharing the Calculator

Once deployed to GitHub Pages, send Ed the link. He can:
- Adjust hashprice to see best/worst case
- Switch miner models to compare hardware options
- Toggle generator acquisition mode (RTO vs Finance)
- See the sensitivity table to understand breakeven conditions

---

*Built by Astro Miner Solutions for Bedrock Development. Projections based on current market assumptions — actual results will vary.*
