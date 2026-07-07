import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import Stripe from 'stripe';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
});

const PRICES = {
  basic: process.env.STRIPE_PRICE_BASIC,
  engine: process.env.STRIPE_PRICE_ENGINE,
  command: process.env.STRIPE_PRICE_COMMAND,
};

async function ensureTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS leads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL, business TEXT NOT NULL, location TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT, channel TEXT, model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, customer_id TEXT, status TEXT, plan TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

async function upsertSub(id, customer, status, plan) {
  await pool.query(
    `INSERT INTO subscriptions (id, customer_id, status, plan, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (id) DO UPDATE
       SET status = EXCLUDED.status, customer_id = EXCLUDED.customer_id, updated_at = now()`,
    [id, customer || null, status || null, plan || null]
  );
}

const app = express();

// Stripe webhook needs the raw body for signature verification — register BEFORE express.json().
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.subscription) await upsertSub(s.subscription, s.customer, 'active', s.metadata?.plan);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const s = event.data.object;
      await upsertSub(s.id, s.customer, s.status, s.items?.data?.[0]?.price?.id);
    }
  } catch (err) {
    console.error('webhook handling error:', err);
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/lead', async (req, res) => {
  const { name, business, location, phone, email, channel, model } = req.body || {};
  if (!name || !business || !location || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await pool.query(
      `INSERT INTO leads (name, business, location, phone, email, channel, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [name, business, location, phone, email || null, channel || null, model || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('lead insert failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { plan } = req.body || {};
  const price = PRICES[plan];
  if (!price) return res.status(400).json({ error: 'Unknown plan' });
  const origin = req.headers.origin || `https://${req.headers.host}`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled#packages`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { plan },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
ensureTables()
  .catch((e) => console.error('table init skipped/failed (set DATABASE_URL):', e.message))
  .finally(() => app.listen(port, () => console.log(`Architech site listening on :${port}`)));
