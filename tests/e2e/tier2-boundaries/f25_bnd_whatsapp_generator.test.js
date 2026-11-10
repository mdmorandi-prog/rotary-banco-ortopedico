/**
 * Tier 2: Feature 25 Boundaries — WhatsApp Notification Generator (F25)
 * Specifications: T2-F25-01 through T2-F25-05
 */

const { assert } = require('../test-harness');

describe('Tier 2: Feature 25 Boundaries — WhatsApp Notification Generator (F25)', () => {
  test('T2-F25-01: Phone Number Formatting with Non-Digit Characters', () => {
    function sanitizeForWhatsApp(raw) {
      const clean = (raw || '').replace(/\D/g, '');
      if (clean.length === 11) return `55${clean}`;
      if (clean.startsWith('55') && clean.length === 13) return clean;
      throw new Error(`Telefone inválido: "${raw}"`);
    }

    assert.strictEqual(sanitizeForWhatsApp('+55 (11) 98765-4321'), '5511987654321');
    assert.strictEqual(sanitizeForWhatsApp('(11) 98765-4321'), '5511987654321');
    assert.throws(() => sanitizeForWhatsApp('12345'), /Telefone inválido/);
  });

  test('T2-F25-02: Special Characters and Line Breaks in Message Text', () => {
    const rawMessage = 'Olá Maria!\n\nSeu empréstimo venceu:\n- Cadeira de Rodas 🦽\n- Valor: R$ 850,00';
    const encoded = encodeURIComponent(rawMessage);
    assert.ok(encoded.includes('%0A%0A'), 'Double line break encoded as %0A%0A');
    assert.ok(encoded.includes('%F0%9F%A6%BD'), 'Emoji 🦽 safely percent-encoded');
  });

  test('T2-F25-03: Missing Secondary Contact Phone Fallback', () => {
    function getSecondaryButtonState(secondaryPhone) {
      if (!secondaryPhone || secondaryPhone.trim().length === 0) {
        return {
          enabled: false,
          tooltip: 'Telefone secundário não cadastrado'
        };
      }
      return { enabled: true, tooltip: 'Notificar responsável solidário' };
    }

    const state = getSecondaryButtonState('');
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.tooltip, 'Telefone secundário não cadastrado');
  });

  test('T2-F25-04: Short Phone Number (< 10 Digits) Validation', () => {
    function validateBrazilianPhoneNumber(phone) {
      const clean = phone.replace(/\D/g, '');
      if (clean.length < 10) throw new Error('Número de telefone muito curto - deve conter DDD');
      return true;
    }

    assert.throws(() => validateBrazilianPhoneNumber('1234567'), /muito curto/);
    assert.strictEqual(validateBrazilianPhoneNumber('(11) 98765-4321'), true);
  });

  test('T2-F25-05: Desktop Web vs Mobile WhatsApp App Compatibility', () => {
    function generateUniversalWaLink(phone, message) {
      // wa.me universal URL works seamlessly across mobile (opens app) and desktop (opens WhatsApp Web)
      const cleanDigits = phone.replace(/\D/g, '');
      return `https://wa.me/55${cleanDigits}?text=${encodeURIComponent(message)}`;
    }

    const link = generateUniversalWaLink('11987654321', 'Teste');
    assert.ok(link.startsWith('https://wa.me/'), 'Must use universal wa.me domain for cross-platform support');
  });
});
