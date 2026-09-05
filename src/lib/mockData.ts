import type {
  Account,
  App,
  AppRating,
  Category,
  DataSafetyReport,
  Download,
  ExodusReport,
  ExodusTracker,
  InstalledApp,
  PlexusScores,
  Review,
  SpoofDevice,
  SpoofLocale,
  StreamBundle,
  StreamCluster,
  Update,
} from "./types";

// Deterministic pseudo-random helper so mock data is stable across reloads.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function ratingFor(pkg: string): AppRating {
  const h = hash(pkg);
  const average = 3.4 + ((h % 160) / 100); // 3.40..4.99
  const count = 500 + (h % 5_000_000);
  const five = 0.55 + ((h % 20) / 100);
  const four = 0.18;
  const three = 0.1;
  const two = 0.05;
  const one = Math.max(0.01, 1 - five - four - three - two);
  return {
    average: Math.round(average * 10) / 10,
    count,
    histogram: [
      Math.round(count * one),
      Math.round(count * two),
      Math.round(count * three),
      Math.round(count * four),
      Math.round(count * five),
    ],
  };
}

function installsFor(pkg: string): { installs: number; short: string } {
  const tiers = [1_000, 10_000, 100_000, 500_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
  const h = hash(pkg);
  const installs = tiers[h % tiers.length];
  const short =
    installs >= 1_000_000_000
      ? `${installs / 1_000_000_000}B+`
      : installs >= 1_000_000
        ? `${installs / 1_000_000}M+`
        : installs >= 1_000
          ? `${installs / 1_000}K+`
          : `${installs}+`;
  return { installs, short };
}

export interface SeedApp {
  pkg: string;
  name: string;
  dev: string;
  category: string;
  isGame?: boolean;
}

export const SEED_APPS: SeedApp[] = [
  { pkg: "org.thoughtcrime.securesms", name: "Signal Private Messenger", dev: "Signal Foundation", category: "Communication" },
  { pkg: "org.telegram.messenger", name: "Telegram", dev: "Telegram FZ-LLC", category: "Communication" },
  { pkg: "com.spotify.music", name: "Spotify: Music and Podcasts", dev: "Spotify AB", category: "Music & Audio", isGame: false },
  { pkg: "com.supercell.clashofclans", name: "Clash of Clans", dev: "Supercell", category: "Strategy", isGame: true },
  { pkg: "com.mojang.minecraftpe", name: "Minecraft", dev: "Mojang", category: "Arcade", isGame: true },
  { pkg: "com.innersloth.spacemafia", name: "Among Us", dev: "Innersloth LLC", category: "Action", isGame: true },
  { pkg: "com.zhiliaoapp.musically", name: "TikTok", dev: "TikTok Pte. Ltd.", category: "Social" },
  { pkg: "com.instagram.android", name: "Instagram", dev: "Meta", category: "Social" },
  { pkg: "com.whatsapp", name: "WhatsApp Messenger", dev: "WhatsApp LLC", category: "Communication" },
  { pkg: "com.google.android.youtube", name: "YouTube", dev: "Google LLC", category: "Video Players" },
  { pkg: "com.netflix.mediaclient", name: "Netflix", dev: "Netflix, Inc.", category: "Entertainment" },
  { pkg: "com.duolingo", name: "Duolingo: Language Lessons", dev: "Duolingo", category: "Education" },
  { pkg: "com.strava", name: "Strava: Run, Bike, Hike", dev: "Strava Inc.", category: "Health & Fitness" },
  { pkg: "com.adobe.lrmobile", name: "Adobe Lightroom", dev: "Adobe Inc.", category: "Photography" },
  { pkg: "org.mozilla.firefox", name: "Firefox Fast & Private Browser", dev: "Mozilla", category: "Communication" },
  { pkg: "com.brave.browser", name: "Brave Private Web Browser", dev: "Brave Software", category: "Communication" },
  { pkg: "app.grapheneos.camera", name: "GrapheneOS Camera", dev: "GrapheneOS", category: "Photography" },
  { pkg: "com.protonvpn.android", name: "Proton VPN: Fast & Secure", dev: "Proton AG", category: "Tools" },
  { pkg: "com.aurora.store", name: "Aurora Store", dev: "Aurora OSS", category: "Tools" },
  { pkg: "com.plexapp.android", name: "Plex: Stream Movies & TV", dev: "Plex, Inc.", category: "Entertainment" },
  { pkg: "com.king.candycrushsaga", name: "Candy Crush Saga", dev: "King", category: "Casual", isGame: true },
  { pkg: "com.roblox.client", name: "Roblox", dev: "Roblox Corporation", category: "Adventure", isGame: true },
  { pkg: "com.pubg.imobile", name: "PUBG MOBILE", dev: "Level Infinite", category: "Action", isGame: true },
  { pkg: "com.nianticlabs.pokemongo", name: "Pokémon GO", dev: "Niantic, Inc.", category: "Adventure", isGame: true },
];

const DESCRIPTIONS: Record<string, string> = {
  default:
    "A fast, privacy-respecting client that lets you browse, search and manage apps from Google Play. This WebUI port mirrors the Aurora Store Android experience: stream clusters, top charts, categories, search with filters, app details with reviews, permissions, data-safety and tracker reports.",
};

export function iconFor(pkg: string, seed = 0): string {
  const h = hash(pkg) + seed;
  const hue = h % 360;
  const initial = pkg.split(".").pop()?.charAt(0).toUpperCase() ?? "A";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},65%,48%)'/><stop offset='1' stop-color='hsl(${(hue + 45) % 360},70%,32%)'/></linearGradient></defs><rect width='128' height='128' rx='28' fill='url(#g)'/><text x='64' y='86' font-size='64' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'>${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function screenshotFor(pkg: string, i: number): string {
  const h = hash(pkg + i);
  const hue = h % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='640'><rect width='360' height='640' rx='24' fill='hsl(${hue},30%,14%)'/><rect x='24' y='48' width='312' height='180' rx='16' fill='hsl(${hue},55%,42%)'/><rect x='24' y='248' width='200' height='20' rx='10' fill='hsl(${hue},20%,70%)'/><rect x='24' y='280' width='312' height='12' rx='6' fill='hsl(${hue},12%,38%)'/><rect x='24' y='302' width='260' height='12' rx='6' fill='hsl(${hue},12%,32%)'/><rect x='24' y='340' width='140' height='40' rx='20' fill='hsl(${(hue + 120) % 360},60%,45%)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function makeApp(seed: SeedApp, index: number): App {
  const { installs, short } = installsFor(seed.pkg);
  const h = hash(seed.pkg);
  const free = h % 9 !== 0;
  const versionCode = 10000 + (h % 90000);
  return {
    id: index + 1,
    packageName: seed.pkg,
    displayName: seed.name,
    developerName: seed.dev,
    developerId: seed.dev.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    developerEmail: `support@${seed.dev.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
    developerWebsite: `https://${seed.dev.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
    developerAddress: "1600 Amphitheatre Parkway, Mountain View, CA",
    shortDescription: `${seed.name} — top rated in ${seed.category}.`,
    description: DESCRIPTIONS.default,
    changes: `• Bug fixes and performance improvements\n• Target SDK bump\n• v${1 + (h % 8)}.${h % 20}.${h % 50} brings a refreshed Material You theme`,
    iconUrl: iconFor(seed.pkg),
    screenshots: [0, 1, 2, 3].map((i) => screenshotFor(seed.pkg, i)),
    price: free ? "" : `$${(h % 5) + 0.99}`,
    isFree: free,
    containsAds: h % 3 === 0,
    inAppPurchases: h % 2 === 0,
    rating: ratingFor(seed.pkg),
    installs,
    installsShort: short,
    updatedOn: "2026-08-12",
    versionName: `${1 + (h % 8)}.${h % 20}.${h % 50}`,
    versionCode,
    size: `${8 + (h % 120)} MB`,
    sizeBytes: (8 + (h % 120)) * 1024 * 1024,
    category: seed.category,
    tags: [seed.category, seed.isGame ? "Games" : "Apps", h % 2 ? "Offline" : "Online", "Material You"],
    permissions: [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.READ_EXTERNAL_STORAGE",
    ].slice(0, 2 + (h % 3)),
    privacyPolicyUrl: "https://example.com/privacy",
    isInstalled: false,
    requiresGMS: h % 4 === 0,
    fileList: [
      { fileType: 0, name: "base.apk", size: 24 * 1024 * 1024, versionCode },
      ...(h % 3 === 0
        ? [{ fileType: 1, name: "split_config.arm64.apk", size: 8 * 1024 * 1024, versionCode }]
        : []),
    ],
    testingProgram: { isAvailable: h % 5 === 0, isSubscribed: false },
  };
}

