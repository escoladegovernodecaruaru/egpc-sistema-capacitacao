import { createClient } from "@supabase/supabase-js";

// Check se as variaveis de ambiente estão definidas, caso falhe, avisa no console (útil em dev).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
