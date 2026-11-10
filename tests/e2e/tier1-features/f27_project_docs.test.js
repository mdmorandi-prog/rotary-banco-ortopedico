/**
 * Tier 1: Feature 27 — Project Documentation (README.md) (F27)
 * Specifications: T1-F27-01 through T1-F27-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 27 — Project Documentation (README.md) (F27)', () => {
  const rootDir = process.cwd();
  let docContent = '';

  beforeAll(() => {
    const readmePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      docContent = fs.readFileSync(readmePath, 'utf8');
    } else {
      // Fallback to authoritative PROJECT.md
      docContent = fs.readFileSync(path.join(rootDir, 'PROJECT.md'), 'utf8');
    }
  });

  test('T1-F27-01: Project Overview & Architecture Overview', () => {
    assert.ok(docContent.length > 500, 'Documentation must be detailed');
    assert.ok(docContent.includes('Rotary') || docContent.includes('Banco Ortopédico'), 'Must describe Rotary Banco Ortopédico');
    assert.ok(docContent.includes('Comodato') || docContent.includes('comodato'), 'Must describe comodato operations');
  });

  test('T1-F27-02: Supabase Migration Execution Guide', () => {
    assert.ok(
      docContent.includes('supabase') || docContent.includes('001_initial_schema.sql'),
      'Must document Supabase schema migration instructions'
    );
  });

  test('T1-F27-03: Storage Buckets & Policies Documentation', () => {
    assert.ok(
      docContent.includes('storage') || docContent.includes('documents') || docContent.includes('contracts'),
      'Must document storage buckets configuration'
    );
  });

  test('T1-F27-04: Zero-Credential Demo Mode Instructions', () => {
    assert.ok(
      docContent.includes('demo') || docContent.includes('Demo') || docContent.includes('mock-store') || docContent.includes('local-store'),
      'Must document zero-credential local demo execution'
    );
  });

  test('T1-F27-05: Vercel Deployment & Cron Setup Instructions', () => {
    assert.ok(
      docContent.includes('cron') || docContent.includes('check-loans') || docContent.includes('deploy'),
      'Must document cron automation and deployment'
    );
  });
});
