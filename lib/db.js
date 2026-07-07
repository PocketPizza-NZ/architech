import { createPool } from '@vercel/postgres';

// Accept whichever connection string the Vercel storage integration injects.
// Classic Vercel Postgres → POSTGRES_URL; Neon/marketplace → DATABASE_URL.
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;

export const pool = createPool({ connectionString });
export const sql = pool.sql.bind(pool);
