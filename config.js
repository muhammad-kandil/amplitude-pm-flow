// Amplitude PM Bible — configuration
// Leave SUPABASE_URL empty to run in "local" mode (progress saved in the browser only, no sign-in).
// Fill both values to turn on sign-in and shared saved features (see README.md).
window.PM_BIBLE_CONFIG = {
  SUPABASE_URL: "",            // e.g. "https://abcdefghijklmnop.supabase.co"
  SUPABASE_ANON_KEY: "",       // the project's anon/public key (safe to publish; row-level security protects the data)
  ALLOWED_EMAIL_DOMAIN: "alefeducation.com",
  CONTACTS: {
    cohorts: "Fakhry · Hari",
    governance: "Kandil"
  }
};
