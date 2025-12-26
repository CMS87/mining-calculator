# Next Session Notes

## What changed
- Added Gas-to-Power tab with toggle next to Business Models / Deal Structure.
- New inputs: gas flow vs MW, heat rate (default 9,000 BTU/kWh), HHV (1,000 BTU/scf), uptime, parasitic/load factors, Waha + adder gas pricing, generator fleet Rent/Buy/RTO, mining assumptions (hashprice, miner kW, TH/s, pool fee, other opex).
- Outputs: MW, MCF/day, miners, PH/s, monthly revenue, gas cost, generator cost, net monthly, and RTO equity if applicable.
- Styling for new cards, pill toggles, stat grid; build passes.

## State of defaults
- Waha index: manual entry (default 1.5 $/MCF) plus editable adder (default $0.30).
- Generator economics: user-provided (rent/buy/RTO fields default to 0).
- Mining defaults: unchanged from existing calculator; all editable.

## Open to-dos
- Decide/enter standard generator rent, buy price, RTO payment/term/equity defaults.
- Optionally add live Waha index feed and caching.
- Add sensitivity view for gas/hashprice or heat rate if needed.

## Commands run
- `npm run build`

## Commit
- `feat: add gas-to-power calculator tab` (pushed to main)
