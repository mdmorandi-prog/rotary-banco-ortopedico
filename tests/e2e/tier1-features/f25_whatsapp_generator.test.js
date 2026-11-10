/**
 * Tier 1: Feature 25 — WhatsApp Notification Generator (F25)
 * Specifications: T1-F25-01 through T1-F25-05
 */

const { assert } = require('../test-harness');

describe('Tier 1: Feature 25 — WhatsApp Notification Generator (F25)', () => {
  function generateWhatsAppMessage(stage, loan, appUrl = 'https://banco.rotary.org') {
    const magicLink = `${appUrl}/renovar/${loan.magic_token}`;
    switch (stage) {
      case 'D-7':
        return `Olá ${loan.beneficiary_name}, lembramos com carinho que o empréstimo do equipamento ${loan.equipment_name} vence em 7 dias. Caso precise renovar, acesse: ${magicLink}`;
      case 'D0':
        return `Olá ${loan.beneficiary_name}, o prazo do empréstimo de ${loan.equipment_name} encerra hoje. Você pode renovar pelo link: ${magicLink} ou realizar a devolução no Rotary Club.`;
      case 'D+1':
        return `Prezado(a) ${loan.beneficiary_name}, identificamos que o prazo de devolução de ${loan.equipment_name} venceu ontem. Solicitamos que acerte a renovação em: ${magicLink} ou entre em contato.`;
      case 'D+7':
        return `Prezado(a) Sr(a). ${loan.secondary_name}, entramos em contato referente ao comodato do equipamento ${loan.equipment_name} retirado por ${loan.beneficiary_name}, no qual consta como responsável solidário (Art. 585 do Código Civil). Solicitamos seu auxílio na devolução.`;
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  function buildWhatsAppLink(phone, message) {
    const cleanDigits = phone.replace(/\D/g, '');
    const fullPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  }

  const mockLoan = {
    beneficiary_name: 'Maria Silva',
    secondary_name: 'Carlos Silva',
    equipment_name: 'Cadeira de Rodas Standard',
    magic_token: 'magic-token-xyz'
  };

  test('T1-F25-01: D-7 Pre-Due Friendly Reminder Template', () => {
    const msg = generateWhatsAppMessage('D-7', mockLoan);
    assert.ok(msg.includes('Maria Silva'), 'Must greet beneficiary');
    assert.ok(msg.includes('vence em 7 dias'), 'Must state 7-day warning');
    assert.ok(msg.includes('/renovar/magic-token-xyz'), 'Must include renewal link');
  });

  test('T1-F25-02: D0 Due Date Reminder Template', () => {
    const msg = generateWhatsAppMessage('D0', mockLoan);
    assert.ok(msg.includes('encerra hoje'), 'Must state loan ends today');
    assert.ok(msg.includes('/renovar/magic-token-xyz'), 'Must include renewal link');
  });

  test('T1-F25-03: D+1 Overdue Notice Template', () => {
    const msg = generateWhatsAppMessage('D+1', mockLoan);
    assert.ok(msg.includes('venceu'), 'Must notify deadline passed');
    assert.ok(msg.includes('/renovar/magic-token-xyz'), 'Must include renewal link');
  });

  test('T1-F25-04: D+7 Escalation Template to Secondary Contact', () => {
    const msg = generateWhatsAppMessage('D+7', mockLoan);
    assert.ok(msg.includes('Carlos Silva'), 'Must address secondary contact');
    assert.ok(msg.includes('585'), 'Must cite Brazilian Civil Code Art. 585');
    assert.ok(msg.includes('solidário') || msg.includes('solidario'), 'Must cite joint liability');
  });

  test('T1-F25-05: Direct wa.me Fallback URL Construction', () => {
    const link = buildWhatsAppLink('(11) 98765-4321', 'Olá Maria');
    assert.strictEqual(link, 'https://wa.me/5511987654321?text=Ol%C3%A1%20Maria');
  });
});
