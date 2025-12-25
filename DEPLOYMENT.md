# Quick Deployment Guide (Cloudflare Pages)

This guide deploys the mining calculator in a few minutes using Cloudflare Pages.

## ✅ Step 1: Create the Cloudflare Pages Project

1. Go to https://pages.cloudflare.com
2. Click **Create a project** → **Connect to Git**
3. Select the `CMS87/mining-calculator` repository

## ✅ Step 2: Build Settings

- **Framework preset**: Vite
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Environment variable (optional)**: `NODE_VERSION=20`

Click **Save and Deploy**.

## ✅ Step 3: Share the URL

Once the deploy finishes, Cloudflare will give you a URL like:

`https://<project>.pages.dev`

Share that link with anyone.

## 🔄 Future Updates

Every push to `main` will trigger a rebuild and redeploy automatically.

## 🆘 Troubleshooting

### Build fails with Node errors
- Set `NODE_VERSION=20` in Cloudflare Pages → Settings → Environment variables.

### Assets not loading
- Make sure `vite.config.js` does **not** set a `/mining-calculator/` base path.
- The app is configured for root hosting on Cloudflare Pages.

## ℹ️ GitHub Pages Note

GitHub Pages only supports private repos on paid plans. For free hosting with a private repo, Cloudflare Pages is the correct option.
