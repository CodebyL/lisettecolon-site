# lisettecolon.com (business site)

Static site plus Supabase (client records) and Stripe (payments). Preview mode until `assets/js/config.js` is filled in.

- Edit pages in `src/`, then run `python3 build.py` (adds the shared header and footer).
- Database: `supabase/migrations/001_schema.sql`. Functions: `supabase/functions/*`.
- Stripe catalog (test key only): `STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs`.
- `.htaccess` holds redirects for Namecheap hosting at launch.
