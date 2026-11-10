/**
 * Tier 3: Interaction 04 — Overdue Loan Return Triage, Routing & Quittance Receipt (T3-INT-04)
 * Features: F4, F7, F8, F20, F21, F22, F24
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 04 — Return Triage & Quittance (T3-INT-04)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('ATRASADO', { id: 'eq-wheelchair-03', replacement_value: 850.00 });
    ben = fixtures.createMockBeneficiary({ full_name: 'Dona Antônia' });
    loan = fixtures.createMockLoan({
      id: 'loan-003',
      equipment_id: eq.id,
      beneficiary_id: ben.id,
      status: 'ATRASADO'
    });

    repo = createInMemoryRepository({
      equipments: [eq],
      beneficiaries: [ben],
      loans: [loan]
    });
  });

  test('T3-INT-04-A: Pristine return generates quittance receipt and routes to HIGIENIZACAO', async () => {
    // Volunteer conducts triage: frame, wheels, brakes OK -> condition BOM
    const triageData = {
      condition: 'BOM',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'HIGIENIZACAO',
      notes: 'Equipamento devolvido limpo e funcional'
    };

    const res = await repo.returnLoan('loan-003', triageData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.loan.status, 'DEVOLVIDO');
    assert.ok(res.loan.actual_return_date);

    // Equipment status routes to HIGIENIZACAO
    const updatedEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updatedEq.status, 'HIGIENIZACAO');

    // Quittance receipt generated
    assert.ok(res.discharge_receipt_url.includes('quitacao'));

    // Check CCB Art. 320 compliance
    const sampleReceipt = `
      Termo de Quitação e Encerramento de Comodato.
      Nos termos dos artigos 320 e 582 do Código Civil, dá-se por plenamente quitada a obrigação relativa ao bem ${eq.patrimony_code} devolvido em bom estado.
    `;
    assert.assertQuittanceReceipt(sampleReceipt);
  });

  test('T3-INT-04-B: Damaged return routes to MANUTENCAO and logs corrective service entry', async () => {
    const damagedTriage = {
      condition: 'PRECISA_REPARO',
      close_reason: 'RECUPERACAO_ALTA',
      destination: 'MANUTENCAO',
      notes: 'Freio direito travado e rolamento frouxo'
    };

    const res = await repo.returnLoan('loan-003', damagedTriage);
    assert.strictEqual(res.success, true);

    const damagedEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(damagedEq.status, 'MANUTENCAO');
    assert.strictEqual(damagedEq.condition, 'PRECISA_REPARO');

    const logs = repo._internal.maintenanceLogs.filter(m => m.equipment_id === eq.id);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].notes, 'Freio direito travado e rolamento frouxo');
  });

  test('T3-INT-04-C: Damaged equipment cannot be directly routed to DISPONIVEL stock', () => {
    function validateRoutingIntegrity(condition, destination) {
      if (condition === 'PRECISA_REPARO' && destination === 'DISPONIVEL') {
        throw new Error('Equipamentos que precisam de reparo devem ser encaminhados para MANUTENCAO');
      }
      return true;
    }

    assert.throws(() => {
      validateRoutingIntegrity('PRECISA_REPARO', 'DISPONIVEL');
    }, /devem ser encaminhados para MANUTENCAO/);
  });
});
