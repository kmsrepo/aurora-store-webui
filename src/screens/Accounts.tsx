import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppRow } from "../components/apps";
import { Empty } from "../components/ui";
import { usingMockBackend } from "../lib/playApi";
import { MOCK_APPS } from "../lib/mockData";
import { useStore } from "../lib/store";

/** Mirrors AccountsScreen.kt + AccountProvider/AuthProvider. */
export function Accounts() {
  const {
    accounts, activeAccount, addAccount, removeAccount, switchAccount, logout,
    session, sessionBusy, sessionError, loginAnonymous, ensureSession,
  } = useStore();
  const [email, setEmail] = useState("");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">Accounts</h1>
      <p className="text-[13px] text-gray-400">
        Anonymous accounts use the public token dispenser; Google accounts unlock library, purchases and reviews
        (mirrors AuthProvider + AuthWorker).
      </p>

      {!usingMockBackend && (
        <section className="rounded-2xl bg-[#1b1e22] p-4">
          <p className="text-[13px] font-semibold text-gray-300">Play session (server)</p>
          {sessionBusy && <p className="mt-2 animate-pulse text-[13px] text-amber-300">Contacting dispenser…</p>}
          {!sessionBusy && session && (
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">✓</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-white">{session.email}</p>
                <p className="font-mono text-[11px] text-gray-500">
                  {session.isAnonymous ? "ANONYMOUS" : "GOOGLE"} · gsfId {session.gsfId || "…"} · {session.deviceProfile} · {session.locale}
                </p>
              </div>
            </div>
          )}
          {!sessionBusy && !session && (
            <p className="mt-2 text-[13px] text-red-300">Not logged in — details, reviews and downloads need a session.</p>
          )}
          {sessionError && <p className="mt-2 text-[13px] text-red-300">{sessionError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => loginAnonymous().catch(() => undefined)}
              disabled={sessionBusy}
              className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {session ? "New anonymous login" : "Anonymous login"}
            </button>
            <button
              onClick={() => ensureSession().catch(() => undefined)}
              disabled={sessionBusy}
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        </section>
      )}

      {accounts.map((a) => (
        <div key={a.id} className={`flex items-center gap-3 rounded-2xl p-3 ${a.active ? "bg-emerald-500/10 ring-1 ring-emerald-400/40" : "bg-[#1b1e22]"}`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">👤</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-white">{a.email}</p>
            <p className="text-[12px] text-gray-500">{a.type}{a.active ? " · active" : ""}</p>
          </div>
          {!a.active && (
            <button onClick={() => switchAccount(a.id)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white">Switch</button>
          )}
          {accounts.length > 1 && (
            <button onClick={() => removeAccount(a.id)} className="rounded-full px-2 py-1 text-[12px] text-red-300">Remove</button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Link to="/accounts/login" className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-black">
          + Add Google account
        </Link>
        {!usingMockBackend ? (
          <button onClick={() => loginAnonymous().catch(() => undefined)} className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white">
            + Anonymous
          </button>
        ) : (
          <button onClick={() => addAccount(`anonymous-${accounts.length}@auroraoss.com`, "ANONYMOUS")} className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white">
            + Anonymous
          </button>
        )}
      </div>
      {usingMockBackend && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (email.trim()) { addAccount(email.trim(), "GOOGLE"); setEmail(""); } }}
          className="flex gap-2"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Quick add by email (demo)"
            className="flex-1 rounded-xl bg-[#1b1e22] p-3 text-[14px] text-white outline-none placeholder:text-gray-500"
          />
          <button className="rounded-xl bg-white/10 px-4 text-sm text-white">Add</button>
        </form>
      )}
      <button onClick={logout} className="text-[13px] text-red-300 hover:underline">Log out all → anonymous</button>
      <p className="text-[12px] text-gray-600">Active: {activeAccount?.email ?? "none"}</p>
    </div>
  );
}

/** Mirrors GoogleLogin — real AAS-token login when proxied, demo stub offline. */
export function GoogleLogin() {
  const { addAccount, loginGoogle, sessionBusy, sessionError } = useStore();
  const [email, setEmail] = useState("user@gmail.com");
  const [token, setToken] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (usingMockBackend) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-[#1b1e22] p-6">
        <h1 className="text-xl font-bold text-white">Google login</h1>
        <p className="text-[13px] text-gray-400">
          Android uses a WebView/microG token exchange (GoogleAccountTokenProvider). The web demo mints a local
          session instead — connect a real <code className="text-emerald-300">/api/auth</code> proxy for production.
        </p>
        {!done ? (
          <form onSubmit={(e) => { e.preventDefault(); addAccount(email, "GOOGLE"); setDone(true); }} className="flex flex-col gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl bg-white/5 p-3 text-white outline-none" />
            <button className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black">Sign in (demo)</button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-emerald-300">✅ Signed in as {email}</p>
            <Link to="/accounts" className="rounded-full bg-white/10 px-4 py-2.5 text-center text-sm text-white">Back to accounts</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-[#1b1e22] p-6">
      <h1 className="text-xl font-bold text-white">Google login</h1>
      <p className="text-[13px] leading-relaxed text-gray-400">
        Paste an <span className="text-gray-200">AAS token</span> for your Google account (same credential the Android
        app mints via microG/WebView and reuses for background refreshes). The server runs the real check-in +
        token-exchange flow — your password never touches this app.
      </p>
      {!done ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            loginGoogle(email.trim(), token.trim())
              .then(() => setDone(true))
              .catch((err: Error) => setError(err.message));
          }}
          className="flex flex-col gap-3"
        >
          <label className="text-[12px] text-gray-500">Google email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 p-3 text-white outline-none" />
          </label>
          <label className="text-[12px] text-gray-500">AAS token
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="aas_et/…" className="mt-1 w-full rounded-xl bg-white/5 p-3 font-mono text-white outline-none placeholder:text-gray-600" />
          </label>
          {(error ?? sessionError) && <p className="text-[13px] text-red-300">{error ?? sessionError}</p>}
          <button disabled={sessionBusy || !email.trim() || !token.trim()} className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
            {sessionBusy ? "Signing in…" : "Sign in with token"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-emerald-300">✅ Signed in as {email}</p>
          <Link to="/accounts" className="rounded-full bg-white/10 px-4 py-2.5 text-center text-sm text-white">Back to accounts</Link>
        </div>
      )}
    </div>
  );
}

/** Mirrors Dispenser screen (anonymous token dispenser URL list). */
export function Dispenser() {
  const [urls] = useState([
    "https://auroraoss.com/api/auth",
    "https://aurora-dispenser.example/api/auth",
  ]);
  const [custom, setCustom] = useState("");
  const [list, setList] = useState(urls);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-bold text-white">Token dispenser</h1>
      <p className="text-[13px] text-gray-400">
        Anonymous auth tokens are minted by community dispensers (mirrors DispenserViewModel).
        {!usingMockBackend && " The server uses DISPENSER_URL (comma-separated allowed); changing the list here is informational in web mode."}
      </p>
      {list.map((u) => (
        <div key={u} className="flex items-center gap-2 rounded-2xl bg-[#1b1e22] p-3 font-mono text-[13px] text-gray-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="flex-1 truncate">{u}</span>
        </div>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { setList((l) => [...l, custom.trim()]); setCustom(""); } }} className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://…" className="flex-1 rounded-xl bg-[#1b1e22] p-3 text-white outline-none" />
        <button className="rounded-xl bg-emerald-500 px-4 text-sm font-bold text-black">Add</button>
      </form>
    </div>
  );
}

/** Mirrors DevProfileScreen / PublisherProfile. */
export function DevProfile() {
  const { devId = "" } = useParams();
  return <DevProfileInner devId={devId} />;
}

function DevProfileInner({ devId }: { devId: string }) {
  const apps = MOCK_APPS.filter((a) => a.developerId === devId || a.developerName.toLowerCase().includes(devId.replace(/-/g, " ")));
  const shown = apps.length ? apps : MOCK_APPS.slice(0, 6);
  const name = apps[0]?.developerName ?? devId.replace(/-/g, " ");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl font-bold text-emerald-300">
          {name[0]?.toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">{name}</h1>
          <p className="text-[13px] text-gray-500">{shown.length} apps · developer profile</p>
        </div>
      </div>
      {apps.length === 0 && <Empty icon="🏢" title="Demo profile" hint={`No mock apps for “${devId}” — showing a sample instead.`} />}
      {shown.map((a) => <AppRow key={a.packageName} app={a} />)}
    </div>
  );
}
