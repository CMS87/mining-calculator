import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import requests

# Page Configuration
st.set_page_config(page_title="Pecos Mining & BTC Strategy Analyzer", page_icon="⛏️", layout="wide")

# --- Helper Functions ---
def fetch_btc_price():
    """Fetch live BTC price from multiple APIs."""
    try:
        r = requests.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', timeout=3)
        if r.status_code == 200:
            return float(r.json()['bitcoin']['usd']), "CoinGecko"
    except:
        pass
    try:
        r = requests.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', timeout=3)
        if r.status_code == 200:
            return float(r.json()['price']), "Binance"
    except:
        pass
    return None, "Failed"

def fetch_hashprice():
    """Calculate hashprice from BTC price and network hashrate."""
    try:
        price_res = requests.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', timeout=3)
        hashrate_res = requests.get('https://mempool.space/api/v1/mining/hashrate/3d', timeout=3)

        btc_price = float(price_res.json()['bitcoin']['usd'])
        network_hashrate = hashrate_res.json()['currentHashrate']  # H/s

        # Hashprice = (Block Reward × BTC Price × 144 blocks/day) / (Network Hashrate in PH/s)
        block_reward = 3.125  # Post-halving April 2024
        blocks_per_day = 144
        network_hashrate_ph = network_hashrate / 1e15
        hashprice = (block_reward * btc_price * blocks_per_day) / network_hashrate_ph * 0.97
        return round(hashprice, 1), btc_price
    except:
        return 45.0, 95000.0  # Defaults

@st.cache_data(ttl=300)
def get_market_data():
    hashprice, btc_price = fetch_hashprice()
    return hashprice, btc_price

# Fetch market data
hashprice_live, btc_price_live = get_market_data()

# --- SIDEBAR ---
st.sidebar.header("⛏️ Pecos Mining Calculator")

# Refresh button
if st.sidebar.button("🔄 Refresh Market Data"):
    st.cache_data.clear()
    st.rerun()

st.sidebar.success(f"**BTC:** ${btc_price_live:,.0f} | **Hashprice:** ${hashprice_live}/PH/day")

st.sidebar.divider()

# === MINING FACILITY INPUTS ===
st.sidebar.subheader("⚡ Facility Configuration")
facility_mw = st.sidebar.number_input("Facility Power (MW)", value=15.0, step=1.0, min_value=1.0)
curtailment = st.sidebar.slider("Curtailment %", 0, 20, 5, help="% downtime for grid/maintenance") / 100
energy_price = st.sidebar.number_input("Energy Cost (¢/kWh)", value=4.5, step=0.5, min_value=0.0)
hashprice = st.sidebar.number_input("Hashprice ($/PH/day)", value=hashprice_live, step=1.0)
monthly_opex = st.sidebar.number_input("Monthly OpEx ($)", value=60000, step=5000)

st.sidebar.subheader("🔧 Miner Specifications")
miner_efficiency = st.sidebar.number_input("Efficiency (J/TH)", value=15.0, step=1.0, help="Watts per TH/s")
miner_price_per_th = st.sidebar.number_input("Miner Price ($/TH)", value=10.0, step=1.0)
site_build_cost = st.sidebar.number_input("Site Build Cost ($)", value=3000000, step=100000)

st.sidebar.divider()

# === LOAN / BTC COLLATERAL INPUTS ===
st.sidebar.subheader("🏦 BTC Holdings & Loan")
btc_holdings = st.sidebar.number_input("Your BTC Holdings", value=10.0, step=0.5, min_value=0.1)
btc_price = st.sidebar.number_input("BTC Price ($)", value=btc_price_live, step=1000.0)
portfolio_value = btc_holdings * btc_price

st.sidebar.metric("Portfolio Value", f"${portfolio_value:,.0f}")

loan_amount = st.sidebar.number_input("Loan Amount ($)", value=500000, step=50000, help="Amount to borrow against BTC")
interest_rate = st.sidebar.number_input("Loan Interest Rate (%)", value=6.0, step=0.5)
max_ltv = st.sidebar.slider("Max LTV (Liquidation)", 50, 90, 70, help="LTV % where you get liquidated")
btc_annual_growth = st.sidebar.slider("Expected BTC Growth (%/yr)", -20, 50, 15)

# === CORE MINING CALCULATIONS ===
total_power_kw = facility_mw * 1000
uptime = 1 - curtailment

