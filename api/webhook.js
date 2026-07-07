import Stripe from 'stripe';
import { sql } from '@vercel/postgres';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw, unparsed body to verify the signature.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upsertSubscription({ id, customer, status, plan }) {
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id            TEXT PRIMARY KEY,
      customer_id   TEXT,
      status        TEXT,
      plan          TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    INSERT INTO subscriptions (id, customer_id, status, plan, updated_at)
    VALUES (${id}, ${customer || null}, ${status || null}, ${plan || null}, now())
    ON CONFLICT (id) DO UPDATE
      SET status = EXCLUDED.status, customer_id = EXCLUDED.customer_id, updated_at = now()`;
}

// POST /api/webhook — verifies and records Stripe subscription events.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.subscription) {
          await upsertSubscription({
            id: s.subscription,
            customer: s.customer,
            status: 'active',
            plan: s.metadata?.plan,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const s = event.data.object;
        await upsertSubscription({
          id: s.id,
          customer: s.customer,
          status: s.status,
          plan: s.items?.data?.[0]?.price?.id,
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('webhook handling error:', err);
  }

  return res.status(200).json({ received: true });
}
