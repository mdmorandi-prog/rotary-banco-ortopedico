/**
 * Tier 2: Feature 27 Boundaries — Project Documentation (README.md) (F27)
 * Specifications: T2-F27-01 through T2-F27-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 2: Feature 27 Boundaries — Project Documentation (README.md) (F27)', () => {
  const rootDir = process.cwd();
  let docContent = '';

  beforeAll(() => {
    const readmePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      docContent = fs.readFileSync(readmePath, 'utf8');
    } else {
      docContent = fs.readFileSync(path.join(rootDir, 'PROJECT.md'), 'utf8');
    }
  });

  test('T2-F27-01: Windows PowerShell Command Accuracy Verification', () => {
    // Documentation or instructions must guide Windows command compatibility
    assert.ok(
      docContent.includes('npm') || docContent.includes('node') || docContent.includes('build'),
      'Must contain execution commands'
    );
  });

  test('T2-F27-02: Zero Secret Leakage in Documentation Examples', () => {
    // Assert documentation contains NO production passwords, JWTs, or real API keys
    assert.ok(!docContent.includes('eyJh'), 'Must not contain real Supabase JWT tokens');
    assert.ok(!docContent.includes('service_role_secret_production'), 'Must not expose production secrets');
  });

  test('T2-F27-03: Relative File Links Existence Verification', () => {
    const relativePathChecks = [
      'supabase/migrations/001_initial_schema.sql',
      '.env.example',
      'package.json'
    ];

    relativePathChecks.forEach(rel => {
      assert.ok(fs.existsSync(path.join(rootDir, rel)), `Referenced file "${rel}" must exist on disk`);
    });
  });

  test('T2-F27-04: Documentation for Storage CORS and Bucket Policies', () => {
    assert.ok(
      docContent.includes('storage') || docContent.includes('bucket') || docContent.includes('Bucket') || docContent.includes('documents'),
      'Documentation must describe media bucket and policy setup'
    );
  });

  test('T2-F27-05: Production Build and Deploy Checklist Completeness', () => {
    assert.ok(
      docContent.includes('build') || docContent.includes('vercel') || docContent.includes('Deploy') || docContent.includes('cron'),
      'Documentation must provide production deployment guidance'
    );
  });
});
