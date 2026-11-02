import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, PanelLeft, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../supabase";
import "../dash.css";
import "../admin.css";

export type Item = { label: string; to: string };
export type Group = { label: string; icon: LucideIcon; items: Item[] };

type Props = {
    menu: Group[];
    roleLabel: string; // shown next to the avatar, e.g. "Organization"
    defaultOpen: string[]; // group labels that start expanded
};

// Sidebar + top bar for the organization panel. Pages render inside <Outlet />.
export default function PanelLayout({ menu, roleLabel, defaultOpen }: Props) {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [sideOpen, setSideOpen] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [who, setWho] = useState("");
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
        Object.fromEntries(defaultOpen.map((l) => [l, true]))
    );

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            const u = data.user;
            setWho((u?.app_metadata?.org_name as string | undefined) ?? u?.email ?? "");
        });
    }, []);

    const toggleGroup = (label: string) => setOpenGroups((s) => ({ ...s, [label]: !s[label] }));

    const current = menu.flatMap((g) => g.items).find((i) => pathname.startsWith(i.to));

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

                {menu.map(({ label, icon: Icon, items }) => {
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
                        <strong>{current?.label ?? roleLabel}</strong>
                    </div>

                    <div className="adm-user">
                        <button className="adm-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                            <div className="adm-avatar">{(who[0] ?? roleLabel[0]).toUpperCase()}</div>
                            {roleLabel} <ChevronDown size={15} />
                        </button>
                        {menuOpen && (
                            <div className="adm-menu">
                                <p>{who}</p>
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
