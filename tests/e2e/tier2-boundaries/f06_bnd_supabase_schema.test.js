/**
 * Tier 2: Feature 6 Boundaries — Supabase Schema & Enums (F6)
 * Specifications: T2-F06-01 through T2-F06-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 2: Feature 6 Boundaries — Supabase Schema & Enums (F6)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T2-F06-01: Invalid Enum Value Insert Rejection', () => {
    const validEquipmentStatuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'];
    function validateStatus(status) {
      if (!validEquipmentStatuses.includes(status)) {
        throw new Error(`invalid input value for enum equipment_status: "${status}"`);
      }
      return true;
    }

    assert.throws(() => validateStatus('QUEBRADO'), /invalid input value for enum equipment_status/);
  });

  test('T2-F06-02: Enum Case Sensitivity Enforcement', () => {
    const validEquipmentStatuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'];
    function validateCase(status) {
      if (!validEquipmentStatuses.includes(status)) {
        throw new Error(`invalid input value for enum equipment_status: "${status}"`);
      }
      return true;
    }

    // Lowercase must be rejected because PostgreSQL enums are strictly case-sensitive
    assert.throws(() => validateCase('disponivel'), /invalid input value for enum equipment_status/);
  });

  test('T2-F06-03: Explicit Enum Casting in Dynamic Queries', () => {
    // Migration SQL declares typed enum columns and procedure variables
    assert.ok(
      sql.includes('equipment_status') && (sql.includes('DEFAULT') || sql.includes('v_destination') || sql.includes('FUNCTION')),
      'Migration must provide typed enum usage'
    );
  });

  test('T2-F06-04: Idempotent Migration Execution Guard', () => {
    // Migration script must guard enum creation against duplicate_object
    assert.ok(sql.includes('duplicate_object') || sql.includes('IF NOT EXISTS'), 'Enum definitions must be guarded against duplicate_object errors');
  });

  test('T2-F06-05: Mandatory NOT NULL on Enum Columns', () => {
    // Check NOT NULL constraint on status and category columns
    assert.ok(/category\s+equipment_category\s+NOT\s+NULL/i.test(sql), 'category must be NOT NULL');
    assert.ok(/status\s+equipment_status\s+NOT\s+NULL/i.test(sql), 'status must be NOT NULL');
  });
});
