# Pecos Mining Calculator

A Bitcoin mining profitability calculator for the Pecos 15 MW facility. Compare Co-Mining (hosting) and Self-Mining business models with interactive deal structure analysis.

![Mining Calculator](https://img.shields.io/badge/React-18.2.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.0.8-purple)

## 🚀 Live Demo

GitHub Pages (FenixCompute): `https://fenixcompute.github.io/mining-calculator/`

## 📋 Features

- **Business Model Comparison**: Compare Co-Mining (hosting) vs Self-Mining models
- **Interactive Controls**: Adjust hashprice, energy costs, curtailment, and ASIC specs
- **Deal Structure Analysis**: Configure investor/operator splits with ROI and payback calculations
- **Model Mixing**: Blend Co-Mining and Self-Mining to find optimal capital/return balance
- **Sensitivity Analysis**: See how returns vary with different market conditions

## 🛠️ Deployment Options

### Option 1: GitHub Pages (Recommended for FenixCompute)

1. Go to **Settings → Pages**
2. Under "Build and deployment": **Source = GitHub Actions**
3. Push to `main` to deploy, or run the workflow manually in **Actions**

The workflow is in `.github/workflows/deploy.yml` and deploys `dist/`.

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
git clone https://github.com/FenixCompute/mining-calculator.git
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
