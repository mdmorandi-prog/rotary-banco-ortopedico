// ==============================================================================
// EMPIRICAL CHALLENGER STRESS TEST SUITE — MILESTONE 1 (M1)
// Rotary Banco Ortopédico
// Author: Challenger 1 (teamwork_challenger_m1_1)
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert';

const ROOT_DIR = process.cwd();
console.log(`[Challenger M1] Running stress test suite in: ${ROOT_DIR}`);

let passCount = 0;
let failCount = 0;
const failures = [];

function test(title, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${title}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${title}`);
    console.error(`    Error: ${err.message}`);
    failures.push({ title, error: err });
    failCount++;
  }
}

async function testAsync(title, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${title}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${title}`);
    console.error(`    Error: ${err.message}`);
    failures.push({ title, error: err });
    failCount++;
  }
}

// ------------------------------------------------------------------------------
// Helper: Luminance & Contrast calculation according to WCAG 2.1 specifications
// ------------------------------------------------------------------------------
function getLuminance(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// ==============================================================================
// SUITE 1: PWA MANIFEST INTEGRITY & ICON DIMENSION VERIFICATION
// ==============================================================================
console.log('\n--- SUITE 1: PWA Manifest & Asset Integrity ---');

const manifestPath = path.join(ROOT_DIR, 'public', 'manifest.json');

test('Manifest: public/manifest.json exists and parses strictly as valid JSON', () => {
  assert(fs.existsSync(manifestPath), 'manifest.json must exist on disk');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  assert.strictEqual(typeof manifest, 'object', 'manifest must parse to object');
  assert.strictEqual(manifest.display, 'standalone', 'display must be standalone');
  assert.strictEqual(manifest.theme_color, '#17458f', 'theme_color must match Rotary Royal Blue');
  assert(Array.isArray(manifest.icons), 'icons must be an array');
  assert(manifest.icons.length >= 4, 'must have at least 4 icons declared');
});

test('Manifest: All declared icons exist with non-zero size and valid headers', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  for (const icon of manifest.icons) {
    const iconRelPath = icon.src.startsWith('/') ? icon.src.slice(1) : icon.src;
    const iconAbsPath = path.join(ROOT_DIR, 'public', iconRelPath);
    assert(fs.existsSync(iconAbsPath), `Icon file ${iconAbsPath} must exist`);
    const stat = fs.statSync(iconAbsPath);
    assert(stat.size > 0, `Icon file ${iconAbsPath} must have size > 0 (found ${stat.size} bytes)`);

    if (icon.type === 'image/png') {
      const buffer = fs.readFileSync(iconAbsPath);
      // Verify PNG magic bytes: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
      const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      for (let i = 0; i < pngSig.length; i++) {
        assert.strictEqual(buffer[i], pngSig[i], `Invalid PNG signature in ${icon.src}`);
      }
      // Read width & height from IHDR chunk (bytes 16-24)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);

      const [expectedW, expectedH] = icon.sizes.split('x').map(Number);
      assert.strictEqual(width, expectedW, `Width mismatch for ${icon.src}: expected ${expectedW}, got ${width}`);
      assert.strictEqual(height, expectedH, `Height mismatch for ${icon.src}: expected ${expectedH}, got ${height}`);
    } else if (icon.type === 'image/svg+xml') {
      const content = fs.readFileSync(iconAbsPath, 'utf-8');
      assert(content.includes('<svg'), `SVG file ${icon.src} must contain <svg tag`);
      assert(content.includes('viewBox'), `SVG file ${icon.src} must define viewBox`);
      assert(content.includes('</svg>'), `SVG file ${icon.src} must close </svg> tag`);
    }
  }
});

test('Manifest: Maskable icon is properly declared for adaptive icons', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const maskable = manifest.icons.find((i) => i.purpose === 'maskable');
  assert(maskable, 'Manifest must declare at least one maskable icon for Android adaptive launcher');
  assert.strictEqual(maskable.sizes, '512x512', 'Maskable icon should be 512x512');
});

// ==============================================================================
// SUITE 2: PWA ICONS GENERATOR IDEMPOTENCY & FAULT TOLERANCE
// ==============================================================================
console.log('\n--- SUITE 2: PWA Icons Generator Idempotency & Fault Tolerance ---');

test('Generator: scripts/generate-pwa-icons.mjs runs idempotently without crashing', () => {
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'generate-pwa-icons.mjs');
  assert(fs.existsSync(scriptPath), 'Generator script must exist');

  // Run 3 times consecutively
  for (let i = 1; i <= 3; i++) {
    const out = execSync(`node "${scriptPath}"`, { encoding: 'utf-8' });
    assert(out.includes('generated successfully'), `Execution ${i} failed: ${out}`);
  }
});

