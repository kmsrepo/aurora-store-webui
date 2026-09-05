import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppRow } from "../components/apps";
import { Empty, Img, ProgressBar } from "../components/ui";
import { formatBytes } from "../lib/format";
import { getApp } from "../lib/mockData";
import { realApi, usingMockBackend } from "../lib/playApi";
import { useStore } from "../lib/store";
import type { App } from "../lib/types";

/** Mirrors DownloadsScreen.kt + DownloadsMenu */
export function Downloads() {
  const { downloads, cancelDownload, clearFinished, resaveDownload, savedIds } = useStore();
  const active = downloads.filter((d) => d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING");
  const done = downloads.filter((d) => d.state !== "DOWNLOADING" && d.state !== "QUEUED" && d.state !== "VERIFYING");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Download manager</h1>
        {done.length > 0 && (
          <button onClick={clearFinished} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] text-white hover:bg-white/15">
            Clear finished
          </button>
        )}
      </div>
      {downloads.length === 0 && (
        <Empty
          icon="⬇"
          title="No downloads"
          hint={
            usingMockBackend
              ? "Install buttons on app pages enqueue downloads here (mirrors DownloadWorker)."
              : "Install buttons on app pages enqueue downloads here (mirrors DownloadWorker). Real APK downloads land in the browser download folder."
          }
        />
      )}
      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-gray-400">Active ({active.length})</p>
          {active.map((d) => (
            <div key={d.id} className="rounded-2xl bg-[#1b1e22] p-3">
              <div className="flex items-center gap-3">
                <Img src={d.iconUrl} alt="" className="h-12 w-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-white">{d.displayName}</p>
                  {d.state === "VERIFYING" ? (
                    <p className="text-[12px] text-gray-500">Verifying SHA-256…</p>
                  ) : (
                    <p className="text-[12px] text-gray-500">
                      v{d.versionName} · {formatBytes(d.bytesDone)} / {formatBytes(d.bytesTotal)} · {Math.round(d.progress)}%
                    </p>
                  )}
                </div>
                <button onClick={() => cancelDownload(d.packageName)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white">
                  Cancel
                </button>
              </div>
              <div className="mt-2"><ProgressBar value={d.progress} /></div>
              {d.error && <p className="mt-2 text-[12px] text-red-400">{d.error}</p>}
            </div>
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-gray-400">Finished ({done.length})</p>
          {done.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-[#1b1e22] p-3 opacity-80">
              <Img src={d.iconUrl} alt="" className="h-12 w-12 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-white">{d.displayName}</p>
                <p className="text-[12px] text-gray-500">
                  v{d.versionName} · {d.state.toLowerCase()}
                  {d.state === "COMPLETED" && (d.partsTotal ?? 0) > 1 && (
                    <> · {(d.partsTotal ?? 0)} parts → 1 .apks</>
                  )}
                </p>
                {d.state === "FAILED" && d.error && <p className="mt-1 text-[12px] text-red-400">{d.error}</p>}
                {d.state === "COMPLETED" && (d.partsTotal ?? 0) > 1 && !usingMockBackend && (
                  <p className="mt-1 text-[12px] text-gray-500">Install with SAI or <span className="font-mono">adb install-multiple</span></p>
                )}
              </div>
              {d.state === "COMPLETED" && savedIds.includes(d.id) && (
                <button onClick={() => resaveDownload(d.id)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/15">
                  Save again
                </button>
              )}
              <Link to={`/app/${d.packageName}`} className="text-[13px] font-medium text-emerald-400">Details →</Link>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Mirrors InstalledScreen.kt */
export function Installed() {
  const { installed } = useStore();
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-white">Installed</h1>
      <p className="text-[13px] text-gray-500">{installed.length} apps on this demo device (mirrors PackageManager).</p>
      {installed.map((i) => {
        const app = getApp(i.packageName);
        if (!app) return null;
        return (
          <AppRow
            key={i.packageName}
            app={{ ...app, displayName: i.displayName, iconUrl: i.iconUrl, versionName: i.versionName, versionCode: i.versionCode }}
            right={<span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px] text-gray-300">v{i.versionName}</span>}
          />
        );
      })}
    </div>
  );
}

/** Mirrors UpdatesScreen.kt — update-all, ignore, blacklist shortcuts. */
export function Updates() {
  const { updates, enqueueDownload, ignoreUpdate, toggleBlacklist, refreshUpdates, updatesBusy } = useStore();
  const visible = updates.filter((u) => !u.ignored);
  const ignored = updates.filter((u) => u.ignored);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Updates</h1>
          {!usingMockBackend && (
            <button
              onClick={() => refreshUpdates()}
              disabled={updatesBusy}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] text-white hover:bg-white/15 disabled:opacity-50"
            >
              {updatesBusy ? "Checking…" : "Check now"}
            </button>
          )}
        </div>
        {visible.length > 0 && (
          <button
            onClick={() => visible.forEach((u) => {
              const a = getApp(u.packageName);
              if (a) enqueueDownload(u.packageName, u.displayName, u.iconUrl, u.updateVersionName, u.updateVersionCode);
            })}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Update all ({visible.length})
          </button>
        )}
      </div>
      {visible.length === 0 && (
        <Empty
          icon="✅"
          title="All apps up to date"
          hint={
            usingMockBackend
              ? "UpdateHelper compares installed version codes against the Play feed."
              : "Pulls live versions from Play for your device list."
          }
        />
      )}
      {visible.map((u) => (
        <div key={u.packageName} className="rounded-2xl bg-[#1b1e22] p-3">
          <div className="flex items-center gap-3">
            <Img src={u.iconUrl} alt="" className="h-12 w-12 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-white">{u.displayName}</p>
              <p className="text-[12px] text-gray-500">
                {u.installedVersionName} → <span className="text-emerald-300">{u.updateVersionName}</span> · {u.updateSize}
              </p>
            </div>
            <button
              onClick={() => enqueueDownload(u.packageName, u.displayName, u.iconUrl, u.updateVersionName, u.updateVersionCode)}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-black"
            >
              Update
            </button>
          </div>
          {u.changes && <p className="line-clamp-2 mt-2 text-[12px] text-gray-500">{u.changes.split("\n")[0]}</p>}
          <div className="mt-2 flex gap-3 text-[12px]">
            <Link to={`/app/${u.packageName}`} className="text-emerald-400">Details →</Link>
            <button onClick={() => ignoreUpdate(u.packageName, true)} className="text-gray-500 hover:text-gray-300">Ignore</button>
            <button onClick={() => toggleBlacklist(u.packageName)} className="text-gray-500 hover:text-gray-300">Blacklist</button>
          </div>
        </div>
      ))}
      {ignored.length > 0 && (
        <details className="rounded-2xl bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-[13px] text-gray-400">Ignored ({ignored.length})</summary>
          {ignored.map((u) => (
            <div key={u.packageName} className="mt-2 flex items-center justify-between text-[13px] text-gray-400">
              <span>{u.displayName}</span>
              <button onClick={() => ignoreUpdate(u.packageName, false)} className="text-emerald-400">Un-ignore</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

/** Mirrors Favourite screen (FavouriteDao). */
export function Favourites() {
  const { favourites, toggleFavourite } = useStore();
  const [realApps, setRealApps] = useState<App[] | null>(null);
  const [realFailed, setRealFailed] = useState(false);

  useEffect(() => {
    if (usingMockBackend || favourites.length === 0) return;
    let alive = true;
    const api = realApi();
    if (!api) return;
    setRealApps(null);
    setRealFailed(false);
    api
      .appsBulk(favourites.map((f) => f.packageName))
      .then((apps) => {
        if (!alive) return;
        setRealApps(apps);
        setRealFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        const fallback = favourites.map((f) => getApp(f.packageName)).filter((a) => a !== undefined);
        if (fallback.length > 0) {
          setRealApps(fallback);
          setRealFailed(false);
        } else {
          setRealApps([]);
          setRealFailed(true);
        }
      });
    return () => { alive = false; };
  }, [favourites]);

  const mockApps = favourites.map((f) => getApp(f.packageName)).filter((a) => a !== undefined);
  const apps = usingMockBackend ? mockApps : (realApps ?? mockApps);
  if (!usingMockBackend && realFailed && apps.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-white">Favourites</h1>
        <Empty icon="♡" title="Couldn't load favourites" hint="Log in to load your favourites from Play, then try again." action={<Link to="/apps" className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">Browse apps</Link>} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-white">Favourites</h1>
      {apps.length === 0 && (
        <Empty icon="♡" title="No favourites yet" hint="Tap ♡ Save on any app page. Stored in localStorage (Room replacement)." action={<Link to="/apps" className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">Browse apps</Link>} />
      )}
      {apps.map((a) => (
        <AppRow
          key={a.packageName}
          app={a}
          right={
            <button onClick={() => toggleFavourite(a.packageName)} className="rounded-full bg-pink-500/15 px-3 py-1 text-[12px] font-medium text-pink-300">
              ♥ Remove
            </button>
          }
        />
      ))}
    </div>
  );
}
