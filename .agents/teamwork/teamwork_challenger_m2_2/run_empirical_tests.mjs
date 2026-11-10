/**
 * Comprehensive Empirical Adversarial Verification Suite
 * Milestone 2 - Supabase Schema, Invariants, Triggers & RLS
 * Challenger 2 State Folder
 */

import { execSync } from 'child_process';

const CONTAINER = 'rotary-m2-challenger-pg';

function runPsql(sql, options = {}) {
  const rolePrefix = options.role ? `SET ROLE ${options.role};\n` : '';
  const fullSql = `${rolePrefix}${sql}\n`;
  const cmd = `docker exec -i ${CONTAINER} psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1`;
  try {
    const raw = execSync(cmd, { input: fullSql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && l !== 'SET');
    return { success: true, output: lines.join('\n'), raw: raw.trim(), lines };
  } catch (err) {
    const combined = ((err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : err.message)).trim();
    return {
      success: false,
      output: combined,
      raw: combined,
      error: err.stderr ? err.stderr.toString().trim() : err.message
    };
  }
}

function resetDatabase() {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres -t -A`, {
    input: `
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth;
    `
  });
  execSync(`docker exec ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/001_initial_schema.sql`);
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres -t -A`, {
    input: `
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
    `
  });
}

const tests = [];
function test(category, id, description, fn) {
  tests.push({ category, id, description, fn });
}

// ----------------------------------------------------------------------------
// SUITE 1: TRIGGER STATE TRANSITIONS & INTEGRITY
// ----------------------------------------------------------------------------

test('Triggers', 'T1.1', 'Loan insertion (ATIVO) on DISPONIVEL equipment: Equipment status sync & audit log', () => {
  resetDatabase();
  const eqId = 'e0000000-0000-0000-0000-000000000003'; // ROT-AND-003 is DISPONIVEL
  const benId = 'b0000000-0000-0000-0000-000000000001';
  
  const res = runPsql(`
    INSERT INTO public.loans (
      id, loan_code, equipment_id, beneficiary_id, status,
      loan_date, expected_return_date, magic_token
    ) VALUES (
      'c0000000-0000-0000-0000-000000000010',
      'ROT-TEST-T1-1',
      '${eqId}',
      '${benId}',
      'ATIVO',
      now(),
      now() + interval '30 days',
      'tok-test-t1-1'
    );
  `);

  if (!res.success) {
    if (res.output.includes('violates foreign key constraint "loan_events_log_loan_id_fkey"')) {
      return {
        verdict: 'DEFECT',
        finding: 'CRITICAL_DEFECT: fn_sync_loan_equipment_status is attached as BEFORE INSERT. It attempts to insert an audit record into loan_events_log referencing NEW.id before the parent loan row exists in table "loans", triggering foreign key violation: ' + res.output
      };
    }
    throw new Error(`Unexpected failure: ${res.output}`);
  }

  const statusCheck = runPsql(`SELECT status FROM public.equipments WHERE id = '${eqId}';`);
  if (statusCheck.output !== 'EMPRESTADO') throw new Error(`Expected EMPRESTADO, got ${statusCheck.output}`);
  return { verdict: 'PASS' };
});

