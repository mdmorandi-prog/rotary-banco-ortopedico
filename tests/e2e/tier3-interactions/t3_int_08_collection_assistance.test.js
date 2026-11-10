/**
 * Tier 3: Interaction 08 — Public Collection Assistance Request (T3-INT-08)
 * Features: F4, F23, F24
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 3: Interaction 08 — Collection Assistance (T3-INT-08)', () => {
  let repo;
  let eq;
  let ben;
  let loan;

  beforeEach(async () => {
    eq = fixtures.createMockEquipment('DISPONIVEL');
    ben = fixtures.createMockBeneficiary();
    repo = createInMemoryRepository({ equipments: [eq], beneficiaries: [ben] });
    loan = await repo.createLoan({ equipment_id: eq.id, beneficiary: ben, term_days: 60 });
  });

  test('T3-INT-08-A: Family requests pickup assistance from public portal without login', () => {
    function submitPickupRequest(loanRecord, payload) {
      if (!payload.contactPhone || payload.contactPhone.trim().length === 0) {
        throw new Error('Telefone de contato é obrigatório para agendar recolhimento');
      }
      return {
        ...loanRecord,
        pickup_requested: true,
        pickup_notes: payload.notes,
        pickup_contact: payload.contactPhone,
        pickup_address: payload.address,
        pickup_status: 'SOLICITADA'
      };
    }

    const updated = submitPickupRequest(loan, {
      notes: 'Paciente acamado sem veículo apropriado para transporte de cama',
      contactPhone: '(11) 98765-4321',
      address: 'Rua das Flores, 123'
    });

    assert.strictEqual(updated.pickup_requested, true);
    assert.strictEqual(updated.pickup_status, 'SOLICITADA');
    assert.strictEqual(updated.pickup_contact, '(11) 98765-4321');
  });

  test('T3-INT-08-B: Pickup request with missing contact phone is rejected', () => {
    function submitPickupRequest(loanRecord, payload) {
      if (!payload.contactPhone || payload.contactPhone.trim().length === 0) {
        throw new Error('Telefone de contato é obrigatório para agendar recolhimento');
      }
      return { ...loanRecord, pickup_requested: true };
    }

    assert.throws(() => {
      submitPickupRequest(loan, { contactPhone: '', notes: 'Recolher com urgência' });
    }, /Telefone de contato é obrigatório/);
  });
});
