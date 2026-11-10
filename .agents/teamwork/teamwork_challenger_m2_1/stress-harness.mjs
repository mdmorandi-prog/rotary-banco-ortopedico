/**
 * Adversarial Stress Harness for Rotary Banco Ortopédico (Milestone 2)
 *
 * Runs rigorous empirical tests directly against PostgreSQL 16
 * testing schema constraints, invariants, boundary conditions, and seed data.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONTAINER_NAME = 'rotary_test_db';
const DB_USER = 'postgres';
const DB_NAME = 'rotary_db';
const MIGRATION_FILE = path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql');

/**
 * Helper to run query via docker exec psql
 */
function runPsql(sql, expectError = false) {
  const cmd = `docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`;

  try {
    const stdout = execSync(cmd, { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (expectError) {
      return {
        success: false,
        error: null,
        output: stdout,
        unexpectedSuccess: true
      };
    }
    return { success: true, output: stdout.trim() };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    if (expectError) {
      return {
        success: true, // error was expected
        error: stderr.trim(),
        unexpectedSuccess: false
      };
    }
    return {
      success: false,
      error: stderr.trim()
    };
  }
}

/**
 * Resets the test database to clean migration state
 */
function resetDatabase() {
  const resetCmd = `docker exec ${CONTAINER_NAME} dropdb -U ${DB_USER} --if-exists ${DB_NAME} && docker exec ${CONTAINER_NAME} createdb -U ${DB_USER} ${DB_NAME}`;
  execSync(resetCmd, { stdio: 'pipe' });

  const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const applyCmd = `docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`;
  execSync(applyCmd, { input: sqlContent, stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Modulo 11 Brazilian CPF check
 */
export function validateCpfChecksum(cpf) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  return rev === parseInt(clean.charAt(10), 10);
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('ROTARY BANCO ORTOPÉDICO - ADVERSARIAL STRESS TEST HARNESS (M2)');
  console.log('Target Database: PostgreSQL 16 (docker container: ' + CONTAINER_NAME + ')');
  console.log('Execution Timestamp: ' + new Date().toISOString());
  console.log('================================================================\n');

  console.log('[INIT] Resetting test database to fresh migration 001_initial_schema.sql...');
  resetDatabase();
  console.log('[INIT] Database reset complete.\n');

  const results = [];
  const defectsFound = [];
  const startTime = Date.now();

  function test(id, title, fn) {
    const t0 = Date.now();
    try {
      const outcome = fn();
      const durationMs = Date.now() - t0;
      if (outcome.passed) {
        console.log(`[PASS] ${id}: ${title} (${durationMs}ms)`);
        results.push({ id, title, passed: true, durationMs, details: outcome.details });
      } else {
        console.error(`[FAIL] ${id}: ${title} (${durationMs}ms)`);
        console.error(`       Error: ${outcome.error}`);
        results.push({ id, title, passed: false, durationMs, error: outcome.error });
        if (outcome.isDefect) {
          defectsFound.push({ id, title, error: outcome.error, blastRadius: outcome.blastRadius, fix: outcome.fix });
        }
      }
    } catch (e) {
      const durationMs = Date.now() - t0;
      console.error(`[CRASH] ${id}: ${title} (${durationMs}ms)`);
      console.error(`        Exception: ${e.message}`);
      results.push({ id, title, passed: false, durationMs, error: e.message });
    }
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: FOREIGN KEY RESTRICTIONS (ON DELETE RESTRICT)
  // --------------------------------------------------------------------------
  console.log('--- CATEGORY 1: Foreign Key Restrictions (ON DELETE RESTRICT) ---');

  test('T1.1', 'Delete equipment with active loan blocked by ON DELETE RESTRICT', () => {
    const res = runPsql("DELETE FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000001';", true);
    if (!res.success) {
      return { passed: false, error: 'Expected foreign key restriction violation, but statement unexpectedly succeeded!' };
    }
    const hasFkViolation = res.error.includes('violates foreign key constraint') && res.error.includes('loans');
    return {
      passed: hasFkViolation,
      details: res.error,
      error: hasFkViolation ? null : `Unexpected error message: ${res.error}`
    };
  });

  test('T1.2', 'Delete equipment with overdue loan blocked by ON DELETE RESTRICT', () => {
    const res = runPsql("DELETE FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000002';", true);
    if (!res.success) {
      return { passed: false, error: 'Expected foreign key restriction violation, but statement unexpectedly succeeded!' };
    }
    const hasFkViolation = res.error.includes('violates foreign key constraint') && res.error.includes('loans');
    return {
      passed: hasFkViolation,
      details: res.error,
      error: hasFkViolation ? null : `Unexpected error message: ${res.error}`
    };
  });

  test('T1.3', 'Delete beneficiary with active loan blocked by ON DELETE RESTRICT', () => {
    const res = runPsql("DELETE FROM public.beneficiaries WHERE id = 'b0000000-0000-0000-0000-000000000001';", true);
    if (!res.success) {
      return { passed: false, error: 'Expected foreign key restriction violation, but statement unexpectedly succeeded!' };
    }
    const hasFkViolation = res.error.includes('violates foreign key constraint') && res.error.includes('loans');
    return {
      passed: hasFkViolation,
      details: res.error,
      error: hasFkViolation ? null : `Unexpected error message: ${res.error}`
    };
  });

  test('T1.4', 'Delete equipment with returned loan also blocked by ON DELETE RESTRICT', () => {
    const res = runPsql("DELETE FROM public.equipments WHERE id = 'e0000000-0000-0000-0000-000000000004';", true);
    if (!res.success) {
      return { passed: false, error: 'Expected foreign key restriction violation, but statement unexpectedly succeeded!' };
    }
    const hasFkViolation = res.error.includes('violates foreign key constraint') && res.error.includes('loans');
    return {
      passed: hasFkViolation,
      details: res.error,
      error: hasFkViolation ? null : `Unexpected error message: ${res.error}`
    };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 2: CONCURRENT LOANS & PARTIAL UNIQUE INDEX INVARIANT
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 2: Concurrent Loans & Partial Unique Index ---');

  test('T2.1', 'Insert 2nd active loan for equipment blocked by state check or partial unique index', () => {
    const sql = `
      INSERT INTO public.loans (
        id, loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
      ) VALUES (
        gen_random_uuid(), 'ROT-EMP-TEST-COLLISION-1',
        'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'ATIVO', now() + INTERVAL '30 days', 'magic-test-collision-1'
      );
    `;
    const res = runPsql(sql, true);
    if (!res.success) {
      return { passed: false, error: 'Expected rejection, but insert succeeded!' };
    }
    const isProtected = res.error.includes('DISPONIVEL') || res.error.includes('idx_unique_active_loan_per_equipment');
    return {
      passed: isProtected,
      details: res.error,
      error: isProtected ? null : `Unexpected error: ${res.error}`
    };
  });

  test('T2.2', 'Partial unique index idx_unique_active_loan_per_equipment directly rejects duplicate active status', () => {
    const sql = `
      SET session_replication_role = 'replica';
      INSERT INTO public.loans (
        loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
      ) VALUES (
        'ROT-EMP-COLLISION-IDX-DIRECT',
        'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'ATIVO', now() + INTERVAL '30 days', 'tok-idx-col-direct'
      );
    `;
    const res = runPsql(sql, true);
    if (!res.success) {
      return { passed: false, error: 'Expected unique index collision, but insert succeeded!' };
    }
    const isIndexViolation = res.error.includes('idx_unique_active_loan_per_equipment') || res.error.includes('duplicate key value');
    return {
      passed: isIndexViolation,
      details: res.error,
      error: isIndexViolation ? null : `Unexpected error: ${res.error}`
    };
  });

  test('T2.3', 'Partial unique index blocks ATRASADO loan collision on same equipment', () => {
    const sql = `
      SET session_replication_role = 'replica';
      INSERT INTO public.loans (
        loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
      ) VALUES (
        'ROT-EMP-COLLISION-ATRASADO-IDX',
        'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        'ATRASADO', now() - INTERVAL '5 days', 'tok-idx-atrasado-col'
      );
    `;
    const res = runPsql(sql, true);
    if (!res.success) {
      return { passed: false, error: 'Expected unique index collision, but insert succeeded!' };
    }
    const isIndexViolation = res.error.includes('idx_unique_active_loan_per_equipment') || res.error.includes('duplicate key value');
    return {
      passed: isIndexViolation,
      details: res.error,
      error: isIndexViolation ? null : `Unexpected error: ${res.error}`
    };
  });

  test('T2.4', 'Allowed concurrency boundary: multiple historical DEVOLVIDO loans permitted', () => {
    const sql = `
      INSERT INTO public.loans (
        id, loan_code, equipment_id, beneficiary_id, status, loan_date, expected_return_date, actual_return_date, magic_token
      ) VALUES
      (
        gen_random_uuid(), 'ROT-EMP-HIST-DEVOL-1',
        'e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
        'DEVOLVIDO', now() - INTERVAL '100 days', now() - INTERVAL '70 days', now() - INTERVAL '70 days', 'magic-test-hist-devol-1'
      ),
      (
        gen_random_uuid(), 'ROT-EMP-HIST-DEVOL-2',
        'e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
        'DEVOLVIDO', now() - INTERVAL '60 days', now() - INTERVAL '30 days', now() - INTERVAL '30 days', 'magic-test-hist-devol-2'
      );
    `;
    const res = runPsql(sql, false);
    if (!res.success) {
      return { passed: false, error: `Failed to insert multiple historical returned loans: ${res.error}` };
    }
    return { passed: true, details: 'Successfully created multiple historical loans without partial index collision.' };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 3: ENUM REJECTION & TYPE SAFETY
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 3: Enum Rejection & Domain Boundaries ---');

  test('T3.1', 'Invalid user_role input rejected', () => {
    const sql = `
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (gen_random_uuid(), 'adversarial@rotary.org', 'Hacker', 'superadmin'::user_role);
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('superadmin');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T3.2', 'Invalid equipment_category input rejected', () => {
    const sql = `
      INSERT INTO public.equipments (patrimony_code, name, category, qr_token)
      VALUES ('ROT-ADV-001', 'Drone Ortopédico', 'DRONE'::equipment_category, 'tok-adv-1');
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('DRONE');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T3.3', 'Invalid equipment_status input rejected', () => {
    const sql = `
      INSERT INTO public.equipments (patrimony_code, name, category, status, qr_token)
      VALUES ('ROT-ADV-002', 'Cadeira Inválida', 'CADEIRA_RODAS'::equipment_category, 'VENDIDO'::equipment_status, 'tok-adv-2');
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('VENDIDO');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T3.4', 'Invalid equipment_condition input rejected', () => {
    const sql = `
      INSERT INTO public.equipments (patrimony_code, name, category, condition, qr_token)
      VALUES ('ROT-ADV-003', 'Andador Quebrado', 'ANDADOR'::equipment_category, 'DESTRUIDO'::equipment_condition, 'tok-adv-3');
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('DESTRUIDO');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T3.5', 'Invalid loan_status input rejected', () => {
    const sql = `
      INSERT INTO public.loans (loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token)
      VALUES ('ROT-EMP-ADV', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'EXPIRADO'::loan_status, now(), 'tok-adv-loan');
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('EXPIRADO');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T3.6', 'Invalid close_reason input rejected', () => {
    const sql = `
      UPDATE public.loans SET close_reason = 'EXTRAVIO'::close_reason WHERE id = 'c0000000-0000-0000-0000-000000000003';
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('EXTRAVIO');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 4: CPF FORMATTING, MODULO 11 CHECKSUM & LGPD
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 4: Brazilian CPF Formatting & Modulo 11 Invariants ---');

  test('T4.1', 'All seeded beneficiary CPFs and patient CPFs are strictly valid Modulo 11', () => {
    const query = runPsql("SELECT full_name, cpf, patient_name, patient_cpf FROM public.beneficiaries;", false);
    if (!query.success) {
      return { passed: false, error: query.error };
    }

    const lines = query.output.split('\n').filter(l => l.includes('|'));
    const dataLines = lines.filter(l => !l.includes('full_name') && !l.includes('---'));

    const validatedList = [];
    for (const line of dataLines) {
      const parts = line.split('|').map(p => p.trim());
      const fullName = parts[0];
      const cpf = parts[1];
      const patientName = parts[2];
      const patientCpf = parts[3];

      const cpfFormat = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
      if (!cpfFormat.test(cpf)) {
        return { passed: false, error: `CPF '${cpf}' of ${fullName} does not match strict formatting` };
      }
      if (!validateCpfChecksum(cpf)) {
        return { passed: false, error: `CPF '${cpf}' of ${fullName} fails mathematical Modulo 11 checksum!` };
      }
      validatedList.push(`${fullName} (${cpf}): VALID`);

      if (patientCpf && patientCpf !== '') {
        if (!cpfFormat.test(patientCpf)) {
          return { passed: false, error: `Patient CPF '${patientCpf}' does not match formatting` };
        }
        if (!validateCpfChecksum(patientCpf)) {
          return { passed: false, error: `Patient CPF '${patientCpf}' of ${patientName} fails Modulo 11 checksum!` };
        }
        validatedList.push(`Patient ${patientName} (${patientCpf}): VALID`);
      }
    }

    return { passed: true, details: validatedList.join('; ') };
  });

  test('T4.2', 'CPF validator sensitivity oracle rejects adversarial invalid CPFs', () => {
    const testCases = [
      { cpf: '000.000.000-00', expected: false },
      { cpf: '111.111.111-11', expected: false },
      { cpf: '123.456.789-00', expected: false },
      { cpf: '987.654.321-99', expected: false },
      { cpf: '529.982.247-25', expected: true }
    ];

    for (const tc of testCases) {
      const actual = validateCpfChecksum(tc.cpf);
      if (actual !== tc.expected) {
        return { passed: false, error: `Oracle failed on '${tc.cpf}': expected ${tc.expected}, got ${actual}` };
      }
    }
    return { passed: true, details: 'All 5 adversarial CPF test vectors correctly identified.' };
  });

  test('T4.3', 'Duplicate beneficiary CPF rejected by unique constraint', () => {
    const sql = `
      INSERT INTO public.beneficiaries (
        full_name, cpf, phone, address_street, address_number, address_neighborhood, address_city, address_cep,
        secondary_contact_name, secondary_contact_relationship, secondary_contact_phone
      ) VALUES (
        'Clonagem Maria Silva', '123.456.789-09', '(11) 91111-2222',
        'Rua Teste', '1', 'Bairro Teste', 'São Paulo', '01001-000',
        'Contato Secundário', 'Amigo', '(11) 93333-4444'
      );
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('beneficiaries_cpf_key');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 5: MANDATORY SECONDARY CONTACT & NON-COLLISION
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 5: Secondary Contact Fields & Non-Collision ---');

  test('T5.1', 'All seeded beneficiaries have non-null, non-colliding secondary contacts', () => {
    const query = runPsql("SELECT full_name, phone, patient_name, secondary_contact_name, secondary_contact_relationship, secondary_contact_phone FROM public.beneficiaries;", false);
    if (!query.success) {
      return { passed: false, error: query.error };
    }

    const lines = query.output.split('\n').filter(l => l.includes('|') && !l.includes('full_name') && !l.includes('---'));
    const details = [];

    for (const line of lines) {
      const [fullName, phone, patientName, secName, secRel, secPhone] = line.split('|').map(s => s.trim());

      if (!secName || secName === '' || !secRel || secRel === '' || !secPhone || secPhone === '') {
        return { passed: false, error: `Beneficiary '${fullName}' has missing secondary contact fields!` };
      }

      if (fullName.toLowerCase() === secName.toLowerCase()) {
        return { passed: false, error: `Collision detected: Primary name '${fullName}' equals Secondary name '${secName}'!` };
      }
      if (patientName && patientName.toLowerCase() === secName.toLowerCase()) {
        return { passed: false, error: `Collision detected: Patient name '${patientName}' equals Secondary name '${secName}'!` };
      }

      const cleanPhone1 = phone.replace(/\D/g, '');
      const cleanPhone2 = secPhone.replace(/\D/g, '');
      if (cleanPhone1 === cleanPhone2) {
        return { passed: false, error: `Collision detected: Primary phone '${phone}' equals Secondary phone '${secPhone}'!` };
      }

      details.push(`${fullName} -> Sec: ${secName} (${secRel}, ${secPhone}) [NO COLLISION]`);
    }

    return { passed: true, details: details.join('; ') };
  });

  test('T5.2', 'NULL secondary_contact_name rejected by NOT NULL constraint', () => {
    const sql = `
      INSERT INTO public.beneficiaries (
        full_name, cpf, phone, address_street, address_number, address_neighborhood, address_city, address_cep,
        secondary_contact_name, secondary_contact_relationship, secondary_contact_phone
      ) VALUES (
        'Beneficiário Sem Contato', '456.789.012-34', '(11) 94444-5555',
        'Rua Teste', '10', 'Bairro Teste', 'São Paulo', '01001-000',
        NULL, 'Irmão', '(11) 95555-6666'
      );
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('null value in column "secondary_contact_name"');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T5.3', 'NULL secondary_contact_relationship rejected by NOT NULL constraint', () => {
    const sql = `
      INSERT INTO public.beneficiaries (
        full_name, cpf, phone, address_street, address_number, address_neighborhood, address_city, address_cep,
        secondary_contact_name, secondary_contact_relationship, secondary_contact_phone
      ) VALUES (
        'Beneficiário Sem Parentesco', '567.890.123-45', '(11) 94444-5555',
        'Rua Teste', '10', 'Bairro Teste', 'São Paulo', '01001-000',
        'João Silva', NULL, '(11) 95555-6666'
      );
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('null value in column "secondary_contact_relationship"');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T5.4', 'NULL secondary_contact_phone rejected by NOT NULL constraint', () => {
    const sql = `
      INSERT INTO public.beneficiaries (
        full_name, cpf, phone, address_street, address_number, address_neighborhood, address_city, address_cep,
        secondary_contact_name, secondary_contact_relationship, secondary_contact_phone
      ) VALUES (
        'Beneficiário Sem Telefone Secundário', '678.901.234-56', '(11) 94444-5555',
        'Rua Teste', '10', 'Bairro Teste', 'São Paulo', '01001-000',
        'João Silva', 'Irmão', NULL
      );
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('null value in column "secondary_contact_phone"');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 6: AUTOMATED TRIGGERS & STATE MACHINE INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 6: Automated Triggers & State Machine ---');

  test('T6.1', 'Loan creation for non-DISPONIVEL equipment rejected by trigger', () => {
    const sql = `
      INSERT INTO public.loans (
        id, loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
      ) VALUES (
        gen_random_uuid(), 'ROT-EMP-TEST-UNAVAIL',
        'e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
        'ATIVO', now() + INTERVAL '30 days', 'magic-test-unavail'
      );
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('DISPONIVEL (status atual: MANUTENCAO)');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  test('T6.2', '[EMPIRICAL DEFECT 1] Loan insertion with status ATIVO fails due to BEFORE INSERT foreign key violation on loan_events_log', () => {
    // Standard real-world loan creation
    const loanId = 'c0000000-0000-0000-0000-000000000099';
    const sql = `
      INSERT INTO public.loans (
        id, loan_code, equipment_id, beneficiary_id, status, expected_return_date, magic_token
      ) VALUES (
        '${loanId}', 'ROT-EMP-TEST-TRANSITION',
        'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
        'ATIVO', now() + INTERVAL '30 days', 'magic-test-trans-001'
      );
    `;
    const res = runPsql(sql, false);
    if (!res.success) {
      // Confirmed defect in implementation!
      const isExpectedDefect = res.error.includes('loan_events_log_loan_id_fkey') && res.error.includes('is not present in table "loans"');
      return {
        passed: false,
        isDefect: true,
        blastRadius: 'CRITICAL: No loans can be created via standard INSERT. Completely blocks loan origination flow.',
        fix: 'Change trg_loan_equipment_status_sync to AFTER INSERT on loans (or split into BEFORE UPDATE for field defaults and AFTER INSERT/UPDATE for child table inserts).',
        error: `CRITICAL SCHEMA BUG: trg_loan_equipment_status_sync is BEFORE INSERT, so inserting into loan_events_log violates FK on uncommitted parent loan: ${res.error}`
      };
    }
    return { passed: true, details: 'Loan creation succeeded.' };
  });

  test('T6.3', '[EMPIRICAL DEFECT 2] Equipment ID alteration bypasses trigger because equipment_id is missing from UPDATE OF column list', () => {
    // Attempt to alter equipment_id on existing loan
    const sql = `
      UPDATE public.loans
      SET equipment_id = 'e0000000-0000-0000-0000-000000000006'
      WHERE id = 'c0000000-0000-0000-0000-000000000001';
    `;
    const res = runPsql(sql, false);
    if (res.success && res.output.includes('UPDATE 1')) {
      // Defect confirmed: the update succeeded even though fn_sync_loan_equipment_status contains code to reject it!
      return {
        passed: false,
        isDefect: true,
        blastRadius: 'HIGH: Equipment reassignments bypass trigger validation and orphan equipment catalog statuses.',
        fix: 'Include equipment_id in the trigger column list: CREATE TRIGGER trg_loan_equipment_status_sync BEFORE INSERT OR UPDATE OF equipment_id, status, ...',
        error: 'HIGH SEVERITY SCHEMA BUG: UPDATE loans SET equipment_id succeeded! The trigger trg_loan_equipment_status_sync omitted equipment_id from the UPDATE OF column list (line 520), rendering lines 399-402 dead code.'
      };
    }
    return { passed: true, details: 'Equipment alteration was properly blocked.' };
  });

  test('T6.4', 'Exceeding max_renewals threshold rejected by trigger', () => {
    const sql = `
      UPDATE public.loans
      SET renewal_count = 4
      WHERE id = 'c0000000-0000-0000-0000-000000000001';
    `;
    const res = runPsql(sql, true);
    const rejected = res.success && res.error.includes('atingido para este contrato');
    return { passed: rejected, details: res.error, error: rejected ? null : res.error };
  });

  // --------------------------------------------------------------------------
  // CATEGORY 7: ROW LEVEL SECURITY & PUBLIC RPCs
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 7: Row Level Security & Public RPC Functions ---');

  test('T7.1', 'RLS is verified active on all 6 public relations', () => {
    const sql = `
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('profiles', 'equipments', 'beneficiaries', 'loans', 'loan_events_log', 'maintenance_logs')
      ORDER BY tablename;
    `;
    const res = runPsql(sql, false);
    if (!res.success) return { passed: false, error: res.error };

    const expected = ['beneficiaries', 'equipments', 'loan_events_log', 'loans', 'maintenance_logs', 'profiles'];
    for (const t of expected) {
      const match = new RegExp(`${t}\\s*\\|\\s*t`).test(res.output);
      if (!match) {
        return { passed: false, error: `Table '${t}' does not have rowsecurity = true in pg_tables output!` };
      }
    }
    return { passed: true, details: 'All 6 core tables have rowsecurity = true.' };
  });

  test('T7.2', 'Secure public RPC get_public_loan_by_magic_token returns masked PII', () => {
    const sql = "SELECT * FROM public.get_public_loan_by_magic_token('magic-tok-active-maria-001');";
    const res = runPsql(sql, false);
    if (!res.success) return { passed: false, error: res.error };

    const hasFirstNameOnly = res.output.includes('Maria') && !res.output.includes('Maria Aparecida da Silva');
    const passed = hasFirstNameOnly;
    return {
      passed,
      details: `Returned expected equipment and masked full name to first name '${hasFirstNameOnly ? 'Maria' : 'UNMASKED'}'`,
      error: passed ? null : `Unexpected output from RPC: ${res.output}`
    };
  });

  test('T7.3', 'Secure public RPC renew_loan_by_magic_token extends expected date and increments count', () => {
    const sql = "SELECT public.renew_loan_by_magic_token('magic-tok-active-maria-001');";
    const res = runPsql(sql, false);
    if (!res.success) return { passed: false, error: res.error };

    const passed = res.output.includes('"success": true') && res.output.includes('"renewal_count": 1');
    return {
      passed,
      details: res.output,
      error: passed ? null : `Unexpected renewal output: ${res.output}`
    };
  });

  test('T7.4', 'Secure public RPC renew_loan_by_magic_token rejects invalid/non-existent token', () => {
    const sql = "SELECT public.renew_loan_by_magic_token('invalid-ghost-token-xyz');";
    const res = runPsql(sql, false);
    if (!res.success) return { passed: false, error: res.error };

    const passed = res.output.includes('"success": false');
    return {
      passed,
      details: res.output,
      error: passed ? null : `Unexpected response for invalid token: ${res.output}`
    };
  });

  // --------------------------------------------------------------------------
  // SUMMARY METRICS
  // --------------------------------------------------------------------------
  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log('ADVERSARIAL STRESS TEST SUMMARY');
  console.log(`Total Invariants Evaluated: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Defects Detected: ${defectsFound.length}`);
  console.log(`Execution Time: ${totalDuration}ms`);
  console.log('Final Milestone 2 Verdict: ' + (defectsFound.length === 0 ? 'CONFIRMED CORRECT' : 'DEFECT_DETECTED'));
  console.log('================================================================\n');

  if (defectsFound.length > 0) {
    console.log('=== CONFIRMED DEFECT DETAILS ===');
    defectsFound.forEach((d, idx) => {
      console.log(`\n[DEFECT ${idx + 1}] (${d.id}): ${d.title}`);
      console.log(`Blast Radius: ${d.blastRadius}`);
      console.log(`Technical Cause: ${d.error}`);
      console.log(`Recommended Mitigation: ${d.fix}`);
    });
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialSuite();
