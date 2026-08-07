// =========================================================
// CONFIG — fill these in before deploying
// =========================================================
const CONFIG = {
  SUPABASE_URL: "https://euezcqqaucxqopfiqdhb.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_36wg4f_YrTe0t32LPfTPmA_8Bvpx0gC",

  // Deployed Edge Function URLs — Supabase assigned random names on deploy,
  // so these are hardcoded rather than derived. If you redeploy and get new
  // names, update the lines below.
  VERIFY_PAYMENT_URL: "https://euezcqqaucxqopfiqdhb.supabase.co/functions/v1/dynamic-service",
  REPROCESS_DELIVERY_URL: "https://euezcqqaucxqopfiqdhb.supabase.co/functions/v1/rapid-responder",
  PROVIDER_PLANS_URL: "https://euezcqqaucxqopfiqdhb.supabase.co/functions/v1/swift-worker",
};
