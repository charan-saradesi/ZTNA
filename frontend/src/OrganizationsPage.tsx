import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { supabase } from "./supabase";
import "./admin.css";

type Org = {
    id: string;
    name: string;
    display_name: string | null;
    website_url: string | null;
    auth_user_id: string | null;
    created_at: string;
};

type FormState = { name: string; display_name: string; website_url: string; password: string };
const EMPTY: FormState = { name: "", display_name: "", website_url: "", password: "" };
const PAGE_SIZE = 10;

// Calls the manage-organization Edge Function. Returns an error message, or "" on success.
async function callFn(body: Record<string, unknown>): Promise<string> {
    const { data, error } = await supabase.functions.invoke("manage-organization", { body });
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

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Org | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        const { data, error: err } = await supabase
            .from("organizations")
            .select("*")
            .order("created_at", { ascending: false });
        if (err) setError(err.message);
        else setOrgs((data ?? []) as Org[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return orgs;
        return orgs.filter(
            (o) => o.name.toLowerCase().includes(t) || (o.display_name ?? "").toLowerCase().includes(t)
        );
    }, [orgs, q]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError("");
        setOpen(true);
    };

    const openEdit = (o: Org) => {
        setEditing(o);
        setForm({ name: o.name, display_name: o.display_name ?? "", website_url: o.website_url ?? "", password: "" });
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
                  display_name: form.display_name.trim(),
                  website_url: form.website_url.trim(),
                  password: form.password,
              })
            : await callFn({
                  action: "create",
                  name: form.name,
                  display_name: form.display_name.trim(),
                  website_url: form.website_url.trim(),
                  password: form.password,
              });

        setSaving(false);
        if (msg) return setFormError(msg);

        setOpen(false);
        await load();
    };

    const remove = async (o: Org) => {
        if (!window.confirm(`Delete organization "${o.name}" and its login?`)) return;
        const msg = await callFn({ action: "delete", id: o.id });
        if (msg) setError(msg);
        else await load();
    };

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Organizations</h1>
                <div className="pg-actions">
                    <div className="pg-search">
                        <Search size={15} />
                        <input
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setPage(1); }}
                            placeholder="Search organizations"
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
                            <th>Name</th>
                            <th>Created time</th>
                            <th>Display name</th>
                            <th>Website URL</th>
                            <th>Login</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((o) => (
                            <tr key={o.id}>
                                <td>{o.name}</td>
                                <td className="num">{new Date(o.created_at).toLocaleString()}</td>
                                <td>{o.display_name ?? "—"}</td>
                                <td>{o.website_url ?? "—"}</td>
                                <td style={{ color: o.auth_user_id ? "#4ade80" : "#8b8b8b" }}>
                                    {o.auth_user_id ? "Enabled" : "No login"}
                                </td>
                                <td>
                                    <div className="act">
                                        <button className="btn sm" onClick={() => openEdit(o)}>Edit</button>
                                        <button className="btn sm danger" onClick={() => remove(o)}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && rows.length === 0 && (
                    <div className="empty">{q ? "No matching organizations" : "No organizations yet. Click Add to create one."}</div>
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
                            <h2>{editing ? "Edit organization" : "Add organization"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="mf">
                            Name
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. acme"
                                disabled={!!editing}
                                required
                            />
                            <small>
                                {editing
                                    ? "Name can't be changed. It is the organization's login name."
                                    : "Unique, lowercase. This is the name used to log in."}
                            </small>
                        </label>

                        <label className="mf">
                            Password
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder={editing ? "Leave blank to keep the current one" : "At least 6 characters"}
                                autoComplete="new-password"
                                required={!editing}
                            />
                            <small>
                                {editing && !editing.auth_user_id
                                    ? "This organization has no login yet. Enter a password to create one."
                                    : "Used on the Organization tab of the login page."}
                            </small>
                        </label>

                        <label className="mf">
                            Display name
                            <input
                                value={form.display_name}
                                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                                placeholder="e.g. Acme Corporation"
                            />
                        </label>

                        <label className="mf">
                            Website URL
                            <input
                                value={form.website_url}
                                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                                placeholder="https://acme.com"
                            />
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
