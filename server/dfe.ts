/**
 * Google Play DFE (protobuf) client — TypeScript port of the gplayapi
 * helpers used by Aurora Store (AuthHelper, StreamHelper, SearchHelper,
 * AppDetailsHelper, CategoryHelper(s), ReviewsHelper, PurchaseHelper,
 * GooglePlayApi). Wire behavior (endpoints, headers, params, proto
 * messages) mirrors gplayapi 3.6.4 exactly.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, encode } from "./dfe-proto.ts";

const here = dirname(fileURLToPath(import.meta.url));

// ── Endpoint constants (GooglePlayApi companion) ─────────────────

export const URL_BASE = "https://android.clients.google.com";
export const URL_FDFE = `${URL_BASE}/fdfe`;
export const ACQUIRE_URL = `${URL_FDFE}/acquire`;
export const CATEGORIES_URL = `${URL_FDFE}/categoriesList`;
export const DELIVERY_URL = `${URL_FDFE}/delivery`;
export const PURCHASE_URL = `${URL_FDFE}/purchase`;
export const PURCHASE_HISTORY_URL = `${URL_FDFE}/purchaseHistory`;
export const TOP_CHART_URL = `${URL_FDFE}/listTopChartItems`;
export const URL_AUTH = `${URL_BASE}/auth`;
export const URL_BULK_DETAILS = `${URL_FDFE}/bulkDetails`;
export const URL_CHECK_IN = `${URL_BASE}/checkin`;
export const URL_DETAILS = `${URL_FDFE}/details`;
export const URL_REVIEWS = `${URL_FDFE}/rev`;
export const URL_SEARCH = `${URL_FDFE}/search`;
export const URL_SEARCH_SUGGEST = `${URL_FDFE}/searchSuggest`;
export const URL_TESTING_PROGRAM = `${URL_FDFE}/apps/testingProgram`;
export const URL_UPLOAD_DEVICE_CONFIG = `${URL_FDFE}/uploadDeviceConfig`;
export const URL_USER_PROFILE = `${URL_FDFE}/api/userProfile`;

export const LEGACY_USER_AGENT =
  "Android-Finsky/29.2.15-21 [0] [PR] 426536134 (api=3,versionCode=82921510,sdk=25)";

// Static X-DFE blobs (HeaderProvider — same values the app sends).
const X_DFE_ENCODED_TARGETS =
  "CAESN/qigQYC2AMBFfUbyA7SM5Ij/CvfBoIDgxHqGP8R3xzIBvoQtBKFDZ4HAY4FrwSVMasHBO0O2Q8akgYRAQECAQO7AQEpKZ0CnwECAwRrAQYBr9PPAoK7sQMBAQMCBAkIDAgBAwEDBAICBAUZEgMEBAMLAQEBBQEBAcYBARYED+cBfS8CHQEKkAEMMxcBIQoUDwYHIjd3DQ4MFk0JWGYZEREYAQOLAYEBFDMIEYMBAgICAgICOxkCD18LGQKEAcgDBIQBAgGLARkYCy8oBTJlBCUocxQn0QUBDkkGxgNZQq0BZSbeAmIDgAEBOgGtAaMCDAOQAZ4BBIEBKUtQUYYBQscDDxPSARA1oAEHAWmnAsMB2wFyywGLAxol+wImlwOOA80CtwN26A0WjwJVbQEJPAH+BRDeAfkHK/ABASEBCSAaHQemAzkaRiu2Ad8BdXeiAwEBGBUBBN4LEIABK4gB2AFLfwECAdoENq0CkQGMBsIBiQEtiwGgA1zyAUQ4uwS8AwhsvgPyAcEDF27vApsBHaICGhl3GSKxAR8MC6cBAgItmQYG9QIeywLvAeYBDArLAh8HASI4ELICDVmVBgsY/gHWARtcAsMBpALiAdsBA7QBpAJmIArpByn0AyAKBwHTARIHAX8D+AMBcRIBBbEDmwUBMacCHAciNp0BAQF0OgQLJDuSAh54kwFSP0eeAQQ4M5EBQgMEmwFXywFo0gFyWwMcapQBBugBPUW2AVgBKmy3AR6PAbMBGQxrUJECvQR+8gFoWDsYgQNwRSczBRXQAgtRswEW0ALMAREYAUEBIG6yATYCRE8OxgER8gMBvQEDRkwLc8MBTwHZAUOnAXiiBakDIbYBNNcCIUmuArIBSakBrgFHKs0EgwV/G3AD0wE6LgECtQJ4xQFwFbUCjQPkBS6vAQqEAUZF3QIM9wEhCoYCQhXsBCyZArQDugIziALWAdIBlQHwBdUErQE6qQaSA4EEIvYBHir9AQVLmgMCApsCKAwHuwgrENsBAjNYswEVmgIt7QJnN4wDEnta+wGfAcUBxgEtEFXQAQWdAUAeBcwBAQM7rAEJATJ0LENrdh73A6UBhAE+qwEeASxLZUMhDREuH0CGARbd7K0GlQo";
const X_DFE_PHENOTYPE =
  "H4sIAAAAAAAAAB3OO3KjMAAA0KRNuWXukBkBQkAJ2MhgAZb5u2GCwQZbCH_EJ77QHmgvtDtbv-Z9_H63zXXU0NVPB1odlyGy7751Q3CitlPDvFd8lxhz3tpNmz7P92CFw73zdHU2Ie0Ad2kmR8lxhiErTFLt3RPGfJQHSDy7Clw10bg8kqf2owLokN4SecJTLoSwBnzQSd652_MOf2d1vKBNVedzg4ciPoLz2mQ8efGAgYeLou-l-PXn_7Sna1MfhHuySxt-4esulEDp8Sbq54CPPKjpANW-lkU2IZ0F92LBI-ukCKSptqeq1eXU96LD9nZfhKHdtjSWwJqUm_2r6pMHOxk01saVanmNopjX3YxQafC4iC6T55aRbC8nTI98AF_kItIQAJb5EQxnKTO7TZDWnr01HVPxelb9A2OWX6poidMWl16K54kcu_jhXw-JSBQkVcD_fPsLSZu6joIBAAA";

// ── Errors (bytesOrThrow port) ───────────────────────────────────

export type GPlayKind =
  | "auth"
  | "not-purchased"
  | "not-found"
  | "server"
  | "unknown";

export class GPlayError extends Error {
  code: number;
  kind: GPlayKind;
  constructor(code: number, kind: GPlayKind, message: string) {
    super(message);
    this.code = code;
    this.kind = kind;
  }
}

// ── Small utilities ──────────────────────────────────────────────

/** Java String.hashCode() — signed 32-bit, UTF-16 code units. */
export function javaHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function asNum(v: unknown): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function asStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function unescapeProp(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\ /g, " ")
    .replace(/\\:/g, ":")
    .replace(/\\=/g, "=")
    .replace(/\\\\/g, "\\");
}

