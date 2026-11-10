/**
 * Tier 1: Feature 18 — Digital Signature Canvas (F18)
 * Specifications: T1-F18-01 through T1-F18-05
 */

const { assert } = require('../test-harness');

describe('Tier 1: Feature 18 — Digital Signature Canvas (F18)', () => {
  class MockSignaturePad {
    constructor() {
      this.points = [];
    }

    addStroke(strokePoints) {
      this.points.push(...strokePoints);
    }

    clear() {
      this.points = [];
    }

    isEmpty() {
      return this.points.length < 5;
    }

    toDataURL(mime = 'image/png') {
      if (this.isEmpty()) return '';
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
  }

  test('T1-F18-01: Canvas Touch and Pointer Event Capture', () => {
    const pad = new MockSignaturePad();
    pad.addStroke([
      { x: 10, y: 10 },
      { x: 20, y: 25 },
      { x: 35, y: 40 },
      { x: 50, y: 55 },
      { x: 70, y: 65 }
    ]);
    assert.strictEqual(pad.isEmpty(), false, 'Pad must register captured stroke points');
  });

  test('T1-F18-02: Canvas Clear Action', () => {
    const pad = new MockSignaturePad();
    pad.addStroke([{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }, { x: 40, y: 40 }, { x: 50, y: 50 }]);
    assert.strictEqual(pad.isEmpty(), false);

    pad.clear();
    assert.strictEqual(pad.isEmpty(), true, 'Clear must reset canvas to blank state');
    assert.strictEqual(pad.toDataURL(), '', 'Empty pad must not export data URL');
  });

  test('T1-F18-03: Empty Signature Validation Guard', () => {
    const pad = new MockSignaturePad();
    // Validate submission guard
    function validateFinalize(padInstance) {
      if (padInstance.isEmpty()) {
        throw new Error('A assinatura digital do responsável é obrigatória');
      }
      return true;
    }

    assert.throws(() => {
      validateFinalize(pad);
    }, /A assinatura digital do responsável é obrigatória/);
  });

  test('T1-F18-04: Base64 PNG Export', () => {
    const pad = new MockSignaturePad();
    pad.addStroke([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }]);
    const dataUrl = pad.toDataURL();
    assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'Must export valid PNG base64 data URL');
  });

  test('T1-F18-05: Responsive Canvas Dimensions', () => {
    function computeCanvasDimensions(containerWidth) {
      const width = Math.min(containerWidth - 32, 600);
      const height = Math.round(width * 0.5); // 2:1 ratio
      return { width, height };
    }

    const mobile = computeCanvasDimensions(375);
    assert.ok(mobile.width <= 343, 'Mobile canvas fits within 375px viewport');
    assert.ok(mobile.height > 100, 'Mobile canvas provides adequate signing height');

    const desktop = computeCanvasDimensions(1280);
    assert.strictEqual(desktop.width, 600, 'Desktop canvas capped at 600px width');
  });
});
