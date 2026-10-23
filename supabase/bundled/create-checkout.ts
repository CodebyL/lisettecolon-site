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

// ---- create-checkout ----
// Public: start a Stripe Checkout for a fixed-price item. The amount comes from the server catalog, never from the browser.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: "Please try again." }, 400); }
  const itemKey = clean(b.item, 40), optKey = clean(b.option, 20);
  const item = CATALOG[itemKey], opt = item?.options[optKey];
  const email = clean(b.email, 200).toLowerCase(), business = clean(b.business, 160);
  if (!item || !opt) return json(req, { error: "That service can't be booked online. Please contact Lisette." }, 400);
  if (!isEmail(email) || !business) return json(req, { error: "Please add your business name and a valid email." }, 422);

  const prices = await stripe.prices.list({ lookup_keys: [opt.lookup, ...(opt.upfrontLookup ? [opt.upfrontLookup] : [])], active: true });
  const main = prices.data.find((p) => p.lookup_key === opt.lookup);
  const upfront = opt.upfrontLookup ? prices.data.find((p) => p.lookup_key === opt.upfrontLookup) : undefined;
  if (!main || (opt.upfrontLookup && !upfront)) return json(req, { error: "Online payment for this service isn't ready yet. Please contact Lisette." }, 503);

  const metadata = { item: itemKey, option: optKey, business, kind: opt.kind, installments: String(opt.installments ?? "") };
  const base = {
    customer_email: email,
    success_url: `${SITE}/thanks.html?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/checkout.html?item=${encodeURIComponent(itemKey)}`,
    metadata,
    payment_method_types: ["card", "us_bank_account"] as ("card" | "us_bank_account")[],
    custom_text: { submit: { message: "Your payment is recorded once Stripe confirms it." } },
  };
  const session = opt.mode === "payment"
    ? await stripe.checkout.sessions.create({ ...base, mode: "payment", customer_creation: "always",
        line_items: [{ price: main.id, quantity: 1 }], payment_intent_data: { metadata, description: `${item.name} (${optKey})` },
        invoice_creation: { enabled: true, invoice_data: { metadata, description: `${item.name}: ${optKey === "deposit" ? "deposit, counts toward the total" : "paid in full"}` } } })
    : await stripe.checkout.sessions.create({ ...base, mode: "subscription",
        line_items: [{ price: main.id, quantity: 1 }, ...(upfront ? [{ price: upfront.id, quantity: 1 }] : [])],
        subscription_data: { metadata,
          // 12-month website plan: only the 25% start payment is charged today; monthly payments begin in 30 days.
          ...(opt.installments ? { billing_cycle_anchor: Math.floor(Date.now() / 1000) + 30 * 86400, proration_behavior: "none" as const } : {}) } });

  await admin().from("checkout_orders").insert({ stripe_session_id: session.id, item: itemKey, option: optKey, business, email, amount_due_now_cents: opt.nowCents, status: "open" });
  return json(req, { url: session.url });
});
