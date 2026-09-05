/**
 * REST API: Play catalog over public web RPC (no login) + authenticated
 * DFE for details/reviews/purchase/download.
 *
 *  POST /api/auth/anonymous {device?, locale?} -> session
 *  POST /api/auth/google {email, token, tokenType?} -> session
 *  GET  /api/auth/status | DELETE /api/auth (X-Session)
 *  GET  /api/home?pageType (0 apps / 1 games, no session)
 *  GET  /api/top?pageType (no session)
 *  GET  /api/categories?type (no session)
 *  GET  /api/category?browseUrl | GET /api/stream?browseUrl -> App[] (no session)
 *  GET  /api/search?q&filter?&nt? -> App[] (no session)
 *  GET  /api/suggest?q -> string[] (no session)
 *  GET  /api/related?pkg -> App[] (no session)
 *  GET  /api/app?pkg -> App (session: native full details)
 *  GET  /api/apps?pkgs=a,b,c -> App[] (session: bulk, for update checks)
 *  GET  /api/reviews?pkg -> Review[] (session)
 *  GET  /api/exodus?pkg | GET /api/datasafety?pkg | GET /api/plexus?pkg
 *  GET  /api/purchase?pkg&vc&offer -> file metas (session, no URLs)
 *  GET  /api/download?pkg&vc&offer&file=i -> APK/OBB bytes (session, Range OK)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import {
  asNum,
  getAppDetails,
  getBulkDetails,
  getReviews,
  loadDeviceProps,
  purchaseFiles,
  type DeliveryFile,
  type DfeSession,
  GPlayError,
} from "./dfe.ts";
import {
  checkSession,
  createAnonymousSession,
  createGoogleSession,
  dropSession,
  getSession,
  publicSession,
} from "./auth.ts";
import { normalizeApp, normalizeReview } from "./normalize.ts";
import { dataSafetyReport, exodusReport, plexusScores } from "./reports.ts";
import {
  categoryFromUrl,
  categoryIconUrl,
  resolveWebApps,
  webCategories,
  webHomeStream,
  webRelated,
  webSearch,
  webSuggest,
  webTopChart,
  type WebApp,
} from "./web.ts";

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendError(res: ServerResponse, e: unknown): void {
  if (e instanceof GPlayError) {
    const status =
      e.kind === "auth" ? 401 : e.kind === "not-purchased" ? 403 : e.kind === "not-found" ? 404 : 502;
    send(res, status, { error: e.message, kind: e.kind, code: e.code });
    return;
  }
  send(res, 500, { error: (e as Error).message ?? "Internal error" });
}

function sessionOf(req: IncomingMessage): DfeSession | undefined {
  const id = req.headers["x-session"];
  if (typeof id !== "string" || !id) return undefined;
  return getSession(id);
}

function needSession(req: IncomingMessage, res: ServerResponse): DfeSession | undefined {
  const sess = sessionOf(req);
  if (!sess) {
    send(res, 401, { error: "No Play session — log in first (POST /api/auth/anonymous)", kind: "auth" });
    return undefined;
  }
  return sess;
}

function propsOf(sess: DfeSession): Record<string, string> {
  return loadDeviceProps(sess.deviceProfile);
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_048_576) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

interface SearchFilter {
  minRating: number;
  minInstalls: number;
  isFree: boolean;
  noAds: boolean;
  noGMS: boolean;
}

function parseFilter(raw: string | null): SearchFilter {
  const f: SearchFilter = { minRating: 0, minInstalls: 0, isFree: false, noAds: false, noGMS: false };
  if (!raw) return f;
  try {
    const p = JSON.parse(raw) as Partial<SearchFilter>;
    if (typeof p.minRating === "number") f.minRating = p.minRating;
    if (typeof p.minInstalls === "number") f.minInstalls = p.minInstalls;
    if (p.isFree === true) f.isFree = true;
    if (p.noAds === true) f.noAds = true;
    if (p.noGMS === true) f.noGMS = true;
  } catch {
    /* ignore malformed filter */
  }
  return f;
}

/** WebApp (metadata subset) -> full TS App shape with safe defaults. */
function webAppToTs(a: WebApp): Record<string, any> {
  return {
    id: a.id,
    packageName: a.packageName,
    displayName: a.displayName,
    developerName: a.developerName,
    developerId: a.developerId,
    developerEmail: a.developerEmail,
    developerWebsite: a.developerWebsite,
    developerAddress: a.developerAddress,
    shortDescription: a.shortDescription,
    description: a.description,
    changes: a.changes,
    iconUrl: a.iconUrl,
    screenshots: a.screenshots,
    price: a.price,
    isFree: a.isFree,
    containsAds: a.containsAds,
    inAppPurchases: false,
    rating: { average: a.ratingAverage, count: a.ratingCount, histogram: a.ratingHist },
    installs: a.installs,
    installsShort: a.installsShort,
    updatedOn: a.updatedOn,
    versionName: a.versionName,
    versionCode: 0,
    size: "",
    sizeBytes: 0,
    category: a.category,
    tags: a.tags,
    permissions: [],
    privacyPolicyUrl: "",
    isInstalled: false,
    requiresGMS: false,
    fileList: [],
  };
}

