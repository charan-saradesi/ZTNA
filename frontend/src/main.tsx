import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import Login from "./Login";
import UserDashboard from "./UserDashboard";
import AdminDashboard from "./AdminDashboard";
import { RequireUser, RequireRole } from "./guards";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env");

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            signInUrl="/login"
            signUpUrl="/login"
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            afterSignOutUrl="/login"
        >
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    {/* Normal user (Clerk) */}
                    <Route path="/dashboard" element={<RequireUser><UserDashboard /></RequireUser>} />

                    {/* Admin (Supabase, role = admin) */}
                    <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />

                    {/* Organization (Supabase, role = organization): placeholder for now */}
                    <Route
                        path="/organization"
                        element={<RequireRole role="organization"><div style={{ padding: 24 }}>Organization Dashboard</div></RequireRole>}
                    />

                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </ClerkProvider>
    </StrictMode>
);