export const MOCK_APPS: App[] = SEED_APPS.map(makeApp);

export function getApp(pkg: string): App | undefined {
  return MOCK_APPS.find((a) => a.packageName === pkg);
}

function cluster(id: number, title: string, browseUrl: string, apps: App[], subtitle?: string): StreamCluster {
  return { id, clusterTitle: title, clusterSubtitle: subtitle, browseUrl, clusterAppList: apps, hasMore: true };
}

export function homeBundle(pageType: 0 | 1): StreamBundle {
  const pool = MOCK_APPS.filter((a) => {
    const seed = SEED_APPS.find((s) => s.pkg === a.packageName);
    return pageType === 1 ? seed?.isGame : !seed?.isGame;
  });
  const list = pool.length >= 4 ? pool : MOCK_APPS;
  const clusters: StreamCluster[] = [
    cluster(1, pageType === 1 ? "Recommended games" : "Recommended for you", "foryou", list.slice(0, 8), "Based on your interests"),
    cluster(2, "Top charts", "top", [...list].sort((a, b) => b.rating.average - a.rating.average).slice(0, 8)),
    cluster(3, "Trending now", "trending", [...list].reverse().slice(0, 8)),
    cluster(4, "New & updated", "new", list.slice(2, 10)),
  ];
  return { id: pageType, streamClusters: Object.fromEntries(clusters.map((c) => [c.id, c])) };
}

