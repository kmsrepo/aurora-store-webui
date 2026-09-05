/**
 * Privacy-report proxies (no Play auth needed):
 * - Exodus (reports.exodus-privacy.eu.org, API key like the Android app —
 *   default is the key shipped in the open-source app build, overridable
 *   via EXODUS_API_KEY; degrades gracefully when the service is down).
 * - Plexus (plexus.techlore.tech, no auth).
 * - Data safety via Play's public batchexecute RPC (Ws7gDc), mirroring
 *   WebDataSafetyHelper + DataSafetyBuilder + RpcBuilder.
 */

const EXODUS_SEARCH = "https://reports.exodus-privacy.eu.org/api/search/";
const EXODUS_TRACKERS = "https://reports.exodus-privacy.eu.org/api/trackers";
// Same key the open-source Android app ships in app/build.gradle.kts.
const DEFAULT_EXODUS_KEY = "bbe6ebae4ad45a9cbacb17d69739799b8df2c7ae";

function exodusKey(): string {
  return process.env["EXODUS_API_KEY"] ?? DEFAULT_EXODUS_KEY;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json() as Promise<unknown>;
}

interface TrackerInfo {
  id: number;
  name: string;
  categories: string[];
}

let trackerCache: { at: number; map: Map<number, TrackerInfo> } | null = null;

async function trackerMap(): Promise<Map<number, TrackerInfo>> {
  if (trackerCache && Date.now() - trackerCache.at < 3 * 24 * 3600 * 1000) return trackerCache.map;
  const map = new Map<number, TrackerInfo>();
  try {
    const json = (await fetchJson(EXODUS_TRACKERS, {
      Accept: "application/json",
      Authorization: `Token ${exodusKey()}`,
    })) as { trackers?: Record<string, Record<string, unknown>> };
    for (const dto of Object.values(json.trackers ?? {})) {
      const id = Number(dto["id"] ?? 0);
      if (!id) continue;
      map.set(id, {
        id,
        name: String(dto["name"] ?? `Tracker #${id}`),
        categories: Array.isArray(dto["categories"]) ? (dto["categories"] as unknown[]).map(String) : [],
      });
    }
  } catch {
    /* trackers endpoint flaky -> names fall back to ids */
  }
  trackerCache = { at: Date.now(), map };
  return map;
}

function emptyReport(pkg: string): Record<string, unknown> {
  return { id: -1, packageName: pkg, versionName: "", versionCode: 0, trackers: [] };
}

/** Latest Exodus report for a package, mapped to the WebUI shape. */
export async function exodusReport(pkg: string): Promise<Record<string, unknown>> {
  try {
    const json = (await fetchJson(`${EXODUS_SEARCH}${encodeURIComponent(pkg)}`, {
      Accept: "application/json",
      Authorization: `Token ${exodusKey()}`,
    })) as Record<string, { reports?: Record<string, unknown>[] }>;
    const reports = json[pkg]?.reports ?? [];
    if (reports.length === 0) return emptyReport(pkg);
    let best = reports[0];
    for (const r of reports) {
      if (Number(r["version_code"] ?? -1) > Number(best["version_code"] ?? -1)) best = r;
    }
    const ids = ((best["trackers"] ?? []) as unknown[]).map(Number).filter((n) => Number.isFinite(n));
    const infos = await trackerMap();
    return {
      id: Number(best["id"] ?? -1),
      packageName: pkg,
      versionName: String(best["version"] ?? ""),
      versionCode: Number(best["version_code"] ?? 0),
      trackers: ids.map((id) => {
        const info = infos.get(id);
        return {
          id,
          name: info?.name ?? `Tracker #${id}`,
          categories: info?.categories ?? [],
          description: "",
        };
      }),
    };
  } catch {
    return emptyReport(pkg);
  }
}

// ── Plexus ───────────────────────────────────────────────────────

function plexusScore(part: unknown): number {
  const p = (part ?? {}) as Record<string, unknown>;
  const num = Number(p["numerator"] ?? -1);
  const den = Number(p["denominator"] ?? -1);
  if (!(num >= 0) || !(den > 0)) return -1;
  return Math.round((num / den) * 4);
}

