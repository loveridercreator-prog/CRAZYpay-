import { createClient } from "@supabase/supabase-js";

function getValidSupabaseUrl() {
  const envUrl =
    (typeof process !== "undefined" &&
      (process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL)) ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL));
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl;
  }
  try {
    return typeof atob !== "undefined"
      ? atob("aHR0cHM6Ly90Z29tcnF1c3Z1cWt0eWprdGppaS5zdXBhYmFzZS5jbw==")
      : Buffer.from("aHR0cHM6Ly90Z29tcnF1c3Z1cWt0eWprdGppaS5zdXBhYmFzZS5jbw==", "base64").toString(
          "utf-8",
        );
  } catch (_e) {
    return "";
  }
}

function getValidSupabaseAnonKey() {
  const envKey =
    (typeof process !== "undefined" &&
      (process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  if (envKey && !envKey.startsWith("pk_")) {
    return envKey;
  }
  try {
    return typeof atob !== "undefined"
      ? atob("c2JfcHVibGlzaGFibGVfYy1nYlU3Y0dGUlUtbVBtUnR2LUlLQV94bDV1bkRZNw==")
      : Buffer.from(
          "c2JfcHVibGlzaGFibGVfYy1nYlU3Y0dGUlUtbVBtUnR2LUlLQV94bDV1bkRZNw==",
          "base64",
        ).toString("utf-8");
  } catch (_e) {
    return "";
  }
}

const supabaseUrl = getValidSupabaseUrl();
const supabaseAnonKey = getValidSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: { "x-application-name": "crazypay" },
  },
});

export default supabase;
