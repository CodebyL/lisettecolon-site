-- Lisette Colon client records. Run once in a new Supabase project (SQL editor or `supabase db push`).
-- Stripe is the source of truth for money; these tables mirror it from verified webhook events.
-- Google Calendar (hi@lisettecolon.com) is the source of truth for consultation times.

create extension if not exists pgcrypto;

-- ---------- people and clients ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  billing_email text,
  phone text,
  address text,
  website text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create table public.client_members (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- ---------- work ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  service text not null,
  status text not null default 'proposal' check (status in ('proposal','waiting_on_deposit','kickoff','waiting_on_content','in_progress','in_review','launching','live','on_hold','closed')),
  total_cents integer check (total_cents >= 0),
  start_date date,
  target_date date,
  client_note text,            -- visible to the client
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.project_internal_notes (   -- admin only, never visible to clients
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null check (kind in ('proposal','agreement','receipt','other')),
  title text not null,
  storage_path text not null,   -- '<client_id>/<file name>' in the private 'client-docs' bucket
  status text not null default 'shared' check (status in ('draft','shared','signed','void')),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  inquiry_id uuid,
  starts_at timestamptz not null,
  format text not null check (format in ('in_person','video','phone')),
  location text,
  status text not null default 'confirmed' check (status in ('requested','confirmed','rescheduled','cancelled','completed','no_show')),
  calendar_event_id text,
  created_at timestamptz not null default now()
);

-- ---------- money (mirrors Stripe; offline payments recorded by admin) ----------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  stripe_invoice_id text unique,
  number text,
  description text,
  kind text not null default 'other' check (kind in ('deposit','balance','installment','plan','other')),
  amount_due_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  amount_remaining_cents integer not null default 0,
  status text not null check (status in ('draft','open','paid','void','uncollectible')),
  hosted_invoice_url text,
  invoice_pdf text,
  due_date timestamptz,
  stripe_created timestamptz,
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  source text not null check (source in ('stripe','zelle','cash','check')),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  description text,
  amount_cents integer not null check (amount_cents > 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  status text not null check (status in ('pending','succeeded','failed','refunded','partially_refunded','voided')),
  receipt_url text,
  received_at timestamptz,
  recorded_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_audit (    -- every change to a payment, for a clear history
  id bigint generated always as identity primary key,
  payment_id uuid not null,
  action text not null,
  actor uuid,
  old_row jsonb,
  new_row jsonb,
  at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  stripe_subscription_id text unique not null,
  plan_key text not null,
  kind text not null check (kind in ('care','marketing','website_installments','system','other')),
  status text not null,
  billing_interval text,
  amount_cents integer,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.checkout_orders (   -- one row per Checkout Session; status only from webhooks
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  item text not null,
  option text not null,
  business text,
  email text,
  client_id uuid references public.clients(id) on delete set null,
  amount_due_now_cents integer not null,
  status text not null default 'open' check (status in ('open','pending','paid','failed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stripe_events (     -- idempotency: each Stripe event is handled once
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------- inbound ----------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('consultation','quote','inquiry')),
  name text not null, business text, email text not null, phone text, website text, location text,
  service text, format text, availability text, message text not null, page text,
  status text not null default 'new' check (status in ('new','contacted','booked','closed','spam')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','done')),
  created_at timestamptz not null default now()
);

create index on public.projects(client_id);
create index on public.invoices(client_id);
create index on public.payments(client_id);
create index on public.subscriptions(client_id);
create index on public.documents(client_id);
create index on public.support_requests(client_id);
create index on public.inquiries(created_at desc);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_members where client_id = cid and user_id = auth.uid())
$$;

-- new auth user -> profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- clients can never make themselves admin
create or replace function public.protect_admin_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null and coalesce(auth.role(),'') <> 'service_role' and not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create trigger profiles_protect_admin before update on public.profiles for each row execute function public.protect_admin_flag();

-- payment history
create or replace function public.audit_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_audit (payment_id, action, actor, old_row, new_row)
  values (coalesce(new.id, old.id), tg_op, auth.uid(), case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger payments_audit after insert or update or delete on public.payments for each row execute function public.audit_payment();

-- clients may update only their own contact details, through this function
create or replace function public.update_my_contact(cid uuid, p_phone text, p_address text, p_website text, p_billing_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(cid) then raise exception 'not allowed'; end if;
  update public.clients set
    phone = left(p_phone, 40), address = left(p_address, 300), website = left(p_website, 300),
    billing_email = left(p_billing_email, 200)
  where id = cid;
end $$;

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_internal_notes enable row level security;
alter table public.documents enable row level security;
alter table public.bookings enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_audit enable row level security;
alter table public.subscriptions enable row level security;
alter table public.checkout_orders enable row level security;
alter table public.stripe_events enable row level security;
alter table public.inquiries enable row level security;
alter table public.support_requests enable row level security;

-- profiles: you see and edit yourself; admin sees all
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- client-owned records: members read their own client's rows; only admin writes
create policy clients_read on public.clients for select using (public.is_member(id) or public.is_admin());
create policy clients_admin on public.clients for all using (public.is_admin()) with check (public.is_admin());
create policy members_read on public.client_members for select using (user_id = auth.uid() or public.is_admin());
create policy members_admin on public.client_members for all using (public.is_admin()) with check (public.is_admin());

create policy projects_read on public.projects for select using (public.is_member(client_id) or public.is_admin());
create policy projects_admin on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy notes_admin on public.project_internal_notes for all using (public.is_admin()) with check (public.is_admin());

create policy documents_read on public.documents for select using ((public.is_member(client_id) and status <> 'draft') or public.is_admin());
create policy documents_admin on public.documents for all using (public.is_admin()) with check (public.is_admin());

create policy bookings_read on public.bookings for select using ((client_id is not null and public.is_member(client_id)) or public.is_admin());
create policy bookings_admin on public.bookings for all using (public.is_admin()) with check (public.is_admin());

create policy invoices_read on public.invoices for select using ((public.is_member(client_id) and status <> 'draft') or public.is_admin());
create policy invoices_admin on public.invoices for all using (public.is_admin()) with check (public.is_admin());

create policy payments_read on public.payments for select using ((client_id is not null and public.is_member(client_id)) or public.is_admin());
create policy payments_admin_insert on public.payments for insert with check (public.is_admin() and source in ('zelle','cash','check') and recorded_by = auth.uid());
create policy payments_admin_update on public.payments for update using (public.is_admin()) with check (public.is_admin());
-- no delete policy: payments are corrected by status ('voided'), never deleted
create policy audit_admin on public.payment_audit for select using (public.is_admin());

create policy subs_read on public.subscriptions for select using ((client_id is not null and public.is_member(client_id)) or public.is_admin());
create policy subs_admin on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

create policy orders_admin on public.checkout_orders for select using (public.is_admin());
create policy inquiries_admin on public.inquiries for all using (public.is_admin()) with check (public.is_admin());
-- stripe_events: no policies -> only the service role (webhook) can touch it

create policy support_member_insert on public.support_requests for insert with check (public.is_member(client_id) and user_id = auth.uid());
create policy support_read on public.support_requests for select using (public.is_member(client_id) or public.is_admin());
create policy support_admin on public.support_requests for update using (public.is_admin()) with check (public.is_admin());

-- ---------- private document storage ----------
insert into storage.buckets (id, name, public) values ('client-docs', 'client-docs', false) on conflict do nothing;
create policy docs_member_read on storage.objects for select
  using (bucket_id = 'client-docs' and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));
create policy docs_admin_write on storage.objects for insert with check (bucket_id = 'client-docs' and public.is_admin());
create policy docs_admin_update on storage.objects for update using (bucket_id = 'client-docs' and public.is_admin());
create policy docs_admin_delete on storage.objects for delete using (bucket_id = 'client-docs' and public.is_admin());

-- After your own account exists, make it the admin (run once, with your email):
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'hi@lisettecolon.com');
