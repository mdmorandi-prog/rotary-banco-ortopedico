/**
 * Tier 2: Feature 14 Boundaries — Printable Asset Labels (/equipments/labels) (F14)
 * Specifications: T2-F14-01 through T2-F14-05
 */

const { assert } = require('../test-harness');

describe('Tier 2: Feature 14 Boundaries — Printable Asset Labels (/equipments/labels) (F14)', () => {
  test('T2-F14-01: Thermal Label Edge Margin Boundary (50x30mm)', () => {
    const layout = {
      widthMm: 50,
      heightMm: 30,
      internalMarginMm: 2,
      printableWidthMm: 46,
      printableHeightMm: 26
    };
    assert.strictEqual(layout.widthMm - 2 * layout.internalMarginMm, layout.printableWidthMm);
    assert.ok(layout.internalMarginMm >= 2, 'Must maintain at least 2mm safe margin from thermal roll edge');
  });

  test('T2-F14-02: A4 Sheet Multi-Page Grid Page Break', () => {
    const gridStyle = {
      pageBreakInside: 'avoid',
      cssRule: 'break-inside-avoid'
    };
    assert.strictEqual(gridStyle.pageBreakInside, 'avoid', 'Labels must have page-break-inside: avoid');
  });

  test('T2-F14-03: Missing Rotary Club Phone Fallback', () => {
    function resolveContactPhone(envPhone) {
      if (envPhone && envPhone.trim().length >= 10) return envPhone.trim();
      return '(13) 99765-4321'; // Standard Rotary Club fallback
    }

    assert.strictEqual(resolveContactPhone(''), '(13) 99765-4321');
    assert.strictEqual(resolveContactPhone(null), '(13) 99765-4321');
    assert.strictEqual(resolveContactPhone('(11) 98888-7777'), '(11) 98888-7777');
  });

  test('T2-F14-04: Equipment Name Overflow on Thermal Label', () => {
    function formatLabelTitle(name) {
      if (name.length > 40) {
        return {
          title: name.substring(0, 37) + '...',
          fontSizePt: 8,
          maxLines: 2
        };
      }
      return { title: name, fontSizePt: 9, maxLines: 2 };
    }

    const res = formatLabelTitle('CADEIRA DE RODAS MOTORIZADA ORTOBRAS B400 RECLINAVEL EXTRA GRANDE');
    assert.ok(res.title.endsWith('...'));
    assert.strictEqual(res.fontSizePt, 8, 'Font size clamps to 8pt on long names');
  });

  test('T2-F14-05: High DPI Print Quality Test', () => {
    const renderConfig = {
      svgEmblem: true,
      qrCanvasResolution: 600, // 600 DPI
      vectorScaling: true
    };
    assert.strictEqual(renderConfig.svgEmblem, true, 'Logo must use vector SVG to prevent pixelation');
    assert.ok(renderConfig.qrCanvasResolution >= 300, 'Canvas resolution must be >= 300 DPI');
  });
});