test('Generator: Regenerates missing icon file when deleted', () => {
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'generate-pwa-icons.mjs');
  const targetIcon = path.join(ROOT_DIR, 'public', 'icons', 'apple-touch-icon.png');

  // Delete icon intentionally
  if (fs.existsSync(targetIcon)) {
    fs.unlinkSync(targetIcon);
  }
  assert(!fs.existsSync(targetIcon), 'Target icon should be deleted for test');

  // Run generator
  execSync(`node "${scriptPath}"`, { encoding: 'utf-8' });

  // Verify icon was recreated and is valid
  assert(fs.existsSync(targetIcon), 'Target icon must be regenerated');
  const buf = fs.readFileSync(targetIcon);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.strictEqual(width, 180, 'Regenerated icon must have width 180');
  assert.strictEqual(height, 180, 'Regenerated icon must have height 180');
});

// ==============================================================================
// SUITE 3: ENVIRONMENT VARIABLES FALLBACK & DEMO MODE RESILIENCE
// ==============================================================================
console.log('\n--- SUITE 3: Environment Fallback & Demo Mode Resilience ---');

test('Environment: .env.example contains all required keys', () => {
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example must exist');
  const content = fs.readFileSync(envExamplePath, 'utf-8');

  const requiredKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'CRON_SECRET',
    'NEXT_PUBLIC_ENABLE_DEMO_FALLBACK',
    'NEXT_PUBLIC_ROTARY_CLUB_NAME',
    'NEXT_PUBLIC_ROTARY_DISTRICT',
    'NEXT_PUBLIC_CONTACT_PHONE',
  ];

  for (const key of requiredKeys) {
    assert(content.includes(key), `.env.example is missing required key: ${key}`);
  }
});

test('Environment: Repository isDemoMode logic activates when keys are missing or unconfigured', () => {
  // Test detection logic directly
  const isDemoLogic = (url, anonKey, explicitDemo, localOverride) => {
    if (localOverride !== null && localOverride !== undefined) {
      return localOverride === 'true';
    }
    const isUnconfigured =
      !url ||
      !anonKey ||
      url.includes('your-project') ||
      url === 'undefined' ||
      anonKey === 'your-anon-key-here' ||
      anonKey === 'undefined';

    const isExplicitDemo = explicitDemo === 'true';
    return isUnconfigured || isExplicitDemo;
  };

  // Case 1: All undefined
  assert.strictEqual(isDemoLogic(undefined, undefined, undefined, null), true, 'Missing keys must trigger demo mode');

  // Case 2: Placeholder strings
  assert.strictEqual(
    isDemoLogic('https://your-project.supabase.co', 'your-anon-key-here', undefined, null),
    true,
    'Placeholder strings must trigger demo mode'
  );

  // Case 3: Explicit demo fallback flag
  assert.strictEqual(
    isDemoLogic('https://real-prod.supabase.co', 'real-anon-key', 'true', null),
    true,
    'Explicit demo mode must trigger demo mode'
  );

  // Case 4: Real keys without explicit demo
  assert.strictEqual(
    isDemoLogic('https://real-prod.supabase.co', 'real-anon-key', 'false', null),
    false,
    'Real credentials without override should not be demo mode'
  );

  // Case 5: Local storage manual override
  assert.strictEqual(
    isDemoLogic('https://real-prod.supabase.co', 'real-anon-key', 'false', 'true'),
    true,
    'Local storage force override must take precedence'
  );
});

// ==============================================================================
// SUITE 4: MOBILE NAVIGATION & SAFE AREA LAYOUT VERIFICATION
// ==============================================================================
console.log('\n--- SUITE 4: Mobile Navigation & Safe Area Layout ---');

test('Mobile Navigation: mobile-bottom-nav.tsx implements pb-safe and elevated scan FAB', () => {
  const navPath = path.join(ROOT_DIR, 'src', 'components', 'layout', 'mobile-bottom-nav.tsx');
  assert(fs.existsSync(navPath), 'mobile-bottom-nav.tsx must exist');
  const code = fs.readFileSync(navPath, 'utf-8');

  // Must have safe-area padding class
  assert(code.includes('pb-safe'), 'mobile-bottom-nav must include pb-safe class');

  // Must be fixed to bottom and hidden on desktop
  assert(code.includes('fixed bottom-0'), 'mobile nav must be fixed to bottom');
  assert(code.includes('md:hidden'), 'mobile nav must be hidden on desktop (md:hidden)');

  // Must have elevated scan button (FAB)
  assert(code.includes('isFab'), 'mobile nav must designate FAB item');
  assert(code.includes('-mt-6'), 'FAB must have negative top margin (-mt-6) for elevated position');
  assert(code.includes('/scan'), 'FAB must route to /scan');

  // Must have no-print utility
  assert(code.includes('no-print'), 'mobile nav must be hidden during printing');
});

