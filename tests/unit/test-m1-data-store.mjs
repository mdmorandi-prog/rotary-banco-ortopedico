// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - ADVERSARIAL VALIDATION SUITE (M1 DATA STORE)
// Challenger 2: Empirical Stress Harness, Invariant Oracles, and Contrast Verifier
// ==============================================================================

import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------------------
// Self-Bootstrapping: If run via plain node without TypeScript module resolution,
// seamlessly re-executes using npx.cmd tsx.
// ------------------------------------------------------------------------------
let localStore;
let initialMockEquipments;
let initialMockBeneficiaries;
let initialMockLoans;
let initialMockEvents;
let dataRepository;
let ROTARY_BRAND;

try {
  const storeMod = await import('../../src/lib/mock-store/local-store');
  const mockMod = await import('../../src/lib/mock-store/mock-data');
  const repoMod = await import('../../src/lib/data-layer/repository');
  const constMod = await import('../../src/lib/constants');

  localStore = storeMod.localStore;
  initialMockEquipments = mockMod.initialMockEquipments;
  initialMockBeneficiaries = mockMod.initialMockBeneficiaries;
  initialMockLoans = mockMod.initialMockLoans;
  initialMockEvents = mockMod.initialMockEvents;
  dataRepository = repoMod.dataRepository;
  ROTARY_BRAND = constMod.ROTARY_BRAND;
} catch (importErr) {
  if (!process.env.TSX_SPAWNED) {
    const { spawnSync } = await import('node:child_process');
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    const filePath = fileURLToPath(import.meta.url);
    const result = spawnSync(cmd, ['tsx', filePath], {
      stdio: 'inherit',
      shell: isWindows,
      env: { ...process.env, TSX_SPAWNED: '1' },
    });
    process.exit(result.status ?? 0);
  } else {
    throw importErr;
  }
}

// ------------------------------------------------------------------------------
// Test Runner Harness
// ------------------------------------------------------------------------------
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

function suite(name) {
  console.log(`\n======================================================================`);
  console.log(`▶ ${name}`);
  console.log(`======================================================================`);
}

// ------------------------------------------------------------------------------
// WCAG 2.1 Contrast Helpers
// ------------------------------------------------------------------------------
function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ==============================================================================
// TEST EXECUTION
// ==============================================================================

