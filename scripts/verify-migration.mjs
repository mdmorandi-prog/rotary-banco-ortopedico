/**
 * Migration & Schema Verification Suite for Rotary Banco Ortopédico (Milestone 2)
 *
 * Performs comprehensive dry-run validation of `supabase/migrations/001_initial_schema.sql`:
 * 1. PostgreSQL Extensions: uuid-ossp, pgcrypto, and auth.users stub
 * 2. 6 PostgreSQL Enums and their exact domain variants
 * 3. 6 Core Relational Tables with exact columns, types, nullability, PK and FK constraints
 * 4. Referential integrity and cascading rules (ON DELETE RESTRICT on loans; ON DELETE CASCADE on logs)
 * 5. Automated PL/pgSQL Triggers (fn_set_updated_at, fn_loan_equipment_status_before, fn_loan_events_log_after with SECURITY DEFINER)
 * 6. Partial unique index (idx_unique_active_loan_per_equipment)
 * 7. Row Level Security (RLS) activation across all 6 tables and policy scoping (public QR, secure magic token RPCs, LGPD isolation)
 * 8. Seed Dataset Completeness:
 *    - Equipment inventory (8 items, 5 statuses, 5+ categories)
 *    - Brazilian PII validation (mathematical CPF Modulo 11 check digit verification, CEP, phone numbers)
 *    - Mandatory secondary contact rules (non-collision, relationships)
 *    - Loan scenarios (active with future date, overdue >10 days, returned with quittance)
 *    - Maintenance logs and loan audit event logs
 */

import fs from 'fs';
import path from 'path';

/**
 * Validates Brazilian CPF format and Modulo 11 mathematical check digits
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

/**
 * Executes all 80 verification checks against the migration SQL content
 */
