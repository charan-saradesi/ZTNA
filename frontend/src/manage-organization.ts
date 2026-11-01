// Supabase Edge Function: manage-organization
// Paste this into Edge Functions -> manage-organization -> index.ts
//
// Actions (all admin-only):
//   create : creates the organization row AND its password login
//   update : edits the row; if a password is given, sets/creates the login
//   delete : deletes the row AND its login
import { createClient } from "npm:@supabase/supabase-js@2";

// Must match ACCOUNT_DOMAIN in src/supabase.ts
const ACCOUNT_DOMAIN = Deno.env.get("ACCOUNT_DOMAIN") ?? "yourapp.com";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
const orgEmail = (name: string) => `${slug(name)}@org.${ACCOUNT_DOMAIN}`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        // 1) Only logged-in admins may call this
        const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
        const { data: caller, error: callerErr } = await admin.auth.getUser(token);
        if (callerErr || caller.user?.app_metadata?.role !== "admin") {
            return json({ error: "Admins only" }, 403);
        }

        const body = await req.json();
        const action = body.action as string;

        // ---------- CREATE ----------
        if (action === "create") {
            const name = slug(body.name ?? "");
            const password = (body.password ?? "") as string;
            if (!name) return json({ error: "Name is required" }, 400);
            if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

            const { data: created, error: userErr } = await admin.auth.admin.createUser({
                email: orgEmail(name),
                password,
                email_confirm: true,
                app_metadata: { role: "organization", org_name: name },
            });
            if (userErr) {
                const exists = /already|registered|exists/i.test(userErr.message);
                return json({ error: exists ? "An organization with this name already exists" : userErr.message }, 400);
            }

            const { error: dbErr } = await admin.from("organizations").insert({
                name,
                display_name: body.display_name || null,
                website_url: body.website_url || null,
                auth_user_id: created.user.id,
            });
            if (dbErr) {
                await admin.auth.admin.deleteUser(created.user.id); // roll back the login
                return json({ error: dbErr.code === "23505" ? "An organization with this name already exists" : dbErr.message }, 400);
            }
            return json({ ok: true });
        }

        // ---------- UPDATE ----------
        if (action === "update") {
            const { data: org, error: findErr } = await admin
                .from("organizations").select("name, auth_user_id").eq("id", body.id).single();
            if (findErr || !org) return json({ error: "Organization not found" }, 404);

            const password = (body.password ?? "") as string;
            let authUserId = org.auth_user_id as string | null;

            if (password) {
                if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

                if (authUserId) {
                    const { error } = await admin.auth.admin.updateUserById(authUserId, { password });
                    if (error) return json({ error: error.message }, 400);
                } else {
                    // organization had no login yet: create one now
                    const { data: created, error } = await admin.auth.admin.createUser({
                        email: orgEmail(org.name),
                        password,
                        email_confirm: true,
                        app_metadata: { role: "organization", org_name: org.name },
                    });
                    if (error) return json({ error: error.message }, 400);
                    authUserId = created.user.id;
                }
            }

            const { error: dbErr } = await admin.from("organizations").update({
                display_name: body.display_name || null,
                website_url: body.website_url || null,
                auth_user_id: authUserId,
            }).eq("id", body.id);
            if (dbErr) return json({ error: dbErr.message }, 400);
            return json({ ok: true });
        }

        // ---------- DELETE ----------
        if (action === "delete") {
            const { data: org } = await admin.from("organizations").select("auth_user_id").eq("id", body.id).single();
            if (org?.auth_user_id) await admin.auth.admin.deleteUser(org.auth_user_id);

            const { error } = await admin.from("organizations").delete().eq("id", body.id);
            if (error) return json({ error: error.message }, 400);
            return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
    } catch (e) {
        return json({ error: (e as Error).message }, 500);
    }
});
