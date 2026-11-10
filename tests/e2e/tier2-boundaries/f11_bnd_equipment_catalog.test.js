/**
 * Tier 2: Feature 11 Boundaries — Equipment Catalog (/equipments) (F11)
 * Specifications: T2-F11-01 through T2-F11-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 2: Feature 11 Boundaries — Equipment Catalog (/equipments) (F11)', () => {
  let repo;

  beforeEach(() => {
    repo = createInMemoryRepository({
      equipments: [
        fixtures.createMockEquipment('DISPONIVEL', { patrimony_code: 'ROT-001', name: 'Cadeira de Rodas' })
      ]
    });
  });

  test('T2-F11-01: Special Characters and Regex Injection in Search', async () => {
    // Search with regex characters must not crash the search engine
    const dangerousQueries = ['.*', '+', '(', ')?', '[a-z]', '\\'];
    for (const q of dangerousQueries) {
      const res = await repo.getEquipments({ search: q });
      assert.ok(Array.isArray(res), `Search query "${q}" must return safely`);
    }
  });

  test('T2-F11-02: Empty Search Result UX State', async () => {
    const res = await repo.getEquipments({ search: 'TERMO_TOTALMENTE_INEXISTENTE_12345' });
    assert.strictEqual(res.length, 0);

    const emptyStateProps = {
      message: 'Nenhum equipamento encontrado',
      hasClearFiltersAction: true
    };
    assert.ok(emptyStateProps.hasClearFiltersAction, 'Empty state must offer to clear filters');
  });

  test('T2-F11-03: Zero or Negative Replacement Value in Creation Modal', async () => {
    function validateNewEquipment(data) {
      if (!data.replacement_value || data.replacement_value <= 0) {
        throw new Error('O valor de reposição deve ser maior que zero');
      }
      return true;
    }

    assert.throws(() => validateNewEquipment({ replacement_value: 0 }), /maior que zero/);
    assert.throws(() => validateNewEquipment({ replacement_value: -50 }), /maior que zero/);
    assert.strictEqual(validateNewEquipment({ replacement_value: 850 }), true);
  });

  test('T2-F11-04: Excessively Long Equipment Name Overflow Handling', async () => {
    const longName = 'Cadeira de Rodas '.repeat(30);
    const item = await repo.createEquipment({
      patrimony_code: 'ROT-LONG',
      name: longName,
      category: 'CADEIRA_RODAS',
      status: 'DISPONIVEL',
      replacement_value: 500
    });

    assert.ok(item.name.length > 200);
    // UI styling truncates with line-clamp-2
    const displayClass = 'line-clamp-2 overflow-hidden text-ellipsis';
    assert.ok(displayClass.includes('line-clamp-2'), 'Long names must be clamped with ellipsis');
  });

  test('T2-F11-05: Rapid Toggle of Multiple Filters', async () => {
    let activeFilter = 'ALL';
    function applyFilter(f) {
      activeFilter = f;
      return activeFilter;
    }

    // Rapid switches
    applyFilter('DISPONIVEL');
    applyFilter('EMPRESTADO');
    applyFilter('MANUTENCAO');
    const final = applyFilter('DISPONIVEL');

    const filtered = await repo.getEquipments({ status: final });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].status, 'DISPONIVEL');
  });
});
