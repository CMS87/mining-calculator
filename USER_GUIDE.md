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
| **Containers** | Count, cost, setup and electrical capacity per container (1,400 kW default). A container holds capacity ÷ kW per miner, up to its physical places (420 default); the site runs the smaller of that and what the generators can power, and says which one limits. |
| **Market** | Hashprice (filled live from the BTC price and network hashrate), pool fee, curtailment, other opex. |

Gas is burned for the load the miners actually draw, not for generator
nameplate; the *Miner Load* line shows the share of nameplate in use.

## The cash flow

The page lists what it took from the model (containers, miners, hashprice, gas,
generator terms, prices). You set only:

- **Deployment** — containers online in month 1, month 2 and from month 3 on.
  Containers stay online once deployed; each one's equipment is bought the
  month it goes live.
- **Halving** — the month the next halving lands (from the live block height)
  and the hashprice from then on as a share of today's.
- **Return** — the discount rate for the NPV.

The table reads top to bottom in five steps: revenue → running costs →
operating cash → equipment → net cash and cumulative cash. Months 1–12 are
shown one by one, then years 2 and 3, then the 36-month total. The generator
line follows the model's mode: rent or maintenance every month; RTO and
finance pay the term amount for the term, then the post-term amount.

**Payback** is the first month, after equipment has been bought, in which
cumulative cash is zero or better and stays there. The breakeven hashprice is
an operating figure (equipment excluded).

**IRR and NPV** come from the net cash line. Month 1, when the first equipment
is bought, counts as today; the net cash of month *m* is discounted *m* − 1
months. Rates are effective yearly rates (monthly = (1 + yearly)^(1/12) − 1).
IRR is the yearly rate at which the 36 monthly net cash flows discount to zero;
NPV discounts them at the rate you set (default 15 %). Both use only the 36
months in the table: no resale value for the equipment and no loan balance after
month 36, so a financed site that keeps paying after the horizon is judged on
its first three years only. IRR shows n/a when the cash never pays back or when
cumulative cash turns negative again later (two rates would zero the NPV, so no
single one describes the project).

## Where each operating cost lives

Both pages use the same definitions; `npm test` proves the cash flow's month at
full build equals the model's monthly P&L for all four generator modes.

| Cost | Entered in | Unit | Formula | Shown in |
|---|---|---|---|---|
| Gas | Gas & Efficiency (index or custom + adder) | $/MCF (indexes arrive in $/MMBtu, converted at the HHV) | miner load kW × 24 h × heat rate (BTU/kWh) ÷ (HHV BTU/scf × 1,000) = MCF/day, × $/MCF × 30.42 days | Gas → Power summary, P&L, cash flow |
| Generators | Generator Fleet, per mode | Rent $/gen/month · Buy: maintenance $/unit/month · RTO: payment $/gen/month until the equity share has paid the price (never, if the equity share is 0), then maintenance · Finance: amortised loan payment (price − down payment, rate, term; a 0-month term is a cash purchase) + maintenance, then maintenance | × generator count | acquisition comparison, P&L, cash flow (each batch of generators pays its own term from the month its containers go live) |
| Overhaul reserve | Generator Lifecycle (owned modes) | $ per top / major overhaul, hours between them, unit life | overhauls before retirement (a major replaces the top due at the same hour) × count ÷ life at 8,760 running hours a year ÷ 12; zero when renting | P&L line; included in the cash flow's generator line |
| Miner repairs | Revenue & Market | $/miner/month | × miners | P&L, cash flow |
| Staff and overhead | Revenue & Market | $/month | fixed for the site | P&L, cash flow |
| Other opex | Revenue & Market | $/month | fixed: land or lease, insurance, network, water | P&L, cash flow |
| Pool fee | Revenue & Market | % of revenue | deducted from revenue, shown as its own line | P&L, cash flow |
| Curtailment | Revenue & Market | % | reduces hashrate sold; not a cost | revenue |

Not modelled anywhere: taxes, depreciation, financing of containers or miners.

Equipment is one-time and is shown two ways: **equipment cost** (everything the
site owns, generators at full price when bought or financed) and **cash upfront**
(the same, with the generator down payment instead of the full price when
financed; rented and rent-to-own generators are never bought). The model page's
**simple payback** is cash-on-cash: cash upfront ÷ monthly operating cash after
generator payments, with no ramp and no halving. The cash-flow page's payback is
the month-by-month one.

The **acquisition comparison** (Gas → Power) puts the four ways of paying for the
generators on one basis over the loan term: cash upfront, monthly cost (payment +
maintenance + overhaul reserve), total paid, interest or rent-to-own premium, the
value of the units at the end (straight line over their life, only if owned by
then) and the net cost (total paid − value kept).

**Cash power cost (¢/kWh)** is gas + generator payments + overhaul reserve per kWh
delivered to the miners; upfront purchases are not in it, so a mode with more cash
upfront shows a lower figure.

## Live inputs

Gas indexes come from a snapshot refreshed on weekday afternoons (EIA via FRED
for Henry Hub; OilPriceAPI for Waha and the NYMEX front month). Hashprice is
computed in the browser from the BTC price and the network hashrate, without
transaction fees, so it is slightly conservative.
