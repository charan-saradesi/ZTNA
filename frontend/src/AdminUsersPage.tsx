import { useMemo, useState } from "react";
import { RefreshCw, Search, ChevronRight, ChevronDown } from "lucide-react";
import { useAdminData, invokeFn, groupLabel, fullName } from "./adminData";
import type { Usr } from "./adminData";
import "./admin.css";
import "./adminviews.css";

type View = "grouped" | "flat";

type TableProps = {
    list: Usr[];
    showGroup: boolean;
    groupName: Map<string, string>;
    onDelete: (u: Usr) => void;
};

function UserTable({ list, showGroup, groupName, onDelete }: TableProps) {
    return (
        <div className="av-inner">
            <table className="tbl">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Email</th>
                        {showGroup && <th>Group</th>}
                        <th>Added</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((u) => (
                        <tr key={u.id}>
                            <td>{u.username}</td>
                            <td>{fullName(u) || "—"}</td>
                            <td>{u.email ?? "—"}</td>
                            {showGroup && <td>{u.group_id ? groupName.get(u.group_id) ?? "—" : "No group"}</td>}
                            <td className="num">{new Date(u.created_at).toLocaleString()}</td>
                            <td>
                                <div className="act">
                                    <button className="btn sm danger" onClick={() => onDelete(u)}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AdminUsersPage() {
    const { orgs, groups, users, loading, error: loadError, reload } = useAdminData();

    const [q, setQ] = useState("");
    const [org, setOrg] = useState("");
    const [view, setView] = useState<View>("grouped");
    const [closed, setClosed] = useState<Set<string>>(new Set()); // collapsed organizations
    const [actionError, setActionError] = useState("");

    const groupName = useMemo(() => {
        const m = new Map<string, string>();
        groups.forEach((g) => m.set(g.id, groupLabel(g)));
        return m;
    }, [groups]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return users.filter(
            (u) =>
                (!org || u.org_name === org) &&
                (!t ||
                    u.username.toLowerCase().includes(t) ||
                    fullName(u).toLowerCase().includes(t) ||
                    (u.email ?? "").toLowerCase().includes(t) ||
                    u.org_name.toLowerCase().includes(t) ||
                    (u.group_id ? (groupName.get(u.group_id) ?? "").toLowerCase().includes(t) : false))
        );
    }, [users, q, org, groupName]);

    // Organization -> group -> users
    const tree = useMemo(() => {
        const names = Array.from(new Set(filtered.map((u) => u.org_name))).sort((a, b) => a.localeCompare(b));
        return names.map((name) => {
            const inOrg = filtered.filter((u) => u.org_name === name);
            const orgGroups = groups.filter((g) => g.org_name === name).sort((a, b) => groupLabel(a).localeCompare(groupLabel(b)));
            const buckets = orgGroups
                .map((g) => ({ key: g.id, title: groupLabel(g), none: false, users: inOrg.filter((u) => u.group_id === g.id) }))
                .filter((b) => b.users.length > 0);
            const known = new Set(orgGroups.map((g) => g.id));
            const ungrouped = inOrg.filter((u) => !u.group_id || !known.has(u.group_id));
            if (ungrouped.length > 0) buckets.push({ key: "none", title: "No group", none: true, users: ungrouped });
            return { name, display: orgs.find((o) => o.name === name)?.display_name || name, total: inOrg.length, buckets };
        });
    }, [filtered, groups, orgs]);

    const toggleOrg = (name: string) =>
        setClosed((s) => {
            const n = new Set(s);
            if (n.has(name)) n.delete(name);
            else n.add(name);
            return n;
        });

    const remove = async (u: Usr) => {
        setActionError("");
        if (!window.confirm(`Delete user "${u.username}"? This also deletes their login.`)) return;
        const msg = await invokeFn("manage-user", { action: "delete", id: u.id });
        if (msg) setActionError(msg);
        else await reload();
    };

    const error = actionError || loadError;

    return (
        <div className="adm-page">
            <div className="pg-head">
                <div>
                    <h1 style={{ margin: 0 }}>Users</h1>
                    <p className="av-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                        Users are added by their organization. Shown here by organization and group.
                    </p>
                </div>
                <div className="pg-actions">
                    <div className="av-seg" role="group" aria-label="View">
                        <button className={view === "grouped" ? "on" : ""} onClick={() => setView("grouped")}>By group</button>
                        <button className={view === "flat" ? "on" : ""} onClick={() => setView("flat")}>All users</button>
                    </div>
                    <select
                        className="av-select"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        aria-label="Filter by organization"
                    >
                        <option value="">All organizations</option>
                        {orgs.map((o) => (
                            <option key={o.id} value={o.name}>{o.display_name || o.name}</option>
                        ))}
                    </select>
                    <div className="pg-search">
                        <Search size={15} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" />
                    </div>
                    <button className="btn" onClick={reload} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                </div>
            </div>

            {error && <p className="err">{error}</p>}

            {loading && <div className="tbl-wrap"><div className="empty">Loading…</div></div>}

            {!loading && filtered.length === 0 && (
                <div className="tbl-wrap">
                    <div className="empty">
                        {q || org ? "No matching users" : "No users yet. Organizations add users from their own panel."}
                    </div>
                </div>
            )}

            {!loading && filtered.length > 0 && view === "flat" && (
                <div className="av-sec" style={{ padding: 16 }}>
                    <UserTable list={filtered} showGroup groupName={groupName} onDelete={remove} />
                </div>
            )}

            {!loading && filtered.length > 0 && view === "grouped" && (
                <div className="av-stack">
                    {tree.map((o) => {
                        const isClosed = closed.has(o.name);
                        return (
                            <section key={o.name} className="av-sec">
                                <button className="av-sec-head" onClick={() => toggleOrg(o.name)}>
                                    {isClosed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                                    <span>{o.display}</span>
                                    {o.display !== o.name && <span className="av-muted" style={{ fontWeight: 400, fontSize: 13 }}>({o.name})</span>}
                                    <span className="grow" />
                                    <span className="av-count">
                                        {o.total} user{o.total === 1 ? "" : "s"} · {o.buckets.length} group{o.buckets.length === 1 ? "" : "s"}
                                    </span>
                                </button>

                                {!isClosed && (
                                    <div className="av-sec-body">
                                        {o.buckets.map((b) => (
                                            <div key={b.key}>
                                                <div className={`av-bucket-title ${b.none ? "none" : ""}`}>
                                                    <span className="dot" />
                                                    {b.title}
                                                    <span className="av-count">{b.users.length}</span>
                                                </div>
                                                <UserTable list={b.users} showGroup={false} groupName={groupName} onDelete={remove} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="av-count">{filtered.length} user{filtered.length === 1 ? "" : "s"} shown</div>
            )}
        </div>
    );
}