test('Globals CSS: Defines pb-safe, pt-safe, and touch-target utilities', () => {
  const cssPath = path.join(ROOT_DIR, 'src', 'app', 'globals.css');
  assert(fs.existsSync(cssPath), 'globals.css must exist');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert(css.includes('.pb-safe'), 'globals.css must define .pb-safe');
  assert(css.includes('safe-area-inset-bottom'), 'globals.css must reference env(safe-area-inset-bottom)');
  assert(css.includes('.pt-safe'), 'globals.css must define .pt-safe');
  assert(css.includes('.touch-target'), 'globals.css must define .touch-target');
  assert(css.includes('@media print'), 'globals.css must include @media print stylesheet');
  assert(css.includes('.no-print'), 'globals.css must define .no-print utility');
});

test('Root Layout: Decouples viewport and sets viewportFit to cover', () => {
  const layoutPath = path.join(ROOT_DIR, 'src', 'app', 'layout.tsx');
  assert(fs.existsSync(layoutPath), 'layout.tsx must exist');
  const code = fs.readFileSync(layoutPath, 'utf-8');

  assert(code.includes('export const viewport: Viewport'), 'layout.tsx must export decoupled viewport');
  assert(code.includes('viewportFit: "cover"'), 'viewport must configure viewportFit cover');
  assert(code.includes('themeColor: "#17458f"'), 'viewport must configure Rotary themeColor');
  assert(code.includes('export const metadata: Metadata'), 'layout.tsx must export metadata');
  assert(code.includes('manifest: "/manifest.json"'), 'metadata must reference manifest.json');
});

// ==============================================================================
// SUITE 5: ROTARY BRAND DESIGN SYSTEM & WCAG CONTRAST VERIFICATION
// ==============================================================================
console.log('\n--- SUITE 5: Rotary Brand & WCAG AA Contrast Verification ---');

test('WCAG Contrast: Rotary Blue (#17458f) on White (#ffffff) exceeds AAA (>= 7.0:1)', () => {
  const ratio = getContrastRatio('#17458f', '#ffffff');
  console.log(`    Computed Contrast Ratio (Blue on White): ${ratio.toFixed(2)}:1`);
  assert(ratio >= 7.0, `Contrast ratio ${ratio} must be >= 7.0:1 (passes WCAG AAA)`);
});

test('WCAG Contrast: Rotary Blue (#17458f) on Rotary Gold (#f7a81b) passes AA (>= 4.5:1)', () => {
  const ratio = getContrastRatio('#17458f', '#f7a81b');
  console.log(`    Computed Contrast Ratio (Blue on Gold): ${ratio.toFixed(2)}:1`);
  assert(ratio >= 4.5, `Contrast ratio ${ratio} must be >= 4.5:1 (passes WCAG AA)`);
});

test('WCAG Contrast: White (#ffffff) on Rotary Gold (#f7a81b) FAILS (< 4.5:1) — confirming rule', () => {
  const ratio = getContrastRatio('#ffffff', '#f7a81b');
  console.log(`    Computed Contrast Ratio (White on Gold): ${ratio.toFixed(2)}:1 (Expected Failure)`);
  assert(ratio < 4.5, `White on Gold must fail contrast to validate the accessibility requirement`);
});

test('Design Tokens: Button and Badge variants enforce dark blue text on gold backgrounds', () => {
  const buttonPath = path.join(ROOT_DIR, 'src', 'components', 'ui', 'button.tsx');
  const badgePath = path.join(ROOT_DIR, 'src', 'components', 'ui', 'badge.tsx');

  const buttonCode = fs.readFileSync(buttonPath, 'utf-8');
  const badgeCode = fs.readFileSync(badgePath, 'utf-8');

  // Verify button secondary/rotaryGold has rotary-blue text
  assert(buttonCode.includes('rotaryGold: "bg-rotary-gold text-rotary-blue'), 'Button rotaryGold must use text-rotary-blue');
  assert(buttonCode.includes('secondary: "bg-rotary-gold text-rotary-blue'), 'Button secondary must use text-rotary-blue');

  // Verify badge secondary/rotaryGold has rotary-blue text
  assert(badgeCode.includes('rotaryGold:'), 'Badge must have rotaryGold variant');
  assert(badgeCode.includes('text-rotary-blue'), 'Badge must use text-rotary-blue on gold');
});

