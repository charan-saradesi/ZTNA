import { useMemo } from "react";
import { Users, Building2, Layers, UserX } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useAdminData, groupLabel, withinDays } from "./adminData";
import "./dash.css";
import "./admin.css";
import "./adminviews.css";

const TOOLTIP = { background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8 };

export default function AdminDashboard() {
    const { orgs, groups, users, loading, error } = useAdminData();

    const newOrgs = orgs.filter((o) => withinDays(o.created_at, 7)).length;
    const newUsers = users.filter((u) => withinDays(u.created_at, 7)).length;
    const unassigned = users.filter((u) => !u.group_id).length;

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

    // Users and groups for each organization (top 8)
    const perOrg = useMemo(
        () =>
            orgs
                .map((o) => ({
                    name: o.name,
                    users: users.filter((u) => u.org_name === o.name).length,
                    groups: groups.filter((g) => g.org_name === o.name).length,
                }))
                .sort((a, b) => b.users - a.users)
                .slice(0, 8),
        [orgs, users, groups]
    );

    const groupName = useMemo(() => {
        const m = new Map<string, string>();
        groups.forEach((g) => m.set(g.id, groupLabel(g)));
        return m;
    }, [groups]);

    const recent = users.slice(0, 6);

    return (
        <main className="dash-main" style={{ width: "100%" }}>
            <div>
                <h1>Dashboard</h1>
                <p className="dash-sub">Live overview of organizations, groups and users.</p>
            </div>

            {error && <p className="err">{error}</p>}

            <div className="dash-grid">
                <div className="dash-card">
                    <h3><Building2 size={15} /> Organizations</h3>
                    <div className="dash-num">{loading ? "…" : orgs.length}</div>
                    <div className="dash-note">{newOrgs} new this week</div>
                </div>
                <div className="dash-card">
                    <h3><Layers size={15} /> Groups</h3>
                    <div className="dash-num">{loading ? "…" : groups.length}</div>
                    <div className="dash-note">Across all organizations</div>
                </div>
                <div className="dash-card">
                    <h3><Users size={15} /> Users</h3>
                    <div className="dash-num">{loading ? "…" : users.length}</div>
                    <div className="dash-note">{newUsers} new this week</div>
                </div>
                <div className="dash-card">
                    <h3><UserX size={15} /> Users without a group</h3>
                    <div className="dash-num">{loading ? "…" : unassigned}</div>
                    <div className="dash-note">Not assigned to any group yet</div>
                </div>
            </div>

            <div className="dash-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))" }}>
                <div className="dash-card">
                    <h2>New users, last 7 days</h2>
                    {users.length === 0 ? (
                        <div className="av-chart-empty">No users yet</div>
                    ) : (
                        <div style={{ width: "100%", height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={perDay}>
                                    <CartesianGrid stroke="#2a2a2a" vertical={false} />
                                    <XAxis dataKey="day" stroke="#8b8b8b" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#8b8b8b" tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "#1a1a1a" }} />
                                    <Bar dataKey="users" name="Users" fill="#7c5cff" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="dash-card">
                    <h2>Users and groups per organization</h2>
                    {orgs.length === 0 ? (
                        <div className="av-chart-empty">No organizations yet</div>
                    ) : (
                        <div style={{ width: "100%", height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={perOrg}>
                                    <CartesianGrid stroke="#2a2a2a" vertical={false} />
                                    <XAxis dataKey="name" stroke="#8b8b8b" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#8b8b8b" tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "#1a1a1a" }} />
                                    <Bar dataKey="users" name="Users" fill="#7c5cff" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="groups" name="Groups" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            <div className="dash-card">
                <h2>Recently added users</h2>
                {recent.length === 0 ? (
                    <div className="av-muted" style={{ fontSize: 14 }}>
                        No users yet. Organizations add users from their own panel.
                    </div>
                ) : (
                    <table className="dash-table">
                        <thead>
                            <tr><th>Username</th><th>Organization</th><th>Group</th><th>Added</th></tr>
                        </thead>
                        <tbody>
                            {recent.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.username}</td>
                                    <td>{u.org_name}</td>
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
