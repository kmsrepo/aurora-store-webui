/**
 * Play Store *web* client (batchexecute RPC) — TypeScript port of the
 * gplayapi web helpers (WebStreamHelper, WebSearchHelper,
 * WebCategoryHelper, WebCategoryStreamHelper, WebTopChartsHelper,
 * WebAppDetailsHelper, WebAppBuilder, RpcBuilder). This is the same path
 * the Android app uses for home/search/streams. No Play auth needed —
 * only a locale for hl/gl.
 */
import { javaHash } from "./dfe.ts";
import {
  METADATA_TOKEN,
  PAGINATED_STREAM_TOKEN,
  SEARCH_TOKEN,
  STREAM_TOKEN,
  TOP_CHARTS_TOKEN,
} from "./tokens.ts";

// ── dig helpers (utils/Extensions dig port) ──────────────────────

function at(root: unknown, ...keys: (string | number)[]): unknown {
  let cur = root;
  for (const key of keys) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof key === "number") {
      if (!Array.isArray(cur) || key >= cur.length) return undefined;
      cur = cur[key];
    } else {
      if (typeof cur !== "object" || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
  }
  return cur;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function n(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Java URLEncoder.encode(s, "UTF-8") semantics for form bodies. */
function urlEncodeForm(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/~/g, "%7E");
}

/** Escape a value interpolated inside a batchexecute JSON string. */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ── RPC request builders ─────────────────────────────────────────

const TAG_FEATURED = "FeaturedStreamBuilder";
const TAG_NEXT_BUNDLE = "NextBundleBuilder";
const TAG_NEXT_CLUSTER = "NextClusterBuilder";
const TAG_RELATED = "RelatedAppsBuilder";
const TAG_SEARCH = "SearchQueryBuilder";
const TAG_SUGGEST = "SearchSuggestionQueryBuilder";
const TAG_TOP = "TopChartsBuilder";
const TAG_CATEGORY = "CategoryBuilder";
const TAG_METADATA = "MetadataBuilder";

function featuredStream(category: string): string {
  return `["w3QCWb","[[null,2,\\"${esc(category)}\\",null,${STREAM_TOKEN},null,2],[1,1]]",null,"${TAG_FEATURED}@${esc(category)}"]`;
}

export function nextBundle(category: string, token: string): string {
  const t = PAGINATED_STREAM_TOKEN.replace("%s", token);
  return `["w3QCWb","[[null,2,\\"${esc(category)}\\",null,${t},null,2],[1,1]]",null,"${TAG_NEXT_BUNDLE}@${esc(category)}"]`;
}

export function nextCluster(token: string): string {
  return `["qnKhOb","[[null,${STREAM_TOKEN},null,\\"${esc(token)}\\"],[1]]",null,"${TAG_NEXT_CLUSTER}@${javaHash(token)}"]`;
}

function relatedApps(pkg: string): string {
  return `["ag2B9c","[[null,[\\"${esc(pkg)}\\",7],null,[[3,[6]],null,null,[1,8]]],[1]]",null,"${TAG_RELATED}@${esc(pkg)}"]`;
}

function searchQuery(query: string, nextToken = ""): string {
  if (nextToken) {
    return `["qnKhOb","[[null,${SEARCH_TOKEN},null,\\"${esc(nextToken)}\\"]]",null,"${TAG_SEARCH}@${esc(query)}"]`;
  }
  return `["lGYRle","[[[],${SEARCH_TOKEN},[\\"${esc(query)}\\"],4,[null,1],null,null,[]]]",null,"${TAG_SEARCH}@${esc(query)}"]`;
}

function suggestQuery(query: string): string {
  return `["teXCtc","[null,[\\"${esc(query)}\\"],[10],[2,1],4]",null,"${TAG_SUGGEST}@${esc(query)}"]`;
}

function topCharts(category: string, chart: string): string {
  return `["vyAe2","[${TOP_CHARTS_TOKEN},[2,\\"${esc(chart)}\\",\\"${esc(category)}\\"]]]",null,"${TAG_TOP}@${esc(category)}${esc(chart)}"]`;
}

function categoryList(): string {
  return `["KT5WVe","[1]",null,"${TAG_CATEGORY}@${TAG_CATEGORY}"]`;
}

function metadata(pkg: string): string {
  return `["Ws7gDc","[${METADATA_TOKEN},[[\\"${esc(pkg)}\\",7]]]",null,"${TAG_METADATA}@${esc(pkg)}"]`;
}

// ── Transport (WebClient port) ───────────────────────────────────

type Wrapped = Record<string, Record<string, unknown>>;

async function batchexecute(rpcs: string[], locale: string): Promise<Wrapped> {
  const [lang, country] = locale.split("_");
  const url = `https://play.google.com/_/PlayStoreUi/data/batchexecute?hl=${lang ?? "en"}&gl=${country ?? "US"}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      Origin: "https://play.google.com",
    },
    body: `f.req=[[${rpcs.map(urlEncodeForm).join(",")}]]`,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  const out: Wrapped = {};
  for (const line of text.split("\n")) {
    if (!line.startsWith('[["wrb.fr')) continue;
    let frames: unknown;
    try {
      frames = JSON.parse(line);
    } catch {
      continue;
    }
    const list = Array.isArray(frames) ? frames : [frames];
    for (const fr of list) {
      if (!Array.isArray(fr) || fr[0] !== "wrb.fr") continue;
      const tag = s(fr[6]);
      const atIdx = tag.indexOf("@");
      if (atIdx < 0) continue;
      const type = tag.slice(0, atIdx);
      const key = tag.slice(atIdx + 1);
      const data = s(fr[2]);
      if (!data || data === "null") continue;
      try {
        const parsed = JSON.parse(data) as unknown;
        if (!out[type]) out[type] = {};
        (out[type] as Record<string, unknown>)[key] = parsed;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return out;
}

function lookup(wrapped: Wrapped, tag: string, key: string): unknown {
  return wrapped[tag]?.[key];
}

// ── WebAppBuilder port -> TS App shape ───────────────────────────

function parseWebArtwork(payload: unknown): string {
  return s(at(payload, 3, 2));
}

function parseWebTags(payload: unknown): string[] {
  const tags: string[] = [];
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    for (const item of node) {
      if (!Array.isArray(item)) continue;
      const url = s(at(item, 1, 4, 2));
      if (url) {
        const name = s(item[0]);
        if (name && !tags.includes(name)) tags.push(name);
      } else {
        walk(item);
      }
    }
  };
  walk(payload);
  return tags;
}

export interface WebApp {
  id: number;
  packageName: string;
  displayName: string;
  developerName: string;
  developerId: string;
  developerEmail: string;
  developerWebsite: string;
  developerAddress: string;
  shortDescription: string;
  description: string;
  changes: string;
  iconUrl: string;
  screenshots: string[];
  price: string;
  isFree: boolean;
  containsAds: boolean;
  ratingAverage: number;
  ratingCount: number;
  ratingHist: number[];
  installs: number;
  installsShort: string;
  updatedOn: string;
  versionName: string;
  category: string;
  tags: string[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function buildWebApp(pkg: string, payload: unknown): WebApp | null {
  const appInfo = at(payload, 1, 2);
  if (!appInfo) return null;
  const name = s(at(appInfo, 0, 0));
  if (!name) return null;
  const rating = at(appInfo, 51);
  const hist = [1, 2, 3, 4, 5].map((i) => n(at(rating, 1, i, 1, 1)));
  const offers = at(appInfo, 57, 0, 0, 0, 0);
  const shots = arr(at(appInfo, 78, 0)).map(parseWebArtwork).filter(Boolean);
  const devName = s(at(appInfo, 68, 0));
  return {
    id: javaHash(pkg),
    packageName: pkg,
    displayName: name,
    developerName: devName,
    developerId: slugify(devName),
    developerEmail: s(at(appInfo, 69, 1, 0)),
    developerWebsite: s(at(appInfo, 69, 0, 5, 2)),
    developerAddress: s(at(appInfo, 69, 2, 0)),
    shortDescription: s(at(appInfo, 73, 0, 1)),
    description: s(at(appInfo, 72, 0, 1)),
    changes: s(at(appInfo, 144, 1, 1)),
    iconUrl: parseWebArtwork(at(appInfo, 95, 0)),
    screenshots: shots,
    price: s(at(offers, 1, 0, 2)),
    isFree: n(at(offers, 1, 0, 0)) === 0,
    containsAds: s(at(appInfo, 48, 0)) !== "",
    ratingAverage: n(at(rating, 0, 1)),
    ratingCount: hist.reduce((a, b) => a + b, 0),
    ratingHist: hist,
    installs: n(at(appInfo, 13, 2)),
    installsShort: s(at(appInfo, 13, 3)),
    updatedOn: s(at(appInfo, 145, 0, 0)),
    versionName: s(at(appInfo, 140, 0, 0, 0)),
    category: s(at(appInfo, 79, 0, 0, 2)),
    tags: parseWebTags(at(appInfo, 118)),
  };
}

/** Batch-resolve package names to WebApps via one MetadataBuilder call. */
export async function resolveWebApps(pkgs: string[], locale: string): Promise<Map<string, WebApp>> {
  const out = new Map<string, WebApp>();
  const uniq = [...new Set(pkgs)].filter(Boolean).slice(0, 100);
  if (uniq.length === 0) return out;
  const wrapped = await batchexecute(uniq.map(metadata), locale);
  for (const pkg of uniq) {
    const payload = lookup(wrapped, TAG_METADATA, pkg);
    if (payload === undefined) continue;
    const app = buildWebApp(pkg, payload);
    if (app) out.set(pkg, app);
  }
  return out;
}

// ── Cluster / bundle parsing (BaseWebHelper ports) ───────────────

interface ParsedCluster {
  id: number;
  title: string;
  subtitle: string;
  browseUrl: string;
  nextPageUrl: string;
  packages: string[];
}

function parseCluster(payload: unknown, clusterIndex: number, appIndex: number[]): ParsedCluster | null {
  const appsAt = arr(at(payload, clusterIndex, 0));
  if (appsAt.length === 0) return null;
  const packages: string[] = [];
  for (const entry of appsAt) {
    const pkg = s(at(entry, ...appIndex));
    if (pkg && !packages.includes(pkg)) packages.push(pkg);
  }
  if (packages.length === 0) return null;
  return {
    id: javaHash(s(at(payload, 3, 0)) || `${clusterIndex}`),
    title: s(at(payload, clusterIndex, 1, 0)),
    subtitle: s(at(payload, clusterIndex, 1, 1)),
    browseUrl: s(at(payload, clusterIndex, 1, 2, 4, 2)),
    nextPageUrl: s(at(payload, clusterIndex, 1, 3, 1)),
    packages,
  };
}

function parseBundleEntries(payload: unknown): ParsedCluster[] {
  const out: ParsedCluster[] = [];
  for (const entry of arr(at(payload, 0, 1))) {
    if (arr(at(entry, 34, 0)).length > 0 || arr(at(entry, 27, 1)).length > 0) continue;
    let c: ParsedCluster | null = null;
    if (arr(at(entry, 21, 0)).length > 0) c = parseCluster(entry, 21, [0, 0]);
    else if (arr(at(entry, 29, 0)).length > 0) c = parseCluster(entry, 29, [0, 0]);
    else if (arr(at(entry, 22, 0)).length > 0) c = parseCluster(entry, 22, [0, 0, 0]);
    if (c) out.push(c);
  }
  return out;
}

export interface WebBundle {
  id: number;
  title: string;
  nextPageUrl: string;
  clusters: ParsedCluster[];
}

async function hydrate(
  bundle: WebBundle,
  locale: string,
): Promise<{ bundle: WebBundle; apps: Map<string, WebApp> }> {
  const pkgs = bundle.clusters.flatMap((c) => c.packages);
  const apps = await resolveWebApps(pkgs, locale);
  // Drop clusters with no resolvable apps (mirrors clusterAppList.isNotEmpty filter).
  bundle.clusters = bundle.clusters.filter((c) => c.packages.some((p) => apps.has(p)));
  return { bundle, apps };
}

/** WebStreamHelper.fetch */
export async function webHomeStream(
  category: string,
  locale: string,
): Promise<{ bundle: WebBundle; apps: Map<string, WebApp> }> {
  const wrapped = await batchexecute([featuredStream(category)], locale);
  const payload = lookup(wrapped, TAG_FEATURED, category);
  if (payload === undefined) {
    return { bundle: { id: 0, title: category, nextPageUrl: "", clusters: [] }, apps: new Map() };
  }
  const bundle: WebBundle = {
    id: javaHash(`getHomeStream${category}`),
    title: category,
    nextPageUrl: s(at(payload, 0, 3, 1)),
    clusters: parseBundleEntries(payload),
  };
  return hydrate(bundle, locale);
}

/** WebSearchHelper.search */
export async function webSearch(
  query: string,
  locale: string,
  nextToken = "",
): Promise<{ packages: string[]; nextPageToken: string }> {
  const wrapped = await batchexecute([searchQuery(query, nextToken)], locale);
  const payload = lookup(wrapped, TAG_SEARCH, query);
  if (payload === undefined) return { packages: [], nextPageToken: "" };
  const packages: string[] = [];
  const collect = (entries: unknown): void => {
    for (const entry of arr(entries)) {
      const pkg = s(at(entry, 12, 0));
      if (pkg && !packages.includes(pkg)) packages.push(pkg);
    }
  };
  let nextPageToken = "";
  // Current shape: entries at [0][1][0][0][0], next token at [0][1][0][3][0].
  const section = at(payload, 0, 1, 0);
  if (section !== undefined) {
    collect(at(section, 0, 0));
    nextPageToken = s(at(section, 3, 0));
  }
  if (packages.length === 0) {
    // Legacy shape (gplayapi 3.6.4 era): "Apps" label at [0][1].
    let legacy: unknown = payload;
    if (s(at(payload, 0, 1)) !== "Apps") legacy = at(payload, 1, 0);
    collect(at(legacy, 0, 0));
    if (!nextPageToken) nextPageToken = s(at(legacy, 0, 7, 1));
  }
  return { packages, nextPageToken };
}

/** WebSearchHelper.searchSuggestions */
export async function webSuggest(query: string, locale: string): Promise<string[]> {
  const wrapped = await batchexecute([suggestQuery(query)], locale);
  const payload = lookup(wrapped, TAG_SUGGEST, query);
  if (payload === undefined) return [];
  const out: string[] = [];
  for (const entry of arr(at(payload, 0))) {
    const q = s(at(entry, 0));
    if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

/** WebTopChartsHelper.getCluster */
export async function webTopChart(
  category: string,
  chart: string,
  locale: string,
): Promise<{ title: string; subtitle: string; apps: Map<string, WebApp> }> {
  const webChart = chart.startsWith("apps_") ? chart.slice(5) : chart;
  const wrapped = await batchexecute([topCharts(category, webChart)], locale);
  const payload = lookup(wrapped, TAG_TOP, `${category}${webChart}`);
  if (payload === undefined) return { title: category, subtitle: chart, apps: new Map() };
  const packages: string[] = [];
  for (const entry of arr(at(payload, 0, 1, 0, 28, 0))) {
    const pkg = s(at(entry, 0, 0, 0));
    if (pkg && !packages.includes(pkg)) packages.push(pkg);
  }
  return { title: category, subtitle: chart, apps: await resolveWebApps(packages, locale) };
}

/** WebCategoryHelper.getAllCategories */
export async function webCategories(
  webType: 0 | 1 | 2,
  locale: string,
): Promise<{ title: string; browseUrl: string }[]> {
  const wrapped = await batchexecute([categoryList()], locale);
  const payload = lookup(wrapped, TAG_CATEGORY, TAG_CATEGORY);
  if (payload === undefined) return [];
  const out: { title: string; browseUrl: string }[] = [];
  for (const entry of arr(at(payload, 0, 1, 0, 3, webType, 3))) {
    const browseUrl = s(at(entry, 1, 0));
    const title = s(at(entry, 1, 1));
    if (browseUrl && title) out.push({ title, browseUrl });
  }
  return out;
}

export function categoryIconUrl(webType: 0 | 1 | 2, browseUrl: string): string {
  const category = webType === 1 ? "games" : webType === 2 ? "family" : "apps";
  let sub = browseUrl.split("/").pop() ?? "";
  sub = sub.toLowerCase().replace("game_", "").replace("app_", "");
  if (sub === "watch_face") return "watch_faces";
  if (sub === "watch_app") return "watch_apps";
  return `https://play-apps-features.googleusercontent.com/png/gm3_categories_icons_${category}/${sub}.png`;
}

/** WebAppDetailsHelper.getRelatedClusters */
export async function webRelated(
  pkg: string,
  locale: string,
): Promise<{ bundle: WebBundle; apps: Map<string, WebApp> }> {
  const wrapped = await batchexecute([relatedApps(pkg)], locale);
  const payload = lookup(wrapped, TAG_RELATED, pkg);
  const clusters: ParsedCluster[] = [];
  for (const entry of arr(at(payload, 1, 1))) {
    const c = parseCluster(entry, 21, [0, 0]);
    if (c) clusters.push(c);
  }
  const bundle: WebBundle = { id: javaHash(`related${pkg}`), title: pkg, nextPageUrl: "", clusters };
  return hydrate(bundle, locale);
}

/** CategoryUtil.getCategoryFromUrl port. */
export function categoryFromUrl(url: string): string {
  if (url.includes("cat=")) {
    const m = /cat=([^&]*)/.exec(url);
    return m ? m[1] : "";
  }
  return url.split("/").pop() ?? "";
}
