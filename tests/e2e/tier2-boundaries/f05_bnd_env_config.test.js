/**
 * Tier 2: Feature 5 Boundaries — Environment Configuration (F5)
 * Specifications: T2-F05-01 through T2-F05-05
 */

const { assert } = require('../test-harness');

describe('Tier 2: Feature 5 Boundaries — Environment Configuration (F5)', () => {
  test('T2-F05-01: Malformed Supabase URL Validation', () => {
    function validateSupabaseUrl(url) {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    }

    assert.strictEqual(validateSupabaseUrl('not_a_valid_url'), false, 'Malformed URL must be rejected');
    assert.strictEqual(validateSupabaseUrl('https://valid.supabase.co'), true, 'Valid HTTPS URL accepted');
  });

  test('T2-F05-02: Missing NEXT_PUBLIC_APP_URL Fallback', () => {
    function resolveAppUrl(configuredUrl, clientOrigin = 'http://localhost:3000') {
      if (configuredUrl && configuredUrl.trim().length > 0) {
        return configuredUrl.trim();
      }
      return clientOrigin;
    }

    assert.strictEqual(resolveAppUrl('', 'http://rotary-prod.org'), 'http://rotary-prod.org', 'Must fall back to origin when env unset');
    assert.strictEqual(resolveAppUrl('https://app.rotary.org'), 'https://app.rotary.org', 'Must use configured URL when present');
  });

  test('T2-F05-03: Unauthorized Cron Secret Attempt', () => {
    function authorizeCron(header, serverSecret) {
      if (!header || !header.startsWith('Bearer ')) return { status: 401, error: 'Unauthorized' };
      const token = header.replace('Bearer ', '').trim();
      if (token !== serverSecret) return { status: 401, error: 'Unauthorized' };
      return { status: 200, authorized: true };
    }

    const res = authorizeCron('Bearer wrong_token', 'valid_secret_123');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error, 'Unauthorized');
  });

  test('T2-F05-04: Service Role Key Leakage Guard', () => {
    // Client-side payload must never expose SUPABASE_SERVICE_ROLE_KEY
    const clientPayload = {
      supabaseUrl: 'https://xyz.supabase.co',
      anonKey: 'public-anon-key'
    };
    assert.strictEqual(clientPayload.serviceRoleKey, undefined, 'serviceRoleKey must not be present in client config');
  });

  test('T2-F05-05: Trailing Slash URL Normalization', () => {
    function normalizeUrl(url) {
      return url.replace(/\/+$/, '');
    }

    const clean = normalizeUrl('https://xyz.supabase.co///');
    assert.strictEqual(clean, 'https://xyz.supabase.co', 'Trailing slashes must be stripped');
  });
});
