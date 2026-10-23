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

// ---- stripe-webhook ----
// Stripe -> database. Only verified events change payment records. Each event is processed once (stripe_events).
// We always re-read the object from Stripe so out-of-order events still end in the latest state.

const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const db = admin();
const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);

async function clientFor(customerId: string | null, business?: string | null, email?: string | null) {
  if (!customerId) return null;
  const { data } = await db.from("clients").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await db.from("clients")
    .insert({ business_name: business || email || "New client", billing_email: email, stripe_customer_id: customerId })
    .select("id").single();
  if (error) { // another event created it at the same moment
    const { data: again } = await db.from("clients").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    return (again?.id as string) ?? null;
  }
  return created.id as string;
}

function invoiceKind(inv: Stripe.Invoice): string {
  const k = inv.metadata?.kind ?? inv.subscription_details?.metadata?.kind ?? "";
  if (k === "deposit") return "deposit";
  if (k === "website_installments") return "installment";
  if (k === "care" || k === "marketing" || k === "system") return "plan";
  if (k === "balance") return "balance";
  return "other";
}

async function syncInvoice(id: string) {
  const inv = await stripe.invoices.retrieve(id);
  const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
  const client_id = await clientFor(customer, inv.metadata?.business ?? inv.customer_name, inv.customer_email);
  if (!client_id) return;
  await db.from("invoices").upsert({
    stripe_invoice_id: inv.id, client_id, number: inv.number, description: inv.description ?? inv.lines.data[0]?.description ?? null,
    kind: invoiceKind(inv), amount_due_cents: inv.amount_due, amount_paid_cents: inv.amount_paid, amount_remaining_cents: inv.amount_remaining,
    status: inv.status ?? "draft", hosted_invoice_url: inv.hosted_invoice_url, invoice_pdf: inv.invoice_pdf,
    due_date: iso(inv.due_date), stripe_created: iso(inv.created), updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_invoice_id" });
}

async function syncPaymentIntent(id: string, sessionId?: string) {
  const pi = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge", "invoice"] });
  const customer = typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;
  const client_id = await clientFor(customer, pi.metadata?.business, pi.receipt_email);
  const charge = pi.latest_charge as Stripe.Charge | null;
  const refunded = charge?.amount_refunded ?? 0;
  let status = "pending";
  if (pi.status === "succeeded") status = refunded >= pi.amount_received && refunded > 0 ? "refunded" : refunded > 0 ? "partially_refunded" : "succeeded";
  else if (pi.status === "canceled" || pi.status === "requires_payment_method") status = pi.last_payment_error ? "failed" : "pending";
  if (pi.status === "canceled") status = "failed";
  const invId = typeof pi.invoice === "string" ? pi.invoice : (pi.invoice as Stripe.Invoice | null)?.id;
  let invoice_id: string | null = null;
  if (invId) { await syncInvoice(invId); const { data } = await db.from("invoices").select("id").eq("stripe_invoice_id", invId).maybeSingle(); invoice_id = data?.id ?? null; }
  if (pi.status === "requires_payment_method" && !pi.last_payment_error) return; // not attempted yet
  await db.from("payments").upsert({
    stripe_payment_intent_id: pi.id, stripe_checkout_session_id: sessionId ?? null, client_id, invoice_id, source: "stripe",
    description: pi.description, amount_cents: pi.amount, refunded_cents: refunded, status,
    receipt_url: charge?.receipt_url ?? null, received_at: status === "succeeded" || status.includes("refund") ? iso(charge?.created) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_payment_intent_id" });
}

async function syncSubscription(id: string) {
  const s = await stripe.subscriptions.retrieve(id);
  const customer = typeof s.customer === "string" ? s.customer : s.customer.id;
  const client_id = await clientFor(customer, s.metadata?.business, null);
  const item = s.items.data.find((i) => i.price.recurring) ?? s.items.data[0];
  const kind = s.metadata?.kind || "other";
  // 12-month website plan: end automatically after the 12th monthly payment.
  if (kind === "website_installments" && !s.cancel_at && s.status !== "canceled") {
    const anchor = new Date(s.billing_cycle_anchor * 1000);
    anchor.setUTCMonth(anchor.getUTCMonth() + Number(s.metadata?.installments || 12) - 1);
    const cancelAt = Math.floor(anchor.getTime() / 1000) + 86400; // the day after the last payment
    await stripe.subscriptions.update(s.id, { cancel_at: cancelAt, proration_behavior: "none" });
    return syncSubscription(s.id);
  }
  await db.from("subscriptions").upsert({
    stripe_subscription_id: s.id, client_id, plan_key: s.metadata?.item || item?.price.lookup_key || "plan",
    kind: ["care", "marketing", "website_installments", "system"].includes(kind) ? kind : "other",
    status: s.status, billing_interval: item?.price.recurring?.interval ?? null, amount_cents: item?.price.unit_amount ?? null,
    current_period_end: iso(s.current_period_end), cancel_at: iso(s.cancel_at), cancel_at_period_end: s.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
}

async function syncSession(id: string, outcome?: "paid" | "failed" | "expired") {
  const cs = await stripe.checkout.sessions.retrieve(id);
  const customer = typeof cs.customer === "string" ? cs.customer : cs.customer?.id ?? null;
  const client_id = await clientFor(customer, cs.metadata?.business, cs.customer_details?.email ?? cs.customer_email);
  const status = outcome ?? (cs.payment_status === "paid" || cs.payment_status === "no_payment_required" ? "paid" : cs.status === "expired" ? "expired" : "pending");
  await db.from("checkout_orders").update({ status, client_id, updated_at: new Date().toISOString() }).eq("stripe_session_id", cs.id);
  if (typeof cs.payment_intent === "string") await syncPaymentIntent(cs.payment_intent, cs.id);
  if (typeof cs.subscription === "string") await syncSubscription(cs.subscription);
  if (typeof cs.invoice === "string") await syncInvoice(cs.invoice);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider()); }
  catch { return new Response("bad signature", { status: 400 }); }

  // duplicate delivery? Stripe retries; handle each event once.
  const { data: seen } = await db.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (seen?.processed_at) return new Response("already processed", { status: 200 });
  if (!seen) await db.from("stripe_events").insert({ id: event.id, type: event.type });

  const o = event.data.object as { id: string };
  try {
    switch (event.type) {
      case "checkout.session.completed": await syncSession(o.id); break;
      case "checkout.session.async_payment_succeeded": await syncSession(o.id, "paid"); break;
      case "checkout.session.async_payment_failed": await syncSession(o.id, "failed"); break;
      case "checkout.session.expired": await syncSession(o.id, "expired"); break;
      case "payment_intent.processing": case "payment_intent.succeeded": case "payment_intent.payment_failed": case "payment_intent.canceled":
        await syncPaymentIntent(o.id); break;
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        if (typeof ch.payment_intent === "string") await syncPaymentIntent(ch.payment_intent); break;
      }
      case "invoice.created": case "invoice.finalized": case "invoice.updated": case "invoice.paid": case "invoice.payment_failed":
      case "invoice.voided": case "invoice.marked_uncollectible": case "invoice.payment_action_required":
        await syncInvoice(o.id); break;
      case "customer.subscription.created": case "customer.subscription.updated": case "customer.subscription.deleted": case "customer.subscription.paused": case "customer.subscription.resumed":
        await syncSubscription(o.id); break;
      default: break;
    }
  } catch (err) {
    console.error("webhook handling failed", event.type, (err as Error).message); // no customer data in logs
    return new Response("retry", { status: 500 }); // Stripe retries; not marked processed
  }
  await db.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  return new Response("ok", { status: 200 });
});