function applyFilter(apps: Record<string, any>[], f: SearchFilter): Record<string, any>[] {
  return apps.filter(
    (a) =>
      (f.minRating <= 0 || asNum(a.rating?.average) >= f.minRating) &&
      (f.minInstalls <= 0 || asNum(a.installs) >= f.minInstalls) &&
      (!f.isFree || a.isFree === true) &&
      (!f.noAds || a.containsAds !== true) &&
      (!f.noGMS || a.requiresGMS !== true),
  );
}

function webBundleToTs(bundle: { id: number; clusters: { id: number; title: string; subtitle: string; browseUrl: string; nextPageUrl: string; packages: string[] }[] }, apps: Map<string, WebApp>): Record<string, any> {
  const map: Record<number, unknown> = {};
  for (const c of bundle.clusters) {
    const list = c.packages
      .map((p) => apps.get(p))
      .filter((a): a is WebApp => a !== undefined)
      .map(webAppToTs);
    if (list.length === 0) continue;
    map[c.id] = {
      id: c.id,
      clusterTitle: c.title,
      clusterSubtitle: c.subtitle || undefined,
      browseUrl: c.browseUrl,
      clusterAppList: list,
      hasMore: c.nextPageUrl !== "",
    };
  }
  return { id: bundle.id, streamClusters: map };
}

// Purchase cache: delivery URLs are short-lived; re-purchase on expiry.
interface PurchaseEntry {
  at: number;
  files: DeliveryFile[];
}
const purchases = new Map<string, PurchaseEntry>();
const PURCHASE_TTL = 45 * 60 * 1000;

async function cachedPurchase(
  sess: DfeSession,
  props: Record<string, string>,
  pkg: string,
  vc: number,
  offer: number,
): Promise<DeliveryFile[]> {
  const key = `${sess.id}|${pkg}|${vc}|${offer}`;
  const hit = purchases.get(key);
  if (hit && Date.now() - hit.at < PURCHASE_TTL) return hit.files;
  const files = await purchaseFiles(sess, props, pkg, vc, offer);
  purchases.set(key, { at: Date.now(), files });
  return files;
}

function dropPurchase(sess: DfeSession, pkg: string, vc: number, offer: number): void {
  purchases.delete(`${sess.id}|${pkg}|${vc}|${offer}`);
}

/** Resolve versionCode/offerType via native details when the client didn't send them. */
async function resolveVersion(
  sess: DfeSession,
  props: Record<string, string>,
  pkg: string,
  vc: number,
  offer: number,
): Promise<{ vc: number; offer: number }> {
  if (vc > 0) return { vc, offer };
  const details = await getAppDetails(sess, props, pkg);
  const item = (details.item ?? {}) as Record<string, any>;
  const ad = ((item.details ?? {}) as Record<string, any>).appDetails ?? {};
  const offers = ((item.offer ?? []) as Record<string, any>[]);
  const firstOffer = offers[0] ?? {};
  const resolvedOffer = offer > 0 ? offer : asNum(firstOffer.offerType);
  const isFree = offers.length === 0 || asNum(firstOffer.micros) === 0;
  if (!isFree && sess.isAnonymous) {
    throw new GPlayError(403, "not-purchased", "Anonymous accounts cannot download paid apps — add a Google account");
  }
  return { vc: asNum((ad as Record<string, any>).versionCode), offer: resolvedOffer };
}

