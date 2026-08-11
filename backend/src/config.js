import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

export const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
};

export function requireConfig(...keys) {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length) throw Object.assign(new Error(`Server is missing: ${missing.join(', ')}`), { status: 503 });
}

export const isSupabaseConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey && config.supabaseServiceRoleKey);
