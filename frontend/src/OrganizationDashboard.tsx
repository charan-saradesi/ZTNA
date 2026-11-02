import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Building2, Users, ShieldCheck } from "lucide-react";
import { supabase } from "./supabase";
import "./dash.css";

export default function OrganizationDashboard() {
    const navigate = useNavigate();
    const [orgName, setOrgName] = useState("");
    const [displayName, setDisplayName] = useState("");

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getUser();
            const name = (data.user?.app_metadata?.org_name as string | undefined) ?? "";
            setOrgName(name);

            // An organization can only read its own row if you add a policy for it (optional).
            // For now we just show the login name.
            setDisplayName(name);
        })();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <div className="dash">
            <header className="dash-top">
                <div className="dash-brand">
                    <div className="dash-logo" /> ZTNA <span className="dash-badge">ORGANIZATION</span>
                </div>
                <div className="dash-right">
                    <span>{orgName}</span>
                    <button className="dash-out" onClick={signOut}>
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </header>

            <main className="dash-main">
                <div>
                    <h1>Welcome, {displayName || "organization"}</h1>
                    <p className="dash-sub">This is your organization dashboard.</p>
                </div>

                <div className="dash-grid">
                    <div className="dash-card">
                        <h3><Building2 size={15} /> Organization</h3>
                        <div className="dash-num" style={{ fontSize: 18 }}>{orgName || "—"}</div>
                        <div className="dash-note">Signed in with your organization login</div>
                    </div>
                    <div className="dash-card">
                        <h3><Users size={15} /> Members</h3>
                        <div className="dash-num">0</div>
                        <div className="dash-note">Member management coming soon</div>
                    </div>
                    <div className="dash-card">
                        <h3><ShieldCheck size={15} /> Status</h3>
                        <div className="dash-num" style={{ fontSize: 18 }}>Active</div>
                        <div className="dash-note">Your login is working</div>
                    </div>
                </div>
            </main>
        </div>
    );
}
