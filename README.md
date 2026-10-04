# Gas to Bitcoin Calculator

Models a gas → power → Bitcoin mining operation: generator fleet economics, mining output, and a straight 36-month cash flow for one company that owns the containers, generators and miners (`public/cashflow.html`).

![Mining Calculator](https://img.shields.io/badge/React-18.2.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.0.8-purple)

## 🚀 Live Demo

GitHub Pages: `https://cms87.github.io/mining-calculator/` (served from the `gh-pages` branch)

## 📋 Features

- **Gas → Power**: generator fleet (rent / buy / RTO / finance), gas burned for the load actually drawn, cost per kWh.
- **Power → BTC**: miner presets, containers, revenue, equipment, payback.
- **Full Model**: everything on one screen plus a gas price × hashprice sensitivity table.
- **36-Month Cash Flow** (`public/cashflow.html`): takes the model's numbers through a localStorage hand-off, adds the deployment ramp, running costs and setup; pure model in `public/cashflow-model.js` with tests (`npm test`).
- **Live inputs**: gas indexes (Waha, Henry Hub, NYMEX) from a build-time snapshot; hashprice from BTC price and network hashrate.

See `USER_GUIDE.md` for how to read both pages.

## 🛠️ Deployment Options

### Option 1: GitHub Pages (current)

Pages serves the `gh-pages` branch. `.github/workflows/deploy.yml` runs on every
push to `main`, on weekday afternoons (cron) and on demand: it fetches the gas
index snapshot, runs the tests, builds, and pushes `dist/` to `gh-pages`.

**Live gas indexes** (`public/prices.json`, written by `scripts/fetch-prices.mjs`):
Henry Hub spot comes from EIA via FRED with no key. Waha and the NYMEX front
month come from [OilPriceAPI](https://www.oilpriceapi.com) and need the
repository secret `OILPRICEAPI_KEY` (free tier, 50 requests/day; the workflow
uses 2). Without the secret those indexes show as unavailable and
the pages fall back to Henry Hub.

Manual deploy from a laptop: `npm run build`, then push the contents of `dist/`
to the `gh-pages` branch.

### Option 2: Cloudflare Pages (Private repo alternative)

1. Go to https://pages.cloudflare.com → Create a project → Connect to Git
2. Select the repository
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Optional env: `NODE_VERSION=20`
4. Deploy and share the `https://<project>.pages.dev` URL

Note: Cloudflare Pages expects root hosting. If you use Cloudflare, remove the
`base: '/mining-calculator/'` entry in `vite.config.js`.

### Option 3: Netlify

1. Connect the repo in Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`

### Option 4: Vercel

1. Import the repo in Vercel
2. Vercel auto-detects Vite settings

## 💻 Local Development

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/CMS87/mining-calculator.git
cd mining-calculator

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
mining-calculator/
├── src/
│   ├── App.jsx          # Main calculator component
│   ├── App.css          # Styles
│   └── main.jsx         # Application entry point
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actions deployment workflow
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## 🔧 Configuration

### Changing the Base URL

If you're deploying to a subpath (like GitHub Pages), keep:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/mining-calculator/',
})
```

For root hosting (Cloudflare/Netlify/Vercel), remove the `base` entry.

## 📊 How to Use the Calculator

1. **Business Models Tab**:
   - Adjust market assumptions (hashprice, energy costs)
   - Configure ASIC specifications
   - Compare Co-Mining vs Self-Mining P&L
   - Use the model mixer to blend approaches

2. **Deal Structure Tab**:
   - Configure investor/operator splits for each model
   - View payback periods and ROI calculations
   - Analyze sensitivity to market conditions
   - Compare returns across different investment structures

## 🤝 Contributing

Feel free to open issues or submit pull requests for improvements.

## 📄 License

This project is available for use by Astro Solutions LLC.

## 📧 Contact

For questions about the calculator or investment opportunities, contact Astro Solutions LLC.
