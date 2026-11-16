import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import "./ui.css";

// ---------- Empty state: one look for "nothing here yet" everywhere ----------
export function EmptyState({
    icon: Icon = Inbox,
    title,
    text,
    action,
}: {
    icon?: LucideIcon;
    title: string;
    text?: string;
    action?: ReactNode;
}) {
    return (
        <div className="ui-empty">
            <div className="ui-empty-ic"><Icon size={22} /></div>
            <strong>{title}</strong>
            {text && <p>{text}</p>}
            {action}
        </div>
    );
}

// ---------- Loading skeleton: shimmering rows instead of the word "Loading…" ----------
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="ui-skel" aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="ui-skel-row">
                    <div className="ui-skel-bar w2" />
                    <div className="ui-skel-bar" />
                    <div className="ui-skel-bar" />
                    <div className="ui-skel-bar sm" />
                </div>
            ))}
        </div>
    );
}

// ---------- User health ----------
// Every wrong password lowers health by PENALTY. The count starts when the first wrong attempt
// happens and resets WINDOW_HOURS later.
export const PENALTY = 10;
export const WINDOW_HOURS = 24;

export type HealthFields = {
    failed_attempts?: number | null;
    failed_since?: string | null;
};

export function healthOf(u: HealthFields) {
    const since = u.failed_since ? new Date(u.failed_since).getTime() : 0;
    const active = (u.failed_attempts ?? 0) > 0 && since > 0 && Date.now() - since < WINDOW_HOURS * 3_600_000;
    const attempts = active ? (u.failed_attempts ?? 0) : 0;
    return {
        attempts,
        score: Math.max(0, 100 - attempts * PENALTY),
        resetsAt: active ? new Date(since + WINDOW_HOURS * 3_600_000) : null,
    };
}

export function HealthBar({ user }: { user: HealthFields }) {
    const { attempts, score, resetsAt } = healthOf(user);
    const level = score >= 80 ? "good" : score >= 50 ? "fair" : "poor";
    const tip = attempts
        ? `${attempts} wrong password attempt${attempts === 1 ? "" : "s"}. Resets ${resetsAt!.toLocaleString()}.`
        : "No wrong password attempts in the last 24 hours.";
    return (
        <div className="ui-health" title={tip}>
            <div className="ui-health-track"><div className={`ui-health-fill ${level}`} style={{ width: `${score}%` }} /></div>
            <b>{score}%</b>
        </div>
    );
}

export const isDisabled = (u: { status?: string | null }) => u.status === "disabled";

// "5 min ago", "2 days ago", ... for lists
export function timeAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
    if (sec < 86400 * 30) return `${Math.floor(sec / 86400)} d ago`;
    return new Date(iso).toLocaleDateString();
}
