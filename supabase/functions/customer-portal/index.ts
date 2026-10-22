// Signed-in client: open Stripe's billing portal for their own business (update card, see invoices and receipts).
import { asUser, clean, cors, json, SITE, stripe } from "../_shared/util.ts";

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
