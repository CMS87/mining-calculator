# Gas to Bitcoin Calculator — how to use it

Models a site where one company burns gas in generators, powers bitcoin miners
and sells hashrate. Two pages:

- **The model** (`index.html`) — three tabs: *Gas → Power* (generator fleet, gas,
  cost per kWh), *Power → BTC* (miners, revenue, equipment) and *Full Model*
  (everything on one screen plus the sensitivity table).
- **36-Month Cash Flow** (`cashflow.html`) — opened with the button on the model.
  It takes the model's numbers and adds the deployment ramp, running costs and
  setup. The *← Back to the model* button returns with your inputs intact.

## The model

| Group | What it sets |
|---|---|
| **Generator fleet** | Preset (TGR400, CAT G3516), count, size, and how the generators are paid for: Rent, Buy, RTO or Finance. The comparison table shows total paid and ownership for each. |
| **Gas & efficiency** | Heat rate and HHV; the gas price from a live index (Waha, Henry Hub, NYMEX) or a custom value, plus an adder. Negative Waha prices are real: you are paid to take gas. |
| **Generator load** | Planning headroom. Usable power = nameplate × load. |
| **Mining hardware** | Preset or custom miner (TH/s, J/TH, $/TH). |
| **Containers** | Count and miners per container (a 53-ft container with 28 PDUs × 12 outlets holds 336). Miners are limited by usable power or by slots, whichever is smaller. |
| **Market** | Hashprice (filled live from the BTC price and network hashrate), pool fee, curtailment, other opex. |

Gas is burned for the load the miners actually draw, not for generator
nameplate; the *Miner Load* line shows the share of nameplate in use.

## The cash flow

The page lists what it took from the model (containers, miners, hashprice, gas,
generator terms, prices). You set only:

- **Deployment** — containers online in month 1, month 2 and from month 3 on.
  Containers stay online once deployed; each one's equipment is bought the
  month it goes live.
- **Running costs and setup** — staff and overhead per month, miner repairs per
  miner per month, setup and commissioning per container.

The table reads top to bottom in five steps: revenue → running costs →
operating cash → equipment → net cash and cumulative cash. Months 1–12 are
shown one by one, then years 2 and 3, then the 36-month total. The generator
line follows the model's mode: rent or maintenance every month; RTO and
finance pay the term amount for the term, then the post-term amount.

**Payback** is the first month, after equipment has been bought, in which
cumulative cash is zero or better and stays there. The breakeven hashprice is
an operating figure (equipment excluded).

## Live inputs

Gas indexes come from a snapshot refreshed on weekday afternoons (EIA via FRED
for Henry Hub; OilPriceAPI for Waha and the NYMEX front month). Hashprice is
computed in the browser from the BTC price and the network hashrate, without
transaction fees, so it is slightly conservative.
