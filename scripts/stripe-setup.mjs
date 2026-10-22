// Creates the Stripe products and prices used by online checkout. Safe to run more than once (uses lookup keys).
// Usage (TEST MODE KEY ONLY while building): STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
import Stripe from "stripe";
const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_") && process.env.ALLOW_LIVE !== "yes") { console.error("Refusing: use a test key (sk_test_...)."); process.exit(1); }
const stripe = new Stripe(key);
const P = [
  ["Starter website", [["lc_web_starter_deposit", 60000, null, "Deposit (50%)"], ["lc_web_starter_upfront", 30000, null, "12-month plan: start payment"], ["lc_web_starter_monthly", 8500, "month", "12-month plan: monthly payment"]]],
  ["Standard website", [["lc_web_standard_deposit", 125000, null, "Deposit (50%)"], ["lc_web_standard_upfront", 62500, null, "12-month plan: start payment"], ["lc_web_standard_monthly", 17500, "month", "12-month plan: monthly payment"]]],
  ["Premium website", [["lc_web_premium_deposit", 190000, null, "Deposit (50%)"], ["lc_web_premium_upfront", 95000, null, "12-month plan: start payment"], ["lc_web_premium_monthly", 27000, "month", "12-month plan: monthly payment"]]],
  ["Photo session", [["lc_photo_deposit", 15000, null, "Deposit"]]],
  ["Drone photos and video", [["lc_drone_deposit", 20000, null, "Deposit"]]],
  ["Logo refresh", [["lc_logo_deposit", 20000, null, "Deposit (50%)"]]],
  ["Google Business Profile setup", [["lc_gbp", 25000, null, "Paid in full"]]],
  ["Local Search Setup", [["lc_local_search", 45000, null, "Paid in full"]]],
  ["Extra update hour", [["lc_update_hour", 8500, null, "One hour"]]],
  ["Local Visibility plan", [["lc_local_visibility_monthly", 15000, "month", "Monthly"]]],
  ["Hosting plan", [["lc_care_hosting_monthly", 3500, "month", "Monthly"], ["lc_care_hosting_yearly", 35000, "year", "Yearly"]]],
  ["Care plan", [["lc_care_care_monthly", 10000, "month", "Monthly"], ["lc_care_care_yearly", 100000, "year", "Yearly"]]],
  ["Care Plus plan", [["lc_care_plus_monthly", 20000, "month", "Monthly"], ["lc_care_plus_yearly", 200000, "year", "Yearly"]]],
];
for (const [name, prices] of P) {
  const found = await stripe.products.search({ query: `name:'${name}' AND active:'true'` });
  const product = found.data[0] || await stripe.products.create({ name });
  for (const [lookup, amount, interval, nickname] of prices) {
    const ex = await stripe.prices.list({ lookup_keys: [lookup], active: true });
    if (ex.data[0]?.unit_amount === amount) { console.log("ok", lookup); continue; }
    await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: amount, nickname, lookup_key: lookup, transfer_lookup_key: true,
      ...(interval ? { recurring: { interval } } : {}) });
    console.log("created", lookup);
  }
}