async function runAllTests() {
  console.log('ROTARY BANCO ORTOPÉDICO — EMPIRICAL CHALLENGER 2 VALIDATION SUITE');
  console.log(`Execution Environment: Node ${process.version} | TSX Loader`);

  // ----------------------------------------------------------------------------
  // SUITE 1: Contract Compliance & Enums Verification
  // ----------------------------------------------------------------------------
  suite('Suite 1: Contract Compliance & Domain Types');

  await test('T1.1: EquipmentStatus Enum has exactly all 6 canonical values', async () => {
    const requiredStatuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const typesPath = path.resolve('src/lib/data-layer/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    for (const st of requiredStatuses) {
      assert.ok(content.includes(`'${st}'`), `EquipmentStatus must include '${st}'`);
    }
  });

  await test('T1.2: EquipmentCategory Enum includes all required core categories', async () => {
    const coreCategories = ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'MULETA', 'ANDADOR', 'CAMA_HOSPITALAR', 'OUTROS'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const typesPath = path.resolve('src/lib/data-layer/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    for (const cat of coreCategories) {
      assert.ok(content.includes(`'${cat}'`), `EquipmentCategory must include '${cat}'`);
    }
  });

  await test('T1.3: EquipmentCondition Enum includes all condition grades', async () => {
    const grades = ['NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const typesPath = path.resolve('src/lib/data-layer/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    for (const g of grades) {
      assert.ok(content.includes(`'${g}'`), `EquipmentCondition must include '${g}'`);
    }
    assert.ok(content.includes("'SUCATA'") || content.includes("'SUCATEADO'"), 'Condition must include SUCATA/SUCATEADO');
  });

  await test('T1.4: LoanStatus Enum includes active, overdue, renewed, returned, and lost', async () => {
    const loanStatuses = ['ATIVO', 'RENOVADO', 'ATRASADO', 'DEVOLVIDO', 'PERDIDO_EXTRAVIADO'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const typesPath = path.resolve('src/lib/data-layer/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    for (const ls of loanStatuses) {
      assert.ok(content.includes(`'${ls}'`), `LoanStatus must include '${ls}'`);
    }
  });

  await test('T1.5: CloseReason Enum includes mandatory legal/operational reasons', async () => {
    const closeReasons = ['RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA'];
    const fs = await import('node:fs');
    const path = await import('node:path');
    const typesPath = path.resolve('src/lib/data-layer/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    for (const cr of closeReasons) {
      assert.ok(content.includes(`'${cr}'`), `CloseReason must include '${cr}'`);
    }
  });

  // ----------------------------------------------------------------------------
  // SUITE 2: Initial Seed Validity
  // ----------------------------------------------------------------------------
  suite('Suite 2: Initial Seed Dataset Validity');

  await test('T2.1: Exactly 8 initial equipments pre-seeded in mock dataset', async () => {
    assert.strictEqual(initialMockEquipments.length, 8, `Expected exactly 8 equipments, got ${initialMockEquipments.length}`);
  });

  await test('T2.2: Initial equipments cover diverse statuses and categories', async () => {
    const statusesFound = new Set(initialMockEquipments.map((e) => e.status));
    const categoriesFound = new Set(initialMockEquipments.map((e) => e.category));

    // Must cover at least DISPONIVEL, EMPRESTADO, ATRASADO, HIGIENIZACAO, MANUTENCAO
    assert.ok(statusesFound.has('DISPONIVEL'), 'Must include DISPONIVEL');
    assert.ok(statusesFound.has('EMPRESTADO'), 'Must include EMPRESTADO');
    assert.ok(statusesFound.has('ATRASADO'), 'Must include ATRASADO');
    assert.ok(statusesFound.has('HIGIENIZACAO'), 'Must include HIGIENIZACAO');
    assert.ok(statusesFound.has('MANUTENCAO'), 'Must include MANUTENCAO');
    assert.strictEqual(statusesFound.size >= 5, true, `Expected >= 5 distinct operational statuses, found ${statusesFound.size}`);

    // Must cover major categories
    assert.ok(categoriesFound.has('CADEIRA_RODAS'), 'Must include CADEIRA_RODAS');
    assert.ok(categoriesFound.has('CADEIRA_BANHO'), 'Must include CADEIRA_BANHO');
    assert.ok(categoriesFound.has('ANDADOR'), 'Must include ANDADOR');
    assert.ok(categoriesFound.has('CAMA_HOSPITALAR'), 'Must include CAMA_HOSPITALAR');
    assert.ok(categoriesFound.has('MULETA') || categoriesFound.has('MULETA_CANADENSE'), 'Must include MULETA');
  });

  await test('T2.3: All equipments have valid patrimony_code, qr_token, and positive replacement_value', async () => {
    const patrimonyRegex = /^ROT-[A-Z]+-\d{3}$/;
    for (const eq of initialMockEquipments) {
      assert.ok(patrimonyRegex.test(eq.patrimony_code), `Patrimony code ${eq.patrimony_code} must match ROT-XXX-NNN`);
      assert.ok(typeof eq.qr_token === 'string' && eq.qr_token.length > 5, `Equipment ${eq.id} must have valid qr_token`);
      assert.ok(typeof eq.replacement_value === 'number' && eq.replacement_value > 0, `Replacement value must be > 0 for Comodato art. 582 CCB`);
    }
  });

  await test('T2.4: Exactly 2 initial beneficiaries with mandatory secondary contacts', async () => {
    assert.strictEqual(initialMockBeneficiaries.length, 2, `Expected exactly 2 beneficiaries, got ${initialMockBeneficiaries.length}`);
    for (const ben of initialMockBeneficiaries) {
      assert.ok(ben.full_name && ben.full_name.trim().length > 3, 'Beneficiary must have full_name');
      assert.ok(ben.cpf && ben.cpf.length >= 11, 'Beneficiary must have valid CPF');
      assert.ok(ben.phone && ben.phone.length >= 8, 'Beneficiary must have phone');
      assert.ok(ben.secondary_name && ben.secondary_name.trim().length > 3, 'Beneficiary must have secondary_name');
      assert.ok(ben.secondary_relationship && ben.secondary_relationship.trim().length > 1, 'Beneficiary must have secondary_relationship');
      assert.ok(ben.secondary_phone && ben.secondary_phone.trim().length >= 8, 'Beneficiary must have secondary_phone');
    }
  });

  await test('T2.5: Exactly 2 initial loans (1 active, 1 overdue) with referential integrity', async () => {
    assert.strictEqual(initialMockLoans.length, 2, `Expected exactly 2 loans, got ${initialMockLoans.length}`);
    const active = initialMockLoans.find((l) => l.status === 'ATIVO');
    const overdue = initialMockLoans.find((l) => l.status === 'ATRASADO');

    assert.ok(active, 'Initial seed must have exactly 1 ATIVO loan');
    assert.ok(overdue, 'Initial seed must have exactly 1 ATRASADO loan');

    // Referential integrity check
    for (const loan of initialMockLoans) {
      const eq = initialMockEquipments.find((e) => e.id === loan.equipment_id);
      const ben = initialMockBeneficiaries.find((b) => b.id === loan.beneficiary_id);
      assert.ok(eq, `Loan ${loan.id} references valid equipment ${loan.equipment_id}`);
      assert.ok(ben, `Loan ${loan.id} references valid beneficiary ${loan.beneficiary_id}`);
      assert.ok(loan.magic_token && loan.magic_token.length > 5, 'Loan must have magic_token');
      assert.ok(loan.replacement_value > 0, 'Loan replacement value must be positive');
    }

    // Equipment status alignment
    const activeEq = initialMockEquipments.find((e) => e.id === active.equipment_id);
    const overdueEq = initialMockEquipments.find((e) => e.id === overdue.equipment_id);
    assert.strictEqual(activeEq.status, 'EMPRESTADO', 'Equipment associated with ATIVO loan must have status EMPRESTADO');
    assert.strictEqual(overdueEq.status, 'ATRASADO', 'Equipment associated with ATRASADO loan must have status ATRASADO');
  });

  // ----------------------------------------------------------------------------
  // SUITE 3: Query Filters & Repository Lookups
  // ----------------------------------------------------------------------------
  suite('Suite 3: Query Filters & Repository Lookups');

  // Ensure store is pristine before testing queries
  localStore.resetToInitialSeed();

  await test('T3.1: Filter equipments by status DISPONIVEL returns exactly 3 items', async () => {
    const results = await localStore.getEquipments({ status: 'DISPONIVEL' });
    assert.strictEqual(results.length, 3, `Expected 3 available items, got ${results.length}`);
    for (const item of results) {
      assert.strictEqual(item.status, 'DISPONIVEL');
    }
  });

  await test('T3.2: Filter equipments by status EMPRESTADO returns exactly 2 items', async () => {
    const results = await localStore.getEquipments({ status: 'EMPRESTADO' });
    assert.strictEqual(results.length, 2, `Expected 2 loaned items, got ${results.length}`);
    for (const item of results) {
      assert.strictEqual(item.status, 'EMPRESTADO');
    }
  });

  await test('T3.3: Filter equipments by category CADEIRA_BANHO returns 2 items', async () => {
    const results = await localStore.getEquipments({ category: 'CADEIRA_BANHO' });
    assert.strictEqual(results.length, 2, `Expected 2 bath chairs, got ${results.length}`);
    for (const item of results) {
      assert.strictEqual(item.category, 'CADEIRA_BANHO');
    }
  });

  await test('T3.4: Case-insensitive substring search by brand/model', async () => {
    const lower = await localStore.getEquipments({ search: 'ortobras' });
    const upper = await localStore.getEquipments({ search: 'ORTOBRAS' });
    const mixed = await localStore.getEquipments({ search: '  OrToBrAs  ' });

    assert.strictEqual(lower.length, 1);
    assert.strictEqual(upper.length, 1);
    assert.strictEqual(mixed.length, 1);
    assert.strictEqual(lower[0].patrimony_code, 'ROT-CR-001');
  });

  await test('T3.5: Search by patrimony_code and serial_number', async () => {
    const byPatrimony = await localStore.getEquipments({ search: 'rot-and-001' });
    assert.strictEqual(byPatrimony.length, 1);
    assert.strictEqual(byPatrimony[0].patrimony_code, 'ROT-AND-001');

    const bySerial = await localStore.getEquipments({ search: 'SEQ-2023-8871' });
    assert.strictEqual(bySerial.length, 1);
    assert.strictEqual(bySerial[0].patrimony_code, 'ROT-AND-001');
  });

  await test('T3.6: Non-existent search query returns empty array without throwing', async () => {
    const results = await localStore.getEquipments({ search: 'NAO_EXISTE_XYZ_9999' });
    assert.ok(Array.isArray(results), 'Must return array');
    assert.strictEqual(results.length, 0, 'Must be empty array');
  });

  await test('T3.7: getEquipmentByQrToken handles exact, uppercase, and patrimony fallback', async () => {
    const eq = await localStore.getEquipmentByQrToken('rotary-item-rot-cr-001');
    assert.ok(eq, 'Must resolve exact token');
    assert.strictEqual(eq.patrimony_code, 'ROT-CR-001');

    const eqUpper = await localStore.getEquipmentByQrToken('ROTARY-ITEM-ROT-CR-001');
    assert.ok(eqUpper, 'Must resolve uppercase token');
    assert.strictEqual(eqUpper.id, eq.id);

    const eqPatrimony = await localStore.getEquipmentByQrToken('ROT-CR-001');
    assert.ok(eqPatrimony, 'Must resolve direct patrimony code');
    assert.strictEqual(eqPatrimony.id, eq.id);

    const eqNull = await localStore.getEquipmentByQrToken('token-fake-inexistente');
    assert.strictEqual(eqNull, null, 'Unmatched token returns null');
  });

  await test('T3.8: getBeneficiaryByCpf sanitizes punctuation', async () => {
    const benFormatted = await localStore.getBeneficiaryByCpf('123.456.789-00');
    const benRaw = await localStore.getBeneficiaryByCpf('12345678900');
    assert.ok(benFormatted, 'Must find formatted CPF');
    assert.ok(benRaw, 'Must find unformatted CPF');
    assert.strictEqual(benFormatted.id, benRaw.id);
  });

  await test('T3.9: getLoans hydrates nested equipment and beneficiary relationships', async () => {
    const loans = await localStore.getLoans();
    assert.strictEqual(loans.length, 2);
    for (const loan of loans) {
      assert.ok(loan.equipment, `Loan ${loan.id} must have hydrated equipment`);
      assert.ok(loan.beneficiary, `Loan ${loan.id} must have hydrated beneficiary`);
      assert.strictEqual(loan.equipment.id, loan.equipment_id);
      assert.strictEqual(loan.beneficiary.id, loan.beneficiary_id);
    }
  });

  // ----------------------------------------------------------------------------
  // SUITE 4: State Machine Mutations & Simulated Triggers
  // ----------------------------------------------------------------------------
  suite('Suite 4: State Machine Mutations & Database Triggers');

  localStore.resetToInitialSeed();

  await test('T4.1: Creating loan on DISPONIVEL equipment transitions status to EMPRESTADO', async () => {
    // eq-001 is DISPONIVEL
    const eqBefore = await localStore.getEquipmentById('eq-001');
    assert.strictEqual(eqBefore.status, 'DISPONIVEL');

    const newLoan = await localStore.createLoan({
      equipment_id: 'eq-001',
      beneficiary: {
        full_name: 'Antônio Ferreira Lima',
        cpf: '345.678.901-22',
        phone: '(11) 97777-8888',
        address_street: 'Rua das Palmeiras',
        address_number: '500',
        address_neighborhood: 'Centro',
        address_city: 'Santos',
        address_state: 'SP',
        address_zipcode: '11010-000',
        secondary_name: 'Beatriz Ferreira Lima',
        secondary_relationship: 'Filha',
        secondary_phone: '(11) 97777-9999',
      },
      term_days: 30,
      signature_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      notes: 'Teste adversarial empréstimo',
    });

    assert.ok(newLoan.id, 'Must generate loan id');
    assert.strictEqual(newLoan.status, 'ATIVO', 'New loan status must be ATIVO');
    assert.strictEqual(newLoan.renewal_count, 0, 'New loan renewal_count must be 0');
    assert.strictEqual(newLoan.max_renewals, 3, 'New loan max_renewals must be 3');
    assert.strictEqual(newLoan.replacement_value, 850.0, 'Must inherit equipment replacement_value');

    // Trigger simulation verification: Equipment status is now EMPRESTADO
    const eqAfter = await localStore.getEquipmentById('eq-001');
    assert.strictEqual(eqAfter.status, 'EMPRESTADO', 'Equipment must transition to EMPRESTADO');

    // Audit log check
    const events = await localStore.getLoanEvents(newLoan.id);
    assert.ok(events.length >= 1, 'Must record audit log event');
    assert.strictEqual(events[0].event_type, 'CREATED');
  });

  await test('T4.2: Negative Test: Creating loan on already EMPRESTADO equipment throws error', async () => {
    let threw = false;
    try {
      // eq-001 was just loaned in T4.1, status is now EMPRESTADO
      await localStore.createLoan({
        equipment_id: 'eq-001',
        beneficiary: {
          full_name: 'Outro Paciente',
          cpf: '456.789.012-33',
          phone: '(11) 96666-5555',
          address_street: 'Rua B',
          address_number: '10',
          address_neighborhood: 'Bairro',
          address_city: 'Santos',
          address_state: 'SP',
          address_zipcode: '11000-000',
          secondary_name: 'Contato 2',
          secondary_relationship: 'Amigo',
          secondary_phone: '(11) 96666-4444',
        },
        term_days: 30,
        signature_data_url: 'data:image/png;base64,dummy',
      });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('não está DISPONÍVEL'), `Error should mention unavailable status, got: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Must throw error when attempting to loan EMPRESTADO equipment');
  });

  await test('T4.3: Negative Test: Creating loan on MANUTENCAO equipment throws error', async () => {
    let threw = false;
    try {
      // eq-007 is MANUTENCAO
      await localStore.createLoan({
        equipment_id: 'eq-007',
        beneficiary: {
          full_name: 'Paciente Teste',
          cpf: '567.890.123-44',
          phone: '(11) 95555-4444',
          address_street: 'Rua C',
          address_number: '20',
          address_neighborhood: 'Bairro',
          address_city: 'Santos',
          address_state: 'SP',
          address_zipcode: '11000-000',
          secondary_name: 'Contato',
          secondary_relationship: 'Pai',
          secondary_phone: '(11) 95555-3333',
        },
        term_days: 30,
        signature_data_url: 'data:image/png;base64,dummy',
      });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('MANUTENCAO') || err.message.includes('não está DISPONÍVEL'));
    }
    assert.strictEqual(threw, true, 'Must throw error when attempting to loan MANUTENCAO equipment');
  });

  await test('T4.4: Negative Test: Creating loan on non-existent equipment throws error', async () => {
    let threw = false;
    try {
      await localStore.createLoan({
        equipment_id: 'eq-ghost-inexistente',
        beneficiary: {
          full_name: 'Paciente Fantasma',
          cpf: '000.000.000-00',
          phone: '(11) 90000-0000',
          address_street: 'Rua Fantasma',
          address_number: '0',
          address_neighborhood: 'Limbo',
          address_city: 'Santos',
          address_state: 'SP',
          address_zipcode: '11000-000',
          secondary_name: 'Secundário',
          secondary_relationship: 'Outro',
          secondary_phone: '(11) 90000-1111',
        },
        term_days: 30,
        signature_data_url: 'data:image/png;base64,dummy',
      });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('não encontrado'), `Error should state equipment not found, got: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Must throw when equipment id does not exist');
  });

  await test('T4.5: Loan renewal increments renewal_count and extends return date by 30 days', async () => {
    const activeLoan = await localStore.getLoanById('loan-001');
    const initialExpected = new Date(activeLoan.expected_return_date).getTime();
    const initialRenewals = activeLoan.renewal_count;

    const result = await localStore.renewLoan(activeLoan.magic_token);
    assert.strictEqual(result.success, true, 'Renewal must succeed');
    assert.ok(result.loan, 'Must return renewed loan object');
    assert.strictEqual(result.loan.renewal_count, initialRenewals + 1, 'Renewal count must increment by 1');

    const newExpected = new Date(result.loan.expected_return_date).getTime();
    const diffDays = Math.round((newExpected - initialExpected) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 30, `Expected return date must extend by exactly 30 days, got ${diffDays}`);
  });

  await test('T4.6: Renewing an ATRASADO loan resets status to ATIVO and equipment to EMPRESTADO', async () => {
    // loan-002 is ATRASADO, equipment eq-004 is ATRASADO
    const overdueLoan = await localStore.getLoanById('loan-002');
    assert.strictEqual(overdueLoan.status, 'ATRASADO');
    const eqOverdue = await localStore.getEquipmentById(overdueLoan.equipment_id);
    assert.strictEqual(eqOverdue.status, 'ATRASADO');

    const result = await localStore.renewLoan(overdueLoan.magic_token);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.loan.status, 'ATIVO', 'Loan status must reset from ATRASADO to ATIVO');

    const eqRestored = await localStore.getEquipmentById(overdueLoan.equipment_id);
    assert.strictEqual(eqRestored.status, 'EMPRESTADO', 'Equipment status must transition from ATRASADO to EMPRESTADO');
  });

  await test('T4.7: Max renewals guard blocks renewal after max_renewals (3)', async () => {
    // loan-001 already has 1 renewal from T4.5
    const loan = await localStore.getLoanById('loan-001');
    const token = loan.magic_token;

    // Perform renewal 2
    const r2 = await localStore.renewLoan(token);
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r2.loan.renewal_count, 2);

    // Perform renewal 3 (max reached)
    const r3 = await localStore.renewLoan(token);
    assert.strictEqual(r3.success, true);
    assert.strictEqual(r3.loan.renewal_count, 3);

    // Perform renewal 4 (must be blocked)
    const r4 = await localStore.renewLoan(token);
    assert.strictEqual(r4.success, false, 'Renewal 4 must be rejected');
    assert.strictEqual(r4.max_reached, true, 'max_reached flag must be true');
    assert.ok(r4.message.includes('Limite de renovações atingido'), 'Message must explain max limit reached');
  });

  await test('T4.8: Return triage destination HIGIENIZACAO updates loan to DEVOLVIDO and equipment to HIGIENIZACAO', async () => {
    // Return loan-001 with destination HIGIENIZACAO
    const result = await localStore.returnLoan('loan-001', {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Devolvido em perfeito estado pelo filho.',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.loan.status, 'DEVOLVIDO');
    assert.strictEqual(result.loan.quittance_issued, true, 'Quittance receipt must be issued under CCB art. 320');
    assert.ok(result.loan.actual_return_date, 'actual_return_date must be set');

    const eq = await localStore.getEquipmentById(result.loan.equipment_id);
    assert.strictEqual(eq.status, 'HIGIENIZACAO', 'Equipment must route to HIGIENIZACAO destination');
    assert.strictEqual(eq.condition, 'BOM', 'Equipment condition must update');
  });

  await test('T4.9: Return triage destination MANUTENCAO and condition PRECISA_REPARO', async () => {
    // loan-002 was renewed and is now ATIVO. Let's return it with destination MANUTENCAO
    const result = await localStore.returnLoan('loan-002', {
      condition: 'PRECISA_REPARO',
      close_reason: 'TROCA_EQUIPAMENTO',
      destination: 'MANUTENCAO',
      notes: 'Ponteira desgastada necessitando troca',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.loan.status, 'DEVOLVIDO');

    const eq = await localStore.getEquipmentById(result.loan.equipment_id);
    assert.strictEqual(eq.status, 'MANUTENCAO', 'Equipment must route to MANUTENCAO');
    assert.strictEqual(eq.condition, 'PRECISA_REPARO', 'Equipment condition must update to PRECISA_REPARO');
  });

  await test('T4.10: Closed loans (DEVOLVIDO) cannot be renewed via magic token', async () => {
    const loan = await localStore.getLoanById('loan-001');
    assert.strictEqual(loan.status, 'DEVOLVIDO');
    const result = await localStore.renewLoan(loan.magic_token);
    assert.strictEqual(result.success, false, 'Renewal on returned loan must fail');
    assert.ok(result.message.includes('já foi encerrado'));
  });

  await test('T4.11: resetToInitialSeed restores exact initial state after extensive mutations', async () => {
    localStore.resetToInitialSeed();

    const eqs = await localStore.getEquipments();
    const bens = await localStore.getBeneficiaries();
    const loans = await localStore.getLoans();

    assert.strictEqual(eqs.length, 8, 'Equipments restored to 8');
    assert.strictEqual(bens.length, 2, 'Beneficiaries restored to 2');
    assert.strictEqual(loans.length, 2, 'Loans restored to 2');

    const eq1 = await localStore.getEquipmentById('eq-001');
    assert.strictEqual(eq1.status, 'DISPONIVEL', 'eq-001 restored to DISPONIVEL');

    const eq2 = await localStore.getEquipmentById('eq-002');
    assert.strictEqual(eq2.status, 'EMPRESTADO', 'eq-002 restored to EMPRESTADO');

    const eq4 = await localStore.getEquipmentById('eq-004');
    assert.strictEqual(eq4.status, 'ATRASADO', 'eq-004 restored to ATRASADO');

    const l2 = await localStore.getLoanById('loan-002');
    assert.strictEqual(l2.status, 'ATRASADO', 'loan-002 restored to ATRASADO');
    assert.strictEqual(l2.renewal_count, 0, 'loan-002 renewal_count restored to 0');
  });

  // ----------------------------------------------------------------------------
  // SUITE 5: Dashboard Metrics Computation
  // ----------------------------------------------------------------------------
  suite('Suite 5: Dashboard Metrics Computation');

  localStore.resetToInitialSeed();

  await test('T5.1: Initial dashboard metrics exact numerical validation', async () => {
    const m = await localStore.getDashboardMetrics();
    assert.strictEqual(m.totalEquipments, 8, `totalEquipments expected 8, got ${m.totalEquipments}`);
    assert.strictEqual(m.availableCount, 3, `availableCount expected 3, got ${m.availableCount}`);
    assert.strictEqual(m.loanedCount, 2, `loanedCount expected 2, got ${m.loanedCount}`);
    assert.strictEqual(m.overdueCount, 1, `overdueCount expected 1, got ${m.overdueCount}`);
    assert.strictEqual(m.maintenanceCount, 2, `maintenanceCount (1 hig + 1 man) expected 2, got ${m.maintenanceCount}`);
    assert.strictEqual(m.totalBeneficiaries, 2, `totalBeneficiaries expected 2, got ${m.totalBeneficiaries}`);
    // Value at risk = replacement value of eq-002 (1200) + eq-004 (280) = 1480.00
    assert.strictEqual(m.valueAtRisk, 1480.0, `valueAtRisk expected 1480.00, got ${m.valueAtRisk}`);
  });

  // ----------------------------------------------------------------------------
  // SUITE 6: Relative Luminance & WCAG AA/AAA Contrast Calculations
  // ----------------------------------------------------------------------------
  suite('Suite 6: Accessibility & WCAG Contrast Calculations');

  const BLUE = '#17458f';
  const GOLD = '#f7a81b';
  const WHITE = '#ffffff';
  const BLACK = '#000000';
  const NAVY = '#0c2340';
  const CHARCOAL = '#1e293b';

  await test('T6.1: Relative luminance of brand tokens is mathematically accurate', async () => {
    const lumBlue = relativeLuminance(BLUE);
    const lumGold = relativeLuminance(GOLD);
    const lumWhite = relativeLuminance(WHITE);
    const lumBlack = relativeLuminance(BLACK);

    assert.strictEqual(lumWhite, 1.0, 'White luminance must be exactly 1.0');
    assert.strictEqual(lumBlack, 0.0, 'Black luminance must be exactly 0.0');
    assert.ok(Math.abs(lumBlue - 0.0642) < 0.002, `Blue luminance expected ~0.0642, got ${lumBlue.toFixed(4)}`);
    assert.ok(Math.abs(lumGold - 0.4786) < 0.002, `Gold luminance expected ~0.4786, got ${lumGold.toFixed(4)}`);
  });

  await test('T6.2: Rotary Royal Blue (#17458f) on White achieves >= 7:1 (WCAG AAA)', async () => {
    const cr = contrastRatio(BLUE, WHITE);
    console.log(`       [Contrast] Rotary Royal Blue on White: ${cr.toFixed(2)}:1 (WCAG AAA >= 7.0:1)`);
    assert.ok(cr >= 7.0, `Expected contrast >= 7.0:1, got ${cr.toFixed(2)}:1`);
  });

  await test('T6.3: Rotary Gold (#f7a81b) text on White FAILS WCAG AA (< 4.5:1)', async () => {
    const cr = contrastRatio(GOLD, WHITE);
    console.log(`       [Contrast] Rotary Gold text on White: ${cr.toFixed(2)}:1 (FAIL < 4.5:1 — verifies design restriction)`);
    assert.ok(cr < 4.5, `Rotary Gold on White must be < 4.5:1, got ${cr.toFixed(2)}:1`);
  });

  await test('T6.4: White text on Rotary Gold (#f7a81b) FAILS WCAG AA (< 4.5:1)', async () => {
    const cr = contrastRatio(WHITE, GOLD);
    console.log(`       [Contrast] White text on Rotary Gold background: ${cr.toFixed(2)}:1 (FAIL < 4.5:1 — proves dark text rule)`);
    assert.ok(cr < 4.5, `White on Gold must be < 4.5:1, got ${cr.toFixed(2)}:1`);
  });

  await test('T6.5: Rotary Royal Blue (#17458f) text on Rotary Gold achieves >= 4.5:1 (WCAG AA)', async () => {
    const cr = contrastRatio(BLUE, GOLD);
    console.log(`       [Contrast] Rotary Royal Blue text on Rotary Gold background: ${cr.toFixed(2)}:1 (WCAG AA >= 4.5:1)`);
    assert.ok(cr >= 4.5, `Expected contrast >= 4.5:1, got ${cr.toFixed(2)}:1`);
  });

  await test('T6.6: Navy (#0c2340) text on Rotary Gold achieves >= 7:1 (WCAG AAA)', async () => {
    const cr = contrastRatio(NAVY, GOLD);
    console.log(`       [Contrast] Navy text on Rotary Gold background: ${cr.toFixed(2)}:1 (WCAG AAA >= 7.0:1)`);
    assert.ok(cr >= 7.0, `Expected contrast >= 7.0:1, got ${cr.toFixed(2)}:1`);
  });

  await test('T6.7: Charcoal (#1e293b) text on Rotary Gold achieves >= 7:1 (WCAG AAA)', async () => {
    const cr = contrastRatio(CHARCOAL, GOLD);
    console.log(`       [Contrast] Charcoal text on Rotary Gold background: ${cr.toFixed(2)}:1 (WCAG AAA >= 7.0:1)`);
    assert.ok(cr >= 7.0, `Expected contrast >= 7.0:1, got ${cr.toFixed(2)}:1`);
  });

  // ----------------------------------------------------------------------------
  // SUITE 7: Adversarial Edge Stress & Boundary Cases
  // ----------------------------------------------------------------------------
  suite('Suite 7: Adversarial Edge Stress & Boundary Cases');

  localStore.resetToInitialSeed();

  await test('T7.1: Multi-cycle equipment lifecycle (DISPONIVEL -> EMPRESTADO -> HIGIENIZACAO -> DISPONIVEL)', async () => {
    // Cycle 1: Loan eq-003 (DISPONIVEL)
    const eq3 = await localStore.getEquipmentById('eq-003');
    assert.strictEqual(eq3.status, 'DISPONIVEL');

    const l1 = await localStore.createLoan({
      equipment_id: 'eq-003',
      beneficiary: {
        full_name: 'Ciclo Teste 1',
        cpf: '789.012.345-66',
        phone: '(11) 94444-1111',
        address_street: 'Rua Ciclo',
        address_number: '1',
        address_neighborhood: 'Bela Vista',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zipcode: '01311-000',
        secondary_name: 'Contato Ciclo',
        secondary_relationship: 'Irmão',
        secondary_phone: '(11) 94444-2222',
      },
      term_days: 15,
      signature_data_url: 'data:image/png;base64,sig1',
    });

    const eq3Loaned = await localStore.getEquipmentById('eq-003');
    assert.strictEqual(eq3Loaned.status, 'EMPRESTADO');

    // Return to HIGIENIZACAO
    await localStore.returnLoan(l1.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
    });

    const eq3Hig = await localStore.getEquipmentById('eq-003');
    assert.strictEqual(eq3Hig.status, 'HIGIENIZACAO');

    // Attempting to loan while in HIGIENIZACAO must fail
    let threwInHig = false;
    try {
      await localStore.createLoan({
        equipment_id: 'eq-003',
        beneficiary: {
          full_name: 'Ciclo Teste 2',
          cpf: '789.012.345-77',
          phone: '(11) 94444-3333',
          address_street: 'Rua Ciclo',
          address_number: '2',
          address_neighborhood: 'Bela Vista',
          address_city: 'São Paulo',
          address_state: 'SP',
          address_zipcode: '01311-000',
          secondary_name: 'Contato 2',
          secondary_relationship: 'Irmão',
          secondary_phone: '(11) 94444-4444',
        },
        term_days: 30,
        signature_data_url: 'data:image/png;base64,sig2',
      });
    } catch {
      threwInHig = true;
    }
    assert.strictEqual(threwInHig, true, 'Cannot loan item while in HIGIENIZACAO');

    // Release from HIGIENIZACAO to DISPONIVEL
    await localStore.releaseEquipment('eq-003', 'DISPONIVEL', 'Higienização hospitalar concluída');
    const eq3Released = await localStore.getEquipmentById('eq-003');
    assert.strictEqual(eq3Released.status, 'DISPONIVEL');

    // Now re-loan succeeds
    const l2 = await localStore.createLoan({
      equipment_id: 'eq-003',
      beneficiary: {
        full_name: 'Ciclo Teste 3',
        cpf: '789.012.345-88',
        phone: '(11) 94444-5555',
        address_street: 'Rua Ciclo',
        address_number: '3',
        address_neighborhood: 'Bela Vista',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zipcode: '01311-000',
        secondary_name: 'Contato 3',
        secondary_relationship: 'Primo',
        secondary_phone: '(11) 94444-6666',
      },
      term_days: 60,
      signature_data_url: 'data:image/png;base64,sig3',
    });
    assert.strictEqual(l2.status, 'ATIVO');
    const eq3ReLoaned = await localStore.getEquipmentById('eq-003');
    assert.strictEqual(eq3ReLoaned.status, 'EMPRESTADO');
  });

  await test('T7.2: Beneficiary CPF duplicate upsert updates existing record without duplicate IDs', async () => {
    const existing = await localStore.getBeneficiaryByCpf('123.456.789-00');
    assert.ok(existing);
    const originalId = existing.id;

    // Create beneficiary with same CPF but updated address
    const updated = await localStore.createBeneficiary({
      full_name: 'Maria das Dores Silva Atualizada',
      cpf: '123.456.789-00',
      phone: '(11) 99999-0000',
      address_street: 'Nova Rua Flores',
      address_number: '999',
      address_neighborhood: 'Novo Bairro',
      address_city: 'Santos',
      address_state: 'SP',
      address_zipcode: '11000-000',
      secondary_name: 'Carlos Alberto Silva',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 98111-2222',
    });

    assert.strictEqual(updated.id, originalId, 'Upsert must retain existing beneficiary id');
    assert.strictEqual(updated.full_name, 'Maria das Dores Silva Atualizada');

    // Total count must remain unchanged
    const allBens = await localStore.getBeneficiaries();
    assert.strictEqual(allBens.filter((b) => b.cpf.replace(/[^\d]/g, '') === '12345678900').length, 1);
  });

  await test('T7.3: Extreme search queries with SQL injection strings, null characters, and emojis', async () => {
    const hostileQueries = [
      "' OR '1'='1",
      "'; DROP TABLE equipments; --",
      "\\x00\\x00\\x00",
      "🦽🩺 wheelchair 🏥",
      "<script>alert(1)</script>",
      "SELECT * FROM loans WHERE 1=1",
      "           ",
    ];

    for (const q of hostileQueries) {
      // Must not throw uncaught error
      const results = await localStore.getEquipments({ search: q });
      assert.ok(Array.isArray(results), `Query '${q}' must return array without crashing`);
    }
  });

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log(`\n======================================================================`);
  console.log(`  ADVERSARIAL SUITE SUMMARY`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`  Total Tests Run:  ${totalTests}`);
  console.log(`  Passed:           ${passedTests}`);
  console.log(`  Failed:           ${failedTests}`);
  console.log(`  Execution Result: ${failedTests === 0 ? 'ALL PASSED (VERDICT: APPROVE)' : 'DEFECTS DETECTED (VERDICT: REJECT)'}`);
  console.log(`======================================================================\n`);

  if (failedTests > 0) {
    console.error('Failed Tests:');
    failures.forEach((f) => console.error(` - ${f.name}: ${f.error}`));
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal Test Harness Error:', e);
  process.exit(1);
});
