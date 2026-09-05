import { Link } from "react-router-dom";
import type { App, StreamCluster } from "../lib/types";
import { formatCount, stars } from "../lib/format";
import { Img } from "./ui";

function icon(app: App, size = "h-14 w-14") {
  return <Img src={app.iconUrl} alt="" className={`${size} shrink-0 rounded-2xl`} />;
}

/** Mirrors `AppListItem` / horizontal carousel card. */
export function AppCard({ app }: { app: App }) {
  return (
    <Link
      to={`/app/${app.packageName}`}
      className="flex w-28 shrink-0 snap-start flex-col gap-1.5 rounded-2xl p-1.5 hover:bg-white/5"
    >
      <Img src={app.iconUrl} alt={app.displayName} className="aspect-square w-full rounded-2xl" />
      <p className="line-clamp-2 text-[12px] leading-tight text-gray-200">{app.displayName}</p>
      <p className="text-[11px] text-gray-500">
        {app.rating.average.toFixed(1)} ★ · {app.installsShort}
      </p>
    </Link>
  );
}

/** Mirrors `LargeAppListItem` — search results / stream rows. */
export function AppRow({ app, right }: { app: App; right?: React.ReactNode }) {
  return (
    <Link
      to={`/app/${app.packageName}`}
      className="flex items-center gap-3 rounded-2xl bg-[#1b1e22] p-3 hover:bg-[#22262c]"
    >
      {icon(app)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-white">{app.displayName}</p>
        <p className="truncate text-[12px] text-gray-400">{app.developerName}</p>
        <p className="mt-0.5 text-[12px] text-gray-500">
          <span className="text-amber-300">{stars(app.rating.average)}</span> {app.rating.average.toFixed(1)} ·{" "}
          {formatCount(app.rating.count)} reviews · {app.installsShort}
        </p>
      </div>
      {right ?? (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-gray-200">
          {app.isFree ? "Get" : app.price}
        </span>
      )}
    </Link>
  );
}

/** Mirrors `ClusterRow` + `SectionHeader` carousel. */
export function ClusterSection({ cluster }: { cluster: StreamCluster }) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between px-4">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{cluster.clusterTitle}</h2>
          {cluster.clusterSubtitle && <p className="text-[12px] text-gray-500">{cluster.clusterSubtitle}</p>}
        </div>
        <Link
          to={`/stream?title=${encodeURIComponent(cluster.clusterTitle)}&url=${encodeURIComponent(cluster.browseUrl)}`}
          className="text-[13px] font-medium text-emerald-400 hover:text-emerald-300"
        >
          More →
        </Link>
      </div>
      <div className="no-scrollbar flex snap-x gap-1 overflow-x-auto px-3 pb-1">
        {cluster.clusterAppList.map((a) => (
          <AppCard key={a.packageName} app={a} />
        ))}
      </div>
    </section>
  );
}
