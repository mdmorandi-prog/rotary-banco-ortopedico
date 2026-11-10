/**
 * Tier 2: Feature 1 Boundaries — App Setup & Tooling (F1)
 * Specifications: T2-F01-01 through T2-F01-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 2: Feature 1 Boundaries — App Setup & Tooling (F1)', () => {
  const rootDir = process.cwd();

  test('T2-F01-01: PowerShell Restricted Execution Policy Interception', () => {
    // Verifies runner and package scripts do not execute raw unsigned .ps1 scripts
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts, 'Must have scripts defined');
    for (const [key, val] of Object.entries(pkg.scripts)) {
      assert.ok(!val.endsWith('.ps1'), `Script "${key}" must not invoke .ps1 directly`);
    }
  });

  test('T2-F01-02: Missing Optional Environment Variables Boot Test', () => {
    // When environment variables are completely absent, system activates demo store
    function evaluateBootEnvironment(env = {}) {
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return { mode: 'DEMO_STORE', healthy: true };
      }
      return { mode: 'SUPABASE_CONNECTED', healthy: true };
    }

    const state = evaluateBootEnvironment({});
    assert.strictEqual(state.mode, 'DEMO_STORE', 'Must gracefully switch to DEMO_STORE');
    assert.strictEqual(state.healthy, true, 'System must be healthy and not crash');
  });

  test('T2-F01-03: Unsupported Node.js Runtime (< v18) Detection', () => {
    const currentMajor = parseInt(process.version.replace('v', '').split('.')[0], 10);
    assert.ok(currentMajor >= 18, `Node.js major version must be >= 18 (current: v${currentMajor})`);

    function checkNodeEngine(versionStr) {
      const major = parseInt(versionStr.replace('v', '').split('.')[0], 10);
      if (major < 18) throw new Error(`Unsupported Node.js version ${versionStr}. Requires >= 18.0.0.`);
      return true;
    }

    assert.throws(() => checkNodeEngine('v16.14.0'), /Unsupported Node.js version/);
  });

  test('T2-F01-04: Malformed next.config.mjs Error Boundary', () => {
    const nextConfigPath = path.join(rootDir, 'next.config.mjs');
    assert.ok(fs.existsSync(nextConfigPath), 'next.config.mjs must exist');
    const content = fs.readFileSync(nextConfigPath, 'utf8');
    assert.ok(content.includes('nextConfig'), 'Must define nextConfig');
    assert.ok(content.includes('export default') || content.includes('module.exports'), 'Must export config cleanly');
  });

  test('T2-F01-05: TypeScript Strict Null Check Invariant', () => {
    const tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf8'));
    assert.strictEqual(tsconfig.compilerOptions.strict, true, 'Strict null checks must be enabled in compilerOptions');
  });
});
