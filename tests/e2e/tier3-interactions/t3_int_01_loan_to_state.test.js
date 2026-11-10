/**
 * Tier 3: Interaction 01 — Loan Creation to Equipment State Synchronization (T3-INT-01)
 * Features: F4, F8, F11, F12, F13, F15, F16, F17, F18, F19
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 01 — Loan Creation to State Sync (T3-INT-01)', () => {
  let repo;
  let eq;
  let ben;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-wheelchair-01',
      patrimony_code: 'CR-042',
      replacement_value: 850.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Maria Silva',
      cpf: fixtures.generateValidCPF(),
      phone: '(11) 98888-1111',
      secondary_name: 'Carlos Silva',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 99999-2222'
    });
    repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben]
    });
  });

  test('T3-INT-01-A: End-to-end loan wizard creation transitions equipment to EMPRESTADO', async () => {
    // 1. Availability check
    const item = await repo.getEquipmentById('eq-wheelchair-01');
    assert.strictEqual(item.status, 'DISPONIVEL');

    // 2. Secondary contact validation
    assert.assertSecondaryContactValidation(ben);

    // 3. Create Loan
    const loan = await repo.createLoan({
      equipment_id: item.id,
      beneficiary: ben,
      term_days: 60,
      signature_data_url: 'data:image/png;base64,sample_signature'
    });

    // 4. Assert loan invariants
    assert.strictEqual(loan.status, 'ATIVO');
    assert.strictEqual(loan.renewal_count, 0);
    assert.strictEqual(loan.max_renewals, 3);
    assert.ok(loan.magic_token && loan.magic_token.length >= 16);

    // 5. Equipment state synchronization
    const updatedEq = await repo.getEquipmentById(item.id);
    assert.strictEqual(updatedEq.status, 'EMPRESTADO', 'Equipment must synchronize to EMPRESTADO');

    // 6. Audit log entry
    const events = repo._internal.eventLogs.filter(e => e.loan_id === loan.id);
    assert.ok(events.some(e => e.event_type === 'LOAN_CREATED'), 'Audit log must record LOAN_CREATED');
  });

  test('T3-INT-01-B: Duplicate loan attempt on already loaned equipment is strictly rejected (409)', async () => {
    // First loan
    await repo.createLoan({
      equipment_id: eq.id,
      beneficiary: ben,
      term_days: 30
    });

    // Second loan on same equipment
    const otherBen = fixtures.createMockBeneficiary();
    await assert.rejects(async () => {
      await repo.createLoan({
        equipment_id: eq.id,
        beneficiary: otherBen
      });
    }, /Equipment is not available for loan/);
  });

  test('T3-INT-01-C: Secondary phone collision blocks loan wizard progression', async () => {
    const collidingBen = fixtures.createMockBeneficiary({
      phone: '(11) 98888-1111',
      secondary_phone: '(11) 98888-1111'
    });

    await assert.rejects(async () => {
      await repo.createLoan({
        equipment_id: eq.id,
        beneficiary: collidingBen
      });
    }, /Secondary phone cannot be identical to primary phone/);
  });
});
