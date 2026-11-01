import { useUser, useClerk } from "@clerk/react";
import { LogOut, User, Bell, ShieldCheck } from "lucide-react";
import "./dash.css";

export default function UserDashboard() {
    const { user } = useUser();
    const { signOut } = useClerk();

    const displayName = user?.firstName || user?.username || "there";

    return (
        <div className="dash">
            <header className="dash-top">
                <div className="dash-brand">
                    <div className="dash-logo" /> ZTNA
                </div>
                <div className="dash-right">
                    <span>{user?.username ?? user?.primaryEmailAddress?.emailAddress}</span>
                    <button className="dash-out" onClick={() => signOut({ redirectUrl: "/login" })}>
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </header>

            <main className="dash-main">
                <div>
                    <h1>Welcome, {displayName}</h1>
                    <p className="dash-sub">This is your personal dashboard.</p>
                </div>

                <div className="dash-grid">
                    <div className="dash-card">
                        <h3><User size={15} /> Profile</h3>
                        <div className="dash-num" style={{ fontSize: 18 }}>{user?.username ?? "—"}</div>
                        <div className="dash-note">{user?.primaryEmailAddress?.emailAddress ?? "No email on file"}</div>
                    </div>
                    <div className="dash-card">
                        <h3><Bell size={15} /> Notifications</h3>
                        <div className="dash-num">0</div>
                        <div className="dash-note">You're all caught up</div>
                    </div>
                    <div className="dash-card">
                        <h3><ShieldCheck size={15} /> Account status</h3>
                        <div className="dash-num" style={{ fontSize: 18 }}>Active</div>
                        <div className="dash-note">Signed in with Clerk</div>
                    </div>
                </div>
            </main>
        </div>
    );
}