# Hashrate calculation: Power (W) / Efficiency (J/TH) = TH/s
total_hashrate_th = (total_power_kw * 1000) / miner_efficiency
total_hashrate_ph = total_hashrate_th / 1000
effective_hashrate_ph = total_hashrate_ph * uptime

# Revenue & Costs
hours_per_month = 730  # 8760 hours/year ÷ 12 months
monthly_gross_revenue = effective_hashrate_ph * hashprice * 30
monthly_power_cost = (energy_price / 100) * total_power_kw * hours_per_month * uptime
monthly_net_revenue = monthly_gross_revenue - monthly_power_cost - monthly_opex
annual_net_revenue = monthly_net_revenue * 12

# CAPEX
miner_capex = total_hashrate_th * miner_price_per_th
total_capex = site_build_cost + miner_capex

# Payback
payback_months = total_capex / monthly_net_revenue if monthly_net_revenue > 0 else float('inf')
payback_years = payback_months / 12

# ROI
annual_roi = (annual_net_revenue / total_capex * 100) if total_capex > 0 else 0

# === LOAN CALCULATIONS ===
current_ltv = (loan_amount / portfolio_value) * 100
liquidation_price = (loan_amount / (max_ltv / 100)) / btc_holdings
drop_to_liquidation = ((btc_price - liquidation_price) / btc_price) * 100
monthly_interest = (loan_amount * (interest_rate / 100)) / 12
yearly_interest = monthly_interest * 12

# === MAIN DASHBOARD ===
st.title("⛏️ Pecos Mining & BTC Strategy Analyzer")
st.markdown("**Should you use BTC as collateral or sell it to fund mining?** This tool analyzes both strategies.")

# Create tabs
tab_mining, tab_strategy, tab_loan = st.tabs(["⛏️ Mining Calculator", "📊 BTC Strategy: Collateral vs Sell", "🏦 Loan Risk Details"])

# ==================== TAB 1: MINING CALCULATOR ====================
with tab_mining:
    st.header("⛏️ Pecos Mining Facility Calculator")

    # Top metrics
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Facility Power", f"{facility_mw} MW", f"{total_power_kw:,.0f} kW")
    m2.metric("Hashrate", f"{effective_hashrate_ph:.1f} PH/s", f"{uptime*100:.0f}% uptime")
    m3.metric("Monthly Net Revenue", f"${monthly_net_revenue:,.0f}", f"${annual_net_revenue:,.0f}/yr")
    m4.metric("Payback Period", f"{payback_years:.1f} years", f"{payback_months:.0f} months")

    st.divider()

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("💰 Monthly P&L")

        # Waterfall chart
        fig_waterfall = go.Figure(go.Waterfall(
            orientation="v",
            x=["Gross Revenue", "Power Cost", "Operating Expenses", "Net Revenue"],
            y=[monthly_gross_revenue, -monthly_power_cost, -monthly_opex, monthly_net_revenue],
            measure=["relative", "relative", "relative", "total"],
            connector={"line": {"color": "rgb(63, 63, 63)"}},
            decreasing={"marker": {"color": "#FF6B6B"}},
            increasing={"marker": {"color": "#4CAF50"}},
            totals={"marker": {"color": "#2196F3"}},
            text=[f"${monthly_gross_revenue:,.0f}", f"-${monthly_power_cost:,.0f}",
                  f"-${monthly_opex:,.0f}", f"${monthly_net_revenue:,.0f}"],
            textposition="outside"
        ))
        fig_waterfall.update_layout(title="Monthly Cash Flow", showlegend=False, height=400)
        st.plotly_chart(fig_waterfall, use_container_width=True)

    with col2:
        st.subheader("📊 Key Metrics")

        metrics_data = [
            {"Metric": "Total Hashrate", "Value": f"{total_hashrate_ph:.1f} PH/s"},
            {"Metric": "Effective Hashrate", "Value": f"{effective_hashrate_ph:.1f} PH/s"},
            {"Metric": "Monthly Revenue", "Value": f"${monthly_gross_revenue:,.0f}"},
            {"Metric": "Monthly Power Cost", "Value": f"${monthly_power_cost:,.0f}"},
            {"Metric": "Monthly OpEx", "Value": f"${monthly_opex:,.0f}"},
            {"Metric": "Monthly Net", "Value": f"${monthly_net_revenue:,.0f}"},
            {"Metric": "Annual Net", "Value": f"${annual_net_revenue:,.0f}"},
            {"Metric": "Total CAPEX", "Value": f"${total_capex:,.0f}"},
            {"Metric": "Miner Cost", "Value": f"${miner_capex:,.0f}"},
            {"Metric": "Site Build", "Value": f"${site_build_cost:,.0f}"},
            {"Metric": "Annual ROI", "Value": f"{annual_roi:.1f}%"},
            {"Metric": "Payback", "Value": f"{payback_years:.1f} years"},
        ]
        st.dataframe(pd.DataFrame(metrics_data), use_container_width=True, hide_index=True)

        # Profitability indicator
        if monthly_net_revenue > 0:
            st.success(f"✅ Profitable: ${monthly_net_revenue:,.0f}/month net")
        else:
            st.error(f"❌ Losing: ${monthly_net_revenue:,.0f}/month")

    st.divider()

    # Sensitivity Analysis
    st.subheader("📉 Hashprice Sensitivity")

    hashprice_range = [30, 35, 40, 45, 50, 55, 60]
    sensitivity_data = []

    for hp in hashprice_range:
        rev = effective_hashrate_ph * hp * 30
        net = rev - monthly_power_cost - monthly_opex
        annual = net * 12
        roi = (annual / total_capex * 100) if total_capex > 0 else 0
        pb = total_capex / net / 12 if net > 0 else float('inf')

        sensitivity_data.append({
            "Hashprice": f"${hp}",
            "Monthly Revenue": f"${rev:,.0f}",
            "Monthly Net": f"${net:,.0f}",
            "Annual Net": f"${annual:,.0f}",
            "ROI": f"{roi:.1f}%",
            "Payback (yrs)": f"{pb:.1f}" if pb < 100 else "N/A"
        })

    st.dataframe(pd.DataFrame(sensitivity_data), use_container_width=True, hide_index=True)

