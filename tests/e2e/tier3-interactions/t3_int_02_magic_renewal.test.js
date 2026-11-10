/**
 * Tier 3: Interaction 02 — 1-Click Magic Token Self-Service Renewal (T3-INT-02)
 * Features: F4, F8, F13, F23, F25
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 02 — Magic Token Renewal (T3-INT-02)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL', { id: 'eq-wheelchair-01', patrimony_code: 'CR-042' });
    ben = fixtures.createMockBeneficiary();
    repo = createInMemoryRepository({ equipments: [eq], beneficiaries: [ben] });

    loan = await repo.createLoan({
      equipment_id: eq.id,
      beneficiary: ben,
      term_days: 30
    });
    // Update internal loan expected_return_date
    const internalLoan = repo._internal.loans.find(l => l.id === loan.id);
    internalLoan.expected_return_date = '2026-12-01T00:00:00.000Z';
  });

  test('T3-INT-02-A: Public zero-login renewal extends return date by +30 days', async () => {
    // 1. Borrower accesses portal by magic token without credentials
    const fetched = await repo.getLoanByMagicToken(loan.magic_token);
    assert.ok(fetched, 'Must fetch loan by magic token');
    assert.strictEqual(fetched.renewal_count, 0);

    // 2. Click 1-click renewal (+30 days)
    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.loan.renewal_count, 1);

    // 3. Date verification
    const newDate = new Date(res.loan.expected_return_date);
    const oldDate = new Date('2026-12-01T00:00:00.000Z');
    const diffDays = Math.round((newDate.getTime() - oldDate.getTime()) / 86400000);
    assert.strictEqual(diffDays, 30, 'Must extend due date by exactly 30 days');

    // 4. Equipment status remains EMPRESTADO
    const currentEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(currentEq.status, 'EMPRESTADO');

    // 5. Audit event logged
    const logs = repo._internal.eventLogs.filter(e => e.loan_id === loan.id && e.event_type === 'LOAN_RENEWED');
    assert.strictEqual(logs.length, 1);
  });

  test('T3-INT-02-B: Invalid or expired magic token returns error without data mutations', async () => {
    const res = await repo.renewLoan('invalid-token-123');
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('inválido') || res.message.includes('expirado'));

    // Verify loan untouched
    assert.strictEqual(loan.renewal_count, 0);
  });

  test('T3-INT-02-C: Attempting renewal on DEVOLVIDO loan is disabled', async () => {
    // Return loan
    await repo.returnLoan(loan.id, { condition: 'BOM', destination: 'HIGIENIZACAO' });

    // Renewal attempt
    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('DEVOLVIDO') || res.message.includes('não pode ser renovado'));
  });
});
