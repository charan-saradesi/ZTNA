import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// ONE theme for the whole app. The choice is saved in the browser and applied as
// <html data-theme="dark|light">; every color in the app comes from theme.css.
export type Theme = "dark" | "light";

const KEY = "theme";
const listeners = new Set<() => void>();

function read(): Theme {
    try {
        const v = localStorage.getItem(KEY);
        if (v === "light" || v === "dark") return v;
    } catch {
        /* storage blocked: fall back to dark */
    }
    return "dark";
}

let current: Theme = read();

function apply(t: Theme) {
    document.documentElement.dataset.theme = t;
}

// Call once in main.tsx before rendering, so the page never flashes the wrong theme
export function initTheme() {
    current = read();
    apply(current);
}

export function setTheme(t: Theme) {
    current = t;
    apply(t);
    try {
        localStorage.setItem(KEY, t);
    } catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useTheme() {
    const theme = useSyncExternalStore(subscribe, () => current, () => "dark" as Theme);
    return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

// The same button everywhere: <ThemeToggle /> (add a className to position it)
export function ThemeToggle({ className = "" }: { className?: string }) {
    const { theme, toggle } = useTheme();
    return (
        <button type="button" className={`theme-toggle ${className}`} onClick={toggle} aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}