test('Triggers', 'T1.2', 'Loan insertion on already EMPRESTADO equipment is blocked by trigger', () => {
  const eqId = 'e0000000-0000-0000-0000-000000000001'; // ROT-CR-001 is EMPRESTADO
  const benId = 'b0000000-0000-0000-0000-000000000001';
  
  const res = runPsql(`
    INSERT INTO public.loans (
      loan_code, equipment_id, beneficiary_id, status,
      expected_return_date, magic_token
    ) VALUES (
      'ROT-TEST-T1-2',
      '${eqId}',
      '${benId}',
      'ATIVO',
      now() + interval '30 days',
      'tok-test-t1-2'
    );
  `);

  if (res.success) throw new Error('Loan insertion succeeded on non-available equipment!');
  if (!res.output.includes('não está DISPONIVEL')) {
    throw new Error(`Unexpected error: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('Triggers', 'T1.3', 'Equipment ID immutability on existing loan', () => {
  const loanId = 'c0000000-0000-0000-0000-000000000001';
  const newEqId = 'e0000000-0000-0000-0000-000000000006';
  
  const res = runPsql(`UPDATE public.loans SET equipment_id = '${newEqId}' WHERE id = '${loanId}';`);
  
  if (res.success) {
    return {
      verdict: 'DEFECT',
      finding: 'HIGH_DEFECT: Trigger trg_loan_equipment_status_sync omits "equipment_id" from its "UPDATE OF" column list. An UPDATE modifying equipment_id bypasses the trigger and succeeds without throwing the intended exception.'
    };
  }
  return { verdict: 'PASS' };
});

test('Triggers', 'T1.4', 'Loan return (DEVOLVIDO) with explicit post_return_destination HIGIENIZACAO', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000001';
  const eqId = 'e0000000-0000-0000-0000-000000000001';
  
  const res = runPsql(`
    UPDATE public.loans
    SET
      status = 'DEVOLVIDO',
      post_return_destination = 'HIGIENIZACAO',
      return_condition = 'BOM',
      close_reason = 'RECUPERACAO_ALTA'
    WHERE id = '${loanId}';
  `);
  if (!res.success) throw new Error(res.output);

  const eqRes = runPsql(`SELECT status FROM public.equipments WHERE id = '${eqId}';`);
  if (eqRes.output !== 'HIGIENIZACAO') {
    throw new Error(`Expected HIGIENIZACAO, got: ${eqRes.output}`);
  }

  const logRes = runPsql(`SELECT event_type FROM public.loan_events_log WHERE loan_id = '${loanId}' AND event_type = 'RETURNED';`);
  if (!logRes.output.includes('RETURNED')) throw new Error('RETURNED event log not created');

  return { verdict: 'PASS' };
});

test('Triggers', 'T1.5', 'Loan return fallback: PRECISA_REPARO defaults to MANUTENCAO when destination is NULL', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000001';
  const eqId = 'e0000000-0000-0000-0000-000000000001';
  
  const res = runPsql(`
    UPDATE public.loans
    SET
      status = 'DEVOLVIDO',
      post_return_destination = NULL,
      return_condition = 'PRECISA_REPARO',
      close_reason = 'OUTROS'
    WHERE id = '${loanId}';
  `);
  if (!res.success) throw new Error(res.output);

  const eqRes = runPsql(`SELECT status, condition FROM public.equipments WHERE id = '${eqId}';`);
  if (!eqRes.output.includes('MANUTENCAO') || !eqRes.output.includes('PRECISA_REPARO')) {
    throw new Error(`Expected MANUTENCAO and PRECISA_REPARO, got: ${eqRes.output}`);
  }
  return { verdict: 'PASS' };
});

test('Triggers', 'T1.6', 'Loan overdue transition (ATIVO -> ATRASADO) updates equipment to ATRASADO', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000001';
  const eqId = 'e0000000-0000-0000-0000-000000000001';
  
  const res = runPsql(`
    UPDATE public.loans
    SET status = 'ATRASADO'
    WHERE id = '${loanId}';
  `);
  if (!res.success) throw new Error(res.output);

  const eqRes = runPsql(`SELECT status FROM public.equipments WHERE id = '${eqId}';`);
  if (eqRes.output !== 'ATRASADO') throw new Error(`Expected equipment status ATRASADO, got: ${eqRes.output}`);

  const logRes = runPsql(`SELECT event_type FROM public.loan_events_log WHERE loan_id = '${loanId}' AND event_type = 'OVERDUE';`);
  if (!logRes.output.includes('OVERDUE')) throw new Error('OVERDUE event not logged');

  return { verdict: 'PASS' };
});

// ----------------------------------------------------------------------------
// SUITE 2: OVERDUE LOAN RENEWAL & STATE REVERSAL
// ----------------------------------------------------------------------------

test('Renewal', 'T2.1', 'Overdue loan renewal state reversal (ATRASADO -> EMPRESTADO when renewed to ATIVO)', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000002'; // Overdue loan in seed
  const eqId = 'e0000000-0000-0000-0000-000000000002'; // ROT-CB-002 (ATRASADO)

  // Verify initial state
  const initCheck = runPsql(`SELECT status FROM public.equipments WHERE id = '${eqId}';`);
  if (initCheck.output !== 'ATRASADO') throw new Error(`Initial equipment status was not ATRASADO: ${initCheck.output}`);

  // Perform renewal update
  const res = runPsql(`
    UPDATE public.loans
    SET
      status = 'ATIVO',
      renewal_count = renewal_count + 1,
      expected_return_date = expected_return_date + interval '30 days'
    WHERE id = '${loanId}';
  `);
  if (!res.success) throw new Error(res.output);

  const eqRes = runPsql(`SELECT status FROM public.equipments WHERE id = '${eqId}';`);
  if (eqRes.output !== 'EMPRESTADO') {
    throw new Error(`Expected equipment status to reverse to EMPRESTADO, got: ${eqRes.output}`);
  }

  const logRes = runPsql(`SELECT old_status, new_status FROM public.loan_events_log WHERE loan_id = '${loanId}' AND event_type = 'RENEWED' ORDER BY created_at DESC LIMIT 1;`);
  if (!logRes.output.includes('ATRASADO') || !logRes.output.includes('ATIVO')) {
    throw new Error(`Expected RENEWED log from ATRASADO to ATIVO, got: ${logRes.output}`);
  }

  return { verdict: 'PASS', details: 'Equipment reverted ATRASADO -> EMPRESTADO and RENEWED event logged' };
});

// ----------------------------------------------------------------------------
// SUITE 3: MAX RENEWALS ENFORCEMENT
// ----------------------------------------------------------------------------

test('Max Renewals', 'T3.1', 'Direct SQL update exceeding max_renewals is blocked by trigger', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000001'; // max_renewals = 3, renewal_count = 0
  
  const res = runPsql(`
    UPDATE public.loans
    SET renewal_count = 4
    WHERE id = '${loanId}';
  `);
  if (res.success) throw new Error('Trigger failed to block renewal_count > max_renewals!');
  if (!res.output.includes('Limite máximo de 3 renovações atingido')) {
    throw new Error(`Unexpected error message: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('Max Renewals', 'T3.2', 'renew_loan_by_magic_token blocks renewal when renewal_count >= max_renewals', () => {
  resetDatabase();
  const loanId = 'c0000000-0000-0000-0000-000000000001';
  const token = 'magic-tok-active-maria-001';
  // Fast forward renewal_count to 3
  runPsql(`UPDATE public.loans SET renewal_count = 3 WHERE id = '${loanId}';`);

  const res = runPsql(`SELECT public.renew_loan_by_magic_token('${token}');`);
  if (!res.success) throw new Error(res.output);
  if (!res.output.includes('"success": false') || !res.output.includes('Limite máximo de renovações atingido')) {
    throw new Error(`Expected error response from RPC, got: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('Max Renewals', 'T3.3', 'renew_loan_by_magic_token executes renewal for eligible loan (+30d & count++)', () => {
  resetDatabase();
  const token = 'magic-tok-active-maria-001';
  const res = runPsql(`SELECT public.renew_loan_by_magic_token('${token}');`);
  if (!res.success) throw new Error(res.output);
  if (!res.output.includes('"success": true') || !res.output.includes('"renewal_count": 1')) {
    throw new Error(`Expected successful renewal, got: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('Max Renewals', 'T3.4', 'renew_loan_by_magic_token rejects invalid token', () => {
  const res = runPsql(`SELECT public.renew_loan_by_magic_token('non-existent-token-xyz');`);
  if (!res.success) throw new Error(res.output);
  if (!res.output.includes('"success": false') || !res.output.includes('Token de renovação inválido')) {
    throw new Error(`Expected invalid token rejection, got: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('Max Renewals', 'T3.5', 'renew_loan_by_magic_token rejects non-active loan (DEVOLVIDO)', () => {
  resetDatabase();
  const token = 'magic-tok-returned-maria-003';
  const res = runPsql(`SELECT public.renew_loan_by_magic_token('${token}');`);
  if (!res.success) throw new Error(res.output);
  if (!res.output.includes('"success": false') || !res.output.includes('não está ativo para renovação')) {
    throw new Error(`Expected non-active rejection, got: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

// ----------------------------------------------------------------------------
// SUITE 4: RPC get_public_loan_by_magic_token & PII MASKING
// ----------------------------------------------------------------------------

test('RPC & Privacy', 'T4.1', 'get_public_loan_by_magic_token returns masked data (first name only)', () => {
  resetDatabase();
  const token = 'magic-tok-active-maria-001';
  const res = runPsql(`SELECT * FROM public.get_public_loan_by_magic_token('${token}');`);
  if (!res.success) throw new Error(res.output);
  if (!res.output.includes('Maria') || !res.output.includes('ROT-CR-001')) {
    throw new Error(`Expected Maria and ROT-CR-001, got: ${res.output}`);
  }
  if (res.output.includes('Maria Aparecida da Silva')) {
    throw new Error(`Full name leaked in public RPC output: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('RPC & Privacy', 'T4.2', 'get_public_loan_by_magic_token returns empty set for non-existent token', () => {
  const res = runPsql(`SELECT count(*) FROM public.get_public_loan_by_magic_token('random-token');`);
  if (!res.success) throw new Error(res.output);
  if (res.output !== '0') throw new Error(`Expected 0 rows, got: ${res.output}`);
  return { verdict: 'PASS' };
});

// ----------------------------------------------------------------------------
// SUITE 5: RLS POLICIES & PENETRATION ATTACKS
// ----------------------------------------------------------------------------

test('RLS & Security', 'T5.1', 'Anon role cannot read beneficiaries table (Strict LGPD)', () => {
  const res = runPsql(`SELECT count(*) FROM public.beneficiaries;`, { role: 'anon' });
  if (!res.success) throw new Error(`Error: ${res.output}`);
  if (res.output !== '0') {
    throw new Error(`DEFECT: Anon was able to read ${res.output} rows from beneficiaries!`);
  }
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.2', 'Anon role cannot insert or modify beneficiaries table', () => {
  const res = runPsql(`
    INSERT INTO public.beneficiaries (
      full_name, cpf, phone, address_street, address_number,
      address_neighborhood, address_city, address_cep,
      secondary_contact_name, secondary_contact_relationship, secondary_contact_phone
    ) VALUES (
      'Infiltrator', '000.000.000-00', '111', 'Rua X', '1',
      'Bairro', 'SP', '00000-000', 'Sec', 'Amigo', '222'
    );
  `, { role: 'anon' });
  if (res.success) throw new Error('DEFECT: Anon was permitted to insert into beneficiaries!');
  if (!res.output.includes('violates row-level security policy')) {
    throw new Error(`Unexpected error: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.3', 'Anon role can read equipments for QR Code scanner (/item/[qr_token])', () => {
  const res = runPsql(`SELECT name, status FROM public.equipments WHERE qr_token = 'eq-tok-cr001-rotary-wheel';`, { role: 'anon' });
  if (!res.success) throw new Error(`Error: ${res.output}`);
  if (!res.output.includes('Cadeira de Rodas Standard') || !res.output.includes('EMPRESTADO')) {
    throw new Error(`Expected equipment details, got: ${res.output}`);
  }
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.4', 'Anon role cannot insert or update equipments', () => {
  const insertRes = runPsql(`
    INSERT INTO public.equipments (patrimony_code, name, category, qr_token)
    VALUES ('HACK-001', 'Fake Item', 'OUTROS', 'fake-qr');
  `, { role: 'anon' });
  if (insertRes.success) throw new Error('DEFECT: Anon was permitted to insert into equipments!');

  const updateRes = runPsql(`
    UPDATE public.equipments SET name = 'Defaced' WHERE qr_token = 'eq-tok-cr001-rotary-wheel';
  `, { role: 'anon' });
  if (updateRes.success && !updateRes.output.includes('UPDATE 0')) {
    throw new Error('DEFECT: Anon was permitted to update equipments!');
  }
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.5', 'Anon role cannot read profiles, loan_events_log, maintenance_logs', () => {
  const pRes = runPsql(`SELECT count(*) FROM public.profiles;`, { role: 'anon' });
  if (pRes.output !== '0') throw new Error(`DEFECT: Anon read ${pRes.output} profiles!`);

  const eRes = runPsql(`SELECT count(*) FROM public.loan_events_log;`, { role: 'anon' });
  if (eRes.output !== '0') throw new Error(`DEFECT: Anon read ${eRes.output} loan events!`);

  const mRes = runPsql(`SELECT count(*) FROM public.maintenance_logs;`, { role: 'anon' });
  if (mRes.output !== '0') throw new Error(`DEFECT: Anon read ${mRes.output} maintenance logs!`);
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.6', '[PENETRATION] Unauthenticated data enumeration on loans table via anon role', () => {
  resetDatabase();
  const res = runPsql(`SELECT count(*) FROM public.loans;`, { role: 'anon' });
  if (!res.success) throw new Error(`Error: ${res.output}`);
  const count = parseInt(res.output, 10);
  if (count > 0) {
    const dumpRes = runPsql(`SELECT loan_code, magic_token, signature_image_url FROM public.loans LIMIT 2;`, { role: 'anon' });
    return {
      verdict: 'DEFECT',
      finding: `CRITICAL_DEFECT: Policy "loans_anon_select_magic_token" with "USING (magic_token IS NOT NULL)" allows unauthenticated anon users to enumerate all ${count} loans and harvest magic tokens and digital signatures:\n` + dumpRes.output
    };
  }
  return { verdict: 'PASS' };
});

test('RLS & Security', 'T5.7', '[PENETRATION] Unauthenticated mass UPDATE on loans table via anon role', () => {
  resetDatabase();
  const res = runPsql(`
    UPDATE public.loans
    SET notes = 'TAMPERED_BY_ANON'
    WHERE status = 'ATIVO';
  `, { role: 'anon' });

  if (res.success) {
    const checkTampered = runPsql(`SELECT count(*) FROM public.loans WHERE notes = 'TAMPERED_BY_ANON';`);
    const tamperedCount = parseInt(checkTampered.output, 10);
    if (tamperedCount > 0) {
      return {
        verdict: 'DEFECT',
        finding: `CRITICAL_DEFECT: Policy "loans_anon_update_renewal" allows unauthenticated anon users without any magic token to execute mass UPDATEs on active loans (${tamperedCount} rows corrupted)!`
      };
    }
  }
  return { verdict: 'PASS' };
});

// Run runner
async function main() {
  console.log('======================================================================');
  console.log('ROTARY BANCO ORTOPÉDICO - EMPIRICAL ADVERSARIAL HARNESS (M2)');
  console.log('======================================================================\n');

  let passCount = 0;
  let defectCount = 0;
  const findings = [];

  for (const t of tests) {
    process.stdout.write(`[${t.category}] ${t.id}: ${t.description} ... `);
    try {
      const outcome = t.fn();
      if (outcome.verdict === 'PASS') {
        console.log('PASS');
        passCount++;
      } else if (outcome.verdict === 'DEFECT') {
        console.log('DEFECT DETECTED');
        defectCount++;
        findings.push({ id: t.id, category: t.category, description: t.description, finding: outcome.finding });
      }
    } catch (err) {
      console.log('ERROR');
      console.error(`   ${err.message}`);
      defectCount++;
      findings.push({ id: t.id, category: t.category, description: t.description, finding: err.message });
    }
  }

  console.log('\n======================================================================');
  console.log(`EXECUTION SUMMARY: ${tests.length} tests | ${passCount} PASSED | ${defectCount} DEFECTS`);
  console.log('======================================================================\n');

  if (defectCount > 0) {
    console.log('>>> VERDICT: DEFECT_DETECTED <<<\n');
    console.log('CONFIRMED EMPIRICAL FINDINGS:');
    findings.forEach((f, idx) => {
      console.log(`\n${idx + 1}. [${f.id}] ${f.description}`);
      console.log(`   ${f.finding}`);
    });
  } else {
    console.log('>>> VERDICT: CONFIRMED CORRECT <<<');
  }
}

main();
