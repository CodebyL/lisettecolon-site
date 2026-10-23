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

// ---- customer-portal ----
// Signed-in client: open Stripe's billing portal for their own business (update card, see invoices and receipts).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const userDb = asUser(req);
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json(req, { error: "Please sign in again." }, 401);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const clientId = clean(body.client_id, 60);
  // RLS: this only returns a client the user is a member of.
  const { data: client } = await userDb.from("clients").select("id, stripe_customer_id").eq("id", clientId).maybeSingle();
  if (!client?.stripe_customer_id) return json(req, { error: "Billing isn't set up for this account yet. Please contact Lisette." }, 404);
  const portal = await stripe.billingPortal.sessions.create({ customer: client.stripe_customer_id, return_url: `${SITE}/account/index.html` });
  return json(req, { url: portal.url });
});
