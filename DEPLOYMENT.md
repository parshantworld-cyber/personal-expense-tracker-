# 🚀 Deployment Guide: Personal Expense Tracker

This repository is fully configured and production-ready for instant deployment to **Render** or **Railway** with free HTTPS, zero-downtime updates, and automatic builds on every `git push`.

---

## 🌟 Option 1: Deploy to Render (Recommended - Free Tier)

Render provides free web service hosting with automatic SSL certificates and GitHub integration.

### Step 1: Push Your Code to GitHub
1. Open terminal/PowerShell in this project folder:
   ```bash
   git init
   git add .
   git commit -m "Production ready release"
   ```
2. Create a new repository on [github.com](https://github.com/new) (e.g. `personal-expense-tracker`).
3. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/personal-expense-tracker.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `personal-expense-tracker` repository.
4. Render will auto-detect the configuration, or you can verify:
   - **Name**: `personal-expense-tracker`
   - **Region**: Closest to you (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: `Free`
5. Click **Deploy Web Service**!

🎉 In approximately 1–2 minutes, your web application will be live at:
`https://personal-expense-tracker.onrender.com`

---

## 🚂 Option 2: Deploy to Railway

Railway offers seamless 1-click deployment with support for persistent disk volumes.

### Step 1: Push Code to GitHub (Same as above)
### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app/) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `personal-expense-tracker` repository.
4. Railway will automatically detect the `Procfile` and `requirements.txt` and begin building.
5. In your Railway service settings:
   - Go to **Settings** → **Networking** → Click **Generate Domain**.
   - Your site is immediately live with HTTPS!

---

## 🐳 Option 3: Deploy with Docker (VPS / DigitalOcean / AWS)

If you prefer running inside a container:
```bash
# Build the Docker image
docker build -t personal-expense-tracker .

# Run container on port 5000
docker run -d -p 5000:5000 --name expense-tracker personal-expense-tracker
```
Visit `http://YOUR_SERVER_IP:5000`.

---

## 🔒 Production Architecture Checklist

- [x] **WSGI Production Server**: Configured with `gunicorn>=21.2.0`.
- [x] **Environment Bindings**: Dynamic `PORT` and `0.0.0.0` host binding.
- [x] **Process Definition**: `Procfile` configured for PaaS runners.
- [x] **Cache Control**: Anti-flash script and cache-busting headers configured.
- [x] **Blueprint Config**: `render.yaml` and `Dockerfile` provided for zero-config deployments.
