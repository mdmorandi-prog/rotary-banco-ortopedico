/**
 * Tier 3: Interaction 06 — Maintenance Refurbishment Release (T3-INT-06)
 * Features: F4, F7, F8, F13
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 06 — Maintenance Release (T3-INT-06)', () => {
  let repo;
  let eq;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('MANUTENCAO', {
      id: 'eq-bath-05',
      patrimony_code: 'CB-019',
      condition: 'PRECISA_REPARO'
    });

    repo = createInMemoryRepository({
      equipments: [eq],
      maintenance_logs: [
        {
          id: 'maint-01',
          equipment_id: eq.id,
          maintenance_type: 'CORRETIVA',
          description: 'Rodízios enferrujados e travados',
          cost: 0,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString()
        }
      ]
    });
  });

  test('T3-INT-06-A: Item in MANUTENCAO cannot be loaned', async () => {
    const ben = fixtures.createMockBeneficiary();
    await assert.rejects(async () => {
      await repo.createLoan({
        equipment_id: eq.id,
        beneficiary: ben
      });
    }, /Equipment is not available for loan/);
  });

  test('T3-INT-06-B: Workshop repair logs cost, updates condition to BOM, and restores DISPONIVEL', async () => {
    // Technician completes repair
    async function completeMaintenance(equipmentId, repairData) {
      const item = await repo.getEquipmentById(equipmentId);
      if (!item) throw new Error('Item not found');

      // Update maintenance log
      const log = repo._internal.maintenanceLogs.find(m => m.equipment_id === equipmentId);
      if (log) {
        log.cost = repairData.cost;
        log.description += ` | Concluído: ${repairData.notes}`;
        log.completed_at = new Date().toISOString();
      }

      // Update equipment status
      await repo.updateEquipment(equipmentId, {
        status: 'DISPONIVEL',
        condition: repairData.newCondition || 'BOM'
      });

      return { success: true };
    }

    const res = await completeMaintenance(eq.id, {
      cost: 45.00,
      notes: 'Substituídos 4 rodízios inox e lubrificado o chassi',
      newCondition: 'BOM'
    });

    assert.strictEqual(res.success, true);

    const restoredEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(restoredEq.status, 'DISPONIVEL', 'Equipment status must return to DISPONIVEL');
    assert.strictEqual(restoredEq.condition, 'BOM', 'Condition must improve to BOM');

    const log = repo._internal.maintenanceLogs.find(m => m.equipment_id === eq.id);
    assert.strictEqual(log.cost, 45.00);
    assert.ok(log.completed_at);
  });
});
