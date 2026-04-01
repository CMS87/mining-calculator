import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import numpy as np
import requests

# Page Configuration
st.set_page_config(page_title="Pecos Mining - Operations & Financing", page_icon="⛏️", layout="wide")

# Dark terminal-style theme
st.markdown("""
<style>
    .stApp { background-color: #1a1a2e; }
    .stApp, .stMarkdown, p, span, label { color: #e8e8e8 !important; }
    h1, h2, h3, h4 { color: #ffffff !important; }
    .stCaption, caption { color: #a0a0a0 !important; }
    div[data-testid="stMetric"] {
        background: #16213e;
        border: 1px solid #0f3460;
        border-radius: 8px;
        padding: 0.75rem;
    }
    div[data-testid="stMetric"] label { color: #a0a0a0 !important; }
    div[data-testid="stMetric"] div[data-testid="stMetricValue"] { color: #4ade80 !important; font-weight: 700; }
    .stNumberInput input, .stTextInput input, .stSelectbox select {
        background-color: #16213e !important;
        color: #e8e8e8 !important;
        border: 1px solid #0f3460 !important;
    }
    .stSuccess { background-color: rgba(74, 222, 128, 0.1) !important; border-left: 4px solid #4ade80 !important; }
    .stWarning { background-color: rgba(251, 191, 36, 0.1) !important; border-left: 4px solid #fbbf24 !important; }
    .stError { background-color: rgba(248, 113, 113, 0.1) !important; border-left: 4px solid #f87171 !important; }
    .stInfo { background-color: rgba(96, 165, 250, 0.1) !important; border-left: 4px solid #60a5fa !important; }
    hr { border-color: #0f3460 !important; }
    .stButton button {
        background-color: #0f3460 !important;
        color: #e8e8e8 !important;
        border: 1px solid #4ade80 !important;
    }
</style>
""", unsafe_allow_html=True)

# --- Helper Functions ---
@st.cache_data(ttl=300)
def fetch_market_data():
    btc_price = 95000.0
    hashprice = 45.0
    try:
        r = requests.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', timeout=3)
        if r.status_code == 200:
            btc_price = float(r.json()['bitcoin']['usd'])
        hashrate_res = requests.get('https://mempool.space/api/v1/mining/hashrate/3d', timeout=3)
        if hashrate_res.status_code == 200:
            network_hashrate = hashrate_res.json()['currentHashrate']
            network_hashrate_ph = network_hashrate / 1e15
            hashprice = round((3.125 * btc_price * 144) / network_hashrate_ph * 0.97, 1)
    except:
        pass
    return btc_price, hashprice

btc_price_live, hashprice_live = fetch_market_data()

# === HEADER ===
st.title("⛏️ Pecos Mining - Operations & Financing")
st.caption("Astro Solutions LLC")

# Market data inputs
mkt_col1, mkt_col2, mkt_col3 = st.columns([2, 2, 1])
with mkt_col1:
    btc_price = st.number_input("BTC Price ($)", value=btc_price_live, step=1000.0, help="Live preset, editable")
with mkt_col2:
    hashprice = st.number_input("Hashprice ($/PH/day)", value=hashprice_live, step=1.0, help="Live preset, editable")
with mkt_col3:
    st.caption("Market Data")
    if st.button("🔄 Refresh"):
        st.cache_data.clear()
        st.rerun()

st.divider()

# =====================================================================
# SECTION 1: MINING OPERATIONS
# =====================================================================
st.header("⚡ Mining Operations")

# Facility Configuration
op_col1, op_col2, op_col3, op_col4 = st.columns(4)
with op_col1:
    facility_mw = st.number_input("Facility Power (MW)", value=15.0, step=1.0, min_value=1.0)
with op_col2:
    curtailment = st.slider("Curtailment %", 0, 20, 5) / 100
with op_col3:
    energy_price = st.number_input("Energy Cost (¢/kWh)", value=4.5, step=0.5)
with op_col4:
    monthly_opex = st.number_input("Monthly OpEx ($)", value=60000, step=5000)

