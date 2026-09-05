/**
 * Loads Aurora's Play protobuf schemas (GPL-3.0, from gplayapi master:
 * lib/src/main/proto/GooglePlay.proto + AcquireApp.proto, vendored under
 * server/proto/) into protobufjs.
 *
 * The schemas use proto2 `group` fields in 7 places (Image.Dimension,
 * Image.Citation, BuyResponse.CheckoutInfo(+nested CheckoutOption),
 * DebugInfo.Timing, Availability.PerDeviceAvailabilityRestriction, and an
 * `Extra` message). protobufjs cannot parse `group`, so those blocks are
 * stripped before parsing. Data encoded as groups then decodes as *unknown
 * fields and is skipped (protobufjs Reader.skipType handles wire-type 3/4),
 * which only drops: image dimensions/citations, checkout cart details,
 * per-device availability restrictions and debug timings. All fields the
 * WebUI needs (URLs, sizes, hashes, tokens, ratings, text) are regular
 * fields and survive intact.
 */
import protobuf from "protobufjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function stripGroups(src: string): string {
  const re = /(optional|repeated)\s+group\s+\w+\s*=\s*\d+\s*\{/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out += src.slice(last, m.index);
    let depth = 0;
    let j = m.index + m[0].length - 1; // position of '{'
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    last = j + 1;
    re.lastIndex = last;
  }
  out += src.slice(last);
  return out;
}

function loadProto(file: string): protobuf.Root {
  const raw = readFileSync(join(here, "proto", file), "utf8");
  const { root } = protobuf.parse(stripGroups(raw), { keepCase: true });
  root.resolveAll();
  return root;
}

export const playRoot: protobuf.Root = loadProto("GooglePlay.proto");
export const acquireRoot: protobuf.Root = loadProto("AcquireApp.proto");

const typeCache = new Map<string, protobuf.Type>();

/** Look up a message type by name, searching the Play root then the Acquire root. */
export function T(name: string): protobuf.Type {
  const hit = typeCache.get(name);
  if (hit) return hit;
  for (const root of [playRoot, acquireRoot]) {
    try {
      const t = root.lookupType(name);
      typeCache.set(name, t);
      return t;
    } catch {
      /* try next root */
    }
  }
  throw new Error(`Unknown proto message: ${name}`);
}

export function encode(name: string, obj: object): Uint8Array {
  return T(name).encode(obj).finish();
}

export function decode(name: string, buf: Uint8Array): Record<string, any> {
  return T(name).decode(buf) as unknown as Record<string, any>;
}
