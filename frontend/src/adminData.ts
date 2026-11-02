import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

// ---- Row types (match the Supabase tables) ----
export type Org = {
    id: string;
    name: string;
    display_name: string | null;
    website_url: string | null;
    auth_user_id: string | null;
    created_at: string;
    // Extra details (columns added with organization_columns.sql). Optional so the page still loads before they exist.
    status?: string | null; // "active" | "disabled"
    contact_name?: string | null;
    contact_email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    industry?: string | null;
    company_size?: string | null;
    notes?: string | null;
};

export type Grp = {
    id: string;
    org_name: string;
    name: string;
    display_name: string | null;
    created_at: string;
};

export type Usr = {
    id: string;
    clerk_user_id: string;
    org_name: string;
    group_id: string | null;
    username: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    created_at: string;
};

// ---- Small helpers ----
export const groupLabel = (g: Pick<Grp, "name" | "display_name">) => g.display_name || g.name;
export const fullName = (u: Pick<Usr, "first_name" | "last_name">) =>
    `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();

// True if the date is within the last `days` days
export const withinDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() < days * 86_400_000;

// ---- Calls an Edge Function. Returns { error, warning } (both "" on a clean success) ----
export async function invokeFnDetailed(
    name: string,
    body: Record<string, unknown>
): Promise<{ error: string; warning: string }> {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
        let msg = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
            try {
                const j = await ctx.json();
                if (j?.error) msg = j.error as string;
            } catch {
                /* ignore */
            }
        }
        return { error: msg, warning: "" };
    }
    return {
        error: (data?.error as string | undefined) ?? "",
        warning: (data?.warning as string | undefined) ?? "",
    };
}

// ---- Same call, but returns just the error message ("" on success) ----
export async function invokeFn(name: string, body: Record<string, unknown>): Promise<string> {
    return (await invokeFnDetailed(name, body)).error;
}

// ---- Loads organizations, groups and users in one go (admin can read all three) ----
export function useAdminData() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [groups, setGroups] = useState<Grp[]>([]);
    const [users, setUsers] = useState<Usr[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const reload = useCallback(async () => {
        setLoading(true);
        const [o, g, u] = await Promise.all([
            supabase.from("organizations").select("*").order("created_at", { ascending: false }),
            supabase.from("groups").select("*").order("name"),
            supabase.from("org_users").select("*").order("created_at", { ascending: false }),
        ]);
        setError(o.error?.message ?? g.error?.message ?? u.error?.message ?? "");
        setOrgs((o.data ?? []) as Org[]);
        setGroups((g.data ?? []) as Grp[]);
        setUsers((u.data ?? []) as Usr[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { orgs, groups, users, loading, error, reload };
}
