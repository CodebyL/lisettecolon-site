import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.49.4";


const SITE = Deno.env.get("SITE_URL") ?? "https://lisettecolon.com";
const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? SITE).split(",").map((s) => s.trim());

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(o) ? o : allowed[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
let _stripe: Stripe | null = null;
const stripe = new Proxy({} as Stripe, { get(_t, k) { _stripe ??= new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() }); return (_stripe as any)[k]; } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
function asUser(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
}
function clean(v: unknown, max = 500): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200;
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Server-side catalog. Amounts here are the only ones charged; the browser only sends the item and option ids.
// Prices are created in Stripe by scripts/stripe-setup.mjs using these lookup keys.
type Option = { lookup: string; mode: "payment" | "subscription"; nowCents: number; upfrontLookup?: string; installments?: number; kind: string };
type Item = { name: string; options: Record<string, Option>; planKey?: string };

const CATALOG: Record<string, Item> = {
  "website-starter":  { name: "Starter website",  options: {
    deposit: { lookup: "lc_web_starter_deposit", mode: "payment", nowCents: 60000, kind: "deposit" },
    plan12:  { lookup: "lc_web_starter_monthly", mode: "subscription", nowCents: 30000, upfrontLookup: "lc_web_starter_upfront", installments: 12, kind: "website_installments" } } },
  "website-standard": { name: "Standard website", options: {
    deposit: { lookup: "lc_web_standard_deposit", mode: "payment", nowCents: 125000, kind: "deposit" },
    plan12:  { lookup: "lc_web_standard_monthly", mode: "subscription", nowCents: 62500, upfrontLookup: "lc_web_standard_upfront", installments: 12, kind: "website_installments" } } },
  "website-premium":  { name: "Premium website",  options: {
    deposit: { lookup: "lc_web_premium_deposit", mode: "payment", nowCents: 190000, kind: "deposit" },
    plan12:  { lookup: "lc_web_premium_monthly", mode: "subscription", nowCents: 95000, upfrontLookup: "lc_web_premium_upfront", installments: 12, kind: "website_installments" } } },
  "photo-session":    { name: "Photo session", options: { deposit: { lookup: "lc_photo_deposit", mode: "payment", nowCents: 15000, kind: "deposit" } } },
  "drone":            { name: "Drone photos and video", options: { deposit: { lookup: "lc_drone_deposit", mode: "payment", nowCents: 20000, kind: "deposit" } } },
  "logo":             { name: "Logo refresh", options: { deposit: { lookup: "lc_logo_deposit", mode: "payment", nowCents: 20000, kind: "deposit" } } },
  "gbp":              { name: "Google Business Profile setup", options: { full: { lookup: "lc_gbp", mode: "payment", nowCents: 25000, kind: "full" } } },
  "local-search":     { name: "Local Search Setup", options: { full: { lookup: "lc_local_search", mode: "payment", nowCents: 45000, kind: "full" } } },
  "update-hour":      { name: "Extra update hour", options: { full: { lookup: "lc_update_hour", mode: "payment", nowCents: 8500, kind: "full" } } },
  "local-visibility": { name: "Local Visibility plan", planKey: "local-visibility", options: { monthly: { lookup: "lc_local_visibility_monthly", mode: "subscription", nowCents: 15000, kind: "marketing" } } },
  "care-hosting":     { name: "Hosting plan", planKey: "care-hosting", options: {
    monthly: { lookup: "lc_care_hosting_monthly", mode: "subscription", nowCents: 3500, kind: "care" },
    yearly:  { lookup: "lc_care_hosting_yearly",  mode: "subscription", nowCents: 35000, kind: "care" } } },
  "care-care":        { name: "Care plan", planKey: "care-care", options: {
    monthly: { lookup: "lc_care_care_monthly", mode: "subscription", nowCents: 10000, kind: "care" },
    yearly:  { lookup: "lc_care_care_yearly",  mode: "subscription", nowCents: 100000, kind: "care" } } },
  "care-plus":        { name: "Care Plus plan", planKey: "care-plus", options: {
    monthly: { lookup: "lc_care_plus_monthly", mode: "subscription", nowCents: 20000, kind: "care" },
    yearly:  { lookup: "lc_care_plus_yearly",  mode: "subscription", nowCents: 200000, kind: "care" } } },
};

// ---- setup-catalog ----
// One-time setup: creates the Stripe products and prices the checkout uses. Admin only. Safe to run again.

const NAMES: Record<string, [string, number, "month" | "year" | null, string][]> = {
  "Starter website": [["lc_web_starter_deposit", 60000, null, "Deposit (50%)"], ["lc_web_starter_upfront", 30000, null, "12-month plan: start payment"], ["lc_web_starter_monthly", 8500, "month", "12-month plan: monthly payment"]],
  "Standard website": [["lc_web_standard_deposit", 125000, null, "Deposit (50%)"], ["lc_web_standard_upfront", 62500, null, "12-month plan: start payment"], ["lc_web_standard_monthly", 17500, "month", "12-month plan: monthly payment"]],
  "Premium website": [["lc_web_premium_deposit", 190000, null, "Deposit (50%)"], ["lc_web_premium_upfront", 95000, null, "12-month plan: start payment"], ["lc_web_premium_monthly", 27000, "month", "12-month plan: monthly payment"]],
  "Photo session": [["lc_photo_deposit", 15000, null, "Deposit"]],
  "Drone photos and video": [["lc_drone_deposit", 20000, null, "Deposit"]],
  "Logo refresh": [["lc_logo_deposit", 20000, null, "Deposit (50%)"]],
  "Google Business Profile setup": [["lc_gbp", 25000, null, "Paid in full"]],
  "Local Search Setup": [["lc_local_search", 45000, null, "Paid in full"]],
  "Extra update hour": [["lc_update_hour", 8500, null, "One hour"]],
  "Local Visibility plan": [["lc_local_visibility_monthly", 15000, "month", "Monthly"]],
  "Hosting plan": [["lc_care_hosting_monthly", 3500, "month", "Monthly"], ["lc_care_hosting_yearly", 35000, "year", "Yearly"]],
  "Care plan": [["lc_care_care_monthly", 10000, "month", "Monthly"], ["lc_care_care_yearly", 100000, "year", "Yearly"]],
  "Care Plus plan": [["lc_care_plus_monthly", 20000, "month", "Monthly"], ["lc_care_plus_yearly", 200000, "year", "Yearly"]],
};
void CATALOG;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const db = asUser(req);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json(req, { error: "Sign in first." }, 401);
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return json(req, { error: "Not allowed." }, 403);
  if (!(Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_") && Deno.env.get("ALLOW_LIVE_SETUP") !== "yes")
    return json(req, { error: "Refusing: the Stripe key is not a test key." }, 400);
  const log: string[] = [];
  for (const [name, prices] of Object.entries(NAMES)) {
    const found = await stripe.products.search({ query: `name:'${name}' AND active:'true'` });
    const product = found.data[0] ?? await stripe.products.create({ name });
    for (const [lookup, amount, interval, nickname] of prices) {
      const ex = await stripe.prices.list({ lookup_keys: [lookup], active: true });
      if (ex.data[0]?.unit_amount === amount) { log.push("ok " + lookup); continue; }
      await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: amount, nickname, lookup_key: lookup, transfer_lookup_key: true, ...(interval ? { recurring: { interval } } : {}) });
      log.push("created " + lookup);
    }
  }
  return json(req, { ok: true, log });
});
