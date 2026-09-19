import { createClient } from '@supabase/supabase-js';

/**
 * Extracts and validates browser Supabase environment configuration.
 * Prevents TypeError when running outside Vite bundler (e.g., in Node test environment).
 */
export function getSupabaseBrowserConfig(env) {
  let envObj = env;

  if (!envObj) {
    try {
      if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
        envObj = import.meta.env;
      } else if (typeof process !== 'undefined' && process.env) {
        envObj = process.env;
      }
    } catch {
      envObj = undefined;
    }
  }

  const url = envObj?.VITE_SUPABASE_URL || envObj?.SUPABASE_URL || null;
  const anonKey = envObj?.VITE_SUPABASE_ANON_KEY || envObj?.SUPABASE_ANON_KEY || null;

  return { url, anonKey };
}

let clientInstance = null;

/**
 * Creates a browser Supabase client with explicit configuration.
 */
export function createBrowserSupabaseClient(config) {
  if (!config || !config.url || !config.anonKey) {
    throw new Error(`[SUPABASE_BROWSER_CONFIG_MISSING] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in environment.`);
  }

  clientInstance = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  return clientInstance;
}

/**
 * Returns existing browser Supabase client instance or initializes it lazily if environment is configured.
 * Does NOT throw error on module import. Throws SUPABASE_BROWSER_CONFIG_MISSING only when called without configuration.
 */
export function getBrowserSupabaseClient(envOverride) {
  if (clientInstance && !envOverride) {
    return clientInstance;
  }

  const config = getSupabaseBrowserConfig(envOverride);

  if (!config.url || !config.anonKey) {
    throw new Error(`[SUPABASE_BROWSER_CONFIG_MISSING] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in environment.`);
  }

  return createBrowserSupabaseClient(config);
}