# ==================== TAB 2: BTC STRATEGY ====================
with tab_strategy:
    st.header("📊 BTC Strategy: Use as Collateral vs Sell")
    st.markdown("""
    **The Key Question:** Should you...
    - **A) Use BTC as Collateral:** Take a loan against your BTC, keep BTC exposure, pay interest, fund mining with loan
    - **B) Sell BTC:** Sell some BTC to fund mining, lose BTC upside, but no interest payments
    """)

    st.divider()

    # Investment needed
    investment_needed = total_capex

    st.info(f"💰 **Investment Needed:** ${investment_needed:,.0f} to build the {facility_mw} MW facility")

    # Check if loan covers investment
    if loan_amount < investment_needed:
        st.warning(f"⚠️ Loan amount (${loan_amount:,.0f}) is less than CAPEX (${investment_needed:,.0f}). Adjust loan or reduce scope.")

    col_a, col_b = st.columns(2)

    with col_a:
        st.subheader("🅰️ Strategy A: BTC as Collateral")
        st.markdown(f"""
        - **Keep:** {btc_holdings:.2f} BTC (${portfolio_value:,.0f})
        - **Borrow:** ${loan_amount:,.0f} at {interest_rate}%
        - **Monthly Interest:** ${monthly_interest:,.0f}
        - **Mining Net Revenue:** ${monthly_net_revenue:,.0f}/mo
        - **Net After Interest:** ${monthly_net_revenue - monthly_interest:,.0f}/mo
        """)

        net_after_interest_a = monthly_net_revenue - monthly_interest

        if net_after_interest_a > 0:
            st.success(f"✅ Mining covers loan interest + ${net_after_interest_a:,.0f}/mo surplus")
        else:
            st.error(f"❌ Mining doesn't cover interest. Deficit: ${abs(net_after_interest_a):,.0f}/mo")

    with col_b:
        st.subheader("🅱️ Strategy B: Sell BTC")

        btc_to_sell = investment_needed / btc_price
        btc_remaining = btc_holdings - btc_to_sell

        st.markdown(f"""
        - **Sell:** {btc_to_sell:.2f} BTC (${investment_needed:,.0f})
        - **Keep:** {btc_remaining:.2f} BTC (${btc_remaining * btc_price:,.0f})
        - **No Interest Payments**
        - **Mining Net Revenue:** ${monthly_net_revenue:,.0f}/mo (all yours)
        """)

        if btc_to_sell > btc_holdings:
            st.error(f"❌ Not enough BTC! Need {btc_to_sell:.2f} but only have {btc_holdings:.2f}")
        else:
            st.info(f"💡 After selling, you'd have {btc_remaining:.2f} BTC remaining")

    st.divider()

    # Multi-year projection
    st.subheader("📅 5-Year Projection: Which Strategy Wins?")

    projection_years = 5
    projection_data = []

    for year in range(0, projection_years + 1):
        # BTC price projection
        btc_price_proj = btc_price * ((1 + btc_annual_growth/100) ** year)

        # Strategy A: Keep all BTC + mining profits - loan interest
        if year == 0:
            a_btc_value = portfolio_value
            a_mining_profit = 0
            a_interest_paid = 0
        else:
            a_btc_value = btc_holdings * btc_price_proj
            a_mining_profit = (monthly_net_revenue - monthly_interest) * 12 * year
            a_interest_paid = monthly_interest * 12 * year

        a_net_worth = a_btc_value + a_mining_profit - loan_amount  # Subtract loan principal

        # Strategy B: Remaining BTC + all mining profits
        if year == 0:
            b_btc_value = btc_remaining * btc_price if btc_to_sell <= btc_holdings else 0
            b_mining_profit = 0
        else:
            b_btc_value = btc_remaining * btc_price_proj if btc_to_sell <= btc_holdings else 0
            b_mining_profit = monthly_net_revenue * 12 * year

        b_net_worth = b_btc_value + b_mining_profit

        # BTC repurchased from mining profits
        btc_repurchased = b_mining_profit / btc_price_proj if btc_price_proj > 0 else 0
        total_btc_b = btc_remaining + btc_repurchased if btc_to_sell <= btc_holdings else 0

        projection_data.append({
            "Year": year,
            "BTC Price": btc_price_proj,
            "A: BTC Value": a_btc_value,
            "A: Mining Profit": a_mining_profit,
            "A: Interest Paid": a_interest_paid,
            "A: Net Worth": a_net_worth,
            "B: BTC Value": b_btc_value,
            "B: Mining Profit": b_mining_profit,
            "B: Net Worth": b_net_worth,
            "B: Total BTC": total_btc_b,
            "Winner": "A" if a_net_worth > b_net_worth else "B"
        })

    df_proj = pd.DataFrame(projection_data)

    # Chart
    fig_proj = go.Figure()
    fig_proj.add_trace(go.Scatter(x=df_proj['Year'], y=df_proj['A: Net Worth'], name='Strategy A (Collateral)',
                                   line=dict(color='blue', width=3), mode='lines+markers'))
    fig_proj.add_trace(go.Scatter(x=df_proj['Year'], y=df_proj['B: Net Worth'], name='Strategy B (Sell BTC)',
                                   line=dict(color='orange', width=3), mode='lines+markers'))
    fig_proj.update_layout(
        title=f"Net Worth Projection ({btc_annual_growth}% BTC Growth)",
        xaxis_title="Year",
        yaxis_title="Net Worth ($)",
        height=400
    )
    st.plotly_chart(fig_proj, use_container_width=True)

    # Final comparison
    final_a = projection_data[-1]['A: Net Worth']
    final_b = projection_data[-1]['B: Net Worth']
    diff = final_a - final_b

    col_result1, col_result2 = st.columns(2)

    with col_result1:
        st.metric("Strategy A (Collateral) - Year 5", f"${final_a:,.0f}")
    with col_result2:
        st.metric("Strategy B (Sell BTC) - Year 5", f"${final_b:,.0f}")

    if diff > 0:
        st.success(f"✅ **COLLATERAL WINS** by ${diff:,.0f} after {projection_years} years")
        st.markdown(f"""
        **Why A wins:** BTC appreciation at {btc_annual_growth}%/yr outweighs the {interest_rate}% loan interest.
        You keep all your BTC exposure while mining generates income to cover interest.
        """)
    else:
        st.warning(f"⚠️ **SELLING BTC WINS** by ${abs(diff):,.0f} after {projection_years} years")
        st.markdown(f"""
        **Why B wins:** At {btc_annual_growth}% BTC growth, the interest cost ({interest_rate}%) eats into your gains.
        Selling BTC and keeping mining profits gives better returns.
        """)

    st.divider()

    # BTC Repurchase Analysis
    st.subheader("🔄 Strategy B: BTC Repurchase Timeline")

    if btc_to_sell <= btc_holdings and monthly_net_revenue > 0:
        btc_sold_value = btc_to_sell * btc_price

        # How long to repurchase the same BTC amount from mining profits?
        # This changes with BTC price, so we calculate dynamically

        repurchase_data = []
        cumulative_profit = 0
        btc_repurchased = 0

        for month in range(1, 61):  # 5 years
            cumulative_profit += monthly_net_revenue
            # BTC price at this month (monthly compounding)
            btc_price_month = btc_price * ((1 + btc_annual_growth/100) ** (month/12))
            btc_repurchased = cumulative_profit / btc_price_month

            if month % 12 == 0:  # Yearly snapshots
                repurchase_data.append({
                    "Year": month // 12,
                    "Mining Profit": cumulative_profit,
                    "BTC Price": btc_price_month,
                    "BTC Repurchased": btc_repurchased,
                    "BTC Sold": btc_to_sell,
                    "Recovered %": (btc_repurchased / btc_to_sell * 100) if btc_to_sell > 0 else 0
                })

        df_repurchase = pd.DataFrame(repurchase_data)

        # Format for display
        df_display = df_repurchase.copy()
        df_display['Mining Profit'] = df_display['Mining Profit'].apply(lambda x: f"${x:,.0f}")
        df_display['BTC Price'] = df_display['BTC Price'].apply(lambda x: f"${x:,.0f}")
        df_display['BTC Repurchased'] = df_display['BTC Repurchased'].apply(lambda x: f"{x:.2f}")
        df_display['BTC Sold'] = df_display['BTC Sold'].apply(lambda x: f"{x:.2f}")
        df_display['Recovered %'] = df_display['Recovered %'].apply(lambda x: f"{x:.1f}%")

        st.dataframe(df_display, use_container_width=True, hide_index=True)

        # Find breakeven
        for month in range(1, 121):
            cumulative_profit = monthly_net_revenue * month
            btc_price_month = btc_price * ((1 + btc_annual_growth/100) ** (month/12))
            btc_repurchased = cumulative_profit / btc_price_month
            if btc_repurchased >= btc_to_sell:
                st.info(f"📌 **BTC Recovery:** At {btc_annual_growth}% growth, it takes **{month} months ({month/12:.1f} years)** to repurchase the {btc_to_sell:.2f} BTC you sold.")
                break
        else:
            st.warning("⚠️ Cannot recover sold BTC within 10 years at current projections")

    st.divider()

    # Breakeven BTC growth rate
    st.subheader("📈 Breakeven Analysis: At What BTC Growth Rate Do Strategies Equal?")

    # Find the growth rate where Strategy A = Strategy B
    growth_analysis = []
    for growth in range(-10, 51, 5):
        # 5-year projection at this growth rate
        btc_price_5yr = btc_price * ((1 + growth/100) ** 5)

        # Strategy A
        a_btc_value = btc_holdings * btc_price_5yr
        a_mining_profit = (monthly_net_revenue - monthly_interest) * 12 * 5
        a_net_worth = a_btc_value + a_mining_profit - loan_amount

        # Strategy B
        b_btc_value = btc_remaining * btc_price_5yr if btc_to_sell <= btc_holdings else 0
        b_mining_profit = monthly_net_revenue * 12 * 5
        b_net_worth = b_btc_value + b_mining_profit

        growth_analysis.append({
            "BTC Growth %": f"{growth}%",
            "Strategy A": f"${a_net_worth:,.0f}",
            "Strategy B": f"${b_net_worth:,.0f}",
            "Winner": "A (Collateral)" if a_net_worth > b_net_worth else "B (Sell)"
        })

    st.dataframe(pd.DataFrame(growth_analysis), use_container_width=True, hide_index=True)

