import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSignIn, useAuth } from "@clerk/react";
import { User, ShieldCheck, Building2, ArrowRight, Moon, Sun, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase, nameToEmail } from "./supabase";

type Role = "user" | "admin" | "organization";

const ROLES: {
  id: Role; label: string; icon: typeof User; hint: string; field: string; placeholder: string;
}[] = [
  { id: "user", label: "User", icon: User, hint: "Sign in with your username and password", field: "Username", placeholder: "username" },
  { id: "admin", label: "Admin", icon: ShieldCheck, hint: "Sign in with your admin name and password", field: "Admin name", placeholder: "e.g. john" },
  { id: "organization", label: "Organization", icon: Building2, hint: "Sign in with your organization name and password", field: "Organization name", placeholder: "e.g. acme" },
];

export default function Login() {
  const navigate = useNavigate();
  const { signIn, fetchStatus } = useSignIn(); // Clerk (User tab only)
  const { isSignedIn } = useAuth();

  const [role, setRole] = useState<Role>("user");
  const [dark, setDark] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const active = ROLES.find((r) => r.id === role)!;
  const busy = loading || fetchStatus === "fetching";

  const switchRole = (r: Role) => {
    setRole(r);
    setError("");
    setName("");
    setPassword("");
  };

  // ---------- USER: Clerk username + password ----------
  const clerkLogin = async () => {
    // Clerk refuses a second sign-in while a session exists, so just continue
    if (isSignedIn) {
      navigate("/dashboard");
      return;
    }

    const { error: pwErr } = await signIn.password({ identifier: name, password });
    if (pwErr) return setError(pwErr.message ?? "Invalid username or password");

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            setError(`Extra step required: ${session.currentTask.key}. Check required fields in Clerk dashboard.`);
            return;
          }
          const url = decorateUrl("/dashboard");
          if (url.startsWith("http")) window.location.href = url;
          else navigate(url);
        },
      });
    } else {
      setError(`Sign-in needs another step (${signIn.status}). Check Clerk dashboard settings.`);
    }
  };

  // ---------- ADMIN / ORGANIZATION: Supabase name + password ----------
  const supabaseLogin = async () => {
    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email: nameToEmail(role as "admin" | "organization", name),
      password,
    });
    if (authErr) return setError(authErr.message);

    // app_metadata can only be set server-side, so it's safe to trust for roles
    if (data.user?.app_metadata?.role !== role) {
      await supabase.auth.signOut();
      return setError(`This account is not an ${role} account`);
    }
    navigate(role === "admin" ? "/admin" : "/organization");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (role === "user") await clerkLogin();
      else await supabaseLogin();
    } finally {
      setLoading(false);
    }
  };

  const FieldIcon = active.icon;

  return (
      <div className={`lg ${dark ? "dark" : "light"}`}>
        <style>{css}</style>

        <button className="lg-theme" onClick={() => setDark(!dark)} aria-label="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <form className="lg-card" onSubmit={onSubmit}>
          <div className="lg-brand">
            <div className="lg-logo" />
            <span>ZTNA</span>
          </div>

          <div className="lg-tabs" role="tablist">
            {ROLES.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={role === id}
                    className={role === id ? "on" : ""}
                    onClick={() => switchRole(id)}
                >
                  <Icon size={15} />
                  {label}
                </button>
            ))}
          </div>

          <p className="lg-hint">{active.hint}</p>

          <label className="lg-field">
            <span>{active.field}</span>
            <div className="lg-input">
              <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={active.placeholder}
                  autoComplete="username"
                  required
              />
              <FieldIcon size={16} />
            </div>
          </label>

          <label className="lg-field">
            <span>Password</span>
            <div className="lg-input">
              <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
              />
              <button type="button" className="lg-eye" onClick={() => setShowPw(!showPw)} aria-label="Show password">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && <p className="lg-error">{error}</p>}

          <button className="lg-submit" type="submit" disabled={busy}>
            {busy ? (
                <Loader2 size={16} className="lg-spin" />
            ) : (
                <>
                  <Lock size={15} /> Sign in as {active.label} <ArrowRight size={16} />
                </>
            )}
          </button>

          <div id="clerk-captcha" />

          {role === "user" && (
              <p className="lg-foot">
                No account? <a href="/signup">sign up now</a>
              </p>
          )}
        </form>

        <div className="lg-powered">Powered by <b>MY TEAM</b></div>
      </div>
  );
}

const css = `
.lg{--bg:#0f0f0f;--card:#141414;--bd:#2a2a2a;--tx:#f2f2f2;--mut:#8b8b8b;--seg:#1c1c1c;--btn:#fff;--btx:#111;--ac:#7c5cff;
 min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
 background:var(--bg);color:var(--tx);font-family:Inter,system-ui,sans-serif;position:relative;padding:16px}
.lg.light{--bg:#f6f6f8;--card:#fff;--bd:#e3e3e8;--tx:#16161a;--mut:#6b6b76;--seg:#f0f0f4;--btn:#16161a;--btx:#fff}
.lg *{box-sizing:border-box}
.lg-theme{position:absolute;top:20px;right:24px;background:none;border:0;color:var(--mut);cursor:pointer}
.lg-theme:hover{color:var(--tx)}
.lg-card{width:100%;max-width:448px;background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:32px;display:flex;flex-direction:column;gap:18px}
.lg-brand{display:flex;align-items:center;justify-content:center;gap:10px;font-size:32px;font-weight:700;margin-bottom:6px}
.lg-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#9b7bff,#5a3bd6)}
.lg-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:var(--seg);padding:4px;border-radius:10px}
.lg-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 6px;border:0;border-radius:7px;background:none;color:var(--mut);font-size:14px;cursor:pointer;transition:.15s}
.lg-tabs button:hover{color:var(--tx)}
.lg-tabs button.on{background:var(--bg);color:var(--tx);box-shadow:0 0 0 1px var(--bd)}
.lg-hint{margin:0;text-align:center;font-size:13px;color:var(--mut)}
.lg-field{display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:500}
.lg-input{display:flex;align-items:center;gap:8px;border:1px solid var(--bd);border-radius:8px;padding:0 12px;height:42px;color:var(--mut);transition:.15s}
.lg-input:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 25%,transparent)}
.lg-input input{flex:1;background:none;border:0;outline:0;color:var(--tx);font-size:14px;height:100%}
.lg-eye{background:none;border:0;color:var(--mut);cursor:pointer;display:flex;padding:0}
.lg-eye:hover{color:var(--tx)}
.lg-error{margin:0;font-size:13px;color:#ef4444}
.lg-submit{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border:0;border-radius:8px;background:var(--btn);color:var(--btx);font-size:14px;font-weight:600;cursor:pointer;transition:.15s}
.lg-submit:hover{opacity:.88}
.lg-submit:disabled{opacity:.6;cursor:not-allowed}
.lg-spin{animation:lgspin 1s linear infinite}
@keyframes lgspin{to{transform:rotate(360deg)}}
.lg-foot{margin:0;text-align:right;font-size:14px;color:var(--mut)}
.lg-foot a{color:var(--tx);font-weight:600;text-decoration:none}
.lg-powered{font-size:12px;color:var(--mut)}
.lg-powered b{color:var(--tx)}
`;