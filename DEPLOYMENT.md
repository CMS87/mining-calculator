# Quick Deployment Guide (GitHub Pages)

This guide deploys the mining calculator using GitHub Pages in the FenixCompute org.

## ✅ Step 1: Enable GitHub Pages

1. Go to https://github.com/FenixCompute/mining-calculator/settings/pages
2. Under "Build and deployment" → **Source**: select **GitHub Actions**

## ✅ Step 2: Deploy

The workflow deploys automatically on push to `main`, or run it manually:

1. Go to the **Actions** tab
2. Select **Deploy to GitHub Pages**
3. Click **Run workflow**

## ✅ Step 3: Share the URL

Once the workflow completes, your site is live at:

`https://fenixcompute.github.io/mining-calculator/`

## 🔄 Future Updates

Every push to `main` triggers a rebuild and redeploy.

## 🆘 Troubleshooting

### Workflow fails with permissions error
- Go to **Settings → Actions → General**
- Under "Workflow permissions": select **Read and write permissions**
- Click **Save**

### Assets not loading
- Confirm `vite.config.js` includes `base: '/mining-calculator/'`

## ℹ️ Cloudflare Pages Alternative

If you need private-only sharing or prefer Cloudflare Pages:
- Remove the `base` entry in `vite.config.js`
- Use build command `npm run build` and output directory `dist`
