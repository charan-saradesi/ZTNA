import { useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import {
    Plus, RefreshCw, Search, X, Loader2, Ellipsis, LayoutList, LayoutGrid,
    Mail, Phone, MapPin, Globe, Briefcase, KeyRound, Pencil, Power, Trash2, Type,
} from "lucide-react";
import { useAdminData, invokeFn, invokeFnDetailed, groupLabel, fullName } from "./adminData";
import type { Org } from "./adminData";
import "./admin.css";
import "./adminviews.css";

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Manufacturing", "Retail", "Government", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const PAGE_SIZE = 10;

type FormState = {
    name: string;
    password: string;
    display_name: string;
    website_url: string;
    industry: string;
    company_size: string;
    contact_name: string;
    contact_email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    notes: string;
};

const EMPTY: FormState = {
    name: "", password: "", display_name: "", website_url: "", industry: "", company_size: "",
    contact_name: "", contact_email: "", phone: "", address: "", city: "", country: "", notes: "",
};

type StatusFilter = "all" | "active" | "disabled";
type SortBy = "newest" | "name" | "users";
type ViewMode = "table" | "cards";
type MenuState = { org: Org; right: number; top?: number; bottom?: number };

const statusOf = (o: Org): "active" | "disabled" => (o.status === "disabled" ? "disabled" : "active");
const title = (o: Org) => o.display_name || o.name;
const place = (o: Org) => [o.city, o.country].filter(Boolean).join(", ");
const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);

