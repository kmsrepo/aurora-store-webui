# Aurora Store · WebUI

Web port of the [Aurora Store](https://gitlab.com/AuroraOSS/AuroraStore) Android app
(`com.aurora.store` v4.8.4) — same navigation graph and screen structure, rebuilt with
**Vite + React + TypeScript + Tailwind + react-router**, plus a **real Google Play
backend** in the same npm project (no Java/Android needed).

## Run

```bash
cd web
npm install
cp .env.example .env        # enables VITE_PLAY_PROXY=http://127.0.0.1:8080
npm run dev:full            # vite (:5173) + Play proxy (:8080) together
```

Single pieces:

```bash
npm run dev                 # frontend only (mock data unless VITE_PLAY_PROXY set)
npm run dev:server          # Play proxy only (tsx watch server/index.ts)
npm run server              # Play proxy once
npm run build               # production frontend bundle in dist/
npm run typecheck:server    # typecheck web/server
```

Without the proxy (no `.env`), the UI runs on an offline mock backend —
every screen works with zero credentials.

## Real Play backend (`web/server/`)

A TypeScript port of `com.auroraoss:gplayapi` 3.6.4 running on Node, in the
same npx frame. Wire behavior (endpoints, headers, params, protobuf
messages) mirrors the Android library exactly:

- **Auth** — anonymous via the token dispenser (`POST` device properties →
  `{email, authToken}`), then real check-in (`AndroidCheckinRequest`
  protobuf), device-config upload and (for Google accounts) AAS →
  OAuth-token exchange. Sessions persist in `~/.aurora-webui/sessions.json`.
- **Browse/search** — Play's public `batchexecute` RPCs (the same
  `Web*Helper` path the Android app uses for home/search/streams, no login
  needed): home, top charts, categories, category pages, search + suggestions,
  related apps, data-safety reports.
- **Authenticated DFE** (protobuf `ResponseWrapper` via `protobufjs` with the
  vendored `GooglePlay.proto` + `AcquireApp.proto`): full app details,
  bulk details (update checks), reviews, purchase (delivery token → file
  list with SHA-1/SHA-256).
- **Real APK download** — `GET /api/download` purchases, then streams Google
  file bytes to the browser with `Range` resume support, re-purchasing once
  on expired (403/410) URLs exactly like `DownloadWorker`. The WebUI
  verifies SHA-256 in-browser before saving.
- **Reports** — Exodus (API key like the app ships, graceful when down),
  Plexus (no auth), data safety.

Verified live: anonymous login → search/details/home/reviews/purchase →
byte-identical APK streaming (`PK\x03\x04`, SHA hashes match delivery data).

CORS is open (`CORS_ORIGIN`, default `*`) so any frontend can use it;
Google download URLs never leave the server (only file bytes stream out).

## Android → Web mapping

| Android (Compose) | WebUI |
|---|---|
| `Screen` sealed class (`compose/navigation/Screen.kt`) | `src/App.tsx` routes (`/apps /games /updates /search /app/:pkg …`) |
| `MainScreen` bottom bar APPS·GAMES·UPDATES + FAB + `MoreSheet` | `components/shell.tsx` (+ live session pill) |
| `AppsGamesScreen` + `ForYouPage` + `TopChartsPage` + `CategoriesPage` | `screens/Home.tsx` (real clusters via proxy) |
| `SearchScreen` + `FilterHeader` | `screens/Search.tsx` (real search) |
| `AppDetailsScreen` + Details/Actions/Tags/Changelog/Screenshots/RatingAndReviews/Testing/Compatibility/Permissions/DataSafety/Privacy/DeveloperDetails | `screens/Details.tsx` (+ Reviews / Permissions / Exodus / ManualDownload, similar-apps, re-login on expiry) |
| `DownloadsScreen` + `DownloadWorker` | `screens/Library.tsx` → `Downloads` (**real** purchase → stream → SHA-verify → save; simulated in mock mode) |
| `InstalledScreen` (PackageManager) | `Library.tsx` → `Installed` |
| `UpdatesScreen` + `UpdateHelper` | `Library.tsx` → `Updates` (live bulk-details check + "Check now" in real mode) |
| Favourites (`FavouriteDao`) | `Library.tsx` → `Favourites` (bulk-resolved in real mode) |
| `AccountsScreen` + `GoogleLogin` + `AuthProvider`/`AuthWorker` | `screens/Accounts.tsx` (real dispenser + AAS-token login, self-healing retry) |
| `SpoofScreen` (Device/Locale) | `System.tsx` → `Spoof` (device profiles px_9a/sm_s25u/mi_a1 ship in `server/devices/`) |
| `Blacklist` (`BlacklistProvider`) | `System.tsx` → `Blacklist` |
| `Settings` + Installation/Network/UI/Notification/Updates/Source/Security preferences | `System.tsx` → `Settings` |
| `Dispenser` | `Accounts.tsx` → `Dispenser` (server uses `DISPENSER_URL`) |
| `AboutScreen` | `System.tsx` → `About` |
| `OnboardingScreen` | `System.tsx` → `Onboarding` |
| `DevProfileScreen` | `Accounts.tsx` → `DevProfile` |
| `StreamBrowse` / `ExpandedStreamBrowse` / `CategoryBrowse` | `Home.tsx` → `BrowseList` via `/stream` + `/category` |
| Room (`Account/Download/Favourite/Update/Tracker`) + Hilt ViewModels | `lib/store.tsx` (localStorage-persisted context + server session + real download pipeline) |
| `gplayapi` helpers (`StreamHelper/SearchContract/AppDetailsHelper/ReviewsHelper`…) | `server/*.ts` (real port) fronted by `lib/playApi.ts` (`MockPlayApi` default, `HttpPlayApi` for the proxy) |
| Coil images / Material3 | `<img>` + Tailwind dark Material-style theme |

## Dropped / rethought (Android-only)

Session/Root/Shizuku/Native installers → browser-saved APKs (sideload manually) ·
microG login → paste an AAS token · AppLock/biometric · `FLAG_SECURE` ·
WorkManager → fetch streams · OBB files download alongside the APK.

## Demo data

Without `VITE_PLAY_PROXY`, `lib/mockData.ts` ships 24 realistic Play-style apps,
clusters, categories, reviews, Exodus tracker reports, DataSafety + Plexus scores,
installed set, updates and downloads — so every screen works offline with zero
credentials.

## License / disclaimer

GPL-3.0 (like Aurora Store; the vendored `server/proto/*.proto` and device
profiles come from the open-source gplayapi project). This client works like a
browser for Google Play using *your* (anonymous or personal) account — it is not
affiliated with, sponsored or authorized by Google. Downloading with throwaway
anonymous accounts and respecting app licences is on you.
