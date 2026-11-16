import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, MonitorSmartphone, LogOut } from "lucide-react";
import { invokeFn, invokeFnData } from "./adminData";
import { EmptyState, TableSkeleton, timeAgo } from "./ui";
import "./admin.css";
import "./adminviews.css";

type Sess = {
    session_id: string;
    clerk_user_id: string;
    username: string;
    name: string;
    org_name: string;
    started_at: string | null;
    last_active_at: string | null;
    browser: string | null;
    device: string | null;
    location: string | null;
    ip: string | null;
};

type ListResult = { sessions: Sess[]; truncated: boolean };

const REFRESH_MS = 30_000;

export default function AdminSessionsPage() {
    const [sessions, setSessions] = useState<Sess[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState("");

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        const { error: err, data } = await invokeFnData<ListResult>("manage-sessions", { action: "list" });
        if (err) setError(err);
        else {
            setError("");
            setSessions(data?.sessions ?? []);
            setTruncated(!!data?.truncated);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const t = window.setInterval(() => load(true), REFRESH_MS); // stays fresh without clicking
        return () => window.clearInterval(t);
    }, [load]);

    const flash = (text: string) => {
        setNotice(text);
        window.setTimeout(() => setNotice(""), 5000);
    };

    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        return sessions
            .filter(
                (s) =>
                    !t ||
                    s.username.toLowerCase().includes(t) ||
                    s.name.toLowerCase().includes(t) ||
                    s.org_name.toLowerCase().includes(t) ||
                    (s.location ?? "").toLowerCase().includes(t) ||
                    (s.ip ?? "").includes(t)
            )
            .sort((a, b) => new Date(b.last_active_at ?? 0).getTime() - new Date(a.last_active_at ?? 0).getTime());
    }, [sessions, q]);

    const peopleOnline = new Set(sessions.map((s) => s.clerk_user_id)).size;
    const perUser = useMemo(() => {
        const m = new Map<string, number>();
        sessions.forEach((s) => m.set(s.clerk_user_id, (m.get(s.clerk_user_id) ?? 0) + 1));
        return m;
    }, [sessions]);

    const signOut = async (s: Sess) => {
        if (!window.confirm(`Sign out ${s.username} on this device? They can sign in again with their password.`)) return;
        setBusy(s.session_id);
        const msg = await invokeFn("manage-sessions", { action: "revoke", session_id: s.session_id });
        setBusy("");
        if (msg) return setError(msg);
        flash(`${s.username} was signed out.`);
        await load(true);
    };

    const signOutAll = async (s: Sess) => {
        if (!window.confirm(`Sign ${s.username} out of all devices?`)) return;
        setBusy(s.clerk_user_id);
        const msg = await invokeFn("manage-sessions", { action: "revoke_user", clerk_user_id: s.clerk_user_id });
        setBusy("");
        if (msg) return setError(msg);
        flash(`${s.username} was signed out everywhere.`);
        await load(true);
    };

    return (
        <div className="adm-page">
            <div className="pg-head">
                <div>
                    <h1 style={{ margin: 0 }}>Sessions</h1>
                    <p className="av-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                        Employees who are signed in right now. Updates every 30 seconds.
                    </p>
                </div>
                <div className="pg-actions">
                    <div className="pg-search">
                        <Search size={15} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions" />
                    </div>
                    <button className="btn" onClick={() => load()} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                </div>
            </div>

            {notice && <p className="av-notice">{notice}</p>}
            {error && <p className="err">{error}</p>}

            <div className="av-sum">
                <div className="av-sum-card"><span>People signed in</span><b>{loading ? "…" : peopleOnline}</b></div>
                <div className="av-sum-card"><span>Active sessions</span><b>{loading ? "…" : sessions.length}</b></div>
            </div>

            <div className="tbl-wrap">
                <table className="tbl" style={{ minWidth: 900 }}>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Organization</th>
                            <th>Device</th>
                            <th>Location</th>
                            <th>Signed in</th>
                            <th>Last active</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((s) => (
                            <tr key={s.session_id}>
                                <td>
                                    <span className="av-org-name">{s.username}</span>
                                    {s.name && <span className="av-sub-text">{s.name}</span>}
                                </td>
                                <td>{s.org_name}</td>
                                <td>
                                    {s.browser ?? "—"}
                                    {s.device && <span className="av-sub-text">{s.device}</span>}
                                </td>
                                <td>
                                    {s.location ?? "—"}
                                    {s.ip && <span className="av-sub-text">{s.ip}</span>}
                                </td>
                                <td className="num">{s.started_at ? new Date(s.started_at).toLocaleString() : "—"}</td>
                                <td className="num">{timeAgo(s.last_active_at)}</td>
                                <td>
                                    <div className="act">
                                        <button className="btn sm danger" disabled={busy === s.session_id} onClick={() => signOut(s)}>
                                            <LogOut size={14} /> Sign out
                                        </button>
                                        {(perUser.get(s.clerk_user_id) ?? 0) > 1 && (
                                            <button className="btn sm" disabled={busy === s.clerk_user_id} onClick={() => signOutAll(s)}>
                                                All devices
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {loading && <TableSkeleton />}
                {!loading && !error && list.length === 0 && (
                    <EmptyState
                        icon={MonitorSmartphone}
                        title={q ? "No matching sessions" : "Nobody is signed in"}
                        text={q ? "Try a different search." : "Employees appear here while they are signed in."}
                    />
                )}
            </div>

            {truncated && <p className="av-info">Only the 300 newest users are checked. Search by username to find others.</p>}
            <p className="av-info">
                This list covers employees (User tab). To stop an organization or admin account, disable the organization
                on the Organizations page. A session that is already open can last until its token expires (about an hour).
            </p>
        </div>
    );
}
