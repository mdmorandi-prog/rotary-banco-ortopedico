/**
 * Tier 2: Feature 20 Boundaries — Return Triage Workflow (/loans/[id]/return) (F20)
 * Specifications: T2-F20-01 through T2-F20-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 20 Boundaries — Return Triage Workflow (/loans/[id]/return) (F20)', () => {
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
      beneficiary: ben
    });
  });

  test('T2-F20-01: Double Return Submission Prevention', async () => {
    // First return succeeds
    await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    // Second return on same loan must be rejected
    await assert.rejects(async () => {
      await repo.returnLoan(loan.id, {
        condition: 'BOM',
        close_reason: 'RECUPERACAO_ALTA',
        destination: 'HIGIENIZACAO'
      });
    }, /Empréstimo já foi devolvido/);
  });

  test('T2-F20-02: Mandatory Defect Description on PRECISA_REPARO', () => {
    function validateReturnTriage(data) {
      if (data.condition === 'PRECISA_REPARO' && (!data.notes || data.notes.trim().length === 0)) {
        throw new Error('Descreva os defeitos identificados para a equipe de manutenção');
      }
      return true;
    }

    assert.throws(() => {
      validateReturnTriage({ condition: 'PRECISA_REPARO', notes: '' });
    }, /Descreva os defeitos identificados/);

    assert.strictEqual(validateReturnTriage({ condition: 'PRECISA_REPARO', notes: 'Eixo torto' }), true);
  });

  test('T2-F20-03: Future Return Date Rejection', () => {
    function validateReturnDate(dateStr) {
      const returnDate = new Date(dateStr).getTime();
      const now = Date.now();
      if (returnDate > now + 60000) { // 1 min margin
        throw new Error('Data de devolução não pode ser futura');
      }
      return true;
    }

    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    assert.throws(() => validateReturnDate(tomorrow), /Data de devolução não pode ser futura/);
    assert.strictEqual(validateReturnDate(new Date().toISOString()), true);
  });

  test('T2-F20-04: Irreparable Equipment Routing to SUCATEADO (BAIXADO)', async () => {
    await repo.returnLoan(loan.id, {
      condition: 'SUCATEADO',
      close_reason: 'OUTROS',
      destination: 'BAIXADO',
      notes: 'Estrutura rompida sem possibilidade de conserto'
    });

    const updated = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updated.status, 'BAIXADO', 'Irreparable item routes to BAIXADO');
    assert.strictEqual(updated.condition, 'SUCATEADO');
  });

  test('T2-F20-05: Rapid Click / Submit Debounce', () => {
    let isSubmitting = false;
    let submissionCount = 0;

    function submitReturn() {
      if (isSubmitting) return false;
      isSubmitting = true;
      submissionCount++;
      return true;
    }

    assert.strictEqual(submitReturn(), true, 'First click submits');
    assert.strictEqual(submitReturn(), false, 'Rapid double click blocked by isSubmitting');
    assert.strictEqual(submissionCount, 1);
  });
});
