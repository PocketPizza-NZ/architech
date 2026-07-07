# Architech Site

Static marketing front-end + Vercel serverless API.

```
architech-site/
├── public/
│   ├── index.html                  # the site (Tailwind CDN, vanilla JS)
│   └── Hero Strengths Animation.mp4 # ← copy this asset in (see step 1)
├── api/
│   ├── lead.js       # POST /api/lead      → inserts intake form into Postgres
│   ├── checkout.js   # POST /api/checkout  → creates a Stripe subscription session
│   └── webhook.js    # POST /api/webhook   → verifies Stripe events, records subs
├── db/schema.sql
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

No build step — Vercel serves `public/` as static and `api/` as Node functions.

## 1. Add the hero video
Copy `Hero Strengths Animation.mp4` into `public/` (the front-end references it by that name). It lives at `Architech/Hero Strengths Animation.mp4`.

## 2. Create the GitHub repo & push
```bash
cd architech-site
git init
git add .
git commit -m "Architech site: static front-end + lead/checkout/webhook API"
gh repo create architech-site --private --source=. --remote=origin --push
# or create an empty repo in the GitHub UI, then:
# git remote add origin git@github.com:<you>/architech-site.git && git push -u origin main
```

## 3. Create the Vercel project (auto-deploy on push)
1. Vercel → **Add New → Project → Import** your `architech-site` repo.
2. Framework preset: **Other**. Root dir: `./`. Deploy.
3. Every `git push` to the default branch now auto-deploys.

## 4. Attach Vercel Postgres
1. Vercel project → **Storage → Create Database → Postgres** → connect it to the project.
2. This auto-injects `POSTGRES_URL` (and friends) into the project's env vars.
3. Optional: run `db/schema.sql` from **Storage → your DB → Query** (the API also auto-creates tables on first call).

## 5. Add Stripe
1. Stripe Dashboard → **Products** → create the three plans as **recurring/monthly** prices; copy each Price ID.
2. Vercel project → **Settings → Environment Variables**, add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_ENGINE`, `STRIPE_PRICE_COMMAND`
   - `STRIPE_WEBHOOK_SECRET` (from step 3 below)
3. Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-domain>/api/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.

## Front-end behaviour
- **Intake form** → `POST /api/lead` (falls through to the booking UI even if the API is down, so the page never dead-ends).
- **Package buttons** → `POST /api/checkout` then redirect to Stripe. If billing isn't configured yet, they gracefully fall back to the intake form.

## Local dev
```bash
npm i
npm i -g vercel
vercel dev        # pulls env from the linked project; serves public/ + api/
```
