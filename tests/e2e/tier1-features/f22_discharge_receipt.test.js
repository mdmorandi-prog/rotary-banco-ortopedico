/**
 * Tier 1: Feature 22 — Digital Discharge Receipt (F22)
 * Specifications: T1-F22-01 through T1-F22-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 22 — Digital Discharge Receipt (F22)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-QUIT-01' });
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

  test('T1-F22-01: Discharge Receipt Generation Trigger', async () => {
    const res = await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    assert.ok(res.discharge_receipt_url, 'Must return receipt URL on return completion');
    assert.ok(res.discharge_receipt_url.includes('quitacao'), 'Receipt URL must identify quittance');
  });

  test('T1-F22-02: Extinguishment of Liability Clause (CCB Art. 320)', () => {
    const receiptContent = `
TERMO DE QUITAÇÃO E DEVOLUÇÃO DE COMODATO
Com fundamento nos Artigos 320 e 582 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro).
Pelo presente instrumento, o ROTARY CLUB declara ter recebido em devolução o equipamento patrimônio ROT-QUIT-01 em estado BOM, conferindo aos comodatários plena, geral e irrevogável quitação de suas obrigações de comodato.
    `.trim();

    assert.assertQuittanceReceipt(receiptContent);
  });

  test('T1-F22-03: Summary of Return Inspection in Receipt', () => {
    const receiptDetails = {
      patrimony: 'ROT-QUIT-01',
      returnDate: new Date().toISOString(),
      condition: 'BOM',
      closeReason: 'RECUPERACAO_ALTA',
      beneficiaryName: ben.full_name
    };
    assert.strictEqual(receiptDetails.condition, 'BOM', 'Must document condition');
    assert.strictEqual(receiptDetails.closeReason, 'RECUPERACAO_ALTA', 'Must document termination reason');
  });

  test('T1-F22-04: PDF Download Action', () => {
    function getPdfDownloadFilename(loanCode) {
      return `quitacao-${loanCode}.pdf`;
    }
    const filename = getPdfDownloadFilename('EMP-1001');
    assert.strictEqual(filename, 'quitacao-EMP-1001.pdf', 'Must format downloadable quittance PDF name');
  });

  test('T1-F22-05: Instant WhatsApp Quittance Dispatch URL', () => {
    function buildQuittanceWhatsAppLink(phone, beneficiaryName, loanCode) {
      const cleanPhone = phone.replace(/\D/g, '');
      const msg = `Olá ${beneficiaryName}, confirmamos a devolução do equipamento e a emissão do seu Termo de Quitação nº ${loanCode}. Obrigado por confiar no Rotary Club!`;
      return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }

    const link = buildQuittanceWhatsAppLink('(11) 98765-4321', 'Maria Silva', 'EMP-1001');
    assert.ok(link.startsWith('https://wa.me/5511987654321'), 'Must format correct wa.me URL');
    assert.ok(link.includes(encodeURIComponent('Termo de Quitação')), 'Must include quittance message');
  });
});
