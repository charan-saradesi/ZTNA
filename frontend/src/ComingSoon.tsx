import { useLocation } from "react-router-dom";
import "./admin.css";

export default function ComingSoon() {
    const { pathname } = useLocation();
    const title = pathname.split("/").filter(Boolean).pop() ?? "";
    const label = title.charAt(0).toUpperCase() + title.slice(1);

    return (
        <div className="adm-page">
            <div className="pg-head"><h1>{label}</h1></div>
            <div className="tbl-wrap">
                <div className="empty">This page isn't built yet.</div>
            </div>
        </div>
    );
}
