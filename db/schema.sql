-- Architech schema. The API creates these on first use, but you can run this
-- once from Vercel > Storage > your DB > Query to provision up front.

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
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT PRIMARY KEY,          -- Stripe subscription id
  customer_id TEXT,
  status      TEXT,
  plan        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
