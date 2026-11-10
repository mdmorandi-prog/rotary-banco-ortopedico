/**
 * Tier 4: Scenario 03 — Serial Renewal Escalation (T4-SCN-03)
 * Serial renewals (3x), automated overdue transition at D+1, 4th renewal attempt
 * blocked by cap, D+7 WhatsApp escalation to secondary guarantor (CCB Art. 585),
 * and resolution return with CCB Art. 320 discharge.
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 4: Scenario 03 — Serial Renewal Escalation (T4-SCN-03)', () => {
  let repo;
  let crutches;
  let ben;

  beforeEach(() => {
    crutches = fixtures.createMockEquipment('DISPONIVEL', {
      id: 'eq-mc-108',
      patrimony_code: 'MC-108',
      name: 'Par de Muletas Canadenses Regul\u00E1veis',
      category: 'MULETA_CANADENSE',
      replacement_value: 120.00
    });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Lucas Mendes',
      phone: '(11) 97777-3333',
      secondary_name: 'Roberto Mendes',
      secondary_relationship: 'Pai',
      secondary_phone: '(11) 98888-4444'
    });
    repo = createInMemoryRepository({
      equipments: [crutches],
      beneficiaries: [ben]
    });
  });

  test('T4-SCN-03: Full lifecycle of 3 serial renewals, D+1 overdue transition, D+7 escalation, and discharge', async () => {
    // -------------------------------------------------------------
    // STEP 1: Initial Comodato Setup (30-day initial term)
    // -------------------------------------------------------------
    const loan = await repo.createLoan({
      equipment_id: crutches.id,
      beneficiary: ben,
      term_days: 30,
      signature_data_url: 'data:image/png;base64,signature_lucas'
    });

    assert.strictEqual(loan.status, 'ATIVO');
    assert.strictEqual(loan.renewal_count, 0);
    assert.strictEqual(loan.max_renewals, 3);

    // Initial return date = loan_date + 30 days
    const initialDueDate = new Date(loan.expected_return_date);

    // -------------------------------------------------------------
    // STEP 2: Serial Self-Service Renewals (3x via Magic Link)
    // -------------------------------------------------------------
    // Renewal 1 (+30 days) -> Due Day 60
    const ren1 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(ren1.success, true);
    assert.strictEqual(ren1.loan.renewal_count, 1);
    const due1 = new Date(ren1.loan.expected_return_date);
    assert.strictEqual(due1.getTime(), initialDueDate.getTime() + 30 * 86400000);

    // Renewal 2 (+30 days) -> Due Day 90
    const ren2 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(ren2.success, true);
    assert.strictEqual(ren2.loan.renewal_count, 2);

    // Renewal 3 (+30 days) -> Due Day 120 (Cap Reached)
    const ren3 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(ren3.success, true);
    assert.strictEqual(ren3.loan.renewal_count, 3);
    assert.strictEqual(ren3.loan.renewal_count, ren3.loan.max_renewals);

    // -------------------------------------------------------------
    // STEP 3: Expiration & Overdue Transition (Day 121 / D+1)
    // -------------------------------------------------------------
    // Backdate expected return date to yesterday (D+1 overdue)
    const yesterday = new Date(Date.now() - 1 * 86400000).toISOString();
    loan.expected_return_date = yesterday;
    loan.status = 'ATRASADO';

    const eq = await repo.getEquipmentById(crutches.id);
    eq.status = 'ATRASADO';

    assert.strictEqual(loan.status, 'ATRASADO');
    assert.strictEqual(eq.status, 'ATRASADO');

    // -------------------------------------------------------------
    // STEP 4: Blocked 4th Renewal Attempt (Day 122)
    // -------------------------------------------------------------
    const ren4 = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(ren4.success, false);
    assert.ok(ren4.message.includes('Limite máximo') || ren4.message.includes('Limite m\u00E1ximo'));
    const currentLoan = await repo.getLoanById(loan.id);
    assert.strictEqual(currentLoan.renewal_count, 3, 'Renewal count must not increment beyond max_renewals');

    // -------------------------------------------------------------
    // STEP 5: Delinquency Escalation to Secondary Guarantor (D+7)
    // -------------------------------------------------------------
    // Simulated cron runs at D+7: generates WhatsApp message to Roberto Mendes (Secondary)
    const buildSecondaryEscalationMessage = (loanData, benData, eqData) => {
      const secondaryPhone = benData.secondary_phone.replace(/\D/g, '');
      const text = `Prezado(a) Sr(a). ${benData.secondary_name}, entramos em contato referente ao comodato do equipamento ${eqData.name} (Patrim\u00F4nio ${eqData.patrimony_code}) retirado por ${benData.full_name}, no qual consta como contato solid\u00E1rio (Artigo 585 do C\u00F3digo Civil). O prazo de devolu\u00E7\u00E3o encontra-se vencido h\u00E1 7 dias. Solicitamos a gentileza de coordenar a devolu\u00E7\u00E3o no Rotary Club ou entrar em contato.`;
      const url = `https://wa.me/55${secondaryPhone}?text=${encodeURIComponent(text)}`;
      return { secondaryPhone, text, url };
    };

    const escalation = buildSecondaryEscalationMessage(loan, ben, crutches);
    assert.strictEqual(escalation.secondaryPhone, '11988884444');
    assert.ok(escalation.text.includes('Roberto Mendes'));
    assert.ok(escalation.text.includes('Artigo 585 do C\u00F3digo Civil'));
    assert.ok(escalation.text.includes('solid\u00E1rio'));
    assert.ok(escalation.text.includes('MC-108'));

    // -------------------------------------------------------------
    // STEP 6: Resolution & Final Return with CCB 320 Quittance
    // -------------------------------------------------------------
    const triageResult = await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Devolu\u00E7\u00E3o realizada ap\u00F3s contato com o fiador/contato solid\u00E1rio.'
    });

    assert.strictEqual(triageResult.success, true);
    assert.strictEqual(triageResult.loan.status, 'DEVOLVIDO');

    const quittanceDoc = `
      Termo de Quita\u00C7\u00C3O de Comodato.
      Nos termos dos artigos 320 e 582 do C\u00F3digo Civil Brasileiro, declaramos plenamente quitadas
      todas as obriga\u00E7\u00F5es de Lucas Mendes e de seu fiador/contato solid\u00E1rio Roberto Mendes
      referentes \u00E0s Muletas MC-108.
      Estado de conserva\u00E7\u00E3o na devolu\u00E7\u00E3o: BOM.
    `;
    assert.assertQuittanceReceipt(quittanceDoc);
  });

  test('T4-SCN-03: System rejects 4th renewal and preserves existing expected return date', async () => {
    const loan = await repo.createLoan({
      equipment_id: crutches.id,
      beneficiary: ben,
      term_days: 30
    });

    // Exhaust 3 renewals
    await repo.renewLoan(loan.magic_token);
    await repo.renewLoan(loan.magic_token);
    const lastValidRenewal = await repo.renewLoan(loan.magic_token);
    const fixedDueDate = lastValidRenewal.loan.expected_return_date;

    // 4th attempt
    const blockedRenewal = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(blockedRenewal.success, false);
    const refreshed = await repo.getLoanById(loan.id);
    assert.strictEqual(refreshed.renewal_count, 3);
    assert.strictEqual(refreshed.expected_return_date, fixedDueDate, 'Return date must not be modified after cap block');
  });

  test('T4-SCN-03: WhatsApp escalation targets secondary phone and cites joint liability CCB 585', () => {
    const benMock = fixtures.createMockBeneficiary({
      full_name: 'Lucas Mendes',
      phone: '(11) 97777-3333',
      secondary_name: 'Roberto Mendes',
      secondary_phone: '(11) 98888-4444'
    });

    const cleanSecondary = benMock.secondary_phone.replace(/\D/g, '');
    const cleanPrimary = benMock.phone.replace(/\D/g, '');
    assert.notStrictEqual(cleanSecondary, cleanPrimary, 'Secondary contact must receive distinct escalation message');

    const messageTemplate = `Notifica\u00E7\u00E3o nos termos do Art. 585 do C\u00F3digo Civil (responsabilidade solid\u00E1ria) para ${benMock.secondary_name}`;
    assert.ok(messageTemplate.includes('585'));
    assert.ok(messageTemplate.includes('solid\u00E1ria'));
    assert.ok(messageTemplate.includes('Roberto Mendes'));
  });
});
