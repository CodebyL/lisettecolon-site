// Public: start a Stripe Checkout for a fixed-price item. The amount comes from the server catalog, never from the browser.
import { CATALOG } from "../_shared/catalog.ts";
import { admin, clean, cors, isEmail, json, SITE, stripe } from "../_shared/util.ts";

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
