# Architech Site

Express server that serves the static front-end and three API routes. Deploys to Railway.

```
architech-site/
├── public/
│   ├── index.html                   # the site (Tailwind CDN, vanilla JS)
│   └── Hero Strengths Animation.mp4  # hero video
├── server.js        # Express: static + /api/lead, /api/checkout, /api/webhook
├── db/schema.sql    # optional — server.js also auto-creates tables on boot
├── package.json     # start: node server.js
├── Procfile         # web: npm start
├── .env.example
└── .gitignore
```

Routes: `POST /api/lead` (→ Postgres), `POST /api/checkout` (→ Stripe subscription session),
`POST /api/webhook` (verifies Stripe events → Postgres), `GET /health`.

> Legacy: `api/`, `lib/`, and `vercel.json` are leftovers from the Vercel version and are
> unused on Railway. Safe to delete for a clean repo.

## Deploy to Railway
1. **railway.app → New Project → Deploy from GitHub repo** → pick `PocketPizza-NZ/architech`.
   Railway auto-detects Node, runs `npm install`, then `npm start`.
2. **Add Postgres:** in the project, **New → Database → Add PostgreSQL**.
3. **Wire the DB:** open the app service → **Variables** → **New Variable → Add Reference →**
   select the Postgres service's `DATABASE_URL`. (Same-project services connect over the
   private network — no `sslmode` needed.)
4. **Add Stripe variables** (app service → Variables):
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_ENGINE`, `STRIPE_PRICE_COMMAND`,
   and `STRIPE_WEBHOOK_SECRET` (from step 6).
5. **Generate a domain:** app service → **Settings → Networking → Generate Domain**.
6. **Stripe webhook:** Stripe → Developers → Webhooks → Add endpoint
   `https://<your-railway-domain>/api/webhook`, events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret
   into `STRIPE_WEBHOOK_SECRET` and redeploy.

Every push to the default branch auto-deploys.

## Stripe products
Create three **recurring / monthly** prices under Stripe → Products and copy each Price ID
into the matching `STRIPE_PRICE_*` variable.

## Local dev
```bash
npm install
cp .env.example .env    # fill in DATABASE_URL + Stripe keys
npm start               # http://localhost:3000
```

## Front-end behaviour
- Intake form → `POST /api/lead`; falls through to the booking UI even if the API is down.
- Package buttons → `POST /api/checkout` then redirect to Stripe; fall back to the intake
  form if billing isn't configured yet.
