const SUPABASE_URL = "https://xwccfdopgykvzccivgbn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y2A8l6e0_VKFqCRVMPCTEA_esOtw8bj";

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  window.iatraSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

