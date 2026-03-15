# UFC Predictions — Deployment Guide

End-to-end steps to go from local code to a live Vercel URL.

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/) installed locally
- [Git](https://git-scm.com/) installed
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free tier works)
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

---

## Step 1 — Install dependencies locally

```bash
cd "ufc-predictions"
npm install
```

---

## Step 2 — Set up local environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your `ANTHROPIC_API_KEY`. Leave the KV fields empty for now — the app will use in-memory caching locally.

---

## Step 3 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see upcoming events. Click any event, expand a fight, and click **Generate AI Prediction** to test the full flow.

---

## Step 4 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: UFC Predictions app"

# Create a new repo on GitHub (via github.com or gh CLI):
gh repo create ufc-predictions --public --push --source .

# OR if you already created the repo:
git remote add origin https://github.com/YOUR_USERNAME/ufc-predictions.git
git push -u origin main
```

---

## Step 5 — Deploy to Vercel

### Option A — Vercel Dashboard (recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** → select your `ufc-predictions` repo
3. Framework will auto-detect as **Next.js** ✓
4. Click **"Environment Variables"** before deploying:

   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |

5. Click **Deploy** — first build takes ~60 seconds

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

Follow the prompts. When asked for environment variables, add `ANTHROPIC_API_KEY`.

---

## Step 6 — Set up Vercel KV (optional but recommended for production)

Without KV, predictions are cached in-memory per serverless function instance (they reset on cold starts). With KV, predictions are truly permanent and consistent across all instances.

1. In your Vercel project dashboard → **Storage** tab → **Create Database**
2. Select **KV** (Redis) → choose a region close to your users → **Create**
3. In the KV store page, click **"Connect to Project"** → select your UFC Predictions project
4. Vercel automatically adds these env vars to your project:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
5. Redeploy to pick up the new env vars:

```bash
vercel --prod
# or just push a commit to trigger auto-deploy
```

---

## Step 7 — Verify production

Open your live URL and:

- [ ] Home page loads with upcoming events
- [ ] Click an event → fight card loads with all sections
- [ ] Expand a fight → stats comparison bars animate in
- [ ] Click "Generate AI Prediction" → spinner shows → prediction renders with confidence ring
- [ ] Refresh the page, expand the same fight → prediction loads instantly from cache (no AI call)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API key from console.anthropic.com |
| `KV_REST_API_URL` | ⚡ Recommended | Vercel KV REST endpoint URL |
| `KV_REST_API_TOKEN` | ⚡ Recommended | Vercel KV authentication token |

---

## Troubleshooting

**"ANTHROPIC_API_KEY is not configured"** — Add the env var in Vercel dashboard → Settings → Environment Variables, then redeploy.

**Events show mock data** — The ESPN MMA API may be rate-limiting or the format changed. Mock data is returned automatically as a fallback — the app stays functional.

**Prediction fails with JSON parse error** — Claude occasionally returns a preamble before JSON. The parser strips markdown fences but edge cases exist. Try regenerating; if persistent, check the Claude API logs.

**Build error: `Cannot find module '@vercel/kv'`** — Run `npm install` again. The `@vercel/kv` package is dynamically imported so it won't crash if KV isn't configured.