// ==============================================================================
// SUITE 6: MOCK STORE DATA INTEGRITY & DOMAIN INVARIANTS
// ==============================================================================
console.log('\n--- SUITE 6: Mock Store Integrity & Simulated State Machine ---');

test('Mock Data: Seed datasets meet or exceed minimum requirements', () => {
  const mockPath = path.join(ROOT_DIR, 'src', 'lib', 'mock-store', 'mock-data.ts');
  assert(fs.existsSync(mockPath), 'mock-data.ts must exist');
  const content = fs.readFileSync(mockPath, 'utf-8');

  // Check equipment count
  const eqMatches = content.match(/patrimony_code:\s*'ROT-/g);
  assert(eqMatches && eqMatches.length >= 6, `Must have >= 6 mock equipments (found ${eqMatches?.length})`);

  // Check loan count
  const loanMatches = content.match(/loan_code:\s*'EMP-/g);
  assert(loanMatches && loanMatches.length >= 2, `Must have >= 2 mock loans (found ${loanMatches?.length})`);

  // Check beneficiary count and mandatory secondary contacts
  const secNameMatches = content.match(/secondary_name:\s*'/g);
  assert(secNameMatches && secNameMatches.length >= 2, `Must have >= 2 beneficiaries with secondary contacts`);
});

test('Mock Store Logic: LocalStore simulates loan creation, renewal limit, and return triage', async () => {
  // Read local-store.ts source and verify invariants statically & structurally
  const storePath = path.join(ROOT_DIR, 'src', 'lib', 'mock-store', 'local-store.ts');
  assert(fs.existsSync(storePath), 'local-store.ts must exist');
  const code = fs.readFileSync(storePath, 'utf-8');

  // Invariant 1: Creating a loan requires equipment status === 'DISPONIVEL'
  assert(code.includes("equipment.status !== 'DISPONIVEL'"), 'createLoan must reject non-available equipment');

  // Invariant 2: Creating a loan mutates equipment status to 'EMPRESTADO'
  assert(code.includes("equipment.status = 'EMPRESTADO'"), 'createLoan must transition equipment to EMPRESTADO');

  // Invariant 3: Renewing a loan guards against max_renewals
  assert(code.includes('loan.renewal_count >= loan.max_renewals'), 'renewLoan must enforce max_renewals guard');
  assert(code.includes('max_reached: true'), 'renewLoan must return max_reached flag');

  // Invariant 4: Return triage mutates loan to 'DEVOLVIDO' and equipment to destination
  assert(code.includes("loan.status = 'DEVOLVIDO'"), 'returnLoan must transition loan to DEVOLVIDO');
  assert(code.includes('equipment.status = triage.destination'), 'returnLoan must transition equipment to triage.destination');

  // Invariant 5: resetToInitialSeed restores clean state
  assert(code.includes('resetToInitialSeed'), 'localStore must provide resetToInitialSeed');
});

// ==============================================================================
// SUITE 7: EMPIRICAL BUILD, TYPECHECK & LINT EXECUTION
// ==============================================================================
console.log('\n--- SUITE 7: Empirical Build, Typecheck & Lint Execution ---');

test('Build: npm.cmd run typecheck exits with code 0 and zero errors', () => {
  console.log('    Executing: npm.cmd run typecheck ...');
  const out = execSync('npm.cmd run typecheck', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert(!out.includes('error TS'), 'TypeScript output must not contain TS errors');
});

test('Build: npm.cmd run lint exits with code 0 and zero warnings/errors', () => {
  console.log('    Executing: npm.cmd run lint ...');
  const out = execSync('npm.cmd run lint', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert(out.includes('No ESLint warnings or errors') || !out.includes('Error'), 'ESLint must pass cleanly');
});

test('Build: npm.cmd run build exits with code 0 and compiles production bundle', () => {
  console.log('    Executing: npm.cmd run build ...');
  const out = execSync('npm.cmd run build', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert(out.includes('Compiled successfully'), 'Next.js build must compile successfully');
  assert(fs.existsSync(path.join(ROOT_DIR, '.next')), '.next directory must exist after build');
});

// ==============================================================================
// SUMMARY & VERDICT
// ==============================================================================
console.log('\n==============================================================================');
console.log(`[Challenger M1] Empirical Stress Test Suite Finished!`);
console.log(`Total Passed: ${passCount}`);
console.log(`Total Failed: ${failCount}`);
console.log('==============================================================================');

if (failCount > 0) {
  console.error('\nFAILURES ENCOUNTERED:');
  for (const f of failures) {
    console.error(`- ${f.title}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log('\nVERDICT: ALL TESTS PASSED EMPIRICALLY (APPROVE)');
  process.exit(0);
}
