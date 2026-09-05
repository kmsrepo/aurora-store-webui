import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClusterSection, AppRow } from "../components/apps";
import { Chip, Empty, Loading, ErrorBox, SectionHeader } from "../components/ui";
import { playApi } from "../lib/playApi";
import type { App, Category, StreamBundle } from "../lib/types";

/** Mirrors AppsGamesScreen.kt — pageType 0=Apps, 1=Games. Tabs: For You | Top Charts | Categories */
export function AppsGames({ pageType }: { pageType: 0 | 1 }) {
  const [tab, setTab] = useState<"foryou" | "top" | "cats">("foryou");
  const title = pageType === 1 ? "Games" : "Apps";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="px-0 text-2xl font-bold text-white">{title}</h1>
      <div className="flex gap-2">
        <Chip active={tab === "foryou"} onClick={() => setTab("foryou")}>For you</Chip>
        <Chip active={tab === "top"} onClick={() => setTab("top")}>Top charts</Chip>
        <Chip active={tab === "cats"} onClick={() => setTab("cats")}>Categories</Chip>
      </div>
      {tab === "foryou" && <ForYou pageType={pageType} />}
      {tab === "top" && <TopCharts pageType={pageType} />}
      {tab === "cats" && <Categories />}
    </div>
  );
}

function useBundle(pageType: 0 | 1, kind: "home" | "top") {
  const [bundle, setBundle] = useState<StreamBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setBundle(null);
    setError(null);
    (kind === "home" ? playApi.home(pageType) : playApi.topCharts(pageType))
      .then((b) => alive && setBundle(b))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [pageType, kind]);
  return { bundle, error, retry: () => setError(null) };
}

/** Mirrors ForYouPage.kt */
function ForYou({ pageType }: { pageType: 0 | 1 }) {
  const { bundle, error } = useBundle(pageType, "home");
  if (error) return <ErrorBox message={error} />;
  if (!bundle) return <Loading label="Loading recommendations…" />;
  const clusters = Object.values(bundle.streamClusters);
  if (!clusters.length) return <Empty icon="📭" title="Nothing here yet" hint="The Play feed returned no clusters." />;
  return (
    <div className="flex flex-col gap-5">
      {clusters.map((c) => (
        <ClusterSection key={c.id} cluster={c} />
      ))}
    </div>
  );
}

/** Mirrors TopChartsPage.kt */
function TopCharts({ pageType }: { pageType: 0 | 1 }) {
  const [sub, setSub] = useState(0);
  const subs = ["Top free", "Top grossing", "Trending", "Top paid"];
  const { bundle, error } = useBundle(pageType, "top");
  if (error) return <ErrorBox message={error} />;
  if (!bundle) return <Loading label="Loading charts…" />;
  const clusters = Object.values(bundle.streamClusters);
  const apps: App[] = clusters[sub % Math.max(1, clusters.length)]?.clusterAppList ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto">
        {subs.map((s, i) => (
          <Chip key={s} active={sub === i} onClick={() => setSub(i)}>{s}</Chip>
        ))}
      </div>
      {apps.map((a, i) => (
        <div key={a.packageName} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-500">{i + 1}</span>
          <div className="flex-1"><AppRow app={a} /></div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors CategoriesPage.kt */
function Categories() {
  const [cats, setCats] = useState<Category[] | null>(null);
  useEffect(() => {
    let alive = true;
    playApi.categories().then((c) => alive && setCats(c));
    return () => { alive = false; };
  }, []);
  if (!cats) return <Loading label="Loading categories…" />;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cats.map((c) => (
        <Link
          key={c.id}
          to={`/category?title=${encodeURIComponent(c.title)}&url=${encodeURIComponent(c.browseUrl)}`}
          className="rounded-2xl bg-[#1b1e22] p-4 hover:bg-[#22262c]"
        >
          <p className="text-[14px] font-medium text-white">{c.title}</p>
          <p className="text-[12px] text-gray-500">Browse →</p>
        </Link>
      ))}
    </div>
  );
}

/** Mirrors StreamBrowse / ExpandedStreamBrowse / CategoryBrowse screens. */
export function BrowseList({ title, fetch }: { title: string; fetch: () => Promise<App[]> }) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch()
      .then((a) => alive && setApps(a))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title={title} subtitle={apps ? `${apps.length} apps` : undefined} />
      {error && <ErrorBox message={error} />}
      {!error && !apps && <Loading />}
      {apps?.map((a) => <AppRow key={a.packageName} app={a} />)}
    </div>
  );
}
