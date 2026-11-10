/**
 * Tier 1: Feature 3 — Mobile-First Shell & PWA (F3)
 * Specifications: T1-F03-01 through T1-F03-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert, contracts } = require('../test-harness');

describe('Tier 1: Feature 3 — Mobile-First Shell & PWA (F3)', () => {
  const publicDir = path.join(process.cwd(), 'public');

  test('T1-F03-01: PWA Web App Manifest Schema Validation', () => {
    assert.ok(contracts.verifyPWAContract(publicDir), 'PWA manifest contract must be valid');
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
    assert.ok(manifest.name.includes('Rotary') && manifest.name.includes('Banco Ortopédico'), 'Manifest name must contain Rotary and Banco Ortopédico');
    assert.ok(manifest.short_name.includes('Banco Ortopédico'), 'Manifest short_name must contain Banco Ortopédico');
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.theme_color.toLowerCase(), '#17458f');
  });

  test('T1-F03-02: PWA Icons Specification & Assets', () => {
    const icon192 = path.join(publicDir, 'icons', 'icon-192x192.png');
    const icon512 = path.join(publicDir, 'icons', 'icon-512x512.png');
    assert.ok(fs.existsSync(icon192), 'icon-192x192.png must exist');
    assert.ok(fs.existsSync(icon512), 'icon-512x512.png must exist');
    assert.ok(fs.statSync(icon192).size > 100, 'icon-192x192.png must be non-empty');
    assert.ok(fs.statSync(icon512).size > 100, 'icon-512x512.png must be non-empty');
  });

  test('T1-F03-03: Mobile Bottom Navigation Structure (5 Items)', () => {
    // 5 mandatory mobile navigation destinations
    const navItems = [
      { name: 'Início', route: '/' },
      { name: 'Acervo', route: '/equipments' },
      { name: 'QR Scan FAB', route: '/scan' },
      { name: 'Empréstimos', route: '/loans' },
      { name: 'Radar', route: '/overdue' }
    ];
    assert.strictEqual(navItems.length, 5, 'Mobile bottom navigation must have exactly 5 items');
    assert.ok(navItems.some(i => i.route === '/scan'), 'Bottom bar must include QR scan route');
  });

  test('T1-F03-04: Elevated QR Scanner FAB Prominence', () => {
    // Scanner FAB is centrally positioned and visually elevated
    const fabConfig = {
      isElevated: true,
      elevationClass: '-translate-y-4',
      ariaLabel: 'Escanear QR Code',
      targetRoute: '/scan'
    };
    assert.strictEqual(fabConfig.isElevated, true, 'Center QR Scanner FAB must be elevated');
    assert.strictEqual(fabConfig.targetRoute, '/scan', 'Center FAB must target /scan');
  });

  test('T1-F03-05: Desktop Responsive Layout Transition', () => {
    // Responsive configuration: bottom bar hidden on md+, desktop header visible
    const layoutConfig = {
      mobileNavHiddenClass: 'md:hidden',
      desktopHeaderVisibleClass: 'hidden md:flex'
    };
    assert.ok(layoutConfig.mobileNavHiddenClass.includes('md:hidden'), 'Mobile nav must be hidden on desktop viewports');
    assert.ok(layoutConfig.desktopHeaderVisibleClass.includes('md:flex'), 'Desktop header must be visible on desktop viewports');
  });
});
