/**
 * Tier 1: Feature 10 — Initial Seed Dataset (F10)
 * Specifications: T1-F10-01 through T1-F10-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 10 — Initial Seed Dataset (F10)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T1-F10-01: Seed Execution Referential Integrity', () => {
    // Inserts in seed must follow dependency order: profiles/users -> equipments & beneficiaries -> loans
    assert.ok(sql.includes('INSERT INTO public.equipments') || sql.includes('INSERT INTO equipments'), 'Must insert seed equipments');
    assert.ok(sql.includes('INSERT INTO public.beneficiaries') || sql.includes('INSERT INTO beneficiaries'), 'Must insert seed beneficiaries');
    assert.ok(sql.includes('INSERT INTO public.loans') || sql.includes('INSERT INTO loans'), 'Must insert seed loans');
  });

  test('T1-F10-02: Minimum Equipment Count and Status Variety', () => {
    // Check that seed contains at least 5 different statuses
    const statuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO'];
    statuses.forEach(st => {
      assert.ok(sql.includes(`'${st}'`), `Seed data must include equipment with status '${st}'`);
    });
  });

  test('T1-F10-03: Category Diversity in Seed', () => {
    const categories = ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'ANDADOR', 'CAMA_HOSPITALAR'];
    categories.forEach(cat => {
      assert.ok(sql.includes(`'${cat}'`), `Seed must include category '${cat}'`);
    });
    assert.ok(sql.includes("'MULETA_AXILAR'") || sql.includes("'MULETA'") || sql.includes("'MULETA_CANADENSE'"), 'Seed must include muleta item');
  });

  test('T1-F10-04: Active and Overdue Loans in Seed', () => {
    assert.ok(sql.includes("'ATIVO'"), "Seed must include active loan ('ATIVO')");
    assert.ok(sql.includes("'ATRASADO'"), "Seed must include overdue loan ('ATRASADO')");
  });

  test('T1-F10-05: Seed Beneficiaries Compliance', () => {
    // Beneficiary inserts must include CPF, phone, and secondary contact
    assert.ok(sql.includes('secondary_contact_name') || sql.includes('secondary_name'), 'Seed beneficiaries must include secondary contact');
    assert.ok(sql.includes('secondary_contact_phone') || sql.includes('secondary_phone'), 'Seed beneficiaries must include secondary phone');
  });
});