# ==================== TAB 3: LOAN RISK ====================
with tab_loan:
    st.header("🏦 Loan Risk Analysis")
    st.info(f"📌 **Interest-Only Loan:** ${loan_amount:,.0f} at {interest_rate}% = ${monthly_interest:,.0f}/month interest")

    # Key metrics
    l1, l2, l3, l4 = st.columns(4)
    l1.metric("Current LTV", f"{current_ltv:.1f}%", f"Max: {max_ltv}%")
    l2.metric("Liquidation Price", f"${liquidation_price:,.0f}", f"-{drop_to_liquidation:.1f}% from current")
    l3.metric("Monthly Interest", f"${monthly_interest:,.0f}", f"${yearly_interest:,.0f}/yr")
    l4.metric("Mining Covers Interest?", "Yes ✅" if monthly_net_revenue >= monthly_interest else "No ❌")

    st.divider()

    col_risk1, col_risk2 = st.columns(2)

    with col_risk1:
        st.subheader("📉 Liquidation Stress Test")

        simulated_drop = st.slider("Simulate BTC Price Drop (%)", 0, 80, 0)
        sim_btc_price = btc_price * (1 - simulated_drop/100)
        sim_portfolio = btc_holdings * sim_btc_price
        sim_ltv = (loan_amount / sim_portfolio) * 100

        # LTV Gauge
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=sim_ltv,
            title={'text': f"LTV at -{simulated_drop}% Drop"},
            number={'suffix': '%'},
            gauge={
                'axis': {'range': [0, 100]},
                'bar': {'color': "black"},
                'steps': [
                    {'range': [0, max_ltv*0.7], 'color': "#90EE90"},
                    {'range': [max_ltv*0.7, max_ltv], 'color': "#FFD700"},
                    {'range': [max_ltv, 100], 'color': "#FF4500"}
                ],
                'threshold': {'line': {'color': "red", 'width': 4}, 'thickness': 0.75, 'value': max_ltv}
            }
        ))
        st.plotly_chart(fig_gauge, use_container_width=True)

        if sim_ltv >= max_ltv:
            st.error(f"🚨 LIQUIDATED at -{simulated_drop}% drop! LTV: {sim_ltv:.1f}%")
        else:
            st.success(f"✅ Safe at -{simulated_drop}% drop. LTV: {sim_ltv:.1f}%")

    with col_risk2:
        st.subheader("💵 Can Mining Cover Loan Interest?")

        coverage_ratio = monthly_net_revenue / monthly_interest if monthly_interest > 0 else 0

        fig_coverage = go.Figure()
        fig_coverage.add_trace(go.Bar(
            x=['Mining Net Revenue', 'Loan Interest'],
            y=[monthly_net_revenue, monthly_interest],
            marker_color=['green', 'red'],
            text=[f"${monthly_net_revenue:,.0f}", f"${monthly_interest:,.0f}"],
            textposition='outside'
        ))
        fig_coverage.update_layout(title="Monthly: Mining vs Interest", yaxis_title="USD ($)", height=350)
        st.plotly_chart(fig_coverage, use_container_width=True)

        st.metric("Interest Coverage Ratio", f"{coverage_ratio:.1f}x")

        if coverage_ratio >= 2:
            st.success(f"✅ Excellent coverage - mining easily pays interest")
        elif coverage_ratio >= 1:
            st.info(f"👍 Mining covers interest with ${monthly_net_revenue - monthly_interest:,.0f} surplus")
        else:
            st.error(f"❌ Mining doesn't cover interest! Deficit: ${monthly_interest - monthly_net_revenue:,.0f}/mo")

    st.divider()

    # Risk Summary
    st.subheader("📋 Risk Summary")

    risk_factors = []

    # LTV Risk
    if current_ltv >= max_ltv * 0.85:
        risk_factors.append({"Factor": "LTV Risk", "Status": "🔴 HIGH", "Detail": f"Current {current_ltv:.1f}% near liquidation {max_ltv}%"})
    elif current_ltv >= max_ltv * 0.70:
        risk_factors.append({"Factor": "LTV Risk", "Status": "🟡 MEDIUM", "Detail": f"Current {current_ltv:.1f}% has buffer to {max_ltv}%"})
    else:
        risk_factors.append({"Factor": "LTV Risk", "Status": "🟢 LOW", "Detail": f"Current {current_ltv:.1f}% well below {max_ltv}%"})

    # Interest Coverage
    if coverage_ratio >= 1.5:
        risk_factors.append({"Factor": "Interest Coverage", "Status": "🟢 STRONG", "Detail": f"Mining covers interest {coverage_ratio:.1f}x"})
    elif coverage_ratio >= 1:
        risk_factors.append({"Factor": "Interest Coverage", "Status": "🟡 ADEQUATE", "Detail": f"Mining covers interest {coverage_ratio:.1f}x"})
    else:
        risk_factors.append({"Factor": "Interest Coverage", "Status": "🔴 WEAK", "Detail": f"Mining doesn't cover interest ({coverage_ratio:.1f}x)"})

    # Liquidation Buffer
    if drop_to_liquidation < 20:
        risk_factors.append({"Factor": "Price Buffer", "Status": "🔴 THIN", "Detail": f"Only {drop_to_liquidation:.1f}% drop to liquidation"})
    elif drop_to_liquidation < 40:
        risk_factors.append({"Factor": "Price Buffer", "Status": "🟡 MODERATE", "Detail": f"{drop_to_liquidation:.1f}% drop to liquidation"})
    else:
        risk_factors.append({"Factor": "Price Buffer", "Status": "🟢 STRONG", "Detail": f"{drop_to_liquidation:.1f}% drop to liquidation"})

    st.dataframe(pd.DataFrame(risk_factors), use_container_width=True, hide_index=True)
