/**
 * Tier 1: Feature 16 — Mandatory Secondary Contact Validation (F16)
 * Specifications: T1-F16-01 through T1-F16-05
 */

const { assert, fixtures } = require('../test-harness');

describe('Tier 1: Feature 16 — Mandatory Secondary Contact Validation (F16)', () => {
  test('T1-F16-01: Full Name Word Count Validation (Single-word Rejection)', () => {
    const invalid = fixtures.createInvalidBeneficiary('single_word_secondary_name');
    assert.throws(() => {
      assert.assertSecondaryContactValidation(invalid);
    }, /must contain at least 2 words/);
  });

  test('T1-F16-02: Two-Word Valid Full Name Acceptance', () => {
    const valid = fixtures.createMockBeneficiary({
      secondary_name: 'Carlos Eduardo Silva'
    });
    assert.doesNotThrow(() => {
      assert.assertSecondaryContactValidation(valid);
    });
  });

  test('T1-F16-03: Secondary Phone Brazilian Mask & Digit Count', () => {
    const valid = fixtures.createMockBeneficiary({
      secondary_phone: '(11) 98765-4321'
    });
    assert.doesNotThrow(() => {
      assert.assertBrazilianPhone(valid.secondary_phone);
    });

    assert.throws(() => {
      assert.assertBrazilianPhone('12345');
    }, /does not match valid Brazilian phone/);
  });

  test('T1-F16-04: Non-Collision Validation with Primary Phone', () => {
    const colliding = fixtures.createInvalidBeneficiary('colliding_phone');
    assert.throws(() => {
      assert.assertSecondaryContactValidation(colliding);
    }, /Secondary phone cannot be identical to primary phone/);
  });

  test('T1-F16-05: Mandatory Relationship Selection', () => {
    const missingRel = fixtures.createMockBeneficiary({
      secondary_relationship: ''
    });
    assert.throws(() => {
      assert.assertSecondaryContactValidation(missingRel);
    }, /relationship cannot be empty/);
  });
});
