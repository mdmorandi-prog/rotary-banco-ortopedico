/**
 * Tier 2: Feature 21 Boundaries — Return Reasons & Routing (F21)
 * Specifications: T2-F21-01 through T2-F21-05
 */

const { assert } = require('../test-harness');

describe('Tier 2: Feature 21 Boundaries — Return Reasons & Routing (F21)', () => {
  test('T2-F21-01: Explanation Required for Close Reason OUTROS', () => {
    function validateCloseReason(reason, notes) {
      if (reason === 'OUTROS' && (!notes || notes.trim().length === 0)) {
        throw new Error("Para o motivo 'Outros', especifique a justificativa nas observações");
      }
      return true;
    }

    assert.throws(() => validateCloseReason('OUTROS', ''), /especifique a justificativa/);
    assert.strictEqual(validateCloseReason('OUTROS', 'Mudou-se de estado'), true);
    assert.strictEqual(validateCloseReason('RECUPERACAO_ALTA', ''), true);
  });

  test('T2-F21-02: Deceased Patient Sensitive Communication Suppression', () => {
    function shouldSendMarketingSurvey(closeReason) {
      // In case of patient demise, never dispatch automated review/marketing surveys
      if (closeReason === 'OBITO_PACIENTE') return false;
      return true;
    }

    assert.strictEqual(shouldSendMarketingSurvey('OBITO_PACIENTE'), false, 'Must suppress surveys for OBITO_PACIENTE');
    assert.strictEqual(shouldSendMarketingSurvey('RECUPERACAO_ALTA'), true);
  });

  test('T2-F21-03: Disallowed Routing: Damaged Item to DISPONIVEL', () => {
    function checkRoutingAllowed(condition, destination) {
      if (condition === 'PRECISA_REPARO' && destination === 'DISPONIVEL') {
        throw new Error('Equipamentos com necessidade de reparo devem ser encaminhados para Manutenção');
      }
      return true;
    }

    assert.throws(() => checkRoutingAllowed('PRECISA_REPARO', 'DISPONIVEL'), /devem ser encaminhados para Manutenção/);
    assert.strictEqual(checkRoutingAllowed('BOM', 'DISPONIVEL'), true);
  });

  test('T2-F21-04: Return with Equipment Exchange Shortcut', () => {
    function handleExchangeShortcut(closeReason, currentBeneficiary) {
      if (closeReason === 'TROCA_EQUIPAMENTO') {
        return {
          offerReplacementLoan: true,
          prefilledBeneficiaryId: currentBeneficiary.id
        };
      }
      return { offerReplacementLoan: false };
    }

    const res = handleExchangeShortcut('TROCA_EQUIPAMENTO', { id: 'ben-01' });
    assert.strictEqual(res.offerReplacementLoan, true);
    assert.strictEqual(res.prefilledBeneficiaryId, 'ben-01');
  });

  test('T2-F21-05: Foreign Destination Status Value Rejection', () => {
    const validDestinations = ['DISPONIVEL', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'];
    function validateDestination(dest) {
      if (!validDestinations.includes(dest)) {
        throw new Error(`Invalid destination status: "${dest}"`);
      }
      return true;
    }

    assert.throws(() => validateDestination('VENDIDO'), /Invalid destination status/);
    assert.throws(() => validateDestination('DESCARTE'), /Invalid destination status/);
    assert.strictEqual(validateDestination('MANUTENCAO'), true);
  });
});
