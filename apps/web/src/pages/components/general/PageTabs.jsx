import { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import "./css/page-tabs.css";

export function readNavAvailability(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function readAuth() {
  try {
    const config = JSON.parse(localStorage.getItem("config") || "{}");
    const role = config?.settings?.auth?.role || "Viewer";
    return { isAdmin: role === "Owner" || role === "Admin", permissions: config?.settings?.auth?.permissions || {} };
  } catch {
    return { isAdmin: false, permissions: {} };
  }
}

export default function PageTabs({ title, tabs }) {
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter((tab) => tab.visible !== false);
  const active = visible.find((tab) => tab.id === params.get("tab")) || visible[0];
  if (!active) return null;
  return (
    <div className="page-tabs-hub">
      {visible.length > 1 ? (
        <nav className="page-tabs" role="tablist" aria-label={title}>
          {visible.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === active.id;
            return (
              <button key={tab.id} type="button" role="tab" aria-selected={selected} className={selected ? "is-active" : ""} onClick={() => setParams({ tab: tab.id })}>
                {Icon ? <Icon size={16} /> : null}
                {tab.label}
              </button>
            );
          })}
        </nav>
      ) : null}
      <Suspense fallback={null}>
        <div key={active.id}>{active.render()}</div>
      </Suspense>
    </div>
  );
}
