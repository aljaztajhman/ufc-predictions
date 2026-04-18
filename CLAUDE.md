# UFC Predictions — Project Knowledge Base

> Auto-read by Claude at session start. Keep this up to date as the project evolves.

---

## What this app is

A subscription-gated UFC fight prediction web app. Claude AI analyses fighter stats and generates predictions with confidence scores. Users pay €0.50/month via Stripe (test price during development) or use a lifetime invite code. Only paying/invited users can view predictions.

**Live production URL:** https://ufc-predictions.vercel.app  
**Preview URL:** https://ufc-predictions-git-preview-aljaztajhmans-projects.vercel.app  
**GitHub:** https://github.com/aljaztajhman/ufc-predictions  
**Owner:** Aljaž (aljaztajhman97@gmail.com)

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Auth | NextAuth v5 (Auth.js beta) — JWT strategy |
| Database | Neon PostgreSQL (serverless) |
| Payments | Stripe (checkout + webhooks) |
| AI | Claude API (Anthropic) via `lib/claude.ts` |
| Styling | Tailwind CSS with custom font scale |
| Deployment | Vercel (main → production, preview → staging) |

---

## Git workflow

- **`main`** → production (Vercel auto-deploys)
- **`preview`** → staging (Vercel auto-deploys to preview URL)
- Develop new features on `preview`, merge to `main` when ready
- Both branches are currently in sync as of the last session

```
# Typical workflow
git checkout preview
# ... make changes ...
git add <files>
git commit -m "feat: ..."
git push origin preview
# test on preview URL, then:
git checkout main
git merge preview --ff-only
git push origin main
```

> **PowerShell note:** Does NOT support `&&` for command chaining. Run commands separately.

---

## Key architecture decisions

### Auth split (critical)
NextAuth v5 requires a split config for edge compatibility:
- `auth.config.ts` — edge-safe, used by middleware. Contains `authorized()` callback + `session()` callback that maps JWT token fields to `auth.user`
- `lib/auth.ts` — Node.js only, used by API routes. Full providers + DB queries

**The session callback in `auth.config.ts` is required** — without it, `auth.user.subscriptionStatus` is undefined in middleware and every user gets redirected to `/subscribe`.

### Stripe lazy init (critical)
```ts
// WRONG — crashes Next.js build
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { ... })

// CORRECT — lazy init inside handler
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  })
}
```

### Stripe API version
Must use `"2026-03-25.dahlia"` — older versions cause build errors with the installed stripe package. The `current_period_end` field may not be at the top level in this API version — always use defensive fallback:
```ts
const ts = (sub as any).current_period_end
  ?? (sub as any).items?.data?.[0]?.current_period_end;
// Fallback: 31 days from now if missing
if (!ts || isNaN(Number(ts))) {
  periodEnd = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
}
```

### Middleware — allowed routes
`auth.config.ts` `authorized()` must explicitly allow these without auth:
- `/api/stripe/**` — unauthenticated users need to hit checkout
- `/api/auth/**` — NextAuth itself
- `/api/cron/**` — cron jobs
- `/api/admin/**` — admin endpoints
- `/api/events/**` — public event data
- `/api/odds/**` — public odds data
- `/register`, `/login`, `/subscribe` — public pages

---

## Database schema (Neon PostgreSQL)

### users
```sql
id, username, email, password_hash, role,
subscription_status,        -- 'free' | 'active' | 'lifetime' | 'expired' | 'cancelled'
subscription_expires_at,    -- timestamp
stripe_subscription_id,     -- text
stripe_customer_id,         -- text (added manually, not in migration)
created_at
```

### invite_codes
```sql
id, code, created_by_id, used_by_id, used_at, created_at
```

### Subscription statuses
- `lifetime` — invite code users, never expires, bypass all payment checks
- `active` — paying Stripe subscriber
- `expired` / `cancelled` — lapsed, redirect to `/subscribe`
- `free` — default for new users not yet through payment

---

## Environment variables

