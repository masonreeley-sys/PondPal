import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cjmezqohvhahrrpcdyxn.supabase.co";
const supabaseAnonKey = "sb_publishable_6YDHBu12u4KM1lfHMlSFDA_yXwkrGGA";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
