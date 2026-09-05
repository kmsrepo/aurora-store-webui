/**
 * Play API abstraction.
 *
 * - `MockPlayApi` — offline demo backend used by default (no credentials).
 * - `HttpPlayApi` — talks to the self-hosted Play proxy in web/server/
 *   (TypeScript port of gplayapi + anonymous dispenser + Exodus/Plexus).
 *   Set VITE_PLAY_PROXY=http://localhost:8080 (or npm run dev:full) to
 *   enable real Play data and real APK downloads.
 */
import {
  MOCK_APPS,
  MOCK_CATEGORIES,
  dataSafetyFor,
  exodusFor,
  getApp,
  homeBundle,
  plexusFor,
  reviewsFor,
  suggestionsFor,
} from "./mockData";
import type {
  App,
  Category,
  DataSafetyReport,
  ExodusReport,
  PlexusScores,
  Review,
  SearchFilter,
  StreamBundle,
} from "./types";
import { EMPTY_FILTER } from "./types";

export interface PurchaseFile {
  index: number;
  name: string;
  size: number;
  sha1: string;
  sha256: string;
  kind: "BASE" | "SPLIT" | "OBB";
}

export interface PurchaseInfo {
  packageName: string;
  versionCode: number;
  offerType: number;
  files: PurchaseFile[];
}

export interface PlaySession {
  session: string;
  email: string;
  isAnonymous: boolean;
  deviceProfile: string;
  locale: string;
  gsfId: string;
}

export interface PlayApi {
  home(pageType: 0 | 1): Promise<StreamBundle>;
  topCharts(pageType: 0 | 1): Promise<StreamBundle>;
  categories(): Promise<Category[]>;
  categoryApps(browseUrl: string): Promise<App[]>;
  streamBrowse(browseUrl: string): Promise<App[]>;
  search(query: string, filter?: SearchFilter): Promise<App[]>;
  suggestions(query: string): Promise<string[]>;
  appDetails(packageName: string): Promise<App>;
  reviews(packageName: string): Promise<Review[]>;
  exodus(packageName: string): Promise<ExodusReport>;
  dataSafety(packageName: string): Promise<DataSafetyReport>;
  plexus(packageName: string): Promise<PlexusScores>;
  /** Similar-apps clusters flattened (real backend only). */
  related(packageName: string): Promise<App[]>;
  /** Bulk details for update checks (real backend only). */
  appsBulk(packageNames: string[]): Promise<App[]>;
}

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function applyFilter(apps: App[], f: SearchFilter = EMPTY_FILTER): App[] {
  return apps.filter(
    (a) =>
      (f.minRating <= 0 || a.rating.average >= f.minRating) &&
      (f.minInstalls <= 0 || a.installs >= f.minInstalls) &&
      (!f.isFree || a.isFree) &&
      (!f.noAds || !a.containsAds) &&
      (!f.noGMS || !a.requiresGMS),
  );
}

export class MockPlayApi implements PlayApi {
  async home(pageType: 0 | 1) {
    await delay();
    return homeBundle(pageType);
  }
  async topCharts(pageType: 0 | 1) {
    await delay();
    return homeBundle(pageType);
  }
  async categories() {
    await delay(200);
    return MOCK_CATEGORIES;
  }
  async categoryApps(browseUrl: string) {
    await delay();
    const title = browseUrl.replace("category:", "");
    return MOCK_APPS.filter((a) => a.category === title || a.tags.includes(title)).slice(0, 12);
  }
  async streamBrowse(browseUrl: string) {
    await delay();
    if (browseUrl === "top") return [...MOCK_APPS].sort((a, b) => b.rating.average - a.rating.average);
    return MOCK_APPS;
  }
  async search(query: string, filter?: SearchFilter) {
    await delay(400);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits = MOCK_APPS.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q) ||
        a.developerName.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
    return applyFilter(hits, filter);
  }
  async suggestions(query: string) {
    await delay(120);
    return suggestionsFor(query);
  }
  async appDetails(packageName: string) {
    await delay();
    const app = getApp(packageName);
    if (!app) throw new Error(`App not found: ${packageName}`);
    return app;
  }
  async reviews(packageName: string) {
    await delay(250);
    return reviewsFor(packageName);
  }
  async exodus(packageName: string) {
    await delay(250);
    return exodusFor(packageName);
  }
  async dataSafety(packageName: string) {
    await delay(250);
    return dataSafetyFor(packageName);
  }
  async plexus(packageName: string) {
    await delay(200);
    return plexusFor(packageName);
  }
  async related(_packageName: string): Promise<App[]> {
    await delay(200);
    return MOCK_APPS.slice(0, 8);
  }
  async appsBulk(packageNames: string[]): Promise<App[]> {
    await delay(300);
    return packageNames.map((p) => getApp(p)).filter((a): a is App => a !== undefined);
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Play session expired — please log in again");
  }
}

const SESSION_KEY = "aurora.session";

function loadSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Talks to the self-hosted Play proxy (web/server). */
export class HttpPlayApi implements PlayApi {
  base: string;
  private retriedAnonymous = false;

  constructor(base = "") {
    this.base = base;
  }

  get sessionId(): string | null {
    return loadSessionId();
  }