Set in Vercel for both production and preview environments:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | Full URL of the deployment |
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` or `pk_live_...` |
| `STRIPE_PRICE_ID` | Price ID from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (NOT the endpoint ID `we_...`) |
| `NEXT_PUBLIC_APP_URL` | Full URL for redirect after Stripe checkout |
| `ANTHROPIC_API_KEY` | Claude API key |
| `CRON_SECRET` | `1a2b3c` (used to authenticate cron job calls) |

> **Webhook secret gotcha:** Copy the signing secret (`whsec_...`), NOT the webhook endpoint ID (`we_...`). They look similar but the endpoint ID will cause signature verification failures.

> **Vercel preview protection:** Stripe webhooks cannot reach Vercel preview URLs due to deployment protection. Always use the production URL for Stripe webhook configuration.

---

## Registration flow

Two paths on `/register`:

1. **Stripe path** → POST `/api/stripe/checkout` (mode: "register") → creates pending user in DB → redirects to Stripe Checkout → on success lands on `/register/success` → webhook fires `checkout.session.completed` → user activated
2. **Invite code path** → POST `/api/auth/register` → validates code atomically → creates active user with `lifetime` status

### Invite code race condition fix
Invite codes use atomic UPDATE to prevent double-use:
```sql
UPDATE invite_codes SET used_by_id = ${userId}, used_at = NOW()
WHERE code = ${code} AND used_by_id IS NULL
RETURNING id
```

---

## Tailwind font scale (custom)

Bumped above Tailwind defaults for WCAG readability:

```js
fontSize: {
  "2xs": ["12px", { lineHeight: "16px" }],
  xs:    ["14px", { lineHeight: "20px" }],   // was 12px
  sm:    ["16px", { lineHeight: "24px" }],   // was 14px
  base:  ["18px", { lineHeight: "28px" }],   // was 16px
  lg:    ["20px", { lineHeight: "28px" }],
  xl:    ["24px", { lineHeight: "32px" }],
  "2xl": ["28px", { lineHeight: "36px" }],
  "3xl": ["32px", { lineHeight: "40px" }],
  "4xl": ["40px", { lineHeight: "48px" }],
  "5xl": ["52px", { lineHeight: "1" }],
  "6xl": ["64px", { lineHeight: "1" }],
}
```

## WCAG contrast rules (dark UI #0D0F18 background)

| Usage | Minimum opacity | Contrast ratio |
|---|---|---|
| Body / primary text | `text-white` or `/80+` | >7:1 (AAA) |
| Secondary / labels | `text-white/65` | ~5.5:1 (AA) |
| Muted / captions | `text-white/60` | ~4.8:1 (AA) |
| Disabled / decorative | `text-white/40` | ~3:1 (allowed) |

Never use `text-white/50` or below for readable content. Never use `text-[10px]` — use `text-xs` (14px) minimum.

---

## Key files map

```
app/
  page.tsx                    — Home, event list
  login/page.tsx              — Login with Suspense wrapper for useSearchParams
  register/page.tsx           — Two-path gate: Stripe or invite code
  register/success/page.tsx   — Post-Stripe landing, 5s countdown to /login
  subscribe/page.tsx          — Subscription wall for expired/cancelled users
  event/[eventId]/page.tsx    — Event detail with fights
  api/
    stripe/
      checkout/route.ts       — Creates checkout session (register or renew mode)
      webhook/route.ts        — Handles Stripe events, activates users
    auth/
      register/route.ts       — Invite code registration
      [...nextauth]/route.ts  — NextAuth handler
    admin/
      invite-codes/route.ts   — CRUD for invite codes
    cron/
      refresh/route.ts        — Refreshes fight data from UFCStats
auth.config.ts                — Edge-safe auth config (middleware + session callback)
lib/
  auth.ts                     — Full NextAuth config (Node.js)
  db.ts                       — Neon DB client
  claude.ts                   — Claude AI prediction generation
  ufcstats.ts                 — UFCStats scraper
  signals.ts                  — Betting signals logic
components/
  event/FightCard.tsx         — Individual fight display with fighter stats
  prediction/PredictionPanel.tsx — AI prediction display
  home/EventCard.tsx          — Event list card
  slip/                       — Bet slip components (accumulator)
  ui/
    Navbar.tsx
    UserMenu.tsx              — Shows subscription badge (Lifetime/Active/Admin)
tailwind.config.js            — Custom font scale + UFC color palette
```

---

## Current subscription pricing

**€0.50/month** (test price during development — change before production launch)

Update in:
- `app/register/page.tsx` (two places)
- `app/subscribe/page.tsx`
- Stripe dashboard (the actual price object)

---

## Known gotchas / lessons learned

1. **Never init Stripe at module scope** — use a `getStripe()` lazy function
2. **auth.config.ts needs its own session callback** — middleware can't read JWT fields without it
3. **Webhook secret is `whsec_...`** not the endpoint ID `we_...`
4. **Stripe preview URLs are blocked** — webhooks must point to production
5. **PowerShell doesn't support `&&`** — run commands one at a time
6. **`stripe_customer_id` column** was added manually via Neon SQL, not in the migration script — if you recreate the DB, add it
7. **File truncation risk** — large file edits can silently truncate. After bulk edits, always run `npx tsc --noEmit` to catch broken files early

---

## Scripts

```bash
# Type check (fast, no build needed)
npx tsc --noEmit

# Lint
npx next lint

# DB migrations
node scripts/migrate-invite-subscriptions.mjs

# Cron test (PowerShell)
Invoke-WebRequest -Uri "https://ufc-predictions.vercel.app/api/cron/refresh" `
  -Headers @{ "x-cron-secret" = "1a2b3c" }
```

---

## What's working (as of last session)

- [x] Stripe registration + webhook activation
- [x] Invite code registration (lifetime)
- [x] Subscription enforcement in middleware
- [x] Admin invite code management
- [x] UFC event + fight data (UFCStats scraper)
- [x] Claude AI predictions with confidence rings
- [x] Bet slip / accumulator
- [x] WCAG AA contrast across all screens
- [x] Bumped font scale (xs=14px baseline)

## Pending / ideas for next features

- [ ] Change price from €0.50 to real price before launch
- [ ] Email notifications (subscription confirmation, upcoming events)
- [ ] User profile / subscription management page
- [ ] More fighter stats and historical data
- [ ] Push notifications for fight results
- [ ] Admin dashboard for monitoring subscriptions
