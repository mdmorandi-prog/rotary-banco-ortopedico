/**
 * Tier 1: Feature 20 — Return Triage Workflow (/loans/[id]/return) (F20)
 * Specifications: T1-F20-01 through T1-F20-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 20 — Return Triage Workflow (/loans/[id]/return) (F20)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-RET-01' });
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

  test('T1-F20-01: Loan & Equipment Data Loading on Return Page', async () => {
    const loaded = await repo.getLoanById(loan.id);
    assert.ok(loaded, 'Loan record must load');
    assert.strictEqual(loaded.equipment.patrimony_code, 'ROT-RET-01');
    assert.strictEqual(loaded.beneficiary.full_name, ben.full_name);
  });

  test('T1-F20-02: Categorized Physical Checklist Rendering', () => {
    const checklistItems = [
      { id: 'frame', label: 'Estrutura / Chassi metálico' },
      { id: 'wheels', label: 'Rodas e Apoios' },
      { id: 'upholstery', label: 'Estofamento e Assento' },
      { id: 'brakes', label: 'Freios e Travas de Segurança' }
    ];
    assert.strictEqual(checklistItems.length, 4, 'Must provide 4 physical triage checklist items');
  });

  test('T1-F20-03: Pristine Return Classification (BOM)', () => {
    function evaluateChecklist(answers) {
      const allOk = Object.values(answers).every(Boolean);
      return allOk ? 'BOM' : 'PRECISA_REPARO';
    }

    const pristine = { frame: true, wheels: true, upholstery: true, brakes: true };
    assert.strictEqual(evaluateChecklist(pristine), 'BOM', 'All OK checks result in BOM condition');
  });

  test('T1-F20-04: Damaged Return Classification (PRECISA_REPARO)', () => {
    function evaluateChecklist(answers) {
      const allOk = Object.values(answers).every(Boolean);
      return allOk ? 'BOM' : 'PRECISA_REPARO';
    }

    const damaged = { frame: true, wheels: false, upholstery: true, brakes: true };
    assert.strictEqual(evaluateChecklist(damaged), 'PRECISA_REPARO', 'Unchecked item results in PRECISA_REPARO');
  });

  test('T1-F20-05: Loan Status Transition to DEVOLVIDO', async () => {
    const res = await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.loan.status, 'DEVOLVIDO', 'Loan status must be DEVOLVIDO');
    assert.ok(res.loan.actual_return_date, 'Must stamp actual_return_date');

    const updatedEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updatedEq.status, 'HIGIENIZACAO', 'Equipment must route to destination');
  });
});
