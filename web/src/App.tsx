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
import MarketRibbon from './components/MarketRibbon';
import Breadcrumb from './components/Breadcrumb';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, RequireAuth, RequirePermission } from './cms/auth';
import { CmsProvider } from './cms/store';
import { PortalAuthProvider, RequirePortal } from './portal/auth';
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

// The client portal is its own lazy chunk, gated behind the portal session.
const PortalDashboard = lazy(() => import('./portal/PortalDashboard'));

// Standalone pages a client reaches from an emailed onboarding link.
const PortalRegister = lazy(() => import('./pages/PortalRegister'));
const PortalResetPassword = lazy(() => import('./pages/PortalResetPassword'));

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
          <Route path="/login" element={<Login />} />
          <Route path="/login/cms" element={<LoginCMS />} />
          <Route path="/login/crms" element={<LoginCRMS />} />
          <Route path="/contact" element={<Contact />} />
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
        </Route>

        <Route
          path="/portal/register/:token"
          element={<Suspense fallback={<CmsFallback />}><PortalRegister /></Suspense>}
        />
        <Route
          path="/portal/reset/:token"
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
      </Routes>
      </PortalAuthProvider>
    </AuthProvider>
  );
}
