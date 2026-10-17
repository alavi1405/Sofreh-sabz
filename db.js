// فایل مدیریت دیتابیس (Supabase)
const SUPABASE_URL = "https://znblebezgplnzjexdjx.supabase.co";
const SUPABASE_KEY = "sb_publishable_vCrEbmQ7YalZ9_rvnPIrqA_hBGL_TI_";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
