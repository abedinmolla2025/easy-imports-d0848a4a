import { useEffect } from "react";
import { SplashGate } from "@/components/SplashGate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { SeoHead } from "@/components/seo/SeoHead";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import NamesPage from "./pages/NamesPage";
import QiblaPage from "./pages/QiblaPage";
import TasbihPage from "./pages/TasbihPage";
import DuaPage from "./pages/DuaPage";
import DuaDetailPage from "./pages/dua/DuaDetailPage";
import QuranPage from "./pages/QuranPage";
import NamesOfAllahPage from "./pages/NamesOfAllahPage";
import PrayerTimesPage from "./pages/PrayerTimesPage";

import BukhariLanguageSelectPage from "./pages/bukhari/BukhariLanguageSelectPage";
import BukhariLangPage from "./pages/bukhari/BukhariLangPage";
import HadithPage from "./pages/HadithPage";
import HadithBookPlaceholder from "./pages/hadith/HadithBookPlaceholder";
import HadithDetailPage from "./pages/hadith/HadithDetailPage";
import IslamicCalendarPage from "./pages/IslamicCalendarPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import BackendStatusPage from "./pages/BackendStatusPage";
import QuizPage from "./pages/QuizPage";
import PrayerGuidePage from "./pages/PrayerGuidePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminContent from "./pages/admin/AdminContent";
import AdminContentWorkflowPage from "./pages/admin/AdminContentWorkflow";
import AdminAuditPage from "./pages/admin/AdminAudit";
import AdminMonetization from "./pages/admin/AdminMonetization";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminNotificationsHistory from "./pages/admin/AdminNotificationsHistory";
import AdminNotificationsDiagnostics from "./pages/admin/AdminNotificationsDiagnostics";
import AdminOccasions from "./pages/admin/AdminOccasions";
import AdminMedia from "./pages/admin/AdminMedia";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminAds from "./pages/admin/AdminAds";
import AdminLayoutControl from "./pages/admin/AdminLayoutControl";
import AdminSeoPage from "./pages/admin/AdminSeo";
import AdminPageBuilder from "./pages/admin/AdminPageBuilder";
import AdminQuiz from "./pages/admin/AdminQuiz";
import AdminSplashScreens from "./pages/admin/AdminSplashScreens";
import AdminReports from "./pages/admin/AdminReports";
import AdminFinance from "./pages/admin/AdminFinance";

import { AppSettingsProvider } from "./context/AppSettingsContext";
import { AdminProvider } from "./contexts/AdminContext";
import { AdminLayout } from "./components/admin/AdminLayout";
import { GlobalConfigProvider, useGlobalConfig } from "./context/GlobalConfigContext";
import { usePushTokenRegistration } from "@/hooks/usePushTokenRegistration";
import { useWebPushRegistration } from "@/hooks/useWebPushRegistration";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useQuizReminder } from "@/hooks/useQuizReminder";
import { useMobileAdsInit } from "@/hooks/useMobileAds";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import IslamicAppPage from "./pages/IslamicAppPage";
import SitemapPage from "./pages/SitemapPage";
import DownloadPage from "./pages/DownloadPage";
import CookieConsentBanner from "./components/CookieConsentBanner";

const queryClient = new QueryClient();

const AppRoutes = () => {
  usePageTracking();
  return (
  <>
    <SeoHead />
    <AnnouncementTicker />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/baby-names" element={<NamesPage />} />
      <Route path="/names" element={<Navigate to="/baby-names" replace />} />
      <Route path="/qibla" element={<QiblaPage />} />
      <Route path="/tasbih" element={<TasbihPage />} />
      <Route path="/dua" element={<DuaPage />} />
      <Route path="/dua/:slug" element={<DuaDetailPage />} />
      <Route path="/quran" element={<QuranPage />} />
      <Route path="/99-names" element={<NamesOfAllahPage />} />
      <Route path="/prayer-times" element={<PrayerTimesPage />} />

      {/* Hadith routes */}
      <Route path="/hadith" element={<HadithPage />} />
      <Route path="/hadith/sahih-bukhari" element={<BukhariLanguageSelectPage />} />
      <Route path="/hadith/sahih-bukhari/:lang" element={<BukhariLangPage />} />
      <Route path="/hadith/sahih-bukhari/:lang/:chapterSlug" element={<BukhariLangPage />} />
      <Route path="/hadith/sahih-bukhari/:lang/:chapterId/:hadithNumber" element={<BukhariLangPage />} />
      <Route path="/hadith/h/:slug" element={<HadithDetailPage />} />
      <Route path="/hadith/:bookId" element={<HadithBookPlaceholder />} />

      {/* Legacy redirects handled by vercel.json 301s — no React Router duplicates */}

      <Route path="/calendar" element={<IslamicCalendarPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/prayer-guide" element={<PrayerGuidePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/islamic-app" element={<IslamicAppPage />} />
      <Route path="/sitemap" element={<SitemapPage />} />
      <Route path="/download" element={<DownloadPage />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/occasions"
        element={
          <AdminLayout>
            <AdminOccasions />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/content"
        element={
          <AdminLayout>
            <AdminContent />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/content/:id/workflow"
        element={
          <AdminLayout>
            <AdminContentWorkflowPage />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/quiz"
        element={
          <AdminLayout>
            <AdminQuiz />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/ads"
        element={
          <AdminLayout>
            <AdminAds />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminLayout>
            <AdminReports />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/finance"
        element={
          <AdminLayout>
            <AdminFinance />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/monetization"
        element={
          <AdminLayout>
            <AdminMonetization />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/notifications/history"
        element={
          <AdminLayout>
            <AdminNotificationsHistory />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/notifications/diagnostics"
        element={
          <AdminLayout>
            <AdminNotificationsDiagnostics />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/media"
        element={
          <AdminLayout>
            <AdminMedia />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <AdminLayout>
            <AdminAnalytics />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/layout"
        element={
          <AdminLayout>
            <AdminLayoutControl />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/page-builder"
        element={
          <AdminLayout>
            <AdminPageBuilder />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/seo"
        element={
          <AdminLayout>
            <AdminSeoPage />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/splash-screens"
        element={
          <AdminLayout>
            <AdminSplashScreens />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/security"
        element={
          <AdminLayout>
            <AdminSecurity />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/security/backend-status"
        element={
          <AdminLayout>
            <BackendStatusPage />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <AdminLayout>
            <AdminAuditPage />
          </AdminLayout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
  );
};

/** Redirect /sahih-al-bukhari/:lang → /hadith/sahih-bukhari/:lang */
function LegacyLangRedirect() {
  const params = useParams<{ lang: string }>();
  return <Navigate to={`/hadith/sahih-bukhari/${params.lang}`} replace />;
}

const AdSenseLoader = () => {
  const { system } = useGlobalConfig();
  useEffect(() => {
    const pubId = system.adsensePublisherId;
    if (!pubId || !system.showAds) return;
    import("@/lib/adsense").then(({ loadAdSense }) => loadAdSense(pubId));
  }, [system.adsensePublisherId, system.showAds]);
  return null;
};

const AppInner = () => {
  usePushTokenRegistration();
  useWebPushRegistration();
  useQuizReminder();
  useMobileAdsInit();

  return (
    <>
      <AdSenseLoader />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
        <CookieConsentBanner />
      </BrowserRouter>
    </>
  );
};

const App = () => {
  return (
    <SplashGate>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AdminProvider>
            <GlobalConfigProvider>
              <AppSettingsProvider>
                <AppInner />
              </AppSettingsProvider>
            </GlobalConfigProvider>
          </AdminProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </SplashGate>
  );
};

export default App;
