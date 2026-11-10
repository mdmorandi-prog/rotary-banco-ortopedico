/**
 * Tier 2: Feature 23 Boundaries — Public Self-Service Renewal (/renovar/[magic_token]) (F23)
 * Specifications: T2-F23-01 through T2-F23-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 23 Boundaries — Public Self-Service Renewal (/renovar/[magic_token]) (F23)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL');
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

  test('T2-F23-01: Invalid / Non-Existent Magic Token Access', async () => {
    const res = await repo.renewLoan('token-que-nao-existe-123');
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('inválido') || res.message.includes('expirado'));
  });

  test('T2-F23-02: Renewal Attempt on Already Returned Loan', async () => {
    // Return loan
    await repo.returnLoan(loan.id, { condition: 'BOM', destination: 'HIGIENIZACAO' });

    // Try renewing returned loan
    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('DEVOLVIDO') || res.message.includes('não pode ser renovado'));
  });

  test('T2-F23-03: Renewal Beyond Maximum Limit (Renewal Guard)', async () => {
    // 3 renewals
    await repo.renewLoan(loan.magic_token);
    await repo.renewLoan(loan.magic_token);
    await repo.renewLoan(loan.magic_token);

    // 4th renewal rejected
    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('Limite máximo'));
  });

  test('T2-F23-04: SQL Injection in Magic Token URL Parameter', async () => {
    const maliciousToken = "' OR 1=1--";
    const res = await repo.renewLoan(maliciousToken);
    assert.strictEqual(res.success, false, 'SQL injection token must be handled as literal string');
  });

  test('T2-F23-05: Overdue Loan Renewal Grace Period Reset', async () => {
    // Make loan overdue
    loan.status = 'ATRASADO';
    eq.status = 'ATRASADO';

    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.loan.status, 'RENOVADO', 'Status updates from ATRASADO to RENOVADO');
    assert.strictEqual(eq.status, 'EMPRESTADO', 'Equipment status restored from ATRASADO to EMPRESTADO');
  });
});
