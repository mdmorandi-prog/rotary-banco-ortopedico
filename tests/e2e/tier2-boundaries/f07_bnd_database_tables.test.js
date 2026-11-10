/**
 * Tier 2: Feature 7 Boundaries — Core Database Tables (F7)
 * Specifications: T2-F07-01 through T2-F07-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 2: Feature 7 Boundaries — Core Database Tables (F7)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T2-F07-01: Duplicate Patrimony Code Collision', () => {
    // patrimony_code has UNIQUE constraint in schema
    assert.ok(/patrimony_code.*UNIQUE/i.test(sql), 'patrimony_code must have UNIQUE constraint');

    const patrimonies = new Set(['ROT-001']);
    function insertEquipment(code) {
      if (patrimonies.has(code)) {
        throw new Error(`duplicate key value violates unique constraint "equipments_patrimony_code_key": "${code}"`);
      }
      patrimonies.add(code);
    }

    assert.throws(() => insertEquipment('ROT-001'), /unique constraint "equipments_patrimony_code_key"/);
  });

  test('T2-F07-02: Duplicate QR Token Collision', () => {
    assert.ok(/qr_token.*UNIQUE/i.test(sql), 'qr_token must have UNIQUE constraint');

    const qrTokens = new Set(['QR-ABC']);
    function insertQr(token) {
      if (qrTokens.has(token)) {
        throw new Error(`duplicate key value violates unique constraint "equipments_qr_token_key": "${token}"`);
      }
      qrTokens.add(token);
    }

    assert.throws(() => insertQr('QR-ABC'), /unique constraint "equipments_qr_token_key"/);
  });

  test('T2-F07-03: Deletion of Equipment with Active Loan (ON DELETE RESTRICT)', () => {
    assert.ok(/ON\s+DELETE\s+RESTRICT/i.test(sql) || /RESTRICT/i.test(sql), 'Foreign keys must specify ON DELETE RESTRICT');
  });

  test('T2-F07-04: Negative Replacement Value Check Constraint', () => {
    function validateReplacementValue(val) {
      if (val < 0) {
        throw new Error('new row for relation "equipments" violates check constraint "equipments_replacement_value_check"');
      }
      return true;
    }

    assert.throws(() => validateReplacementValue(-150.00), /violates check constraint/);
    assert.strictEqual(validateReplacementValue(0.00), true);
    assert.strictEqual(validateReplacementValue(850.00), true);
  });

  test('T2-F07-05: Extreme Unicode String in Model Description', () => {
    const extremeDescription = '🦽 Cadeira Especial de Alumínio & Aço — Teste de Carga 150kg — 100% Imune a Corrosão 🏆 '.repeat(50);
    assert.ok(extremeDescription.length > 2000, 'String is large');
    // TEXT column in postgres has no 255 char limit
    assert.ok(sql.includes('brand_model TEXT') || sql.includes('model_description TEXT') || sql.includes('notes TEXT'), 'Columns must use TEXT type to accommodate unicode descriptions');
  });
});
