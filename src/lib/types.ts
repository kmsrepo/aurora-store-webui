/**
 * TypeScript mirrors of the Android models.
 *
 * Android sources:
 * - com.aurora.gplayapi.data.models.{App, StreamCluster, StreamBundle, Category, Review, ...}
 *   (via com.auroraoss:gplayapi:3.6.4)
 * - com.aurora.store.data.model.* (State, DownloadStatus, SearchFilter, ...)
 * - com.aurora.store.data.room.* (Account, Download, Favourite, Update, ...)
 */

// ── gplayapi models ──────────────────────────────────────────────

export interface AppRating {
  average: number; // 0..5
  count: number;
  histogram: [number, number, number, number, number]; // 1★..5★
}

export interface AppFile {
  fileType: number;
  name: string;
  size: number;
  versionCode: number;
}

export interface TestingProgram {
  isAvailable: boolean;
  isSubscribed: boolean;
}

export interface App {
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
  bannerUrl?: string;
  screenshots: string[];
  videoUrl?: string;
  price: string;
  isFree: boolean;
  containsAds: boolean;
  inAppPurchases: boolean;
  rating: AppRating;
  installs: number;
  installsShort: string;
  updatedOn: string;
  versionName: string;
  versionCode: number;
  size: string;
  sizeBytes: number;
  category: string;
  tags: string[];
  permissions: string[];
  privacyPolicyUrl: string;
  isInstalled: boolean;
  installedVersionCode?: number;
  isSystem?: boolean;
  requiresGMS: boolean;
  fileList: AppFile[];
  testingProgram?: TestingProgram;
}

export interface StreamCluster {
  id: number;
  clusterTitle: string;
  clusterSubtitle?: string;
  browseUrl: string;
  clusterAppList: App[];
  hasMore: boolean;
}

export interface StreamBundle {
  id: number;
  streamClusters: Record<number, StreamCluster>;
}

export interface Category {
  id: string;
  title: string;
  browseUrl: string;
  imageUrl?: string;
}

export interface Review {
  id: string;
  packageName: string;
  userName: string;
  userAvatar?: string;
  title: string;
  comment: string;
  rating: number;
  date: string;
  likes: number;
  ownReview?: boolean;
}

export interface SearchFilter {
  minRating: number;
  minInstalls: number;
  isFree: boolean;
  noAds: boolean;
  noGMS: boolean;
}

export const EMPTY_FILTER: SearchFilter = {
  minRating: 0,
  minInstalls: 0,
  isFree: false,
  noAds: false,
  noGMS: false,
};

// ── Exodus (privacy trackers) ────────────────────────────────────

export interface ExodusTracker {
  id: number;
  name: string;
  categories: string[];
  description: string;
}

export interface ExodusReport {
  id: number;
  packageName: string;
  versionName: string;
  versionCode: number;
  trackers: ExodusTracker[];
}

// ── Data safety ──────────────────────────────────────────────────

export interface DataSafetyReport {
  packageName: string;
  sharesData: boolean;
  collectsData: boolean;
  dataShared: string[];
  dataCollected: string[];
  securityPractices: string[];
}

// ── Plexus (de-googled compatibility) ────────────────────────────

export interface PlexusScores {
  packageName: string;
  microGScore: number; // 0..4
  degoogledScore: number;
}

// ── Room replacements ────────────────────────────────────────────

export type AccountType = "GOOGLE" | "ANONYMOUS";

export interface Account {
  id: string;
  email: string;
  type: AccountType;
  active: boolean;
}

export type DownloadState =
  | "QUEUED"
  | "DOWNLOADING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Download {
  id: string;
  packageName: string;
  displayName: string;
  iconUrl: string;
  versionName: string;
  versionCode: number;
  progress: number; // 0..100
  state: DownloadState;
  bytesDone: number;
  bytesTotal: number;
  startedAt: number;
  /** Failure reason when state is FAILED. */
  error?: string;
  /** Number of Play files (base + splits + OBBs) in this download. */
  partsTotal?: number;
}

export interface InstalledApp {
  packageName: string;
  displayName: string;
  iconUrl: string;
  versionName: string;
  versionCode: number;
  isSystem: boolean;
}

export interface Update {
  packageName: string;
  displayName: string;
  iconUrl: string;
  installedVersionCode: number;
  installedVersionName: string;
  updateVersionCode: number;
  updateVersionName: string;
  updateSize: string;
  changes: string;
  ignored: boolean;
}

export interface Favourite {
  packageName: string;
  addedAt: number;
}

// ── Spoofing (device + locale) ───────────────────────────────────

export interface SpoofDevice {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdk: number;
}

export interface SpoofLocale {
  code: string;
  name: string;
}

// ── App state machine (mirrors AppState sealed class) ────────────

export type AppState =
  | { kind: "loading" }
  | { kind: "available" }
  | { kind: "installed" }
  | { kind: "updatable" }
  | { kind: "downloading"; progress: number }
  | { kind: "queued" }
  | { kind: "installing" }
  | { kind: "error"; message: string };
