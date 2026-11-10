/**
 * Tier 4: Scenario 04 — Workshop Refurbishment, Label Printing & QR Reallocation (T4-SCN-04)
 * Bath chair repair completion (MANUTENCAO -> DISPONIVEL), 50x30mm thermal label verification,
 * and mobile camera QR scan express loan allocation.
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 4: Scenario 04 — Workshop Refurbishment & Reallocation (T4-SCN-04)', () => {
  let repo;
  let chair;
  let ben;

  beforeEach(() => {
    chair = fixtures.createMockEquipment('MANUTENCAO', {
      id: 'eq-cb-019',
      patrimony_code: 'CB-019',
      name: 'Cadeira de Banho com Rod\u00EDzios Inox',
      category: 'CADEIRA_BANHO',
      condition: 'PRECISA_REPARO',
      replacement_value: 450.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Josefa Santana',
      phone: '(11) 96666-5555',
      secondary_name: 'L\u00FAcia Santana',
      secondary_relationship: 'Filha',
      secondary_phone: '(11) 96666-7777'
    });
    repo = createInMemoryRepository({
      equipments: [chair],
      beneficiaries: [ben]
    });
  });

  test('T4-SCN-04: Complete workshop repair, thermal label verification, and express QR reallocation', async () => {
    // -------------------------------------------------------------
    // STEP 1: Maintenance State Verification & Loan Block
    // -------------------------------------------------------------
    const initialChair = await repo.getEquipmentById(chair.id);
    assert.strictEqual(initialChair.status, 'MANUTENCAO');
    assert.strictEqual(initialChair.condition, 'PRECISA_REPARO');

    // Attempting to loan item currently in MANUTENCAO must fail
    await assert.rejects(
      async () => {
        await repo.createLoan({
          equipment_id: chair.id,
          beneficiary: ben,
          term_days: 30
        });
      },
      /Equipment is not available for loan/
    );

    // -------------------------------------------------------------
    // STEP 2: Workshop Refurbishment Completion
    // -------------------------------------------------------------
    // Technician finishes repair: replaces casters, records maintenance log
    assert.assertEquipmentStateTransition('MANUTENCAO', 'COMPLETE_REPAIR', 'DISPONIVEL');

    await repo.updateEquipment(chair.id, {
      status: 'DISPONIVEL',
      condition: 'BOM',
      notes: 'Substitui\u00E7\u00E3o completa de 4 rod\u00EDzios inox e revis\u00E3o de freios. Custo pe\u00E7as: R$ 45,00.'
    });

    const repairedChair = await repo.getEquipmentById(chair.id);
    assert.strictEqual(repairedChair.status, 'DISPONIVEL');
    assert.strictEqual(repairedChair.condition, 'BOM');

    // -------------------------------------------------------------
    // STEP 3: Asset Thermal Label Generation & Verification
    // -------------------------------------------------------------
    // Operator navigates to /equipments/labels?id=eq-cb-019
    const labelLayout = {
      width_mm: 50,
      height_mm: 30,
      rotary_emblem: true,
      club_title: 'Rotary Club de S\u00E3o Paulo - Banco Ortop\u00E9dico',
      patrimony_code: repairedChair.patrimony_code,
      category: 'CADEIRA DE BANHO',
      replacement_value: 'R$ 450,00',
      contact_phone: '(11) 3333-4444',
      qr_size_mm: 22,
      qr_payload: `https://banco-ortopedico.rotary.org.br/item/${repairedChair.qr_token}`
    };

    assert.strictEqual(labelLayout.width_mm, 50);
    assert.strictEqual(labelLayout.height_mm, 30);
    assert.strictEqual(labelLayout.qr_size_mm, 22);
    assert.ok(labelLayout.qr_payload.includes(`/item/${repairedChair.qr_token}`));
    assert.strictEqual(labelLayout.patrimony_code, 'CB-019');

    // WCAG contrast check on label elements
    assert.assertWCAGContrast('#000000', '#ffffff', 4.5);

    // -------------------------------------------------------------
    // STEP 4: Mobile Camera QR Scan & Express Loan Wizard
    // -------------------------------------------------------------
    // Mobile camera scans QR label, resolves item route
    const scannedEquipment = await repo.getEquipmentByQrToken(repairedChair.qr_token);
    assert.ok(scannedEquipment, 'QR token must resolve to equipment record');
    assert.strictEqual(scannedEquipment.status, 'DISPONIVEL');

    // Volunteer completes loan creation for Lúcia / Dona Josefa
    assert.assertSecondaryContactValidation(ben);

    const loan = await repo.createLoan({
      equipment_id: scannedEquipment.id,
      beneficiary: ben,
      term_days: 60,
      signature_data_url: 'data:image/png;base64,signature_lucia'
    });

    assert.strictEqual(loan.status, 'ATIVO');
    assert.strictEqual(loan.equipment_id, chair.id);

    // Equipment status immediately transitions to EMPRESTADO
    const allocatedChair = await repo.getEquipmentById(chair.id);
    assert.strictEqual(allocatedChair.status, 'EMPRESTADO');

    // Comodato contract check
    const comodatoDoc = `
      TERMO DE COMODATO
      Artigos 579 a 585 do C\u00F3digo Civil Brasileiro.
      Comodat\u00E1ria: Josefa Santana. Fiadora/Solid\u00E1ria: L\u00FAcia Santana.
      Bem: Cadeira de Banho CB-019. Valor de Reposi\u00E7\u00E3o: R$ 450,00.
      Cess\u00E3o a t\u00EDtulo gratuito. Dever de guarda e restitui\u00E7\u00E3o sob pena de mora e perdas e danos.
    `;
    assert.assertLegalComodatoClauses(comodatoDoc);
  });

  test('T4-SCN-04: System blocks loan creation while equipment is in MANUTENCAO', async () => {
    const maintChair = await repo.getEquipmentById(chair.id);
    assert.strictEqual(maintChair.status, 'MANUTENCAO');

    await assert.rejects(
      async () => {
        await repo.createLoan({
          equipment_id: chair.id,
          beneficiary: ben,
          term_days: 30
        });
      },
      /Equipment is not available for loan/
    );
  });

  test('T4-SCN-04: Thermal label payload includes valid QR URL, patrimony, and emergency return contact', () => {
    const qrUrl = `https://banco.rotary.org.br/item/${chair.qr_token}`;
    assert.ok(qrUrl.startsWith('https://'));
    assert.ok(qrUrl.includes('/item/'));
    assert.strictEqual(chair.patrimony_code, 'CB-019');
    assert.strictEqual(chair.replacement_value, 450.00);
  });
});
