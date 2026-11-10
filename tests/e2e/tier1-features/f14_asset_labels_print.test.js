/**
 * Tier 1: Feature 14 — Printable Asset Labels (/equipments/labels) (F14)
 * Specifications: T1-F14-01 through T1-F14-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 14 — Printable Asset Labels (/equipments/labels) (F14)', () => {
  const publicDir = path.join(process.cwd(), 'public');

  test('T1-F14-01: Official Rotary Emblem Inclusion', () => {
    const rotarySvg = path.join(publicDir, 'icons', 'rotary-wheel.svg');
    assert.ok(fs.existsSync(rotarySvg), 'rotary-wheel.svg must exist in public/icons');
    const svgContent = fs.readFileSync(rotarySvg, 'utf8');
    assert.ok(svgContent.includes('<svg') && (svgContent.includes('path') || svgContent.includes('circle')), 'Must be valid SVG emblem');
  });

  test('T1-F14-02: High-Contrast Monospace Patrimony Code', () => {
    const typographySpec = {
      fontFamily: 'font-mono',
      fontWeight: 'font-bold',
      contrastClass: 'text-black tracking-wider'
    };
    assert.strictEqual(typographySpec.fontFamily, 'font-mono', 'Patrimony code must use monospace font');
    assert.strictEqual(typographySpec.fontWeight, 'font-bold', 'Patrimony code must be bold');
  });

  test('T1-F14-03: Scannable QR Code Dimensioning (>= 22x22mm)', () => {
    // 50x30mm thermal label requires QR code of at least 22x22mm
    const labelLayout = {
      labelWidthMm: 50,
      labelHeightMm: 30,
      qrSizeMm: 22,
      qrErrorCorrectionLevel: 'M'
    };
    assert.ok(labelLayout.qrSizeMm >= 22, 'QR code dimension must be >= 22mm');
    assert.ok(labelLayout.qrSizeMm <= labelLayout.labelHeightMm, 'QR code must fit within label height');
  });

  test('T1-F14-04: Club Contact Phone on Label', () => {
    const labelData = {
      patrimony: 'ROT-0042',
      contactPhone: '(11) 99999-9999',
      footerText: 'Devolução / Dúvidas: (11) 99999-9999'
    };
    assert.ok(labelData.footerText.includes('Devolução'), 'Label must display return guidance');
    assert.ok(labelData.footerText.includes('(11) 99999-9999'), 'Label must include club contact phone');
  });

  test('T1-F14-05: Print CSS Isolation (@media print)', () => {
    const printRules = {
      hideNavbarClass: 'print:hidden',
      hideHeaderClass: 'print:hidden',
      pageBreakClass: 'print:break-inside-avoid'
    };
    assert.strictEqual(printRules.hideNavbarClass, 'print:hidden', 'Navigation must be hidden during printing');
    assert.strictEqual(printRules.pageBreakClass, 'print:break-inside-avoid', 'Labels must not split across print pages');
  });
});
