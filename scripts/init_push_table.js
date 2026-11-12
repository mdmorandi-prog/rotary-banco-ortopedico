const { Pool } = require('pg');
const fs = require('fs');

const envText = fs.readFileSync('C:/Users/daniel.morandi/.gemini/antigravity/scratch/rotary-banco-ortopedico/.env.local', 'utf-8');
const match = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rotary.push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Created rotary.push_subscriptions table in PostgreSQL successfully!");
  await pool.end();
}

main().catch(console.error);
