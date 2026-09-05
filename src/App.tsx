import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { Shell } from "./components/shell";
import { TopBar } from "./components/ui";
import { playApi } from "./lib/playApi";
import { Accounts, Dispenser, GoogleLogin, DevProfile } from "./screens/Accounts";
import { AppDetails, ExodusDetails, ManualDownload, PermissionsScreen, Reviews } from "./screens/Details";
import { AppsGames, BrowseList } from "./screens/Home";
import { Downloads, Favourites, Installed, Updates } from "./screens/Library";
import { Search } from "./screens/Search";
import { About, Blacklist, Onboarding, Settings, Spoof } from "./screens/System";

/**
 * Route map — 1:1 with Android `Screen` sealed class (Screen.kt):
 * Splash/Main/Onboarding/Search/AppDetails/DevProfile/PublisherProfile/
 * StreamBrowse/ExpandedStreamBrowse/CategoryBrowse/Downloads/Installed/
 * Favourite/Accounts/GoogleLogin/Spoof/Dispenser/Blacklist/About/Settings*
 */
export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Page chrome={false}><Onboarding /></Page>} />
      <Route path="/" element={<Navigate to="/apps" replace />} />
      <Route path="/apps" element={<Shell><AppsGames pageType={0} /></Shell>} />
      <Route path="/games" element={<Shell><AppsGames pageType={1} /></Shell>} />
      <Route path="/updates" element={<Shell><Updates /></Shell>} />
      <Route path="/search" element={<Shell fab={false}><BackPage title="Search"><Search /></BackPage></Shell>} />
      <Route path="/app/:pkg" element={<Shell fab={false}><BackPage title="App details"><AppDetails /></BackPage></Shell>} />
      <Route path="/app/:pkg/reviews" element={<Shell fab={false}><BackPage title="Reviews"><Reviews /></BackPage></Shell>} />
      <Route path="/app/:pkg/permissions" element={<Shell fab={false}><BackPage title="Permissions"><PermissionsScreen /></BackPage></Shell>} />
      <Route path="/app/:pkg/exodus" element={<Shell fab={false}><BackPage title="Trackers"><ExodusDetails /></BackPage></Shell>} />
      <Route path="/app/:pkg/manual" element={<Shell fab={false}><BackPage title="Manual download"><ManualDownload /></BackPage></Shell>} />
      <Route path="/dev/:devId" element={<Shell><BackPage title="Developer"><DevProfile /></BackPage></Shell>} />
      <Route path="/stream" element={<Shell><StreamPage /></Shell>} />
      <Route path="/category" element={<Shell><CategoryPage /></Shell>} />
      <Route path="/downloads" element={<Shell><BackPage title="Downloads"><Downloads /></BackPage></Shell>} />
      <Route path="/installed" element={<Shell><BackPage title="Installed"><Installed /></BackPage></Shell>} />
      <Route path="/favourites" element={<Shell><BackPage title="Favourites"><Favourites /></BackPage></Shell>} />
      <Route path="/accounts" element={<Shell><BackPage title="Accounts"><Accounts /></BackPage></Shell>} />
      <Route path="/accounts/login" element={<Shell><BackPage title="Google login" back="/accounts"><GoogleLogin /></BackPage></Shell>} />
      <Route path="/spoof" element={<Shell><BackPage title="Spoof manager"><Spoof /></BackPage></Shell>} />
      <Route path="/dispenser" element={<Shell><BackPage title="Dispenser"><Dispenser /></BackPage></Shell>} />
      <Route path="/blacklist" element={<Shell><BackPage title="Blacklist"><Blacklist /></BackPage></Shell>} />
      <Route path="/settings" element={<Shell><BackPage title="Settings"><Settings /></BackPage></Shell>} />
      <Route path="/about" element={<Shell><BackPage title="About"><About /></BackPage></Shell>} />
      <Route path="*" element={<Shell><BackPage title="Not found"><p className="py-16 text-center text-gray-400">Unknown route — <a href="/apps" className="text-emerald-400">go home</a></p></BackPage></Shell>} />
    </Routes>
  );
}

function Page({ children, chrome }: { children: React.ReactNode; chrome?: boolean }) {
  void chrome;
  return <div className="mx-auto min-h-screen max-w-6xl px-4 py-4">{children}</div>;
}

function BackPage({ title, back, children }: { title: string; back?: string; children: React.ReactNode }) {
  const loc = useLocation();
  void loc;
  return (
    <div className="-mx-4 -mt-4">
      <TopBar title={title} back={back ?? "/apps"} />
      <div className="px-4 pt-4">{children}</div>
    </div>
  );
}

function useQuery() {
  const [params] = useSearchParams();
  return { title: params.get("title") ?? "Browse", url: params.get("url") ?? "" };
}

function StreamPage() {
  const { title, url } = useQuery();
  return (
    <BackPage title={title}>
      <BrowseList title={title} fetch={() => playApi.streamBrowse(url)} />
    </BackPage>
  );
}

function CategoryPage() {
  const { title, url } = useQuery();
  return (
    <BackPage title={title}>
      <BrowseList title={title} fetch={() => playApi.categoryApps(url)} />
    </BackPage>
  );
}
