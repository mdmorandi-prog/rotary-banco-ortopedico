/**
 * Tier 3: Interaction 07 — Sanitary Hygiene Clearance Gate (T3-INT-07)
 * Features: F4, F8, F13, F20
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 07 — Hygiene Clearance (T3-INT-07)', () => {
  let repo;
  let eq;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('HIGIENIZACAO', {
      id: 'eq-bed-07',
      patrimony_code: 'CH-015'
    });

    repo = createInMemoryRepository({
      equipments: [eq]
    });
  });

  test('T3-INT-07-A: Equipment in HIGIENIZACAO cannot be allocated to new loans', async () => {
    const ben = fixtures.createMockBeneficiary();
    await assert.rejects(async () => {
      await repo.createLoan({
        equipment_id: eq.id,
        beneficiary: ben
      });
    }, /Equipment is not available for loan/);
  });

  test('T3-INT-07-B: Volunteer clearance transitions equipment from HIGIENIZACAO to DISPONIVEL', async () => {
    // Sanitary action clearance via /item/[qr_token]
    async function clearHygieneToStock(equipmentId) {
      const item = await repo.getEquipmentById(equipmentId);
      if (item.status !== 'HIGIENIZACAO') {
        throw new Error('Item não está em higienização');
      }

      await repo.updateEquipment(equipmentId, {
        status: 'DISPONIVEL',
        notes: 'Desinfecção hospitalar concluída com quaternário de amônio'
      });

      return { success: true };
    }

    const res = await clearHygieneToStock(eq.id);
    assert.strictEqual(res.success, true);

    const cleared = await repo.getEquipmentById(eq.id);
    assert.strictEqual(cleared.status, 'DISPONIVEL', 'Item must be restored to DISPONIVEL stock');

    // Now allocation must succeed
    const ben = fixtures.createMockBeneficiary();
    const loan = await repo.createLoan({ equipment_id: eq.id, beneficiary: ben });
    assert.ok(loan.id);
    assert.strictEqual(loan.status, 'ATIVO');
  });
});
