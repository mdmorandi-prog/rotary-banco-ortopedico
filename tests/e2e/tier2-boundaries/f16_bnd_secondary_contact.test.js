/**
 * Tier 2: Feature 16 Boundaries — Mandatory Secondary Contact Validation (F16)
 * Specifications: T2-F16-01 through T2-F16-05
 */

const { assert, fixtures } = require('../test-harness');

describe('Tier 2: Feature 16 Boundaries — Mandatory Secondary Contact Validation (F16)', () => {
  test('T2-F16-01: Secondary Phone All Identical Digits Rejection', () => {
    function validateSecondaryPhone(phone) {
      const clean = phone.replace(/\D/g, '');
      const subscriberNumber = clean.length >= 10 ? clean.substring(2) : clean;
      if (/^(\d)\1+$/.test(subscriberNumber) || /^(\d)\1+$/.test(clean)) {
        throw new Error('Telefone com dígitos idênticos é inválido');
      }
      return true;
    }

    assert.throws(() => validateSecondaryPhone('(11) 99999-9999'), /dígitos idênticos/);
    assert.throws(() => validateSecondaryPhone('(00) 00000-0000'), /dígitos idênticos/);
    assert.strictEqual(validateSecondaryPhone('(11) 98765-4321'), true);
  });

  test('T2-F16-02: Secondary Name Identical to Primary Beneficiary Name', () => {
    const invalid = fixtures.createInvalidBeneficiary('colliding_name');
    assert.throws(() => {
      assert.assertSecondaryContactValidation(invalid);
    }, /Secondary contact cannot be the same person as primary beneficiary/);
  });

  test('T2-F16-03: Secondary Relationship Custom Text Boundary', () => {
    function validateRelationship(rel, customSpecification) {
      if (!rel || rel.trim() === '') throw new Error('Selecione o parentesco');
      if (rel === 'Outros' && (!customSpecification || customSpecification.trim().length === 0)) {
        throw new Error('Especifique o grau de parentesco ou vínculo');
      }
      return true;
    }

    assert.throws(() => validateRelationship('Outros', ''), /Especifique o grau de parentesco/);
    assert.strictEqual(validateRelationship('Outros', 'Vizinho Solidário'), true);
    assert.strictEqual(validateRelationship('Filho', ''), true);
  });

  test('T2-F16-04: Secondary Phone Character Stripping & Normalization', () => {
    function normalizePhone(rawPhone) {
      const clean = rawPhone.replace(/\D/g, '');
      if (clean.length === 11) return clean;
      if (clean.startsWith('55') && clean.length === 13) return clean.substring(2);
      throw new Error('Telefone inválido');
    }

    assert.strictEqual(normalizePhone('+55 (11) 9 8765 - 4321'), '11987654321');
    assert.strictEqual(normalizePhone('(11) 98765-4321'), '11987654321');
  });

  test('T2-F16-05: Single-Character Names or Numbers in Secondary Name', () => {
    function validateNameWords(name) {
      const clean = (name || '').trim();
      if (/\d/.test(clean)) throw new Error('Nome não pode conter números');
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      if (words.length < 2) throw new Error('Informe o nome completo - mínimo 2 palavras');
      return true;
    }

    assert.throws(() => validateNameWords('A 12345'), /não pode conter números/);
    assert.throws(() => validateNameWords('Carlos A'), /mínimo 2 palavras/);
    assert.strictEqual(validateNameWords('Carlos Eduardo'), true);
  });
});