export default function OrganizationsPage() {
    const { orgs, groups, users, loading, error: loadError, reload } = useAdminData();

    const [actionError, setActionError] = useState("");
    const [notice, setNotice] = useState("");
    const [warning, setWarning] = useState("");

    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortBy, setSortBy] = useState<SortBy>("newest");
    const [mode, setMode] = useState<ViewMode>("table");
    const [page, setPage] = useState(1);

    const [menu, setMenu] = useState<MenuState | null>(null);

    // Add / edit
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Org | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Other windows
    const [viewing, setViewing] = useState<Org | null>(null);
    const [resetFor, setResetFor] = useState<Org | null>(null);
    const [renameFor, setRenameFor] = useState<Org | null>(null);
    const [pw1, setPw1] = useState("");
    const [pw2, setPw2] = useState("");
    const [newName, setNewName] = useState("");
    const [dlgBusy, setDlgBusy] = useState(false);
    const [dlgError, setDlgError] = useState("");

    const flash = (text: string, warn = "") => {
        setNotice(text);
        setWarning(warn);
        window.setTimeout(() => setNotice(""), 5000);
    };

    // Groups / users per organization
    const counts = useMemo(() => {
        const g = new Map<string, number>();
        const u = new Map<string, number>();
        groups.forEach((x) => g.set(x.org_name, (g.get(x.org_name) ?? 0) + 1));
        users.forEach((x) => u.set(x.org_name, (u.get(x.org_name) ?? 0) + 1));
        return { g, u };
    }, [groups, users]);

    const summary = useMemo(
        () => ({
            total: orgs.length,
            active: orgs.filter((o) => statusOf(o) === "active").length,
            disabled: orgs.filter((o) => statusOf(o) === "disabled").length,
            noLogin: orgs.filter((o) => !o.auth_user_id).length,
        }),
        [orgs]
    );

    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        const out = orgs
            .filter((o) => statusFilter === "all" || statusOf(o) === statusFilter)
            .filter(
                (o) =>
                    !t ||
                    [o.name, o.display_name, o.website_url, o.contact_name, o.contact_email, o.phone, o.industry, o.city, o.country]
                        .some((v) => (v ?? "").toLowerCase().includes(t))
            );
        out.sort((a, b) => {
            if (sortBy === "name") return title(a).localeCompare(title(b));
            if (sortBy === "users") return (counts.u.get(b.name) ?? 0) - (counts.u.get(a.name) ?? 0);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return out;
    }, [orgs, q, statusFilter, sortBy, counts]);

    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    // ---------- Add / edit ----------
    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY);
        setFormError("");
        setOpen(true);
    };

    const openEdit = (o: Org) => {
        setEditing(o);
        setForm({
            name: o.name,
            password: "",
            display_name: o.display_name ?? "",
            website_url: o.website_url ?? "",
            industry: o.industry ?? "",
            company_size: o.company_size ?? "",
            contact_name: o.contact_name ?? "",
            contact_email: o.contact_email ?? "",
            phone: o.phone ?? "",
            address: o.address ?? "",
            city: o.city ?? "",
            country: o.country ?? "",
            notes: o.notes ?? "",
        });
        setFormError("");
        setOpen(true);
    };

    const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        const details = {
            display_name: form.display_name,
            website_url: form.website_url,
            industry: form.industry,
            company_size: form.company_size,
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            country: form.country,
            notes: form.notes,
        };

        const msg = editing
            ? await invokeFn("manage-organization", { action: "update", id: editing.id, ...details })
            : await invokeFn("manage-organization", { action: "create", name: form.name, password: form.password, ...details });

        setSaving(false);
        if (msg) return setFormError(msg);

        setOpen(false);
        flash(editing ? `Saved changes to "${editing.name}".` : `Organization "${form.name.trim().toLowerCase()}" created.`);
        await reload();
    };

    // ---------- Row menu ----------
    const openMenu = (e: MouseEvent<HTMLButtonElement>, org: Org) => {
        const r = e.currentTarget.getBoundingClientRect();
        const flip = r.bottom + 220 > window.innerHeight;
        setMenu({
            org,
            right: Math.max(8, window.innerWidth - r.right),
            top: flip ? undefined : r.bottom + 4,
            bottom: flip ? window.innerHeight - r.top + 4 : undefined,
        });
    };

    const pickReset = (o: Org) => {
        setMenu(null);
        setResetFor(o);
        setPw1("");
        setPw2("");
        setDlgError("");
    };

    const pickRename = (o: Org) => {
        setMenu(null);
        setRenameFor(o);
        setNewName(o.name);
        setDlgError("");
    };

    const toggleStatus = async (o: Org) => {
        setMenu(null);
        setActionError("");
        const next = statusOf(o) === "active" ? "disabled" : "active";
        if (next === "disabled" && !window.confirm(`Disable "${o.name}"?\n\nThis organization will no longer be able to sign in. Its users and data are not affected.`)) return;
        const msg = await invokeFn("manage-organization", { action: "update", id: o.id, status: next });
        if (msg) setActionError(msg);
        else {
            flash(next === "disabled" ? `"${o.name}" is now disabled.` : `"${o.name}" is active again.`);
            await reload();
        }
    };

    const remove = async (o: Org) => {
        setMenu(null);
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
        else {
            flash(`"${o.name}" deleted.`);
            await reload();
        }
    };

    // ---------- Reset password / rename ----------
    const submitReset = async (e: FormEvent) => {
        e.preventDefault();
        if (!resetFor) return;
        if (pw1 !== pw2) return setDlgError("The two passwords don't match");
        setDlgBusy(true);
        setDlgError("");
        const msg = await invokeFn("manage-organization", { action: "update", id: resetFor.id, password: pw1 });
        setDlgBusy(false);
        if (msg) return setDlgError(msg);
        flash(resetFor.auth_user_id ? `Password updated for "${resetFor.name}".` : `Login created for "${resetFor.name}".`);
        setResetFor(null);
        await reload();
    };

    const submitRename = async (e: FormEvent) => {
        e.preventDefault();
        if (!renameFor) return;
        setDlgBusy(true);
        setDlgError("");
        const res = await invokeFnDetailed("manage-organization", { action: "rename", id: renameFor.id, new_name: newName });
        setDlgBusy(false);
        if (res.error) return setDlgError(res.error);
        flash(`Renamed to "${newName.trim().toLowerCase().replace(/\s+/g, "-")}".`, res.warning);
        setRenameFor(null);
        await reload();
    };

    // ---------- Details window ----------
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
    const isDisabledMenu = menu ? statusOf(menu.org) === "disabled" : false;

    return (
        <div className="adm-page">
            <div className="pg-head">
                <h1>Organizations</h1>
                <div className="pg-actions">
                    <button className="btn" onClick={reload} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <button className="btn primary" onClick={openAdd}>
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {notice && <p className="av-notice">{notice}</p>}
            {warning && <p className="av-warn">{warning}</p>}
            {error && <p className="err">{error}</p>}

            {/* Summary */}
            <div className="av-sum">
                <div className="av-sum-card"><span>Organizations</span><b>{summary.total}</b></div>
                <div className="av-sum-card"><span>Active</span><b style={{ color: "#4ade80" }}>{summary.active}</b></div>
                <div className="av-sum-card"><span>Disabled</span><b style={{ color: summary.disabled ? "#f87171" : undefined }}>{summary.disabled}</b></div>
                <div className="av-sum-card"><span>Without a login</span><b>{summary.noLogin}</b></div>
            </div>

            {/* Toolbar */}
            <div className="pg-actions" style={{ flexWrap: "wrap" }}>
                <div className="pg-search">
                    <Search size={15} />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        placeholder="Search name, contact, industry, city…"
                        style={{ width: 280 }}
                    />
                </div>
                <select
                    className="av-select"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                    aria-label="Filter by status"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
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

            {/* Table layout */}
            {mode === "table" && (
                <div className="tbl-wrap">
                    <table className="tbl" style={{ minWidth: 1080 }}>
                        <thead>
                            <tr>
                                <th>Organization</th>
                                <th>Contact</th>
                                <th>Industry</th>
                                <th>Groups</th>
                                <th>Users</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th style={{ textAlign: "right" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((o) => {
                                const url = safeUrl(o.website_url);
                                return (
                                    <tr key={o.id}>
                                        <td>
                                            <span className="av-org-name">{title(o)}</span>
                                            <span className="av-sub-text">
                                                {o.name}
                                                {o.website_url && (url ? <> · <a href={url} target="_blank" rel="noreferrer">{o.website_url}</a></> : <> · {o.website_url}</>)}
                                            </span>
                                        </td>
                                        <td>
                                            {o.contact_name || o.contact_email || o.phone ? (
                                                <>
                                                    <span>{o.contact_name ?? "—"}</span>
                                                    <span className="av-sub-text">{[o.contact_email, o.phone].filter(Boolean).join(" · ")}</span>
                                                </>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            {o.industry ?? "—"}
                                            {(o.company_size || place(o)) && (
                                                <span className="av-sub-text">{[o.company_size && `${o.company_size} people`, place(o)].filter(Boolean).join(" · ")}</span>
                                            )}
                                        </td>
                                        <td className="av-num">{counts.g.get(o.name) ?? 0}</td>
                                        <td className="av-num">{counts.u.get(o.name) ?? 0}</td>
                                        <td>
                                            <span className={`av-badge ${statusOf(o)}`}>{statusOf(o) === "active" ? "Active" : "Disabled"}</span>
                                            {!o.auth_user_id && <div><span className="av-badge nologin">No login</span></div>}
                                        </td>
                                        <td className="num">{new Date(o.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className="act">
                                                <button className="btn sm" onClick={() => setViewing(o)}>View</button>
                                                <button className="btn sm" onClick={() => openEdit(o)}>Edit</button>
                                                <button className="btn sm" onClick={(e) => openMenu(e, o)} aria-label="More actions">
                                                    <Ellipsis size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {!loading && rows.length === 0 && (
                        <div className="empty">{q || statusFilter !== "all" ? "No matching organizations" : "No organizations yet. Click Add to create one."}</div>
                    )}
                    {loading && <div className="empty">Loading…</div>}
                </div>
            )}

            {/* Card layout */}
            {mode === "cards" && (
                <>
                    {loading && <div className="tbl-wrap"><div className="empty">Loading…</div></div>}
                    {!loading && rows.length === 0 && (
                        <div className="tbl-wrap">
                            <div className="empty">{q || statusFilter !== "all" ? "No matching organizations" : "No organizations yet. Click Add to create one."}</div>
                        </div>
                    )}
                    <div className="av-cards">
                        {rows.map((o) => (
                            <div key={o.id} className={`av-org-card ${statusOf(o) === "disabled" ? "is-disabled" : ""}`}>
                                <div className="av-card-head">
                                    <div className="av-avatar">{title(o)[0]?.toUpperCase()}</div>
                                    <div className="grow">
                                        <strong>{title(o)}</strong>
                                        <span className="av-sub-text">{o.name}</span>
                                    </div>
                                    <span className={`av-badge ${statusOf(o)}`}>{statusOf(o) === "active" ? "Active" : "Disabled"}</span>
                                </div>

                                <div className="av-lines">
                                    {o.industry && <div><Briefcase size={14} /><span>{[o.industry, o.company_size && `${o.company_size} people`].filter(Boolean).join(" · ")}</span></div>}
                                    {o.contact_name && <div><Type size={14} /><span>{o.contact_name}</span></div>}
                                    {o.contact_email && <div><Mail size={14} /><span>{o.contact_email}</span></div>}
                                    {o.phone && <div><Phone size={14} /><span>{o.phone}</span></div>}
                                    {place(o) && <div><MapPin size={14} /><span>{place(o)}</span></div>}
                                    {o.website_url && <div><Globe size={14} /><span>{o.website_url}</span></div>}
                                    {!o.industry && !o.contact_name && !o.contact_email && !o.phone && !place(o) && !o.website_url && (
                                        <div style={{ color: "#8b8b8b" }}><span>No details added yet</span></div>
                                    )}
                                    {!o.auth_user_id && <div style={{ color: "#fbbf24" }}><KeyRound size={14} /><span>No login yet</span></div>}
                                </div>

                                <div className="av-card-stats">
                                    <div><small>Groups</small><b>{counts.g.get(o.name) ?? 0}</b></div>
                                    <div><small>Users</small><b>{counts.u.get(o.name) ?? 0}</b></div>
                                </div>

                                <div className="av-card-actions">
                                    <button className="btn sm" onClick={() => setViewing(o)}>View</button>
                                    <button className="btn sm" onClick={() => openEdit(o)}>Edit</button>
                                    <button className="btn sm icon" onClick={(e) => openMenu(e, o)} aria-label="More actions">
                                        <Ellipsis size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="tbl-foot" style={{ border: "1px solid #2a2a2a", borderRadius: 12, background: "#141414" }}>
                <span>{list.length} total</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="btn sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Prev</button>
                    <span>{current} / {pages}</span>
                    <button className="btn sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
                </div>
            </div>

            {/* ---- Row menu ---- */}
            {menu && (
                <>
                    <div className="av-menu-bg" onClick={() => setMenu(null)} />
                    <div className="av-menu" style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}>
                        <button onClick={() => { setMenu(null); setViewing(menu.org); }}><Search size={15} /> View details</button>
                        <button onClick={() => { setMenu(null); openEdit(menu.org); }}><Pencil size={15} /> Edit details</button>
                        <hr />
                        <button onClick={() => pickReset(menu.org)}>
                            <KeyRound size={15} /> {menu.org.auth_user_id ? "Reset password" : "Create login"}
                        </button>
                        <button onClick={() => pickRename(menu.org)}><Type size={15} /> Rename login name</button>
                        <button onClick={() => toggleStatus(menu.org)}>
                            <Power size={15} /> {isDisabledMenu ? "Enable organization" : "Disable organization"}
                        </button>
                        <hr />
                        <button className="danger" onClick={() => remove(menu.org)}><Trash2 size={15} /> Delete</button>
                    </div>
                </>
            )}

            {/* ---- Add / Edit window ---- */}
            {open && (
                <div className="modal-bg" onMouseDown={() => !saving && setOpen(false)}>
                    <form className="modal av-modal av-wide" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{editing ? `Edit ${editing.display_name || editing.name}` : "Add organization"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        {!editing && (
                            <>
                                <div className="av-section-title">Login</div>
                                <div className="av-form-grid">
                                    <label className="mf">
                                        Login name
                                        <input value={form.name} onChange={set("name")} placeholder="e.g. acme" required />
                                        <small>Unique, lowercase. Spaces become dashes. Used to sign in.</small>
                                    </label>
                                    <label className="mf">
                                        Password
                                        <input type="password" value={form.password} onChange={set("password")} placeholder="At least 6 characters" autoComplete="new-password" required />
                                    </label>
                                </div>
                            </>
                        )}

                        <div className="av-section-title">Company</div>
                        <div className="av-form-grid">
                            <label className="mf">
                                Display name
                                <input value={form.display_name} onChange={set("display_name")} placeholder="e.g. Acme Corporation" />
                            </label>
                            <label className="mf">
                                Website URL
                                <input value={form.website_url} onChange={set("website_url")} placeholder="https://acme.com" />
                            </label>
                            <label className="mf">
                                Industry
                                <select value={form.industry} onChange={set("industry")}>
                                    <option value="">Select…</option>
                                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </label>
                            <label className="mf">
                                Company size
                                <select value={form.company_size} onChange={set("company_size")}>
                                    <option value="">Select…</option>
                                    {SIZES.map((s) => <option key={s} value={s}>{s} people</option>)}
                                </select>
                            </label>
                        </div>

                        <div className="av-section-title">Contact</div>
                        <div className="av-form-grid">
                            <label className="mf">
                                Contact person
                                <input value={form.contact_name} onChange={set("contact_name")} placeholder="e.g. Priya Sharma" />
                            </label>
                            <label className="mf">
                                Contact email
                                <input type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="priya@acme.com" />
                            </label>
                            <label className="mf av-span2">
                                Phone
                                <input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
                            </label>
                        </div>

                        <div className="av-section-title">Address</div>
                        <div className="av-form-grid">
                            <label className="mf av-span2">
                                Street address
                                <input value={form.address} onChange={set("address")} />
                            </label>
                            <label className="mf">
                                City
                                <input value={form.city} onChange={set("city")} />
                            </label>
                            <label className="mf">
                                Country
                                <input value={form.country} onChange={set("country")} />
                            </label>
                        </div>

                        <label className="mf">
                            Notes
                            <textarea value={form.notes} onChange={set("notes")} placeholder="Internal notes (only admins see these)" />
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

            {/* ---- Reset password window ---- */}
            {resetFor && (
                <div className="modal-bg" onMouseDown={() => !dlgBusy && setResetFor(null)}>
                    <form className="modal" onSubmit={submitReset} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>{resetFor.auth_user_id ? "Reset password" : "Create login"}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setResetFor(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="av-info">
                            {resetFor.auth_user_id
                                ? <>Set a new password for <b>{resetFor.name}</b>. They will use it the next time they sign in.</>
                                : <><b>{resetFor.name}</b> has no login yet. Choose a password to create one.</>}
                        </p>
                        <label className="mf">
                            New password
                            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} minLength={6} autoComplete="new-password" required />
                        </label>
                        <label className="mf">
                            Repeat password
                            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} autoComplete="new-password" required />
                        </label>
                        {dlgError && <p className="err">{dlgError}</p>}
                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setResetFor(null)} disabled={dlgBusy}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={dlgBusy}>
                                {dlgBusy ? <Loader2 size={15} className="spin" /> : "Save password"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ---- Rename window ---- */}
            {renameFor && (
                <div className="modal-bg" onMouseDown={() => !dlgBusy && setRenameFor(null)}>
                    <form className="modal" onSubmit={submitRename} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>Rename login name</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setRenameFor(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="av-info">
                            The login name is what <b>{renameFor.name}</b> types on the Organization tab. Renaming moves all of its
                            groups and users to the new name. Anyone currently signed in as this organization should sign in again.
                        </p>
                        <label className="mf">
                            New login name
                            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                            <small>Unique, lowercase. Spaces become dashes. To change only how it looks on screen, use Edit and change the display name.</small>
                        </label>
                        {dlgError && <p className="err">{dlgError}</p>}
                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => setRenameFor(null)} disabled={dlgBusy}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={dlgBusy}>
                                {dlgBusy ? <Loader2 size={15} className="spin" /> : "Rename"}
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
                            <h2>{title(viewing)}</h2>
                            <button type="button" className="adm-icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="av-rows">
                            <div className="av-row">
                                <span>Status</span>
                                <b><span className={`av-badge ${statusOf(viewing)}`}>{statusOf(viewing) === "active" ? "Active" : "Disabled"}</span></b>
                            </div>
                            <div className="av-row"><span>Login name</span><b>{viewing.name}</b></div>
                            <div className="av-row">
                                <span>Login</span>
                                <b className={viewing.auth_user_id ? "av-ok" : "av-bad"}>{viewing.auth_user_id ? "Enabled" : "No login"}</b>
                            </div>
                            <div className="av-row"><span>Display name</span><b>{viewing.display_name ?? "—"}</b></div>
                            <div className="av-row">
                                <span>Website</span>
                                <b>
                                    {safeUrl(viewing.website_url) ? (
                                        <a href={safeUrl(viewing.website_url)!} target="_blank" rel="noreferrer" style={{ color: "#b9a5ff" }}>
                                            {viewing.website_url}
                                        </a>
                                    ) : (viewing.website_url ?? "—")}
                                </b>
                            </div>
                            <div className="av-row"><span>Industry</span><b>{viewing.industry ?? "—"}</b></div>
                            <div className="av-row"><span>Company size</span><b>{viewing.company_size ? `${viewing.company_size} people` : "—"}</b></div>
                            <div className="av-row"><span>Contact person</span><b>{viewing.contact_name ?? "—"}</b></div>
                            <div className="av-row"><span>Contact email</span><b>{viewing.contact_email ?? "—"}</b></div>
                            <div className="av-row"><span>Phone</span><b>{viewing.phone ?? "—"}</b></div>
                            <div className="av-row">
                                <span>Address</span>
                                <b>{[viewing.address, viewing.city, viewing.country].filter(Boolean).join(", ") || "—"}</b>
                            </div>
                            <div className="av-row"><span>Notes</span><b style={{ whiteSpace: "pre-wrap" }}>{viewing.notes ?? "—"}</b></div>
                            <div className="av-row"><span>Created</span><b>{new Date(viewing.created_at).toLocaleString()}</b></div>
                            <div className="av-row"><span>Groups</span><b>{view.groups.length}</b></div>
                            <div className="av-row"><span>Users</span><b>{view.userTotal}</b></div>
                        </div>

                        <h3 className="av-h3">Groups and members</h3>

                        {view.groups.length === 0 && view.ungrouped.length === 0 && (
                            <div className="av-muted" style={{ fontSize: 14 }}>This organization has no groups or users yet.</div>
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
                                            <span key={u.id} className="av-chip" title={fullName(u) || u.username}>{u.username}</span>
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
                                        <span key={u.id} className="av-chip" title={fullName(u) || u.username}>{u.username}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-foot">
                            <button type="button" className="btn" onClick={() => { const o = viewing; setViewing(null); openEdit(o); }}>Edit</button>
                            <button type="button" className="btn primary" onClick={() => setViewing(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
