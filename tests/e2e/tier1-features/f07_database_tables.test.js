/**
 * Tier 1: Feature 7 — Core Database Tables (F7)
 * Specifications: T1-F07-01 through T1-F07-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 7 — Core Database Tables (F7)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T1-F07-01: Table profiles Structure & Foreign Key', () => {
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?profiles/i.test(sql), 'Must define profiles table');
    assert.ok(sql.includes('auth.users') || sql.includes('REFERENCES'), 'profiles must reference auth.users');
    assert.ok(/role\s+user_role/i.test(sql), 'profiles must have role column of type user_role');
  });

  test('T1-F07-02: Table equipments Uniqueness & Constraints', () => {
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?equipments/i.test(sql), 'Must define equipments table');
    assert.ok(sql.includes('patrimony_code') && sql.includes('UNIQUE'), 'patrimony_code must be unique');
    assert.ok(sql.includes('qr_token') && sql.includes('UNIQUE'), 'qr_token must be unique');
    assert.ok(/replacement_value\s+NUMERIC/i.test(sql), 'replacement_value must be numeric');
  });

  test('T1-F07-03: Table beneficiaries Brazilian Data & Mandatory Secondary Contact', () => {
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?beneficiaries/i.test(sql), 'Must define beneficiaries table');
    assert.ok(sql.includes('cpf'), 'beneficiaries must include cpf');
    assert.ok(sql.includes('secondary_contact_name') || sql.includes('secondary_name'), 'beneficiaries must include secondary contact name');
    assert.ok(sql.includes('secondary_contact_relationship') || sql.includes('secondary_relationship'), 'beneficiaries must include secondary relationship');
    assert.ok(sql.includes('secondary_contact_phone') || sql.includes('secondary_phone'), 'beneficiaries must include secondary phone');
  });

  test('T1-F07-04: Table loans Contract Schema', () => {
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?loans/i.test(sql), 'Must define loans table');
    assert.ok(sql.includes('equipment_id') && sql.includes('REFERENCES'), 'loans must reference equipment_id');
    assert.ok(sql.includes('beneficiary_id') && sql.includes('REFERENCES'), 'loans must reference beneficiary_id');
    assert.ok(sql.includes('expected_return_date'), 'loans must have expected_return_date');
    assert.ok(sql.includes('magic_token'), 'loans must have magic_token');
    assert.ok(sql.includes('renewal_count'), 'loans must have renewal_count');
  });

  test('T1-F07-05: Tables loan_events_log and maintenance_logs Audit Trail', () => {
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?loan_events_log/i.test(sql), 'Must define loan_events_log table');
    assert.ok(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?maintenance_logs/i.test(sql), 'Must define maintenance_logs table');
    assert.ok(sql.includes('event_type'), 'loan_events_log must include event_type');
    assert.ok(sql.includes('maintenance_type'), 'maintenance_logs must include maintenance_type');
  });
});
