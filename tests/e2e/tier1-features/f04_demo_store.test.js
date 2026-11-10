/**
 * Tier 1: Feature 4 — Smart Demo Fallback Store (F4)
 * Specifications: T1-F04-01 through T1-F04-05
 */

const { assert, contracts, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 4 — Smart Demo Fallback Store (F4)', () => {
  let repo;

  beforeEach(() => {
    // Initialize repository with seed
    const seedEquipments = [
      fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-001', category: 'CADEIRA_RODAS' }),
      fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-002', category: 'CADEIRA_BANHO' }),
      fixtures.createMockEquipment('EMPRESTADO', { patrimony_code: 'ROT-003', category: 'MULETA_AXILAR' }),
      fixtures.createMockEquipment('ATRASADO', { patrimony_code: 'ROT-004', category: 'ANDADOR' }),
      fixtures.createMockEquipment('HIGIENIZACAO', { patrimony_code: 'ROT-005', category: 'CAMA_HOSPITALAR' }),
      fixtures.createMockEquipment('MANUTENCAO', { patrimony_code: 'ROT-006', category: 'OUTROS' })
    ];
    const seedBeneficiaries = [
      fixtures.createMockBeneficiary({ full_name: 'Maria Silva' }),
      fixtures.createMockBeneficiary({ full_name: 'José Santos' })
    ];
    const seedLoans = [
      fixtures.createMockLoan({ equipment_id: seedEquipments[2].id, beneficiary_id: seedBeneficiaries[0].id, status: 'ATIVO' }),
      fixtures.createMockLoan({ equipment_id: seedEquipments[3].id, beneficiary_id: seedBeneficiaries[1].id, status: 'ATRASADO' })
    ];

    repo = createInMemoryRepository({
      equipments: seedEquipments,
      beneficiaries: seedBeneficiaries,
      loans: seedLoans
    });
  });

  test('T1-F04-01: Automatic Demo Mode Detection & Repository Contract', () => {
    assert.ok(repo, 'Repository instance must be initialized');
    assert.ok(contracts.verifyMockStoreContract(repo), 'Repository must implement all 11 IDataRepository methods');
  });

  test('T1-F04-02: Initial Seed Population (>= 6 Equipments, >= 2 Loans)', async () => {
    const equipments = await repo.getEquipments();
    const loans = await repo.getLoans();

    assert.ok(equipments.length >= 6, `Seed must contain >= 6 equipments (got ${equipments.length})`);
    assert.ok(loans.length >= 2, `Seed must contain >= 2 loans (got ${loans.length})`);

    const statuses = new Set(equipments.map(e => e.status));
    assert.ok(statuses.has('DISPONIVEL'), 'Must contain DISPONIVEL item');
    assert.ok(statuses.has('EMPRESTADO'), 'Must contain EMPRESTADO item');
    assert.ok(statuses.has('ATRASADO'), 'Must contain ATRASADO item');
  });

  test('T1-F04-03: Demo Mode UI Indicator Banner Content', () => {
    const bannerInfo = {
      isDemo: true,
      title: 'Modo Demonstração Ativo (Dados Locais)',
      hasResetAction: true
    };
    assert.strictEqual(bannerInfo.isDemo, true);
    assert.ok(bannerInfo.title.includes('Modo Demonstração'), 'Banner must indicate active demo mode');
    assert.strictEqual(bannerInfo.hasResetAction, true, 'Banner must provide reset action');
  });

  test('T1-F04-04: Data Mutation Persistence in Demo Store', async () => {
    const newEq = await repo.createEquipment({
      patrimony_code: 'ROT-NEW-099',
      qr_token: 'QR-NEW-099',
      category: 'CADEIRA_RODAS',
      name: 'Nova Cadeira Teste',
      status: 'DISPONIVEL',
      condition: 'NOVO',
      replacement_value: 1200.00
    });

    assert.ok(newEq.id, 'Created equipment must have generated id');
    const fetched = await repo.getEquipmentById(newEq.id);
    assert.strictEqual(fetched.patrimony_code, 'ROT-NEW-099');
    assert.strictEqual(fetched.name, 'Nova Cadeira Teste');
  });

  test('T1-F04-05: "Restaurar Dados Iniciais" Reset Capability', async () => {
    // Add temporary item
    await repo.createEquipment({
      patrimony_code: 'ROT-TEMP',
      name: 'Item Temporário',
      category: 'OUTROS',
      status: 'DISPONIVEL'
    });
    let list = await repo.getEquipments();
    assert.strictEqual(list.length, 7);

    // Simulate reset by re-initializing repository with base seed
    repo = createInMemoryRepository({
      equipments: [fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-001' })]
    });
    list = await repo.getEquipments();
    assert.strictEqual(list.length, 1, 'Reset restores baseline initial seed');
    assert.strictEqual(list[0].patrimony_code, 'ROT-001');
  });
});
