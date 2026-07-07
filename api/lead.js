import { sql } from '../lib/db.js';

// POST /api/lead — stores an intake submission in Postgres.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { name, business, location, phone, email, channel, model } = req.body || {};
  if (!name || !business || !location || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name        TEXT NOT NULL,
        business    TEXT NOT NULL,
        location    TEXT NOT NULL,
        phone       TEXT NOT NULL,
        email       TEXT,
        channel     TEXT,
        model       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      INSERT INTO leads (name, business, location, phone, email, channel, model)
      VALUES (${name}, ${business}, ${location}, ${phone}, ${email || null}, ${channel || null}, ${model || null})`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('lead insert failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
