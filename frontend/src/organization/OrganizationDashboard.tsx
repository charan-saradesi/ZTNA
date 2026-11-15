import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Layers, UserX, UserPlus, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { supabase } from "../supabase";
import "../dash.css";
import "../admin.css";
import "../adminviews.css";

type Grp = { id: string; name: string; display_name: string | null; created_at: string };
type Usr = {
    clerk_user_id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    group_id: string | null;
    created_at: string;
};

const TOOLTIP = { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 8 };
const withinDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() < days * 86_400_000;
const groupLabel = (g: Grp) => g.display_name || g.name;

export default function OrganizationDashboard() {
    const [orgName, setOrgName] = useState("");
    const [groups, setGroups] = useState<Grp[]>([]);
    const [users, setUsers] = useState<Usr[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // RLS already limits both tables to this organization's own rows
    const load = useCallback(async () => {
        setLoading(true);
        const [me, g, u] = await Promise.all([
            supabase.auth.getUser(),
            supabase.from("groups").select("*").order("name"),
            supabase.from("org_users").select("*").order("created_at", { ascending: false }),
        ]);
        setOrgName((me.data.user?.app_metadata?.org_name as string | undefined) ?? "");
        setError(g.error?.message ?? u.error?.message ?? "");
        setGroups((g.data ?? []) as Grp[]);
        setUsers((u.data ?? []) as Usr[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const newUsers = users.filter((u) => withinDays(u.created_at, 7)).length;
    const unassigned = users.filter((u) => !u.group_id).length;

    // Members per group, plus a "No group" bar when needed
    const perGroup = useMemo(() => {
        const rows = groups.map((g) => ({ name: groupLabel(g), users: users.filter((u) => u.group_id === g.id).length }));
        if (unassigned > 0) rows.push({ name: "No group", users: unassigned });
        return rows.sort((a, b) => b.users - a.users).slice(0, 8);
    }, [groups, users, unassigned]);

    // Users added on each of the last 7 days
    const perDay = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - (6 - i));
            return d;
        });
        return days.map((d) => ({
            day: d.toLocaleDateString(undefined, { weekday: "short" }),
            users: users.filter((u) => new Date(u.created_at).toDateString() === d.toDateString()).length,
        }));
    }, [users]);

    const groupName = useMemo(() => new Map(groups.map((g) => [g.id, groupLabel(g)])), [groups]);
    const recent = users.slice(0, 6);
    const empty = !loading && users.length === 0 && groups.length === 0;

    return (
        <main className="dash-main" style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1>Welcome, {orgName || "organization"}</h1>
                    <p className="dash-sub">Live overview of your groups and users.</p>
                </div>
                <div className="pg-actions">
                    <button className="btn" onClick={load} aria-label="Refresh" title="Refresh">
                        <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                    <Link to="/organization/users" className="btn primary" style={{ textDecoration: "none" }}>
                        <UserPlus size={16} /> Add user
                    </Link>
                </div>
            </div>

            {error && <p className="err">{error}</p>}

            {empty && (
                <div className="dash-card">
                    <h2>Get started</h2>
                    <p className="dash-sub" style={{ margin: "6px 0 0" }}>
                        1. Create your <Link to="/organization/groups" style={{ color: "var(--link)" }}>groups</Link> (for example teams or
                        departments). 2. Add <Link to="/organization/users" style={{ color: "var(--link)" }}>users</Link> and put each one in a
                        group. They then sign in on the User tab.
                    </p>
                </div>
            )}

            <div className="dash-grid">
                <div className="dash-card">
                    <h3><Users size={15} /> Users</h3>
                    <div className="dash-num">{loading ? "…" : users.length}</div>
                    <div className="dash-note">{newUsers} new this week</div>
                </div>
                <div className="dash-card">
                    <h3><Layers size={15} /> Groups</h3>
                    <div className="dash-num">{loading ? "…" : groups.length}</div>
                    <div className="dash-note">{groups.length === 0 ? "Create your first group" : "Teams in your organization"}</div>
                </div>
                <div className="dash-card">
                    <h3><UserX size={15} /> Users without a group</h3>
                    <div className="dash-num">{loading ? "…" : unassigned}</div>
                    <div className="dash-note">{unassigned === 0 ? "Everyone is assigned" : "Assign them from Users"}</div>
                </div>
            </div>

            <div className="dash-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))" }}>
                <div className="dash-card">
                    <h2>Users per group</h2>
                    {perGroup.length === 0 ? (
                        <div className="av-chart-empty">No groups yet</div>
                    ) : (
                        <div style={{ width: "100%", height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={perGroup}>
                                    <CartesianGrid stroke="var(--bd)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--mut)" tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--mut)" tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--hover)" }} />
                                    <Bar dataKey="users" name="Users" fill="#7c5cff" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="dash-card">
                    <h2>New users, last 7 days</h2>
                    {users.length === 0 ? (
                        <div className="av-chart-empty">No users yet</div>
                    ) : (
                        <div style={{ width: "100%", height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={perDay}>
                                    <CartesianGrid stroke="var(--bd)" vertical={false} />
                                    <XAxis dataKey="day" stroke="var(--mut)" tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--mut)" tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--hover)" }} />
                                    <Bar dataKey="users" name="Users" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            <div className="dash-card">
                <h2>Recently added users</h2>
                {recent.length === 0 ? (
                    <div className="av-muted" style={{ fontSize: 14 }}>No users yet.</div>
                ) : (
                    <table className="dash-table">
                        <thead>
                        <tr><th>Username</th><th>Name</th><th>Group</th><th>Added</th></tr>
                        </thead>
                        <tbody>
                        {recent.map((u) => (
                            <tr key={u.clerk_user_id}>
                                <td>{u.username}</td>
                                <td>{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—"}</td>
                                <td>{u.group_id ? groupName.get(u.group_id) ?? "—" : "No group"}</td>
                                <td>{new Date(u.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </main>
    );
}