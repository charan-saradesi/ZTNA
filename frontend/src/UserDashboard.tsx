import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useUser, useClerk } from "@clerk/react";
import {
    LogOut, ChevronDown, Building2, Users, CalendarDays, Mail, FolderOpen, MessageSquare,
    LifeBuoy, Laptop, Receipt, BookOpen, KeyRound, Loader2,
} from "lucide-react";
import "./userdash.css";

// ---- Sample content: replace with real data later ----
const TILES = [
    { icon: Mail, title: "Mail", note: "Check your inbox" },
    { icon: FolderOpen, title: "Files", note: "Shared documents" },
    { icon: MessageSquare, title: "Chat", note: "Team messages" },
    { icon: CalendarDays, title: "Calendar", note: "Meetings & events" },
    { icon: Receipt, title: "Payslips", note: "Salary & expenses" },
    { icon: Laptop, title: "IT Support", note: "Request help" },
    { icon: BookOpen, title: "Handbook", note: "Policies & guides" },
    { icon: LifeBuoy, title: "Help Desk", note: "Ask a question" },
];

const ANNOUNCEMENTS = [
    { title: "Welcome to the new employee portal", body: "Your single place for apps, documents and company news.", when: "Today" },
    { title: "Security reminder", body: "Use a strong, unique password and never share it with anyone.", when: "2 days ago" },
    { title: "Holiday calendar published", body: "Next year's company holidays are now available in the Handbook.", when: "Last week" },
];

type Meta = { org_name?: string; group_name?: string };

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const errText = (e: unknown) => {
    const x = e as { errors?: { longMessage?: string; message?: string }[]; message?: string };
    return x?.errors?.[0]?.longMessage ?? x?.errors?.[0]?.message ?? x?.message ?? "Something went wrong";
};

export default function UserDashboard() {
    const { user } = useUser();
    const { signOut } = useClerk();

    const [now, setNow] = useState(new Date());
    const [menuOpen, setMenuOpen] = useState(false);

    // change password dialog
    const [pwOpen, setPwOpen] = useState(false);
    const [curPw, setCurPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [busy, setBusy] = useState(false);
    const [pwErr, setPwErr] = useState("");
    const [pwOk, setPwOk] = useState("");

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    const meta = (user?.publicMetadata ?? {}) as Meta;
    const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    const display = fullName || user?.username || "there";
    const initial = (display[0] ?? "U").toUpperCase();
    const email = user?.primaryEmailAddress?.emailAddress;

    const changePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setBusy(true);
        setPwErr("");
        setPwOk("");
        try {
            await user.updatePassword({ currentPassword: curPw, newPassword: newPw });
            setPwOk("Password updated.");
            setCurPw("");
            setNewPw("");
        } catch (err) {
            setPwErr(errText(err));
        } finally {
            setBusy(false);
        }
    };

    const closePw = () => {
        setPwOpen(false);
        setPwErr("");
        setPwOk("");
        setCurPw("");
        setNewPw("");
    };

    return (
        <div className="ud">
            <header className="ud-top">
                <div className="ud-brand">
                    <div className="ud-logo" /> ZTNA
                    {meta.org_name && <span className="ud-org">{meta.org_name}</span>}
                </div>

                <div className="ud-user">
                    <button className="ud-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                        <div className="ud-avatar">{initial}</div>
                        {display} <ChevronDown size={15} />
                    </button>
                    {menuOpen && (
                        <div className="ud-menu">
                            <p>{user?.username ?? email}</p>
                            <button onClick={() => { setMenuOpen(false); setPwOpen(true); }}>
                                <KeyRound size={15} /> Change password
                            </button>
                            <button onClick={() => signOut({ redirectUrl: "/login" })}>
                                <LogOut size={15} /> Sign out
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="ud-main">
                {/* Hero */}
                <section className="ud-hero">
                    <div>
                        <p className="ud-date">
                            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        <h1>{greeting()}, {user?.firstName || display}</h1>
                        <div className="ud-chips">
                            <span className="ud-chip"><Building2 size={14} /> {meta.org_name ?? "No organization"}</span>
                            <span className="ud-chip"><Users size={14} /> {meta.group_name || "No group"}</span>
                        </div>
                    </div>
                    <div className="ud-clock">
                        <b>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
                        <span>Local time</span>
                    </div>
                </section>

                <div className="ud-grid">
                    <div className="ud-col">
                        {/* Quick links */}
                        <section className="ud-card">
                            <div className="ud-card-head">
                                <h2>My apps</h2>
                                <span className="ud-tag">Sample</span>
                            </div>
                            <div className="ud-tiles">
                                {TILES.map(({ icon: Icon, title, note }) => (
                                    <button key={title} className="ud-tile" type="button">
                                        <span className="ic"><Icon size={18} /></span>
                                        <span>
                                            <strong>{title}</strong>
                                            <br />
                                            <small>{note}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Announcements */}
                        <section className="ud-card">
                            <div className="ud-card-head">
                                <h2>Announcements</h2>
                                <span className="ud-tag">Sample</span>
                            </div>
                            <div className="ud-list">
                                {ANNOUNCEMENTS.map((a) => (
                                    <div key={a.title} className="ud-item">
                                        <span className="ud-dot" />
                                        <div>
                                            <h3>{a.title}</h3>
                                            <p>{a.body}</p>
                                        </div>
                                        <time>{a.when}</time>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="ud-col">
                        {/* Profile */}
                        <section className="ud-card">
                            <div className="ud-card-head"><h2>My profile</h2></div>
                            <div className="ud-prof">
                                <div className="ud-avatar">{initial}</div>
                                <div>
                                    <strong>{display}</strong>
                                    <span>@{user?.username ?? "—"}</span>
                                </div>
                            </div>
                            <div className="ud-rows">
                                <div className="ud-row"><span>Organization</span><b>{meta.org_name ?? "—"}</b></div>
                                <div className="ud-row"><span>Group</span><b>{meta.group_name || "—"}</b></div>
                                <div className="ud-row"><span>Email</span><b>{email ?? "Not added"}</b></div>
                                <div className="ud-row">
                                    <span>Last sign-in</span>
                                    <b>{user?.lastSignInAt ? user.lastSignInAt.toLocaleString() : "—"}</b>
                                </div>
                                <div className="ud-row">
                                    <span>Member since</span>
                                    <b>{user?.createdAt ? user.createdAt.toLocaleDateString() : "—"}</b>
                                </div>
                            </div>
                            <button className="ud-btn" onClick={() => setPwOpen(true)}>
                                <KeyRound size={15} /> Change password
                            </button>
                        </section>
                    </div>
                </div>
            </main>

            {pwOpen && (
                <div className="ud-modal-bg" onMouseDown={() => !busy && closePw()}>
                    <form className="ud-modal" onSubmit={changePassword} onMouseDown={(e) => e.stopPropagation()}>
                        <h2>Change password</h2>

                        <label className="ud-field">
                            Current password
                            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />
                        </label>
                        <label className="ud-field">
                            New password
                            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" minLength={8} required />
                        </label>

                        {pwErr && <p className="ud-err">{pwErr}</p>}
                        {pwOk && <p className="ud-ok">{pwOk}</p>}

                        <div className="ud-foot">
                            <button type="button" className="ud-btn" onClick={closePw} disabled={busy}>Close</button>
                            <button type="submit" className="ud-btn primary" disabled={busy}>
                                {busy ? <Loader2 size={15} className="ud-spin" /> : "Update"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
