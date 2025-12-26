# Next Session Notes

## Session: December 26, 2025

### Major Gas-to-Power Calculator Improvements

Updated the Gas-to-Power tab with actual NGEN-400/TGR400 specs from Taylor Power and added comprehensive financial analysis features.

## Changes Made

### 1. Accurate Generator Specs (NGEN-400/TGR400)
- Heat rate: 11,500 BTU/kWh (calculated from 4,600 SCF/HR at 400kW)
- Generator size: 400 kW
- Purchase price: $171,205 (Taylor Power quote)
- RTO: $12,500/mo (50% equity, maintenance included)
- Rent: $9,500/mo (no maintenance)
- Buy maintenance: $1,500/mo per unit

### 2. Generator Preset Dropdown
- NGEN-400 / TGR400 (400kW) - default
- CAT G3516 (1.6MW)
- Custom option

### 3. New Calculations Added
- **Effective $/kWh**: Shows actual power cost from gas-to-power
- **Breakeven Hashprice**: What hashprice makes the operation profitable
- **Grid Equivalent**: What grid power would cost to match your economics
- **ASIC CAPEX**: Optional miner purchase cost integration
- **Payback Period**: Months to recover CAPEX
- **Annual Projections**: Year 1 revenue, costs, and profit

### 4. Fleet Capacity Validation
- Shows warning if generator count × size doesn't match computed MW
- Displays fleet capacity in the Generator Fleet card

### 5. Buy Mode Maintenance Field
- Added separate maintenance cost field for purchased generators
- Info note for Rent mode to add maintenance to Other Opex

### 6. Sensitivity Analysis Grid
- Gas price ($1.50 - $3.00/MCF) vs Hashprice ($30-55/PH/day)
- Highlights current scenario
- Red styling for negative profit scenarios

### 7. Grid Power Comparison Section
- Shows effective $/kWh vs typical grid rates
- Calculates savings/cost vs 5¢/kWh grid baseline

### 8. Year 1 Projection Section
- Annual revenue, gas cost, generator cost, other opex
- Annual net profit and profit margin

## Default Values (Actual Astro/Taylor Power Data)
```
Heat Rate:        11,500 BTU/kWh
Generator Size:   400 kW
Generator Count:  12 (default)
RTO Payment:      $12,500/mo (includes maintenance)
Equity %:         50%
Term:             28 months
Purchase Price:   $171,205/unit
Gas Price:        Waha $1.50 + $0.45 adder = $1.95/MCF
ASIC Price:       $2,420/unit (S21 Pro ~$11/TH × 220TH)
```

## Files Modified
- `src/App.jsx` - Added all new state, calculations, and UI components
- `src/App.css` - Added styles for new elements (warning-row, info-row, preset-select, etc.)

## Build Status
- `npm run build` - SUCCESS

## Commit
- Run: `git add . && git commit -m "feat: major gas-to-power calc improvements with NGEN-400 specs"`
