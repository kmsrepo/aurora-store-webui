import { Link } from "react-router-dom";
import { AppRow } from "../components/apps";
import { Empty } from "../components/ui";
import { getApp } from "../lib/mockData";
import { useStore } from "../lib/store";
import type { Settings as SettingsState } from "../lib/store";

/** Mirrors SpoofScreen.kt (DevicePage + LocalePage + SpoofMenu). */
export function Spoof() {
  const { spoofDevice, setSpoofDevice, spoofLocale, setSpoofLocale, spoofDevices, spoofLocales } = useStore();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold text-white">Spoof manager</h1>
      <p className="text-[13px] text-gray-400">
        Change device profile / locale to access geo-locked apps (mirrors SpoofProvider + deviceProperties).
        Applies to the Play API proxy on next request.
      </p>
      <section>
        <p className="mb-2 text-[14px] font-semibold text-white">Device — active: {spoofDevice.name}</p>
        <div className="flex flex-col gap-2">
          {spoofDevices.map((d) => (
            <button
              key={d.id}
              onClick={() => setSpoofDevice(d)}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left ${d.id === spoofDevice.id ? "bg-emerald-500/10 ring-1 ring-emerald-400/40" : "bg-[#1b1e22] hover:bg-[#22262c]"}`}
            >
              <span className="text-xl">📱</span>
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-white">{d.name}</span>
                <span className="block text-[12px] text-gray-500">{d.manufacturer} {d.model} · Android {d.androidVersion} (SDK {d.sdk})</span>
              </span>
              {d.id === spoofDevice.id && <span className="text-emerald-300">✓</span>}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2 text-[14px] font-semibold text-white">Locale — active: {spoofLocale.name}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {spoofLocales.map((l) => (
            <button
              key={l.code}
              onClick={() => setSpoofLocale(l)}
              className={`rounded-2xl p-3 text-left text-[14px] ${l.code === spoofLocale.code ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-[#1b1e22] text-gray-200 hover:bg-[#22262c]"}`}
            >
              {l.name} <span className="text-gray-500">· {l.code}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Mirrors Blacklist screen (BlacklistProvider). */
export function Blacklist() {
  const { blacklist, toggleBlacklist, updates } = useStore();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-bold text-white">Update blacklist</h1>
      <p className="text-[13px] text-gray-400">Ignored packages never appear in Updates (mirrors BlacklistProvider).</p>
      {blacklist.length === 0 && <Empty icon="🚫" title="Blacklist is empty" hint="Use Blacklist on any update row to hide it here." />}
      {blacklist.map((pkg) => {
        const known = updates.find((u) => u.packageName === pkg) ?? getApp(pkg);
        return (
          <div key={pkg} className="flex items-center gap-3 rounded-2xl bg-[#1b1e22] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-white">{known && "displayName" in known ? known.displayName : pkg}</p>
              <p className="font-mono text-[12px] text-gray-500">{pkg}</p>
            </div>
            <button onClick={() => toggleBlacklist(pkg)} className="text-[13px] text-emerald-400">Unblock</button>
          </div>
        );
      })}
      <div className="rounded-2xl bg-white/[0.03] p-3 text-[12px] text-gray-500">
        Demo: blacklist a package from <Link to="/updates" className="text-emerald-400">Updates →</Link>
      </div>
    </div>
  );
}

/** Mirrors Settings + all *Preference screens. */
export function Settings() {
  const { settings, patchSettings, spoofDevice, spoofLocale } = useStore();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <Group title="General / UI (UIPreference)">
        <Row label="Theme" control={
          <select value={settings.theme} onChange={(e) => patchSettings({ theme: e.target.value as SettingsState["theme"] })} className="rounded-lg bg-white/10 p-1.5 text-sm text-white">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        } />
        <Row label="FOSS-only filter" hint="Hide apps with trackers/ads" control={<Toggle on={settings.filterFOSSOnly} onFlip={() => patchSettings({ filterFOSSOnly: !settings.filterFOSSOnly })} />} />
        <Row label="Hide GMS-dependent" control={<Toggle on={settings.filterGMS} onFlip={() => patchSettings({ filterGMS: !settings.filterGMS })} />} />
      </Group>

      <Group title="Network (NetworkPreference)">
        <Row label="Insecure anonymous auth" hint="Allow fallback dispensers" control={<Toggle on={settings.insecureAnonymous} onFlip={() => patchSettings({ insecureAnonymous: !settings.insecureAnonymous })} />} />
        <Row label={`Spoof: ${spoofDevice.name} · ${spoofLocale.code}`} control={<Link to="/spoof" className="text-[13px] text-emerald-400">Manage →</Link>} />
      </Group>

      <Group title="Updates (UpdatesPreference)">
        <Row label="Auto-update" control={<Toggle on={settings.autoUpdate} onFlip={() => patchSettings({ autoUpdate: !settings.autoUpdate })} />} />
        <Row label="Check interval" control={
          <select value={settings.updateCheckIntervalH} onChange={(e) => patchSettings({ updateCheckIntervalH: Number(e.target.value) })} className="rounded-lg bg-white/10 p-1.5 text-sm text-white">
            {[6, 12, 24, 48, 168].map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        } />
        <Row label="Warn on new trackers" hint="ExodusTrackerWorker check" control={<Toggle on={settings.warnTrackers} onFlip={() => patchSettings({ warnTrackers: !settings.warnTrackers })} />} />
      </Group>

      <Group title="Installation (InstallationPreference + Installer)">
        <Row label="Install method" hint="WebUI downloads APKs; no session/root install" control={
          <select value={settings.installer} onChange={(e) => patchSettings({ installer: e.target.value as SettingsState["installer"] })} className="rounded-lg bg-white/10 p-1.5 text-sm text-white">
            <option value="manual">Manual APK download</option>
            <option value="session">Session (Android only)</option>
            <option value="native">Native (Android only)</option>
          </select>
        } />
        <Row label="Accounts" control={<Link to="/accounts" className="text-[13px] text-emerald-400">Manage →</Link>} />
        <Row label="Blacklist" control={<Link to="/blacklist" className="text-[13px] text-emerald-400">Manage →</Link>} />
      </Group>

      <Group title="Notifications & Security">
        <Row label="Update notifications" control={<Toggle on={true} onFlip={() => {}} />} />
        <Row label="About" control={<Link to="/about" className="text-[13px] text-emerald-400">Open →</Link>} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#1b1e22]">
      <p className="border-b border-white/5 px-4 py-2.5 text-[13px] font-semibold text-gray-300">{title}</p>
      {children}
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
      <div className="flex-1">
        <p className="text-[14px] text-white">{label}</p>
        {hint && <p className="text-[12px] text-gray-500">{hint}</p>}
      </div>
      {control}
    </div>
  );
}

function Toggle({ on, onFlip }: { on: boolean; onFlip: () => void }) {
  return (
    <button
      onClick={onFlip}
      className={`relative h-6 w-11 rounded-full transition ${on ? "bg-emerald-500" : "bg-white/15"}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Mirrors AboutScreen.kt */
export function About() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-3xl font-bold text-black">A</span>
      <h1 className="text-2xl font-bold text-white">Aurora Store · WebUI</h1>
      <p className="text-[13px] text-gray-400">v4.8.4-web (76) · GPL-3.0-or-later · port of com.aurora.store</p>
      <p className="max-w-md text-[14px] leading-relaxed text-gray-300">
        Aurora Store lets you search and download apps from Google Play. This WebUI is a faithful port of the
        Android Compose screens — same navigation graph, same sections — with Room→localStorage, Hilt
        ViewModels→hooks, and gplayapi→pluggable proxy backend.
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-[13px]">
        {[["GitLab", "https://gitlab.com/AuroraOSS/AuroraStore"], ["F-Droid", "https://f-droid.org/packages/com.aurora.store/"], ["Wiki / FAQ", "https://gitlab.com/AuroraOSS/AuroraStore/-/wikis/home"], ["Support", "https://t.me/AuroraSupport"]].map(([label, href]) => (
          <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-4 py-2 text-gray-200 hover:bg-white/15">{label} →</a>
        ))}
      </div>
      <p className="max-w-md text-[12px] leading-relaxed text-gray-600">
        Disclaimer: works like a browser for Google Play. Not affiliated with, sponsored or authorized by Google.
        Anonymous logins have limited features (no library, purchases, beta programs).
      </p>
    </div>
  );
}

/** Mirrors OnboardingScreen (Welcome + Permissions + intro flag). */
export function Onboarding() {
  const { patchSettings } = useStore();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-3xl font-bold text-black">A</span>
      <h1 className="text-3xl font-bold text-white">Welcome to Aurora</h1>
      <p className="text-[14px] text-gray-400">A privacy-respecting Play Store client — now on the web. Anonymous login, device spoofing, tracker insights.</p>
      <ul className="flex flex-col gap-2 text-left text-[14px] text-gray-300">
        <li>✅ No Google account required (anonymous dispenser)</li>
        <li>✅ Exodus tracker + Plexus compatibility reports</li>
        <li>✅ Favourites, update blacklist, manual downloads</li>
      </ul>
      <Link
        to="/apps"
        onClick={() => patchSettings({ introDone: true })}
        className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-400"
      >
        Get started
      </Link>
      <Link to="/accounts/login" className="text-[13px] text-emerald-400">I have a Google account →</Link>
    </div>
  );
}

/** Mirrors Installed + Favourites cross-links used by AppRow right slots. */
export function CategoryPage() {
  return null;
}

export { AppRow as CategoryAppRow };
