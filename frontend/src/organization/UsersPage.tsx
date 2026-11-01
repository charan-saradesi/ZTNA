import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { supabase } from "../supabase";
import "../admin.css";

type UserRow = {
    id: string;
    clerk_user_id: string;
    org_name: string;
    group_id: string | null;
    username: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    created_at: string;
};

type GroupOption = { id: string; name: string; display_name: string | null };

type FormState = {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    group_id: string;
};
const EMPTY: FormState = { username: "", password: "", first_name: "", last_name: "", email: "", group_id: "" };
const PAGE_SIZE = 10;

// Calls the manage-user Edge Function. Returns an error message, or "" on success.
async function callFn(body: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.functions.invoke("manage-user", { body });
    if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
            try {
                const j = await ctx.json();
                if (j?.error) return j.error as string;
            } catch {
                /* ignore */
            }
        }
        return error.message;
    }
    return (data?.error as string | undefined) ?? "";
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        // Row Level Security returns only this organization's rows
        const [u, g] = await Promise.all([
            supabase.from("org_users").select("*").order("created_at", { ascending: false }),
            supabase.from("groups").select("id, name, display_name").order("name"),
        ]);
        if (u.error) setError(u.error.message);
        else setUsers((u.data ?? []) as UserRow[]);
        if (g.error) setError(g.error.message);
        else setGroups((g.data ?? []) as GroupOption[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groupLabel = useMemo(() => {
        const m = new Map<string, string>();
        groups.forEach((g) => m.set(g.id, g.display_name || g.name));
        return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
    }, [groups]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return users;
        return users.filter(
            (u) =>
                u.username.toLowerCase().includes(t) ||
                `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(t) ||
                (u.email ?? "").toLowerCase().includes(t)
        );
    }, [users, q]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError("");
        setOpen(true);
    };

    const openEdit = (u: UserRow) => {
        setEditing(u);
        setForm({
            username: u.username,
            password: "",
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            email: u.email ?? "",
            group_id: u.group_id ?? "",
        });
        setFormError("");
        setOpen(true);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        const msg = editing
            ? await callFn({
                  action: "update",
                  id: editing.id,
                  first_name: form.first_name.trim(),
                  last_name: form.last_name.trim(),
                  group_id: form.group_id || null,
                  password: form.password,
              })
            : await callFn({
                  action: "create",
                  username: form.username,
                  password: form.password,
                  first_name: form.first_name.trim(),
                  last_name: form.last_name.trim(),
                  email: form.email.trim(),
                  group_id: form.group_id || null,
              });

        setSaving(false);
        if (msg) return setFormError(msg);

        setOpen(false);
        await load();
    };

    const remove = async (u: UserRow) => {
        if (!window.confirm(`Delete user "${u.username}"? This also deletes their login.`)) return;
        const msg = await callFn({ action: "delete", id: u.id });
        if (msg) setError(msg);
        else await load();
    };

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Users</h1>
                <div className="pg-actions">
                    <div className="pg-search">
                        <Search size={15} />
                        <input
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setPage(1); }}
                            placeholder="Search users"
                        />
                    </div>
                    <button className="btn" onClick={load} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <button className="btn primary" onClick={openAdd}>
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {error && <p className="err">{error}</p>}

            <div className="tbl-wrap">
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Group</th>
                            <th>Created time</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((u) => (
                            <tr key={u.id}>
                                <td>{u.username}</td>
                                <td>{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—"}</td>
                                <td>{u.email ?? "—"}</td>
                                <td>{groupLabel(u.group_id)}</td>
                                <td className="num">{new Date(u.created_at).toLocaleString()}</td>
                                <td>
                                    <div className="act">
                                        <button className="btn sm" onClick={() => openEdit(u)}>Edit</button>
                                        <button className="btn sm danger" onClick={() => remove(u)}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && rows.length === 0 && (
                    <div className="empty">{q ? "No matching users" : "No users yet. Click Add to create one."}</div>
                )}
                {loading && <div className="empty">Loading…</div>}

                <div className="tbl-foot">
                    <span>{filtered.length} total</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="btn sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Prev</button>
                        <span>{current} / {pages}</span>
                        <button className="btn sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
                    </div>
                </div>
            </div>

            {open && (
                <div className="modal-bg" onMouseDown={() => !saving && setOpen(false)}>
                    <form className="modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{editing ? "Edit user" : "Add user"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="mf">
                            Username
                            <input
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="e.g. alice"
                                disabled={!!editing}
                                autoComplete="off"
                                required
                            />
                            <small>{editing ? "Username can't be changed" : "Used to sign in on the User tab."}</small>
                        </label>

                        <label className="mf">
                            Password
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder={editing ? "Leave blank to keep the current one" : "At least 8 characters"}
                                autoComplete="new-password"
                                required={!editing}
                            />
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <label className="mf">
                                First name
                                <input
                                    value={form.first_name}
                                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                />
                            </label>
                            <label className="mf">
                                Last name
                                <input
                                    value={form.last_name}
                                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                />
                            </label>
                        </div>

                        {!editing && (
                            <label className="mf">
                                Email (optional)
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="alice@company.com"
                                />
                                <small>Only needed if your Clerk settings require an email.</small>
                            </label>
                        )}

                        <label className="mf">
                            Group
                            <select
                                style={{
                                    height: 40, border: "1px solid #2a2a2a", borderRadius: 8, background: "#0f0f0f",
                                    color: "#f2f2f2", padding: "0 12px", fontSize: 14, outline: 0,
                                }}
                                value={form.group_id}
                                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                            >
                                <option value="">No group</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.display_name || g.name}</option>
                                ))}
                            </select>
                        </label>

                        {formError && <p className="err">{formError}</p>}

                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={saving}>
                                {saving ? <Loader2 size={15} className="spin" /> : editing ? "Save" : "Create"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
