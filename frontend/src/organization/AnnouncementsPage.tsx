import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, X, Loader2, Megaphone, Pin, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { EmptyState, TableSkeleton, timeAgo } from "../ui";
import "../admin.css";
import "../adminviews.css";

type Ann = {
    id: string;
    org_name: string;
    title: string;
    body: string | null;
    group_ids: string[] | null; // null or empty = everyone in the organization
    pinned: boolean;
    expires_at: string | null;
    created_at: string;
};

type GroupOption = { id: string; name: string; display_name: string | null };

type FormState = { title: string; body: string; everyone: boolean; groups: string[]; pinned: boolean; expires: string };
const EMPTY: FormState = { title: "", body: "", everyone: true, groups: [], pinned: false, expires: "" };

const expired = (a: Ann) => !!a.expires_at && new Date(a.expires_at).getTime() < Date.now();
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function AnnouncementsPage() {
    const [items, setItems] = useState<Ann[]>([]);
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Ann | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const flash = (text: string) => {
        setNotice(text);
        window.setTimeout(() => setNotice(""), 5000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        // Row Level Security returns only this organization's rows
        const [a, g] = await Promise.all([
            supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }),
            supabase.from("groups").select("id, name, display_name").order("name"),
        ]);
        if (a.error) setError(a.error.message);
        else setItems((a.data ?? []) as Ann[]);
        if (!g.error) setGroups((g.data ?? []) as GroupOption[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.display_name || g.name])), [groups]);

    const audience = (a: Ann) => {
        const ids = a.group_ids ?? [];
        if (ids.length === 0) return ["Everyone"];
        return ids.map((id) => groupName.get(id) ?? "Deleted group");
    };

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError("");
        setOpen(true);
    };

    const openEdit = (a: Ann) => {
        setEditing(a);
        setForm({
            title: a.title,
            body: a.body ?? "",
            everyone: (a.group_ids ?? []).length === 0,
            groups: a.group_ids ?? [],
            pinned: a.pinned,
            expires: toDateInput(a.expires_at),
        });
        setFormError("");
        setOpen(true);
    };

    const toggleGroup = (id: string) =>
        setForm((f) => ({ ...f, groups: f.groups.includes(id) ? f.groups.filter((x) => x !== id) : [...f.groups, id] }));

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.everyone && form.groups.length === 0) return setFormError("Pick at least one group, or choose Everyone.");
        setSaving(true);
        setFormError("");

        const row = {
            title: form.title.trim(),
            body: form.body.trim() || null,
            group_ids: form.everyone ? null : form.groups,
            pinned: form.pinned,
            expires_at: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null,
        };

        let msg = "";
        if (editing) {
            const { error: err } = await supabase.from("announcements").update(row).eq("id", editing.id);
            if (err) msg = err.message;
        } else {
            const { data } = await supabase.auth.getUser();
            const orgName = data.user?.app_metadata?.org_name as string | undefined;
            if (!orgName) msg = "Your account has no organization name. Sign in again.";
            else {
                const { error: err } = await supabase.from("announcements").insert({ ...row, org_name: orgName });
                if (err) msg = err.message;
            }
        }

        setSaving(false);
        if (msg) return setFormError(msg);
        setOpen(false);
        flash(editing ? "Announcement updated." : "Announcement published. Employees see it on their dashboard.");
        await load();
    };

    const remove = async (a: Ann) => {
        if (!window.confirm(`Delete "${a.title}"? Employees will no longer see it.`)) return;
        const { error: err } = await supabase.from("announcements").delete().eq("id", a.id);
        if (err) setError(err.message);
        else {
            flash("Announcement deleted.");
            await load();
        }
    };

    return (
        <div className="adm-page">
            <div className="pg-head">
                <div>
                    <h1 style={{ margin: 0 }}>Announcements</h1>
                    <p className="av-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                        Write once. Employees see it on their dashboard, for everyone or only for the groups you choose.
                    </p>
                </div>
                <div className="pg-actions">
                    <button className="btn" onClick={load} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <button className="btn primary" onClick={openAdd}>
                        <Plus size={16} /> New
                    </button>
                </div>
            </div>

            {notice && <p className="av-notice">{notice}</p>}
            {error && <p className="err">{error}</p>}

            {loading && <div className="tbl-wrap"><TableSkeleton rows={3} /></div>}

            {!loading && items.length === 0 && !error && (
                <div className="tbl-wrap">
                    <EmptyState
                        icon={Megaphone}
                        title="No announcements yet"
                        text="Share news, reminders or policy updates with your employees."
                        action={<button className="btn primary" onClick={openAdd}><Plus size={16} /> New announcement</button>}
                    />
                </div>
            )}

            <div className="av-stack">
                {items.map((a) => (
                    <div key={a.id} className="av-org-card" style={expired(a) ? { opacity: 0.65 } : undefined}>
                        <div className="av-card-head">
                            <div className="grow">
                                <strong style={{ whiteSpace: "normal" }}>
                                    {a.pinned && <Pin size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />}
                                    {a.title}
                                </strong>
                                <span className="av-sub-text">
                                    {timeAgo(a.created_at)}
                                    {a.expires_at && ` · ${expired(a) ? "expired" : "ends"} ${new Date(a.expires_at).toLocaleDateString()}`}
                                </span>
                            </div>
                            {expired(a) && <span className="av-badge disabled">Expired</span>}
                        </div>
                        {a.body && <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", color: "var(--tx2)" }}>{a.body}</p>}
                        <div className="av-chips">
                            {audience(a).map((n, i) => <span key={i} className="av-chip">{n}</span>)}
                        </div>
                        <div className="av-card-actions" style={{ marginTop: 0 }}>
                            <button className="btn sm" onClick={() => openEdit(a)}><Pencil size={14} /> Edit</button>
                            <button className="btn sm danger" onClick={() => remove(a)}><Trash2 size={14} /> Delete</button>
                            <span style={{ flex: 1 }} />
                        </div>
                    </div>
                ))}
            </div>

            {open && (
                <div className="modal-bg" onMouseDown={() => !saving && setOpen(false)}>
                    <form className="modal av-modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{editing ? "Edit announcement" : "New announcement"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <label className="mf">
                            Title
                            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Office closed on Friday" required maxLength={120} />
                        </label>

                        <label className="mf">
                            Message
                            <textarea className="ui-textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the details here…" />
                        </label>

                        <div className="mf">
                            Who should see it
                            <div className="av-block" style={{ marginTop: 4 }}>
                                <label className="ui-check">
                                    <input type="radio" name="aud" checked={form.everyone} onChange={() => setForm({ ...form, everyone: true })} />
                                    Everyone in the organization
                                </label>
                                <label className="ui-check">
                                    <input type="radio" name="aud" checked={!form.everyone} onChange={() => setForm({ ...form, everyone: false })} />
                                    Only selected groups
                                </label>
                                {!form.everyone && (
                                    groups.length === 0 ? (
                                        <span className="av-muted" style={{ fontSize: 13 }}>You have no groups yet. Create one on the Groups page.</span>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 24 }}>
                                            {groups.map((g) => (
                                                <label key={g.id} className="ui-check">
                                                    <input type="checkbox" checked={form.groups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                                                    {g.display_name || g.name}
                                                </label>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <label className="mf">
                                Hide after (optional)
                                <input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
                            </label>
                            <div className="mf">
                                Pin
                                <label className="ui-check" style={{ height: 40 }}>
                                    <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                                    Keep at the top
                                </label>
                            </div>
                        </div>

                        {formError && <p className="err">{formError}</p>}

                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={saving}>
                                {saving ? <Loader2 size={15} className="spin" /> : editing ? "Save" : "Publish"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
