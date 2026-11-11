const { Pool } = require('pg');
const fs = require('fs');

const envText = fs.readFileSync('C:/Users/daniel.morandi/.gemini/antigravity/scratch/rotary-banco-ortopedico/.env.local', 'utf-8');
const match = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

async function main() {
  // Update Daniel Morandi's loan with exact Rua Jose Maioli 715 coordinates
  const res = await pool.query(`
    UPDATE rotary.loans
    SET lat = -29.218270, lng = -51.314719
    WHERE id = 'loan-1794423744558-657'
    RETURNING id, loan_code, lat, lng;
  `);
  console.log("Updated loan:", res.rows);

  const resBen = await pool.query(`
    UPDATE rotary.beneficiaries
    SET lat = -29.218270, lng = -51.314719
    WHERE id IN (SELECT beneficiary_id FROM rotary.loans WHERE id = 'loan-1794423744558-657')
    RETURNING id, full_name, lat, lng;
  `);
  console.log("Updated beneficiary:", resBen.rows);

  await pool.end();
}

main().catch(console.error);

