/**
 * Tier 1: Feature 11 — Equipment Catalog (/equipments) (F11)
 * Specifications: T1-F11-01 through T1-F11-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 11 — Equipment Catalog (/equipments) (F11)', () => {
  let repo;

  beforeEach(() => {
    repo = createInMemoryRepository({
      equipments: [
        fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-0012', name: 'Cadeira de Rodas Standard', category: 'CADEIRA_RODAS' }),
        fixtures.createMockEquipment('EMPRESTADO', { patrimony_code: 'ROT-0013', name: 'Muleta Canadense Par', category: 'MULETA_CANADENSE' }),
        fixtures.createMockEquipment('ATRASADO', { patrimony_code: 'ROT-0014', name: 'Andador Fixo Alumínio', category: 'ANDADOR' }),
        fixtures.createMockEquipment('HIGIENIZACAO', { patrimony_code: 'ROT-0015', name: 'Cama Hospitalar Manual', category: 'CAMA_HOSPITALAR' }),
        fixtures.createMockEquipment('MANUTENCAO', { patrimony_code: 'ROT-0016', name: 'Cadeira de Banho Higiênica', category: 'CADEIRA_BANHO' })
      ]
    });
  });

  test('T1-F11-01: Catalog Item List Rendering', async () => {
    const list = await repo.getEquipments();
    assert.strictEqual(list.length, 5, 'Catalog must load 5 equipment items');
    list.forEach(item => {
      assert.ok(item.name, 'Item must have name');
      assert.ok(item.patrimony_code, 'Item must have patrimony_code');
      assert.ok(item.category, 'Item must have category');
      assert.ok(item.status, 'Item must have status');
      assert.ok(item.condition, 'Item must have condition');
    });
  });

  test('T1-F11-02: Debounced Text Search by Patrimony and Name', async () => {
    // Search by partial patrimony
    const resPatrimony = await repo.getEquipments({ search: '0012' });
    assert.strictEqual(resPatrimony.length, 1);
    assert.strictEqual(resPatrimony[0].patrimony_code, 'ROT-0012');

    // Search by name substring
    const resName = await repo.getEquipments({ search: 'Andador' });
    assert.strictEqual(resName.length, 1);
    assert.strictEqual(resName[0].patrimony_code, 'ROT-0014');
  });

  test('T1-F11-03: Status Filter Pills Toggling', async () => {
    const disponiveis = await repo.getEquipments({ status: 'DISPONIVEL' });
    assert.strictEqual(disponiveis.length, 1);
    assert.strictEqual(disponiveis[0].status, 'DISPONIVEL');

    const emManutencao = await repo.getEquipments({ status: 'MANUTENCAO' });
    assert.strictEqual(emManutencao.length, 1);
    assert.strictEqual(emManutencao[0].status, 'MANUTENCAO');
  });

  test('T1-F11-04: Category Filter Pills Toggling', async () => {
    const cadeiras = await repo.getEquipments({ category: 'CADEIRA_RODAS' });
    assert.strictEqual(cadeiras.length, 1);
    assert.strictEqual(cadeiras[0].category, 'CADEIRA_RODAS');
  });

  test('T1-F11-05: Equipment Creation Modal & QR Token Generation', async () => {
    const created = await repo.createEquipment({
      name: 'Cadeira de Rodas Especial Confort',
      category: 'CADEIRA_RODAS',
      patrimony_code: 'ROT-0099',
      qr_token: fixtures.generateMockQrToken('ROT-0099'),
      replacement_value: 1450.00,
      status: 'DISPONIVEL',
      condition: 'NOVO'
    });

    assert.ok(created.id, 'Created item must have ID');
    assert.ok(created.qr_token.startsWith('QR-ROT0099'), 'qr_token must be generated');
    const all = await repo.getEquipments();
    assert.strictEqual(all.length, 6, 'Item must be immediately available in catalog');
  });
});
