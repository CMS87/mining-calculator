# Gas‑to‑Power BTC Calculator — Implementation Plan

This plan describes the new gas‑to‑power calculator to add to the mining calculator app.

## Goals
- Add a **Gas‑to‑Power** tab alongside the existing Business Models / Deal Structure.
- Support **two input modes**:
  - Gas flow input (MCF/day) → compute MW and mining output
  - Power capacity input (MW) → compute gas use and mining output
- Use **official heat rate** to convert fuel → kWh.
- Gas price uses **Waha index + $0.30/MCF**.
- Add generator economics: **Rent / Buy / Rent‑to‑Own (RTO)** (user‑editable).
- Reuse existing mining defaults (hashprice, kW/unit, TH/s) but allow user edits.

## Inputs (Defaults + Editable)
### Gas + Power
- Heat rate (BTU/kWh) — **default 9,000** (official), user editable
- HHV (BTU/scf) — **default 1,000**, user editable
- Gas price = **Waha index + $0.30/MCF** (live feed + manual override)
- Availability / uptime (%), load factor (%), parasitic load (% if needed)

### Generator Fleet
- Generator count (default 12, user editable)
- Generator size (kW per unit, default 400, user editable)
- Mode: Rent / Buy / RTO
- Rent: monthly $/gen
- Buy: purchase $/gen
- RTO: monthly $/gen, term (months), equity % or buyout price
- Maintenance (if not included), fuel handling adders if any

### Mining
- Hashprice ($/PH/day)
- Miner power (kW/unit)
- Miner hashrate (TH/s)
- Miner price ($/TH)
- Optional: pool fee (%)

## Calculations (Core)
1) **Gas → Energy**
   - MCF/day → scf/day → BTU/day
   - kWh/day = BTU/day ÷ heat rate
   - MW = kWh/day ÷ 24 / 1000

2) **Power → Gas**
   - MW → kWh/day
   - BTU/day = kWh/day × heat rate
   - MCF/day = BTU/day ÷ HHV ÷ 1,000

3) **Net Available Power**
   - Apply uptime and parasitic/load factors

4) **Mining Output**
   - Miners = floor(MW × 1000 / kW_per_miner)
   - Total TH/s → PH/s
   - Revenue = PH/s × hashprice × 30

5) **Costs + Cashflow**
   - Gas cost = MCF/day × price × 30
   - Generator lease/buy/RTO monthly cost
   - Net monthly = revenue − gas cost − gen cost − other opex

## UI/UX
- Add a **Gas‑to‑Power** button in the mode toggle.
- Layout sections:
  1) **Gas & Power Inputs** (toggle MCF/day ↔ MW)
  2) **Generator Economics** (Rent / Buy / RTO)
  3) **Mining Assumptions**
  4) **Results Summary** (MW, MCF/day, miners, PH/s, revenue, net)
  5) **Sensitivity** (gas price vs hashprice or heat rate)

## Data Sources (Optional)
- Waha index live feed (API key required), plus manual override
- Hashprice feed (optional API), plus manual override

## Open Decisions (Confirm)
- Waha data source + API key (EIA or other provider)
- Generator cost defaults (rent/buy/RTO values)

## Implementation Steps
1) Add state + calculations in `src/App.jsx`.
2) Add new UI section and styling in `src/App.css`.
3) Add defaults from your gas‑to‑power docs.
4) Deploy updates to GitHub Pages.
