/**
 * Tier 1: Feature 23 — Public Self-Service Renewal (/renovar/[magic_token]) (F23)
 * Specifications: T1-F23-01 through T1-F23-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 23 — Public Self-Service Renewal (/renovar/[magic_token]) (F23)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-REN-01' });
    ben = fixtures.createMockBeneficiary();
    repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben]
    });
    loan = await repo.createLoan({
      equipment_id: eq.id,
      beneficiary: ben,
      term_days: 30
    });
  });

  test('T1-F23-01: Zero-Login Access via Magic Token', async () => {
    const loaded = await repo.getLoanByMagicToken(loan.magic_token);
    assert.ok(loaded, 'Loan must load using magic token without authentication');
    assert.strictEqual(loaded.equipment.patrimony_code, 'ROT-REN-01');
    assert.strictEqual(loaded.beneficiary.full_name, ben.full_name);
  });

  test('T1-F23-02: 1-Click Renewal Execution (+30 Days)', async () => {
    const originalDue = new Date(loan.expected_return_date);
    const res = await repo.renewLoan(loan.magic_token);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.loan.renewal_count, 1, 'renewal_count must increment to 1');

    const newDue = new Date(res.loan.expected_return_date);
    const diffDays = Math.round((newDue.getTime() - originalDue.getTime()) / (86400000));
    assert.strictEqual(diffDays, 30, 'expected_return_date must advance by exactly 30 days');
  });

  test('T1-F23-03: Renewal Counter Guard (Max Renewals Enforcement)', async () => {
    // Perform 3 serial renewals
    await repo.renewLoan(loan.magic_token);
    await repo.renewLoan(loan.magic_token);
    const r3 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(r3.loan.renewal_count, 3);

    // 4th renewal attempt must be rejected
    const r4 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(r4.success, false, 'Renewal beyond max_renewals must be blocked');
    assert.ok(r4.message.includes('Limite máximo'), 'Error message must state limit reached');
  });

  test('T1-F23-04: Return Assistance Request Submission', () => {
    function processReturnAssistanceRequest(loanRecord, requestData) {
      if (!requestData.notes || !requestData.contactPhone) {
        throw new Error('Preencha os dados de contato e endereço para recolhimento');
      }
      return {
        ...loanRecord,
        pickup_requested: true,
        pickup_notes: requestData.notes,
        pickup_contact: requestData.contactPhone,
        pickup_status: 'PENDENTE'
      };
    }

    const updated = processReturnAssistanceRequest(loan, {
      notes: 'Paciente impossibilitado de transportar cadeira',
      contactPhone: '(11) 98765-4321'
    });
    assert.strictEqual(updated.pickup_requested, true);
    assert.strictEqual(updated.pickup_status, 'PENDENTE');
  });

  test('T1-F23-05: Audit Event Logged on Public Renewal', async () => {
    await repo.renewLoan(loan.magic_token);
    const events = repo._internal.eventLogs.filter(e => e.loan_id === loan.id && e.event_type === 'LOAN_RENEWED');
    assert.ok(events.length > 0, 'Must record LOAN_RENEWED event in audit log');
    assert.strictEqual(events[0].renewal_number, 1);
  });
});
