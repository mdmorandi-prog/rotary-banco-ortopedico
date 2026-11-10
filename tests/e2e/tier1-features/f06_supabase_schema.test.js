/**
 * Tier 1: Feature 6 — Supabase Schema & Enums (F6)
 * Specifications: T1-F06-01 through T1-F06-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 6 — Supabase Schema & Enums (F6)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    assert.ok(fs.existsSync(sqlPath), 'Migration 001_initial_schema.sql must exist');
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T1-F06-01: PostgreSQL Enum user_role Definition', () => {
    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?user_role\s+AS\s+ENUM/i.test(sql), 'Must define user_role enum');
    ['admin', 'operator', 'volunteer'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `user_role must include '${val}'`);
    });
  });

  test('T1-F06-02: PostgreSQL Enum equipment_category Definition', () => {
    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?equipment_category\s+AS\s+ENUM/i.test(sql), 'Must define equipment_category enum');
    ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'ANDADOR', 'CAMA_HOSPITALAR', 'OUTROS'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `equipment_category must include '${val}'`);
    });
    assert.ok(sql.includes("'MULETA_AXILAR'") || sql.includes("'MULETA'"), 'Must include muleta category');
  });

  test('T1-F06-03: PostgreSQL Enum equipment_status Definition', () => {
    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?equipment_status\s+AS\s+ENUM/i.test(sql), 'Must define equipment_status enum');
    ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `equipment_status must include '${val}'`);
    });
  });

  test('T1-F06-04: PostgreSQL Enum equipment_condition Definition', () => {
    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?equipment_condition\s+AS\s+ENUM/i.test(sql), 'Must define equipment_condition enum');
    ['NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `equipment_condition must include '${val}'`);
    });
    assert.ok(sql.includes("'SUCATEADO'") || sql.includes("'SUCATA'"), 'Must include scrapped condition');
  });

  test('T1-F06-05: PostgreSQL Enums loan_status and close_reason Definitions', () => {
    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?loan_status\s+AS\s+ENUM/i.test(sql), 'Must define loan_status enum');
    ['ATIVO', 'ATRASADO', 'DEVOLVIDO'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `loan_status must include '${val}'`);
    });

    assert.ok(/CREATE\s+TYPE\s+(?:public\.)?close_reason\s+AS\s+ENUM/i.test(sql), 'Must define close_reason enum');
    ['RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA'].forEach(val => {
      assert.ok(sql.includes(`'${val}'`), `close_reason must include '${val}'`);
    });
  });
});
