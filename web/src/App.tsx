import { lazy, Suspense } from 'react';
import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Insights from './pages/Insights';
import Login from './pages/Login';
import LoginCMS from './pages/LoginCMS';
import LoginCRMS from './pages/LoginCRMS';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import MarketRibbon from './components/MarketRibbon';
import Breadcrumb from './components/Breadcrumb';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, RequireAuth, RequirePermission } from './cms/auth';
import { CmsProvider } from './cms/store';
import { PortalAuthProvider, RequirePortal } from './portal/auth';
import { CrmsProvider } from './crms/store';
import { PortalBookmarksProvider } from './portal/bookmarks';
import { PortalReportsProvider } from './portal/reports';

// CMS chunks stay out of the public bundle.
const CMSLayout = lazy(() => import('./cms/CMSLayout'));
const Overview = lazy(() => import('./cms/modules/Overview'));
const HomeModule = lazy(() => import('./cms/modules/HomeModule'));
const InsightsModule = lazy(() => import('./cms/modules/InsightsModule'));
const ReportsModule = lazy(() => import('./cms/modules/ReportsModule'));
const ServicesModule = lazy(() => import('./cms/modules/ServicesModule'));
const PeopleModule = lazy(() => import('./cms/modules/PeopleModule'));
const PagesModule = lazy(() => import('./cms/modules/PagesModule'));
const NewsletterModule = lazy(() => import('./cms/modules/NewsletterModule'));
const EmailModule = lazy(() => import('./cms/modules/EmailModule'));
const AccessModule = lazy(() => import('./cms/modules/AccessModule'));
const ClientLogsModule = lazy(() => import('./cms/modules/ClientLogsModule'));
// The signed-in staff member's own page; one module, mounted in both staff shells.
const AccountModule = lazy(() => import('./cms/modules/AccountModule'));
const CareersModule = lazy(() => import('./cms/modules/CareersModule'));
const WatchlistModule = lazy(() => import('./cms/modules/WatchlistModule'));
const MediaModule = lazy(() => import('./cms/modules/MediaModule'));

// The CRMS: a third area, same staff session, Administrator and Analyst only.
const CRMSLayout = lazy(() => import('./crms/CRMSLayout'));
const CrmsDashboard = lazy(() => import('./crms/modules/Dashboard'));
const CrmsInteractions = lazy(() => import('./crms/modules/InteractionsModule'));
const CrmsEvents = lazy(() => import('./crms/modules/EventsModule'));
const CrmsCalendar = lazy(() => import('./crms/modules/CalendarModule'));
const CrmsClients = lazy(() => import('./crms/modules/ClientsModule'));
const CrmsClientContacts = lazy(() => import('./crms/modules/ClientContactsModule'));
const CrmsCorporates = lazy(() => import('./crms/modules/CorporatesModule'));
const CrmsSellside = lazy(() => import('./crms/modules/SellsideModule'));
const CrmsDistribution = lazy(() => import('./crms/modules/DistributionListModule'));
const CrmsReports = lazy(() => import('./crms/modules/ReportsModule'));
const CrmsTicker = lazy(() => import('./crms/modules/TickerSearchModule'));
const CrmsInteractionTypes = lazy(() => import('./crms/modules/InteractionTypesModule'));
const CrmsFormBuilder = lazy(() => import('./crms/modules/FormBuilderModule'));
const CrmsLogs = lazy(() => import('./crms/modules/LogsModule'));
const CrmsMyActivity = lazy(() => import('./crms/modules/MyActivityModule'));
const CrmsHelp = lazy(() => import('./crms/modules/HelpModule'));

// The client portal is its own lazy chunk, gated behind the portal session.
const PortalDashboard = lazy(() => import('./portal/PortalDashboard'));
const PortalAccount = lazy(() => import('./portal/PortalAccount'));

// Standalone pages a client reaches from an emailed onboarding link.
const PortalRegister = lazy(() => import('./pages/PortalRegister'));
const PortalResetPassword = lazy(() => import('./pages/PortalResetPassword'));

