import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { usingMockBackend } from "../lib/playApi";

/**
 * Mirrors MainScreen.kt: bottom NavigationBar (APPS | GAMES | UPDATES),
 * TopAppBar with Downloads + More actions, FAB -> Search.
 */
export function Shell({ children, fab = true }: { children: React.ReactNode; fab?: boolean }) {
  const { updates, downloads, session, sessionBusy } = useStore();
  const [more, setMore] = useState(false);
  const pending = updates.filter((u) => !u.ignored).length;
  const activeDownloads = downloads.filter((d) => d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING").length;

  return (
    <div className="mx-auto min-h-screen max-w-6xl pb-24">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#121417]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 font-bold text-black">A</span>
          <span className="flex-1 text-[17px] font-semibold text-white">Aurora Store <span className="text-gray-500 font-normal">· WebUI</span></span>
          {usingMockBackend ? (
            <span className="hidden rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-300 sm:inline">
              Demo data
            </span>
          ) : (
            <Link
              to="/accounts"
              title={session ? `Logged in as ${session.email}` : "Not logged in"}
              className="hidden items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-white/10 sm:flex"
            >
              <span className={`h-2 w-2 rounded-full ${session ? "bg-emerald-400" : sessionBusy ? "bg-amber-300 animate-pulse" : "bg-red-400"}`} />
              {session ? (session.isAnonymous ? "Anonymous" : session.email) : sessionBusy ? "Logging in…" : "Offline"}
            </Link>
          )}
          <Link to="/downloads" className="relative rounded-lg p-2 text-gray-200 hover:bg-white/10" aria-label="Download manager">
            ⬇
            {activeDownloads > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
                {activeDownloads}
              </span>
            )}
          </Link>
          <button onClick={() => setMore((v) => !v)} className="rounded-lg p-2 text-gray-200 hover:bg-white/10" aria-label="More">
            ⋮
          </button>
        </div>
        {more && <MoreSheet onClose={() => setMore(false)} />}
      </header>

      <main className="px-4 pt-4">{children}</main>

      {fab && (
        <Link
          to="/search"
          aria-label="Search"
          className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-xl font-bold text-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
        >
          ⌕
        </Link>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#121417]/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-3">
          <Tab to="/apps" icon="▦" label="Apps" />
          <Tab to="/games" icon="🎮" label="Games" />
          <Tab to="/updates" icon="⟳" label="Updates" badge={pending} />
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, icon, label, badge }: { to: string; icon: string; label: string; badge?: number }) {
  const active = location.pathname === to || (to === "/apps" && location.pathname === "/");
  return (
    <Link
      to={to}
      className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[12px] font-medium ${active ? "text-emerald-300" : "text-gray-400 hover:text-gray-200"}`}
    >
      <span className="text-lg leading-none">
        {icon}
        {!!badge && (
          <span className="ml-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-black">{badge}</span>
        )}
      </span>
      {label}
    </Link>
  );
}

/** Mirrors `MoreSheet` — overflow menu to secondary destinations. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useStore();
  const links: Array<[string, string, string]> = [
    ["/installed", "📦", "Installed"],
    ["/favourites", "♥", "Favourites"],
    ["/accounts", "👤", `Accounts (${activeAccount?.type === "ANONYMOUS" ? "Anonymous" : activeAccount?.email ?? "—"})`],
    ["/spoof", "📱", "Spoof manager"],
    ["/blacklist", "🚫", "Blacklist"],
    ["/dispenser", "🎟", "Token dispenser"],
    ["/settings", "⚙", "Settings"],
    ["/about", "ℹ", "About"],
  ];
  return (
    <div className="border-t border-white/10 px-2 py-2" onClick={onClose}>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {links.map(([to, icon, label]) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] text-gray-200 hover:bg-white/10">
            <span>{icon}</span> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
