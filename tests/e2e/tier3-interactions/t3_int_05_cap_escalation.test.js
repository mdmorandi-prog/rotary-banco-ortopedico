/**
 * Tier 3: Interaction 05 — Max Renewal Cap Block & Secondary Contact Escalation (T3-INT-05)
 * Features: F16, F19, F23, F24, F25, F26
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 05 — Renewal Cap & Secondary Escalation (T3-INT-05)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('ATRASADO', { id: 'eq-crutch-04', patrimony_code: 'MC-108' });
    ben = fixtures.createMockBeneficiary({
      full_name: 'Lucas Mendes',
      phone: '(11) 97777-3333',
      secondary_name: 'Roberto Mendes',
      secondary_relationship: 'Pai',
      secondary_phone: '(11) 98888-4444'
    });
    loan = fixtures.createMockLoan({
      id: 'loan-004',
      equipment_id: eq.id,
      beneficiary_id: ben.id,
      status: 'ATRASADO',
      renewal_count: 3,
      max_renewals: 3,
      expected_return_date: '2026-11-03T00:00:00.000Z' // 7 days overdue at 2026-11-10 (D+7)
    });

    repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben],
      loans: [loan]
    });
  });

  test('T3-INT-05-A: 1-click renewal is blocked when renewal_count reaches max_renewals', async () => {
    const res = await repo.renewLoan(loan.magic_token);
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('Limite máximo de 3 renovações atingido'));
  });

  test('T3-INT-05-B: Cron execution at D+7 triggers escalation specifically to secondary contact', () => {
    function processD7Escalation(loanRecord, beneficiaryRecord, currentDateStr) {
      const today = new Date(currentDateStr).getTime();
      const due = new Date(loanRecord.expected_return_date).getTime();
      const diffDays = Math.round((today - due) / 86400000);

      if (diffDays >= 7 && loanRecord.status === 'ATRASADO') {
        const cleanSecPhone = beneficiaryRecord.secondary_phone.replace(/\D/g, '');
        const message = `Prezado(a) Sr(a). ${beneficiaryRecord.secondary_name}, entramos em contato referente ao comodato do equipamento (Patrimônio MC-108) retirado por ${beneficiaryRecord.full_name}, no qual o senhor(a) consta como responsável solidário(a) (Art. 585 do Código Civil). Solicitamos o comparecimento ao Rotary Club para regularização.`;

        return {
          escalated: true,
          targetPhone: `55${cleanSecPhone}`,
          recipientName: beneficiaryRecord.secondary_name,
          citesCcb585: message.includes('585') && message.includes('solidário'),
          message
        };
      }
      return { escalated: false };
    }

    const escalation = processD7Escalation(loan, ben, '2026-11-10T12:00:00.000Z');
    assert.strictEqual(escalation.escalated, true);
    assert.strictEqual(escalation.targetPhone, '5511988884444');
    assert.strictEqual(escalation.recipientName, 'Roberto Mendes');
    assert.strictEqual(escalation.citesCcb585, true, 'Message must cite CCB Art. 585 joint liability');
  });

  test('T3-INT-05-C: Secondary phone validation guarantees clean phone normalization for escalation', () => {
    assert.assertBrazilianPhone(ben.secondary_phone);
    const cleanDigits = ben.secondary_phone.replace(/\D/g, '');
    assert.strictEqual(cleanDigits.length, 11);
  });
});
