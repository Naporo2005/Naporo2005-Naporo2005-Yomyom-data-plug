// Requires the Supabase JS CDN script + config.js to be loaded first
const supabaseClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_PUBLISHABLE_KEY
);
