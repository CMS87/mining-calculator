# Investor Follow-up Session Summary (2026-01-08)

## Context
- We shared the 1-page investment one-pager generated from the mining calculator:
  - PDF: `projects/SItes/pecos/mining-calculator/Pecos 15 MW Bitcoin Mining Facility.pdf`
  - Rendered image (for easy viewing): `projects/SItes/pecos/mining-calculator/Pecos_15MW_Bitcoin_Mining_Facility.png`
- A potential investor replied with questions about the hashprice assumptions and the investor vs project return profile.

## Investor’s main questions (paraphrased)
1) **“$0.06/TH/day looks aggressive.”** They suspect it assumes optimistic BTC production and price, and that production should not be linear over time (difficulty/network hash grows).
2) **“Is the 35% annual return project-level or investor-level?”** They believe the (70/30) split would materially reduce investor returns, and asked to revisit structure (waterfall, fees, priority distributions, etc.). They also suggested considering debt.

## Clarification on hashprice: $0.06/TH/day vs the base case
- In our materials and the calculator, the primary input is **hashprice in $/PH/day**, not BTC price/production directly.
- **Base case used for calculations:** **$37/PH/day**, which equals **$0.037/TH/day**.
- **$0.06/TH/day is not the base case**; it corresponds to **$60/PH/day**, which is included only as an **upside sensitivity scenario**.

Quick conversion:
- `$37/PH/day` = `$0.037/TH/day`
- `$60/PH/day` = `$0.060/TH/day`

## Mining calculator outputs (50/50 Co‑Mining + Self‑Mining)
These numbers replicate the PDF logic and are computed using the mining calculator formulas.

**Inputs used**
- Facility: **15 MW**
- Curtailment: **5%** (95% uptime)
- Energy: **4.5¢/kWh**
- Hashprice: **$37/PH/day** (base case)
- Monthly OPEX: **$50,000**
- Miner spec: **3.40 kW**, **220 TH/s**, **$11/TH**
- Co‑mining share (hosting fee): **30%** of hashrate
- Mix: **50% Co‑Mining / 50% Self‑Mining**
- Site + infrastructure cost used for this run: **$3.025M** (= purchase **$1.525M** + build **$1.5M**)

**Derived facility totals**
- Miners: **4,411**
- Total hashrate: **970 PH/s**
- Effective hashrate (after 5% curtailment): **922 PH/s**
- ASIC capex (if self-mining): **$10.67M**

**Co‑Mining (30% hashrate)**
- CAPEX: **$3.02M**
- Monthly gross: **$307K**
- Monthly energy: **-$138K**
- Monthly OPEX: **-$50K**
- Monthly net: **$119K**
- Phase 1 investor (70%): **$83K/mo**
- Payback (Phase 1): **~36.5 months**

**Self‑Mining (100% hashrate)**
- CAPEX: **$13.70M**
- Monthly gross: **$1.02M**
- Monthly energy: **-$462K**
- Monthly OPEX: **-$50K**
- Monthly net: **$512K**
- Phase 1 investor (85%): **$435K/mo**
- Payback (Phase 1): **~31.5 months**

**Blended (50/50)**
- Investment: **$8.36M**
- Monthly gross: **$665K**
- Monthly energy: **-$300K**
- Monthly OPEX: **-$50K**
- Monthly net: **$315K**
- Phase 1 investor % (blended): **77.5%** → **$244K/mo**
- Phase 2 investor %: **50%** → **$158K/mo**
- Payback (Phase 1): **~34.2 months**
- Phase 1 cash-on-cash (approx): **~35% annualized** (this is the “Phase 1” return profile under the blended split, not a guaranteed investor IRR).

## How to respond logically to the investor’s concerns
**On “aggressive” assumptions**
- Confirm that **$0.06/TH/day is an upside sensitivity**, while the base case is **$0.037/TH/day**.
- Emphasize that we can (and should) evaluate a range of hashprice outcomes and power costs; the calculator already includes this.
- Acknowledge that **network difficulty growth** reduces BTC output per TH over time; hashprice is a market shorthand that already reflects BTC price + fees + difficulty at a point in time, but forward projections should still be stress-tested.

**On investor return vs project return**
- Clarify that what matters is the **investor-level cashflow under the proposed split/waterfall**, not the project gross margin.
- The calculator’s **Deal Structure** tab explicitly shows investor distributions under Phase 1/Phase 2 and the implied payback under each model and the blended mix.
- Be open to revising structure (e.g., higher Phase 1 investor %, pref return, step-down split, explicit dev/O&M fees) to align incentives.

## Next step: share a “simple” interactive calculator instead of Excel
Goal: let the investor change the core drivers without needing spreadsheets.

Suggested approach:
- Share the mining calculator as a small static website build (Vite `dist/`) and provide a 1-line way to run it locally.
- Key inputs they can play with: hashprice ($/PH/day), energy (¢/kWh), curtailment, miner specs, site/build capex, opex, and deal splits.

Run locally (for anyone):
- `python3 -m http.server 8000` inside the built `dist/` folder, then open `http://localhost:8000`.

