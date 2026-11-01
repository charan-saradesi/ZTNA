import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");

export const supabase = createClient(url, anon);

// Admin / Organization log in with a name + password, but Supabase needs an email.
// - If a full email is typed (contains "@"), it is used as is.
// - Otherwise the name is mapped to a fixed internal email:
//     admin "john" -> john@admin.yourapp.com
//     org   "acme" -> acme@org.yourapp.com
export const ACCOUNT_DOMAIN = "yourapp.com";

export const nameToEmail = (role: "admin" | "organization", name: string) => {
    const value = name.trim().toLowerCase();
    if (value.includes("@")) return value;
    const slug = value.replace(/\s+/g, "-");
    return `${slug}@${role === "admin" ? "admin" : "org"}.${ACCOUNT_DOMAIN}`;
};