# Business Model & CAPEX
op_col5, op_col6 = st.columns(2)
with op_col5:
    business_model = st.radio("Business Model", ["Co-Mining (Host miners)", "Self-Mining (Buy miners)", "Hybrid"], horizontal=True)
with op_col6:
    site_build_cost = st.number_input("Site Build Cost ($)", value=3000000, step=100000)

# Model-specific inputs
if business_model == "Co-Mining (Host miners)":
    model_col1, model_col2 = st.columns(2)
    with model_col1:
        co_efficiency = st.number_input("Miner Efficiency (J/TH)", value=14.0, step=1.0)
    with model_col2:
        co_mining_share = st.slider("Your Hashrate Share %", 20, 50, 30) / 100
    self_efficiency, self_price_per_th, self_mining_mw = 15.0, 10.0, 0.0
elif business_model == "Self-Mining (Buy miners)":
    model_col1, model_col2 = st.columns(2)
    with model_col1:
        self_efficiency = st.number_input("Miner Efficiency (J/TH)", value=15.0, step=1.0)
    with model_col2:
        self_price_per_th = st.number_input("Miner Price ($/TH)", value=10.0, step=1.0)
    co_efficiency, co_mining_share, self_mining_mw = 14.0, 0.30, facility_mw
else:  # Hybrid
    model_col1, model_col2, model_col3 = st.columns(3)
    with model_col1:
        self_mining_mw = st.slider("Self-Mining MW", 0.0, facility_mw, 5.0, step=1.0)
        co_efficiency = st.number_input("Co-Mining Eff (J/TH)", value=14.0, step=1.0)
    with model_col2:
        self_efficiency = st.number_input("Self-Mining Eff (J/TH)", value=15.0, step=1.0)
        self_price_per_th = st.number_input("Miner Price ($/TH)", value=10.0, step=1.0)
    with model_col3:
        co_mining_share = st.slider("Co-Mining Share %", 20, 50, 30) / 100

# === MINING CALCULATIONS ===
total_power_kw = facility_mw * 1000
uptime = 1 - curtailment
hours_per_month = 730
model_mix = self_mining_mw / facility_mw if facility_mw > 0 else 0

# Co-Mining calcs
if business_model != "Self-Mining (Buy miners)":
    co_total_hashrate_th = (total_power_kw * 1000) / co_efficiency
    co_effective_hashrate_ph = (co_total_hashrate_th / 1000) * uptime
    co_total_gross_revenue = co_effective_hashrate_ph * hashprice * 30
    co_total_power_cost = (energy_price / 100) * total_power_kw * hours_per_month * uptime
    co_total_net_revenue = co_total_gross_revenue - co_total_power_cost
    co_our_hashrate_ph = co_effective_hashrate_ph * co_mining_share
    co_our_net_monthly = co_total_net_revenue * co_mining_share - monthly_opex
    co_capex = site_build_cost
else:
    co_our_net_monthly, co_capex, co_our_hashrate_ph = 0, 0, 0
    co_total_gross_revenue, co_total_power_cost = 0, 0

# Self-Mining calcs
if business_model != "Co-Mining (Host miners)":
    self_power_kw = self_mining_mw * 1000 if business_model == "Hybrid" else total_power_kw
    self_total_hashrate_th = (self_power_kw * 1000) / self_efficiency
    self_effective_hashrate_ph = (self_total_hashrate_th / 1000) * uptime
    self_gross_revenue = self_effective_hashrate_ph * hashprice * 30
    self_power_cost = (energy_price / 100) * self_power_kw * hours_per_month * uptime
    self_net_monthly = self_gross_revenue - self_power_cost - (monthly_opex if business_model == "Self-Mining (Buy miners)" else 0)
    miner_cost = self_total_hashrate_th * self_price_per_th
else:
    self_net_monthly, self_effective_hashrate_ph, miner_cost = 0, 0, 0
    self_gross_revenue, self_power_cost = 0, 0

# Combined results
if business_model == "Co-Mining (Host miners)":
    total_capex = co_capex
    monthly_mining_profit = co_our_net_monthly
    our_hashrate_ph = co_our_hashrate_ph
    gross_revenue = co_total_gross_revenue * co_mining_share
    power_cost = co_total_power_cost * co_mining_share
