/**
 * Tier 1: Feature 8 — Automated Triggers & State (F8)
 * Specifications: T1-F08-01 through T1-F08-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 8 — Automated Triggers & State (F8)', () => {
  let repo;
  let eqAvailable;
  let ben;

  beforeEach(() => {
    eqAvailable = fixtures.createMockEquipment('DISPONIVEL', {
      patrimony_code: 'ROT-TRG-01',
      replacement_value: 900.00
    });
    ben = fixtures.createMockBeneficiary();
    repo = createInMemoryRepository({
      equipments: [eqAvailable],
      beneficiaries: [ben]
    });
  });

  test('T1-F08-01: Trigger on Loan Creation (Equipment -> EMPRESTADO)', async () => {
    assert.strictEqual(eqAvailable.status, 'DISPONIVEL');

    const loan = await repo.createLoan({
      equipment_id: eqAvailable.id,
      beneficiary: ben,
      term_days: 30,
      signature_data_url: 'data:image/png;base64,abc123'
    });

    const updatedEq = await repo.getEquipmentById(eqAvailable.id);
    assert.strictEqual(updatedEq.status, 'EMPRESTADO', 'Equipment status must automatically synchronize to EMPRESTADO');
    assert.strictEqual(loan.status, 'ATIVO', 'Loan status must be ATIVO');
  });

  test('T1-F08-02: Trigger on Loan Return (Equipment -> Destination Status)', async () => {
    const loan = await repo.createLoan({
      equipment_id: eqAvailable.id,
      beneficiary: ben,
      term_days: 30
    });

    // Return with destination HIGIENIZACAO
    await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    const returnedEq = await repo.getEquipmentById(eqAvailable.id);
    assert.strictEqual(returnedEq.status, 'HIGIENIZACAO', 'Equipment status must update to destination HIGIENIZACAO');
    const returnedLoan = await repo.getLoanById(loan.id);
    assert.strictEqual(returnedLoan.status, 'DEVOLVIDO', 'Loan status must update to DEVOLVIDO');
    assert.ok(returnedLoan.actual_return_date, 'actual_return_date must be stamped');
  });

  test('T1-F08-03: Condition Synchronization on Return', async () => {
    const loan = await repo.createLoan({
      equipment_id: eqAvailable.id,
      beneficiary: ben
    });

    // Return with defect found
    await repo.returnLoan(loan.id, {
      condition: 'PRECISA_REPARO',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'MANUTENCAO'
    });

    const damagedEq = await repo.getEquipmentById(eqAvailable.id);
    assert.strictEqual(damagedEq.condition, 'PRECISA_REPARO', 'Equipment condition must update to PRECISA_REPARO');
    assert.strictEqual(damagedEq.status, 'MANUTENCAO', 'Equipment status must update to MANUTENCAO');
  });

  test('T1-F08-04: Audit Event Creation on Loan State Change', async () => {
    const loan = await repo.createLoan({
      equipment_id: eqAvailable.id,
      beneficiary: ben
    });

    const eventsAfterCreate = repo._internal.eventLogs.filter(e => e.loan_id === loan.id);
    assert.ok(eventsAfterCreate.some(e => e.event_type === 'LOAN_CREATED'), 'Must log LOAN_CREATED event');

    await repo.renewLoan(loan.magic_token);
    const eventsAfterRenew = repo._internal.eventLogs.filter(e => e.loan_id === loan.id);
    assert.ok(eventsAfterRenew.some(e => e.event_type === 'LOAN_RENEWED'), 'Must log LOAN_RENEWED event');
  });

  test('T1-F08-05: Automated updated_at Timestamp Trigger', async () => {
    const originalTime = eqAvailable.updated_at;
    // Small timeout to guarantee timestamp advancement
    await new Promise(r => setTimeout(r, 10));

    await repo.updateEquipment(eqAvailable.id, { notes: 'Updated notes' });
    const updated = await repo.getEquipmentById(eqAvailable.id);
    assert.ok(new Date(updated.updated_at).getTime() >= new Date(originalTime).getTime(), 'updated_at must advance on mutation');
  });
});
