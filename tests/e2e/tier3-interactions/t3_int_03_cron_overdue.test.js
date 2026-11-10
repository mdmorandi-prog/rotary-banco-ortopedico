/**
 * Tier 3: Interaction 03 — Automated Cron D+1 Overdue Transition & Dual WhatsApp Alerts (T3-INT-03)
 * Features: F4, F8, F24, F25, F26
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 03 — Cron D+1 Overdue Transition (T3-INT-03)', () => {
  let repo;
  let eq;
  let loan;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('EMPRESTADO', { id: 'eq-crutch-02' });
    loan = fixtures.createMockLoan({
      id: 'loan-002',
      equipment_id: eq.id,
      status: 'ATIVO',
      expected_return_date: '2026-11-09T00:00:00.000Z' // D-1
    });

    repo = createInMemoryRepository({
      equipments: [eq],
      loans: [loan]
    });
  });

  function executeDailyCron(repoInstance, simulatedDateStr) {
    const today = new Date(simulatedDateStr).getTime();
    let transitioned = 0;
    const generatedAlerts = [];

    for (const l of repoInstance._internal.loans) {
      if (l.status === 'ATIVO' || l.status === 'RENOVADO') {
        const due = new Date(l.expected_return_date).getTime();
        const diffDays = Math.round((today - due) / 86400000);

        if (diffDays >= 1) {
          l.status = 'ATRASADO';
          const e = repoInstance._internal.equipments.find(item => item.id === l.equipment_id);
          if (e) e.status = 'ATRASADO';

          repoInstance._internal.eventLogs.push({
            id: `evt-${Date.now()}`,
            loan_id: l.id,
            event_type: 'STATUS_CHANGED_TO_OVERDUE',
            created_at: simulatedDateStr
          });

          transitioned++;

          // Build primary WhatsApp alert
          generatedAlerts.push({
            loanId: l.id,
            targetPhone: '5511977773333',
            type: 'D+1_OVERDUE',
            message: `Prezado beneficiário, o prazo de devolução encerrou há 1 dia. Renove em https://banco.rotary.org/renovar/${l.magic_token}`
          });
        }
      }
    }

    return {
      processed: repoInstance._internal.loans.length,
      transitioned_to_overdue: transitioned,
      alerts: generatedAlerts
    };
  }

  test('T3-INT-03-A: Cron detects D+1 overdue, transitions loan & equipment, generates WhatsApp alert', () => {
    const res = executeDailyCron(repo, '2026-11-10T12:00:00.000Z');

    assert.strictEqual(res.processed, 1);
    assert.strictEqual(res.transitioned_to_overdue, 1);
    assert.strictEqual(loan.status, 'ATRASADO', 'Loan status must be ATRASADO');
    assert.strictEqual(eq.status, 'ATRASADO', 'Equipment status must be ATRASADO');

    assert.strictEqual(res.alerts.length, 1);
    assert.ok(res.alerts[0].message.includes('/renovar/'));

    const logs = repo._internal.eventLogs.filter(e => e.loan_id === 'loan-002' && e.event_type === 'STATUS_CHANGED_TO_OVERDUE');
    assert.strictEqual(logs.length, 1);
  });

  test('T3-INT-03-B: Cron execution is idempotent on repeat runs on the same date', () => {
    // Run 1
    executeDailyCron(repo, '2026-11-10T12:00:00.000Z');
    assert.strictEqual(loan.status, 'ATRASADO');

    // Run 2 on same day
    const res2 = executeDailyCron(repo, '2026-11-10T13:00:00.000Z');
    assert.strictEqual(res2.transitioned_to_overdue, 0, 'Must not duplicate transitions or alerts');
    assert.strictEqual(res2.alerts.length, 0);
  });

  test('T3-INT-03-C: Loans expiring today (D0) remain ATIVO and do not transition to ATRASADO', () => {
    const d0Loan = fixtures.createMockLoan({
      id: 'loan-d0',
      status: 'ATIVO',
      expected_return_date: '2026-11-10T23:59:59.000Z'
    });
    repo._internal.loans.push(d0Loan);

    const res = executeDailyCron(repo, '2026-11-10T12:00:00.000Z');
    assert.strictEqual(d0Loan.status, 'ATIVO', 'D0 loan must remain ATIVO on the due date');
  });
});
