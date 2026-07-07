import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map front-end plan slugs -> Stripe recurring Price IDs (set in Vercel env).
const PRICES = {
  basic: process.env.STRIPE_PRICE_BASIC,
  engine: process.env.STRIPE_PRICE_ENGINE,
  command: process.env.STRIPE_PRICE_COMMAND,
};

// POST /api/checkout — creates a Stripe subscription Checkout session.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
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
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout session failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
