// Admin only: create or reuse a client and invite a person to its account by email.
import { admin, asUser, clean, cors, isEmail, json, SITE } from "../_shared/util.ts";

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
