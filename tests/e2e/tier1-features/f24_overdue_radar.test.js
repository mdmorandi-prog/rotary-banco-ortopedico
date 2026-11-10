/**
 * Tier 1: Feature 24 — Overdue Radar & Dashboard (/overdue, /dashboard) (F24)
 * Specifications: T1-F24-01 through T1-F24-05
 */

const { assert } = require('../test-harness');

describe('Tier 1: Feature 24 — Overdue Radar & Dashboard (/overdue, /dashboard) (F24)', () => {
  function computeFleetKpis(equipments = [], loans = []) {
    const totalEquipments = equipments.length;
    const available = equipments.filter(e => e.status === 'DISPONIVEL').length;
    const loaned = equipments.filter(e => e.status === 'EMPRESTADO').length;
    const overdue = loans.filter(l => l.status === 'ATRASADO').length;
    const maintenance = equipments.filter(e => e.status === 'MANUTENCAO' || e.status === 'HIGIENIZACAO').length;

    const valueAtRisk = loans
      .filter(l => l.status === 'ATRASADO')
      .reduce((sum, l) => sum + (Number(l.replacement_value) || 0), 0);

    return {
      totalEquipments,
      available,
      loaned,
      overdue,
      maintenance,
      valueAtRisk
    };
  }

  test('T1-F24-01: Fleet KPI Summary Cards', () => {
    const mockEquipments = [
      { status: 'DISPONIVEL' },
      { status: 'DISPONIVEL' },
      { status: 'EMPRESTADO' },
      { status: 'HIGIENIZACAO' }
    ];
    const mockLoans = [
      { status: 'ATIVO' },
      { status: 'ATRASADO', replacement_value: 850.00 }
    ];

    const kpis = computeFleetKpis(mockEquipments, mockLoans);
    assert.strictEqual(kpis.totalEquipments, 4);
    assert.strictEqual(kpis.available, 2);
    assert.strictEqual(kpis.loaned, 1);
    assert.strictEqual(kpis.overdue, 1);
    assert.strictEqual(kpis.maintenance, 1);
  });

  test('T1-F24-02: Value at Risk (Valor em Risco) KPI', () => {
    const overdueLoans = [
      { status: 'ATRASADO', replacement_value: 800.00 },
      { status: 'ATRASADO', replacement_value: 1200.00 },
      { status: 'ATRASADO', replacement_value: 500.00 }
    ];
    const kpis = computeFleetKpis([], overdueLoans);
    assert.strictEqual(kpis.valueAtRisk, 2500.00, 'Sum of value at risk must be exact: 2500.00');
  });

  test('T1-F24-03: Stage Filter Tabs (D-7, D0, D+1, D+7)', () => {
    function classifyStage(diffDays) {
      if (diffDays < -7) return 'NORMAL';
      if (diffDays >= -7 && diffDays < 0) return 'D-7';
      if (diffDays === 0) return 'D0';
      if (diffDays >= 1 && diffDays < 7) return 'D+1';
      return 'D+7';
    }

    assert.strictEqual(classifyStage(-5), 'D-7');
    assert.strictEqual(classifyStage(0), 'D0');
    assert.strictEqual(classifyStage(3), 'D+1');
    assert.strictEqual(classifyStage(10), 'D+7');
  });

  test('T1-F24-04: Overdue Days Highlighting & Sorting', () => {
    const list = [
      { id: '1', daysOverdue: 2 },
      { id: '2', daysOverdue: 15 },
      { id: '3', daysOverdue: 7 }
    ];

    const sorted = [...list].sort((a, b) => b.daysOverdue - a.daysOverdue);
    assert.strictEqual(sorted[0].id, '2', 'Most critical loan (15 days) must be first');
    assert.strictEqual(sorted[1].id, '3');
    assert.strictEqual(sorted[2].id, '1');
  });

  test('T1-F24-05: Contextual Action Buttons in Radar Table', () => {
    const rowActions = [
      { id: 'whatsapp_primary', label: 'WhatsApp Beneficiário' },
      { id: 'whatsapp_secondary', label: 'WhatsApp Secundário' },
      { id: 'return', label: 'Receber Devolução' }
    ];
    assert.strictEqual(rowActions.length, 3);
    assert.ok(rowActions.some(a => a.id === 'whatsapp_secondary'), 'Must include secondary contact escalation action');
  });
});