async function streamGoogleFile(
  res: ServerResponse,
  url: string,
  req: IncomingMessage,
  filename: string,
  isApk: boolean,
): Promise<{ status: number }> {
  const headers: Record<string, string> = {};
  const range = req.headers["range"];
  if (typeof range === "string" && range) headers["Range"] = range;
  const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (upstream.status === 403 || upstream.status === 410) return { status: upstream.status };
  if (!upstream.ok || !upstream.body) {
    throw new Error(`File host responded ${upstream.status}`);
  }
  const out: Record<string, string> = {
    "Content-Type": isApk ? "application/vnd.android.package-archive" : "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const len = upstream.headers.get("content-length");
  if (len) out["Content-Length"] = len;
  const cr = upstream.headers.get("content-range");
  if (cr) out["Content-Range"] = cr;
  res.writeHead(upstream.status, out);
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise<void>((r) => res.once("drain", r));
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
  return { status: upstream.status };
}

export async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname;
  const q = url.searchParams;
  const locale = q.get("locale") ?? sessionOf(req)?.locale ?? "en_US";

  // ── Auth ──────────────────────────────────────────────────────
  if (path === "/api/auth/anonymous" && req.method === "POST") {
    const body = await readJson(req);
    const device = typeof body["device"] === "string" && body["device"] ? body["device"] : "px_9a";
    const loc = typeof body["locale"] === "string" && body["locale"] ? body["locale"] : "en_US";
    try {
      loadDeviceProps(device);
    } catch {
      send(res, 400, { error: `Unknown device profile: ${device}` });
      return;
    }
    try {
      send(res, 200, publicSession(await createAnonymousSession(device, loc)));
    } catch (e) {
      send(res, 502, { error: (e as Error).message });
    }
    return;
  }

  if (path === "/api/auth/google" && req.method === "POST") {
    const body = await readJson(req);
    const email = typeof body["email"] === "string" ? body["email"].trim() : "";
    const token = typeof body["token"] === "string" ? body["token"].trim() : "";
    const tokenType = body["tokenType"] === "AUTH" ? "AUTH" : "AAS";
    const device = typeof body["device"] === "string" && body["device"] ? body["device"] : "px_9a";
    const loc = typeof body["locale"] === "string" && body["locale"] ? body["locale"] : "en_US";
    if (!email || !token) {
      send(res, 400, { error: "email and token are required" });
      return;
    }
    try {
      send(res, 200, publicSession(await createGoogleSession(email, token, tokenType, device, loc)));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/auth/status" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const valid = await checkSession(sess);
      send(res, 200, { valid, email: sess.email, isAnonymous: sess.isAnonymous });
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/auth" && req.method === "DELETE") {
    const sess = sessionOf(req);
    if (sess) dropSession(sess.id);
    send(res, 200, { ok: true });
    return;
  }

  // ── Web catalog (no session needed) ───────────────────────────
  if (path === "/api/home" && req.method === "GET") {
    try {
      const cat = q.get("pageType") === "1" ? "GAME" : "APPLICATION";
      const { bundle, apps } = await webHomeStream(cat, locale);
      send(res, 200, webBundleToTs(bundle, apps));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/top" && req.method === "GET") {
    try {
      const cat = q.get("pageType") === "1" ? "GAME" : "APPLICATION";
      const free = await webTopChart(cat, "topselling_free", locale);
      const grossing = await webTopChart(cat, "topgrossing", locale);
      const map: Record<number, unknown> = {};
      const mk = (t: typeof free, i: number): void => {
        const list = [...t.apps.values()].map(webAppToTs);
        if (list.length === 0) return;
        const id = 1000 + i;
        map[id] = {
          id,
          clusterTitle: i === 0 ? "Top free" : "Top grossing",
          clusterSubtitle: t.subtitle || undefined,
          browseUrl: "",
          clusterAppList: list,
          hasMore: false,
        };
      };
      mk(free, 0);
      mk(grossing, 1);
      send(res, 200, { id: q.get("pageType") === "1" ? 2 : 1, streamClusters: map });
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/categories" && req.method === "GET") {
    try {
      const t = q.get("type") ?? "APPLICATION";
      const webType = t === "GAME" ? 1 : t === "FAMILY" ? 2 : 0;
      const cats = await webCategories(webType as 0 | 1 | 2, locale);
      send(res, 200, cats.map((c) => ({
        id: c.browseUrl || c.title,
        title: c.title,
        browseUrl: c.browseUrl,
        imageUrl: categoryIconUrl(webType as 0 | 1 | 2, c.browseUrl),
      })));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if ((path === "/api/category" || path === "/api/stream") && req.method === "GET") {
    try {
      const category = categoryFromUrl(q.get("browseUrl") ?? "");
      if (!category) {
        send(res, 400, { error: "Could not determine a category from browseUrl" });
        return;
      }
      const { bundle, apps } = await webHomeStream(category, locale);
      const ts = webBundleToTs(bundle, apps);
      const list = Object.values((ts.streamClusters ?? {}) as Record<string, { clusterAppList: unknown[] }>)
        .flatMap((c) => c.clusterAppList);
      send(res, 200, list);
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/search" && req.method === "GET") {
    try {
      const query = (q.get("q") ?? "").trim();
      if (!query) {
        send(res, 200, []);
        return;
      }
      const { packages } = await webSearch(query, locale, q.get("nt") ?? "");
      const apps = await resolveWebApps(packages, locale);
      const list = packages
        .map((p) => apps.get(p))
        .filter((a): a is WebApp => a !== undefined)
        .map(webAppToTs);
      send(res, 200, applyFilter(list, parseFilter(q.get("filter"))));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/suggest" && req.method === "GET") {
    try {
      send(res, 200, await webSuggest(q.get("q") ?? "", locale));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/related" && req.method === "GET") {
    try {
      const pkg = q.get("pkg") ?? "";
      if (!pkg) {
        send(res, 400, { error: "pkg is required" });
        return;
      }
      const { bundle, apps } = await webRelated(pkg, locale);
      const ts = webBundleToTs(bundle, apps);
      const list = Object.values((ts.streamClusters ?? {}) as Record<string, { clusterAppList: unknown[] }>)
        .flatMap((c) => c.clusterAppList);
      send(res, 200, list);
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  // ── Native DFE (session required) ─────────────────────────────
  if (path === "/api/app" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const details = await getAppDetails(sess, propsOf(sess), q.get("pkg") ?? "");
      send(res, 200, normalizeApp((details.item ?? {}) as Record<string, any>));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/apps" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const pkgs = (q.get("pkgs") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50);
      const items = await getBulkDetails(sess, propsOf(sess), pkgs);
      send(res, 200, items.map(normalizeApp));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/reviews" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const pkg = q.get("pkg") ?? "";
      const list = await getReviews(sess, propsOf(sess), pkg);
      send(res, 200, list.map((r) => normalizeReview(pkg, r)));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  // ── Reports ───────────────────────────────────────────────────
  if (path === "/api/exodus" && req.method === "GET") {
    try {
      send(res, 200, await exodusReport(q.get("pkg") ?? ""));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/plexus" && req.method === "GET") {
    try {
      send(res, 200, await plexusScores(q.get("pkg") ?? ""));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/datasafety" && req.method === "GET") {
    try {
      const sess = sessionOf(req);
      send(res, 200, await dataSafetyReport(q.get("pkg") ?? "", sess?.locale ?? locale));
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  // ── Purchase + download (session required) ────────────────────
  if (path === "/api/purchase" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const pkg = q.get("pkg") ?? "";
      if (!pkg) {
        send(res, 400, { error: "pkg is required" });
        return;
      }
      const props = propsOf(sess);
      const { vc, offer } = await resolveVersion(sess, props, pkg, asNum(q.get("vc") ?? 0), asNum(q.get("offer") ?? 0));
      if (!vc) {
        send(res, 404, { error: `No version found for ${pkg}` });
        return;
      }
      const files = await cachedPurchase(sess, props, pkg, vc, offer);
      send(res, 200, {
        packageName: pkg,
        versionCode: vc,
        offerType: offer,
        files: files.map((f, i) => ({
          index: i,
          name: f.name,
          size: f.size,
          sha1: f.sha1,
          sha256: f.sha256,
          kind: f.kind,
        })),
      });
    } catch (e) {
      sendError(res, e);
    }
    return;
  }

  if (path === "/api/download" && req.method === "GET") {
    const sess = needSession(req, res);
    if (!sess) return;
    try {
      const pkg = q.get("pkg") ?? "";
      if (!pkg) {
        send(res, 400, { error: "pkg is required" });
        return;
      }
      const props = propsOf(sess);
      const { vc, offer } = await resolveVersion(sess, props, pkg, asNum(q.get("vc") ?? 0), asNum(q.get("offer") ?? 0));
      if (!vc) {
        send(res, 404, { error: `No version found for ${pkg}` });
        return;
      }
      const idx = asNum(q.get("file") ?? 0);
      let files = await cachedPurchase(sess, props, pkg, vc, offer);
      const file = files[idx];
      if (!file) {
        send(res, 400, { error: `No file at index ${idx}` });
        return;
      }
      const filename = `${pkg}-v${vc}-${file.name}`;
      let r = await streamGoogleFile(res, file.url, req, filename, file.name.endsWith(".apk"));
      if (r.status === 403 || r.status === 410) {
        // Short-lived URL expired mid-queue (mirrors DownloadWorker) -> re-purchase once.
        dropPurchase(sess, pkg, vc, offer);
        files = await cachedPurchase(sess, props, pkg, vc, offer);
        const retry = files[idx] ?? files[0];
        if (!retry) {
          send(res, 502, { error: "Re-purchase returned no files" });
          return;
        }
        r = await streamGoogleFile(res, retry.url, req, `${pkg}-v${vc}-${retry.name}`, retry.name.endsWith(".apk"));
        if (r.status === 403 || r.status === 410) {
          send(res, 502, { error: "Download URL expired" });
          return;
        }
      }
    } catch (e) {
      if (!res.headersSent) sendError(res, e);
      else res.destroy();
    }
    return;
  }

  send(res, 404, { error: `Unknown route: ${path}` });
}

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
