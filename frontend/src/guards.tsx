import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { supabase } from "./supabase";

const Loading = () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f0f", color: "#8b8b8b", fontFamily: "system-ui" }}>
        Loading…
    </div>
);

// Normal users (Clerk): must have a Clerk session
export function RequireUser({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth();
    if (!isLoaded) return <Loading />;
    return isSignedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

// Admin / Organization (Supabase): must have a session AND the right role
export function RequireRole({ role, children }: { role: "admin" | "organization"; children: ReactNode }) {
    const [state, setState] = useState<"loading" | "ok" | "no">("loading");

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setState(data.session?.user.app_metadata?.role === role ? "ok" : "no");
        });
    }, [role]);

    if (state === "loading") return <Loading />;
    return state === "ok" ? <>{children}</> : <Navigate to="/login" replace />;
}
