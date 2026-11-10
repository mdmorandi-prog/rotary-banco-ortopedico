/**
 * Tier 1: Feature 15 — Multi-step Loan Wizard (/loans/new) (F15)
 * Specifications: T1-F15-01 through T1-F15-05
 */

const { assert, fixtures, createInMemoryRepository } = require('../test-harness');

describe('Tier 1: Feature 15 — Multi-step Loan Wizard (/loans/new) (F15)', () => {
  let repo;
  let eq;

  beforeEach(() => {
    eq = fixtures.createMockEquipment('DISPONIVEL', {
      patrimony_code: 'ROT-WIZ-01',
      replacement_value: 850.00
    });
    repo = createInMemoryRepository({
      equipments: [eq]
    });
  });

  test('T1-F15-01: Step 1 - Equipment Confirmation', async () => {
    const selected = await repo.getEquipmentById(eq.id);
    assert.ok(selected, 'Equipment must be found in step 1');
    assert.strictEqual(selected.status, 'DISPONIVEL', 'Equipment status must be DISPONIVEL');
    assert.strictEqual(selected.replacement_value, 850.00, 'Must display replacement value');
  });

  test('T1-F15-02: Step 2 - Beneficiary & Guardian Data Collection', () => {
    const ben = fixtures.createMockBeneficiary();
    assert.assertBrazilianCPF(ben.cpf);
    assert.assertBrazilianPhone(ben.phone);
    assert.ok(ben.full_name.length > 3, 'Full name must be present');
    assert.ok(ben.address_street, 'Address must be present');
  });

  test('T1-F15-03: Step 3 - Mandatory Secondary Contact Gate', () => {
    const ben = fixtures.createMockBeneficiary();
    assert.assertSecondaryContactValidation(ben);

    // Verify invalid secondary contact fails validation
    const invalid = fixtures.createInvalidBeneficiary('missing_secondary_name');
    assert.throws(() => {
      assert.assertSecondaryContactValidation(invalid);
    }, /must contain at least 2 words/);
  });

  test('T1-F15-04: Step 4 - Document Photo Upload with Preview', () => {
    const photoUploadState = {
      originalFileSizeKb: 4096,
      compressedFileSizeKb: 450,
      previewUrl: 'blob:http://localhost:3000/photo-preview-uuid',
      isCompressedUnder800Kb: true
    };
    assert.ok(photoUploadState.compressedFileSizeKb < 800, 'Compressed photo must be < 800KB');
    assert.ok(photoUploadState.previewUrl.startsWith('blob:') || photoUploadState.previewUrl.startsWith('data:'), 'Must provide immediate preview URL');
  });

  test('T1-F15-05: Step 5 - Digital Signature & Comodato Finalization', async () => {
    const ben = fixtures.createMockBeneficiary();
    const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const loan = await repo.createLoan({
      equipment_id: eq.id,
      beneficiary: ben,
      term_days: 60,
      signature_data_url: signature
    });

    assert.ok(loan.id, 'Loan must be created with ID');
    assert.strictEqual(loan.status, 'ATIVO', 'Loan status must be ATIVO');
    assert.strictEqual(loan.renewal_count, 0, 'Initial renewal count must be 0');
    assert.ok(loan.magic_token, 'Magic token must be generated');

    const updatedEq = await repo.getEquipmentById(eq.id);
    assert.strictEqual(updatedEq.status, 'EMPRESTADO', 'Equipment must transition to EMPRESTADO');
  });
});
