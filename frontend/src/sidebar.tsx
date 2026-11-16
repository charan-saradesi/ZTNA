import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./ui.css";

const MOBILE = 768;

// Sidebar open/closed state shared by every panel layout.
// On a phone it starts closed and closes again after you pick a page.
export function useSidebar() {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(() => window.innerWidth > MOBILE);

    useEffect(() => {
        if (window.innerWidth <= MOBILE) setOpen(false);
    }, [pathname]);

    return { open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

// Dark layer behind the drawer on phones (hidden on desktop by CSS). Tap it to close.
export function SidebarBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
    return open ? <div className="ui-backdrop" onClick={onClose} /> : null;
}
