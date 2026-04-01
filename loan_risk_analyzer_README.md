# Interest-Only Loan Risk Analyzer

## Overview
This Streamlit app analyzes the risk and cost of a **6% interest-only loan** backed by BTC/ETF collateral. It helps you make informed decisions about:
- Whether to keep the loan open or close it
- Risk of liquidation under different market conditions
- Comparison between borrowing vs selling your collateral
- Monthly cash flow analysis

## Key Features

### 1. **Real-Time BTC Price Tracking**
- Fetches live BTC prices from multiple APIs (Binance, CoinGecko, CoinDesk)
- Auto-refreshes every 5 minutes
- Manual refresh button available

### 2. **Interest-Only Loan Structure**
- Default 6% annual interest rate
- Monthly interest-only payments
- Principal remains constant until you close the loan
- Tracks cumulative interest over time

### 3. **Risk Analysis**
- **LTV (Loan-to-Value) Monitoring:** See how close you are to liquidation
- **Liquidation Stress Test:** Simulate market drops to see when you'd get margin called
- **5-Year Projection:** Visualize how your LTV changes as your portfolio grows
- **Risk Scenario Analysis:** Bull, sideways, and bear market outcomes

### 4. **Loan Closure Optimizer**
- Break-even analysis: When does your collateral growth cover interest costs?
- Monthly cash flow tracking: Is your position net positive or negative?
- Optimal timing recommendations based on your portfolio growth rate

### 5. **Strategy Comparison**
- **Strategy A (Borrow/HODL):** Keep your BTC, pay interest, maintain upside exposure
- **Strategy B (Sell BTC):** Sell collateral, no interest, but lose BTC appreciation
- Visual comparison showing which strategy wins under different growth rates

### 6. **Comprehensive Risk Summary**
- 4-factor risk assessment (LTV, Interest Coverage, Liquidation Buffer, Cash Drain)
- Color-coded risk levels (🟢 Low, 🟡 Medium, 🔴 High)
- Actionable recommendations based on your specific situation

## How to Run

```bash
cd /home/cms87/projects/SItes/pecos/mining-calculator
streamlit run loan_risk_analyzer.py
```

The app will open in your default browser at `http://localhost:8501`

## Usage Tips

### Input Configuration (Sidebar)

1. **BTC Holdings:** Enter your Bitcoin holdings
2. **Portfolio Value:** Auto-calculated from BTC holdings × current price
3. **Annual Growth:** Your expected yearly return (conservative: 5-7%, moderate: 10-15%, aggressive: 20%+)
4. **Loan Amount:** The principal you borrowed
5. **Interest Rate:** Set to 6% for your loan
6. **Liquidation LTV:** The loan-to-value ratio where you get liquidated (typically 70-80%)

### Understanding Key Metrics

- **Current LTV:** If this reaches your Liquidation LTV, you'll be margin called
- **Safety Buffer:** How much your portfolio can drop before liquidation
- **Monthly Interest Cost:** Your fixed monthly payment (interest-only)
- **Break-Even Growth Rate:** Your portfolio must grow at this rate to cover interest

### Risk Levels

- **🟢 SAFE:** Current LTV < 70% of max LTV
- **🟡 WARNING:** Current LTV between 70-85% of max LTV
- **🔴 CRITICAL:** Current LTV > 85% of max LTV
- **🔴 LIQUIDATED:** Current LTV ≥ max LTV

## Key Insights

### When to Keep the Loan Open
✅ Portfolio growth rate > Interest rate (6%)
✅ LTV is comfortably below liquidation threshold
✅ You believe in long-term BTC appreciation
✅ You have cash flow to cover monthly interest

### When to Consider Closing
❌ Portfolio growth < Interest rate (negative carry)
❌ LTV approaching dangerous levels (>80% of max)
❌ Market outlook is bearish
❌ Interest payments are straining cash flow

## Example Scenario

**Inputs:**
- BTC Holdings: 1.0 BTC
- BTC Price: $95,000
- Portfolio Value: $95,000
- Loan Amount: $50,000
- Interest Rate: 6%
- Max LTV: 70%

**Results:**
- Current LTV: 52.6%
- Monthly Interest: $250
- Liquidation if BTC drops to: $71,428 (-24.8%)
- Break-even growth rate: 6%

**Scenario Analysis (3 years):**
- Bull Market (+20%/yr): Loan strategy wins by $15,000+
- Sideways (0%): Selling BTC is better by $9,000
- Bear (-30%): **LIQUIDATED** ⚠️

## Advanced Features

### Sensitivity Matrix
Shows exact portfolio values and LTV at different market drop levels (0% to -60%)

### 5-Year Projection
Dual-axis chart showing:
- Portfolio value growth over time
- LTV declining as portfolio appreciates
- Helps visualize long-term loan dynamics

### Cumulative Interest Tracker
Bar chart showing total interest paid over 10 years:
- At 6%, you pay 100% of loan amount in interest after ~16.7 years
- Helps understand true cost of leverage

## Dependencies

- streamlit
- plotly
- pandas
- numpy
- requests

Install with:
```bash
pip install streamlit plotly pandas numpy requests
```

## Notes

- This tool is for **analysis only** and does not provide financial advice
- Always maintain a safety buffer to avoid liquidation
- Monitor your LTV regularly, especially during volatile markets
- Consider your risk tolerance and time horizon
- The 6% rate is competitive for BTC-backed loans (typical range: 5-12%)

## Future Enhancements

Potential additions:
- Integration with pecos mining revenue projections
- Multi-loan portfolio analysis
- Historical volatility analysis
- Automated alerts when LTV exceeds thresholds
- Export scenarios to Excel/PDF