elif business_model == "Self-Mining (Buy miners)":
    total_capex = site_build_cost + miner_cost
    monthly_mining_profit = self_net_monthly
    our_hashrate_ph = self_effective_hashrate_ph
    gross_revenue = self_gross_revenue
    power_cost = self_power_cost
else:  # Hybrid
    co_portion = 1 - model_mix
    total_capex = site_build_cost + miner_cost
    monthly_mining_profit = (co_our_net_monthly * co_portion) + self_net_monthly
    our_hashrate_ph = (co_our_hashrate_ph * co_portion) + self_effective_hashrate_ph
    gross_revenue = (co_total_gross_revenue * co_mining_share * co_portion) + self_gross_revenue
    power_cost = (co_total_power_cost * co_mining_share * co_portion) + self_power_cost

annual_mining_profit = monthly_mining_profit * 12
payback_years = (total_capex / monthly_mining_profit / 12) if monthly_mining_profit > 0 else float('inf')

# === MINING RESULTS ===
st.markdown("#### 📈 Mining Results")
r1, r2, r3, r4, r5 = st.columns(5)
r1.metric("Total CAPEX", f"${total_capex:,.0f}")
r2.metric("Your Hashrate", f"{our_hashrate_ph:.1f} PH/s")
r3.metric("Monthly Profit", f"${monthly_mining_profit:,.0f}")
r4.metric("Annual Profit", f"${annual_mining_profit:,.0f}")
r5.metric("Payback", f"{payback_years:.1f} yrs" if payback_years < 100 else "N/A")

# P&L breakdown
pnl_col1, pnl_col2 = st.columns(2)
with pnl_col1:
    st.markdown("**CAPEX Breakdown**")
    st.write(f"Site Build: ${site_build_cost:,.0f}")
    st.write(f"Miner Cost: ${miner_cost:,.0f}" if miner_cost > 0 else "Miner Cost: $0 (Co-Mining)")
with pnl_col2:
    st.markdown("**Monthly P&L**")
    st.write(f"Revenue: ${gross_revenue:,.0f}")
    st.write(f"Power: -${power_cost:,.0f}")
    st.write(f"OpEx: -${monthly_opex:,.0f}")
    st.write(f"**Net: ${monthly_mining_profit:,.0f}**")

st.divider()

# =====================================================================
# SECTION 2: FINANCING MODEL
# =====================================================================
st.header("💰 Financing Model")
st.caption("Use BTC as collateral vs Sell BTC to fund the project")

# BTC Holdings
fin_col1, fin_col2, fin_col3 = st.columns(3)
with fin_col1:
    total_btc_holdings = st.number_input("Total BTC You Own", value=60.0, step=1.0)
with fin_col2:
    btc_to_pledge = st.number_input("BTC to Pledge as Collateral", value=60.0, step=1.0, max_value=total_btc_holdings)
with fin_col3:
    btc_growth_rate = st.number_input("Expected BTC Growth %/yr", value=15.0, step=5.0)

# Loan Terms
loan_col1, loan_col2, loan_col3, loan_col4 = st.columns(4)
with loan_col1:
    loan_interest_rate = st.number_input("Interest Rate (%)", value=6.0, step=0.25)
with loan_col2:
    ltv_to_use = st.slider("LTV to Use (%)", 30, 70, 50, step=5)
with loan_col3:
    max_ltv_offered = st.number_input("Max LTV Offered (%)", value=60, step=5)
with loan_col4:
    margin_call_ltv = st.number_input("Margin Call LTV (%)", value=75, step=5)

# Calculations
total_portfolio_value = total_btc_holdings * btc_price
pledged_value = btc_to_pledge * btc_price
loan_amount = pledged_value * (ltv_to_use / 100)
monthly_interest = (loan_amount * loan_interest_rate / 100) / 12
margin_call_price = (loan_amount / (margin_call_ltv / 100)) / btc_to_pledge if btc_to_pledge > 0 else 0
buffer_pct = ((btc_price - margin_call_price) / btc_price) * 100 if btc_price > 0 else 0
net_after_interest = monthly_mining_profit - monthly_interest
btc_needed_to_sell = total_capex / btc_price
btc_remaining = total_btc_holdings - btc_needed_to_sell