export const MOCK_CATEGORIES: Category[] = [
  "Art & Design", "Auto & Vehicles", "Books & Reference", "Business", "Comics",
  "Communication", "Education", "Entertainment", "Finance", "Health & Fitness",
  "Music & Audio", "Photography", "Social", "Strategy", "Tools",
  "Action", "Adventure", "Arcade", "Casual",
].map((t, i) => ({ id: `cat-${i}`, title: t, browseUrl: `category:${t}` }));

export function reviewsFor(pkg: string): Review[] {
  const h = hash(pkg);
  const names = ["Marta K.", "Devon A.", "Priya S.", "Jonas L.", "Aiko T.", "Sam R."];
  return names.map((n, i) => ({
    id: `${pkg}-r${i}`,
    packageName: pkg,
    userName: n,
    title: ["Great app", "Solid", "Needs polish", "Love it", "Best in class", "Good, few bugs"][i],
    comment: `Been using this daily. v${1 + ((h + i) % 5)} is fast and the new Material You theme looks great. ${i % 2 ? "Battery use is reasonable." : "Wish there were fewer ads."}`,
    rating: 5 - ((h + i) % 3),
    date: `2026-0${1 + ((h + i) % 8)}-1${i}`,
    likes: (h + i * 37) % 900,
  }));
}

const TRACKER_POOL: Array<[string, string[]]> = [
  ["Google Firebase Analytics", ["Analytics"]],
  ["Google CrashLytics", ["Crash reporting"]],
  ["Facebook Login", ["Identification"]],
  ["AppsFlyer", ["Analytics", "Profiling"]],
  ["OneSignal", ["Notification"]],
  ["Mixpanel", ["Analytics"]],
];

export function exodusFor(pkg: string): ExodusReport {
  const h = hash(pkg);
  const count = h % 4;
  const trackers: ExodusTracker[] = Array.from({ length: count }, (_, i) => {
    const [name, categories] = TRACKER_POOL[(h + i) % TRACKER_POOL.length];
    return {
      id: (h + i) % 500,
      name,
      categories,
      description: `${name} is a commonly embedded SDK used for ${categories.join(", ").toLowerCase()}.`,
    };
  });
  const app = getApp(pkg);
  return {
    id: h % 100000,
    packageName: pkg,
    versionName: app?.versionName ?? "1.0.0",
    versionCode: app?.versionCode ?? 1,
    trackers,
  };
}

export function dataSafetyFor(pkg: string): DataSafetyReport {
  const h = hash(pkg);
  return {
    packageName: pkg,
    sharesData: h % 3 !== 0,
    collectsData: true,
    dataShared: h % 3 === 0 ? [] : ["Location", "App activity", "Device IDs"],
    dataCollected: ["Personal info", "App activity", "Performance data"],
    securityPractices: ["Data is encrypted in transit", "You can request data deletion"],
  };
}

