export const SUPABASE_CONFIG = {
  url: 'https://eaismlkdpmorblluzpki.supabase.co',
  anonKey: 'sb_publishable_mazrg7bbDffya88koyYIEQ_gTc4yfLE'
};

export const SUPABASE_IS_CONFIGURED = 
  !!SUPABASE_CONFIG.url && 
  !SUPABASE_CONFIG.url.includes('PASTE_') && 
  !!SUPABASE_CONFIG.anonKey && 
  !SUPABASE_CONFIG.anonKey.includes('PASTE_');
