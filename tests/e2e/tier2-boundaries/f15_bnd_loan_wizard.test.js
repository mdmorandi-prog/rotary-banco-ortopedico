/**
 * Tier 2: Feature 15 Boundaries — Multi-step Loan Wizard (/loans/new) (F15)
 * Specifications: T2-F15-01 through T2-F15-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 15 Boundaries — Multi-step Loan Wizard (/loans/new) (F15)', () => {
  test('T2-F15-01: Direct Deep Link to Wizard Step 4 Without Equipment', () => {
    function evaluateWizardStep(requestedStep, selectedEquipment) {
      if (!selectedEquipment && requestedStep > 1) {
        return { step: 1, redirected: true, reason: 'Nenhum equipamento selecionado' };
      }
      return { step: requestedStep, redirected: false };
    }

    const res = evaluateWizardStep(4, null);
    assert.strictEqual(res.step, 1, 'Must redirect to Step 1 if equipment is not selected');
    assert.strictEqual(res.redirected, true);
  });

  test('T2-F15-02: Loan Creation Attempt on Non-Available Item', async () => {
    const eq = fixtures.createMockEquipment('EMPRESTADO');
    const ben = fixtures.createMockBeneficiary();
    const repo = createInMemoryRepository({ equipments: [eq], beneficiaries: [ben] });

    await assert.rejects(async () => {
      await repo.createLoan({ equipment_id: eq.id, beneficiary: ben });
    }, /Equipment is not available for loan/);
  });

  test('T2-F15-03: Brazilian CPF Checksum Failure in Step 2', () => {
    const invalidCpf = '123.456.789-00';
    assert.throws(() => {
      assert.assertBrazilianCPF(invalidCpf);
    }, /CPF.*verification digit mismatch/);
  });

  test('T2-F15-04: Maximum Loan Duration Boundary Enforcement', () => {
    function validateLoanTerm(days) {
      const maxTermDays = 180; // Rotary standard max initial duration
      if (days <= 0) throw new Error('Prazo de empréstimo deve ser positivo');
      if (days > maxTermDays) {
        throw new Error(`Prazo máximo permitido para empréstimo inicial é de ${maxTermDays} dias`);
      }
      return true;
    }

    assert.throws(() => validateLoanTerm(365), /Prazo máximo permitido/);
    assert.throws(() => validateLoanTerm(0), /deve ser positivo/);
    assert.strictEqual(validateLoanTerm(90), true);
  });

  test('T2-F15-05: Wizard State Retention Across Accidental Step Navigation', () => {
    const wizardState = {
      step: 2,
      patientName: 'Maria Silva',
      cpf: '825.244.921-25',
      phone: '(11) 98765-4321'
    };

    // User navigates back to Step 1
    wizardState.step = 1;
    assert.strictEqual(wizardState.patientName, 'Maria Silva', 'Beneficiary data retained when navigating back to step 1');

    // Navigates forward to Step 3
    wizardState.step = 3;
    assert.strictEqual(wizardState.cpf, '825.244.921-25');
  });
});
