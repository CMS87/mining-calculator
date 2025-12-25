# Quick Deployment Guide

This guide will help you deploy the mining calculator in less than 5 minutes.

## 🎯 Fastest Method: GitHub Pages

### Step 1: Enable GitHub Pages (One-time Setup)

1. Go to https://github.com/CMS87/mining-calculator
2. Click the **Settings** tab (top right)
3. Scroll down and click **Pages** in the left sidebar
4. Under "Build and deployment":
   - **Source**: Select **GitHub Actions** from the dropdown
5. You don't need to click save - it's automatic!

### Step 2: Deploy

The deployment workflow is already set up! You have two options:

#### Option A: Automatic Deployment (Recommended)
- Simply merge this PR to the `main` branch
- The workflow will automatically deploy within 2-3 minutes
- You'll see the deployment in the **Actions** tab

#### Option B: Manual Deployment
1. Go to the **Actions** tab
2. Click on **Deploy to GitHub Pages** in the left sidebar
3. Click the **Run workflow** button (on the right)
4. Select the `main` branch
5. Click **Run workflow**

### Step 3: Access Your Calculator

After deployment completes (2-3 minutes):

1. Go to the **Actions** tab
2. Click on the latest workflow run
3. Look for the **github-pages** deployment section
4. Your calculator will be live at: **https://cms87.github.io/mining-calculator/**

You can also find the URL in **Settings → Pages** after the first deployment.

## 📤 Share the Calculator

Once deployed, simply share this link with anyone:

**https://cms87.github.io/mining-calculator/**

- ✅ No login required
- ✅ Works on any device
- ✅ Updates automatically when you push to main
- ✅ Free hosting via GitHub

## 🔄 Making Updates

After the initial setup:

1. Make changes to the code
2. Commit and push to `main` branch
3. The site automatically redeploys in 2-3 minutes

## 🆘 Troubleshooting

### Workflow fails with permissions error
- Go to **Settings → Actions → General**
- Scroll to "Workflow permissions"
- Select "Read and write permissions"
- Click Save

### Page shows 404
- Make sure GitHub Pages source is set to **GitHub Actions**
- Wait 2-3 minutes after workflow completes
- Clear your browser cache

### Assets not loading
- This is already fixed with the `base: '/mining-calculator/'` in vite.config.js
- If you change the repository name, update this value

## 🎨 Alternative: Custom Domain (Optional)

If you want to use a custom domain like `mining-calculator.com`:

1. Buy a domain from any registrar (Namecheap, GoDaddy, etc.)
2. Go to **Settings → Pages**
3. Enter your custom domain in the "Custom domain" field
4. Add a CNAME record in your DNS settings pointing to `cms87.github.io`
5. Wait for DNS propagation (can take up to 24 hours)

## 📞 Need Help?

If you encounter any issues:
1. Check the Actions tab for error messages
2. Review the workflow logs
3. Ensure GitHub Pages is enabled and set to GitHub Actions
