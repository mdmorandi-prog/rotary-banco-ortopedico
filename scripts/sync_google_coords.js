const { Pool } = require('pg');
const fs = require('fs');

const envText = fs.readFileSync('C:/Users/daniel.morandi/.gemini/antigravity/scratch/rotary-banco-ortopedico/.env.local', 'utf-8');
const match = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

async function main() {
  // Update with exact Google Maps ROOFTOP coordinates: -29.2226748, -51.3145353
  const resLoan = await pool.query(`
    UPDATE rotary.loans
    SET lat = -29.222675, lng = -51.314535
    WHERE id = 'loan-1794423744558-657'
    RETURNING id, loan_code, lat, lng;
  `);
  console.log("Updated loan in Neon DB:", resLoan.rows);

  const resBen = await pool.query(`
    UPDATE rotary.beneficiaries
    SET lat = -29.222675, lng = -51.314535
    WHERE id IN (SELECT beneficiary_id FROM rotary.loans WHERE id = 'loan-1794423744558-657')
    RETURNING id, full_name, lat, lng;
  `);
  console.log("Updated beneficiary in Neon DB:", resBen.rows);

  await pool.end();
}

main().catch(console.error);

