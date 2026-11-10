// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - SUPABASE CLIENT FACTORY & STORAGE HELPERS
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_STORAGE_BUCKET = 'orthopedic-bank';

let browserClientInstance: SupabaseClient | null = null;

/**
 * Checks whether valid Supabase environment variables are present.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (
    url === 'undefined' ||
    anonKey === 'undefined' ||
    url.includes('your-project') ||
    anonKey.includes('your-anon-key')
  ) {
    return false;
  }

  return true;
}

/**
 * Creates or returns the singleton Supabase client for browser or server usage.
 * Falls back to safe placeholder coordinates if running in unconfigured Demo Mode
 * so imports never throw at module evaluation time.
 */
export function getSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined' && browserClientInstance) {
    return browserClientInstance;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : 'https://placeholder-demo.supabase.co';

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : 'public-demo-anon-key-placeholder';

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  });

  if (typeof window !== 'undefined') {
    browserClientInstance = client;
  }

  return client;
}

/**
 * Creates a server-side Supabase client (optionally using SUPABASE_SERVICE_ROLE_KEY
 * for administrative background tasks such as the daily cron job).
 */
export function createServerSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : 'https://placeholder-demo.supabase.co';

  const serviceOrAnonKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'public-demo-anon-key-placeholder';

  return createClient(supabaseUrl, serviceOrAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Returns the public URL for an object stored in Supabase Storage (default bucket: `orthopedic-bank`).
 */
export function getStoragePublicUrl(
  bucket: string = DEFAULT_STORAGE_BUCKET,
  path: string
): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, '');
  const client = getSupabaseClient();
  const { data } = client.storage.from(bucket).getPublicUrl(cleanPath);
  return data.publicUrl;
}

export const supabase = getSupabaseClient();
