import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

// Loads the announcements meant for the signed-in employee (their organization and group).
// The server checks their Clerk session, so nobody can read another organization's announcements.
export type Announcement = { id: string; title: string; body: string | null; pinned: boolean; created_at: string };

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function useAnnouncements() {
    const { getToken, isSignedIn } = useAuth();
    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isSignedIn) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${URL_BASE}/functions/v1/get-announcements`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, "x-clerk-token": token ?? "" },
                    body: "{}",
                });
                const j = await res.json();
                if (cancelled) return;
                if (!res.ok || j.error) setError(j.error ?? "Could not load announcements");
                else setItems((j.announcements ?? []) as Announcement[]);
            } catch {
                if (!cancelled) setError("Could not load announcements");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [getToken, isSignedIn]);

    return { items, loading, error };
}
