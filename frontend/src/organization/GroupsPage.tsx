import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Search, X, Loader2, ChevronDown, ChevronRight, LayoutList, LayoutGrid, UserPlus } from "lucide-react";
import { supabase } from "../supabase";
import "../admin.css";
import "../adminviews.css";

type GroupRow = {
    id: string;
    org_name: string;
    name: string;
    display_name: string | null;
    created_at: string;
    // columns added with groups_columns.sql
    description?: string | null;
    color?: string | null;
};

type Member = {
    clerk_user_id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    group_id: string | null;
};

type FormState = { name: string; display_name: string; description: string; color: string };
const EMPTY: FormState = { name: "", display_name: "", description: "", color: "" };
const COLORS = ["#7c5cff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#8b8b8b"];

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
const PAGE_SIZE = 10;

type SortBy = "newest" | "name" | "users";
type ViewMode = "table" | "cards";
type Show = "all" | "empty" | "used";

const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
const label = (g: GroupRow) => g.display_name || g.name;
const memberName = (u: Member) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username;

export default function GroupsPage() {
    const [groups, setGroups] = useState<GroupRow[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [q, setQ] = useState("");
    const [show, setShow] = useState<Show>("all");
    const [sortBy, setSortBy] = useState<SortBy>("newest");
    const [mode, setMode] = useState<ViewMode>("table");
    const [page, setPage] = useState(1);
    const [openRow, setOpenRow] = useState<string | null>(null);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<GroupRow | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [memberBusy, setMemberBusy] = useState(false);
    const [addPick, setAddPick] = useState("");

    const flash = (text: string) => {
        setNotice(text);
        window.setTimeout(() => setNotice(""), 5000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        // Row Level Security returns only this organization's rows
        const [g, u] = await Promise.all([
            supabase.from("groups").select("*").order("created_at", { ascending: false }),
            supabase.from("org_users").select("*"),
        ]);
        if (g.error || u.error) setError(g.error?.message ?? u.error?.message ?? "");
        setGroups((g.data ?? []) as GroupRow[]);
        setMembers((u.data ?? []) as Member[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const byGroup = useMemo(() => {
        const m = new Map<string, Member[]>();
        members.forEach((u) => {
            if (u.group_id) m.set(u.group_id, [...(m.get(u.group_id) ?? []), u]);
        });
        return m;
    }, [members]);
    const count = (g: GroupRow) => byGroup.get(g.id)?.length ?? 0;

    const summary = useMemo(() => {
        const inGroups = members.filter((u) => u.group_id).length;
        return {
            groups: groups.length,
            empty: groups.filter((g) => (byGroup.get(g.id)?.length ?? 0) === 0).length,
            inGroups,
            avg: groups.length ? (inGroups / groups.length).toFixed(1) : "0",
        };
    }, [groups, members, byGroup]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        const out = groups
            .filter((g) => show === "all" || (show === "empty" ? count(g) === 0 : count(g) > 0))
            .filter((g) => !t || g.name.toLowerCase().includes(t) || (g.display_name ?? "").toLowerCase().includes(t));
        out.sort((a, b) => {
            if (sortBy === "name") return label(a).localeCompare(label(b));
            if (sortBy === "users") return count(b) - count(a);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, q, show, sortBy, byGroup]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError("");
        setOpen(true);
    };

    const openEdit = (g: GroupRow) => {
        setEditing(g);
        setForm({ name: g.name, display_name: g.display_name ?? "", description: g.description ?? "", color: g.color ?? "" });
        setFormError("");
        setAddPick("");
        setOpen(true);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        let errMsg = "";
        let syncWarn = "";

        if (editing) {
            const name = slug(form.name);
            if (!name) {
                errMsg = "Name is required";
            } else {
                const { error: err } = await supabase
                    .from("groups")
                    .update({
                        name,
                        display_name: form.display_name.trim() || null,
                        description: form.description.trim() || null,
                        color: form.color || null,
                    })
                    .eq("id", editing.id);
                if (err) errMsg = err.code === "23505" ? "A group with this name already exists" : err.message;
                else if (name !== editing.name || (form.display_name.trim() || null) !== editing.display_name) {
                    // users' dashboards show the group name, so refresh it for the members
                    const syncErr = await callFn({ action: "sync_group", group_id: editing.id });
                    if (syncErr) syncWarn = `Saved, but the members' profiles could not be refreshed: ${syncErr}`;
                }
            }
        } else {
            const name = slug(form.name);
            const { data } = await supabase.auth.getUser();
            const orgName = data.user?.app_metadata?.org_name as string | undefined;
            if (!orgName) {
                errMsg = "Your account has no organization name. Sign in again.";
            } else if (!name) {
                errMsg = "Name is required";
            } else {
                const { error: err } = await supabase.from("groups").insert({
                    org_name: orgName,
                    name,
                    display_name: form.display_name.trim() || null,
                    description: form.description.trim() || null,
                    color: form.color || null,
                });
                if (err) errMsg = err.code === "23505" ? "A group with this name already exists" : err.message;
            }
        }

        setSaving(false);
        if (errMsg) return setFormError(errMsg);

        setOpen(false);
        flash(editing ? `Saved changes to "${label(editing)}".` : `Group "${slug(form.name)}" created.`);
        if (syncWarn) setError(syncWarn);
        await load();
    };

    // Adds a user to the group being edited, or removes them (groupId null)
    const moveMember = async (u: Member, groupId: string | null) => {
        setMemberBusy(true);
        setFormError("");
        const msg = await callFn({
            action: "update",
            clerk_user_id: u.clerk_user_id,
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            group_id: groupId,
        });
        setMemberBusy(false);
        if (msg) return setFormError(msg);
        setAddPick("");
        await load();
    };

    const remove = async (g: GroupRow) => {
        const n = count(g);
        const note = n > 0 ? `\n\n${n} user${n === 1 ? "" : "s"} in this group will become "No group". They are not deleted.` : "";
        if (!window.confirm(`Delete group "${label(g)}"?${note}`)) return;
        const { error: err } = await supabase.from("groups").delete().eq("id", g.id);
        if (err) setError(err.message);
        else {
            flash(`"${label(g)}" deleted.`);
            await load();
        }
    };

    const chips = (list: Member[]) =>
        list.length === 0 ? (
            <span className="av-muted" style={{ fontSize: 13 }}>No users in this group yet.</span>
        ) : (
            <div className="av-chips">
                {list.map((u) => (
                    <span key={u.clerk_user_id} className="av-chip" title={memberName(u)}>{u.username}</span>
                ))}
            </div>
        );

    const emptyText = q || show !== "all" ? "No matching groups" : "No groups yet. Click Add to create one.";

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Groups</h1>
                <div className="pg-actions">
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
                <div className="av-sum-card"><span>Groups</span><b>{summary.groups}</b></div>
                <div className="av-sum-card"><span>Users in groups</span><b>{summary.inGroups}</b></div>
                <div className="av-sum-card">
                    <span>Empty groups</span>
                    <b style={{ color: summary.empty ? "#fbbf24" : undefined }}>{summary.empty}</b>
                </div>
                <div className="av-sum-card"><span>Average group size</span><b>{summary.avg}</b></div>
            </div>

            <div className="pg-actions" style={{ flexWrap: "wrap" }}>
                <div className="pg-search">
                    <Search size={15} />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        placeholder="Search groups"
                        style={{ width: 240 }}
                    />
                </div>
                <select className="av-select" value={show} onChange={(e) => { setShow(e.target.value as Show); setPage(1); }} aria-label="Filter">
                    <option value="all">All groups</option>
                    <option value="used">With users</option>
                    <option value="empty">Empty only</option>
                </select>
                <select className="av-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label="Sort">
                    <option value="newest">Newest first</option>
                    <option value="name">Name A to Z</option>
                    <option value="users">Most users</option>
                </select>
                <div className="av-seg" role="group" aria-label="Layout" style={{ marginLeft: "auto" }}>
                    <button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")} title="Table">
                        <LayoutList size={15} style={{ verticalAlign: "middle" }} />
                    </button>
                    <button className={mode === "cards" ? "on" : ""} onClick={() => setMode("cards")} title="Cards">
                        <LayoutGrid size={15} style={{ verticalAlign: "middle" }} />
                    </button>
                </div>
            </div>

            {mode === "table" && (
                <div className="tbl-wrap">
                    <table className="tbl" style={{ minWidth: 700 }}>
                        <thead>
                        <tr>
                            <th>Group</th>
                            <th>Users</th>
                            <th>Created</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((g) => {
                            const list = byGroup.get(g.id) ?? [];
                            const expanded = openRow === g.id;
                            return (
                                <Fragment key={g.id}>
                                    <tr className="av-click" onClick={() => setOpenRow(expanded ? null : g.id)}>
                                        <td>
                                            <span className="av-chev">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                                            {g.color && <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: g.color, marginRight: 8 }} />}
                                            <span className="av-org-name">{label(g)}</span>
                                            <span className="av-sub-text" style={{ marginLeft: 24 }}>
                                                    {[g.display_name ? g.name : "", g.description].filter(Boolean).join(" · ")}
                                                </span>
                                        </td>
                                        <td className="av-num">
                                            {list.length}
                                            {list.length === 0 && <span className="av-badge nologin" style={{ marginLeft: 8, marginTop: 0 }}>Empty</span>}
                                        </td>
                                        <td className="num">{new Date(g.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className="act" onClick={(e) => e.stopPropagation()}>
                                                <Link to={`/organization/users?group=${g.id}`} className="btn sm" style={{ textDecoration: "none" }} title="See or add users in this group">
                                                    <UserPlus size={14} /> Users
                                                </Link>
                                                <button className="btn sm" onClick={() => openEdit(g)}>Edit</button>
                                                <button className="btn sm danger" onClick={() => remove(g)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expanded && (
                                        <tr className="av-expand">
                                            <td colSpan={4}>{chips(list)}</td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        </tbody>
                    </table>

                    {!loading && rows.length === 0 && <div className="empty">{emptyText}</div>}
                    {loading && <div className="empty">Loading…</div>}
                </div>
            )}

            {mode === "cards" && (
                <>
                    {loading && <div className="tbl-wrap"><div className="empty">Loading…</div></div>}
                    {!loading && rows.length === 0 && <div className="tbl-wrap"><div className="empty">{emptyText}</div></div>}
                    <div className="av-cards">
                        {rows.map((g) => {
                            const list = byGroup.get(g.id) ?? [];
                            return (
                                <div key={g.id} className="av-org-card">
                                    <div className="av-card-head">
                                        <div className="av-avatar" style={g.color ? { background: g.color } : undefined}>{label(g)[0]?.toUpperCase()}</div>
                                        <div className="grow">
                                            <strong>{label(g)}</strong>
                                            <span className="av-sub-text">{g.name}</span>
                                        </div>
                                        <span className="av-count">{list.length} user{list.length === 1 ? "" : "s"}</span>
                                    </div>
                                    {g.description && <p className="av-info" style={{ margin: 0 }}>{g.description}</p>}
                                    {chips(list.slice(0, 12))}
                                    {list.length > 12 && <span className="av-muted" style={{ fontSize: 12 }}>and {list.length - 12} more</span>}
                                    <div className="av-card-actions">
                                        <Link to={`/organization/users?group=${g.id}`} className="btn sm" style={{ textDecoration: "none" }}>Users</Link>
                                        <button className="btn sm" onClick={() => openEdit(g)}>Edit</button>
                                        <button className="btn sm danger" onClick={() => remove(g)}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <div className="tbl-foot" style={{ border: "1px solid #2a2a2a", borderRadius: 12, background: "#141414" }}>
                <span>{filtered.length} total</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="btn sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Prev</button>
                    <span>{current} / {pages}</span>
                    <button className="btn sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
                </div>
            </div>

            {open && (
                <div className="modal-bg" onMouseDown={() => !saving && setOpen(false)}>
                    <form className="modal av-modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{editing ? `Edit ${label(editing)}` : "Add group"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="mf">
                            Name
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. engineering"
                                required
                            />
                            <small>
                                {editing
                                    ? "You can rename it. Users stay in the group."
                                    : "Unique within your organization. Spaces become dashes."}
                            </small>
                        </label>

                        <label className="mf">
                            Display name
                            <input
                                value={form.display_name}
                                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                                placeholder="e.g. Engineering Team"
                            />
                        </label>

                        <label className="mf">
                            Description
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="What is this group for?"
                            />
                        </label>

                        <div className="mf">
                            Color
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                                <button
                                    type="button"
                                    className="btn sm"
                                    onClick={() => setForm({ ...form, color: "" })}
                                    style={form.color === "" ? { borderColor: "#7c5cff" } : undefined}
                                >
                                    Default
                                </button>
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm({ ...form, color: c })}
                                        aria-label={`Color ${c}`}
                                        style={{
                                            width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                                            border: form.color === c ? "2px solid #fff" : "2px solid transparent",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {editing && (
                            <div className="mf">
                                Members ({byGroup.get(editing.id)?.length ?? 0})
                                <div className="av-block" style={{ marginTop: 4 }}>
                                    {(byGroup.get(editing.id) ?? []).length === 0 && (
                                        <span className="av-muted" style={{ fontSize: 13 }}>No users in this group yet.</span>
                                    )}
                                    <div className="av-chips">
                                        {(byGroup.get(editing.id) ?? []).map((u) => (
                                            <span key={u.clerk_user_id} className="av-chip" title={memberName(u)}>
                                                {u.username}{" "}
                                                <button
                                                    type="button"
                                                    disabled={memberBusy}
                                                    onClick={() => moveMember(u, null)}
                                                    aria-label={`Remove ${u.username}`}
                                                    style={{ background: "none", border: 0, color: "#ef4444", cursor: "pointer", padding: 0 }}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <select
                                            className="av-select"
                                            style={{ flex: 1 }}
                                            value={addPick}
                                            onChange={(e) => setAddPick(e.target.value)}
                                            aria-label="Add a user"
                                        >
                                            <option value="">Add a user…</option>
                                            {members
                                                .filter((u) => u.group_id !== editing.id)
                                                .map((u) => (
                                                    <option key={u.clerk_user_id} value={u.clerk_user_id}>
                                                        {u.username}{u.group_id ? " (in another group)" : ""}
                                                    </option>
                                                ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn"
                                            disabled={!addPick || memberBusy}
                                            onClick={() => {
                                                const u = members.find((x) => x.clerk_user_id === addPick);
                                                if (u) moveMember(u, editing.id);
                                            }}
                                        >
                                            {memberBusy ? <Loader2 size={14} className="spin" /> : "Add"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

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