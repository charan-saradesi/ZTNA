// Tells the server that a wrong password was typed, so it can lower that user's health.
// Used by the User tab on the login page. Never throws and never blocks the login screen.
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// True when Clerk's error means "the password was wrong" (not a lock-out or network error)
export function isWrongPassword(err: { code?: string; message?: string } | null | undefined): boolean {
    const t = `${err?.code ?? ""} ${err?.message ?? ""}`.toLowerCase();
    return t.includes("password_incorrect") || (t.includes("password") && t.includes("incorrect"));
}

export function reportFailedLogin(username: string) {
    if (!username.trim()) return;
    fetch(`${URL_BASE}/functions/v1/report-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ username }),
    }).catch(() => {
        /* ignore */
    });
}
