# Deploy to Vercel (FeedFocus)

## 1) Create Vercel project

1. Create an account on Vercel.
2. Connect GitHub.
3. Import the repository.
4. In **Root Directory**, set `feedfocus`.

## 2) Set build settings

Vercel should auto-detect Next.js.

- Build Command: `npm run build`
- Output Directory: (leave default)
- Install Command: `npm install`

## 3) Configure environment variables

In Vercel → Project → Settings → Environment Variables, add variables from:

- `feedfocus/.env.production.example`

Minimum required for the MVP flow:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `TELEGRAM_BOT_TOKEN` (required for Telegram mini-app auth)

Recommended:

- `DAILY_ANALYZE_LIMIT=30`
- `MAX_FEEDBACK_ITEMS=50`
- `RETENTION_DAYS=30`
- `NEXT_PUBLIC_MAX_FEEDBACK_ITEMS=50`

Optional:

- `CRON_SECRET` (to enable `GET /api/cron/purge?secret=...`)

## 4) Deploy

Trigger a deploy (push to main or click Deploy in Vercel).

## 5) Verify

After deploy, open:

- `/api/health` → should return `{ "status": "ok" }`

Then test the UI flow (Telegram mini-app):

1. Open `/`
2. Paste 5–20 lines of feedback
3. Click **Анализировать**
4. Open results and hypotheses pages
5. Open `/dashboard`

If you want browser-only public testing (no Telegram):

- Do **not** set `TELEGRAM_BOT_TOKEN`
- Set `DEV_TELEGRAM_USER_ID` (all testers will share this demo user)

## Notes (security / MVP)

- `SUPABASE_SERVICE_ROLE_KEY` must be server-only (Vercel env var is fine). Do not expose it to the browser.
- This MVP stores raw feedback text for 30 days (see `RETENTION_DAYS`).
