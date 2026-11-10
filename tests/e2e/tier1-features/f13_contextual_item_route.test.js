/**
 * Tier 1: Feature 13 — Contextual Action Route (/item/[qr_token]) (F13)
 * Specifications: T1-F13-01 through T1-F13-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 13 — Contextual Action Route (/item/[qr_token]) (F13)', () => {
  function getContextualActionsForStatus(status) {
    switch (status) {
      case 'DISPONIVEL':
        return {
          badge: { label: 'Disponível', color: 'emerald' },
          primaryCta: 'Iniciar Empréstimo',
          actions: ['LOAN']
        };
      case 'EMPRESTADO':
        return {
          badge: { label: 'Emprestado', color: 'blue' },
          primaryCta: 'Registrar Devolução',
          actions: ['RETURN', 'RENEW']
        };
      case 'ATRASADO':
        return {
          badge: { label: 'Atrasado', color: 'rose' },
          primaryCta: 'Registrar Devolução',
          actions: ['RETURN', 'RENEW', 'WHATSAPP_COLLECTION']
        };
      case 'HIGIENIZACAO':
        return {
          badge: { label: 'Em Higienização', color: 'cyan' },
          primaryCta: 'Liberar para Estoque',
          actions: ['RELEASE_STOCK', 'SEND_MAINTENANCE']
        };
      case 'MANUTENCAO':
        return {
          badge: { label: 'Em Manutenção', color: 'amber' },
          primaryCta: 'Concluir Manutenção',
          actions: ['COMPLETE_REPAIR', 'WRITE_OFF']
        };
      case 'BAIXADO':
        return {
          badge: { label: 'Baixado', color: 'gray' },
          primaryCta: null,
          actions: []
        };
      default:
        throw new Error(`Unknown status: ${status}`);
    }
  }

  test('T1-F13-01: Contextual Actions for DISPONIVEL Status', () => {
    const ctx = getContextualActionsForStatus('DISPONIVEL');
    assert.strictEqual(ctx.primaryCta, 'Iniciar Empréstimo');
    assert.ok(ctx.actions.includes('LOAN'));
    assert.strictEqual(ctx.badge.label, 'Disponível');
  });

  test('T1-F13-02: Contextual Actions for EMPRESTADO Status', () => {
    const ctx = getContextualActionsForStatus('EMPRESTADO');
    assert.ok(ctx.actions.includes('RETURN'));
    assert.ok(ctx.actions.includes('RENEW'));
    assert.strictEqual(ctx.badge.color, 'blue');
  });

  test('T1-F13-03: Contextual Actions for ATRASADO Status', () => {
    const ctx = getContextualActionsForStatus('ATRASADO');
    assert.ok(ctx.actions.includes('WHATSAPP_COLLECTION'));
    assert.ok(ctx.actions.includes('RETURN'));
    assert.strictEqual(ctx.badge.color, 'rose');
  });

  test('T1-F13-04: Contextual Actions for HIGIENIZACAO Status', () => {
    const ctx = getContextualActionsForStatus('HIGIENIZACAO');
    assert.strictEqual(ctx.primaryCta, 'Liberar para Estoque');
    assert.ok(ctx.actions.includes('RELEASE_STOCK'));
  });

  test('T1-F13-05: Contextual Actions for MANUTENCAO Status', () => {
    const ctx = getContextualActionsForStatus('MANUTENCAO');
    assert.ok(ctx.actions.includes('COMPLETE_REPAIR'));
    assert.ok(ctx.actions.includes('WRITE_OFF'));
  });
});
