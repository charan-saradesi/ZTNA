import { House, LayoutGrid, Settings } from "lucide-react";
import PanelLayout from "./PanelLayout";
import type { Group } from "./PanelLayout";

// Limited menu for organizations. Add or remove items here.
const MENU: Group[] = [
    {
        label: "Home", icon: House,
        items: [{ label: "Dashboard", to: "/organization/dashboard" }],
    },
    {
        label: "User Management", icon: LayoutGrid,
        items: [
            { label: "Users", to: "/organization/users" },
            { label: "Groups", to: "/organization/groups" },
            { label: "Invitations", to: "/organization/invitations" },
        ],
    },
    {
        label: "Settings", icon: Settings,
        items: [{ label: "Profile", to: "/organization/profile" }],
    },
];

export default function OrgLayout() {
    return <PanelLayout menu={MENU} roleLabel="Organization" defaultOpen={["Home", "User Management"]} />;
}