// Public pages off the main nav: split so the landing bundle stays lean.
const InsightArticle = lazy(() => import('./pages/InsightArticle'));
const Careers = lazy(() => import('./pages/Careers'));
const NewsletterVerify = lazy(() => import('./pages/NewsletterVerify'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

function PublicFallback() {
  return <div aria-hidden className="min-h-[50vh] bg-paper" />;
}

function PublicLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <MarketRibbon />
      <Navbar />
      <Breadcrumb />
      <main key={location.key} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function CmsFallback() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bone">
      <span className="mono text-[10.5px] uppercase tracking-[0.24em] text-graphite">Loading workspace…</span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PortalAuthProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<Services />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/insights/:slug" element={<Suspense fallback={<PublicFallback />}><InsightArticle /></Suspense>} />
          <Route path="/careers" element={<Suspense fallback={<PublicFallback />}><Careers /></Suspense>} />
          <Route path="/newsletter/verify/:token" element={<Suspense fallback={<PublicFallback />}><NewsletterVerify /></Suspense>} />
          <Route path="/forgot-password" element={<Suspense fallback={<PublicFallback />}><ForgotPassword kind="client" /></Suspense>} />
          <Route path="/forgot-password/staff" element={<Suspense fallback={<PublicFallback />}><ForgotPassword kind="staff" /></Suspense>} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/cms" element={<LoginCMS />} />
          <Route path="/login/crms" element={<LoginCRMS />} />
          <Route path="/contact" element={<Contact />} />
          {/* Catch-all: an unknown public URL still gets the navbar, footer and a way out. */}
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          path="/cms"
          element={
            <RequireAuth>
              <CmsProvider>
                <Suspense fallback={<CmsFallback />}>
                  <CMSLayout />
                </Suspense>
              </CmsProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Suspense fallback={null}><Overview /></Suspense>} />
          <Route path="home" element={<RequirePermission permission="home.manage"><Suspense fallback={null}><HomeModule /></Suspense></RequirePermission>} />
          <Route path="insights" element={<RequirePermission permission="insights.manage"><Suspense fallback={null}><InsightsModule /></Suspense></RequirePermission>} />
          <Route path="reports" element={<RequirePermission permission="reports.manage"><Suspense fallback={null}><ReportsModule /></Suspense></RequirePermission>} />
          <Route path="services" element={<RequirePermission permission="services.manage"><Suspense fallback={null}><ServicesModule /></Suspense></RequirePermission>} />
          <Route path="people" element={<RequirePermission permission="people.manage"><Suspense fallback={null}><PeopleModule /></Suspense></RequirePermission>} />
          <Route path="pages" element={<RequirePermission permission="pages.manage"><Suspense fallback={null}><PagesModule /></Suspense></RequirePermission>} />
          <Route path="newsletter" element={<RequirePermission permission="newsletter.manage"><Suspense fallback={null}><NewsletterModule /></Suspense></RequirePermission>} />
          <Route path="email" element={<RequirePermission permission="email.manage"><Suspense fallback={null}><EmailModule /></Suspense></RequirePermission>} />
          <Route path="access" element={<RequirePermission permission="access.manage"><Suspense fallback={null}><AccessModule /></Suspense></RequirePermission>} />
          <Route path="logs" element={<RequirePermission permission="logs.view"><Suspense fallback={null}><ClientLogsModule /></Suspense></RequirePermission>} />
          <Route path="account" element={<Suspense fallback={null}><AccountModule /></Suspense>} />
          <Route path="careers" element={<RequirePermission permission="careers.manage"><Suspense fallback={null}><CareersModule /></Suspense></RequirePermission>} />
          <Route path="market" element={<RequirePermission permission="market.manage"><Suspense fallback={null}><WatchlistModule /></Suspense></RequirePermission>} />
          <Route path="media" element={<RequirePermission permission="media.manage"><Suspense fallback={null}><MediaModule /></Suspense></RequirePermission>} />
        </Route>

        <Route
          path="/crms"
          element={
            <RequireAuth loginPath="/login/crms">
              <RequirePermission permission="crms.access" fallback="/login/crms">
                <CrmsProvider>
                  <Suspense fallback={<CmsFallback />}>
                    <CRMSLayout />
                  </Suspense>
                </CrmsProvider>
              </RequirePermission>
            </RequireAuth>
          }
        >
          <Route index element={<Suspense fallback={null}><CrmsDashboard /></Suspense>} />
          <Route path="interactions" element={<Suspense fallback={null}><CrmsInteractions /></Suspense>} />
          <Route path="interactions/:id" element={<Suspense fallback={null}><CrmsInteractions /></Suspense>} />
          <Route path="events/calendar" element={<Suspense fallback={null}><CrmsCalendar /></Suspense>} />
          <Route path="events/:type" element={<Suspense fallback={null}><CrmsEvents /></Suspense>} />
          <Route path="events/:type/:id" element={<Suspense fallback={null}><CrmsEvents /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={null}><CrmsClients /></Suspense>} />
          <Route path="clients/:id" element={<Suspense fallback={null}><CrmsClients /></Suspense>} />
          <Route path="client-contacts" element={<Suspense fallback={null}><CrmsClientContacts /></Suspense>} />
          <Route path="client-contacts/:id" element={<Suspense fallback={null}><CrmsClientContacts /></Suspense>} />
          <Route path="corporates" element={<Suspense fallback={null}><CrmsCorporates /></Suspense>} />
          <Route path="sellside-contacts" element={<Suspense fallback={null}><CrmsSellside /></Suspense>} />
          <Route path="distribution-list" element={<Suspense fallback={null}><CrmsDistribution /></Suspense>} />
          <Route path="reports" element={<RequirePermission permission="crms.reports.generate" fallback="/crms"><Suspense fallback={null}><CrmsReports /></Suspense></RequirePermission>} />
          <Route path="ticker-search" element={<Suspense fallback={null}><CrmsTicker /></Suspense>} />
          <Route path="interaction-types" element={<RequirePermission permission="crms.admin" fallback="/crms"><Suspense fallback={null}><CrmsInteractionTypes /></Suspense></RequirePermission>} />
          <Route path="form-builder" element={<RequirePermission permission="crms.admin" fallback="/crms"><Suspense fallback={null}><CrmsFormBuilder /></Suspense></RequirePermission>} />
          <Route path="logs" element={<RequirePermission permission="crms.admin" fallback="/crms"><Suspense fallback={null}><CrmsLogs /></Suspense></RequirePermission>} />
          <Route path="my-activity" element={<Suspense fallback={null}><CrmsMyActivity /></Suspense>} />
          <Route path="help" element={<Suspense fallback={null}><CrmsHelp /></Suspense>} />
          <Route path="account" element={<Suspense fallback={null}><AccountModule /></Suspense>} />
        </Route>

        <Route
          path="/portal/register/:token"
          element={<Suspense fallback={<CmsFallback />}><PortalRegister /></Suspense>}
        />
        <Route
          path="/portal/reset/:token"
          element={<Suspense fallback={<CmsFallback />}><PortalResetPassword /></Suspense>}
        />
        {/* Staff reset links land on the same page; it reads `kind` from the API. */}
        <Route
          path="/cms/reset/:token"
          element={<Suspense fallback={<CmsFallback />}><PortalResetPassword /></Suspense>}
        />

        <Route
          path="/portal"
          element={
            <RequirePortal>
              <PortalReportsProvider>
                <PortalBookmarksProvider>
                  <Suspense fallback={<CmsFallback />}>
                    <PortalDashboard />
                  </Suspense>
                </PortalBookmarksProvider>
              </PortalReportsProvider>
            </RequirePortal>
          }
        />
        <Route
          path="/portal/account"
          element={
            <RequirePortal>
              <PortalReportsProvider>
                <PortalBookmarksProvider>
                  <Suspense fallback={<CmsFallback />}>
                    <PortalAccount />
                  </Suspense>
                </PortalBookmarksProvider>
              </PortalReportsProvider>
            </RequirePortal>
          }
        />
      </Routes>
      </PortalAuthProvider>
    </AuthProvider>
  );
}
