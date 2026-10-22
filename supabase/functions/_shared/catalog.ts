// Server-side catalog. Amounts here are the only ones charged; the browser only sends the item and option ids.
// Prices are created in Stripe by scripts/stripe-setup.mjs using these lookup keys.
export type Option = { lookup: string; mode: "payment" | "subscription"; nowCents: number; upfrontLookup?: string; installments?: number; kind: string };
export type Item = { name: string; options: Record<string, Option>; planKey?: string };

export const CATALOG: Record<string, Item> = {
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
