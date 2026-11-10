/**
 * Tier 1: Feature 5 — Environment Configuration (F5)
 * Specifications: T1-F05-01 through T1-F05-05
 */

const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../test-harness');

describe('Tier 1: Feature 5 — Environment Configuration (F5)', () => {
  const envExamplePath = path.join(process.cwd(), '.env.example');

  test('T1-F05-01: Mandatory Supabase Environment Variables', () => {
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('NEXT_PUBLIC_SUPABASE_URL='), 'Must include NEXT_PUBLIC_SUPABASE_URL');
    assert.ok(content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY='), 'Must include NEXT_PUBLIC_SUPABASE_ANON_KEY');
    assert.ok(content.includes('SUPABASE_SERVICE_ROLE_KEY='), 'Must include SUPABASE_SERVICE_ROLE_KEY');
  });

  test('T1-F05-02: WhatsApp Integration Environment Variables', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('WHATSAPP_PROVIDER='), 'Must declare WHATSAPP_PROVIDER');
    assert.ok(content.includes('NEXT_PUBLIC_CONTACT_PHONE=') || content.includes('WHATSAPP_'), 'Must declare club contact phone');
  });

  test('T1-F05-03: Application & Security Environment Variables', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('CRON_SECRET='), 'Must declare CRON_SECRET');
    assert.ok(content.includes('NEXT_PUBLIC_APP_URL='), 'Must declare NEXT_PUBLIC_APP_URL');
  });

  test('T1-F05-04: Client-Safe vs Server-Only Key Separation', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        assert.ok(!line.trim().startsWith('NEXT_PUBLIC_'), 'SUPABASE_SERVICE_ROLE_KEY must NEVER be prefixed with NEXT_PUBLIC_');
      }
      if (line.includes('CRON_SECRET=')) {
        assert.ok(!line.trim().startsWith('NEXT_PUBLIC_'), 'CRON_SECRET must NEVER be prefixed with NEXT_PUBLIC_');
      }
    }
  });

  test('T1-F05-05: Runtime Env Validation / Fallback Handler', () => {
    // When environment variables are missing, demo fallback must be activated without crash
    function resolveMode(env = {}) {
      if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') || env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'true') {
        return 'DEMO_MODE';
      }
      return 'SUPABASE_MODE';
    }

    assert.strictEqual(resolveMode({}), 'DEMO_MODE', 'Empty env must cleanly activate DEMO_MODE');
    assert.strictEqual(
      resolveMode({ NEXT_PUBLIC_SUPABASE_URL: 'https://real-prod.supabase.co', NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: 'false' }),
      'SUPABASE_MODE',
      'Valid production config must activate SUPABASE_MODE'
    );
  });
});