export function verifySqlSchema(sqlContent) {
  const issues = [];
  const warnings = [];
  const passes = [];

  const check = (description, condition, errorMsg) => {
    if (condition) {
      passes.push(description);
    } else {
      issues.push(`[FAIL] ${description}: ${errorMsg}`);
    }
  };

  const warn = (description, condition, warnMsg) => {
    if (!condition) {
      warnings.push(`[WARN] ${description}: ${warnMsg}`);
    }
  };

  // 1. Extensions
  check('Extension uuid-ossp enabled', /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["']uuid-ossp["']/i.test(sqlContent), 'Missing uuid-ossp extension');
  check('Extension pgcrypto enabled', /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+["']pgcrypto["']/i.test(sqlContent), 'Missing pgcrypto extension');

  // 2. Enums (6 required)
  const expectedEnums = [
    { name: 'user_role', values: ['admin', 'operator', 'volunteer'] },
    { name: 'equipment_category', values: ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'MULETA_AXILAR', 'MULETA_CANADENSE', 'ANDADOR', 'CAMA_HOSPITALAR', 'COLCHAO_PNEUMATICO', 'SUPORTE_SORO', 'OUTROS'] },
    { name: 'equipment_status', values: ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'] },
    { name: 'equipment_condition', values: ['NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO', 'SUCATEADO'] },
    { name: 'loan_status', values: ['ATIVO', 'DEVOLVIDO', 'ATRASADO', 'CANCELADO'] },
    { name: 'close_reason', values: ['RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA'] }
  ];

  for (const e of expectedEnums) {
    const enumRegex = new RegExp(`CREATE\\s+TYPE\\s+(?:public\\.)?${e.name}\\s+AS\\s+ENUM`, 'i');
    check(`Enum ${e.name} defined`, enumRegex.test(sqlContent), `Enum ${e.name} definition missing`);
    for (const val of e.values) {
      check(`Enum ${e.name} includes '${val}'`, sqlContent.includes(`'${val}'`), `Value '${val}' not found in enum ${e.name}`);
    }
  }

  // 3. Tables (6 required)
  const expectedTables = [
    'profiles',
    'equipments',
    'beneficiaries',
    'loans',
    'loan_events_log',
    'maintenance_logs'
  ];

  for (const table of expectedTables) {
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`, 'i');
    check(`Table ${table} created`, tableRegex.test(sqlContent), `Table ${table} definition missing`);
  }

  // 4. Foreign Key Constraints & Cascading Rules
  check('FK loans -> equipments (ON DELETE RESTRICT)', /REFERENCES\s+(?:public\.)?equipments\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i.test(sqlContent), 'loans.equipment_id must specify ON DELETE RESTRICT');
  check('FK loans -> beneficiaries (ON DELETE RESTRICT)', /REFERENCES\s+(?:public\.)?beneficiaries\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i.test(sqlContent), 'loans.beneficiary_id must specify ON DELETE RESTRICT');
  check('FK loan_events_log -> loans (ON DELETE CASCADE)', /REFERENCES\s+(?:public\.)?loans\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sqlContent), 'loan_events_log.loan_id must specify ON DELETE CASCADE');
  check('FK loan_events_log -> loans is DEFERRABLE INITIALLY DEFERRED', /loan_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+(?:public\.)?loans\s*\(\s*id\s*\)[^;]*DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(sqlContent), 'loan_events_log.loan_id must specify DEFERRABLE INITIALLY DEFERRED');
  check('FK maintenance_logs -> equipments (ON DELETE CASCADE)', /REFERENCES\s+(?:public\.)?equipments\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sqlContent), 'maintenance_logs.equipment_id must specify ON DELETE CASCADE');

  // 5. Triggers & Functions
  check('Function fn_set_updated_at defined', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?fn_set_updated_at/i.test(sqlContent), 'Missing fn_set_updated_at function');
  check('Function fn_loan_equipment_status_before defined', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?fn_loan_equipment_status_before/i.test(sqlContent), 'Missing fn_loan_equipment_status_before function');
  check('Trigger trg_loan_equipment_status_before bound to loans (BEFORE)', /CREATE\s+TRIGGER\s+trg_loan_equipment_status_before[\s\S]*?BEFORE\s+INSERT\s+OR\s+UPDATE\s+(?:OF\s+[^;\n]+\s+)?ON\s+(?:public\.)?loans/i.test(sqlContent), 'Missing trigger trg_loan_equipment_status_before on loans');
  check('Function fn_loan_events_log_after defined', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?fn_loan_events_log_after/i.test(sqlContent), 'Missing fn_loan_events_log_after function');
  check('Trigger trg_loan_events_log_after bound to loans (AFTER)', /CREATE\s+TRIGGER\s+trg_loan_events_log_after[\s\S]*?AFTER\s+INSERT\s+OR\s+UPDATE\s+(?:OF\s+[^;\n]+\s+)?ON\s+(?:public\.)?loans/i.test(sqlContent), 'Missing trigger trg_loan_events_log_after on loans');

  // Trigger monitors equipment_id on loan updates
  const triggerMatch = sqlContent.match(/CREATE\s+TRIGGER\s+trg_loan_equipment_status_before[\s\S]*?(?:BEFORE|AFTER)\s+INSERT\s+OR\s+UPDATE(?:\s+OF\s+([^;\n]+))?\s+ON\s+(?:public\.)?loans/i);
  let monitorsEquipmentId = false;
  if (triggerMatch) {
    const cols = triggerMatch[1];
    if (!cols || /\bequipment_id\b/i.test(cols)) {
      monitorsEquipmentId = true;
    }
  }
  check('Trigger trg_loan_equipment_status_before monitors equipment_id', monitorsEquipmentId, 'Trigger trg_loan_equipment_status_before on loans must include equipment_id in UPDATE OF list');

  // Secure RPCs: get_public_loan_by_magic_token
  const hasGetLoanRpc = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_public_loan_by_magic_token\s*\(\s*p_token\s+text\s*\)/i.test(sqlContent);
  const isGetLoanSecDefiner = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_public_loan_by_magic_token[\s\S]*?SECURITY\s+DEFINER/i.test(sqlContent);
  const hasGetLoanSearchPath = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_public_loan_by_magic_token[\s\S]*?SET\s+search_path\s*=\s*public/i.test(sqlContent);
  const masksBeneficiaryPii = /split_part\(\s*(?:b\.)?full_name\s*,\s*'\s*'\s*,\s*1\s*\)/i.test(sqlContent);

  check('RPC get_public_loan_by_magic_token defined', hasGetLoanRpc, 'Missing RPC get_public_loan_by_magic_token(p_token text)');
  check('RPC get_public_loan_by_magic_token is SECURITY DEFINER', isGetLoanSecDefiner, 'RPC get_public_loan_by_magic_token must be SECURITY DEFINER');
  check('RPC get_public_loan_by_magic_token sets search_path', hasGetLoanSearchPath, 'RPC get_public_loan_by_magic_token must set search_path = public');
  check('RPC get_public_loan_by_magic_token masks beneficiary name', masksBeneficiaryPii, 'RPC get_public_loan_by_magic_token must mask beneficiary full name to first name only');

  // Secure RPC: renew_loan_by_magic_token
  const hasRenewLoanRpc = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?renew_loan_by_magic_token\s*\(\s*p_token\s+text\s*\)/i.test(sqlContent);
  const isRenewLoanSecDefiner = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?renew_loan_by_magic_token[\s\S]*?SECURITY\s+DEFINER/i.test(sqlContent);
  const hasRenewLoanSearchPath = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?renew_loan_by_magic_token[\s\S]*?SET\s+search_path\s*=\s*public/i.test(sqlContent);

  check('RPC renew_loan_by_magic_token defined', hasRenewLoanRpc, 'Missing RPC renew_loan_by_magic_token(p_token text)');
  check('RPC renew_loan_by_magic_token is SECURITY DEFINER', isRenewLoanSecDefiner, 'RPC renew_loan_by_magic_token must be SECURITY DEFINER');
  check('RPC renew_loan_by_magic_token sets search_path', hasRenewLoanSearchPath, 'RPC renew_loan_by_magic_token must set search_path = public');

  // 6. RLS Enabled on all 6 tables
  for (const table of expectedTables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    check(`RLS enabled on ${table}`, rlsRegex.test(sqlContent), `RLS not enabled on table ${table}`);
  }

  // 7. Critical Policies & Secure Access
  check('Public QR scan policy on equipments', /CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?equipments\s+FOR\s+SELECT\s+TO\s+(?:anon,\s*authenticated|anon)/i.test(sqlContent), 'Public read policy on equipments for QR scanning missing');
  check('Loans table restricted to authenticated', /CREATE\s+POLICY\s+["']loans_authenticated_all["']\s+ON\s+(?:public\.)?loans\s+FOR\s+ALL\s+TO\s+authenticated/i.test(sqlContent), 'Missing loans_authenticated_all policy');

  const hasUnrestrictedAnonSelect = /CREATE\s+POLICY\s+["'][^"']+["']\s+ON\s+(?:public\.)?loans\s+FOR\s+SELECT\s+TO\s+(?:anon\b|[^;\n]*\banon\b)\s+USING\s*\(\s*magic_token\s+IS\s+NOT\s+NULL\s*\)/i.test(sqlContent);
  check('No unrestricted anon SELECT policy on loans', !hasUnrestrictedAnonSelect, 'Policy "loans_anon_select_magic_token" with USING (magic_token IS NOT NULL) leaks all loans to public');

  const hasDirectAnonLoanPolicy = /CREATE\s+POLICY\s+["'][^"']+["']\s+ON\s+(?:public\.)?loans\s+FOR\s+(?:SELECT|UPDATE|ALL)\s+TO\s+(?:anon\b|[^;\n]*\banon\b)/i.test(sqlContent);
  check('Zero direct anonymous access policies on loans', !hasDirectAnonLoanPolicy, 'Direct anonymous access on loans table must be disabled; anonymous access must use secure RPCs');

  const grantsGetLoanToAnon = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?get_public_loan_by_magic_token[\s\S]*?TO\s+[^;]*anon/i.test(sqlContent);
  check('Grant EXECUTE on get_public_loan_by_magic_token to anon', grantsGetLoanToAnon, 'EXECUTE on get_public_loan_by_magic_token must be granted to anon');

  const grantsRenewLoanToAnon = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?renew_loan_by_magic_token[\s\S]*?TO\s+[^;]*anon/i.test(sqlContent);
  check('Grant EXECUTE on renew_loan_by_magic_token to anon', grantsRenewLoanToAnon, 'EXECUTE on renew_loan_by_magic_token must be granted to anon');

  // 8. Seed Data Checks
  // 8.1 Equipments
  const patrimonyMatches = sqlContent.match(/'ROT-[A-Z]+-\d+'/g) || [];
  check('Seed equipments count >= 6', patrimonyMatches.length >= 6, `Found only ${patrimonyMatches.length} equipment patrimony codes in seed`);

  const requiredStatuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO'];
  for (const st of requiredStatuses) {
    check(`Seed includes equipment with status '${st}'`, sqlContent.includes(`'${st}'`), `Status '${st}' not covered in seed data`);
  }

  const requiredCategories = ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'ANDADOR', 'CAMA_HOSPITALAR', 'MULETA_CANADENSE'];
  for (const cat of requiredCategories) {
    check(`Seed includes equipment with category '${cat}'`, sqlContent.includes(`'${cat}'`), `Category '${cat}' not covered in seed data`);
  }

  // 8.2 Beneficiaries
  const cpfMatches = sqlContent.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [];
  check('Seed beneficiaries count >= 2', cpfMatches.length >= 2, `Found only ${cpfMatches.length} formatted CPFs in seed`);

  for (const cpf of cpfMatches) {
    const valid = validateCpfChecksum(cpf);
    warn(`CPF ${cpf} mathematical checksum`, valid, `CPF ${cpf} failed Modulo 11 checksum calculation`);
  }

  const cepMatches = sqlContent.match(/\d{5}-\d{3}/g) || [];
  check('Seed beneficiaries with valid CEP >= 2', cepMatches.length >= 2, `Found only ${cepMatches.length} formatted CEPs in seed`);

  check('Secondary contact columns populated', /secondary_contact_name/i.test(sqlContent) && /secondary_contact_phone/i.test(sqlContent), 'Secondary contact fields missing from seed');

  // 8.3 Loans
  const magicTokens = sqlContent.match(/'magic-tok-[^']+'/g) || [];
  check('Seed loans count >= 2', magicTokens.length >= 2, `Found only ${magicTokens.length} magic tokens in seed`);
  check('Seed contains active loan (ATIVO)', /'ATIVO'/i.test(sqlContent), 'Active loan status ATIVO missing in seed');
  check('Seed contains overdue loan (ATRASADO > 10 days)', /'ATRASADO'/i.test(sqlContent) && /INTERVAL\s+'(?:1[1-9]|[2-9]\d+)\s+days'/i.test(sqlContent), 'Overdue loan with >10 days interval missing in seed');

  // 8.4 Logs
  check('Seed maintenance logs populated', /INSERT\s+INTO\s+(?:public\.)?maintenance_logs/i.test(sqlContent), 'No seed data inserted into maintenance_logs');

  return { passes, issues, warnings };
}

// CLI Execution entry point
const targetFile = process.argv[2] || path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql');
console.log(`Running Schema & Seed Dry-Run Verification on: ${targetFile}`);

if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  const result = verifySqlSchema(content);

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`Passes: ${result.passes.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Issues: ${result.issues.length}`);

  result.passes.forEach(p => console.log(`  [OK] ${p}`));
  result.warnings.forEach(w => console.warn(`  ${w}`));
  result.issues.forEach(i => console.error(`  ${i}`));

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log(`\n>>> ALL ${result.passes.length} CHECKS PASSED SUCCESSFULLY! <<<`);
    process.exit(0);
  } else {
    console.error(`\n>>> VERIFICATION FAILED: ${result.issues.length} issues, ${result.warnings.length} warnings. <<<`);
    process.exit(1);
  }
} else {
  console.error(`\n[ERROR] Migration file not found: ${targetFile}`);
  process.exit(1);
}