/** Minimal java.util.Properties parser (key=value, '#'/'!' comments). */
export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    // Split on the first unescaped '=' (keys here never contain ':' separators).
    let idx = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "=" && line[i - 1] !== "\\") {
        idx = i;
        break;
      }
    }
    if (idx < 0) continue;
    out[unescapeProp(line.slice(0, idx).trim())] = unescapeProp(line.slice(idx + 1).trim());
  }
  return out;
}

const propsCache = new Map<string, Record<string, string>>();

/** Load a device profile (e.g. "px_9a" -> server/devices/gplayapi_px_9a.properties). */
export function loadDeviceProps(profile: string): Record<string, string> {
  const hit = propsCache.get(profile);
  if (hit) return hit;
  const text = readFileSync(join(here, "devices", `gplayapi_${profile}.properties`), "utf8");
  const props = parseProperties(text);
  propsCache.set(profile, props);
  return props;
}

// ── DeviceInfoProvider port ──────────────────────────────────────

function propList(props: Record<string, string>, key: string): string[] {
  return (props[key] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function propInt(props: Record<string, string>, key: string): number {
  const n = parseInt(props[key] ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

export function buildUserAgent(props: Record<string, string>): string {
  const platforms = propList(props, "Platforms").join(";");
  const params = [
    "api=3",
    `versionCode=${props["Vending.version"] ?? ""}`,
    `sdk=${props["Build.VERSION.SDK_INT"] ?? ""}`,
    `device=${props["Build.DEVICE"] ?? ""}`,
    `hardware=${props["Build.HARDWARE"] ?? ""}`,
    `product=${props["Build.PRODUCT"] ?? ""}`,
    `platformVersionRelease=${props["Build.VERSION.RELEASE"] ?? ""}`,
    `model=${props["Build.MODEL"] ?? ""}`,
    `buildId=${props["Build.ID"] ?? ""}`,
    "isWideScreen=0",
    `supportedAbis=${platforms}`,
  ];
  return `Android-Finsky/${props["Vending.versionString"] ?? ""} (${params.join(",")})`;
}

export function buildAuthUserAgent(props: Record<string, string>): string {
  return `GoogleAuth/1.4 (${props["Build.DEVICE"] ?? ""} ${props["Build.ID"] ?? ""})`;
}

export function buildDeviceConfig(props: Record<string, string>): Record<string, unknown> {
  const features = propList(props, "Features");
  return {
    touchScreen: propInt(props, "TouchScreen"),
    keyboard: propInt(props, "Keyboard"),
    navigation: propInt(props, "Navigation"),
    screenLayout: propInt(props, "ScreenLayout"),
    hasHardKeyboard: props["HasHardKeyboard"] === "true",
    hasFiveWayNavigation: props["HasFiveWayNavigation"] === "true",
    lowRamDevice: parseInt(props["LowRamDevice"] ?? "0", 10) || 0,
    maxNumOf_CPUCores: parseInt(props["MaxNumOfCPUCores"] ?? "8", 10) || 8,
    totalMemoryBytes: parseInt(props["TotalMemoryBytes"] ?? "8589935000", 10) || 8589935000,
    deviceClass: 0,
    screenDensity: propInt(props, "Screen.Density"),
    screenWidth: propInt(props, "Screen.Width"),
    screenHeight: propInt(props, "Screen.Height"),
    nativePlatform: propList(props, "Platforms"),
    systemSharedLibrary: propList(props, "SharedLibraries"),
    systemAvailableFeature: propList(props, "Features"),
    systemSupportedLocale: propList(props, "Locales"),
    glEsVersion: propInt(props, "GL.Version"),
    glExtension: propList(props, "GL.Extensions"),
    deviceFeature: features.map((name) => ({ name, value: 0 })),
  };
}

export function buildCheckinRequest(
  props: Record<string, string>,
  locale: string,
): Record<string, unknown> {
  const timeSec = Math.floor(Date.now() / 1000);
  return {
    id: 0,
    checkin: {
      build: {
        id: props["Build.FINGERPRINT"] ?? "",
        product: props["Build.HARDWARE"] ?? "",
        carrier: props["Build.BRAND"] ?? "",
        radio: props["Build.RADIO"] ?? "",
        bootloader: props["Build.BOOTLOADER"] ?? "",
        device: props["Build.DEVICE"] ?? "",
        sdkVersion: propInt(props, "Build.VERSION.SDK_INT"),
        model: props["Build.MODEL"] ?? "",
        manufacturer: props["Build.MANUFACTURER"] ?? "",
        buildProduct: props["Build.PRODUCT"] ?? "",
        client: props["Client"] ?? "android-google",
        otaInstalled: props["OtaInstalled"] === "true",
        timestamp: timeSec,
        googleServices: propInt(props, "GSF.version"),
      },
      lastCheckinMsec: 0,
      cellOperator: props["CellOperator"] ?? "",
      simOperator: props["SimOperator"] ?? "",
      roaming: props["Roaming"] ?? "",
      userNumber: 0,
    },
    locale,
    timeZone: props["TimeZone"] ?? "UTC",
    version: 3,
    deviceConfiguration: buildDeviceConfig(props),
    fragment: 0,
  };
}

// ── Session shape (persisted by auth.ts) ─────────────────────────

export interface DfeSession {
  id: string;
  email: string;
  isAnonymous: boolean;
  aasToken: string;
  authToken: string;
  gsfId: string;
  checkinConsistencyToken: string;
  deviceConfigToken: string;
  dfeCookie: string;
  deviceProfile: string;
  locale: string;
  dispenserUrl: string;
  createdAt: number;
}

// ── Headers / params (HeaderProvider + ParamProvider ports) ──────

export function authHeaders(sess: DfeSession, props: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    app: "com.google.android.gms",
    "User-Agent": buildAuthUserAgent(props),
  };
  if (sess.gsfId) h["device"] = sess.gsfId;
  return h;
}

export function defaultHeaders(sess: DfeSession, props: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${sess.authToken}`,
    "User-Agent": buildUserAgent(props),
    "X-DFE-Device-Id": sess.gsfId,
    "Accept-Language": sess.locale.replace("_", "-"),
    "X-DFE-Encoded-Targets": X_DFE_ENCODED_TARGETS,
    "X-DFE-Phenotype": X_DFE_PHENOTYPE,
    "X-DFE-Client-Id": "am-android-google",
    "X-DFE-Network-Type": "4",
    "X-DFE-Content-Filters": "",
    "X-Limit-Ad-Tracking-Enabled": "false",
    "X-Ad-Id": "",
    "X-DFE-UserLanguages": sess.locale,
    "X-DFE-Request-Params": "timeoutMs=4000",
  };
  if (sess.checkinConsistencyToken) h["X-DFE-Device-Checkin-Consistency-Token"] = sess.checkinConsistencyToken;
  if (sess.deviceConfigToken) h["X-DFE-Device-Config-Token"] = sess.deviceConfigToken;
  if (sess.dfeCookie) h["X-DFE-Cookie"] = sess.dfeCookie;
  const mccMnc = props["SimOperator"] ?? "";
  if (mccMnc) h["X-DFE-MCCMNC"] = mccMnc;
  return h;
}

const CALLER_SIG = "38918a453d07199354f8b19af05ec6562ced5788";

export function defaultAuthParams(sess: DfeSession, props: Record<string, string>): Record<string, string> {
  const [lang, country] = sess.locale.split("_");
  const p: Record<string, string> = {
    sdk_version: props["Build.VERSION.SDK_INT"] ?? "",
    Email: sess.email,
    google_play_services_version: props["GSF.version"] ?? "",
    device_country: (country ?? "US").toLowerCase(),
    lang: (lang ?? "en").toLowerCase(),
    callerSig: CALLER_SIG,
  };
  if (sess.gsfId) p["androidId"] = sess.gsfId;
  return p;
}

export function googlePlayServiceParams(aasToken: string): Record<string, string> {
  return {
    app: "com.android.vending",
    client_sig: CALLER_SIG,
    callerPkg: "com.google.android.gms",
    Token: aasToken,
    oauth2_foreground: "1",
    token_request_options: "CAA4AVAB",
    check_email: "1",
    system_partition: "1",
    droidguard_results: "null",
    service: "oauth2:https://www.googleapis.com/auth/googleplay",
  };
}

// ── Low-level HTTP (DefaultHttpClient port) ──────────────────────

export interface PlayResponse {
  ok: boolean;
  status: number;
  bytes: Uint8Array;
  contentType: string;
  errorString: string;
}

function withQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.append(k, v);
  return u.toString();
}

async function readBytes(res: Response): Promise<Uint8Array> {
  return new Uint8Array(await res.arrayBuffer());
}

export async function dfeGet(
  url: string,
  headers: Record<string, string>,
  params: Record<string, string> = {},
): Promise<PlayResponse> {
  const res = await fetch(withQuery(url, params), {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(30000),
  });
  return {
    ok: res.ok,
    status: res.status,
    bytes: await readBytes(res),
    contentType: res.headers.get("content-type") ?? "",
    errorString: res.ok ? "" : res.statusText,
  };
}

/** GET with a raw (already formatted) query string — searchSuggest only. */
export async function dfeGetRaw(url: string, headers: Record<string, string>): Promise<PlayResponse> {
  const res = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(30000) });
  return {
    ok: res.ok,
    status: res.status,
    bytes: await readBytes(res),
    contentType: res.headers.get("content-type") ?? "",
    errorString: res.ok ? "" : res.statusText,
  };
}

/** POST with params in the query string and an empty body (gplayapi convention). */
export async function dfePostParams(
  url: string,
  headers: Record<string, string>,
  params: Record<string, string>,
): Promise<PlayResponse> {
  const res = await fetch(withQuery(url, params), {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30000),
  });
  return {
    ok: res.ok,
    status: res.status,
    bytes: await readBytes(res),
    contentType: res.headers.get("content-type") ?? "",
    errorString: res.ok ? "" : res.statusText,
  };
}

/** POST with a raw protobuf body. */
export async function dfePostBytes(
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  contentType = "application/x-protobuf",
): Promise<PlayResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": contentType },
    body,
    signal: AbortSignal.timeout(30000),
  });
  return {
    ok: res.ok,
    status: res.status,
    bytes: await readBytes(res),
    contentType: res.headers.get("content-type") ?? "",
    errorString: res.ok ? "" : res.statusText,
  };
}

function isProto(contentType: string): boolean {
  return (
    contentType.includes("application/x-protobuf") ||
    contentType.includes("application/protobuf") ||
    contentType.includes("application/x-protobuffer")
  );
}

/** bytesOrThrow port — maps HTTP/proto failures to typed errors. */
export function bytesOrThrow(resp: PlayResponse, isAuth = false): Uint8Array {
  if (resp.ok) return resp.bytes;
  let reason = resp.errorString;
  if (isProto(resp.contentType)) {
    try {
      const sr = decode("ServerResponse", resp.bytes) as { error?: { message?: unknown } };
      const se = asStr(sr.error?.message);
      if (se) reason = se;
    } catch {
      /* fall through to text */
    }
  } else {
    const text = Buffer.from(resp.bytes).toString("utf8");
    if (text) reason = text;
  }
  if (isAuth) throw new GPlayError(resp.status, "auth", reason || `Auth failed (${resp.status})`);
  if (resp.status === 401) throw new GPlayError(401, "auth", reason || "Unauthorized");
  if (resp.status === 403) throw new GPlayError(403, "not-purchased", reason || "App not purchased");
  if (resp.status === 404) throw new GPlayError(404, "not-found", reason || "Not found");
  if (resp.status >= 500 && resp.status <= 599) {
    throw new GPlayError(resp.status, "server", reason || "Play server error");
  }
  throw new GPlayError(resp.status, "unknown", reason || `Request failed (${resp.status})`);
}

/** Util.parseResponse port — "k=v" lines into a map. */
export function parseKeyValues(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of Buffer.from(bytes).toString("utf8").split(/[\n\r]+/)) {
    const idx = line.indexOf("=");
    if (idx > 0) out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

// ── Auth flows (AuthHelper/GooglePlayApi ports) ──────────────────

export interface CheckinResult {
  gsfId: string;
  consistencyToken: string;
}

/** generateGsfId: checkin -> hex android id + consistency token. */
export async function doCheckin(sess: DfeSession, props: Record<string, string>): Promise<CheckinResult> {
  const body = encode("AndroidCheckinRequest", buildCheckinRequest(props, sess.locale));
  const headers = authHeaders(sess, props);
  headers["Content-Type"] = "application/x-protobuffer";
  headers["Host"] = "android.clients.google.com";
  const resp = await dfePostBytes(URL_CHECK_IN, headers, body, "application/x-protobuffer");
  const bytes = bytesOrThrow(resp, true);
  const cr = decode("AndroidCheckinResponse", bytes) as {
    androidId?: unknown;
    deviceCheckinConsistencyToken?: unknown;
  };
  const unsigned = BigInt(asStr(cr.androidId ?? "0") || "0") & ((1n << 64n) - 1n);
  // Java BigInteger.valueOf((long) bits).toString(16): signed interpretation.
  const signed = unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
  const gsfId = signed.toString(16);
  return { gsfId, consistencyToken: asStr(cr.deviceCheckinConsistencyToken) };
}

/** uploadDeviceConfig -> config token. */
export async function doUploadDeviceConfig(sess: DfeSession, props: Record<string, string>): Promise<string> {
  const body = encode("UploadDeviceConfigRequest", {
    deviceConfiguration: buildDeviceConfig(props),
  });
  const resp = await dfePostBytes(URL_UPLOAD_DEVICE_CONFIG, defaultHeaders(sess, props), body);
  const wrapper = decode("ResponseWrapper", bytesOrThrow(resp, true)) as {
    payload?: { uploadDeviceConfigResponse?: { uploadDeviceConfigToken?: unknown } };
  };
  return asStr(wrapper.payload?.uploadDeviceConfigResponse?.uploadDeviceConfigToken);
}

/** generateToken(GOOGLE_PLAY) for AAS accounts -> auth (Bearer) token. */
export async function doGenerateToken(sess: DfeSession, props: Record<string, string>): Promise<string> {
  const params = {
    ...defaultAuthParams(sess, props),
    ...googlePlayServiceParams(sess.aasToken),
  };
  const headers = authHeaders(sess, props);
  headers["app"] = "com.google.android.gms";
  const resp = await dfePostParams(URL_AUTH, headers, params);
  const kv = parseKeyValues(bytesOrThrow(resp, true));
  if (!kv["Auth"]) throw new GPlayError(401, "auth", kv["Error"] || "Could not generate OAuth token");
  return kv["Auth"];
}

/** UserProfileHelper.getUserProfile -> display name (best effort). */
export async function fetchUserProfileName(sess: DfeSession, props: Record<string, string>): Promise<string> {
  try {
    const resp = await dfeGet(URL_USER_PROFILE, defaultHeaders(sess, props));
    const wrapper = decode("ResponseWrapperApi", bytesOrThrow(resp)) as {
      payload?: { userProfileResponse?: { userProfile?: { name?: unknown } } };
    };
    return asStr(wrapper.payload?.userProfileResponse?.userProfile?.name);
  } catch {
    return "";
  }
}

/** AuthHelper.isValid port — live-checks a session against a known package. */
export async function isSessionValid(sess: DfeSession, props: Record<string, string>): Promise<boolean> {
  try {
    const app = await getAppDetails(sess, props, "com.google.android.apps.maps");
    return asStr((app as unknown as Record<string, unknown>)["packageName"]) !== "";
  } catch {
    return false;
  }
}

// ── ResponseWrapper helpers (NativeHelper ports) ─────────────────

export function payloadOf(bytes: Uint8Array): Record<string, any> {
  const wrapper = decode("ResponseWrapper", bytes) as { payload?: Record<string, any> };
  return wrapper.payload ?? {};
}

export function prefetchPayload(bytes: Uint8Array): Record<string, any> {
  const wrapper = decode("ResponseWrapper", bytes) as {
    preFetch?: { response?: { payload?: Record<string, any> } };
    payload?: Record<string, any>;
  };
  if (wrapper.preFetch?.response?.payload) return wrapper.preFetch.response.payload;
  return wrapper.payload ?? {};
}

// ── Catalog ops ──────────────────────────────────────────────────

async function getList(
  sess: DfeSession,
  props: Record<string, string>,
  url: string,
  params: Record<string, string>,
  legacyUa = false,
): Promise<Record<string, any>> {
  const headers = defaultHeaders(sess, props);
  if (legacyUa) headers["User-Agent"] = LEGACY_USER_AGENT;
  const resp = await dfeGet(url, headers, params);
  return (payloadOf(bytesOrThrow(resp)).listResponse ?? {}) as Record<string, any>;
}

/** StreamHelper.fetch(HOME) */
export async function getHomeStream(
  sess: DfeSession,
  props: Record<string, string>,
  category: "APPLICATION" | "GAME",
): Promise<Record<string, any>> {
  return getList(sess, props, `${URL_FDFE}/getHomeStream`, { c: "3", cat: category });
}

/** SearchHelper.searchResults */
export async function getSearchResults(
  sess: DfeSession,
  props: Record<string, string>,
  query: string,
): Promise<{ bundle: Record<string, any>; title: string }> {
  const headers = defaultHeaders(sess, props);
  const resp = await dfeGet(URL_SEARCH, headers, { q: query, c: "3", ksm: "1" });
  const payload = prefetchPayload(bytesOrThrow(resp));
  return { bundle: bundleOf(javaHash(query), payload.listResponse ?? {}), title: query };
}

function bundleOf(id: number, list: Record<string, any>): Record<string, any> {
  const item = (list.item ?? null) as Record<string, any> | null;
  const clusters: Record<string, any>[] = [];
  if (item && Array.isArray(item.subItem)) {
    for (const sub of item.subItem as Record<string, any>[]) {
      clusters.push(clusterOf(0, sub));
    }
  }
  return {
    id,
    streamTitle: asStr(item?.title),
    streamNextPageUrl: asStr(item?.containerMetadata?.nextPageUrl),
    streamClusters: clusters,
  };
}

function clusterOf(id: number, item: Record<string, any>): Record<string, any> {
  return {
    id,
    clusterTitle: asStr(item.title),
    clusterSubtitle: asStr(item.subtitle),
    clusterBrowseUrl: asStr(item.containerMetadata?.browseUrl),
    clusterNextPageUrl: asStr(item.containerMetadata?.nextPageUrl),
    clusterAppList: appsFromItem(item),
  };
}

export function appsFromItem(item: Record<string, any>): Record<string, any>[] {
  const subs = (item.subItem ?? []) as Record<string, any>[];
  return subs.filter((s) => asNum(s.type) === 1 && asStr(s.id));
}

/** SearchHelper.searchSuggestions */
export async function getSearchSuggestions(
  sess: DfeSession,
  props: Record<string, string>,
  query: string,
): Promise<string[]> {
  const headers = defaultHeaders(sess, props);
  headers["User-Agent"] = LEGACY_USER_AGENT;
  const url = `${URL_SEARCH_SUGGEST}?q=${encodeURIComponent(query)}&sb=5&sst=2&sst=3`;
  const resp = await dfeGetRaw(url, headers);
  const payload = payloadOf(bytesOrThrow(resp));
  const entries = ((payload.searchSuggestResponse ?? {}) as Record<string, any>).entry ?? [];
  const out: string[] = [];
  for (const e of entries as Record<string, any>[]) {
    const q = asStr(e.suggestedQuery) || asStr(e.title);
    if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

/** AppDetailsHelper.getAppByPackageName */
export async function getAppDetails(
  sess: DfeSession,
  props: Record<string, string>,
  packageName: string,
): Promise<Record<string, any>> {
  const resp = await dfeGet(URL_DETAILS, defaultHeaders(sess, props), { doc: packageName });
  const payload = payloadOf(bytesOrThrow(resp));
  const details = (payload.detailsResponse ?? {}) as Record<string, any>;
  if (!details.item) throw new GPlayError(404, "not-found", `App not found: ${packageName}`);
  return details;
}

/** AppDetailsHelper bulk (update checks) */
export async function getBulkDetails(
  sess: DfeSession,
  props: Record<string, string>,
  packageNames: string[],
): Promise<Record<string, any>[]> {
  if (packageNames.length === 0) return [];
  const body = encode("BulkDetailsRequest", { DocId: packageNames });
  const resp = await dfePostBytes(URL_BULK_DETAILS, defaultHeaders(sess, props), body);
  const payload = payloadOf(bytesOrThrow(resp));
  const entries = ((payload.bulkDetailsResponse ?? {}) as Record<string, any>).entry ?? [];
  return (entries as Record<string, any>[])
    .map((e) => e.item as Record<string, any>)
    .filter((i) => i && asStr(i.id));
}

/** CategoryHelper.getAllCategories */
export async function getCategories(
  sess: DfeSession,
  props: Record<string, string>,
  type: "APPLICATION" | "GAME" | "FAMILY",
): Promise<Record<string, any>[]> {
  const list = await getList(sess, props, CATEGORIES_URL, { c: "3", cat: type }, true);
  const item = (list.item ?? {}) as Record<string, any>;
  const first = ((item.subItem ?? []) as Record<string, any>[])[0] ?? {};
  return ((first.subItem ?? []) as Record<string, any>[]).map((sub) => ({
    title: asStr(sub.title),
    imageUrl: asStr((sub.image ?? [])[0]?.imageUrl),
    browseUrl: asStr(sub.annotations?.annotationLink?.resolvedLink?.browseUrl),
    type,
  }));
}

/** CategoryStreamHelper.fetch — category pages and stream browse URLs. */
export async function getStreamByUrl(
  sess: DfeSession,
  props: Record<string, string>,
  url: string,
): Promise<Record<string, any>> {
  const resp = await dfeGet(`${URL_FDFE}/${url}`, defaultHeaders(sess, props));
  const payload = prefetchPayload(bytesOrThrow(resp));
  if (payload.listResponse) return bundleOf(javaHash(url), payload.listResponse as Record<string, any>);
  return { id: javaHash(url), streamTitle: "", streamNextPageUrl: "", streamClusters: [] };
}

/** TopChartsHelper.getCluster */
export async function getTopChart(
  sess: DfeSession,
  props: Record<string, string>,
  category: "APPLICATION" | "GAME",
  chart: string,
): Promise<Record<string, any>> {
  const list = await getList(
    sess,
    props,
    TOP_CHART_URL,
    { c: "3", stcid: chart, scat: category },
    true,
  );
  const item = (list.item ?? {}) as Record<string, any>;
  const first = ((item.subItem ?? []) as Record<string, any>[])[0];
  if (!first) return clusterOf(0, {});
  return clusterOf(0, first);
}

/** ReviewsHelper.getReviews (filter ALL default) */
export async function getReviews(
  sess: DfeSession,
  props: Record<string, string>,
  packageName: string,
): Promise<Record<string, any>[]> {
  const resp = await dfeGet(URL_REVIEWS, defaultHeaders(sess, props), {
    doc: packageName,
    n: "20",
    sfilter: "ALL",
  });
  const payload = payloadOf(bytesOrThrow(resp));
  const rr = (payload.reviewResponse ?? {}) as Record<string, any>;
  const urr = (rr.userReviewsResponse ?? {}) as Record<string, any>;
  return ((urr.review ?? []) as Record<string, any>[]).filter((r) => asStr(r.commentId) || asStr(r.comment));
}

// ── Purchase / delivery (PurchaseHelper ports) ───────────────────

export interface DeliveryFile {
  name: string;
  url: string;
  size: number;
  sha1: string;
  sha256: string;
  kind: "BASE" | "SPLIT" | "OBB";
}

function hexHash(b64url: string): string {
  if (!b64url) return "";
  try {
    return Buffer.from(b64url, "base64url").toString("hex");
  } catch {
    return "";
  }
}

export function nonce(): string {
  const b = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) b[i] = Math.floor(Math.random() * 256);
  return `nonce=${b.toString("base64url")}`;
}

/** PurchaseHelper.acquire — best effort, failures ignored by callers. */
export async function acquireApp(
  sess: DfeSession,
  props: Record<string, string>,
  packageName: string,
  versionCode: number,
  offerType: number,
): Promise<boolean> {
  try {
    const body = encode("AcquireRequest", {
      package: {
        payload: { packageName, f2: 1, f3: 3 },
        f2: 1,
      },
      version: { versionCode, f3: 0 },
      f15: 0,
      offerType,
      nonce: nonce(),
      f25: 2,
      m30: { f1: 2, f2: 0 },
    });
    const resp = await dfePostBytes(ACQUIRE_URL, defaultHeaders(sess, props), body);
    if (!resp.ok) return false;
    const ar = decode("AcquireResponseWrapper", resp.bytes) as {
      acquireResponse?: { acquirePayload?: { purchase?: { appPurchase?: unknown; gamePurchase?: unknown } } };
    };
    const p = ar.acquireResponse?.acquirePayload?.purchase;
    return !!p && (p.appPurchase != null || p.gamePurchase != null);
  } catch {
    return false;
  }
}

async function deliveryToken(
  sess: DfeSession,
  props: Record<string, string>,
  packageName: string,
  versionCode: number,
  offerType: number,
): Promise<string> {
  const params: Record<string, string> = {
    ot: String(offerType),
    doc: packageName,
    vc: String(versionCode),
  };
  const resp = await dfePostParams(PURCHASE_URL, defaultHeaders(sess, props), params);
  // NOTE: gplayapi reads responseBytes without throwing here.
  const payload = payloadOf(resp.bytes);
  return asStr((payload.buyResponse as Record<string, any> | undefined)?.encodedDeliveryToken);
}

/**
 * PurchaseHelper.purchase — acquire (ignored on failure) + delivery token +
 * delivery response -> file list with download URLs. Throws GPlayError with
 * status mapping from DeliveryResponse.status (2/9 not-supported, 3 not-purchased,
 * 7 removed).
 */
export async function purchaseFiles(
  sess: DfeSession,
  props: Record<string, string>,
  packageName: string,
  versionCode: number,
  offerType: number,
): Promise<DeliveryFile[]> {
  await acquireApp(sess, props, packageName, versionCode, offerType);
  const dtok = await deliveryToken(sess, props, packageName, versionCode, offerType);
  const params: Record<string, string> = {
    ot: String(offerType),
    doc: packageName,
    vc: String(versionCode),
  };
  if (dtok) params["dtok"] = dtok;
  const resp = await dfeGet(DELIVERY_URL, defaultHeaders(sess, props), params);
  const payload = payloadOf(bytesOrThrow(resp));
  const dr = (payload.deliveryResponse ?? {}) as {
    status?: unknown;
    appDeliveryData?: Record<string, any>;
  };
  const status = asNum(dr.status ?? 1);
  if (status === 2 || status === 9) throw new GPlayError(status, "unknown", "App not supported on this device");
  if (status === 3) throw new GPlayError(3, "not-purchased", "App not purchased");
  if (status === 7) throw new GPlayError(7, "not-found", "App removed from Play");
  if (status !== 1) throw new GPlayError(status, "unknown", `Delivery failed (status ${status})`);
  const data = dr.appDeliveryData ?? {};
  const files: DeliveryFile[] = [];
  files.push({
    name: "base.apk",
    url: asStr(data.downloadUrl),
    size: asNum(data.downloadSize),
    sha1: hexHash(asStr(data.sha1)),
    sha256: hexHash(asStr(data.sha256)),
    kind: "BASE",
  });
  for (const meta of ((data.additionalFile ?? []) as Record<string, any>[])) {
    const isObb = asNum(meta.fileType) === 0;
    files.push({
      name: isObb ? `main.${versionCode}.${packageName}.obb` : `patch.${versionCode}.${packageName}.obb`,
      url: asStr(meta.downloadUrl),
      size: asNum(meta.size),
      sha1: hexHash(asStr(meta.sha1)),
      sha256: "",
      kind: "OBB",
    });
  }
  for (const split of ((data.splitDeliveryData ?? []) as Record<string, any>[])) {
    files.push({
      name: `${asStr(split.name)}.apk`,
      url: asStr(split.downloadUrl),
      size: asNum(split.downloadSize),
      sha1: hexHash(asStr(split.sha1)),
      sha256: hexHash(asStr(split.sha256)),
      kind: "SPLIT",
    });
  }
  const usable = files.filter((f) => f.url);
  if (usable.length === 0) throw new GPlayError(-1, "unknown", "No downloadable files returned");
  return usable;
}
