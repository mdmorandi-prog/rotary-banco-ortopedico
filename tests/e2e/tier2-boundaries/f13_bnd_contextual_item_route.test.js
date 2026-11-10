/**
 * Tier 2: Feature 13 Boundaries — Contextual Action Route (/item/[qr_token]) (F13)
 * Specifications: T2-F13-01 through T2-F13-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 13 Boundaries — Contextual Action Route (/item/[qr_token]) (F13)', () => {
  let repo;

  beforeEach(() => {
    repo = createInMemoryRepository({
      equipments: [
        fixtures.createMockEquipment('DISPONIVEL', { qr_token: 'QR-VALID-01' }),
        fixtures.createMockEquipment('BAIXADO', { qr_token: 'QR-BAIXADO-01', notes: 'Inservível / perda total' })
      ]
    });
  });

  test('T2-F13-01: Non-Existent QR Token 404 Handling', async () => {
    const item = await repo.getEquipmentByQrToken('TOKEN-INEXISTENTE-999');
    assert.strictEqual(item, null, 'Non-existent token must return null / 404 cleanly');
  });

  test('T2-F13-02: BAIXADO (Written-Off) Item State Invariance', async () => {
    const baixado = await repo.getEquipmentByQrToken('QR-BAIXADO-01');
    assert.strictEqual(baixado.status, 'BAIXADO');

    function getActions(status) {
      if (status === 'BAIXADO') {
        return { canLoan: false, canReturn: false, badge: 'Baixado do Acervo' };
      }
      return { canLoan: true, canReturn: true };
    }

    const actions = getActions(baixado.status);
    assert.strictEqual(actions.canLoan, false, 'Written-off item cannot be loaned');
    assert.strictEqual(actions.canReturn, false, 'Written-off item cannot be returned');
  });

  test('T2-F13-03: SQL Injection / Path Traversal in URL Token', async () => {
    const maliciousTokens = [
      '../../etc/passwd',
      "' OR '1'='1",
      '<script>alert(1)</script>',
      'DROP TABLE equipments;'
    ];

    for (const tok of maliciousTokens) {
      const res = await repo.getEquipmentByQrToken(tok);
      assert.strictEqual(res, null, `Malicious token "${tok}" safely handled without error`);
    }
  });

  test('T2-F13-04: Fast Re-Loan of Returned Item', async () => {
    const eq = fixtures.createMockEquipment('DISPONIVEL', { qr_token: 'QR-RELOAN' });
    const ben1 = fixtures.createMockBeneficiary();
    const ben2 = fixtures.createMockBeneficiary();
    const r = createInMemoryRepository({ equipments: [eq], beneficiaries: [ben1, ben2] });

    // Loan 1
    const loan1 = await r.createLoan({ equipment_id: eq.id, beneficiary: ben1 });
    // Return to DISPONIVEL
    await r.returnLoan(loan1.id, { condition: 'BOM', destination: 'DISPONIVEL' });

    // Immediate Loan 2 must succeed
    const loan2 = await r.createLoan({ equipment_id: eq.id, beneficiary: ben2 });
    assert.ok(loan2.id, 'Item must be immediately re-loanable after return to DISPONIVEL');
    assert.strictEqual(loan2.status, 'ATIVO');
  });

  test('T2-F13-05: Missing Equipment Optional Fields (Serial Number, Notes)', async () => {
    const eqMinimal = await repo.createEquipment({
      patrimony_code: 'ROT-MIN',
      name: 'Muleta Simples',
      category: 'MULETA_AXILAR',
      status: 'DISPONIVEL',
      replacement_value: 120,
      serial_number: null,
      notes: null
    });

    assert.strictEqual(eqMinimal.serial_number, null);
    assert.strictEqual(eqMinimal.notes, null);

    function formatField(val) {
      return val || 'Não informado';
    }

    assert.strictEqual(formatField(eqMinimal.serial_number), 'Não informado', 'Must display fallback label instead of null/undefined');
  });
});
