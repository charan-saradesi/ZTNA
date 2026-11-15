import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, RefreshCw, Search, X, Loader2, Download, Wand2, KeyRound, LayoutList, Layers } from "lucide-react";
import { supabase } from "../supabase";
import "../admin.css";
import "../adminviews.css";

type UserRow = {
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

type SortBy = "newest" | "name" | "group";
type ViewMode = "table" | "grouped";

const fullName = (u: Pick<UserRow, "first_name" | "last_name">) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
const withinDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() < days * 86_400_000;

// A readable random password (no look-alike characters)
function makePassword(): string {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

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
    const [params] = useSearchParams();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [q, setQ] = useState("");
    const [groupFilter, setGroupFilter] = useState(params.get("group") ?? "all"); // "all" | "none" | group id
    const [sortBy, setSortBy] = useState<SortBy>("newest");
    const [mode, setMode] = useState<ViewMode>("table");
    const [page, setPage] = useState(1);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkGroup, setBulkGroup] = useState("");
    const [bulkBusy, setBulkBusy] = useState(false);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [showPw, setShowPw] = useState(false);

    const [resetFor, setResetFor] = useState<UserRow | null>(null);
    const [resetPw, setResetPw] = useState("");
    const [resetBusy, setResetBusy] = useState(false);
    const [resetError, setResetError] = useState("");

    const flash = (text: string) => {
        setNotice(text);
        window.setTimeout(() => setNotice(""), 5000);
    };

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
        setSelected(new Set());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g.display_name || g.name])), [groups]);
    const groupLabel = (id: string | null) => (id ? groupMap.get(id) ?? "—" : "");

    const summary = useMemo(
        () => ({
            total: users.length,
            assigned: users.filter((u) => u.group_id).length,
            unassigned: users.filter((u) => !u.group_id).length,
            fresh: users.filter((u) => withinDays(u.created_at, 7)).length,
        }),
        [users]
    );

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        const out = users
            .filter((u) => groupFilter === "all" || (groupFilter === "none" ? !u.group_id : u.group_id === groupFilter))
            .filter(
                (u) =>
                    !t ||
                    u.username.toLowerCase().includes(t) ||
                    fullName(u).toLowerCase().includes(t) ||
                    (u.email ?? "").toLowerCase().includes(t)
            );
        out.sort((a, b) => {
            if (sortBy === "name") return (fullName(a) || a.username).localeCompare(fullName(b) || b.username);
            if (sortBy === "group") return groupLabel(a.group_id).localeCompare(groupLabel(b.group_id)) || a.username.localeCompare(b.username);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, q, groupFilter, sortBy, groupMap]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = mode === "table" ? filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) : filtered;

    // Users bucketed by group for the "By group" view
    const buckets = useMemo(() => {
        const list = groups
            .map((g) => ({ key: g.id, title: g.display_name || g.name, none: false, users: filtered.filter((u) => u.group_id === g.id) }))
            .filter((b) => b.users.length > 0);
        const known = new Set(groups.map((g) => g.id));
        const loose = filtered.filter((u) => !u.group_id || !known.has(u.group_id));
        if (loose.length > 0) list.push({ key: "none", title: "No group", none: true, users: loose });
        return list;
    }, [groups, filtered]);

    // ---------- Selection ----------
    const toggleOne = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };
    const allShownSelected = rows.length > 0 && rows.every((u) => selected.has(u.clerk_user_id));
    const toggleAllShown = () => {
        const next = new Set(selected);
        if (allShownSelected) rows.forEach((u) => next.delete(u.clerk_user_id));
        else rows.forEach((u) => next.add(u.clerk_user_id));
        setSelected(next);
    };

    // Moves the selected users to a group. Names are sent back as they are so nothing is wiped.
    const bulkMove = async () => {
        if (selected.size === 0) return;
        setBulkBusy(true);
        setError("");
        let failed = "";
        let done = 0;
        for (const u of users.filter((x) => selected.has(x.clerk_user_id))) {
            const msg = await callFn({
                action: "update",
                clerk_user_id: u.clerk_user_id,
                first_name: u.first_name ?? "",
                last_name: u.last_name ?? "",
                group_id: bulkGroup || null,
            });
            if (msg) {
                failed = msg;
                break;
            }
            done++;
        }
        setBulkBusy(false);
        if (failed) setError(`Moved ${done}, then stopped: ${failed}`);
        else flash(`Moved ${done} user${done === 1 ? "" : "s"} to ${bulkGroup ? groupLabel(bulkGroup) : "No group"}.`);
        await load();
    };

    const bulkDelete = async () => {
        if (selected.size === 0) return;
        if (!window.confirm(`Delete ${selected.size} user${selected.size === 1 ? "" : "s"}? This also deletes their logins and they can no longer sign in.`)) return;
        setBulkBusy(true);
        setError("");
        let failed = "";
        let done = 0;
        for (const id of selected) {
            const msg = await callFn({ action: "delete", clerk_user_id: id });
            if (msg) {
                failed = msg;
                break;
            }
            done++;
        }
        setBulkBusy(false);
        if (failed) setError(`Deleted ${done}, then stopped: ${failed}`);
        else flash(`Deleted ${done} user${done === 1 ? "" : "s"}.`);
        await load();
    };

    // ---------- Export ----------
    const exportCsv = () => {
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [
            ["Username", "First name", "Last name", "Email", "Group", "Created"].map(esc).join(","),
            ...filtered.map((u) =>
                [u.username, u.first_name ?? "", u.last_name ?? "", u.email ?? "", groupLabel(u.group_id), new Date(u.created_at).toISOString()]
                    .map(esc)
                    .join(",")
            ),
        ];
        const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "users.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ---------- Add / edit ----------
    const openAdd = () => {
        setEditing(null);
        setForm({ ...EMPTY, group_id: groupFilter !== "all" && groupFilter !== "none" ? groupFilter : "" });
        setFormError("");
        setShowPw(false);
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
        setShowPw(false);
        setOpen(true);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        const msg = editing
            ? await callFn({
                action: "update",
                clerk_user_id: editing.clerk_user_id,
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
        flash(editing ? `Saved changes to "${editing.username}".` : `User "${form.username.trim().toLowerCase()}" created. Share the password with them.`);
        await load();
    };

    const remove = async (u: UserRow) => {
        if (!window.confirm(`Delete user "${u.username}"? This also deletes their login and they can no longer sign in.`)) return;
        const msg = await callFn({ action: "delete", clerk_user_id: u.clerk_user_id });
        if (msg) setError(msg);
        else {
            flash(`"${u.username}" deleted.`);
            await load();
        }
    };

    // ---------- Reset password ----------
    const openReset = (u: UserRow) => {
        setResetFor(u);
        setResetPw("");
        setResetError("");
    };

    const submitReset = async (e: FormEvent) => {
        e.preventDefault();
        if (!resetFor) return;
        setResetBusy(true);
        setResetError("");
        const msg = await callFn({
            action: "update",
            clerk_user_id: resetFor.clerk_user_id,
            first_name: resetFor.first_name ?? "",
            last_name: resetFor.last_name ?? "",
            group_id: resetFor.group_id,
            password: resetPw,
        });
        setResetBusy(false);
        if (msg) return setResetError(msg);
        flash(`Password updated for "${resetFor.username}".`);
        setResetFor(null);
    };

    // One user's table row
    const userRow = (u: UserRow) => (
        <tr key={u.clerk_user_id}>
            <td style={{ width: 36 }}>
                <input type="checkbox" checked={selected.has(u.clerk_user_id)} onChange={() => toggleOne(u.clerk_user_id)} aria-label={`Select ${u.username}`} />
            </td>
            <td>
                <span className="av-org-name">{u.username}</span>
                {fullName(u) && <span className="av-sub-text">{fullName(u)}</span>}
            </td>
            <td>{u.email ?? "—"}</td>
            <td>{u.group_id ? <span className="av-chip">{groupLabel(u.group_id)}</span> : <span className="av-muted">No group</span>}</td>
            <td className="num">{new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                <div className="act">
                    <button className="btn sm" onClick={() => openEdit(u)}>Edit</button>
                    <button className="btn sm" onClick={() => openReset(u)} title="Reset password"><KeyRound size={14} /></button>
                    <button className="btn sm danger" onClick={() => remove(u)}>Delete</button>
                </div>
            </td>
        </tr>
    );

    const head = (
        <thead>
        <tr>
            <th style={{ width: 36 }}>
                <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} aria-label="Select all" />
            </th>
            <th>User</th>
            <th>Email</th>
            <th>Group</th>
            <th>Created</th>
            <th style={{ textAlign: "right" }}>Action</th>
        </tr>
        </thead>
    );

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Users</h1>
                <div className="pg-actions">
                    <button className="btn" onClick={exportCsv} disabled={filtered.length === 0} title="Download the shown users as CSV">
                        <Download size={15} /> Export
                    </button>
                    <button className="btn" onClick={load} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <button className="btn primary" onClick={openAdd}>
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {notice && <p className="av-notice">{notice}</p>}
            {error && <p className="err">{error}</p>}

            <div className="av-sum">
                <div className="av-sum-card"><span>Users</span><b>{summary.total}</b></div>
                <div className="av-sum-card"><span>In a group</span><b>{summary.assigned}</b></div>
                <div className="av-sum-card">
                    <span>Without a group</span>
                    <b style={{ color: summary.unassigned ? "var(--warn)" : undefined }}>{summary.unassigned}</b>
                </div>
                <div className="av-sum-card"><span>New this week</span><b>{summary.fresh}</b></div>
            </div>

            <div className="pg-actions" style={{ flexWrap: "wrap" }}>
                <div className="pg-search">
                    <Search size={15} />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        placeholder="Search username, name, email…"
                        style={{ width: 260 }}
                    />
                </div>
                <select className="av-select" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }} aria-label="Filter by group">
                    <option value="all">All groups</option>
                    <option value="none">No group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.display_name || g.name}</option>)}
                </select>
                <select className="av-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label="Sort">
                    <option value="newest">Newest first</option>
                    <option value="name">Name A to Z</option>
                    <option value="group">By group</option>
                </select>
                <div className="av-seg" role="group" aria-label="Layout" style={{ marginLeft: "auto" }}>
                    <button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")} title="All users">
                        <LayoutList size={15} style={{ verticalAlign: "middle" }} />
                    </button>
                    <button className={mode === "grouped" ? "on" : ""} onClick={() => setMode("grouped")} title="By group">
                        <Layers size={15} style={{ verticalAlign: "middle" }} />
                    </button>
                </div>
            </div>

            {selected.size > 0 && (
                <div className="av-sum-card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px" }}>
                    <b style={{ fontSize: 14 }}>{selected.size} selected</b>
                    <select className="av-select" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} aria-label="Move to group">
                        <option value="">No group</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.display_name || g.name}</option>)}
                    </select>
                    <button className="btn sm" onClick={bulkMove} disabled={bulkBusy}>
                        {bulkBusy ? <Loader2 size={14} className="spin" /> : "Move to group"}
                    </button>
                    <button className="btn sm danger" onClick={bulkDelete} disabled={bulkBusy}>Delete</button>
                    <button className="btn sm" onClick={() => setSelected(new Set())} disabled={bulkBusy} style={{ marginLeft: "auto" }}>Clear</button>
                </div>
            )}

            {mode === "table" && (
                <div className="tbl-wrap">
                    <table className="tbl" style={{ minWidth: 820 }}>
                        {head}
                        <tbody>{rows.map(userRow)}</tbody>
                    </table>

                    {!loading && rows.length === 0 && (
                        <div className="empty">{q || groupFilter !== "all" ? "No matching users" : "No users yet. Click Add to create one."}</div>
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
            )}

            {mode === "grouped" && (
                <div className="av-stack">
                    {loading && <div className="tbl-wrap"><div className="empty">Loading…</div></div>}
                    {!loading && buckets.length === 0 && (
                        <div className="tbl-wrap"><div className="empty">{q || groupFilter !== "all" ? "No matching users" : "No users yet. Click Add to create one."}</div></div>
                    )}
                    {buckets.map((b) => (
                        <div key={b.key} className="av-sec">
                            <div className="av-sec-head" style={{ cursor: "default" }}>
                                <span className={`av-bucket-title ${b.none ? "none" : ""}`} style={{ margin: 0 }}>
                                    <span className="dot" /> {b.title}
                                </span>
                                <span className="grow" />
                                <span className="av-count">{b.users.length} user{b.users.length === 1 ? "" : "s"}</span>
                            </div>
                            <div className="av-inner" style={{ border: 0, borderTop: "1px solid var(--bd2)", borderRadius: 0 }}>
                                <table className="tbl" style={{ minWidth: 820 }}>
                                    {head}
                                    <tbody>{b.users.map(userRow)}</tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ---- Add / edit ---- */}
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
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    style={{ flex: 1 }}
                                    type={showPw ? "text" : "password"}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder={editing ? "Leave blank to keep the current one" : "At least 8 characters"}
                                    autoComplete="new-password"
                                    required={!editing}
                                />
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() => { setForm({ ...form, password: makePassword() }); setShowPw(true); }}
                                    title="Generate a strong password"
                                >
                                    <Wand2 size={15} /> Generate
                                </button>
                            </div>
                            {showPw && <small>Copy this password now and share it with the user. It isn't shown again.</small>}
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <label className="mf">
                                First name
                                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                            </label>
                            <label className="mf">
                                Last name
                                <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
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
                            <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                                <option value="">No group</option>
                                {groups.map((g) => <option key={g.id} value={g.id}>{g.display_name || g.name}</option>)}
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

            {/* ---- Reset password ---- */}
            {resetFor && (
                <div className="modal-bg" onMouseDown={() => !resetBusy && setResetFor(null)}>
                    <form className="modal" onSubmit={submitReset} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>Reset password</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setResetFor(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="av-info">Set a new password for <b>{resetFor.username}</b>. Share it with them; they use it on the User tab.</p>
                        <label className="mf">
                            New password
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    style={{ flex: 1 }}
                                    type="text"
                                    value={resetPw}
                                    onChange={(e) => setResetPw(e.target.value)}
                                    placeholder="At least 8 characters"
                                    autoComplete="off"
                                    minLength={8}
                                    required
                                />
                                <button type="button" className="btn" onClick={() => setResetPw(makePassword())}>
                                    <Wand2 size={15} /> Generate
                                </button>
                            </div>
                        </label>
                        {resetError && <p className="err">{resetError}</p>}
                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setResetFor(null)} disabled={resetBusy}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={resetBusy}>
                                {resetBusy ? <Loader2 size={15} className="spin" /> : "Save password"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}