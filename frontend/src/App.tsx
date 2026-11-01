import { useState } from "react";
import type { FormEvent } from "react";
import { User, ShieldCheck, Building2, ArrowRight, Moon, Sun, Mail, Hash } from "lucide-react";

type Role = "user" | "admin" | "organization";

const ROLES: { id: Role; label: string; icon: typeof User; hint: string }[] = [
  { id: "user", label: "User", icon: User, hint: "Sign in to your personal account" },
  { id: "admin", label: "Admin", icon: ShieldCheck, hint: "Manage users, roles and settings" },
  { id: "organization", label: "Organization", icon: Building2, hint: "Sign in on behalf of your organization" },
];

export default function Login() {
  const [role, setRole] = useState<Role>("user");
  const [dark, setDark] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [orgId, setOrgId] = useState("");

  const active = ROLES.find((r) => r.id === role)!;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: hook up to your auth (e.g. Clerk) here
    console.log({ role, identifier, orgId });
  };

  return (
      <div className={`lg ${dark ? "dark" : "light"}`}>
        <style>{css}</style>

        <button className="lg-theme" onClick={() => setDark(!dark)} aria-label="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <form className="lg-card" onSubmit={onSubmit}>
          <div className="lg-brand">
            <div className="lg-logo" />
            <span>Casdoor</span>
          </div>

          <div className="lg-tabs" role="tablist">
            {ROLES.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={role === id}
                    className={role === id ? "on" : ""}
                    onClick={() => setRole(id)}
                >
                  <Icon size={15} />
                  {label}
                </button>
            ))}
          </div>

          <p className="lg-hint">{active.hint}</p>

          {role === "organization" && (
              <label className="lg-field">
                <span>Organization ID</span>
                <div className="lg-input">
                  <input
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      placeholder="e.g. acme-corp"
                      required
                  />
                  <Hash size={16} />
                </div>
              </label>
          )}

          <label className="lg-field">
            <span>{role === "admin" ? "Admin email" : role === "organization" ? "Work email" : "Username"}</span>
            <div className="lg-input">
              <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={role === "user" ? "username, email or phone" : "name@company.com"}
                  required
              />
              <Mail size={16} />
            </div>
          </label>

          <button className="lg-submit" type="submit">
            Continue as {active.label}
            <ArrowRight size={16} />
          </button>

          <p className="lg-foot">
            No account? <a href="/signup">sign up now</a>
          </p>
        </form>

        <div className="lg-powered">Powered by <b>Casdoor</b></div>
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
.lg-submit{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border:0;border-radius:8px;background:var(--btn);color:var(--btx);font-size:14px;font-weight:600;cursor:pointer;transition:.15s}
.lg-submit:hover{opacity:.88}
.lg-foot{margin:0;text-align:right;font-size:14px;color:var(--mut)}
.lg-foot a{color:var(--tx);font-weight:600;text-decoration:none}
.lg-powered{font-size:12px;color:var(--mut)}
.lg-powered b{color:var(--tx)}
`;