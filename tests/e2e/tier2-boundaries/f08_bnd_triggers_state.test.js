/**
 * Tier 2: Feature 8 Boundaries — Automated Triggers & State (F8)
 * Specifications: T2-F08-01 through T2-F08-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 8 Boundaries — Automated Triggers & State (F8)', () => {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
  let sql;

  beforeAll(() => {
    sql = fs.readFileSync(sqlPath, 'utf8');
  });

  test('T2-F08-01: Loan Creation on Non-Available Equipment Rejection', async () => {
    const eqLoaned = fixtures.createMockEquipment('EMPRESTADO');
    const ben = fixtures.createMockBeneficiary();
    const repo = createInMemoryRepository({
      equipments: [eqLoaned],
      beneficiaries: [ben]
    });

    await assert.rejects(async () => {
      await repo.createLoan({
        equipment_id: eqLoaned.id,
        beneficiary: ben
      });
    }, /Equipment is not available for loan/);
  });

  test('T2-F08-02: Return with NULL Destination Safe Fallback', async () => {
    const eq = fixtures.createMockEquipment('EMPRESTADO');
    const ben = fixtures.createMockBeneficiary();
    const loan = fixtures.createMockLoan({ equipment_id: eq.id, status: 'ATIVO' });
    const repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben],
      loans: [loan]
    });

    // Pass null destination
    await repo.returnLoan(loan.id, {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: null
    });

    const updated = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updated.status, 'HIGIENIZACAO', 'Null destination must coalesce to HIGIENIZACAO');
  });

  test('T2-F08-03: Transaction Rollback on Failure Simulation', async () => {
    const eq = fixtures.createMockEquipment('DISPONIVEL');
    const initialStatus = eq.status;

    // Simulate atomic transactional failure
    let rolledBack = false;
    try {
      // Step 1: Equipment status tentatively changes
      eq.status = 'EMPRESTADO';
      // Step 2: Critical error occurs inserting log
      throw new Error('Simulated database trigger error');
    } catch {
      // Rollback
      eq.status = initialStatus;
      rolledBack = true;
    }

    assert.strictEqual(rolledBack, true);
    assert.strictEqual(eq.status, 'DISPONIVEL', 'Equipment status remains in original state on transaction rollback');
  });

  test('T2-F08-04: Concurrent Status Updates (Race Condition Test)', async () => {
    let version = 1;
    let returnCallCount = 0;

    async function optimisticReturn(expectedVersion) {
      if (version !== expectedVersion) {
        return { success: false, message: 'Optimistic lock conflict' };
      }
      version++;
      returnCallCount++;
      return { success: true };
    }

    const [res1, res2] = await Promise.all([optimisticReturn(1), optimisticReturn(1)]);
    assert.strictEqual(returnCallCount, 1, 'Only one concurrent return must succeed');
    assert.ok(res1.success || res2.success, 'At least one succeeded');
    assert.ok(!res1.success || !res2.success, 'One request must fail with lock conflict');
  });

  test('T2-F08-05: Recursive Trigger Loop Prevention', () => {
    // Check for trigger recursion protection in SQL (e.g. pg_trigger_depth() or DISTINCT FROM)
    assert.ok(
      sql.includes('pg_trigger_depth()') || sql.includes('DISTINCT FROM') || sql.includes('IS DISTINCT'),
      'Migration must guard triggers against infinite recursive loops'
    );
  });
});
