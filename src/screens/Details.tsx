import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppCard, ClusterSection } from "../components/apps";
import { Empty, ErrorBox, Img, Loading, ProgressBar, SectionHeader } from "../components/ui";
import { formatBytes, formatCount, stars } from "../lib/format";
import { getApp, homeBundle } from "../lib/mockData";
import { playApi, SessionExpiredError, usingMockBackend } from "../lib/playApi";
import { useStore } from "../lib/store";
import type { App, DataSafetyReport, ExodusReport, PlexusScores, Review, StreamBundle } from "../lib/types";

/**
 * Mirrors AppDetailsScreen.kt sections:
 * Details | Actions | Tags | Changelog | More-about | Screenshots |
 * RatingAndReviews | UserReview | Testing | Compatibility(Plexus) |
 * Permissions | DataSafety | Privacy(Exodus) | DeveloperDetails | Suggestions
 */
export function AppDetails() {
  const { pkg = "" } = useParams();
  const { ensureSession } = useStore();
  const [app, setApp] = useState<App | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [exodus, setExodus] = useState<ExodusReport | null>(null);
  const [safety, setSafety] = useState<DataSafetyReport | null>(null);
  const [plexus, setPlexus] = useState<PlexusScores | null>(null);
  const [suggestions, setSuggestions] = useState<StreamBundle | null>(null);
  const [related, setRelated] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setApp(undefined);
    setError(null);
    setSessionExpired(false);
    setRelated(null);
    playApi
      .appDetails(pkg)
      .then(async (a) => {
        if (!alive) return;
        setApp(a);
        const [r, e, s, p] = await Promise.all([
          playApi.reviews(pkg),
          playApi.exodus(pkg),
          playApi.dataSafety(pkg),
          playApi.plexus(pkg),
        ]);
        if (!alive) return;
        setReviews(r);
        setExodus(e);
        setSafety(s);
        setPlexus(p);
        setSuggestions(homeBundle(0));
        try {
          const rel = await playApi.related(pkg);
          if (!alive) return;
          setRelated(rel);
        } catch {
          if (!alive) return;
          setRelated(null);
        }
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setApp(null);
        setSessionExpired(e instanceof SessionExpiredError);
      });
    return () => { alive = false; };
  }, [pkg, retry]);

  if (error)
    return (
      <div className="flex flex-col items-center gap-3">
        <ErrorBox message={error} />
        {sessionExpired && (
          <button
            onClick={() => {
              void ensureSession().finally(() => setRetry((c) => c + 1));
            }}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Log in again
          </button>
        )}
      </div>
    );
  if (app === undefined) return <Loading label="Loading app details…" />;
  if (app === null) return <Empty icon="📭" title="App unavailable" hint="The Play API returned no details for this package." />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Details app={app} />
      <Actions app={app} />
      <Tags app={app} />
      <Changelog app={app} />
      <Screenshots app={app} />
      <RatingAndReviews app={app} reviews={reviews} />
      {app.testingProgram?.isAvailable && <Testing app={app} />}
      <Compatibility app={app} plexus={plexus} />
      <Permissions app={app} />
      {safety && <DataSafety report={safety} />}
      {exodus && <Privacy report={exodus} />}
      <Developer app={app} />
      {suggestions && (
        <div className="flex flex-col gap-4">
          {Object.values(suggestions.streamClusters).slice(0, 2).map((c) => (
            <ClusterSection key={c.id} cluster={c} />
          ))}
        </div>
      )}
      {related && related.length > 0 && (
        <section>
          <SectionHeader title="Similar apps" subtitle={`${related.length} related apps`} />
          <div className="no-scrollbar mt-2 flex snap-x gap-1 overflow-x-auto pb-1">
            {related.map((a) => (
              <AppCard key={a.packageName} app={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Details({ app }: { app: App }) {
  const { isFavourite } = useStore();
  return (
    <div className="flex gap-4">
      <Img src={app.iconUrl} alt="" className="h-24 w-24 rounded-3xl" />
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-white">{app.displayName}</h1>
        <Link to={`/dev/${app.developerId}`} className="text-[14px] text-emerald-400 hover:underline">
          {app.developerName}
        </Link>
        <p className="mt-1 text-[13px] text-gray-400">
          {app.category} · {app.installsShort} · {app.size} · {app.versionName}
        </p>
        <p className="mt-1 text-[13px] text-gray-400">
          <span className="text-amber-300">{stars(app.rating.average)}</span> {app.rating.average.toFixed(1)} ·{" "}
          {formatCount(app.rating.count)} reviews {isFavourite(app.packageName) ? "· ♥ Favourite" : ""}
        </p>
      </div>
    </div>
  );
}

function Actions({ app }: { app: App }) {
  const { enqueueDownload, cancelDownload, downloads, toggleFavourite, isFavourite, installed } = useStore();
  const dl = downloads.find((d) => d.packageName === app.packageName && (d.state === "DOWNLOADING" || d.state === "QUEUED"));
  const isInstalled = installed.some((i) => i.packageName === app.packageName);
  const fav = isFavourite(app.packageName);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {dl ? (
          <button
            onClick={() => cancelDownload(app.packageName)}
            className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            Cancel ({Math.round(dl.progress)}%)
          </button>
        ) : (
          <button
            onClick={() => enqueueDownload(app.packageName, app.displayName, app.iconUrl, app.versionName, app.versionCode)}
            className="flex-1 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            {isInstalled ? "Update" : app.isFree ? "Install" : `Buy · ${app.price}`}
          </button>
        )}
        <button
          onClick={() => toggleFavourite(app.packageName)}
          className={`rounded-full px-4 py-2.5 text-sm font-semibold ${fav ? "bg-pink-500/20 text-pink-300" : "bg-white/10 text-white hover:bg-white/15"}`}
        >
          {fav ? "♥ Saved" : "♡ Save"}
        </button>
      </div>
      {dl && <ProgressBar value={dl.progress} />}
      {isInstalled && <p className="text-[12px] text-gray-500">Installed on this demo device — updates appear in the Updates tab.</p>}
      {!app.isFree && <p className="text-[12px] text-amber-300/90">Paid app — anonymous accounts cannot acquire it (mirrors Android `canAcquire`).</p>}
    </div>
  );
}

function Tags({ app }: { app: App }) {
  return (
    <div className="flex flex-wrap gap-2">
      {app.tags.map((t) => (
        <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-[12px] text-gray-300">#{t}</span>
      ))}
      {app.containsAds && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[12px] text-amber-300">Contains ads</span>}
      {app.inAppPurchases && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[12px] text-amber-300">In-app purchases</span>}
      {app.requiresGMS && <span className="rounded-full bg-red-400/10 px-3 py-1 text-[12px] text-red-300">Requires GMS</span>}
    </div>
  );
}

function Changelog({ app }: { app: App }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="What's new" subtitle={`v${app.versionName} · ${app.updatedOn}`} />
      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-gray-300">{app.changes}</p>
    </section>
  );
}

function Screenshots({ app }: { app: App }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section>
      <SectionHeader title="Screenshots" subtitle={`${app.screenshots.length} images`} />
      <div className="no-scrollbar mt-2 flex snap-x gap-2 overflow-x-auto">
        {app.screenshots.map((s, i) => (
          <button key={i} onClick={() => setOpen(i)} className="snap-start">
            <Img src={s} alt={`Screenshot ${i + 1}`} className="h-56 w-auto rounded-xl" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <Img src={app.screenshots[open]} alt="" className="max-h-full rounded-2xl" />
        </div>
      )}
    </section>
  );
}

function RatingAndReviews({ app, reviews }: { app: App; reviews: Review[] }) {
  const r = app.rating;
  const max = Math.max(...r.histogram, 1);
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="Ratings & reviews" subtitle={`${formatCount(r.count)} verified ratings`} to={`/app/${app.packageName}/reviews`} actionLabel="See all →" />
      <div className="mt-3 flex gap-5">
        <div className="text-center">
          <p className="text-4xl font-bold text-white">{r.average.toFixed(1)}</p>
          <p className="text-amber-300">{stars(r.average)}</p>
          <p className="text-[12px] text-gray-500">{formatCount(r.count)}</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1">
          {r.histogram.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px] text-gray-400">
              <span className="w-3">{5 - i}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-400" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {reviews.slice(0, 3).map((rev) => (
          <article key={rev.id} className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm">{rev.userName[0]}</span>
              <div className="flex-1">
                <p className="text-[13px] font-medium text-white">{rev.userName}</p>
                <p className="text-[11px] text-gray-500">{rev.date} · ★{rev.rating}</p>
              </div>
              <span className="text-[11px] text-gray-500">👍 {rev.likes}</span>
            </div>
            <p className="mt-2 text-[13px] font-medium text-gray-200">{rev.title}</p>
            <p className="line-clamp-3 text-[13px] text-gray-400">{rev.comment}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Testing({ app }: { app: App }) {
  const [sub, setSub] = useState(app.testingProgram?.isSubscribed ?? false);
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="Beta program" subtitle="TestingProgram — join/leave from here" />
      <button
        onClick={() => setSub((v) => !v)}
        className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold ${sub ? "bg-white/10 text-white" : "bg-emerald-500 text-black"}`}
      >
        {sub ? "Leave beta" : "Join beta"}
      </button>
    </section>
  );
}

function Compatibility({ app, plexus }: { app: App; plexus: PlexusScores | null }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="Compatibility" subtitle={app.requiresGMS ? "Requires Google Play Services" : "Works without Google services"} />
      {plexus && (plexus.microGScore >= 0 || plexus.degoogledScore >= 0) && (
        <p className="mt-2 text-[13px] text-gray-300">
          Plexus scores — microG: {plexus.microGScore >= 0 ? `${plexus.microGScore}/4` : "unknown"} · de-googled:{" "}
          {plexus.degoogledScore >= 0 ? `${plexus.degoogledScore}/4` : "unknown"}
        </p>
      )}
    </section>
  );
}

function Permissions({ app }: { app: App }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader
        title="App permissions"
        subtitle={app.permissions.length ? `${app.permissions.length} requested` : "No permissions"}
        to={app.permissions.length ? `/app/${app.packageName}/permissions` : undefined}
        actionLabel="See all →"
      />
      <ul className="mt-2 flex flex-col gap-1">
        {app.permissions.slice(0, 4).map((p) => (
          <li key={p} className="font-mono text-[12px] text-gray-400">{p}</li>
        ))}
      </ul>
    </section>
  );
}

function DataSafety({ report }: { report: DataSafetyReport }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="Data safety" />
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-gray-300">
        <li>{report.sharesData ? "⚠️ Shares data with third parties" : "✅ No data shared with third parties"}</li>
        <li>📥 Collects: {report.dataCollected.join(", ")}</li>
        {report.dataShared.length > 0 && <li>📤 Shared: {report.dataShared.join(", ")}</li>}
        {report.securityPractices.map((s) => <li key={s}>🔒 {s}</li>)}
      </ul>
    </section>
  );
}

function Privacy({ report }: { report: ExodusReport }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader
        title="Privacy · Exodus"
        subtitle={report.trackers.length ? `${report.trackers.length} tracker${report.trackers.length === 1 ? "" : "s"} found` : "No trackers found"}
        to={`/app/${report.packageName}/exodus`}
        actionLabel="Details →"
      />
      {report.trackers.length === 0 ? (
        <p className="mt-2 text-[13px] text-emerald-300">✅ Clean — no known trackers in v{report.versionName}.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {report.trackers.map((t) => (
            <span key={t.id} className="rounded-full bg-red-400/10 px-3 py-1 text-[12px] text-red-300">{t.name}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function Developer({ app }: { app: App }) {
  return (
    <section className="rounded-2xl bg-[#1b1e22] p-4">
      <SectionHeader title="Developer contact" />
      <div className="mt-2 flex flex-col gap-1 text-[13px] text-gray-300">
        <span>🏢 {app.developerName}</span>
        <span>✉️ {app.developerEmail}</span>
        <span>🌐 {app.developerWebsite}</span>
        <span className="text-gray-500">📍 {app.developerAddress}</span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-gray-500">{app.description}</p>
    </section>
  );
}

/** Mirrors ReviewScreen.kt */
export function Reviews() {
  const { pkg = "" } = useParams();
  const app = getApp(pkg);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    playApi.reviews(pkg).then(setReviews);
  }, [pkg]);
  const [mine, setMine] = useState("");
  if (!app) return <Empty icon="📭" title="Unknown app" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <h1 className="text-xl font-bold text-white">Reviews · {app.displayName}</h1>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="rounded-2xl bg-[#1b1e22] p-4"
      >
        <p className="text-[14px] font-medium text-white">Rate this app</p>
        <textarea
          value={mine}
          onChange={(e) => setMine(e.target.value)}
          placeholder="Share your experience… (demo only, mirrors UserReview)"
          className="mt-2 w-full rounded-xl bg-white/5 p-3 text-[14px] text-white outline-none placeholder:text-gray-500"
          rows={3}
        />
        <button className="mt-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">Post review</button>
      </form>
      {!reviews && <Loading />}
      {reviews?.map((r) => (
        <article key={r.id} className="rounded-2xl bg-[#1b1e22] p-4">
          <p className="text-[14px] font-medium text-white">{r.userName} · <span className="text-amber-300">{"★".repeat(r.rating)}</span></p>
          <p className="text-[13px] font-medium text-gray-200">{r.title}</p>
          <p className="text-[13px] text-gray-400">{r.comment}</p>
        </article>
      ))}
    </div>
  );
}

/** Mirrors PermissionScreen.kt */
export function PermissionsScreen() {
  const { pkg = "" } = useParams();
  const app = getApp(pkg);
  if (!app) return <Empty icon="📭" title="Unknown app" />;
  const groups: Record<string, string[]> = {};
  for (const p of app.permissions) {
    const g = p.split(".")[2] ?? "Other";
    groups[g] = [...(groups[g] ?? []), p];
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <h1 className="text-xl font-bold text-white">Permissions · {app.displayName}</h1>
      {Object.entries(groups).map(([g, list]) => (
        <section key={g} className="rounded-2xl bg-[#1b1e22] p-4">
          <p className="text-[14px] font-semibold text-white">{g}</p>
          {list.map((p) => <p key={p} className="mt-1 font-mono text-[12px] text-gray-400">{p}</p>)}
        </section>
      ))}
    </div>
  );
}

/** Mirrors ExodusScreen.kt */
export function ExodusDetails() {
  const { pkg = "" } = useParams();
  const [report, setReport] = useState<ExodusReport | null>(null);
  useEffect(() => { playApi.exodus(pkg).then(setReport); }, [pkg]);
  if (!report) return <Loading label="Fetching Exodus report…" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <h1 className="text-xl font-bold text-white">Trackers · {pkg}</h1>
      <p className="text-[13px] text-gray-400">Report #{report.id} · v{report.versionName} ({formatBytes(0)} Harris)</p>
      {report.trackers.length === 0 && <Empty icon="✅" title="No trackers" hint="Exodus found no known tracker signatures in this version." />}
      {report.trackers.map((t) => (
        <section key={t.id} className="rounded-2xl bg-[#1b1e22] p-4">
          <p className="font-medium text-white">{t.name}</p>
          <p className="text-[12px] text-amber-300">{t.categories.join(" · ")}</p>
          <p className="mt-1 text-[13px] text-gray-400">{t.description}</p>
        </section>
      ))}
    </div>
  );
}

/** Mirrors ManualDownloadScreen.kt */
export function ManualDownload() {
  const { pkg = "" } = useParams();
  const { enqueueDownload } = useStore();
  const app = getApp(pkg);
  const [code, setCode] = useState("");
  if (!app) return <Empty icon="📭" title="Unknown app" />;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-xl font-bold text-white">Manual download</h1>
      <p className="text-[13px] text-gray-400">
        Download a specific version code (Android mirrors this with AppDetailsHelper.getAppDetails + version code input).
        Current: v{app.versionName} ({app.versionCode}).
      </p>
      {!usingMockBackend && (
        <p className="text-[13px] text-gray-400">
          Real mode purchases the exact version code from Play.
        </p>
      )}
      {app.fileList.map((f) => (
        <div key={f.name} className="rounded-2xl bg-[#1b1e22] p-4 text-[13px] text-gray-300">
          <p className="font-mono">{f.name}</p>
          <p className="text-gray-500">{formatBytes(f.size)} · version {f.versionCode}</p>
        </div>
      ))}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Version code, e.g. 90210"
        inputMode="numeric"
        className="rounded-xl bg-[#1b1e22] p-3 text-white outline-none placeholder:text-gray-500"
      />
      <button
        onClick={() => enqueueDownload(app.packageName, app.displayName, app.iconUrl, `vc${code || app.versionCode}`, Number(code) || app.versionCode)}
        className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black"
      >
        Enqueue version {code || app.versionCode}
      </button>
    </div>
  );
}
