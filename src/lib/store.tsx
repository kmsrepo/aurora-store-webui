import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { zipSync } from "fflate";
import { MOCK_ACCOUNTS, MOCK_DOWNLOADS, MOCK_INSTALLED, updatesFromInstalled } from "./mockData";
import { realApi } from "./playApi";
import type { PlaySession } from "./playApi";
import type {
  Account,
  App,
  Download,
  Favourite,
  InstalledApp,
  SpoofDevice,
  SpoofLocale,
  Update,
} from "./types";
import { MOCK_LOCALES, MOCK_SPOOF_DEVICES } from "./mockData";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

// ── Settings (mirrors Preferences.kt keys) ───────────────────────

export interface Settings {
  theme: "dark" | "light" | "system";
  introDone: boolean;
  anonymous: boolean;
  warnTrackers: boolean;
  autoUpdate: boolean;
  updateCheckIntervalH: number;
  installer: "session" | "native" | "manual";
  insecureAnonymous: boolean;
  filterFOSSOnly: boolean;
  filterGMS: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  introDone: false,
  anonymous: true,
  warnTrackers: false,
  autoUpdate: false,
  updateCheckIntervalH: 24,
  installer: "manual",
  insecureAnonymous: false,
  filterFOSSOnly: false,
  filterGMS: false,
};

export interface SavedBlob {
  url: string;
  filename: string;
}

interface Store {
  // auth (AccountRepository + AuthProvider; server session when proxied)
  accounts: Account[];
  activeAccount?: Account;
  addAccount: (email: string, type: Account["type"]) => void;
  removeAccount: (id: string) => void;
  switchAccount: (id: string) => void;
  logout: () => void;
  session: PlaySession | null;
  sessionBusy: boolean;
  sessionError: string | null;
  ensureSession: () => Promise<PlaySession>;
  loginAnonymous: () => Promise<void>;
  loginGoogle: (email: string, token: string) => Promise<void>;

  // favourites (FavouriteDao)
  favourites: Favourite[];
  toggleFavourite: (pkg: string) => void;
  isFavourite: (pkg: string) => boolean;

  // downloads (DownloadDao + DownloadWorker, real streaming when proxied)
  downloads: Download[];
  enqueueDownload: (pkg: string, name: string, icon: string, versionName: string, versionCode: number) => void;
  cancelDownload: (pkg: string) => void;
  clearFinished: () => void;
  resaveDownload: (id: string) => void;
  savedIds: string[];

  // installed + updates (PackageManagerReceiver + UpdateHelper)
  installed: InstalledApp[];
  updates: Update[];
  updatesBusy: boolean;
  refreshUpdates: () => Promise<void>;
  ignoreUpdate: (pkg: string, ignored: boolean) => void;
  blacklist: string[];
  toggleBlacklist: (pkg: string) => void;

  // spoof (SpoofProvider)
  spoofDevice: SpoofDevice;
  setSpoofDevice: (d: SpoofDevice) => void;
  spoofLocale: SpoofLocale;
  setSpoofLocale: (l: SpoofLocale) => void;
  spoofDevices: SpoofDevice[];
  spoofLocales: SpoofLocale[];

  // settings
  settings: Settings;
  patchSettings: (p: Partial<Settings>) => void;
}

const Ctx = createContext<Store | null>(null);

let dlCounter = 100;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function triggerSave(blobs: SavedBlob[]): void {
  // Single anchor click: browsers (notably Safari) block follow-up automatic
  // downloads, which used to strand users with one lone split APK.
  blobs.forEach((b, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = b.url;
      a.download = b.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 1500);
  });
}

