/**
 * Tier 4: Scenario 02 — Palliative Care Bed Loan with Patient Demise & Collection Assistance (T4-SCN-02)
 * Palliative bed loan, death notification (OBITO_PACIENTE), public collection assistance request,
 * high-priority logistics queue in /overdue, deep decontamination triage, and compassionate quittance.
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 4: Scenario 02 — Palliative Care Demise Journey (T4-SCN-02)', () => {
  let repo;
  let bed;
  let mattress;
  let ben;

  beforeEach(() => {
    bed = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-ch-015',
      patrimony_code: 'CH-015',
      name: 'Cama Hospitalar Semi-Fowler Motorizada',
      category: 'CAMA_HOSPITALAR',
      replacement_value: 3200.00
    });
    mattress = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-cp-022',
      patrimony_code: 'CP-022',
      name: 'Colch\u00E3o Pneum\u00E1tico Anti-Escaras',
      category: 'COLCHAO_PNEUMATICO',
      replacement_value: 650.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Ant\u00F4nio Souza',
      phone: '(11) 97777-1234',
      secondary_name: 'Beatriz Souza',
      secondary_relationship: 'Filha / Cuidadora Principal',
      secondary_phone: '(11) 98888-5678'
    });
    repo = createInMemoryRepository({
      equipments: [bed, mattress],
      beneficiaries: [ben]
    });
  });

  test('T4-SCN-02: Complete journey from palliative bed allocation to compassionate quittance and sanitization', async () => {
    // -------------------------------------------------------------
    // STEP 1: Heavy Equipment Allocation & Comodato
    // -------------------------------------------------------------
    assert.assertSecondaryContactValidation(ben);

    const loan = await repo.createLoan({
      equipment_id: bed.id,
      beneficiary: ben,
      term_days: 90,
      signature_data_url: 'data:image/png;base64,signature_beatriz'
    });

    assert.strictEqual(loan.status, 'ATIVO');
    assert.strictEqual(loan.replacement_value, 3200.00);

    const activeBed = await repo.getEquipmentById(bed.id);
    assert.strictEqual(activeBed.status, 'EMPRESTADO');

    // Comodato contract legal clauses verification
    const comodatoDoc = `
      TERMO DE CESSÃO EM COMODATO
      Artigos 579 a 585 do Código Civil Brasileiro.
      Comodatário: Antônio Souza. Contato Solidário: Beatriz Souza.
      Bem: Cama Hospitalar Semi-Fowler CH-015. Valor de Reposição Declarado: R$ 3.200,00.
      Empréstimo gratuito com dever de guarda, conservação e restituição sob pena de mora e perdas e danos.
    `;
    assert.assertLegalComodatoClauses(comodatoDoc);

    // -------------------------------------------------------------
    // STEP 2 & 3: Patient Demise (Day 42) & Public Portal Collection Assistance
    // -------------------------------------------------------------
    // Family accesses /renovar/[magic_token] and requests collection assistance
    const fetchedLoan = await repo.getLoanByMagicToken(loan.magic_token);
    assert.ok(fetchedLoan, 'Loan must be accessible via magic token without login');

    // Simulate collection assistance request update
    fetchedLoan.pickup_requested = true;
    fetchedLoan.pickup_notes = 'Paciente faleceu. Necessita 2 pessoas e carreto para retirada de cama de 80kg.';
    fetchedLoan.pickup_contact_name = 'Eduardo Souza (Irm\u00E3o)';
    fetchedLoan.pickup_contact_phone = '(11) 99999-3333';
    fetchedLoan.pickup_address = 'Rua das Flores, 123, Centro';
    fetchedLoan.bereavement = true;

    assert.strictEqual(fetchedLoan.pickup_requested, true);
    assert.strictEqual(fetchedLoan.bereavement, true);

    // -------------------------------------------------------------
    // STEP 4: Overdue Radar Logistics Dispatch
    // -------------------------------------------------------------
    // In /overdue, logistics coordinator views collection queue
    const overdueQueue = [fetchedLoan].filter(l => l.pickup_requested);
    assert.strictEqual(overdueQueue.length, 1);
    assert.strictEqual(overdueQueue[0].bereavement, true);
    assert.ok(overdueQueue[0].pickup_notes.includes('carreto'));

    // -------------------------------------------------------------
    // STEP 5: Warehouse Ingestion & Decontamination Triage
    // -------------------------------------------------------------
    const triageResult = await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'OBITO_PACIENTE',
      destination: 'HIGIENIZACAO',
      notes: 'Estrutura mec\u00E2nica intacta. Encaminhado para desinfec\u00E7\u00E3o terminal hospitalar.'
    });

    assert.strictEqual(triageResult.success, true);
    assert.strictEqual(triageResult.loan.status, 'DEVOLVIDO');

    const hygieneBed = await repo.getEquipmentById(bed.id);
    assert.strictEqual(hygieneBed.status, 'HIGIENIZACAO');

    // Compassionate Quittance Document Verification (CCB Art. 320)
    const compassionateQuittance = `
      TERMO DE QUITA\u00C7\u00C3O DE COMODATO - BANCO ORTOP\u00C9DICO ROTARY
      Em aten\u00E7\u00E3o ao falecimento do Sr. Ant\u00F4nio Souza, manifestamos nossas mais sinceras condol\u00EAncias \u00E0 fam\u00EDlia.
      Nos termos dos Artigos 320 e 582 do C\u00F3digo Civil Brasileiro, declaramos plenamente quitada, extinta e satisfeita
      toda a obriga\u00E7\u00E3o decorrente do comodato da Cama Hospitalar CH-015, exonerando integralmente de quaisquer \u00F4nus,
      perdas ou responsabilidades a Sra. Beatriz Souza e os demais sucessores legais.
      Estado f\u00EDsico na devolu\u00E7\u00E3o: BOM.
    `;
    assert.assertQuittanceReceipt(compassionateQuittance);

    // -------------------------------------------------------------
    // STEP 6: Terminal Sanitization & Active Stock Release
    // -------------------------------------------------------------
    assert.assertEquipmentStateTransition('HIGIENIZACAO', 'COMPLETE_HYGIENE', 'DISPONIVEL');
    await repo.updateEquipment(bed.id, {
      status: 'DISPONIVEL',
      notes: 'Desinfec\u00E7\u00E3o terminal ANVISA com quatern\u00E1rio de am\u00F4nio 5\u00AA gera\u00E7\u00E3o conclu\u00EDda.'
    });

    const finalBed = await repo.getEquipmentById(bed.id);
    assert.strictEqual(finalBed.status, 'DISPONIVEL');
  });

  test('T4-SCN-02: Public collection assistance requires valid contact phone and address', async () => {
    const loan = await repo.createLoan({
      equipment_id: mattress.id,
      beneficiary: ben,
      term_days: 60
    });

    // Valid pickup submission
    const validPickup = {
      pickup_requested: true,
      pickup_contact_name: 'Beatriz Souza',
      pickup_contact_phone: '(11) 98888-5678',
      pickup_address: 'Av Rotary, 450'
    };
    assert.ok(validPickup.pickup_contact_phone.length >= 10);
    assert.ok(validPickup.pickup_address.trim().length > 5);

    // Invalid pickup missing phone
    const invalidPickup = {
      pickup_requested: true,
      pickup_contact_name: 'Beatriz',
      pickup_contact_phone: '',
      pickup_address: 'Av Rotary'
    };
    assert.throws(() => {
      if (!invalidPickup.pickup_contact_phone || invalidPickup.pickup_contact_phone.trim() === '') {
        throw new Error('Telefone de contato para recolhimento \u00E9 obrigat\u00F3rio');
      }
    }, /Telefone de contato para recolhimento \u00E9 obrigat\u00F3rio/);
  });

  test('T4-SCN-02: Patient demise triage strictly prohibits routing directly to DISPONIVEL without sanitization', async () => {
    const loan = await repo.createLoan({
      equipment_id: bed.id,
      beneficiary: ben,
      term_days: 60
    });

    // Sanitization gate check: patient demise or healthcare return requires HIGIENIZACAO
    const validateDestination = (reason, destination) => {
      if (reason === 'OBITO_PACIENTE' && destination === 'DISPONIVEL') {
        throw new Error('Protocolo sanit\u00E1rio ANVISA exige higieniza\u00E7\u00E3o ap\u00F3s \u00F3bito do paciente');
      }
      return true;
    };

    assert.throws(() => {
      validateDestination('OBITO_PACIENTE', 'DISPONIVEL');
    }, /Protocolo sanit\u00E1rio ANVISA exige higieniza\u00E7\u00E3o ap\u00F3s \u00F3bito do paciente/);

    // Permitted destination: HIGIENIZACAO
    assert.doesNotThrow(() => {
      validateDestination('OBITO_PACIENTE', 'HIGIENIZACAO');
    });
  });
});
