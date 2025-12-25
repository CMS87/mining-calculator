# Pecos Mining Calculator

A Bitcoin mining profitability calculator for the Pecos 15 MW facility. Compare Co-Mining (hosting) and Self-Mining business models with interactive deal structure analysis.

![Mining Calculator](https://img.shields.io/badge/React-18.2.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.0.8-purple)

## 🚀 Live Demo

Once deployed, the calculator will be available at your hosting URL (for Cloudflare Pages: `https://<project>.pages.dev`).

## 📋 Features

- **Business Model Comparison**: Compare Co-Mining (hosting) vs Self-Mining models
- **Interactive Controls**: Adjust hashprice, energy costs, curtailment, and ASIC specs
- **Deal Structure Analysis**: Configure investor/operator splits with ROI and payback calculations
- **Model Mixing**: Blend Co-Mining and Self-Mining to find optimal capital/return balance
- **Sensitivity Analysis**: See how returns vary with different market conditions

## 🛠️ Deployment Options

### Option 1: Cloudflare Pages (Recommended for private repos)

1. Sign up for a free [Cloudflare Pages](https://pages.cloudflare.com/) account
2. Click "Create a project" → "Connect to Git"
3. Select the `CMS87/mining-calculator` repository
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
5. (Optional) Set environment variable `NODE_VERSION=20`
6. Click "Save and Deploy"

Note: This repo is configured for root hosting, so no Vite base path is required.

### Option 2: GitHub Pages (Public repo or paid plan)

GitHub Pages only supports **private** repos on paid plans. If you make the repo public or have a paid plan:

1. Enable **Settings → Pages → Source: GitHub Actions**
2. Add a Pages workflow (we can re-add it if you want)
3. Set `base: '/mining-calculator/'` in `vite.config.js` for a repo subpath

### Option 3: Netlify

1. Sign up for a free [Netlify](https://www.netlify.com/) account
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click "Deploy site"
6. Your site will be available at `https://[your-site-name].netlify.app`

### Option 4: Vercel

1. Sign up for a free [Vercel](https://vercel.com/) account
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings
5. Click "Deploy"
6. Your site will be available at `https://[your-project].vercel.app`

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

The app will be available at `http://localhost:5173`

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
mining-calculator/
├── src/
│   ├── App.jsx          # Main calculator component
│   ├── App.css          # Styles
│   └── main.jsx         # Application entry point
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## 🔧 Configuration

### Changing the Base URL

If you're deploying to a subpath (like GitHub Pages), set the `base` in `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/your-custom-path/', // Change this
})
```

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