# Summary metrics
st.markdown("#### 📊 Financing Summary")
m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Portfolio Value", f"${total_portfolio_value:,.0f}")
m2.metric("Loan Amount", f"${loan_amount:,.0f}")
m3.metric("Monthly Interest", f"${monthly_interest:,.0f}")
m4.metric("Net After Interest", f"${net_after_interest:,.0f}")
m5.metric("Margin Call @", f"${margin_call_price:,.0f}", f"-{buffer_pct:.0f}% buffer")

st.divider()

# === STRATEGY COMPARISON ===
st.markdown("### 📊 Strategy Comparison")
strat_col1, strat_col2 = st.columns(2)

with strat_col1:
    st.markdown("#### 🅰️ Use BTC as Collateral")
    st.markdown(f"""
    - Pledge: **{btc_to_pledge:.1f} BTC** (${pledged_value:,.0f})
    - Borrow: **${loan_amount:,.0f}** at {ltv_to_use}% LTV
    - Monthly Interest: **${monthly_interest:,.0f}**
    - Keep: **{total_btc_holdings:.1f} BTC** (all of them)
    - Net Cash Flow: **${net_after_interest:,.0f}/mo**
    - Margin Call if BTC drops to **${margin_call_price:,.0f}**
    """)
    if loan_amount >= total_capex:
        if net_after_interest > 0:
            st.success(f"✅ Loan covers CAPEX. Surplus: ${net_after_interest:,.0f}/mo")
        else:
            st.warning(f"⚠️ Gap: ${abs(net_after_interest):,.0f}/mo needed")
    else:
        st.error(f"❌ Loan ${loan_amount:,.0f} < CAPEX ${total_capex:,.0f}")

with strat_col2:
    st.markdown("#### 🅱️ Sell BTC")
    if btc_needed_to_sell > total_btc_holdings:
        st.error(f"❌ Need {btc_needed_to_sell:.2f} BTC but only have {total_btc_holdings:.1f}")
    else:
        st.markdown(f"""
        - Sell: **{btc_needed_to_sell:.2f} BTC** for ${total_capex:,.0f}
        - Keep: **{btc_remaining:.2f} BTC** (${btc_remaining * btc_price:,.0f})
        - No interest payments
        - No margin call risk
        - Full profit: **${monthly_mining_profit:,.0f}/mo**
        """)
        if monthly_mining_profit > 0:
            months_to_recover = total_capex / monthly_mining_profit
            st.info(f"📌 Recover BTC value in **{months_to_recover:.1f} months**")

st.divider()

# === 5-YEAR PROJECTION ===
st.markdown("### 📅 5-Year Net Worth Projection")

proj_data = []
for year in range(6):
    btc_yr = btc_price * ((1 + btc_growth_rate/100) ** year)
    a_btc_val = total_btc_holdings * btc_yr
    a_mining = (monthly_mining_profit - monthly_interest) * 12 * year if year > 0 else 0
    a_net = a_btc_val + a_mining - loan_amount
    b_btc_val = btc_remaining * btc_yr if btc_needed_to_sell <= total_btc_holdings else 0
    b_mining = monthly_mining_profit * 12 * year if year > 0 else 0
    b_net = b_btc_val + b_mining
    proj_data.append({"Year": year, "A: Collateral": a_net, "B: Sell BTC": b_net})

df_proj = pd.DataFrame(proj_data)
fig = go.Figure()
fig.add_trace(go.Scatter(x=df_proj['Year'], y=df_proj['A: Collateral'], name='A: Collateral',
                         line=dict(color='#4ade80', width=3), mode='lines+markers'))
fig.add_trace(go.Scatter(x=df_proj['Year'], y=df_proj['B: Sell BTC'], name='B: Sell BTC',
                         line=dict(color='#f87171', width=3), mode='lines+markers'))
