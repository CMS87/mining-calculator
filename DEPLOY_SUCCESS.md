# 🎉 Mining Calculator - Ready to Deploy!

Your Pecos Mining Calculator is configured for GitHub Pages deployment in the FenixCompute org.

## 📱 What You Can Share

Once deployed, people can access your calculator at:
**`https://fenixcompute.github.io/mining-calculator/`**

The calculator lets users:
- Compare Co-Mining vs Self-Mining business models
- Adjust market assumptions (hashprice, energy costs, curtailment)
- Configure ASIC specifications
- Model investor/operator deal structures
- Analyze ROI, payback periods, and sensitivity

## 🚀 Quick Deploy (2 Minutes)

### Step 1: Enable GitHub Pages
1. Go to https://github.com/FenixCompute/mining-calculator/settings/pages
2. Under "Build and deployment" → **Source**: Select **GitHub Actions**

### Step 2: Deploy
- Merge/push to `main`, or
- Go to **Actions** → **Deploy to GitHub Pages** → **Run workflow**

### Step 3: Share
After 2-3 minutes, share:
**`https://fenixcompute.github.io/mining-calculator/`**

## 📸 Preview

### Business Models View
![Business Models](https://github.com/user-attachments/assets/809b8da5-8c09-43a8-b68e-9464775950f8)

### Deal Structure View
![Deal Structure](https://github.com/user-attachments/assets/cf0f19b4-4979-4e0c-aea2-027be1322060)

## 📋 What Was Updated

1. ✅ Added GitHub Actions workflow for Pages
2. ✅ Set Vite base path for `/mining-calculator/`
3. ✅ Updated deployment documentation

## 🔄 Keeping It Updated

Every push to `main` redeploys automatically.

## 🆘 Troubleshooting

### If the workflow fails:
- Check **Actions** for errors
- Ensure **Settings → Actions → General → Workflow permissions** is set to **Read and write**

### If assets fail to load:
- Confirm `vite.config.js` includes `base: '/mining-calculator/'`

## ℹ️ Cloudflare Alternative

If you prefer Cloudflare Pages, remove the Vite base path and deploy with `npm run build` and `dist` output.
