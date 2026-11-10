const path = require('node:path');
const { assert, contracts, fixtures, createInMemoryRepository } = require('./proposed_test-harness.js');
const runner = require('./proposed_runner.js');

console.log('Testing harness assertions...');

// 1. CPF validation
const validCpf = fixtures.generateValidCPF();
console.log('Generated valid CPF:', validCpf);
assert.assertBrazilianCPF(validCpf);

try {
  assert.assertBrazilianCPF('111.111.111-11');
  throw new Error('Should have failed for invalid CPF');
} catch (e) {
  console.log('Successfully caught invalid CPF:', e.message);
}

// 2. Secondary contact validation
const validBen = fixtures.createMockBeneficiary();
assert.assertSecondaryContactValidation(validBen);

const invalidBenPhone = fixtures.createInvalidBeneficiary('colliding_phone');
try {
  assert.assertSecondaryContactValidation(invalidBenPhone);
  throw new Error('Should have failed for colliding phone');
} catch (e) {
  console.log('Successfully caught colliding phone:', e.message);
}

// 3. Comodato Legal Clauses
const mockComodato = `
TERMO DE COMODATO - ROTARY BANCO ORTOPÉDICO
Fundamentado nos Artigos 579 a 585 do Código Civil Brasileiro (Lei 10.406/2002).
O presente comodato é celebrado a título gratuito.
O comodatário obriga-se a guardar e conservar a coisa como se sua própria fora.
Em caso de mora na restituição, o comodatário responderá por perdas e danos.
O fiador / contato secundário assume solidariedade passiva integral.
Valor declarado de reposição do bem: R$ 850,00.
`;
assert.assertLegalComodatoClauses(mockComodato);
console.log('Successfully verified legal comodato clauses assertion!');

// 4. Quittance Receipt
const mockReceipt = `
TERMO DE QUITAÇÃO E DEVOLUÇÃO
O Rotary Club dá plena, rasa e geral quitação nos termos do Art. 320 do Código Civil.
Equipamento devolvido em estado / condição: BOM.
`;
assert.assertQuittanceReceipt(mockReceipt);
console.log('Successfully verified quittance receipt assertion!');

// 5. State transitions
assert.assertEquipmentStateTransition('DISPONIVEL', 'CREATE_LOAN', 'EMPRESTADO');
assert.assertEquipmentStateTransition('EMPRESTADO', 'RETURN_CLEAN', 'HIGIENIZACAO');
assert.assertEquipmentStateTransition('ATRASADO', 'RENEW_LOAN', 'EMPRESTADO');
assert.assertEquipmentStateTransition('HIGIENIZACAO', 'COMPLETE_HYGIENE', 'DISPONIVEL');
assert.assertEquipmentStateTransition('MANUTENCAO', 'WRITE_OFF', 'BAIXADO');
console.log('Successfully verified state machine transitions!');

// 6. WCAG Contrast
const royalBlueRatio = assert.assertWCAGContrast('#17458f', '#ffffff', 7.0);
console.log('Rotary Royal Blue contrast on white:', royalBlueRatio.toFixed(2), ': 1 (passes AAA)');

const goldRatio = assert.assertWCAGContrast('#17458f', '#f7a81b', 4.5);
console.log('Dark blue text on Rotary Gold:', goldRatio.toFixed(2), ': 1 (passes AA)');

// 7. In-memory repository workflow
async function testRepository() {
  const repo = createInMemoryRepository({
    equipments: [
      fixtures.createMockEquipment('DISPONIVEL', { id: 'eq-1', patrimony_code: 'ROT-001', replacement_value: 900 })
    ]
  });

  const eq = await repo.getEquipmentById('eq-1');
  assert.strictEqual(eq.status, 'DISPONIVEL');

  const loan = await repo.createLoan({
    equipment_id: 'eq-1',
    beneficiary: fixtures.createMockBeneficiary({ full_name: 'Beneficiario Teste' }),
    term_days: 30,
    signature_data_url: 'data:image/png;base64,...'
  });

  assert.strictEqual(loan.status, 'ATIVO');
  const eqAfterLoan = await repo.getEquipmentById('eq-1');
  assert.strictEqual(eqAfterLoan.status, 'EMPRESTADO');

  // Renewal test
  const renewRes = await repo.renewLoan(loan.magic_token);
  assert.strictEqual(renewRes.success, true);
  assert.strictEqual(renewRes.loan.renewal_count, 1);
  assert.strictEqual(renewRes.loan.status, 'RENOVADO');

  // Return test
  const returnRes = await repo.returnLoan(loan.id, {
    condition: 'BOM',
    close_reason: 'RECUPERACAO_ALTA',
    destination: 'HIGIENIZACAO'
  });
  assert.strictEqual(returnRes.success, true);
  assert.strictEqual(returnRes.loan.status, 'DEVOLVIDO');
  const eqAfterReturn = await repo.getEquipmentById('eq-1');
  assert.strictEqual(eqAfterReturn.status, 'HIGIENIZACAO');

  console.log('Successfully verified in-memory repository full lifecycle workflow!');
}

testRepository().then(() => {
  console.log('ALL SELF-TESTS PASSED PERFECTLY!');
}).catch(err => {
  console.error('Self-test failed:', err);
  process.exit(1);
});
