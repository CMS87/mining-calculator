# 🎉 Mining Calculator - Ready to Deploy!

Your Pecos Mining Calculator is configured for Cloudflare Pages deployment.

## 📱 What You Can Share

Once deployed, people can access your calculator at:
**`https://<project>.pages.dev`**

The calculator is a fully interactive web app that allows users to:
- Compare Co-Mining vs Self-Mining business models
- Adjust market assumptions (hashprice, energy costs, curtailment)
- Configure ASIC specifications
- Model different investor/operator deal structures
- Analyze ROI, payback periods, and sensitivity

## 🚀 Quick Deploy (2 Minutes)

### Step 1: Create the Cloudflare Pages Project
1. Go to https://pages.cloudflare.com
2. Click **Create a project** → **Connect to Git**
3. Select `CMS87/mining-calculator`

### Step 2: Configure Build Settings
- **Framework**: Vite
- **Build command**: `npm run build`
- **Output directory**: `dist`
- (Optional) `NODE_VERSION=20`

### Step 3: Share
After the deploy finishes, share the `https://<project>.pages.dev` URL.

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

## 📋 What Was Updated

1. ✅ Configured docs for Cloudflare Pages
2. ✅ Reset Vite base path for root hosting
3. ✅ Removed GitHub Pages workflow (not supported for private repos on free plan)
4. ✅ Cleaned deployment guidance

## 🔄 Keeping It Updated

After the initial setup, any changes you push to the `main` branch will:
- Trigger a new Cloudflare build
- Redeploy automatically
- Be live in minutes

## 🆘 Troubleshooting

### If the build fails:
1. Check Cloudflare Pages build logs
2. Ensure `NODE_VERSION=20` is set
3. Verify build command is `npm run build`

### If the page shows blank or assets fail:
1. Confirm `vite.config.js` has no `/mining-calculator/` base path
2. Redeploy after changes

## 📞 Questions?

- Check `DEPLOYMENT.md` for the quick start guide
- Check `README.md` for detailed documentation

## ✨ That's It!

Your mining calculator is ready to share with investors, partners, or anyone interested in evaluating the Pecos 15 MW facility business models.
