import { Fragment, useMemo, useState } from "react";
import { RefreshCw, Search, ChevronRight, ChevronDown } from "lucide-react";
import { useAdminData, groupLabel, fullName } from "./adminData";
import type { Usr } from "./adminData";
import "./admin.css";
import "./adminviews.css";

const PAGE_SIZE = 10;

export default function AdminGroupsPage() {
    const { orgs, groups, users, loading, error, reload } = useAdminData();

    const [q, setQ] = useState("");
    const [org, setOrg] = useState("");
    const [page, setPage] = useState(1);
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());

    // Members of each group
    const members = useMemo(() => {
        const m = new Map<string, Usr[]>();
        users.forEach((u) => {
            if (!u.group_id) return;
            m.set(u.group_id, [...(m.get(u.group_id) ?? []), u]);
        });
        return m;
    }, [users]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return groups
            .filter((g) => !org || g.org_name === org)
            .filter(
                (g) =>
                    !t ||
                    g.name.toLowerCase().includes(t) ||
                    (g.display_name ?? "").toLowerCase().includes(t) ||
                    g.org_name.toLowerCase().includes(t)
            )
            .sort((a, b) => a.org_name.localeCompare(b.org_name) || groupLabel(a).localeCompare(groupLabel(b)));
    }, [groups, q, org]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const toggle = (id: string) =>
        setOpenIds((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    return (
        <div className="adm-page">
            <div className="pg-head">
                <div>
                    <h1 style={{ margin: 0 }}>Groups</h1>
                    <p className="av-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                        Groups are created by each organization. Click a row to see its users.
                    </p>
                </div>
                <div className="pg-actions">
                    <select
                        className="av-select"
                        value={org}
                        onChange={(e) => { setOrg(e.target.value); setPage(1); }}
                        aria-label="Filter by organization"
                    >
                        <option value="">All organizations</option>
                        {orgs.map((o) => (
                            <option key={o.id} value={o.name}>{o.display_name || o.name}</option>
                        ))}
                    </select>
                    <div className="pg-search">
                        <Search size={15} />
                        <input
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setPage(1); }}
                            placeholder="Search groups"
                        />
                    </div>
                    <button className="btn" onClick={reload} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                </div>
            </div>

            {error && <p className="err">{error}</p>}

            <div className="tbl-wrap">
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>Group</th>
                            <th>Organization</th>
                            <th>Users</th>
                            <th>Created time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((g) => {
                            const list = members.get(g.id) ?? [];
                            const isOpen = openIds.has(g.id);
                            return (
                                <Fragment key={g.id}>
                                    <tr className="av-click" onClick={() => toggle(g.id)}>
                                        <td>
                                            <span className="av-chev">
                                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </span>
                                            {groupLabel(g)}
                                            {g.display_name && <span className="av-muted"> ({g.name})</span>}
                                        </td>
                                        <td>{g.org_name}</td>
                                        <td className="av-num">{list.length}</td>
                                        <td className="num">{new Date(g.created_at).toLocaleString()}</td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="av-expand">
                                            <td colSpan={4}>
                                                {list.length === 0 ? (
                                                    <span className="av-muted" style={{ fontSize: 13 }}>No users in this group yet</span>
                                                ) : (
                                                    <div className="av-chips">
                                                        {list.map((u) => (
                                                            <span key={u.id} className="av-chip" title={u.email ?? ""}>
                                                                {u.username}
                                                                {fullName(u) && <span className="av-muted"> · {fullName(u)}</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {!loading && rows.length === 0 && (
                    <div className="empty">
                        {q || org ? "No matching groups" : "No groups yet. Organizations create groups from their own panel."}
                    </div>
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
        </div>
    );
}

