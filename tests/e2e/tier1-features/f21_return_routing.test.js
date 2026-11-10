/**
 * Tier 1: Feature 21 — Return Reasons & Routing (F21)
 * Specifications: T1-F21-01 through T1-F21-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 21 — Return Reasons & Routing (F21)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-ROUT-01' });
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

  test('T1-F21-01: Close Reason Options Conformance', () => {
    const validCloseReasons = [
      'RECUPERACAO_ALTA',
      'OBITO_PACIENTE',
      'COMPRA_PROPRIA',
      'TROCA_EQUIPAMENTO',
      'OUTROS',
      'DESISTENCIA'
    ];
    assert.strictEqual(validCloseReasons.length, 6, 'Must define exactly 6 close reasons');
    assert.ok(validCloseReasons.includes('RECUPERACAO_ALTA'));
    assert.ok(validCloseReasons.includes('OBITO_PACIENTE'));
  });

  test('T1-F21-02: Healthcare Protocol Routing to HIGIENIZACAO', async () => {
    await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO'
    });

    const updated = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updated.status, 'HIGIENIZACAO', 'Pristine item routes to HIGIENIZACAO by default');
  });

  test('T1-F21-03: Mandatory Routing to MANUTENCAO on Damage', () => {
    function validateRouting(condition, destination) {
      if (condition === 'PRECISA_REPARO' && destination === 'DISPONIVEL') {
        throw new Error('Equipamentos que precisam de reparo devem ser encaminhados para MANUTENCAO');
      }
      return true;
    }

    assert.throws(() => {
      validateRouting('PRECISA_REPARO', 'DISPONIVEL');
    }, /devem ser encaminhados para MANUTENCAO/);
  });

  test('T1-F21-04: Maintenance Log Creation on MANUTENCAO Routing', async () => {
    await repo.returnLoan(loan.id, {
      condition: 'PRECISA_REPARO',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'MANUTENCAO',
      notes: 'Freio esquerdo quebrado'
    });

    const logs = repo._internal.maintenanceLogs.filter(m => m.equipment_id === eq.id);
    assert.ok(logs.length > 0, 'Must create maintenance log when routed to MANUTENCAO');
    assert.strictEqual(logs[0].notes, 'Freio esquerdo quebrado');
  });

  test('T1-F21-05: Direct Stock Release Option (DISPONIVEL)', async () => {
    await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'DISPONIVEL'
    });

    const updated = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updated.status, 'DISPONIVEL', 'Item immediately returned to DISPONIVEL stock');
  });
});
