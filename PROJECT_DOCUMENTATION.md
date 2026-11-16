# Casdoor-Style Multi-Role Portal: Full Project Documentation

A React + TypeScript web app with a single login page and three kinds of accounts, each with its own dashboard:

| Role | Signs in with | Authenticated by | Lands on |
|---|---|---|---|
| **User** (employee) | Username + password | **Clerk** | `/dashboard` |
| **Admin** | Admin name (or full email) + password | **Supabase Auth** | `/admin/dashboard` |
| **Organization** | Organization name + password | **Supabase Auth** | `/organization/dashboard` |

Data (organizations, groups, users) is stored in **Supabase** (Postgres). Privileged operations (creating logins) run in two **Supabase Edge Functions**, so no secret key ever reaches the browser.

> **Status:** this document describes the project as built in the conversation. Parts marked *Sample* or *Not built yet* are placeholders (see [Section 17](#17-whats-built-vs-whats-placeholder)).

---

## Table of contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Tech stack and dependencies](#2-tech-stack-and-dependencies)
3. [Folder and file structure](#3-folder-and-file-structure)
4. [Environment variables](#4-environment-variables)
5. [How login works](#5-how-login-works)
6. [Routes and route protection](#6-routes-and-route-protection)
7. [Clerk setup](#7-clerk-setup)
8. [Supabase setup: tables and policies](#8-supabase-setup-tables-and-policies)
9. [Supabase Edge Functions](#9-supabase-edge-functions)
10. [Creating the first admin](#10-creating-the-first-admin)
11. [Every source file explained](#11-every-source-file-explained)
12. [End-to-end flows](#12-end-to-end-flows)
13. [Security model](#13-security-model)
14. [Setup from scratch (checklist)](#14-setup-from-scratch-checklist)
15. [Testing checklist](#15-testing-checklist)
16. [Troubleshooting: every problem we hit and the fix](#16-troubleshooting-every-problem-we-hit-and-the-fix)
17. [What's built vs what's placeholder](#17-whats-built-vs-whats-placeholder)
18. [Next steps and ideas](#18-next-steps-and-ideas)
19. [Glossary](#19-glossary)
20. [Appendix A: Complete database schema and policies (SQL)](#appendix-a-complete-database-schema-and-policies-sql)
21. [Appendix B: Edge Function `manage-organization` (full code)](#appendix-b-edge-function-manage-organization-full-code)
22. [Appendix C: Edge Function `manage-user` (full code)](#appendix-c-edge-function-manage-user-full-code)
23. [Appendix D: Policy and schema reference, and how to verify](#appendix-d-policy-and-schema-reference-and-how-to-verify)

---

## 1. Architecture at a glance

```
                    ┌────────────────────────────────────────────┐
                    │          Browser (React + Vite)            │
                    │   /login  /dashboard  /admin  /organization│
                    └───────┬───────────────────────┬────────────┘
                            │                       │
              User tab      │                       │  Admin / Organization tabs
        (username+password) │                       │  (name+password → internal email)
                            ▼                       ▼
                     ┌────────────┐          ┌──────────────┐
                     │   Clerk    │          │ Supabase Auth│
                     │ (users)    │          │ (admin, orgs)│
                     └─────▲──────┘          └──────┬───────┘
                           │                        │ JWT with app_metadata.role
          Backend API      │                        ▼
          (secret key)     │                 ┌──────────────┐
                     ┌─────┴──────┐          │ Supabase DB  │
                     │ Edge Func  │─────────▶│ organizations│
                     │ manage-user│          │ groups       │
                     └────────────┘          │ org_users    │
                     ┌────────────┐          └──────────────┘
                     │ Edge Func  │──────────▶ (also creates Supabase Auth
                     │ manage-    │             logins for organizations)
                     │ organization│
                     └────────────┘
```

**Key idea:** two separate identity systems.

- **Clerk** authenticates the employees (the "User" tab).
- **Supabase Auth** authenticates admins and organizations.
- The two sessions are independent. Signing out of one does not sign out of the other.

The **Edge Functions** run on Supabase's servers with powerful keys (service-role key, Clerk secret key). The browser only ever calls them with the logged-in admin's or organization's own token.

---

## 2. Tech stack and dependencies

| Area | Choice |
|---|---|
| Build tool | Vite 8 |
| UI | React 19 + TypeScript 6 |
| Routing | `react-router-dom` 7 |
| User auth | `@clerk/react` 6 |
| Admin / org auth + database | Supabase (`@supabase/supabase-js`) |
| Icons | `lucide-react` |
| Charts | `recharts` (admin dashboard sample chart) |
| Styling | Plain CSS files plus one inline `<style>` block in `Login.tsx` (no Tailwind) |
| Server code | Supabase Edge Functions (Deno + TypeScript) |

`package.json` already contains everything except Supabase. Add it:

```bash
npm install @supabase/supabase-js
```

Commands:

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:5173
npm run build      # type-check (tsc -b) and build for production
npm run lint       # run ESLint
npm run preview    # preview the production build
```

> Vite's default port is **5173**. (The original Casdoor screenshot you based the design on ran on port 8000.)

---

## 3. Folder and file structure

```
frontend/
├── .env                          ← your real keys (never commit)
├── .env.example                  ← template
├── package.json
├── index.html                    ← must load /src/main.tsx
└── src/
    ├── main.tsx                  ← app entry, ClerkProvider, all routes
    ├── Login.tsx                 ← the login page (3 tabs)
    ├── supabase.ts               ← Supabase client + name→email helper
    ├── guards.tsx                ← route protection (RequireUser, RequireRole)
    │
    ├── UserDashboard.tsx         ← employee portal (Clerk users)
    ├── userdash.css              ← styles for the employee portal
    │
    ├── dash.css                  ← shared dashboard styles (cards, tables)
    ├── admin.css                 ← sidebar, top bar, tables, modals, buttons
    │
    ├── AdminLayout.tsx           ← admin sidebar + top bar
    ├── AdminDashboard.tsx        ← admin home (sample stats + chart)
    ├── OrganizationsPage.tsx     ← admin: manage organizations
    ├── ComingSoon.tsx            ← placeholder page for unbuilt menu items
    │
    └── organization/             ← everything for the Organization role
        ├── OrgLayout.tsx         ← organization menu (limited)
        ├── PanelLayout.tsx       ← sidebar + top bar component (own copy)
        ├── OrganizationDashboard.tsx
        ├── GroupsPage.tsx        ← manage groups
        └── UsersPage.tsx         ← manage users + assign to groups
```

Outside `src/`, in Supabase:

```
Supabase project
├── Tables:  organizations, groups, org_users
├── Auth:    admin and organization accounts (users)
├── Edge Functions:  manage-organization, manage-user
└── Edge Function secrets:  CLERK_SECRET_KEY (plus optional ACCOUNT_DOMAIN)
```

> **Note on `PanelLayout`:** the organization folder has its own copy so that the working admin files were never modified. Depending on which version of `AdminLayout.tsx` you have, the admin either contains its own sidebar or imports a shared `PanelLayout` from `src/`. Both work. Keep each import path pointing at a file that exists.

---

## 4. Environment variables

Create `.env` in the project root (next to `package.json`, **not** inside `src/`):

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...    # or the legacy "anon" key (eyJ...)
```

| Variable | Where to find it |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → **API keys** → Publishable key (`pk_test_...`) |
| `VITE_SUPABASE_URL` | `https://<Project ID>.supabase.co` (Project ID is under Supabase → Project Settings → General) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → **API Keys** → *Publishable key* (`sb_publishable_...`) or legacy `anon` key |

Rules:

- Only variables starting with `VITE_` are exposed to the browser. That is why **secret keys must never use that prefix**.
- Restart `npm run dev` after editing `.env`. Vite reads it only at startup.
- `main.tsx` throws "Missing VITE_CLERK_PUBLISHABLE_KEY" and `supabase.ts` throws "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY" if a value is missing. A blank page right after setup usually means this.

**Never put these in `.env` or in code:**

| Secret | Why |
|---|---|
| Supabase **secret key** (`sb_secret_...`) / legacy **service_role** key | Bypasses all database security |
| Clerk **secret key** (`sk_test_...`) | Lets anyone create, change or delete your users |

The Clerk secret key lives only in the Supabase Edge Function secrets (Section 9).

---

## 5. How login works

All three tabs are in `Login.tsx`. The same two fields (name + password) are shown, but the tab decides where the request goes.

### User tab → Clerk

1. User enters **username** and **password**.
2. `signIn.password({ identifier: name, password })` is called (Clerk's custom-flow API).
3. If `signIn.status === "complete"`, `signIn.finalize()` creates the session and redirects to `/dashboard`.
4. If the status is `needs_client_trust` (Device Trust), the page shows "Sign-in needs another step". Turn **Device Trust** off in Clerk (see Section 7).
5. If Clerk already has an active session (`isSignedIn`), the page skips straight to `/dashboard` (Clerk refuses a second sign-in).

### Admin and Organization tabs → Supabase Auth

Supabase Auth only supports **email + password**, but the form asks for a **name**. So `supabase.ts` converts the name to an internal email:

```ts
export const ACCOUNT_DOMAIN = "yourapp.com";

export const nameToEmail = (role: "admin" | "organization", name: string) => {
    const value = name.trim().toLowerCase();
    if (value.includes("@")) return value;          // full email typed → use as is
    const slug = value.replace(/\s+/g, "-");
    return `${slug}@${role === "admin" ? "admin" : "org"}.${ACCOUNT_DOMAIN}`;
};
```

| Tab | You type | Email sent to Supabase |
|---|---|---|
| Admin | `john` | `john@admin.yourapp.com` |
| Admin | `new.admin@mail.com` | `new.admin@mail.com` (used as typed) |
| Organization | `acme` | `acme@org.yourapp.com` |

After `signInWithPassword` succeeds, the page checks `user.app_metadata.role`:

- must equal `"admin"` on the Admin tab, or `"organization"` on the Organization tab;
- otherwise it signs the user out again and shows "This account is not an {role} account".

Then it navigates to `/admin` or `/organization`.

> `ACCOUNT_DOMAIN` must be identical in `src/supabase.ts` and in the `manage-organization` Edge Function (default there is also `yourapp.com`). It does not need to be a real domain; no email is ever sent to it.

---

## 6. Routes and route protection

Defined in `main.tsx`:

| Path | Page | Protected by |
|---|---|---|
| `/login` | `Login` | public |
| `/dashboard` | `UserDashboard` | `RequireUser` (Clerk session) |
| `/admin` → `/admin/dashboard` | `AdminLayout` + `AdminDashboard` | `RequireRole role="admin"` |
| `/admin/organizations` | `OrganizationsPage` | same |
| `/admin/*` (anything else) | `ComingSoon` | same |
| `/organization` → `/organization/dashboard` | `OrgLayout` + `OrganizationDashboard` | `RequireRole role="organization"` |
| `/organization/groups` | `GroupsPage` | same |
| `/organization/users` | `UsersPage` | same |
| `/organization/*` (anything else) | `ComingSoon` | same |
| `*` | redirect to `/login` | none |

`guards.tsx`:

- **`RequireUser`**: uses Clerk's `useAuth()`. Shows "Loading…" until Clerk is ready, then renders the page if signed in, otherwise redirects to `/login`.
- **`RequireRole`**: calls `supabase.auth.getSession()` and checks `app_metadata.role`. An organization cannot open `/admin`, an admin cannot open `/organization`, and a Clerk user cannot open either.

`ClerkProvider` is configured so Clerk never sends people to its own hosted pages:

```tsx
<ClerkProvider
  publishableKey={PUBLISHABLE_KEY}
  signInUrl="/login"
  signUpUrl="/login"
  signInFallbackRedirectUrl="/dashboard"
  signUpFallbackRedirectUrl="/dashboard"
  afterSignOutUrl="/login"
>
```

> Route guards are a convenience for the UI. **Real security is enforced by the database policies and the Edge Functions** (Section 13).

---

## 7. Clerk setup

Clerk is used **only** for the User tab.

### Settings to configure (Clerk dashboard → Configure)

| Setting | Value | Why |
|---|---|---|
| Username | **On** | users sign in with a username |
| Password | **On** | password sign-in |
| Email address | **Optional** (not required) | the Add User form does not force an email |
| **Device Trust** (formerly *Client Trust*; look on the **Protections** page, or search the dashboard) | **Off** | otherwise a password sign-in from a new device returns `needs_client_trust` and users without a verified email can't finish |
| Bot protection | leave default | custom sign-in flows need `<div id="clerk-captcha" />` on the page (already in `Login.tsx`) |

### Keys

- **Publishable key** → frontend `.env` as `VITE_CLERK_PUBLISHABLE_KEY`.
- **Secret key** (`sk_test_...`) → **only** in Supabase → Edge Functions → Secrets as `CLERK_SECRET_KEY`.
- Both keys must come from the **same Clerk application**.

### Notes

- The Clerk dashboard may suggest `npx clerk init --framework next`. **Do not run it** for this project: it is Vite + React, and `main.tsx` already contains the provider and routes.
- Users are created by the `manage-user` Edge Function through Clerk's Backend API, with `public_metadata` set to `{ "org_name": "...", "group_name": "..." }`. The employee dashboard reads these to show the organization badge and group.
- Users created by hand in the Clerk dashboard are **not** listed on the organization's Users page (only users created through the app are).
- Password rules: Clerk rejects weak or leaked passwords (e.g. "Password123"). The app requires at least 8 characters for users.

---

## 8. Supabase setup: tables and policies

> **If the SQL Editor says `42501 permission denied` or `must be owner of table`:** the editor is running as a role without ownership. Create tables and policies from the dashboard instead (**Table Editor → New table**, **Authentication → Policies**). Never run `GRANT ... TO authenticated` on `auth.users`; that is a security hole.

> The complete, copy-paste SQL for every table and policy is in [Appendix A](#appendix-a-complete-database-schema-and-policies-sql).

### 8.1 `organizations`

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | no | primary key |
| `name` | text | none | no | **unique**; also the organization's login name |
| `display_name` | text | none | yes | |
| `website_url` | text | none | yes | |
| `created_at` | timestamptz | `now()` | no | |
| `auth_user_id` | uuid | **none (NULL)** | yes | the Supabase Auth user for this organization's login |

> ⚠️ `auth_user_id` must **not** have `gen_random_uuid()` as its default. That would fill it with fake IDs and make every organization look like it has a login.

Policy (RLS on):

| Name | Command | Role | Expression |
|---|---|---|---|
| admins manage organizations | ALL | authenticated | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` (USING and WITH CHECK) |

SQL version (`organizations.sql` + `add_login_column.sql`):

```sql
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  display_name  text,
  website_url   text,
  created_at    timestamptz not null default now()
);
alter table public.organizations enable row level security;

drop policy if exists "admins manage organizations" on public.organizations;
create policy "admins manage organizations"
  on public.organizations for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.organizations (name, display_name, website_url)
values ('built-in', 'Built-in Organization', 'https://example.com')
on conflict (name) do nothing;

alter table public.organizations add column if not exists auth_user_id uuid;
```

### 8.2 `groups`

| Column | Type | Default | Nullable |
|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | no (primary key) |
| `org_name` | text | none | no |
| `name` | text | none | no |
| `display_name` | text | none | yes |
| `created_at` | timestamptz | `now()` | no |

In `groups.sql`, `org_name` also references `organizations(name)` with `on delete cascade`, and `(org_name, name)` is unique. If you created the table through the Table Editor you may not have these two constraints. The app still works, but duplicate group names within one organization would not be blocked by the database.

Policies (RLS on):

| Name | Command | Role | Expression |
|---|---|---|---|
| org manages own groups | ALL | authenticated | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'organization' and org_name = (auth.jwt() -> 'app_metadata' ->> 'org_name')` (USING and WITH CHECK) |
| admins read groups | SELECT | authenticated | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` |

### 8.3 `org_users`

Links a Clerk user to an organization and a group. The password and login live in Clerk; this table holds the relationship.

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | no | primary key |
| `clerk_user_id` | text | none | no | **unique** |
| `org_name` | text | none | no | |
| `group_id` | uuid | none (NULL) | yes | the assigned group |
| `username` | text | none | no | |
| `first_name` | text | none | yes | |
| `last_name` | text | none | yes | |
| `email` | text | none | yes | |
| `created_at` | timestamptz | `now()` | no | |

Policies (RLS on), **SELECT only**:

| Name | Command | Role | Expression |
|---|---|---|---|
| org reads own users | SELECT | authenticated | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'organization' and org_name = (auth.jwt() -> 'app_metadata' ->> 'org_name')` |
| admins read users | SELECT | authenticated | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` |

There are **no insert, update or delete policies on purpose**. All writes go through the `manage-user` Edge Function (which uses the service-role key and bypasses RLS), because creating a user must also create the Clerk login.

### 8.4 How the policies identify who you are

Supabase puts the logged-in user's `app_metadata` inside their JWT. `auth.jwt() -> 'app_metadata' ->> 'role'` reads it inside SQL.

`app_metadata` can only be written with the service-role key (never from the browser), so users cannot give themselves the admin role. This is why the project stores `role` and `org_name` in `app_metadata`, not `user_metadata`.

### 8.5 Schema cache

If the app says `Could not find the table 'public.xxx' in the schema cache`, the table either does not exist or the API cache is stale. Check **Table Editor**, then click **Reload schema** under **Project Settings → API** and refresh the app.

---

## 9. Supabase Edge Functions

Both functions:

- are created under **Edge Functions → Deploy a new function → Via Editor**;
- must have the **exact names** `manage-organization` and `manage-user`;
- have **Verify JWT turned off** in their settings (they check the caller's role themselves; leaving it on can cause a false "Invalid JWT" or 401 with the new API-key format);
- return CORS headers (`Access-Control-Allow-Origin: *`) so the browser can call them.

Secrets:

| Secret | Provided by |
|---|---|
| `SUPABASE_URL` | built in |
| `SUPABASE_SERVICE_ROLE_KEY` | built in |
| `CLERK_SECRET_KEY` | **you add it** (Edge Functions → Secrets) |
| `ACCOUNT_DOMAIN` | optional; defaults to `yourapp.com`; must match `supabase.ts` |

Check a function is live (should print `HTTP/2 200` and `ok`):

```bash
curl -i -X OPTIONS "https://<project-id>.supabase.co/functions/v1/manage-organization" \
  -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"
```

> The full source code of both functions is in [Appendix B](#appendix-b-edge-function-manage-organization-full-code) and [Appendix C](#appendix-c-edge-function-manage-user-full-code).

### 9.1 `manage-organization` (admin only)

**Who can call:** only a logged-in account whose `app_metadata.role` is `admin`. Everyone else gets `403 Admins only`.

**Request body** (sent by `OrganizationsPage.tsx` using `supabase.functions.invoke`):

| `action` | Fields | What it does |
|---|---|---|
| `create` | `name`, `password`, `display_name`, `website_url` | Creates a Supabase Auth user `<name>@org.<ACCOUNT_DOMAIN>` with `app_metadata = { role: "organization", org_name: <name> }`, then inserts the `organizations` row with `auth_user_id`. If the row insert fails, it deletes the just-created login (rollback). Password must be 6+ characters. |
| `update` | `id`, `display_name`, `website_url`, optional `password` | Updates the row. If a password is given, it sets the existing login's password, or **creates a login** if the organization had none (this is how the pre-existing `built-in` row gets a login). |
| `delete` | `id` | Deletes the organization's login (if any) and the row. |

The organization **name cannot be changed** after creation, because it is the login name.

### 9.2 `manage-user` (organization or admin)

**Who can call:**

- an **organization** account: acts only on **its own** users, using `org_name` from its token;
- an **admin** account: can act on any organization (must send `org_name` when creating; no admin UI for this exists yet).
- anyone else: `403 Not allowed`.

**Request body** (sent by `UsersPage.tsx`):

| `action` | Fields | What it does |
|---|---|---|
| `create` | `username`, `password` (8+), `first_name`, `last_name`, `email` (optional), `group_id` (optional) | Verifies the group belongs to the same organization. Creates the user in **Clerk** through the Backend API with `public_metadata = { org_name, group_name }`. Inserts the `org_users` row. If the insert fails, deletes the Clerk user (rollback). |
| `update` | `id`, `first_name`, `last_name`, `group_id`, optional `password` | Updates the Clerk user (names, optional password, refreshed `public_metadata`) and the `org_users` row. Username cannot be changed. |
| `delete` | `id` | Deletes the Clerk user and the `org_users` row. |

It calls `https://api.clerk.com/v1/users...` with `Authorization: Bearer <CLERK_SECRET_KEY>`. Clerk error messages (e.g. "That username is taken", "Password has been found in an online data breach") are passed back and shown in the form.

Group assignments are double-checked on the server: a group id from a different organization is rejected with "That group doesn't belong to this organization".

---

## 10. Creating the first admin

There is **no signup page** for admins. Create one in Supabase:

1. **Authentication → Users → Add user → Create new user.**
   - Email: for example `new.admin@mail.com` (or `john@admin.yourapp.com` to log in with just `john`).
   - Password: your choice.
   - Tick **Auto Confirm User**.
2. Give the user the admin role (`app_metadata.role = "admin"`).

**Option A: SQL** (needs ownership of `auth.users`; may fail with `42501`):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'new.admin@mail.com';
```

**Option B: Auth Admin API from your own terminal** (works when SQL is blocked; also resets the password and confirms the email in one call):

```bash
export SUPA_URL="https://<project-id>.supabase.co"
export SUPA_SECRET="sb_secret_...your secret key..."

curl -X PUT "$SUPA_URL/auth/v1/admin/users/<USER_ID>" \
  -H "apikey: $SUPA_SECRET" \
  -H "Authorization: Bearer $SUPA_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"password":"<NEW_PASSWORD>","email_confirm":true,"app_metadata":{"role":"admin"}}'

unset SUPA_SECRET     # clear it afterwards
```

`<USER_ID>` is the user's id in Authentication → Users. Run this only in your own terminal, never paste the secret key into a chat or a file.

3. **Sign out and sign in again** after changing the role. The role is read from the JWT, so an old session will not have it.
4. Log in on the **Admin** tab with the email you used (or just the name if you used the `@admin.<ACCOUNT_DOMAIN>` pattern).

> Change any test passwords (such as `Admin@12345` / `Acme@12345` used while building) to private ones before real use.

---

## 11. Every source file explained

### `src/main.tsx`
App entry. Wraps everything in `ClerkProvider` and `BrowserRouter`, then declares all routes (Section 6). Throws a clear error if `VITE_CLERK_PUBLISHABLE_KEY` is missing.

### `src/Login.tsx`
The login page. Contains the role tabs (User / Admin / Organization), username/organization-name field, password field with show/hide eye, error line, dark/light theme toggle, and its own inline `<style>`.

- State: `role`, `name`, `password`, `showPw`, `error`, `loading`, `dark`.
- `clerkLogin()` handles the User tab (Section 5).
- `supabaseLogin()` handles Admin and Organization.
- `onSubmit()` picks the right one by tab.
- The "sign up now" link shows on the User tab only and points to `/signup`, which **does not exist yet**.
- Includes `<div id="clerk-captcha" />` for Clerk's bot protection.
- Shows Supabase's real error message (e.g. "Invalid login credentials", "Email not confirmed").

### `src/supabase.ts`
Creates the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, exports `ACCOUNT_DOMAIN` and `nameToEmail()` (Section 5).

### `src/guards.tsx`
`RequireUser` (Clerk) and `RequireRole` (Supabase role check). Both show a "Loading…" screen while checking.

### `src/UserDashboard.tsx` + `src/userdash.css`
The employee portal for Clerk users:

- **Header:** logo, organization badge (from Clerk `publicMetadata.org_name`), user menu with *Change password* and *Sign out*.
- **Welcome banner:** time-based greeting, date, live clock (updates every 30 s), chips for organization and group.
- **My apps** (*Sample*): tiles for Mail, Files, Chat, Calendar, Payslips, IT Support, Handbook, Help Desk.
- **Announcements** (*Sample*).
- **My profile:** name, username, organization, group, email, last sign-in, member since.
- **Change password:** calls Clerk's `user.updatePassword({ currentPassword, newPassword })`.

### `src/dash.css`
Shared dashboard styles: `.dash`, cards, stat numbers, grid, small tables.

### `src/admin.css`
Styles for the sidebar (`.adm-side`, groups, links), top bar, user menu, page header, search box, buttons (`.btn`, `.primary`, `.sm`, `.danger`), tables (`.tbl`), modals, form fields (`.mf`), spinner. Used by both admin and organization panels.

### `src/AdminLayout.tsx`
Admin sidebar menu and top bar (breadcrumb, Admin avatar menu with Sign out). Menu groups mirror the Casdoor design: **Home** (Dashboard, Shortcuts, Apps), **User Management** (Organizations, Groups, Users, Invitations), **Identity**, **Authorization**, **LLM AI**, **Auditing**, **Business**, **Admin**. The menu is a `MENU` array at the top of the file; edit it to change items. Pages render in an `<Outlet />`.

### `src/AdminDashboard.tsx`
Admin home: three stat cards (Total users, Organizations, Active sessions) and a "New users this week" bar chart (recharts). **All figures are sample data.**

### `src/OrganizationsPage.tsx`
Admin page for organizations:

- Table: Name, Created time, Display name, Website URL, **Login** (Enabled / No login), Actions.
- Search, refresh, pagination (10 per page).
- **Add** and **Edit** open a modal (Name, Password, Display name, Website URL). On Edit the name is locked and the password is optional.
- **Delete** asks for confirmation and removes both the row and its login.
- Reads the table directly (allowed by the admin policy); writes go through `manage-organization`.

### `src/ComingSoon.tsx`
Generic "This page isn't built yet" page, titled from the URL. Used for every menu item that has no real page.

### `src/organization/OrgLayout.tsx`
The Organization role's limited menu: **Home** (Dashboard), **User Management** (Users, Groups, Invitations), **Settings** (Profile). Edit its `MENU` array to change what organizations see.

### `src/organization/PanelLayout.tsx`
The reusable sidebar + top bar component (collapsible groups, active link highlight, sidebar toggle, breadcrumb, avatar menu with Sign out). Shows the organization name from `app_metadata.org_name` in the user menu.

### `src/organization/OrganizationDashboard.tsx`
Welcome page for the organization: name card, a Users card (currently `0`, *Sample*), and a status card.

### `src/organization/GroupsPage.tsx`
Manage groups for the logged-in organization.

- Table: Name, Created time, Display name, Actions; search, refresh, pagination.
- **Add** creates a group with `org_name` taken from the logged-in organization's token (not user-typed). Names are lowercased with spaces turned into dashes.
- **Edit** changes the display name; the name is locked.
- **Delete** removes the group. Users in it keep existing, but their `group_id` becomes empty only if a foreign key with `on delete set null` exists; otherwise the dropdown simply shows "—".
- Talks to Supabase directly. Row Level Security limits everything to the organization's own rows.

### `src/organization/UsersPage.tsx`
Manage the organization's users (Clerk logins) and assign groups.

- Table: Username, Name, Email, Group, Created time, Actions; search, refresh, pagination.
- **Add** modal: Username, Password (8+), First/Last name, optional Email, **Group** dropdown (loaded from `groups`).
- **Edit** modal: change names, group, optionally the password (username locked).
- **Delete**: removes the Clerk login and the row.
- All writes call `manage-user`.

---

## 12. End-to-end flows

### A. Admin creates an organization
1. Admin signs in (Admin tab) → `/admin/dashboard`.
2. **User Management → Organizations → Add**: name `acme`, password, optional display name and URL → **Create**.
3. The page calls `manage-organization { action: "create" }`.
4. The function verifies the caller is an admin, creates the Supabase Auth user `acme@org.<ACCOUNT_DOMAIN>` with `{ role: "organization", org_name: "acme" }`, inserts the `organizations` row with `auth_user_id`.
5. The table shows **Login: Enabled**.

### B. Organization creates a group
1. Organization signs in (Organization tab, name `acme`) → `/organization/dashboard`.
2. **User Management → Groups → Add**: `engineering`.
3. The browser inserts a row `{ org_name: "acme", name: "engineering" }` directly; RLS confirms the `org_name` matches the token.

### C. Organization adds a user and assigns a group
1. **User Management → Users → Add**: username `alice`, password, group `engineering` → **Create**.
2. The page calls `manage-user { action: "create" }`.
3. The function reads the caller's `org_name`, checks the group belongs to it, creates the Clerk user (with `public_metadata = { org_name: "acme", group_name: "engineering" }`), and inserts the `org_users` row.

### D. The employee signs in
1. On `/login`, **User** tab: `alice` + password.
2. Clerk authenticates and redirects to `/dashboard`.
3. The portal shows "Good morning, Alice", the organization badge `acme`, and the group `engineering`.
4. The employee can change their own password from the menu or profile card.

### E. Deleting
- Delete an **organization** → removes its login and row. (Groups cascade only if the foreign key exists.)
- Delete a **user** → removes the Clerk login and the row.

---

## 13. Security model

| Layer | What it protects |
|---|---|
| **Browser keys** | Only the Clerk publishable key and the Supabase publishable/anon key are in the frontend. They are designed to be public. |
| **Row Level Security** | Even with the public key, the database only returns rows allowed by the policies. An organization sees only its own groups and users; only admins can read or change organizations. |
| **`app_metadata` roles** | `role` and `org_name` can only be set with the service-role key, so users cannot grant themselves access. |
| **Edge Functions** | Perform the dangerous operations (creating logins) after re-checking the caller's role from their token. Secrets exist only on the server. |
| **No write policies on `org_users`** | The browser cannot insert or edit users directly; only the function can. |
| **Rollbacks** | If the database step fails after creating a login, the function deletes that login to avoid orphans. |
| **Route guards** | UI-level convenience; the real enforcement is the database and functions. |

**Recommendations before going live:**

- Rotate any key that was ever pasted into a chat, screenshot or public repo (Clerk: API keys; Supabase: API Keys page).
- Change all test passwords.
- Restrict CORS on the Edge Functions: replace `"Access-Control-Allow-Origin": "*"` with your real site origin.
- Replace Clerk **test** keys (`pk_test_` / `sk_test_`) with **production** keys and set up a production Clerk instance.
- Keep `.env` out of git (add it to `.gitignore`).
- Consider enabling Supabase email/SMS rate limits and "leaked password protection" if available on your plan.
- Think about whether disabling Device Trust is acceptable for your users; if not, require verified emails and add a code-entry step to the login page for `needs_client_trust`.

---

## 14. Setup from scratch (checklist)

1. **Install:** `npm install` then `npm install @supabase/supabase-js`.
2. **Copy files** into `src/` exactly as in Section 3 (including the `organization/` folder). Check that `index.html` loads `/src/main.tsx`.
3. **Clerk:** create or pick an application; enable Username + Password; make Email optional; turn **Device Trust** off; copy the publishable key.
4. **Supabase:** create a project; copy the Project ID and the publishable key.
5. **`.env`:** fill the three `VITE_` values; restart the dev server.
6. **Database:** create `organizations`, `groups`, `org_users` and their policies (Section 8).
7. **Edge Functions:** deploy `manage-organization` and `manage-user` with Verify JWT off (Section 9).
8. **Secret:** add `CLERK_SECRET_KEY` (Clerk `sk_test_...`) under Edge Functions → Secrets.
9. **First admin:** create it (Section 10) and sign out/in.
10. **Run:** `npm run dev` → open `http://localhost:5173/login`.

---

## 15. Testing checklist

- [ ] Login page renders with three tabs; "sign up now" appears only on the User tab.
- [ ] **Admin** tab: correct credentials → `/admin/dashboard`; wrong password → "Invalid login credentials".
- [ ] An organization account on the **Admin** tab → "This account is not an admin account".
- [ ] Visiting `/admin` while signed out → redirected to `/login`.
- [ ] Admin: **Organizations → Add** `acme` + password → row appears with **Login: Enabled**; refresh keeps it.
- [ ] Admin: **Edit** `built-in`, enter a password → **Login** becomes Enabled.
- [ ] **Organization** tab: `acme` + password → `/organization/dashboard`; sidebar has Home, User Management, Settings.
- [ ] Organization: **Groups → Add** `engineering`; edit its display name; delete a test group.
- [ ] Organization: **Users → Add** `alice` (strong password, group `engineering`) → appears in the table; also visible in Clerk's Users list.
- [ ] **User** tab: `alice` → `/dashboard`; banner shows organization and group.
- [ ] Employee **Change password** works; sign in again with the new password.
- [ ] A second organization cannot see the first organization's groups or users.
- [ ] Sign out works in all three panels.
- [ ] `npm run build` completes with no TypeScript errors.

---

## 16. Troubleshooting: every problem we hit and the fix

| # | Symptom / message | Cause | Fix |
|---|---|---|---|
| 1 | Vite: `Failed to resolve import "./supabase" from "src/Login.tsx"` | `supabase.ts` was not saved in `src/` | Create `src/supabase.ts` and `npm install @supabase/supabase-js` |
| 2 | Login page looks like the first draft (email only, "Continue as Admin", no password) | An old copy of `Login.tsx` was in `src/` | Replace `src/Login.tsx` with the latest; hard-refresh (Cmd+Shift+R) |
| 3 | Browser jumps to Clerk's hosted pages | `ClerkProvider` had no `signInUrl` | Add `signInUrl="/login"`, `signUpUrl="/login"`, fallback redirect URLs (see Section 6) |
| 4 | "You're already signed in." | Clerk already has an active session; it refuses a second sign-in | `Login.tsx` now checks `isSignedIn` and goes to `/dashboard`; use a private window to test a fresh login |
| 5 | Supabase: `Invalid login credentials` (Admin tab) | `nameToEmail` produced the wrong email (e.g. `new.admin@mail.com@admin.yourapp.com`), or wrong password | Make `nameToEmail` return the value as-is when it contains `@`; reset the password |
| 6 | SQL Editor: `42501 permission denied for table users` | Editor not running as an owner role | Don't run the suggested `GRANT`; use the Auth Admin API (Section 10) or the dashboard UI |
| 7 | SQL Editor: `must be owner of table organizations` | Same ownership issue | Add the column in **Table Editor** instead |
| 8 | SQL Editor: `permission denied for schema public` when creating `org_users` | Same | Create the table in **Table Editor** and add policies in **Authentication → Policies** |
| 9 | Auth Admin API: `401 This endpoint requires a valid Bearer token` | The publishable key was used | Use the **secret** key and send both `apikey` and `Authorization: Bearer` headers |
| 10 | `auth_user_id` showed fake values | Column default was `gen_random_uuid()` | Set the default to **NULL**; clear the value on rows that should show "No login" |
| 11 | `Failed to send a request to the Edge Function` | Function not deployed or wrong name (curl returned `404 NOT_FOUND`) | Deploy it with the exact name; test with the curl OPTIONS command until it prints `200 ok` |
| 12 | Edge Function 401 / "Invalid JWT" | **Verify JWT** is on | Turn it off in the function settings; the function checks the role itself |
| 13 | "Admins only" when adding an organization | Session lacks the admin role (old token) | Sign out and in again |
| 14 | `Could not find the table 'public.org_users' in the schema cache` | Table was never created (its SQL had failed) or API cache stale | Create the table; **Reload schema** in Project Settings → API |
| 15 | `The provided Clerk Secret Key is invalid` | The `pk_test_...` publishable key (or a wrong/rotated key) was stored as `CLERK_SECRET_KEY` | Copy the **secret** key (`sk_test_...`) from the same Clerk app; test with `curl https://api.clerk.com/v1/users?limit=1 -H "Authorization: Bearer sk_test_..."` (expect `200`); update the secret and re-deploy `manage-user` |
| 16 | `Sign-in needs another step (needs_client_trust)` | Clerk **Device Trust** (formerly Client Trust) is on | Turn it off on Clerk's **Protections** page |
| 17 | Vite: `Failed to resolve import "../PanelLayout" from "src/organization/OrgLayout.tsx"` | `src/PanelLayout.tsx` did not exist | The `organization/` folder now has its own `PanelLayout.tsx`, and `OrgLayout.tsx` imports `./PanelLayout` |
| 18 | Blank page on first load | Missing `VITE_` variables in `.env`, or `.env` edited without restarting | Fill `.env`, restart `npm run dev` |
| 19 | Two icons in the email field | The browser's autofill/password-manager icon next to the app's own icon | Cosmetic; disable autofill for localhost or ignore |
| 20 | Created user shows "No group" on the dashboard | User was created before `group_name` metadata was added to the function | Open **Users → Edit → Save** on that user |
| 21 | Clerk rejects a password | Weak or leaked password | Use a longer, unique password |

---

## 17. What's built vs what's placeholder

| Area | Status |
|---|---|
| Login page (3 tabs) | ✅ Built |
| Clerk user login (username + password) | ✅ Built |
| Supabase admin / organization login | ✅ Built |
| Route guards by role | ✅ Built |
| Admin panel layout (sidebar, top bar) | ✅ Built |
| Admin: manage organizations (create, edit, delete, logins) | ✅ Built |
| Admin dashboard stats and chart | ⚠️ Sample data |
| Admin menu items other than Dashboard and Organizations (Shortcuts, Apps, Groups, Users, Invitations, Identity, Authorization, LLM AI, Auditing, Business, Admin) | ⏳ Not built yet (ComingSoon page) |
| Organization panel layout | ✅ Built |
| Organization: groups (create, edit, delete) | ✅ Built |
| Organization: users (create, edit, delete, assign group, Clerk login) | ✅ Built |
| Organization dashboard "Users" count | ⚠️ Sample (`0`) |
| Organization: Invitations, Profile | ⏳ Not built yet |
| Employee dashboard: profile, org/group chips, change password | ✅ Built |
| Employee dashboard: My apps tiles, Announcements | ⚠️ Sample content |
| Sign-up page (`/signup`) | ⏳ Not built (link exists on the User tab) |
| Forgot password / reset flow | ⏳ Not built |
| Admin management of users across organizations | ⏳ Not built (the function supports it; no UI) |
| Automated tests | ⏳ None |

---

## 18. Next steps and ideas

1. **Real data on dashboards:** count organizations, groups and users from Supabase; show the organization's own user count.
2. **Admin → Users and Groups pages:** read-only views of all organizations' data (policies already allow admin reads).
3. **Invitations:** invite users by email through Clerk's invitations API from a new Edge Function.
4. **Organization Profile page:** edit display name and website using a policy that lets an organization update its own row.
5. **Announcements and apps:** store them in tables so organizations manage what employees see.
6. **Forgot password flow** using Clerk's reset flow.
7. **Production hardening:** restrict CORS, switch to production keys, remove test accounts, add rate limiting and audit logging (the "Auditing" menu is a natural home).
8. **Tidy the shared layout:** if desired, move one `PanelLayout` to a shared `components/` folder and have both `AdminLayout` and `OrgLayout` use it.
9. **Tests:** add component tests for the login flow and integration tests for the Edge Functions.

---

## 19. Glossary

| Term | Meaning |
|---|---|
| **Clerk** | Hosted authentication service used for the employee (User) logins |
| **Supabase** | Backend platform: Postgres database, Auth, Edge Functions |
| **Edge Function** | Small server-side function running on Supabase (Deno) |
| **RLS (Row Level Security)** | Database rules that decide which rows each caller can read or write |
| **JWT** | The signed token the browser sends; it carries `app_metadata` with the role |
| **`app_metadata`** | Supabase user field writable only by trusted server code; stores `role` and `org_name` |
| **Publishable / anon key** | Public key safe to ship in the browser |
| **Secret / service-role key** | Full-access key; server only |
| **Device Trust (Client Trust)** | Clerk feature that asks for an extra code on password sign-ins from new devices |
| **`ACCOUNT_DOMAIN`** | The fake domain used to turn names into emails for Supabase Auth |
| **Public metadata (Clerk)** | Per-user data readable by the frontend; used for `org_name` and `group_name` |

---

## Appendix A: Complete database schema and policies (SQL)

Run the scripts **in this order** (each one depends on the previous). If the SQL Editor refuses with `42501 permission denied` or `must be owner`, create the same tables and policies from the dashboard instead (**Table Editor → New table**, **Authentication → Policies**) using the column tables and policy expressions in Section 8 and Appendix D.

### A.1 `organizations` table, policy and first row

```sql
-- Run this in Supabase -> SQL Editor (set the Role dropdown to "postgres" if you get a permission error)

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  display_name  text,
  website_url   text,
  created_at    timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Only logged-in users whose app_metadata.role = 'admin' can read or change organizations
drop policy if exists "admins manage organizations" on public.organizations;
create policy "admins manage organizations"
  on public.organizations
  for all
  to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Optional: first row, like the built-in organization
insert into public.organizations (name, display_name, website_url)
values ('built-in', 'Built-in Organization', 'https://example.com')
on conflict (name) do nothing;
```

### A.2 Link each organization to its login (`auth_user_id`)

The column must default to **NULL**.

```sql
-- Run in Supabase -> SQL Editor (Role: postgres)
-- Links each organization row to its login (Supabase Auth user)
alter table public.organizations
  add column if not exists auth_user_id uuid;
```

### A.3 `groups` table and policies

```sql
-- Run in Supabase -> SQL Editor
-- Groups belong to one organization. Each organization can only see and change its own groups.

create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  org_name      text not null references public.organizations(name) on delete cascade,
  name          text not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  unique (org_name, name)
);

alter table public.groups enable row level security;

-- An organization account can read/write only rows where org_name matches its own login's org_name
-- (org_name is stored in app_metadata, which users cannot edit).
drop policy if exists "org manages own groups" on public.groups;
create policy "org manages own groups"
  on public.groups
  for all
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'organization'
    and org_name = (auth.jwt() -> 'app_metadata' ->> 'org_name')
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'organization'
    and org_name = (auth.jwt() -> 'app_metadata' ->> 'org_name')
  );

-- Admins can view every organization's groups
drop policy if exists "admins read groups" on public.groups;
create policy "admins read groups"
  on public.groups
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

### A.4 `org_users` table and policies

```sql
-- Run in Supabase -> SQL Editor
-- Users belong to one organization and (optionally) one group.
-- The login itself lives in Clerk; this table links the Clerk user to the organization and group.

create table if not exists public.org_users (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null unique,
  org_name       text not null references public.organizations(name) on delete cascade,
  group_id       uuid references public.groups(id) on delete set null,
  username       text not null,
  first_name     text,
  last_name      text,
  email          text,
  created_at     timestamptz not null default now()
);

alter table public.org_users enable row level security;

-- Organizations can READ their own users. All writes go through the manage-user Edge Function
-- (it also creates the Clerk login), so there are no insert/update/delete policies on purpose.
drop policy if exists "org reads own users" on public.org_users;
create policy "org reads own users"
  on public.org_users
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'organization'
    and org_name = (auth.jwt() -> 'app_metadata' ->> 'org_name')
  );

-- Admins can read all users
drop policy if exists "admins read users" on public.org_users;
create policy "admins read users"
  on public.org_users
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## Appendix B: Edge Function `manage-organization` (full code)

Deploy as **Edge Functions → Deploy a new function → Via Editor**, name `manage-organization`, **Verify JWT off**. Admin-only. Creates, updates and deletes organizations **and** their Supabase Auth logins.

```ts
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
```

---

## Appendix C: Edge Function `manage-user` (full code)

Deploy as **Edge Functions → Deploy a new function → Via Editor**, name `manage-user`, **Verify JWT off**. Requires the secret `CLERK_SECRET_KEY` (Edge Functions → Secrets). Callable by an organization (own users only) or an admin. Creates, updates and deletes Clerk users and their `org_users` rows.

```ts
// Supabase Edge Function: manage-user
// Paste this into Edge Functions -> manage-user -> index.ts
//
// Needs one secret: CLERK_SECRET_KEY (Edge Functions -> Secrets). It never goes in the frontend.
//
// Who can call it:
//   - an organization account  -> works only on its OWN users
//   - an admin account         -> works on any organization (send org_name when creating)
//
// Actions: create | update | delete
import { createClient } from "npm:@supabase/supabase-js@2";

const CLERK_API = "https://api.clerk.com/v1";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Calls the Clerk Backend API. Throws an Error with Clerk's message on failure.
async function clerk(path: string, method: string, body?: unknown, allow404 = false) {
    const key = Deno.env.get("CLERK_SECRET_KEY");
    if (!key) throw new Error("CLERK_SECRET_KEY is not set in the Edge Function secrets");

    const res = await fetch(`${CLERK_API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 && allow404) return data;
    if (!res.ok) {
        const e = data?.errors?.[0];
        throw new Error(e?.long_message ?? e?.message ?? `Clerk error ${res.status}`);
    }
    return data;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        // 1) Who is calling?
        const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
        const { data: caller, error: callerErr } = await admin.auth.getUser(token);
        const meta = caller?.user?.app_metadata ?? {};
        if (callerErr || (meta.role !== "organization" && meta.role !== "admin")) {
            return json({ error: "Not allowed" }, 403);
        }
        const isOrg = meta.role === "organization";
        const callerOrg = (meta.org_name as string | undefined) ?? "";
        if (isOrg && !callerOrg) return json({ error: "Your account has no organization name" }, 403);

        const body = await req.json();
        const action = body.action as string;

        // Makes sure a group really belongs to the organization
        const checkGroup = async (groupId: string | null | undefined, orgName: string) => {
            if (!groupId) return { id: null as string | null, name: "" };
            const { data } = await admin.from("groups").select("id, name, display_name").eq("id", groupId).eq("org_name", orgName).maybeSingle();
            if (!data) throw new Error("That group doesn't belong to this organization");
            return { id: data.id as string, name: (data.display_name || data.name) as string };
        };

        // Loads an existing user row, making sure an organization can only touch its own users
        const loadRow = async (id: string) => {
            let q = admin.from("org_users").select("*").eq("id", id);
            if (isOrg) q = q.eq("org_name", callerOrg);
            const { data } = await q.maybeSingle();
            if (!data) throw new Error("User not found");
            return data;
        };

        // ---------- CREATE ----------
        if (action === "create") {
            const orgName = isOrg ? callerOrg : ((body.org_name as string | undefined) ?? "");
            if (!orgName) return json({ error: "Organization is required" }, 400);

            const username = ((body.username as string) ?? "").trim().toLowerCase();
            const password = (body.password ?? "") as string;
            if (!username) return json({ error: "Username is required" }, 400);
            if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

            const group = await checkGroup(body.group_id, orgName);

            const payload: Record<string, unknown> = {
                username,
                password,
                // shown on the employee's dashboard
                public_metadata: { org_name: orgName, group_name: group.name },
            };
            if (body.first_name) payload.first_name = body.first_name;
            if (body.last_name) payload.last_name = body.last_name;
            if (body.email) payload.email_address = [body.email];

            const created = await clerk("/users", "POST", payload);

            const { error: dbErr } = await admin.from("org_users").insert({
                clerk_user_id: created.id,
                org_name: orgName,
                group_id: group.id,
                username,
                first_name: body.first_name || null,
                last_name: body.last_name || null,
                email: body.email || null,
            });
            if (dbErr) {
                await clerk(`/users/${created.id}`, "DELETE", undefined, true); // roll back the Clerk user
                return json({ error: dbErr.message }, 400);
            }
            return json({ ok: true });
        }

        // ---------- UPDATE ----------
        if (action === "update") {
            const row = await loadRow(body.id);
            const group = await checkGroup(body.group_id, row.org_name);

            const clerkPatch: Record<string, unknown> = {
                first_name: body.first_name || null,
                last_name: body.last_name || null,
                public_metadata: { org_name: row.org_name, group_name: group.name },
            };
            const password = (body.password ?? "") as string;
            if (password) {
                if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
                clerkPatch.password = password;
            }
            await clerk(`/users/${row.clerk_user_id}`, "PATCH", clerkPatch);

            const { error: dbErr } = await admin.from("org_users").update({
                first_name: body.first_name || null,
                last_name: body.last_name || null,
                group_id: group.id,
            }).eq("id", row.id);
            if (dbErr) return json({ error: dbErr.message }, 400);
            return json({ ok: true });
        }

        // ---------- DELETE ----------
        if (action === "delete") {
            const row = await loadRow(body.id);
            await clerk(`/users/${row.clerk_user_id}`, "DELETE", undefined, true);
            const { error } = await admin.from("org_users").delete().eq("id", row.id);
            if (error) return json({ error: error.message }, 400);
            return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
    } catch (e) {
        return json({ error: (e as Error).message }, 400);
    }
});
```

---

## Appendix D: Policy and schema reference, and how to verify

### D.1 All tables at a glance

| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `organizations` | One row per organization (name, display name, website, link to its login) | Admin | Admin, through the `manage-organization` function |
| `groups` | Groups inside an organization | The owning organization; any admin | The owning organization (directly from the browser, limited by RLS) |
| `org_users` | Links a Clerk user to an organization and a group | The owning organization; any admin | Only the `manage-user` function (service-role key) |

### D.2 All policies at a glance

| Table | Policy name | Command | Applies to | Condition |
|---|---|---|---|---|
| `organizations` | admins manage organizations | ALL | authenticated | `role = 'admin'` |
| `groups` | org manages own groups | ALL | authenticated | `role = 'organization'` **and** `org_name` = the caller's own `org_name` |
| `groups` | admins read groups | SELECT | authenticated | `role = 'admin'` |
| `org_users` | org reads own users | SELECT | authenticated | `role = 'organization'` **and** `org_name` = the caller's own `org_name` |
| `org_users` | admins read users | SELECT | authenticated | `role = 'admin'` |

Where `role` means `auth.jwt() -> 'app_metadata' ->> 'role'` and the caller's `org_name` means `auth.jwt() -> 'app_metadata' ->> 'org_name'`.

Anonymous (not logged in) visitors match **no** policy, so they see nothing. Clerk users also match none, because they are not Supabase-authenticated; their data is shown from Clerk itself.

### D.3 What each account type can do directly from the browser

| Action | Admin | Organization | Clerk employee |
|---|---|---|---|
| Read `organizations` | ✅ | ❌ | ❌ |
| Change `organizations` | ✅ (via function) | ❌ | ❌ |
| Read `groups` | ✅ all | ✅ own only | ❌ |
| Change `groups` | ❌ (no policy) | ✅ own only | ❌ |
| Read `org_users` | ✅ all | ✅ own only | ❌ |
| Change `org_users` | via function only | via function only | ❌ |

### D.4 Read-only queries to check your setup

These only read data, so they work even where the SQL Editor blocks changes.

**List every policy:**

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected: the 5 policies in D.2.

**Check that row security is on:**

```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('organizations', 'groups', 'org_users');
```

Expected: `rls_enabled = true` for all three.

**Check the columns of a table** (change the table name):

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'organizations'
order by ordinal_position;
```

Expected for `organizations`: `auth_user_id` is `uuid` with **no** default and `is_nullable = YES`.

**See who owns the tables** (useful when you hit `must be owner`):

```sql
select tablename, tableowner
from pg_tables
where schemaname = 'public';
```

**Check which accounts have which role:**

```sql
select email, raw_app_meta_data ->> 'role' as role, raw_app_meta_data ->> 'org_name' as org_name
from auth.users
order by created_at desc;
```

This needs access to `auth.users`; if it returns a permission error, look at **Authentication → Users** in the dashboard instead.

### D.5 Quick isolation test

To prove one organization cannot see another's data:

1. Create two organizations, `acme` and `globex`, from the admin panel.
2. As `acme`, create a group `engineering` and a user.
3. Log out, and log in as `globex`.
4. Open **Groups** and **Users**. Both lists must be **empty**.

If `globex` can see `acme`'s rows, a policy is missing or wrong: re-check D.2 with the first query in D.4.

### D.6 Edge Function reference

| Function | Name must be | Verify JWT | Secrets used | Caller | Actions |
|---|---|---|---|---|---|
| `manage-organization` | `manage-organization` | off | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (built in); optional `ACCOUNT_DOMAIN` | Admin only | `create`, `update`, `delete` |
| `manage-user` | `manage-user` | off | built-in two above, plus `CLERK_SECRET_KEY` | Organization (own users) or Admin | `create`, `update`, `delete` |

Error messages the functions return, and what they mean:

| Message | Meaning |
|---|---|
| `Admins only` / `Not allowed` | The caller's token has no matching role; sign out and in again |
| `Password must be at least 6 characters` | `manage-organization` password rule |
| `Password must be at least 8 characters` | `manage-user` password rule |
| `An organization with this name already exists` | Duplicate organization name |
| `That group doesn't belong to this organization` | A group id from another organization was sent |
| `User not found` / `Organization not found` | The row id doesn't exist (or belongs to another organization) |
| `CLERK_SECRET_KEY is not set in the Edge Function secrets` | Add the secret and re-deploy |
| `The provided Clerk Secret Key is invalid…` | Wrong or rotated Clerk key, or a publishable key was stored by mistake |
| Clerk messages (username taken, breached password, …) | Passed through from Clerk unchanged |
