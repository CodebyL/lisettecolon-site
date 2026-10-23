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

// ---- submit-inquiry ----
// Public: consultation requests, quote requests and contact messages. Spam protection: honeypot, length limits, per-IP rate limit.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: "Please try again." }, 400); }
  if (clean(b.company_site)) return json(req, { ok: true }); // honeypot
  const d = {
    kind: ["consultation", "quote", "inquiry"].includes(String(b.kind)) ? String(b.kind) : "inquiry",
    name: clean(b.name, 120), business: clean(b.business, 160), email: clean(b.email, 200).toLowerCase(),
    phone: clean(b.phone, 40), website: clean(b.website, 300), location: clean(b.location, 300),
    service: clean(b.service, 40), format: ["in_person", "video", "phone"].includes(String(b.format)) ? String(b.format) : null,
    availability: clean(b.availability, 300), message: clean(b.message, 4000), page: clean(b.page, 200),
  };
  if (!d.name || !d.message || !isEmail(d.email)) return json(req, { error: "Please add your name, a valid email and a short message." }, 422);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ip_hash = await sha256(ip + (Deno.env.get("IP_SALT") ?? ""));
  const db = admin();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("inquiries").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", since);
  if ((count ?? 0) >= 5) return json(req, { error: "Too many messages from this connection. Please email hi@lisettecolon.com." }, 429);
  const { error } = await db.from("inquiries").insert({ ...d, ip_hash });
  if (error) return json(req, { error: "That didn't go through. Please email hi@lisettecolon.com." }, 500);

  // Optional email alert to Lisette (only if an email service key is configured). The message itself is stored either way.
  const key = Deno.env.get("RESEND_API_KEY");
  if (key) {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("ALERT_FROM") ?? "Website <alerts@lisettecolon.com>", to: ["hi@lisettecolon.com"], reply_to: d.email,
        subject: `New ${d.kind} request: ${d.business || d.name}`, text: `${d.name} (${d.business})\n${d.email} ${d.phone}\nFormat: ${d.format ?? "-"}\nAvailability: ${d.availability}\n\n${d.message}` }),
    }).catch(() => {});
  }
  return json(req, { ok: true });
});