/** GET plexus.techlore.tech/api/v1/apps/<pkg>/?scores=true (no auth). -1 = unknown. */
export async function plexusScores(pkg: string): Promise<Record<string, unknown>> {
  try {
    const json = (await fetchJson(
      `https://plexus.techlore.tech/api/v1/apps/${encodeURIComponent(pkg)}/?scores=true`,
    )) as { data?: { scores?: { micro_g?: unknown; native?: unknown } } };
    const scores = json.data?.scores;
    if (!scores) throw new Error("no data");
    return {
      packageName: pkg,
      microGScore: plexusScore(scores.micro_g),
      degoogledScore: plexusScore(scores.native),
    };
  } catch {
    return { packageName: pkg, microGScore: -1, degoogledScore: -1 };
  }
}

import { DATA_SAFETY_TOKEN } from "./tokens.ts";

// ── Data safety (batchexecute Ws7gDc) ────────────────────────────

function at(root: unknown, ...path: (string | number)[]): unknown {
  let cur = root;
  for (const key of path) {
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

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function batchexecute(rpc: string, locale: string): Promise<Record<string, Record<string, unknown>>> {
  const [lang, country] = locale.split("_");
  const url = `https://play.google.com/_/PlayStoreUi/data/batchexecute?hl=${lang ?? "en"}&gl=${country ?? "US"}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      Origin: "https://play.google.com",
    },
    body: `f.req=[[${encodeURIComponent(rpc)}]]`,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  const out: Record<string, Record<string, unknown>> = {};
  for (const line of text.split("\n")) {
    if (!line.startsWith('[["wrb.fr')) continue;
    let frames: unknown;
    try {
      frames = JSON.parse(line);
    } catch {
      continue;
    }
    for (const fr of Array.isArray(frames) ? frames : [frames]) {
      if (!Array.isArray(fr) || fr[0] !== "wrb.fr") continue;
      const tag = str(fr[6]);
      const atIdx = tag.indexOf("@");
      if (atIdx < 0) continue;
      const type = tag.slice(0, atIdx);
      const pkg = tag.slice(atIdx + 1);
      const data = str(fr[2]);
      if (!data || data === "null") continue;
      try {
        if (!out[type]) out[type] = {};
        (out[type] as Record<string, unknown>)[pkg] = JSON.parse(data) as unknown;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return out;
}

function entryNames(entry: unknown): string[] {
  const subs = (at(entry, 0) ?? []) as unknown[];
  const names: string[] = [];
  for (const s of subs) {
    const n = str(at(s, 0, 1));
    if (n) names.push(n);
  }
  return names;
}

function securityNames(entry: unknown): string[] {
  const items = (at(entry, 2) ?? []) as unknown[];
  const names: string[] = [];
  for (const d of items) {
    const n = str(at(d, 1));
    if (n) names.push(n);
  }
  return names;
}

/** WebDataSafetyHelper.fetch port, mapped to the WebUI report shape. */
export async function dataSafetyReport(
  pkg: string,
  locale: string,
): Promise<Record<string, unknown>> {
  const empty = {
    packageName: pkg,
    sharesData: false,
    collectsData: false,
    dataShared: [],
    dataCollected: [],
    securityPractices: [],
  };
  try {
    const inner = DATA_SAFETY_TOKEN.replace("%s", pkg);
    const rpc = `["Ws7gDc","${inner}",null,"DataSafetyBuilder@${pkg}"]`;
    const wrapped = await batchexecute(rpc, locale);
    const payload = at(wrapped, "DataSafetyBuilder", pkg, 1, 2, 1) as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== "object") return empty;
    const shared = at(payload, "138", 4, 0);
    const collected = at(payload, "138", 4, 1);
    const security = at(payload, "138", 9);
    const dataShared = entryNames(shared);
    const dataCollected = entryNames(collected);
    const securityPractices = securityNames(security);
    return {
      packageName: pkg,
      sharesData: dataShared.length > 0,
      collectsData: dataCollected.length > 0,
      dataShared,
      dataCollected,
      securityPractices,
    };
  } catch {
    return empty;
  }
}
