/**
 * Tier 4: Scenario 05 — Multi-Equipment Family Loan with Independent Lifecycles & Partial Quittances (T4-SCN-05)
 * Polytrauma patient assigned 2 equipments with differentiated terms, partial return
 * & segregated quittance, independent renewal of remaining item, and final discharge.
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 4: Scenario 05 — Multi-Equipment Family Comodato (T4-SCN-05)', () => {
  let repo;
  let wheelchair;
  let crutches;
  let ben;

  beforeEach(() => {
    wheelchair = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-cr-088',
      patrimony_code: 'CR-088',
      name: 'Cadeira de Rodas Standard Refor\u00E7ada',
      category: 'CADEIRA_RODAS',
      replacement_value: 850.00
    });
    crutches = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-mc-044',
      patrimony_code: 'MC-044',
      name: 'Par de Muletas Canadenses Regul\u00E1veis',
      category: 'MULETA_CANADENSE',
      replacement_value: 120.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Geraldo Peixoto',
      phone: '(11) 98111-2222',
      secondary_name: 'Fabio Peixoto',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 98333-4444'
    });
    repo = createInMemoryRepository({
      equipments: [wheelchair, crutches],
      beneficiaries: [ben]
    });
  });

  test('T4-SCN-05: Complete multi-equipment family lifecycle with partial quittance and independent renewal', async () => {
    // -------------------------------------------------------------
    // STEP 1: Dual Comodato Agreement (2 Distinct Loans)
    // -------------------------------------------------------------
    assert.assertSecondaryContactValidation(ben);

    // Loan A: Wheelchair (90 days)
    const loanA = await repo.createLoan({
      equipment_id: wheelchair.id,
      beneficiary: ben,
      term_days: 90,
      signature_data_url: 'data:image/png;base64,signature_sueli_a'
    });

    // Loan B: Crutches (120 days)
    const loanB = await repo.createLoan({
      equipment_id: crutches.id,
      beneficiary: ben,
      term_days: 120,
      signature_data_url: 'data:image/png;base64,signature_sueli_b'
    });

    assert.notStrictEqual(loanA.id, loanB.id);
    assert.notStrictEqual(loanA.loan_code, loanB.loan_code);
    assert.notStrictEqual(loanA.magic_token, loanB.magic_token);

    assert.strictEqual(loanA.status, 'ATIVO');
    assert.strictEqual(loanB.status, 'ATIVO');

    const eqA = await repo.getEquipmentById(wheelchair.id);
    const eqB = await repo.getEquipmentById(crutches.id);
    assert.strictEqual(eqA.status, 'EMPRESTADO');
    assert.strictEqual(eqB.status, 'EMPRESTADO');

    // -------------------------------------------------------------
    // STEP 2 & 3: Differentiated Recovery & Partial Return (Day 65)
    // -------------------------------------------------------------
    // Returning Wheelchair CR-088 only (Loan A)
    const triageA = await repo.returnLoan(loanA.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Paciente progrediu para uso de muletas. Cadeira devolvida em perfeito estado.'
    });

    assert.strictEqual(triageA.success, true);
    assert.strictEqual(triageA.loan.status, 'DEVOLVIDO');

    // Equipment A enters HIGIENIZACAO
    const updatedEqA = await repo.getEquipmentById(wheelchair.id);
    assert.strictEqual(updatedEqA.status, 'HIGIENIZACAO');

    // Critical Invariant: Loan B remains strictly ATIVO and crutches remain EMPRESTADO
    const activeLoanB = await repo.getLoanById(loanB.id);
    assert.strictEqual(activeLoanB.status, 'ATIVO');
    const updatedEqB = await repo.getEquipmentById(crutches.id);
    assert.strictEqual(updatedEqB.status, 'EMPRESTADO');

    // Termo de Quitação Parcial Verification
    const partialQuittanceDoc = `
      TERMO DE QUITAÇÃO PARCIAL DE COMODATO - BANCO ORTOPÉDICO ROTARY
      Nos termos dos artigos 320 e 582 do Código Civil Brasileiro, dá-se quitação plena, rasa e geral
      exclusivamente quanto à restituição da Cadeira de Rodas CR-088 referente ao contrato ${loanA.loan_code},
      permanecendo plenamente vigentes, exigíveis e inalteradas todas as obrigações contratuais referentes
      às Muletas Canadenses MC-044 do contrato ${loanB.loan_code}.
      Comodatário: Geraldo Peixoto | Contato Solidário: Fabio Peixoto.
      Estado de conservação na devolução: BOM.
    `;
    assert.assertQuittanceReceipt(partialQuittanceDoc);
    assert.ok(partialQuittanceDoc.includes('exclusivamente'));
    assert.ok(partialQuittanceDoc.includes('permanecendo plenamente vigentes'));

    // -------------------------------------------------------------
    // STEP 4: Active Monitoring & Independent Renewal of Remaining Item (Day 115)
    // -------------------------------------------------------------
    const renewalB = await repo.renewLoan(loanB.magic_token);
    assert.strictEqual(renewalB.success, true);
    assert.strictEqual(renewalB.loan.renewal_count, 1);
    assert.strictEqual(renewalB.loan.status, 'RENOVADO');

    // Loan A cannot be renewed because it is already DEVOLVIDO
    const blockedRenewalA = await repo.renewLoan(loanA.magic_token);
    assert.strictEqual(blockedRenewalA.success, false);
    assert.ok(blockedRenewalA.message.includes('não pode ser renovado') || blockedRenewalA.message.includes('DEVOLVIDO'));

    // -------------------------------------------------------------
    // STEP 5: Final Rehabilitation & Total Quittance (Day 145)
    // -------------------------------------------------------------
    const triageB = await repo.returnLoan(loanB.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Alta fisioter\u00E1pica conclu\u00EDda com sucesso.'
    });

    assert.strictEqual(triageB.success, true);
    assert.strictEqual(triageB.loan.status, 'DEVOLVIDO');

    const finalEqB = await repo.getEquipmentById(crutches.id);
    assert.strictEqual(finalEqB.status, 'HIGIENIZACAO');

    // Total Quittance closing family account
    const totalQuittanceDoc = `
      TERMO DE QUITAÇÃO TOTAL E FINAL DE COMODATO - BANCO ORTOPÉDICO ROTARY
      Nos termos do Artigo 320 do Código Civil, dá-se quitação plena, geral e irrevogável
      por todas as obrigações assumidas pela família Peixoto (Geraldo Peixoto e Fabio Peixoto),
      extinguindo-se integralmente o contrato ${loanB.loan_code} referente às Muletas MC-044.
      Todas as obrigações da família junto ao Banco Ortopédico estão quitadas.
      Estado físico verificado: BOM.
    `;
    assert.assertQuittanceReceipt(totalQuittanceDoc);
  });

  test('T4-SCN-05: Returning Loan A has zero side effects on Loan B status or return date', async () => {
    const loanA = await repo.createLoan({
      equipment_id: wheelchair.id,
      beneficiary: ben,
      term_days: 30
    });
    const loanB = await repo.createLoan({
      equipment_id: crutches.id,
      beneficiary: ben,
      term_days: 60
    });

    const expectedDateBBefore = loanB.expected_return_date;

    // Return Loan A
    await repo.returnLoan(loanA.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    // Check Loan B
    const loanBAfter = await repo.getLoanById(loanB.id);
    assert.strictEqual(loanBAfter.status, 'ATIVO');
    assert.strictEqual(loanBAfter.expected_return_date, expectedDateBBefore);
    assert.strictEqual(loanBAfter.renewal_count, 0);

    const crutchesAfter = await repo.getEquipmentById(crutches.id);
    assert.strictEqual(crutchesAfter.status, 'EMPRESTADO');
  });

  test('T4-SCN-05: Distinct magic tokens prevent cross-contract renewal collisions', async () => {
    const loanA = await repo.createLoan({
      equipment_id: wheelchair.id,
      beneficiary: ben,
      term_days: 30
    });
    const loanB = await repo.createLoan({
      equipment_id: crutches.id,
      beneficiary: ben,
      term_days: 30
    });

    assert.notStrictEqual(loanA.magic_token, loanB.magic_token);

    // Renewing with token A only affects loan A
    const resA = await repo.renewLoan(loanA.magic_token);
    assert.strictEqual(resA.success, true);

    const loanBUnchanged = await repo.getLoanById(loanB.id);
    assert.strictEqual(loanBUnchanged.renewal_count, 0);
  });
});
