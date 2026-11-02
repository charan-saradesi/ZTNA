import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { useAdminData, invokeFn, groupLabel, fullName } from "./adminData";
import type { Org } from "./adminData";
import "./admin.css";
import "./adminviews.css";

type FormState = { name: string; display_name: string; website_url: string; password: string };
const EMPTY: FormState = { name: "", display_name: "", website_url: "", password: "" };
const PAGE_SIZE = 10;

export default function OrganizationsPage() {
    const { orgs, groups, users, loading, error: loadError, reload } = useAdminData();

    const [actionError, setActionError] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Org | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const [viewing, setViewing] = useState<Org | null>(null);

    // How many groups / users each organization has
    const counts = useMemo(() => {
        const g = new Map<string, number>();
        const u = new Map<string, number>();
        groups.forEach((x) => g.set(x.org_name, (g.get(x.org_name) ?? 0) + 1));
        users.forEach((x) => u.set(x.org_name, (u.get(x.org_name) ?? 0) + 1));
        return { g, u };
    }, [groups, users]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return orgs;
        return orgs.filter(
            (o) =>
                o.name.toLowerCase().includes(t) ||
                (o.display_name ?? "").toLowerCase().includes(t) ||
                (o.website_url ?? "").toLowerCase().includes(t)
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
            ? await invokeFn("manage-organization", {
                  action: "update",
                  id: editing.id,
                  display_name: form.display_name.trim(),
                  website_url: form.website_url.trim(),
                  password: form.password,
              })
            : await invokeFn("manage-organization", {
                  action: "create",
                  name: form.name,
                  display_name: form.display_name.trim(),
                  website_url: form.website_url.trim(),
                  password: form.password,
              });

        setSaving(false);
        if (msg) return setFormError(msg);

        setOpen(false);
        await reload();
    };

    const remove = async (o: Org) => {
        setActionError("");
        const userCount = counts.u.get(o.name) ?? 0;
        if (userCount > 0) {
            setActionError(
                `"${o.name}" still has ${userCount} user${userCount === 1 ? "" : "s"}. Delete its users first (Users page), then delete the organization.`
            );
            return;
        }
        const groupCount = counts.g.get(o.name) ?? 0;
        const extra = groupCount > 0 ? ` Its ${groupCount} group${groupCount === 1 ? "" : "s"} will be deleted too.` : "";
        if (!window.confirm(`Delete organization "${o.name}" and its login?${extra}`)) return;

        const msg = await invokeFn("manage-organization", { action: "delete", id: o.id });
        if (msg) setActionError(msg);
        else await reload();
    };

    // ---- details for the "View" window ----
    const view = useMemo(() => {
        if (!viewing) return null;
        const gs = groups.filter((g) => g.org_name === viewing.name);
        const us = users.filter((u) => u.org_name === viewing.name);
        return {
            groups: gs.map((g) => ({ g, members: us.filter((u) => u.group_id === g.id) })),
            ungrouped: us.filter((u) => !u.group_id || !gs.some((g) => g.id === u.group_id)),
            userTotal: us.length,
        };
    }, [viewing, groups, users]);

    const error = actionError || loadError;

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
                    <button className="btn" onClick={reload} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <button className="btn primary" onClick={openAdd}>
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {error && <p className="err">{error}</p>}

            <div className="tbl-wrap">
                <table className="tbl" style={{ minWidth: 980 }}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Display name</th>
                            <th>Website URL</th>
                            <th>Groups</th>
                            <th>Users</th>
                            <th>Login</th>
                            <th>Created time</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((o) => (
                            <tr key={o.id}>
                                <td>{o.name}</td>
                                <td>{o.display_name ?? "—"}</td>
                                <td>{o.website_url ?? "—"}</td>
                                <td className="av-num">{counts.g.get(o.name) ?? 0}</td>
                                <td className="av-num">{counts.u.get(o.name) ?? 0}</td>
                                <td className={o.auth_user_id ? "av-ok" : "av-bad"}>
                                    {o.auth_user_id ? "Enabled" : "No login"}
                                </td>
                                <td className="num">{new Date(o.created_at).toLocaleString()}</td>
                                <td>
                                    <div className="act">
                                        <button className="btn sm" onClick={() => setViewing(o)}>View</button>
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

            {/* ---- Add / Edit window ---- */}
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

            {/* ---- Details window ---- */}
            {viewing && view && (
                <div className="modal-bg" onMouseDown={() => setViewing(null)}>
                    <div className="modal av-modal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{viewing.display_name || viewing.name}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="av-rows">
                            <div className="av-row"><span>Login name</span><b>{viewing.name}</b></div>
                            <div className="av-row"><span>Display name</span><b>{viewing.display_name ?? "—"}</b></div>
                            <div className="av-row">
                                <span>Website</span>
                                <b>
                                    {viewing.website_url ? (
                                        <a href={viewing.website_url} target="_blank" rel="noreferrer" style={{ color: "#b9a5ff" }}>
                                            {viewing.website_url}
                                        </a>
                                    ) : "—"}
                                </b>
                            </div>
                            <div className="av-row">
                                <span>Login</span>
                                <b className={viewing.auth_user_id ? "av-ok" : "av-bad"}>
                                    {viewing.auth_user_id ? "Enabled" : "No login"}
                                </b>
                            </div>
                            <div className="av-row"><span>Created</span><b>{new Date(viewing.created_at).toLocaleString()}</b></div>
                            <div className="av-row"><span>Groups</span><b>{view.groups.length}</b></div>
                            <div className="av-row"><span>Users</span><b>{view.userTotal}</b></div>
                        </div>

                        <h3 className="av-h3">Groups and members</h3>

                        {view.groups.length === 0 && view.ungrouped.length === 0 && (
                            <div className="av-muted" style={{ fontSize: 14 }}>
                                This organization has no groups or users yet.
                            </div>
                        )}

                        {view.groups.map(({ g, members }) => (
                            <div key={g.id} className="av-block">
                                <div className="av-block-head">
                                    <strong>{groupLabel(g)}</strong>
                                    <span className="av-count">{members.length} user{members.length === 1 ? "" : "s"}</span>
                                </div>
                                {members.length === 0 ? (
                                    <span className="av-muted" style={{ fontSize: 13 }}>No users in this group</span>
                                ) : (
                                    <div className="av-chips">
                                        {members.map((u) => (
                                            <span key={u.id} className="av-chip" title={fullName(u) || u.username}>
                                                {u.username}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {view.ungrouped.length > 0 && (
                            <div className="av-block">
                                <div className="av-block-head">
                                    <strong>No group</strong>
                                    <span className="av-count">{view.ungrouped.length} user{view.ungrouped.length === 1 ? "" : "s"}</span>
                                </div>
                                <div className="av-chips">
                                    {view.ungrouped.map((u) => (
                                        <span key={u.id} className="av-chip" title={fullName(u) || u.username}>
                                            {u.username}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setViewing(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
