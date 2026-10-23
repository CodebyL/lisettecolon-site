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

// ---- admin-invite ----
// Admin only: create or reuse a client and invite a person to its account by email.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const userDb = asUser(req);
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json(req, { error: "Please sign in again." }, 401);
  const { data: me } = await userDb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return json(req, { error: "Not allowed." }, 403);

  const b = await req.json().catch(() => ({}));
  const email = clean(b.email, 200).toLowerCase(), name = clean(b.full_name, 120);
  let clientId = clean(b.client_id, 60);
  if (!isEmail(email)) return json(req, { error: "Enter a valid email." }, 422);
  const db = admin();
  if (!clientId) {
    const business = clean(b.business_name, 160);
    if (!business) return json(req, { error: "Choose a client or enter a business name." }, 422);
    const { data, error } = await db.from("clients").insert({ business_name: business, billing_email: email }).select("id").single();
    if (error) return json(req, { error: "Couldn't create the client." }, 500);
    clientId = data.id;
  }
  // Existing user? Link them. Otherwise send an invitation email.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let target = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (!target) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${SITE}/account/index.html#set-password` });
    if (error) return json(req, { error: "Couldn't send the invitation." }, 500);
    target = data.user;
  }
  await db.from("client_members").upsert({ client_id: clientId, user_id: target!.id, role: "owner" }, { onConflict: "client_id,user_id" });
  return json(req, { ok: true, client_id: clientId });
});
