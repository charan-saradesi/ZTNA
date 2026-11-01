import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { supabase } from "../supabase";
import "../admin.css";

type GroupRow = {
    id: string;
    org_name: string;
    name: string;
    display_name: string | null;
    created_at: string;
};

type FormState = { name: string; display_name: string };
const EMPTY: FormState = { name: "", display_name: "" };
const PAGE_SIZE = 10;

const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");

export default function GroupsPage() {
    const [groups, setGroups] = useState<GroupRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<GroupRow | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        // Row Level Security returns only this organization's groups
        const { data, error: err } = await supabase
            .from("groups")
            .select("*")
            .order("created_at", { ascending: false });
        if (err) setError(err.message);
        else setGroups((data ?? []) as GroupRow[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return groups;
        return groups.filter(
            (g) => g.name.toLowerCase().includes(t) || (g.display_name ?? "").toLowerCase().includes(t)
        );
    }, [groups, q]);

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
        setForm({ name: g.name, display_name: g.display_name ?? "" });
        setFormError("");
        setOpen(true);
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        let errMsg = "";

        if (editing) {
            const { error: err } = await supabase
                .from("groups")
                .update({ display_name: form.display_name.trim() || null })
                .eq("id", editing.id);
            if (err) errMsg = err.message;
        } else {
            const { data } = await supabase.auth.getUser();
            const orgName = data.user?.app_metadata?.org_name as string | undefined;
            if (!orgName) {
                errMsg = "Your account has no organization name. Sign in again.";
            } else {
                const { error: err } = await supabase.from("groups").insert({
                    org_name: orgName,
                    name: slug(form.name),
                    display_name: form.display_name.trim() || null,
                });
                if (err) errMsg = err.code === "23505" ? "A group with this name already exists" : err.message;
            }
        }

        setSaving(false);
        if (errMsg) return setFormError(errMsg);

        setOpen(false);
        await load();
    };

    const remove = async (g: GroupRow) => {
        if (!window.confirm(`Delete group "${g.name}"?`)) return;
        const { error: err } = await supabase.from("groups").delete().eq("id", g.id);
        if (err) setError(err.message);
        else await load();
    };

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Groups</h1>
                <div className="pg-actions">
                    <div className="pg-search">
                        <Search size={15} />
                        <input
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setPage(1); }}
                            placeholder="Search groups"
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
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((g) => (
                            <tr key={g.id}>
                                <td>{g.name}</td>
                                <td className="num">{new Date(g.created_at).toLocaleString()}</td>
                                <td>{g.display_name ?? "—"}</td>
                                <td>
                                    <div className="act">
                                        <button className="btn sm" onClick={() => openEdit(g)}>Edit</button>
                                        <button className="btn sm danger" onClick={() => remove(g)}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && rows.length === 0 && (
                    <div className="empty">{q ? "No matching groups" : "No groups yet. Click Add to create one."}</div>
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
                            <h2>{editing ? "Edit group" : "Add group"}</h2>
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
                                disabled={!!editing}
                                required
                            />
                            <small>{editing ? "Name can't be changed" : "Unique within your organization. Spaces become dashes."}</small>
                        </label>

                        <label className="mf">
                            Display name
                            <input
                                value={form.display_name}
                                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                                placeholder="e.g. Engineering Team"
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
