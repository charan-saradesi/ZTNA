import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Users, Building2, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase";
import "./dash.css";

// Sample data for the layout. Replace with real queries later.
const signups = [
    { day: "Mon", users: 12 }, { day: "Tue", users: 19 }, { day: "Wed", users: 8 },
    { day: "Thu", users: 24 }, { day: "Fri", users: 17 }, { day: "Sat", users: 6 }, { day: "Sun", users: 9 },
];
const recent = [
    { who: "alice", action: "Signed in", time: "2 min ago" },
    { who: "acme", action: "Organization updated", time: "18 min ago" },
    { who: "bob", action: "Signed up", time: "1 hr ago" },
    { who: "carol", action: "Password changed", time: "3 hr ago" },
];

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <div className="dash">
            <header className="dash-top">
                <div className="dash-brand">
                    <div className="dash-logo" /> ZTNA <span className="dash-badge">ADMIN</span>
                </div>
                <div className="dash-right">
                    <span>{email}</span>
                    <button className="dash-out" onClick={signOut}>
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </header>

            <main className="dash-main">
                <div>
                    <h1>Admin dashboard</h1>
                    <p className="dash-sub">Manage users, organizations and activity. (Figures below are sample data.)</p>
                </div>

                <div className="dash-grid">
                    <div className="dash-card">
                        <h3><Users size={15} /> Total users</h3>
                        <div className="dash-num">1,284</div>
                        <div className="dash-note">+95 this week</div>
                    </div>
                    <div className="dash-card">
                        <h3><Building2 size={15} /> Organizations</h3>
                        <div className="dash-num">42</div>
                        <div className="dash-note">3 new this week</div>
                    </div>
                    <div className="dash-card">
                        <h3><Activity size={15} /> Active sessions</h3>
                        <div className="dash-num">216</div>
                        <div className="dash-note">Right now</div>
                    </div>
                </div>

                <div className="dash-card">
                    <h2>New users this week</h2>
                    <div style={{ width: "100%", height: 240 }}>
                        <ResponsiveContainer>
                            <BarChart data={signups}>
                                <CartesianGrid stroke="#2a2a2a" vertical={false} />
                                <XAxis dataKey="day" stroke="#8b8b8b" tickLine={false} axisLine={false} />
                                <YAxis stroke="#8b8b8b" tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8 }} />
                                <Bar dataKey="users" fill="#7c5cff" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dash-card">
                    <h2>Recent activity</h2>
                    <table className="dash-table">
                        <thead>
                            <tr><th>Who</th><th>Action</th><th>When</th></tr>
                        </thead>
                        <tbody>
                            {recent.map((r) => (
                                <tr key={r.who + r.time}>
                                    <td>{r.who}</td><td>{r.action}</td><td>{r.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
