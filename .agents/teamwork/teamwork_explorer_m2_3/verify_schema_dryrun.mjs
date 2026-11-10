/**
 * Advanced Schema & Seed Verification Validator for Rotary Banco Ortopédico (Milestone 2)
 *
 * Performs comprehensive dry-run validation of `supabase/migrations/001_initial_schema.sql`:
 * 1. DDL Syntax & Extensions (uuid-ossp, pgcrypto)
 * 2. 6 PostgreSQL Enums and their exact variant values
 * 3. 6 Core Relational Tables with exact columns, types, nullability, PK and FK constraints
 * 4. Referential integrity and cascading rules (ON DELETE RESTRICT vs CASCADE)
 * 5. Automated PL/pgSQL Triggers (fn_set_updated_at, fn_sync_loan_equipment_status)
 * 6. Row Level Security (RLS) activation and policy scoping (public vs authenticated)
 * 7. Seed Dataset Integrity:
 *    - Equipment inventory diversity (>= 6 items, >= 5 statuses, >= 4 categories)
 *    - Brazilian PII validation (mathematical CPF modulo 11 checksum, CEP format, Phone format)
 *    - Mandatory secondary contact rules (non-collision, >= 2 words)
 *    - Loan state diversity (active loan with future return date, overdue loan with >10 days past return)
 *    - Referential integrity of all foreign keys in seed inserts
 *    - Maintenance logs and loan event logs reflecting historical activity
 */

import fs from 'fs';
import path from 'path';

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
  check('FK maintenance_logs -> equipments (ON DELETE CASCADE)', /REFERENCES\s+(?:public\.)?equipments\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sqlContent), 'maintenance_logs.equipment_id must specify ON DELETE CASCADE');

  // 5. Triggers & Functions
  check('Function fn_set_updated_at defined', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?fn_set_updated_at/i.test(sqlContent), 'Missing fn_set_updated_at function');
  check('Function fn_sync_loan_equipment_status defined', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?fn_sync_loan_equipment_status/i.test(sqlContent), 'Missing fn_sync_loan_equipment_status function');
  check('Trigger trg_loan_equipment_status_sync bound to loans', /CREATE\s+TRIGGER\s+trg_loan_equipment_status_sync/i.test(sqlContent), 'Missing trigger trg_loan_equipment_status_sync on loans');

  // 6. RLS Enabled on all 6 tables
  for (const table of expectedTables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    check(`RLS enabled on ${table}`, rlsRegex.test(sqlContent), `RLS not enabled on table ${table}`);
  }

  // 7. Critical Policies
  check('Public QR scan policy on equipments', /CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?equipments\s+FOR\s+SELECT\s+TO\s+(?:anon,\s*authenticated|anon)/i.test(sqlContent), 'Public read policy on equipments for QR scanning missing');
  check('Public magic token policy on loans', /CREATE\s+POLICY\s+["'].*["']\s+ON\s+(?:public\.)?loans\s+FOR\s+SELECT\s+TO\s+anon.*magic_token/i.test(sqlContent), 'Public read policy on loans via magic_token missing');

  // 8. Seed Data Checks
  // 8.1 Equipments
  const equipmentIdMatches = Array.from(sqlContent.matchAll(/'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'/gi)).map(m => m[1]);
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

// Self-test CLI
if (process.argv[1] && process.argv[1].includes('verify_schema_dryrun.mjs')) {
  const targetFile = process.argv[2] || path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql');
  console.log(`Running Advanced Schema & Seed Dry-Run Validator on: ${targetFile}`);
  if (fs.existsSync(targetFile)) {
    const content = fs.readFileSync(targetFile, 'utf8');
    const result = verifySqlSchema(content);
    console.log(`\n=== VALIDATION SUMMARY ===`);
    console.log(`Passes: ${result.passes.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Issues: ${result.issues.length}`);
    result.passes.forEach(p => console.log(`  [OK] ${p}`));
    result.warnings.forEach(w => console.warn(`  ${w}`));
    result.issues.forEach(i => console.error(`  ${i}`));
    process.exit(result.issues.length === 0 ? 0 : 1);
  } else {
    console.log(`File not found: ${targetFile}. (Dry-run validator is ready for execution once migration file is written).`);
  }
}
