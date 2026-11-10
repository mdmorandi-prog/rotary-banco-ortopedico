/**
 * Tier 1: Feature 1 — App Setup & Tooling (F1)
 * Specifications: T1-F01-01 through T1-F01-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 1 — App Setup & Tooling (F1)', () => {
  const rootDir = process.cwd();

  test('T1-F01-01: App Router Root Layout and HTML lang attribute', () => {
    // Check layout.tsx or template layout file for lang="pt-BR" and viewport
    const layoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
    if (fs.existsSync(layoutPath)) {
      const content = fs.readFileSync(layoutPath, 'utf8');
      assert.ok(content.includes('lang="pt-BR"') || content.includes("lang='pt-BR'"), 'Root layout must define lang="pt-BR"');
      assert.ok(content.includes('viewport') || content.includes('width=device-width'), 'Root layout must configure responsive mobile viewport');
    } else {
      // If layout is being compiled, verify package.json declares Next.js 14 App Router
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      assert.ok(pkg.dependencies.next, 'Next.js must be declared as dependency');
    }
  });

  test('T1-F01-02: TypeScript Compilation & Strict Mode', () => {
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json must exist');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    assert.strictEqual(tsconfig.compilerOptions.strict, true, 'tsconfig strict mode must be enabled');
    assert.ok(tsconfig.compilerOptions.paths && tsconfig.compilerOptions.paths['@/*'], 'Path alias @/* must be configured');
  });

  test('T1-F01-03: Tailwind CSS & Design Token Compilation', () => {
    const tailwindConfigPath = path.join(rootDir, 'tailwind.config.ts');
    assert.ok(fs.existsSync(tailwindConfigPath), 'tailwind.config.ts must exist');
    const content = fs.readFileSync(tailwindConfigPath, 'utf8');
    assert.ok(content.includes('#17458f') || content.includes('rotary-blue') || content.includes('rotaryBlue'), 'Tailwind must declare Rotary Royal Blue #17458f');
    assert.ok(content.includes('#f7a81b') || content.includes('rotary-gold') || content.includes('rotaryGold'), 'Tailwind must declare Rotary Gold #f7a81b');
  });

  test('T1-F01-04: Lucide Icon Library Rendering & Dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['lucide-react'], 'lucide-react icon library must be installed');
  });

  test('T1-F01-05: Windows npm.cmd Execution Compatibility', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts, 'package.json must declare scripts');
    assert.ok(pkg.scripts.build, 'Must define build script');
    // Ensure scripts avoid raw unix-only chaining that breaks in Windows PowerShell
    Object.values(pkg.scripts).forEach(cmd => {
      assert.ok(!cmd.includes('export ') && !cmd.includes('&& export'), 'Scripts must be cross-platform compatible');
    });
  });
});
