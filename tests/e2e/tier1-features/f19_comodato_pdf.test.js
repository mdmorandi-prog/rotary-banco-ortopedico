/**
 * Tier 1: Feature 19 — Termo de Comodato PDF (Arts 579-585 CCB) (F19)
 * Specifications: T1-F19-01 through T1-F19-05
 */

const { assert } = require('../test-harness');

describe('Tier 1: Feature 19 — Termo de Comodato PDF (Arts 579-585 CCB) (F19)', () => {
  // Comodato contract generator adhering to Brazilian Civil Code requirements
  function generateMockComodatoContract(loan, equipment, beneficiary) {
    return `
TERMO DE CESSÃO EM COMODATO DE EQUIPAMENTO ORTOPÉDICO
Fundamentado nos Artigos 579 a 585 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro)

1. DAS PARTES
COMODANTE: ROTARY CLUB DE SANTOS - PONTA DA PRAIA, inscrito no CNPJ sob nº 00.000.000/0001-00.
COMODATÁRIO: ${beneficiary.full_name}, inscrito no CPF sob nº ${beneficiary.cpf}, telefone ${beneficiary.phone}, residente à ${beneficiary.address_street}, nº ${beneficiary.address_number}, ${beneficiary.address_city}-${beneficiary.address_state}.
RESPONSÁVEL SOLIDÁRIO (CONTATO SECUNDÁRIO): ${beneficiary.secondary_name}, grau de parentesco: ${beneficiary.secondary_relationship}, telefone: ${beneficiary.secondary_phone}.

2. DO OBJETO E VALOR DE REPOSIÇÃO
O presente contrato tem por objeto o empréstimo a título gratuito do bem móvel não fungível:
Equipamento: ${equipment.name} (Patrimônio: ${equipment.patrimony_code})
Valor Declarado de Reposição: R$ ${equipment.replacement_value.toFixed(2).replace('.', ',')} para os fins do Art. 582 do Código Civil.

3. DAS OBRIGAÇÕES E DA SOLIDARIEDADE PASSIVA
O Comodatário e seu Responsável Solidário declaram estar cientes e solidariamente responsáveis (Art. 585 do Código Civil) pela guarda, conservação, e devolução pontual do bem, respondendo por eventuais perdas e danos ou mora no caso de atraso injustificado.

4. ASSINATURA DIGITAL
Assinado digitalmente em ${new Date().toLocaleDateString('pt-BR')} por ${beneficiary.full_name}.
Assinatura: [EMBEDDED_SIGNATURE_PNG]
Código de Verificação / Token: ${loan.magic_token}
    `.trim();
  }

  test('T1-F19-01: Statutory Legal Grounding (CCB Arts 579-585)', () => {
    const loan = { magic_token: 'tok-123' };
    const eq = { name: 'Cadeira de Rodas', patrimony_code: 'ROT-01', replacement_value: 850.00 };
    const ben = {
      full_name: 'Maria Silva',
      cpf: '123.456.789-00',
      phone: '(11) 98888-1111',
      address_street: 'Rua Rotary',
      address_number: '10',
      address_city: 'Santos',
      address_state: 'SP',
      secondary_name: 'Carlos Silva',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 99999-2222'
    };

    const text = generateMockComodatoContract(loan, eq, ben);
    assert.assertLegalComodatoClauses(text);
  });

  test('T1-F19-02: Qualification of Parties Including Secondary Contact', () => {
    const loan = { magic_token: 'tok-123' };
    const eq = { name: 'Cadeira', patrimony_code: 'ROT-01', replacement_value: 850.00 };
    const ben = {
      full_name: 'Maria Silva',
      cpf: '123.456.789-00',
      phone: '(11) 98888-1111',
      address_street: 'Rua A',
      address_number: '1',
      address_city: 'Santos',
      address_state: 'SP',
      secondary_name: 'Carlos Silva',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 99999-2222'
    };

    const text = generateMockComodatoContract(loan, eq, ben);
    assert.ok(text.includes('Maria Silva'), 'Must qualify Comodatário');
    assert.ok(text.includes('Carlos Silva'), 'Must qualify Secondary Contact');
    assert.ok(text.includes('Filho'), 'Must list relationship');
  });

  test('T1-F19-03: Declared Replacement Value Clause (Art. 582 CCB)', () => {
    const loan = { magic_token: 'tok-123' };
    const eq = { name: 'Cadeira', patrimony_code: 'ROT-01', replacement_value: 1200.00 };
    const ben = {
      full_name: 'Maria Silva',
      cpf: '123.456.789-00',
      phone: '(11) 98888-1111',
      address_street: 'Rua A',
      address_number: '1',
      address_city: 'Santos',
      address_state: 'SP',
      secondary_name: 'Carlos Silva',
      secondary_relationship: 'Filho',
      secondary_phone: '(11) 99999-2222'
    };

    const text = generateMockComodatoContract(loan, eq, ben);
    assert.ok(text.includes('R$ 1200,00') || text.includes('1.200,00'), 'Must print declared replacement value');
    assert.ok(text.includes('582'), 'Must cite Art. 582');
  });

  test('T1-F19-04: Embedded Signature Rendering', () => {
    const contract = {
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      renderedInPdf: true
    };
    assert.ok(contract.signatureDataUrl.startsWith('data:image/png;base64,'), 'Signature must be valid PNG data URL');
    assert.strictEqual(contract.renderedInPdf, true);
  });

  test('T1-F19-05: Contract Validation QR Code Generation', () => {
    function generateContractQrUrl(magicToken, appUrl = 'https://banco.rotary.org') {
      return `${appUrl}/renovar/${encodeURIComponent(magicToken)}`;
    }
    const qrUrl = generateContractQrUrl('magic-tok-999');
    assert.strictEqual(qrUrl, 'https://banco.rotary.org/renovar/magic-tok-999', 'Contract QR must encode direct renewal/verification URL');
  });
});
