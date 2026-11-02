import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import Login from "./Login";
import UserDashboard from "./UserDashboard";
import AdminLayout from "./AdminLayout";
import AdminDashboard from "./AdminDashboard";
import OrganizationsPage from "./OrganizationsPage";
import ComingSoon from "./ComingSoon";
import OrgLayout from "./organization/OrgLayout";
import OrganizationDashboard from "./organization/OrganizationDashboard";
import GroupsPage from "./organization/GroupsPage";
import UsersPage from "./organization/UsersPage";
import { RequireUser, RequireRole } from "./guards";
import AdminGroupsPage from "./AdminGroupsPage";
import AdminUsersPage from "./AdminUsersPage";

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
                    <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="organizations" element={<OrganizationsPage />} />
                        <Route path="groups" element={<AdminGroupsPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="*" element={<ComingSoon />} />
                    </Route>

                    {/* Organization (Supabase, role = organization) */}
                    <Route path="/organization" element={<RequireRole role="organization"><OrgLayout /></RequireRole>}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<OrganizationDashboard />} />
                        <Route path="groups" element={<GroupsPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="*" element={<ComingSoon />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </ClerkProvider>
    </StrictMode>
);