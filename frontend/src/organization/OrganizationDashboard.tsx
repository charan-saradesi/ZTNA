import { useEffect, useState } from "react";
import { Building2, Users, ShieldCheck } from "lucide-react";
import { supabase } from "../supabase";
import "../dash.css";

export default function OrganizationDashboard() {
    const [orgName, setOrgName] = useState("");

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setOrgName((data.user?.app_metadata?.org_name as string | undefined) ?? "");
        });
    }, []);

    return (
        <main className="dash-main" style={{ width: "100%" }}>
            <div>
                <h1>Welcome, {orgName || "organization"}</h1>
                <p className="dash-sub">This is your organization dashboard.</p>
            </div>

            <div className="dash-grid">
                <div className="dash-card">
                    <h3><Building2 size={15} /> Organization</h3>
                    <div className="dash-num" style={{ fontSize: 18 }}>{orgName || "—"}</div>
                    <div className="dash-note">Signed in with your organization login</div>
                </div>
                <div className="dash-card">
                    <h3><Users size={15} /> Users</h3>
                    <div className="dash-num">0</div>
                    <div className="dash-note">User management coming soon</div>
                </div>
                <div className="dash-card">
                    <h3><ShieldCheck size={15} /> Status</h3>
                    <div className="dash-num" style={{ fontSize: 18 }}>Active</div>
                    <div className="dash-note">Your login is working</div>
                </div>
            </div>
        </main>
    );
}
