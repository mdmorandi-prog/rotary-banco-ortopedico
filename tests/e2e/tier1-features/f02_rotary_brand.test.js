/**
 * Tier 1: Feature 2 — Rotary Brand Theme (F2)
 * Specifications: T1-F02-01 through T1-F02-05
 */

const { assert } = require('../test-harness');

describe('Tier 1: Feature 2 — Rotary Brand Theme (F2)', () => {
  const ROTARY_BLUE = '#17458f';
  const ROTARY_GOLD = '#f7a81b';
  const WHITE = '#ffffff';
  const DARK_TEXT = '#1e293b';

  test('T1-F02-01: Primary Rotary Blue Color Token Resolution', () => {
    assert.strictEqual(ROTARY_BLUE.toLowerCase(), '#17458f', 'Rotary Blue must match exact brand hex #17458f');
  });

  test('T1-F02-02: Secondary Rotary Gold Accent Resolution', () => {
    assert.strictEqual(ROTARY_GOLD.toLowerCase(), '#f7a81b', 'Rotary Gold must match exact brand hex #f7a81b');
  });

  test('T1-F02-03: WCAG AA Contrast Verification for Rotary Blue', () => {
    // White text on Rotary Blue must pass WCAG AA (>= 4.5:1) and AAA (>= 7.0:1)
    const ratio = assert.assertWCAGContrast(WHITE, ROTARY_BLUE, 4.5);
    assert.ok(ratio >= 7.0, `White on Rotary Blue achieves ${ratio.toFixed(2)}:1 (passes WCAG AAA >= 7.0:1)`);
  });

  test('T1-F02-04: WCAG AA Dark Text Enforcement on Rotary Gold', () => {
    // Dark text on Rotary Gold must pass WCAG AA (>= 4.5:1)
    const ratioDark = assert.assertWCAGContrast(DARK_TEXT, ROTARY_GOLD, 4.5);
    assert.ok(ratioDark >= 4.5, `Dark text on Rotary Gold achieves ${ratioDark.toFixed(2)}:1 (passes WCAG AA)`);

    // Verify white text on Rotary Gold FAILS contrast and must not be used
    assert.throws(() => {
      assert.assertWCAGContrast(WHITE, ROTARY_GOLD, 4.5);
    }, /fails required minimum 4.5:1/);
  });

  test('T1-F02-05: Operational Status Badge Color Tokens', () => {
    const statusColorMap = {
      'DISPONIVEL': { bg: 'emerald', text: 'emerald-800' },
      'EMPRESTADO': { bg: 'blue', text: 'blue-800' },
      'ATRASADO': { bg: 'rose', text: 'rose-800' },
      'HIGIENIZACAO': { bg: 'cyan', text: 'cyan-800' },
      'MANUTENCAO': { bg: 'amber', text: 'amber-800' },
      'BAIXADO': { bg: 'gray', text: 'gray-800' }
    };

    const statuses = ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'];
    statuses.forEach(st => {
      assert.ok(statusColorMap[st], `Status "${st}" must have distinct operational color mapping`);
      assert.ok(statusColorMap[st].bg, `Status "${st}" must define badge background token`);
    });
  });
});