  setSessionId(id: string | null): void {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string> = {},
    body?: unknown,
    opts: { retryAnonymous?: boolean } = {},
  ): Promise<T> {
    const url = `${this.base}${path}?${new URLSearchParams(params)}`;
    const headers: Record<string, string> = {};
    const sid = loadSessionId();
    if (sid) headers["X-Session"] = sid;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && opts.retryAnonymous !== false && !this.retriedAnonymous) {
      // Self-healing like AuthWorker: one anonymous re-login, then retry once.
      this.retriedAnonymous = true;
      try {
        await this.loginAnonymous();
        return this.request<T>(method, path, params, body, { retryAnonymous: false });
      } finally {
        this.retriedAnonymous = false;
      }
    }
    if (res.status === 401) {
      this.setSessionId(null);
      throw new SessionExpiredError();
    }
    if (!res.ok) {
      let detail = `Proxy error ${res.status} for ${path}`;
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === "string" && j.error) detail = j.error;
      } catch {
        /* keep default */
      }
      throw new Error(detail);
    }
    return res.json() as Promise<T>;
  }

  private get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>("GET", path, params);
  }

  // ── Auth (AuthProvider equivalents) ────────────────────────────

  async loginAnonymous(device = "px_9a", locale = "en_US"): Promise<PlaySession> {
    const s = await this.request<PlaySession>("POST", "/api/auth/anonymous", {}, { device, locale }, { retryAnonymous: false });
    this.setSessionId(s.session);
    return s;
  }

  async loginGoogle(email: string, token: string, tokenType: "AAS" | "AUTH" = "AAS"): Promise<PlaySession> {
    const s = await this.request<PlaySession>("POST", "/api/auth/google", {}, { email, token, tokenType }, { retryAnonymous: false });
    this.setSessionId(s.session);
    return s;
  }

  async authStatus(): Promise<{ valid: boolean; email: string; isAnonymous: boolean }> {
    return this.get("/api/auth/status");
  }

  async logout(): Promise<void> {
    try {
      await this.request("DELETE", "/api/auth");
    } catch {
      /* already gone */
    }
    this.setSessionId(null);
  }

  // ── Catalog ────────────────────────────────────────────────────

  home(p: 0 | 1) { return this.get<StreamBundle>("/api/home", { pageType: String(p) }); }
  topCharts(p: 0 | 1) { return this.get<StreamBundle>("/api/top", { pageType: String(p) }); }
  categories() { return this.get<Category[]>("/api/categories"); }
  categoryApps(b: string) { return this.get<App[]>("/api/category", { browseUrl: b }); }
  streamBrowse(b: string) { return this.get<App[]>("/api/stream", { browseUrl: b }); }
  search(q: string, f?: SearchFilter) {
    return this.get<App[]>("/api/search", { q, ...(f ? { filter: JSON.stringify(f) } : {}) });
  }
  suggestions(q: string) { return this.get<string[]>("/api/suggest", { q }); }
  appDetails(pkg: string) { return this.get<App>("/api/app", { pkg }); }
  reviews(pkg: string) { return this.get<Review[]>("/api/reviews", { pkg }); }
  exodus(pkg: string) { return this.get<ExodusReport>("/api/exodus", { pkg }); }
  dataSafety(pkg: string) { return this.get<DataSafetyReport>("/api/datasafety", { pkg }); }
  plexus(pkg: string) { return this.get<PlexusScores>("/api/plexus", { pkg }); }
  related(pkg: string) { return this.get<App[]>("/api/related", { pkg }); }
  appsBulk(pkgs: string[]) {
    if (pkgs.length === 0) return Promise.resolve([]);
    return this.get<App[]>("/api/apps", { pkgs: pkgs.join(",") });
  }

  // ── Purchase + download (PurchaseHelper/DownloadWorker equivalents) ──

  purchase(pkg: string, versionCode = 0, offerType = 0): Promise<PurchaseInfo> {
    return this.get<PurchaseInfo>("/api/purchase", {
      pkg,
      vc: String(versionCode),
      offer: String(offerType),
    });
  }

  /** Authenticated fetch of APK/OBB bytes (supports Range via `range` + abort). */
  downloadFile(
    pkg: string,
    versionCode: number,
    offerType: number,
    fileIndex: number,
    init: { range?: string; signal?: AbortSignal } = {},
  ): Promise<Response> {
    const url =
      `${this.base}/api/download?` +
      new URLSearchParams({ pkg, vc: String(versionCode), offer: String(offerType), file: String(fileIndex) });
    const headers: Record<string, string> = {};
    const sid = loadSessionId();
    if (sid) headers["X-Session"] = sid;
    if (init.range) headers["Range"] = init.range;
    return fetch(url, { headers, signal: init.signal });
  }
}

const proxy = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PLAY_PROXY ?? "";

export const playApi: PlayApi = proxy ? new HttpPlayApi(proxy) : new MockPlayApi();
export const usingMockBackend = !proxy;

export function isRealApi(api: PlayApi): api is HttpPlayApi {
  return api instanceof HttpPlayApi;
}

/** The shared HttpPlayApi instance when the proxy is configured. */
export function realApi(): HttpPlayApi | null {
  return isRealApi(playApi) ? playApi : null;
}
