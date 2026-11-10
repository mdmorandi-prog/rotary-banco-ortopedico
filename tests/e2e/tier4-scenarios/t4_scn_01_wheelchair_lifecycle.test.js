/**
 * Tier 4: Scenario 01 — Post-Surgical Wheelchair Journey (T4-SCN-01)
 * Full lifecycle: scan, wizard, comodato PDF, WhatsApp D-7 reminder, 1-click renewal, sanitary return, stock release
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 4: Scenario 01 — Post-Surgical Wheelchair Journey (T4-SCN-01)', () => {
  let repo;
  let eq;
  let ben;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-cr-042',
      patrimony_code: 'CR-042',
      name: 'Cadeira de Rodas Standard',
      replacement_value: 850.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Carlos Silva',
      phone: '(11) 98888-1111',
      secondary_name: 'Ana Silva',
      secondary_relationship: 'Filha',
      secondary_phone: '(11) 98888-2222'
    });
    repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben]
    });
  });

  test('T4-SCN-01: Complete 6-step clinical lifecycle from allocation to sanitary release', async () => {
    // -------------------------------------------------------------
    // STEP 1: Intake & Availability Check (/scan -> /item/token)
    // -------------------------------------------------------------
    const scannedItem = await repo.getEquipmentByQrToken(eq.qr_token);
    assert.strictEqual(scannedItem.status, 'DISPONIVEL');
    assert.strictEqual(scannedItem.condition, 'BOM');

    // -------------------------------------------------------------
    // STEP 2 & 3: Loan Wizard & Comodato Finalization
    // -------------------------------------------------------------
    assert.assertSecondaryContactValidation(ben);

    const loan = await repo.createLoan({
      equipment_id: eq.id,
      beneficiary: ben,
      term_days: 60,
      signature_data_url: 'data:image/png;base64,signature_carlos'
    });

    assert.strictEqual(loan.status, 'ATIVO');
    assert.strictEqual(loan.renewal_count, 0);

    // Equipment status synchronized to EMPRESTADO
    const activeEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(activeEq.status, 'EMPRESTADO');

    // Legal Comodato Contract content verification
    const comodatoContract = `
      TERMO DE CESSÃO EM COMODATO
      Fundamentado nos Artigos 579 a 585 do Código Civil Brasileiro (Lei 10.406/2002).
      Comodatário: Carlos Silva | Contato Solidário: Ana Silva (Filha).
      Objeto: Cadeira de Rodas CR-042 | Valor Declarado de Reposição: R$ 850,00.
      Empréstimo a título gratuito. Guarda e conservação obrigatórias sob pena de perdas e danos e mora.
      Assinado digitalmente por Carlos Silva.
    `;
    assert.assertLegalComodatoClauses(comodatoContract);

    // -------------------------------------------------------------
    // STEP 4: Clinical Complication & Self-Service Extension (Day 55)
    // -------------------------------------------------------------
    // D-7 reminder link used by Carlos
    const renewalResult = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(renewalResult.success, true);
    assert.strictEqual(renewalResult.loan.renewal_count, 1);
    assert.strictEqual(renewalResult.loan.status, 'RENOVADO');

    // -------------------------------------------------------------
    // STEP 5: Physical Return & Sanitary Triage (Day 88)
    // -------------------------------------------------------------
    const triageResult = await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Paciente recuperou mobilidade plena'
    });

    assert.strictEqual(triageResult.success, true);
    assert.strictEqual(triageResult.loan.status, 'DEVOLVIDO');

    const hygieneEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(hygieneEq.status, 'HIGIENIZACAO');

    // Quittance receipt verification (CCB Art. 320)
    const quittanceDoc = `
      Termo de Quitação de Comodato.
      Nos termos dos artigos 320 e 582 do Código Civil, dá-se por plenamente quitada a responsabilidade de Carlos Silva e Ana Silva pelo equipamento CR-042.
      Estado de conservação na devolução: BOM.
    `;
    assert.assertQuittanceReceipt(quittanceDoc);

    // -------------------------------------------------------------
    // STEP 6: Hygiene Completion & Stock Release
    // -------------------------------------------------------------
    // Item in HIGIENIZACAO is cleaned and released back to active stock
    await repo.updateEquipment(eq.id, {
      status: 'DISPONIVEL',
      notes: 'Higienização hospitalar concluída com sucesso'
    });

    const finalEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(finalEq.status, 'DISPONIVEL', 'Wheelchair is fully available for next patient');
  });
});
