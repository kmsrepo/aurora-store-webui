/**
 * Normalizers: gplayapi proto JSON -> WebUI TS shapes (src/lib/types.ts).
 * Field mapping mirrors data/builders/AppBuilder.kt + ReviewBuilder.kt.
 */
import { asNum, asStr, javaHash } from "./dfe.ts";

const GMS_PACKAGE = "com.google.android.gms";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function humanSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** AppBuilder.getInstalls: digits of infoDownload with [,.\\s] removed. */
function parseInstalls(infoDownload: string): number {
  const digits = infoDownload.replace(/[,.\s]+/g, "").replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

interface Artwork {
  url: string;
  type: number;
}

function artworksOf(item: Record<string, any>): Artwork[] {
  const imgs = ((item.image ?? []) as Record<string, any>[]);
  return imgs.map((i) => ({ url: asStr(i.secureUrl) || asStr(i.imageUrl), type: asNum(i.imageType) }));
}

function pick(arts: Artwork[], type: number): string {
  return arts.find((a) => a.type === type && a.url)?.url ?? "";
}

/** Screenshot fallback: annotations.sectionImage.imageContainer[].image */
function fallbackScreenshots(item: Record<string, any>): string[] {
  const section = (item.annotations ?? {}).sectionImage as Record<string, any> | undefined;
  const containers = ((section?.imageContainer ?? []) as Record<string, any>[]);
  const out: string[] = [];
  for (const c of containers) {
    const img = (c.image ?? {}) as Record<string, any>;
    const url = asStr(img.secureUrl) || asStr(img.imageUrl);
    if (url) out.push(url);
  }
  return out;
}

export function normalizeApp(item: Record<string, any>): Record<string, any> {
  const pkg = asStr(item.id);
  const details = ((item.details ?? {}) as Record<string, any>).appDetails ?? {};
  const ad = details as Record<string, any>;
  const offers = ((item.offer ?? []) as Record<string, any>[]);
  const offer = offers[0] ?? {};
  const rating = (item.aggregateRating ?? {}) as Record<string, any>;
  const annotations = (item.annotations ?? {}) as Record<string, any>;
  const arts = artworksOf(item);
  const screenshots = arts.filter((a) => a.type === 1 && a.url).map((a) => a.url);
  const shots = screenshots.length > 0 ? screenshots : fallbackScreenshots(item);
  const deps = (ad.dependencies ?? {}) as Record<string, any>;
  const depPkgs = ((deps.dependency ?? []) as Record<string, any>[]).map((d) => asStr(d.packageName));
  const testing = (ad.testingProgramInfo ?? null) as Record<string, any> | null;
  const tagGroup = (ad.tagGroup ?? {}) as Record<string, any>;
  const tags: string[] = [];
  for (const t of ["type1", "type2", "type3", "type4", "type5", "type6"]) {
    const entries = ((tagGroup[t] ?? {}).entries ?? []) as Record<string, any>[];
    for (const e of entries) {
      const name = asStr(e.name);
      if (name && !tags.includes(name)) tags.push(name);
    }
  }
  const files = ((ad.file ?? []) as Record<string, any>[]).map((f, i) => ({
    fileType: asNum(f.fileType),
    name: asStr(f.splitId) ? `${asStr(f.splitId)}.${asNum(ad.versionCode)}.apk` : `${pkg}.${asNum(ad.versionCode)}.${i}.apk`,
    size: asNum(f.size),
    versionCode: asNum(f.versionCode),
  }));
  const histogram = [
    asNum(rating.oneStarRatings),
    asNum(rating.twoStarRatings),
    asNum(rating.threeStarRatings),
    asNum(rating.fourStarRatings),
    asNum(rating.fiveStarRatings),
  ];
  const installs = parseInstalls(asStr(ad.infoDownload));
  const sizeBytes = asNum(ad.infoDownloadSize);
  const versionCode = asNum(ad.versionCode);
  const devName = asStr(ad.developerName) || asStr(item.creator);
  return {
    id: javaHash(pkg),
    packageName: pkg,
    displayName: asStr(item.title),
    developerName: devName,
    developerId: slugify(devName),
    developerEmail: asStr(ad.developerEmail),
    developerWebsite: asStr(ad.developerWebsite),
    developerAddress: asStr(ad.developerAddress),
    shortDescription: asStr(item.promotionalDescription),
    description: stripHtml(asStr(item.descriptionHtml)),
    changes: stripHtml(asStr(ad.recentChangesHtml)),
    iconUrl: pick(arts, 4),
    bannerUrl: pick(arts, 2) || undefined,
    screenshots: shots,
    price: asStr(offer.formattedAmount),
    isFree: offers.length > 0 ? asNum(offer.micros) === 0 : false,
    // installNotes is only present when the listing carries install notes
    // (AppBuilder: containsAds = hasInstallNotes()). Absent decodes as "".
    containsAds: asStr(ad.installNotes) !== "",
    inAppPurchases: asStr(ad.inAppProduct) !== "",
    rating: {
      average: asNum(rating.starRating),
      count: asNum(rating.ratingsCount),
      histogram,
    },
    installs,
    installsShort: asStr(ad.downloadLabelAbbreviated),
    updatedOn: asStr(ad.infoUpdatedOn),
    versionName: asStr(ad.versionString),
    versionCode,
    size: humanSize(sizeBytes),
    sizeBytes,
    category: asStr(ad.categoryName),
    tags,
    permissions: ((ad.permission ?? []) as unknown[]).map((p) => asStr(p)),
    privacyPolicyUrl: asStr(annotations.privacyPolicyUrl),
    isInstalled: false,
    requiresGMS: depPkgs.includes(GMS_PACKAGE),
    fileList: files,
    testingProgram: testing
      ? { isAvailable: true, isSubscribed: testing.subscribed === true }
      : undefined,
  };
}

export function normalizeCluster(id: number, cluster: Record<string, any>): Record<string, any> {
  return {
    id,
    clusterTitle: asStr(cluster.clusterTitle),
    clusterSubtitle: asStr(cluster.clusterSubtitle) || undefined,
    browseUrl: asStr(cluster.clusterBrowseUrl),
    clusterAppList: ((cluster.clusterAppList ?? []) as Record<string, any>[]).map(normalizeApp),
    hasMore: asStr(cluster.clusterNextPageUrl) !== "",
  };
}

export function normalizeBundle(bundle: Record<string, any>): Record<string, any> {
  const clusters = ((bundle.streamClusters ?? []) as Record<string, any>[]).map((c, i) =>
    normalizeCluster(bundle.id * 1000 + i + 1, c),
  );
  const out: Record<string, number | string | Record<number, unknown>> = {
    id: asNum(bundle.id),
  };
  const map: Record<number, unknown> = {};
  for (const c of clusters) map[(c as { id: number }).id] = c;
  (out as Record<string, unknown>)["streamClusters"] = map;
  return out;
}

export function normalizeReview(pkg: string, r: Record<string, any>): Record<string, any> {
  const profile = (r.userProfile ?? {}) as Record<string, any>;
  const images = ((profile.image ?? []) as Record<string, any>[]);
  const ts = asNum(r.timestamp);
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
  return {
    id: asStr(r.commentId) || `${pkg}-${asStr(r.authorName)}-${ms}`,
    packageName: pkg,
    userName: asStr(profile.name) || asStr(r.authorName) || "A Google user",
    userAvatar: images.find((i) => asNum(i.imageType) === 4)?.imageUrl
      ? asStr(images.find((i) => asNum(i.imageType) === 4)?.imageUrl)
      : undefined,
    title: asStr(r.title),
    comment: asStr(r.comment),
    rating: asNum(r.starRating),
    date: ms ? new Date(ms).toISOString().slice(0, 10) : "",
    likes: asNum(r.helpfulCount),
  };
}

export function normalizeCategory(c: Record<string, any>): Record<string, any> {
  const title = asStr(c.title);
  return {
    id: asStr(c.browseUrl) || title,
    title,
    browseUrl: asStr(c.browseUrl),
    imageUrl: asStr(c.imageUrl) || undefined,
  };
}
