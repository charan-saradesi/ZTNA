import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    House, LayoutGrid, Lock, ShieldCheck, Bot, Wallet, DollarSign, Settings,
    ChevronDown, ChevronUp, PanelLeft, LogOut,
} from "lucide-react";
import { supabase } from "./supabase";
import "./dash.css";
import "./admin.css";

type Item = { label: string; to: string };
type Group = { label: string; icon: typeof House; items: Item[] };

// Edit this array to change the sidebar menu
const MENU: Group[] = [
    {
        label: "Home", icon: House,
        items: [
            { label: "Dashboard", to: "/admin/dashboard" },
            { label: "Shortcuts", to: "/admin/shortcuts" },
            { label: "Apps", to: "/admin/apps" },
        ],
    },
    {
        label: "User Management", icon: LayoutGrid,
        items: [
            { label: "Organizations", to: "/admin/organizations" },
            { label: "Groups", to: "/admin/groups" },
            { label: "Users", to: "/admin/users" },
            { label: "Invitations", to: "/admin/invitations" },
        ],
    },
    { label: "Identity", icon: Lock, items: [{ label: "Providers", to: "/admin/providers" }, { label: "Sessions", to: "/admin/sessions" }] },
    { label: "Authorization", icon: ShieldCheck, items: [{ label: "Roles", to: "/admin/roles" }, { label: "Permissions", to: "/admin/permissions" }] },
    { label: "LLM AI", icon: Bot, items: [{ label: "Chats", to: "/admin/chats" }, { label: "Messages", to: "/admin/messages" }] },
    { label: "Auditing", icon: Wallet, items: [{ label: "Logs", to: "/admin/logs" }, { label: "Records", to: "/admin/records" }] },
    { label: "Business", icon: DollarSign, items: [{ label: "Products", to: "/admin/products" }, { label: "Orders", to: "/admin/orders" }] },
    { label: "Admin", icon: Settings, items: [{ label: "Settings", to: "/admin/settings" }, { label: "System info", to: "/admin/system" }] },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [sideOpen, setSideOpen] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Home: true, "User Management": true });

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    }, []);

    const toggleGroup = (label: string) => setOpenGroups((s) => ({ ...s, [label]: !s[label] }));

    const current = MENU.flatMap((g) => g.items).find((i) => pathname.startsWith(i.to));

    const signOut = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <div className="dash adm">
            <aside className={`adm-side ${sideOpen ? "" : "closed"}`}>
                <div className="adm-brand">
                    <div className="dash-logo" /> ZTNA
                </div>

                {MENU.map(({ label, icon: Icon, items }) => {
                    const open = !!openGroups[label];
                    return (
                        <div key={label}>
                            <button className="adm-group-btn" onClick={() => toggleGroup(label)}>
                                <Icon size={17} />
                                <span>{label}</span>
                                {open ? <ChevronUp size={15} className="chev" /> : <ChevronDown size={15} className="chev" />}
                            </button>
                            {open && (
                                <div className="adm-sub">
                                    {items.map((it) => (
                                        <NavLink key={it.to} to={it.to} className={({ isActive }) => `adm-link ${isActive ? "active" : ""}`}>
                                            {it.label}
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </aside>

            <div className="adm-content">
                <header className="adm-top">
                    <div className="adm-left">
                        <button className="adm-icon-btn" onClick={() => setSideOpen(!sideOpen)} aria-label="Toggle sidebar">
                            <PanelLeft size={18} />
                        </button>
                        <span>Home</span>
                        <span>›</span>
                        <strong>{current?.label ?? "Admin"}</strong>
                    </div>

                    <div className="adm-user">
                        <button className="adm-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                            <div className="adm-avatar">{(email[0] ?? "A").toUpperCase()}</div>
                            Admin <ChevronDown size={15} />
                        </button>
                        {menuOpen && (
                            <div className="adm-menu">
                                <p>{email}</p>
                                <button onClick={signOut}><LogOut size={15} /> Sign out</button>
                            </div>
                        )}
                    </div>
                </header>

                <Outlet />
            </div>
        </div>
    );
}
