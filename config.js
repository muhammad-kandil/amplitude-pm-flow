// Amplitude PM Flow — configuration
// Leave SUPABASE_URL empty to run in "local" mode (progress saved in the browser only, no sign-in).
// Fill both values to turn on sign-in and shared saved features (see README.md).
window.PM_FLOW_CONFIG = {
  SUPABASE_URL: "https://zssywhvpplfihbvymgtz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_mkdTJMtEggkDwfJJCVV8Fg_sR7lpNVv", // publishable key (safe to publish; row-level security protects the data)
  ALLOWED_EMAIL_DOMAIN: "alefeducation.com",
  MICROSOFT_SSO: false,        // set true once the Azure provider is enabled in Supabase (Authentication → Providers → Azure)
  CONTACTS: {
    cohorts: "Fakhry · Hari"
  }
};
