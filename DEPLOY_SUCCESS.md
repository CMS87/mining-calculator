# 🎉 Mining Calculator - Ready to Deploy!

Your Pecos Mining Calculator is now configured for easy deployment and sharing.

## 📱 What You Can Share

Once deployed, people can access your calculator at:
**`https://cms87.github.io/mining-calculator/`**

The calculator is a fully interactive web app that allows users to:
- Compare Co-Mining vs Self-Mining business models
- Adjust market assumptions (hashprice, energy costs, curtailment)
- Configure ASIC specifications
- Model different investor/operator deal structures
- Analyze ROI, payback periods, and sensitivity

## 🚀 Quick Deploy (2 Minutes)

### Step 1: Enable GitHub Pages
1. Go to https://github.com/CMS87/mining-calculator/settings/pages
2. Under "Build and deployment" → **Source**: Select **"GitHub Actions"**
3. That's it! (No save button needed)

### Step 2: Deploy
Merge this pull request to the `main` branch, and deployment happens automatically!

**Alternative**: Manually trigger deployment:
- Go to **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

### Step 3: Share
After 2-3 minutes, your calculator will be live at:
**`https://cms87.github.io/mining-calculator/`**

## 📸 Preview

The calculator has two main views:

### Business Models View
![Business Models](https://github.com/user-attachments/assets/809b8da5-8c09-43a8-b68e-9464775950f8)
- Compare Co-Mining ($3M CAPEX) vs Self-Mining ($13.29M CAPEX)
- Interactive market assumptions and ASIC specs
- Real-time P&L calculations
- Model mixer for hybrid approaches

### Deal Structure View
![Deal Structure](https://github.com/user-attachments/assets/cf0f19b4-4979-4e0c-aea2-027be1322060)
- Configure investor/operator splits for each model
- Phase 1 (until ROI) and Phase 2 (after ROI) splits
- Blended scenario calculator
- Comprehensive deal breakdown tables
- Sensitivity analysis showing returns under different market conditions

## 📋 What Was Changed

1. ✅ Added GitHub Actions workflow for automatic deployment
2. ✅ Updated Vite config with correct base path
3. ✅ Created comprehensive documentation (README.md, DEPLOYMENT.md)
4. ✅ Configured `.gitignore` to exclude build artifacts
5. ✅ Tested build and preview locally

## 🔄 Keeping It Updated

After the initial setup, any changes you push to the `main` branch will:
- Automatically trigger a rebuild
- Redeploy to GitHub Pages
- Be live in 2-3 minutes

No manual steps needed!

## 🌐 Alternative Deployment Options

If you prefer not to use GitHub Pages, the documentation includes setup guides for:
- **Netlify** - Free, great for sharing with custom domains
- **Vercel** - Free, optimized for React apps
- **Cloudflare Pages** - Free, global CDN included

All options are documented in the README.md file.

## 🆘 Troubleshooting

### If the workflow fails:
1. Check **Actions** tab for error messages
2. Ensure GitHub Pages is set to "GitHub Actions" (not "Deploy from branch")
3. Verify workflow permissions: **Settings → Actions → General → Workflow permissions** should be "Read and write"

### If the page shows 404:
1. Wait 2-3 minutes after deployment completes
2. Check that the URL is correct: `https://cms87.github.io/mining-calculator/`
3. Clear browser cache

## 📞 Questions?

- Check `DEPLOYMENT.md` for the quick start guide
- Check `README.md` for detailed documentation
- Review the GitHub Actions workflow in `.github/workflows/deploy.yml`

## ✨ That's It!

Your mining calculator is ready to share with investors, partners, or anyone interested in evaluating the Pecos 15 MW facility business models!