export function plexusFor(pkg: string): PlexusScores {
  const h = hash(pkg);
  return { packageName: pkg, microGScore: h % 5, degoogledScore: (h >> 3) % 5 };
}

// ── Installed / updates / downloads / accounts ──────────────────

export const MOCK_INSTALLED: InstalledApp[] = MOCK_APPS.slice(0, 9).map((a, i) => ({
  packageName: a.packageName,
  displayName: a.displayName,
  iconUrl: a.iconUrl,
  versionName: `${parseInt(a.versionName.split(".")[0]) - (i % 2)}.0.0`,
  versionCode: a.versionCode - (i % 2 === 0 ? 120 : 0),
  isSystem: i % 4 === 3,
}));

export function updatesFromInstalled(installed: InstalledApp[]): Update[] {
  const out: Update[] = [];
  for (const ins of installed) {
    const latest = getApp(ins.packageName);
    if (!latest) continue;
    if (latest.versionCode <= ins.versionCode) continue;
    out.push({
      packageName: ins.packageName,
      displayName: ins.displayName,
      iconUrl: ins.iconUrl,
      installedVersionCode: ins.versionCode,
      installedVersionName: ins.versionName,
      updateVersionCode: latest.versionCode,
      updateVersionName: latest.versionName,
      updateSize: latest.size,
      changes: latest.changes,
      ignored: false,
    });
  }
  return out;
}

export const MOCK_DOWNLOADS: Download[] = [
  {
    id: "dl-1",
    packageName: "com.spotify.music",
    displayName: "Spotify: Music and Podcasts",
    iconUrl: iconFor("com.spotify.music"),
    versionName: "9.2.1",
    versionCode: 90210,
    progress: 68,
    state: "DOWNLOADING",
    bytesDone: 68 * 1024 * 1024,
    bytesTotal: 100 * 1024 * 1024,
    startedAt: Date.now() - 1000 * 60 * 2,
  },
  {
    id: "dl-2",
    packageName: "org.thoughtcrime.securesms",
    displayName: "Signal Private Messenger",
    iconUrl: iconFor("org.thoughtcrime.securesms"),
    versionName: "7.4.0",
    versionCode: 70400,
    progress: 100,
    state: "COMPLETED",
    bytesDone: 42 * 1024 * 1024,
    bytesTotal: 42 * 1024 * 1024,
    startedAt: Date.now() - 1000 * 60 * 40,
  },
];

export const MOCK_ACCOUNTS: Account[] = [
  { id: "anon-1", email: "anonymous@auroraoss.com", type: "ANONYMOUS", active: true },
];

export const MOCK_SPOOF_DEVICES: SpoofDevice[] = [
  { id: "pixel8", name: "Pixel 8 Pro", manufacturer: "Google", model: "GC3VE", androidVersion: "14", sdk: 34 },
  { id: "pixel7", name: "Pixel 7", manufacturer: "Google", model: "GVU6C", androidVersion: "14", sdk: 34 },
  { id: "galaxy24", name: "Galaxy S24", manufacturer: "Samsung", model: "SM-S921B", androidVersion: "14", sdk: 34 },
  { id: "oneplus12", name: "OnePlus 12", manufacturer: "OnePlus", model: "CPH2581", androidVersion: "14", sdk: 34 },
  { id: "xperia1", name: "Xperia 1 VI", manufacturer: "Sony", model: "XQ-EC54", androidVersion: "14", sdk: 34 },
];

export const MOCK_LOCALES: SpoofLocale[] = [
  { code: "en-US", name: "English (United States)" },
  { code: "de-DE", name: "Deutsch (Deutschland)" },
  { code: "fr-FR", name: "Français (France)" },
  { code: "es-ES", name: "Español (España)" },
  { code: "ko-KR", name: "한국어 (대한민국)" },
  { code: "ja-JP", name: "日本語 (日本)" },
];

export function suggestionsFor(prefix: string): string[] {
  if (!prefix.trim()) return ["signal", "spotify", "minecraft", "firefox", "telegram"];
  const q = prefix.toLowerCase();
  return MOCK_APPS.map((a) => a.displayName)
    .filter((n) => n.toLowerCase().includes(q))
    .slice(0, 6);
}
