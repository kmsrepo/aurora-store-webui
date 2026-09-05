/**
 * Session management + Play auth flows.
 * - Anonymous: POST device properties to a token dispenser
 *   (default https://auroraoss.com/api/auth, like the Android app) ->
 *   {email, authToken} -> checkin -> uploadDeviceConfig -> session.
 * - Google: user-supplied email + AAS token -> checkin ->
 *   uploadDeviceConfig -> generateToken(GOOGLE_PLAY) -> session.
 * Sessions persist to disk so a server restart keeps logins.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  doCheckin,
  doGenerateToken,
  doUploadDeviceConfig,
  fetchUserProfileName,
  isSessionValid,
  loadDeviceProps,
  type DfeSession,
} from "./dfe.ts";

export type { DfeSession };

const APP_UA = "com.aurora.store-4.8.4-76";

function dispenserUrls(): string[] {
  const env = (process.env["DISPENSER_URL"] ?? "").trim();
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return ["https://auroraoss.com/api/auth"];
}

function dataDir(): string {
  const dir = process.env["DATA_DIR"] ?? join(homedir(), ".aurora-webui");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionsFile(): string {
  return join(dataDir(), "sessions.json");
}

function loadAll(): Map<string, DfeSession> {
  const map = new Map<string, DfeSession>();
  try {
    if (!existsSync(sessionsFile())) return map;
    const arr = JSON.parse(readFileSync(sessionsFile(), "utf8")) as DfeSession[];
    for (const s of arr) map.set(s.id, s);
  } catch {
    /* corrupted file -> start fresh */
  }
  return map;
}

const sessions = loadAll();

function persist(): void {
  try {
    writeFileSync(sessionsFile(), JSON.stringify([...sessions.values()], null, 2));
  } catch {
    /* private/restricted fs -> sessions stay in memory */
  }
}

export function getSession(id: string): DfeSession | undefined {
  return sessions.get(id);
}

export function dropSession(id: string): void {
  sessions.delete(id);
  persist();
}

function dispenserError(status: number, body: string): Error {
  switch (status) {
    case 400:
      return new Error("Bad dispenser request (400)");
    case 403:
      return new Error("Dispenser denied access — a VPN/proxy may be required (403)");
    case 404:
      return new Error("Dispenser unreachable (404)");
    case 429:
      return new Error("Anonymous login rate-limited, try again later (429)");
    case 503:
      return new Error("Dispenser under maintenance (503)");
    default:
      return new Error(body || `Dispenser failed (${status})`);
  }
}

interface DispenserAuth {
  email: string;
  auth: string;
}

async function fetchDispenserAuth(props: Record<string, string>): Promise<{ auth: DispenserAuth; url: string }> {
  const urls = dispenserUrls();
  const errors: string[] = [];
  // Try each dispenser once, starting at a random one (like the app's random pick).
  const order = urls.map((_, i) => (i + Math.floor(Math.random() * urls.length)) % urls.length);
  for (const i of [...new Set(order)]) {
    const url = urls[i];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": APP_UA },
        body: JSON.stringify(props),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      if (!res.ok) throw dispenserError(res.status, text);
      const parsed = JSON.parse(text) as { email?: unknown; authToken?: unknown };
      if (typeof parsed.email !== "string" || typeof parsed.authToken !== "string" || !parsed.authToken) {
        throw new Error("Malformed dispenser response");
      }
      return { auth: { email: parsed.email, auth: parsed.authToken }, url };
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`);
    }
  }
  throw new Error(`All dispensers failed — ${errors.join("; ")}`);
}

/** Build a full anonymous session (dispenser -> checkin -> device config). */
export async function createAnonymousSession(deviceProfile = "px_9a", locale = "en_US"): Promise<DfeSession> {
  const props = loadDeviceProps(deviceProfile);
  const { auth, url } = await fetchDispenserAuth(props);
  const sess: DfeSession = {
    id: randomUUID(),
    email: auth.email,
    isAnonymous: true,
    aasToken: "",
    authToken: auth.auth,
    gsfId: "",
    checkinConsistencyToken: "",
    deviceConfigToken: "",
    dfeCookie: "",
    deviceProfile,
    locale,
    dispenserUrl: url,
    createdAt: Date.now(),
  };
  const checkin = await doCheckin(sess, props);
  sess.gsfId = checkin.gsfId;
  sess.checkinConsistencyToken = checkin.consistencyToken;
  sess.deviceConfigToken = await doUploadDeviceConfig(sess, props);
  sessions.set(sess.id, sess);
  persist();
  return sess;
}

/** Build a session from a user-supplied Google AAS token (or AUTH token). */
export async function createGoogleSession(
  email: string,
  token: string,
  tokenType: "AAS" | "AUTH",
  deviceProfile = "px_9a",
  locale = "en_US",
): Promise<DfeSession> {
  const props = loadDeviceProps(deviceProfile);
  const sess: DfeSession = {
    id: randomUUID(),
    email,
    isAnonymous: false,
    aasToken: tokenType === "AAS" ? token : "",
    authToken: tokenType === "AUTH" ? token : "",
    gsfId: "",
    checkinConsistencyToken: "",
    deviceConfigToken: "",
    dfeCookie: "",
    deviceProfile,
    locale,
    dispenserUrl: "",
    createdAt: Date.now(),
  };
  const checkin = await doCheckin(sess, props);
  sess.gsfId = checkin.gsfId;
  sess.checkinConsistencyToken = checkin.consistencyToken;
  sess.deviceConfigToken = await doUploadDeviceConfig(sess, props);
  if (tokenType === "AAS") {
    sess.authToken = await doGenerateToken(sess, props);
  }
  // Best-effort profile name; never fail login on it.
  const name = await fetchUserProfileName(sess, props);
  if (name) sess.email = email;
  sessions.set(sess.id, sess);
  persist();
  return sess;
}

export async function checkSession(sess: DfeSession): Promise<boolean> {
  try {
    const props = loadDeviceProps(sess.deviceProfile);
    return await isSessionValid(sess, props);
  } catch {
    return false;
  }
}

export function publicSession(sess: DfeSession): Record<string, unknown> {
  return {
    session: sess.id,
    email: sess.email,
    isAnonymous: sess.isAnonymous,
    deviceProfile: sess.deviceProfile,
    locale: sess.locale,
    gsfId: sess.gsfId,
  };
}
