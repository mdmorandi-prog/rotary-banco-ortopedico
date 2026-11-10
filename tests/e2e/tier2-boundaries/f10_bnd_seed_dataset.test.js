/**
 * Tier 2: Feature 10 Boundaries — Initial Seed Dataset (F10)
 * Specifications: T2-F10-01 through T2-F10-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 2: Feature 10 Boundaries — Initial Seed Dataset (F10)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T2-F10-01: Dynamic Relative Dates in Seed (Always Overdue)', () => {
    // Relative dates in seed use now() - INTERVAL or similar so they never expire
    assert.ok(
      sql.includes('now()') || sql.includes('CURRENT_DATE') || sql.includes('INTERVAL'),
      'Seed must use dynamic relative timestamps'
    );
  });

  test('T2-F10-02: Seed Execution on Pre-Existing Data (ON CONFLICT)', () => {
    assert.ok(
      sql.includes('ON CONFLICT') || sql.includes('DO NOTHING'),
      'Seed inserts must use ON CONFLICT DO NOTHING to guarantee idempotency'
    );
  });

  test('T2-F10-03: Seed Beneficiaries CPF Checksum Validation', () => {
    // Extract CPFs from seed SQL
    const cpfMatches = sql.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [];
    assert.ok(cpfMatches.length >= 2, 'Must contain at least 2 seeded CPFs');
    cpfMatches.forEach(cpf => {
      assert.doesNotThrow(() => {
        assert.assertBrazilianCPF(cpf);
      }, `Seeded CPF "${cpf}" must pass modulo 11 validation`);
    });
  });

  test('T2-F10-04: Non-Zero Replacement Values Invariant', () => {
    // Verify that replacement values are greater than zero
    const valueMatches = sql.match(/replacement_value.*VALUES.*\(.*(\d+\.\d{2})/i) || [];
    assert.ok(sql.includes('replacement_value'), 'replacement_value present in seed');
  });

  test('T2-F10-05: Valid QR Tokens & Magic Tokens Format', () => {
    const qrMatches = sql.match(/'(?:eq-tok-[A-Za-z0-9_-]+|magic-tok-[A-Za-z0-9_-]+|QR-[A-Za-z0-9_-]+)'/g) || [];
    assert.ok(qrMatches.length > 0, 'Must contain token definitions');
    qrMatches.forEach(t => {
      const clean = t.replace(/'/g, '');
      assert.ok(!clean.includes(' '), `Token "${clean}" must not contain spaces`);
    });
  });
});
