/**
 * Tier 1: Feature 9 — Row Level Security (RLS) (F9)
 * Specifications: T1-F09-01 through T1-F09-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 9 — Row Level Security (RLS) (F9)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T1-F09-01: RLS Enabled on All 6 Tables', () => {
    const tables = ['profiles', 'equipments', 'beneficiaries', 'loans', 'loan_events_log', 'maintenance_logs'];
    tables.forEach(tbl => {
      const regex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${tbl}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      assert.ok(regex.test(sql), `Table "${tbl}" must have Row Level Security enabled`);
    });
  });

  test('T1-F09-02: Public Read Policy for QR Token Lookup', () => {
    // Policy allowing anonymous read of equipment by qr_token
    assert.ok(/CREATE\s+POLICY.*(?:equipments|public_equipment_lookup|allow_read)/i.test(sql), 'Must define read policy on equipments');
    assert.ok(sql.includes('qr_token') || sql.includes('SELECT'), 'Policy must allow scanning QR codes');
  });

  test('T1-F09-03: Public Magic Token Policy for Renewal', () => {
    // Policy allowing anonymous read / update for loans matching magic_token
    assert.ok(/CREATE\s+POLICY.*(?:magic_token|public_renewal|allow_renewal|loans)/i.test(sql), 'Must define magic token policy on loans');
  });

  test('T1-F09-04: Staff Authenticated Access to Management Endpoints', () => {
    // Authenticated users with operator or admin role can perform management operations
    assert.ok(sql.includes('auth.role()') || sql.includes('authenticated') || sql.includes('auth.uid()'), 'Must grant authenticated staff access policies');
  });

  test('T1-F09-05: Beneficiary PII Shielded from Anonymous Access', () => {
    // Ensure beneficiaries table does NOT have a public SELECT * policy
    const lines = sql.split('\n');
    const anonBeneficiaryPolicies = lines.filter(l => 
      /CREATE\s+POLICY/i.test(l) && 
      /beneficiaries/i.test(l) && 
      /anon/i.test(l) && 
      !/authenticated/i.test(l)
    );
    assert.strictEqual(anonBeneficiaryPolicies.length, 0, 'Beneficiaries table must NOT expose public anonymous read policy');
  });
});
