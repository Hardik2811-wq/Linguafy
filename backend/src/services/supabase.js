import { createClient } from '@supabase/supabase-js';
import { config, requireConfig } from '../config.js';

let adminClient;
let publicClient;

export function admin() {
  requireConfig('supabaseUrl', 'supabaseServiceRoleKey');
  return adminClient ??= createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function publicAuth() {
  requireConfig('supabaseUrl', 'supabaseAnonKey');
  return publicClient ??= createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function dbError(result) {
  if (result.error) throw Object.assign(new Error(result.error.message), { status: 502 });
  return result.data;
}
