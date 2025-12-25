# Pecos Mining Calculator

A Bitcoin mining profitability calculator for the Pecos 15 MW facility. Compare Co-Mining (hosting) and Self-Mining business models with interactive deal structure analysis.

![Mining Calculator](https://img.shields.io/badge/React-18.2.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.0.8-purple)

## 🚀 Live Demo

Once deployed, the calculator will be available at: `https://cms87.github.io/mining-calculator/`

## 📋 Features

- **Business Model Comparison**: Compare Co-Mining (hosting) vs Self-Mining models
- **Interactive Controls**: Adjust hashprice, energy costs, curtailment, and ASIC specs
- **Deal Structure Analysis**: Configure investor/operator splits with ROI and payback calculations
- **Model Mixing**: Blend Co-Mining and Self-Mining to find optimal capital/return balance
- **Sensitivity Analysis**: See how returns vary with different market conditions

## 🛠️ Deployment Options

### Option 1: GitHub Pages (Recommended)

The easiest way to deploy and share this calculator is through GitHub Pages:

#### Setup Steps:

1. **Enable GitHub Pages** (one-time setup):
   - Go to your repository on GitHub
   - Click on **Settings** → **Pages** (in the left sidebar)
   - Under "Build and deployment":
     - Source: Select **GitHub Actions**
   - Save the settings

2. **Deploy**:
   - The workflow will automatically deploy when you push to the `main` branch
   - Or manually trigger deployment:
     - Go to **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

3. **Access**:
   - Once deployed, your calculator will be available at:
   - `https://cms87.github.io/mining-calculator/`
   - The URL will be shown in the Actions workflow output

### Option 2: Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. Sign up for a free [Netlify](https://www.netlify.com/) account
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click "Deploy site"
6. Your site will be available at `https://[your-site-name].netlify.app`

### Option 3: Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Sign up for a free [Vercel](https://vercel.com/) account
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings
5. Click "Deploy"
6. Your site will be available at `https://[your-project].vercel.app`

### Option 4: Cloudflare Pages

1. Sign up for a free [Cloudflare](https://pages.cloudflare.com/) account
2. Click "Create a project" → "Connect to Git"
3. Select your repository
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Click "Save and Deploy"
6. Your site will be available at `https://[your-project].pages.dev`

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
├── .github/
│   └── workflows/
│       └── deploy.yml   # GitHub Actions deployment workflow
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## 🔧 Configuration

### Changing the Base URL

If you're deploying to a custom domain or different path, update the `base` in `vite.config.js`:

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