function blobUrl(data: Uint8Array, type: string): string {
  return URL.createObjectURL(new Blob([data as BlobPart], { type }));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const api = realApi();
  const [accounts, setAccounts] = useState<Account[]>(() => load("aurora.accounts", MOCK_ACCOUNTS));
  const [favourites, setFavourites] = useState<Favourite[]>(() => load("aurora.favs", []));
  const [downloads, setDownloads] = useState<Download[]>(() => {
    const prev = load<Download[]>("aurora.downloads", api ? [] : MOCK_DOWNLOADS);
    if (api) {
      // Blobs don't survive reload: interrupted -> CANCELLED, rest history.
      return prev.map((d) =>
        d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING"
          ? { ...d, state: "CANCELLED" as const, error: "Interrupted by reload" }
          : d,
      );
    }
    return prev;
  });
  const [installed] = useState<InstalledApp[]>(MOCK_INSTALLED);
  const [ignored, setIgnored] = useState<string[]>(() => load("aurora.ignored", []));
  const [blacklist, setBlacklist] = useState<string[]>(() => load("aurora.blacklist", []));
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...load<Partial<Settings>>("aurora.settings", {}),
  }));
  const [spoofDevice, setSpoofDevice] = useState<SpoofDevice>(() => load("aurora.spoofDevice", MOCK_SPOOF_DEVICES[0]));
  const [spoofLocale, setSpoofLocale] = useState<SpoofLocale>(() => load("aurora.spoofLocale", MOCK_LOCALES[0]));
  const [session, setSession] = useState<PlaySession | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [latestMap, setLatestMap] = useState<Record<string, App>>({});
  const [updatesBusy, setUpdatesBusy] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const savedBlobs = useRef(new Map<string, SavedBlob[]>());
  const autoLoginTried = useRef(false);

  useEffect(() => save("aurora.accounts", accounts), [accounts]);
  useEffect(() => save("aurora.favs", favourites), [favourites]);
  useEffect(() => save("aurora.downloads", downloads), [downloads]);
  useEffect(() => save("aurora.ignored", ignored), [ignored]);
  useEffect(() => save("aurora.blacklist", blacklist), [blacklist]);
  useEffect(() => save("aurora.settings", settings), [settings]);
  useEffect(() => save("aurora.spoofDevice", spoofDevice), [spoofDevice]);
  useEffect(() => save("aurora.spoofLocale", spoofLocale), [spoofLocale]);

  // Mock mode only: simulate download progress like DownloadWorker would report.
  useEffect(() => {
    if (realApi()) return;
    const t = setInterval(() => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.state !== "DOWNLOADING") return d;
          const next = Math.min(100, d.progress + 4);
          return {
            ...d,
            progress: next,
            bytesDone: Math.round((next / 100) * d.bytesTotal),
            state: next >= 100 ? "COMPLETED" : "DOWNLOADING",
          };
        }),
      );
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const syncAccountsToSession = useCallback((s: PlaySession) => {
    setAccounts([{ id: `srv-${s.session}`, email: s.email, type: s.isAnonymous ? "ANONYMOUS" : "GOOGLE", active: true }]);
    setSettings((prev) => ({ ...prev, anonymous: s.isAnonymous }));
  }, []);

  const ensureSession = useCallback(async (): Promise<PlaySession> => {
    const a = realApi();
    if (!a) throw new Error("No Play proxy configured");
    if (a.sessionId) {
      try {
        const st = await a.authStatus();
        if (st.valid) {
          const s: PlaySession = {
            session: a.sessionId,
            email: st.email,
            isAnonymous: st.isAnonymous,
            deviceProfile: "px_9a",
            locale: "en_US",
            gsfId: "",
          };
          setSession(s);
          setSessionError(null);
          return s;
        }
      } catch {
        /* fall through to fresh login */
      }
    }
    const s = await a.loginAnonymous();
    setSession(s);
    setSessionError(null);
    syncAccountsToSession(s);
    return s;
  }, [syncAccountsToSession]);

  // Auto anonymous login on startup (mirrors onboarding -> dispenser).
  useEffect(() => {
    if (!realApi() || autoLoginTried.current) return;
    autoLoginTried.current = true;
    setSessionBusy(true);
    ensureSession()
      .catch((e: Error) => setSessionError(e.message))
      .finally(() => setSessionBusy(false));
  }, [ensureSession]);

  const loginAnonymous = useCallback(async () => {
    const a = realApi();
    if (!a) return;
    setSessionBusy(true);
    setSessionError(null);
    try {
      const s = await a.loginAnonymous();
      setSession(s);
      syncAccountsToSession(s);
    } catch (e) {
      setSessionError((e as Error).message);
      throw e;
    } finally {
      setSessionBusy(false);
    }
  }, [syncAccountsToSession]);

  const loginGoogle = useCallback(async (email: string, token: string) => {
    const a = realApi();
    if (!a) return;
    setSessionBusy(true);
    setSessionError(null);
    try {
      const s = await a.loginGoogle(email, token, "AAS");
      setSession(s);
      syncAccountsToSession(s);
    } catch (e) {
      setSessionError((e as Error).message);
      throw e;
    } finally {
      setSessionBusy(false);
    }
  }, [syncAccountsToSession]);

  const activeAccount = accounts.find((a) => a.active) ?? accounts[0];

  const addAccount = useCallback((email: string, type: Account["type"]) => {
    setAccounts((prev) => [...prev.map((a) => ({ ...a, active: false })), { id: `acc-${Date.now()}`, email, type, active: true }]);
    setSettings((s) => ({ ...s, anonymous: type === "ANONYMOUS" }));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length && !next.some((a) => a.active)) next[0].active = true;
      return next;
    });
  }, []);

  const switchAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.map((a) => ({ ...a, active: a.id === id })));
  }, []);

  const logout = useCallback(() => {
    void realApi()?.logout().catch(() => undefined);
    setSession(null);
    setAccounts([{ id: "anon-1", email: "anonymous@auroraoss.com", type: "ANONYMOUS", active: true }]);
  }, []);

  const toggleFavourite = useCallback((pkg: string) => {
    setFavourites((prev) =>
      prev.some((f) => f.packageName === pkg)
        ? prev.filter((f) => f.packageName !== pkg)
        : [...prev, { packageName: pkg, addedAt: Date.now() }],
    );
  }, []);

  const isFavourite = useCallback((pkg: string) => favourites.some((f) => f.packageName === pkg), [favourites]);

  const patchDownload = useCallback((id: string, patch: Partial<Download>) => {
    setDownloads((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const runRealDownload = useCallback(async (id: string, pkg: string, versionCode: number) => {
    const a = realApi();
    if (!a) return;
    const ctrl = new AbortController();
    controllers.current.set(id, ctrl);
    try {
      const sess = await ensureSession().catch((e: Error) => {
        throw new Error(`Login failed: ${e.message}`);
      });
      void sess;
      patchDownload(id, { state: "QUEUED", progress: 0, bytesDone: 0, error: undefined });
      const info = await a.purchase(pkg, versionCode, 0);
      const total = info.files.reduce((sum, f) => sum + f.size, 0);
      patchDownload(id, {
        state: "DOWNLOADING",
        bytesTotal: total,
        versionCode: info.versionCode,
        partsTotal: info.files.length,
      });
      const parts: { name: string; data: Uint8Array }[] = [];
      let done = 0;
      for (const f of info.files) {
        const res = await a.downloadFile(pkg, info.versionCode, info.offerType, f.index, { signal: ctrl.signal });
        if (res.status === 401) throw new Error("Session expired during download");
        if (!res.ok || !res.body) throw new Error(`File ${f.name} failed (${res.status})`);
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
          chunks.push(value);
          received += value.length;
          const bytesDone = done + received;
          patchDownload(id, {
            bytesDone,
            progress: total > 0 ? Math.min(99, Math.round((bytesDone / total) * 100)) : 0,
          });
        }
        const bytes = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) {
          bytes.set(c, off);
          off += c.length;
        }
        if (f.sha256) {
          patchDownload(id, { state: "VERIFYING" });
          const hex = await sha256Hex(bytes);
          if (hex !== f.sha256.toLowerCase()) throw new Error(`SHA-256 mismatch for ${f.name} — deleted, retry the download`);
        }
        parts.push({ name: f.name, data: bytes });
        done += received;
        patchDownload(id, {
          state: "DOWNLOADING",
          bytesDone: done,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
        });
      }
      // Bundle like an on-device installer would: Play serves modern apps as
      // base + config splits that are useless alone, so pack every APK into a
      // single .apks (SAI / adb install-multiple format). A lone base.apk
      // stays a plain .apk. OBB expansion files can't ride in .apks and are
      // saved alongside for manual placement under Android/obb.
      const APK_MIME = "application/vnd.android.package-archive";
      const apks = parts.filter((p) => p.name.endsWith(".apk"));
      const obbs = parts.filter((p) => !p.name.endsWith(".apk"));
      const blobs: SavedBlob[] = [];
      if (apks.length === 1 && obbs.length === 0) {
        blobs.push({
          url: blobUrl(apks[0].data, APK_MIME),
          filename: `${pkg}-v${info.versionCode}-${apks[0].name}`,
        });
      } else {
        const zipped = zipSync(Object.fromEntries(apks.map((p) => [p.name, p.data])), { level: 0 });
        blobs.push({
          url: blobUrl(zipped, "application/octet-stream"),
          filename: `${pkg}-v${info.versionCode}.apks`,
        });
        for (const o of obbs) {
          blobs.push({
            url: blobUrl(o.data, "application/octet-stream"),
            filename: `${pkg}-v${info.versionCode}-${o.name}`,
          });
        }
      }
      savedBlobs.current.set(id, blobs);
      setSavedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      triggerSave(blobs);
      patchDownload(id, { state: "COMPLETED", progress: 100, bytesDone: total });
    } catch (e) {
      if (ctrl.signal.aborted) {
        patchDownload(id, { state: "CANCELLED", error: "Cancelled" });
      } else {
        patchDownload(id, { state: "FAILED", error: (e as Error).message });
      }
    } finally {
      controllers.current.delete(id);
    }
  }, [ensureSession, patchDownload]);

  const enqueueDownload = useCallback(
    (pkg: string, name: string, icon: string, versionName: string, versionCode: number) => {
      if (!realApi()) {
        setDownloads((prev): Download[] => {
          if (prev.some((d) => d.packageName === pkg && d.state === "DOWNLOADING")) return prev;
          const entry: Download = {
            id: `dl-${dlCounter++}`,
            packageName: pkg,
            displayName: name,
            iconUrl: icon,
            versionName,
            versionCode,
            progress: 0,
            state: "QUEUED",
            bytesDone: 0,
            bytesTotal: 48 * 1024 * 1024,
            startedAt: Date.now(),
          };
          return [entry, ...prev].map((d): Download =>
            d.state === "QUEUED" && d.packageName === pkg ? { ...d, state: "DOWNLOADING" } : d,
          );
        });
        return;
      }
      const id = `dl-${dlCounter++}-${Date.now()}`;
      const entry: Download = {
        id,
        packageName: pkg,
        displayName: name,
        iconUrl: icon,
        versionName,
        versionCode,
        progress: 0,
        state: "QUEUED",
        bytesDone: 0,
        bytesTotal: 0,
        startedAt: Date.now(),
      };
      setDownloads((prev) => {
        if (prev.some((d) => d.packageName === pkg && (d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING"))) {
          return prev;
        }
        return [entry, ...prev];
      });
      void runRealDownload(id, pkg, versionCode);
    },
    [runRealDownload],
  );

  const cancelDownload = useCallback((pkg: string) => {
    setDownloads((prev) => {
      let changed = false;
      const next = prev.map((d) => {
        if (d.packageName !== pkg) return d;
        if (d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING") {
          controllers.current.get(d.id)?.abort();
          changed = true;
          return { ...d, state: "CANCELLED" as const };
        }
        return d;
      });
      return changed ? next : prev;
    });
  }, []);

  const clearFinished = useCallback(() => {
    setDownloads((prev) => prev.filter((d) => d.state === "DOWNLOADING" || d.state === "QUEUED" || d.state === "VERIFYING"));
  }, []);

  const resaveDownload = useCallback((id: string) => {
    const blobs = savedBlobs.current.get(id);
    if (blobs) triggerSave(blobs);
  }, []);

  const refreshUpdates = useCallback(async () => {
    const a = realApi();
    if (!a) return;
    setUpdatesBusy(true);
    try {
      await ensureSession();
      const apps = await a.appsBulk(installed.map((i) => i.packageName));
      const map: Record<string, App> = {};
      for (const app of apps) map[app.packageName] = app;
      setLatestMap(map);
    } finally {
      setUpdatesBusy(false);
    }
  }, [ensureSession, installed]);

  const ignoreUpdate = useCallback((pkg: string, ignoredFlag: boolean) => {
    setIgnored((prev) => (ignoredFlag ? [...new Set([...prev, pkg])] : prev.filter((p) => p !== pkg)));
  }, []);

  const toggleBlacklist = useCallback((pkg: string) => {
    setBlacklist((prev) => (prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]));
  }, []);

  const patchSettings = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);

  const updates: Update[] = useMemo(() => {
    if (realApi()) {
      // Real update check: installed (device-side list) vs live Play versions.
      const out: Update[] = [];
      for (const ins of installed) {
        if (blacklist.includes(ins.packageName)) continue;
        const latest = latestMap[ins.packageName];
        if (!latest || latest.versionCode <= ins.versionCode) continue;
        out.push({
          packageName: ins.packageName,
          displayName: latest.displayName,
          iconUrl: latest.iconUrl,
          installedVersionCode: ins.versionCode,
          installedVersionName: ins.versionName,
          updateVersionCode: latest.versionCode,
          updateVersionName: latest.versionName,
          updateSize: latest.size,
          changes: latest.changes,
          ignored: ignored.includes(ins.packageName),
        });
      }
      return out;
    }
    return updatesFromInstalled(installed)
      .filter((u) => !blacklist.includes(u.packageName))
      .map((u) => ({ ...u, ignored: ignored.includes(u.packageName) }));
  }, [installed, ignored, blacklist, latestMap]);

  const value: Store = {
    accounts,
    activeAccount,
    addAccount,
    removeAccount,
    switchAccount,
    logout,
    session,
    sessionBusy,
    sessionError,
    ensureSession,
    loginAnonymous,
    loginGoogle,
    favourites,
    toggleFavourite,
    isFavourite,
    downloads,
    enqueueDownload,
    cancelDownload,
    clearFinished,
    resaveDownload,
    savedIds,
    installed,
    updates,
    updatesBusy,
    refreshUpdates,
    ignoreUpdate,
    blacklist,
    toggleBlacklist,
    spoofDevice,
    setSpoofDevice,
    spoofLocale,
    setSpoofLocale,
    spoofDevices: MOCK_SPOOF_DEVICES,
    spoofLocales: MOCK_LOCALES,
    settings,
    patchSettings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
