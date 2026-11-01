import { Users, Building2, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import "./dash.css";

// Sample data for the layout. Replace with real queries later.
const signups = [
    { day: "Mon", users: 12 }, { day: "Tue", users: 19 }, { day: "Wed", users: 8 },
    { day: "Thu", users: 24 }, { day: "Fri", users: 17 }, { day: "Sat", users: 6 }, { day: "Sun", users: 9 },
];

export default function AdminDashboard() {
    return (
        <main className="dash-main" style={{ width: "100%" }}>
            <div>
                <h1>Dashboard</h1>
                <p className="dash-sub">Overview of users and organizations. (Figures below are sample data.)</p>
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
                <div style={{ width: "100%", height: 260 }}>
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
        </main>
    );
}