fig.update_layout(
    title=f"Net Worth at {btc_growth_rate}% BTC Growth",
    height=350, paper_bgcolor='#1a1a2e', plot_bgcolor='#1a1a2e',
    font=dict(color='#e8e8e8'),
    xaxis=dict(gridcolor='#0f3460'), yaxis=dict(gridcolor='#0f3460')
)
st.plotly_chart(fig, use_container_width=True)

final_a, final_b = proj_data[-1]['A: Collateral'], proj_data[-1]['B: Sell BTC']
diff = final_a - final_b
res_col1, res_col2, res_col3 = st.columns(3)
res_col1.metric("Strategy A (Year 5)", f"${final_a:,.0f}")
res_col2.metric("Strategy B (Year 5)", f"${final_b:,.0f}")
res_col3.metric("Difference", f"${abs(diff):,.0f}", "A wins" if diff > 0 else "B wins")

if diff > 0:
    st.success(f"✅ **COLLATERAL WINS** by ${diff:,.0f}")
else:
    st.warning(f"⚠️ **SELLING WINS** by ${abs(diff):,.0f}")

st.divider()

# === RISK ANALYSIS ===
st.markdown("### 🚨 Risk Analysis")
risk_col1, risk_col2 = st.columns(2)

with risk_col1:
    st.markdown("#### 📉 LTV Comparison")
    ltv_table = []
    for ltv in [0.60, 0.50, 0.40]:
        ln = pledged_value * ltv
        mc = (ln / (margin_call_ltv / 100)) / btc_to_pledge if btc_to_pledge > 0 else 0
        buf = ((btc_price - mc) / btc_price) * 100 if btc_price > 0 else 0
        mo_int = (ln * loan_interest_rate / 100) / 12
        ltv_table.append({
            "LTV": f"{ltv*100:.0f}%", "Loan": f"${ln:,.0f}",
            "Margin Call": f"${mc:,.0f}", "Buffer": f"{buf:.0f}%",
            "Mo. Interest": f"${mo_int:,.0f}",
            "Covers": "✅" if ln >= total_capex else "❌"
        })
    st.dataframe(pd.DataFrame(ltv_table), use_container_width=True, hide_index=True)

with risk_col2:
    st.markdown("#### 🔻 Price Drop Stress Test")
    stress_data = []
    for drop in [0, 10, 20, 30, 40, 50]:
        sim_price = btc_price * (1 - drop/100)
        sim_ltv = (loan_amount / (btc_to_pledge * sim_price)) * 100 if btc_to_pledge > 0 else 999
        status = "🚨 CALL" if sim_ltv >= margin_call_ltv else ("⚠️ DANGER" if sim_ltv >= margin_call_ltv * 0.9 else "✅ SAFE")
        stress_data.append({"Drop": f"-{drop}%", "BTC": f"${sim_price:,.0f}", "LTV": f"{sim_ltv:.0f}%", "Status": status})
    st.dataframe(pd.DataFrame(stress_data), use_container_width=True, hide_index=True)

# LTV Gauge
st.markdown("#### 📊 Current LTV vs Margin Call")
current_ltv = (loan_amount / pledged_value) * 100 if pledged_value > 0 else 0
fig_gauge = go.Figure(go.Indicator(
    mode="gauge+number", value=current_ltv,
    title={'text': "Current LTV %", 'font': {'color': '#e8e8e8'}},
    number={'font': {'color': '#4ade80'}},
    gauge={
        'axis': {'range': [0, 100], 'tickfont': {'color': '#e8e8e8'}},
        'bar': {'color': "#60a5fa"}, 'bgcolor': '#16213e',
        'steps': [
            {'range': [0, margin_call_ltv * 0.7], 'color': "#166534"},
            {'range': [margin_call_ltv * 0.7, margin_call_ltv], 'color': "#854d0e"},
            {'range': [margin_call_ltv, 100], 'color': "#991b1b"}
        ],
        'threshold': {'line': {'color': "#f87171", 'width': 4}, 'thickness': 0.75, 'value': margin_call_ltv}
    }
))
fig_gauge.update_layout(height=250, paper_bgcolor='#1a1a2e', font=dict(color='#e8e8e8'))
st.plotly_chart(fig_gauge, use_container_width=True)
