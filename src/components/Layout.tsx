import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Toasts } from "./ui";
import { useApp, useActions } from "../store/store";

const paths: Record<string, string> = {
  dashboard: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  grid: "M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z",
  note: "M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  book: "M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2zM8 3v18",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z",
  report: "M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 004 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 14H3a2 2 0 110-4h.1A1.7 1.7 0 004.3 6l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 10h0a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}

export const NAV = [
  { to: "/", label: "Tableau de bord", icon: "dashboard", end: true },
  { to: "/maquette", label: "Ma maquette", icon: "grid" },
  { to: "/notes", label: "Mes notes", icon: "note" },
  { to: "/moyennes", label: "Mes moyennes", icon: "chart" },
  { to: "/progression", label: "Ma progression", icon: "trend" },
  { to: "/revision", label: "Réviser aujourd'hui", icon: "clock" },
  { to: "/cours", label: "Mes cours", icon: "book" },
  { to: "/objectifs", label: "Mes objectifs", icon: "target" },
  { to: "/bilan", label: "Bilan hebdomadaire", icon: "report" },
  { to: "/parametres", label: "Paramètres", icon: "settings" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useApp();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-600/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">ABL-GOAL</p>
          <p className="text-[11px] text-brand-200">L2 Géomatique</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-brand-100/80 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-brand-100/70">
        <p className="font-medium text-white">« Chaque cours compte.</p>
        <p className="font-medium text-white">Chaque note te fait progresser. »</p>
        <p className="mt-2">
          Objectif : <span className="font-semibold text-white">{data.goals.general}/20</span>
        </p>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data } = useApp();
  const actions = useActions();
  const location = useLocation();

  const dark = data.settings.theme === "dark";
  const current = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-brand-950 lg:block">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-950 shadow-2xl">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {current?.label ?? "ABL-GOAL"}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {data.profile.promo}
              </p>
            </div>
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => actions.setTheme(dark ? "light" : "dark")}
              aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
              title={dark ? "Mode clair" : "Mode sombre"}
            >
              {dark ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </svg>
              )}
            </button>
          </div>

          {data.isDemo && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 sm:px-6">
              <span>
                <strong>Données de démonstration</strong> — elles seront supprimées automatiquement
                à ta première saisie réelle.
              </span>
              <button
                className="rounded-lg bg-amber-900 px-2.5 py-1 font-medium text-white hover:bg-amber-800"
                onClick={() => actions.clearDemo()}
              >
                Supprimer la démo
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-24 sm:px-6 lg:pb-8">{children}</main>

        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 dark:border-slate-800 sm:px-6">
          ABL-GOAL — sauvegarde locale automatique · export CSV/JSON disponible dans Paramètres
        </footer>
      </div>

      {/* Navigation mobile basse */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="flex justify-around overflow-x-auto">
          {NAV.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium ${
                  isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
                }`
              }
            >
              <Icon name={item.icon} size={20} />
              <span className="text-center leading-tight">{item.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toasts />
    </div>
  );
}
