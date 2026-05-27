import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useAgentRolesStore } from '@/store/agentRolesStore';
import { Loader } from '@/components/common/Loader';

// Layouts (keep static — needed for every route)
import MainLayout from '@/components/layout/MainLayout';
import PublicLayout from '@/components/layout/PublicLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import KioskLayout from '@/components/layout/KioskLayout';
import SuperAdminLayout from '@/components/layout/SuperAdminLayout';
import AuthGuard from '@/components/auth/AuthGuard';

// Lazy loading wrapper
const L = (fn: () => Promise<{ default: React.ComponentType }>) => {
  const Component = lazy(fn);
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader /></div>}>
      <Component />
    </Suspense>
  );
};

// ── Auth (small, load fast) ──
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const AcceptInvitePage = lazy(() => import('@/pages/auth/AcceptInvitePage'));
const SelectCompanyPage = lazy(() => import('@/pages/auth/SelectCompanyPage'));

// ── Setup ──
const SetupWizardPage = lazy(() => import('@/pages/setup/SetupWizardPage'));
const OnboardingWizardPage = lazy(() => import('@/pages/setup/OnboardingWizardPage'));
const SetupGuidePage = lazy(() => import('@/pages/SetupGuidePage'));

// ── Core ──
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ChatPage = lazy(() => import('@/pages/AIChatPage'));
// DataManagementPage: accessed via /agents/knowledge dashboard
const FaceDirectoryPage = lazy(() => import('@/pages/FaceDirectoryPage'));
const VisionSettingsPage = lazy(() => import('@/pages/VisionSettingsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const ConnectorsPage = lazy(() => import('@/pages/ConnectorsPage'));
const AgentMonitorPage = lazy(() => import('@/pages/AgentMonitorPage'));
const AgentDetailPage = lazy(() => import('@/pages/AgentDetailPage'));
const InsightsPage = lazy(() => import('@/pages/InsightsPage'));
const CommunicationsRedesignPage = lazy(() => import('@/pages/comms/CommunicationsRedesignPage'));
const FaceRegisterPage = lazy(() => import('@/pages/faces/FaceRegisterPage'));

// ── Settings ──
const UserSettingsPage = lazy(() => import('@/pages/settings/UserSettingsPage'));
const ProfilePage = lazy(() => import('@/pages/settings/ProfilePage'));
const NotificationSettingsPage = lazy(() => import('@/pages/settings/NotificationSettingsPage'));

// ── Meetings ──
const MeetingsListPage = lazy(() => import('@/pages/meetings/MeetingsListPage'));
const MeetingRoomPage = lazy(() => import('@/pages/meetings/MeetingRoomPage'));
const MeetingSummaryPage = lazy(() => import('@/pages/meetings/MeetingSummaryPage'));
const MeetingProPage = lazy(() => import('@/pages/meetings/MeetingProPage'));

// ── Knowledge Hub ──
// KnowledgeHubPage: accessed via /agents/knowledge dashboard

// ── Reception ──
const ReceptionRedesignPage = lazy(() => import('@/pages/reception/ReceptionRedesignPage'));
const BookVisitPage = lazy(() => import('@/pages/public/BookVisitPage'));
const PublicShopPage = lazy(() => import('@/pages/public/PublicShopPage'));
const PublicMenuPage = lazy(() => import('@/pages/public/PublicMenuPage'));
const PublicHotelPage = lazy(() => import('@/pages/public/PublicHotelPage'));
const PublicSalonPage = lazy(() => import('@/pages/public/PublicSalonPage'));
const PublicHealthPage = lazy(() => import('@/pages/public/PublicHealthPage'));
const PublicRealEstatePage = lazy(() => import('@/pages/public/PublicRealEstatePage'));
const PublicResidencePage = lazy(() => import('@/pages/public/PublicResidencePage'));
const BusinessHubPage = lazy(() => import('@/pages/public/BusinessHubPage'));
const CloneChatPage = lazy(() => import('@/pages/public/CloneChatPage'));
const CloneVoicePage = lazy(() => import('@/pages/public/CloneVoicePage'));
const MyStatusPage = lazy(() => import('@/pages/public/MyStatusPage'));
const WhatsAppLandingPage = lazy(() => import('@/pages/public/WhatsAppLandingPage'));
const TelegramLandingPage = lazy(() => import('@/pages/public/TelegramLandingPage'));
const TalentsLandingPage = lazy(() => import('@/pages/talents/TalentsLandingPage'));
const TalentsFeedPage = lazy(() => import('@/pages/talents/TalentsFeedPage'));
const TalentsProfilePage = lazy(() => import('@/pages/talents/TalentsProfilePage'));
const TalentsInboxPage = lazy(() => import('@/pages/talents/TalentsInboxPage'));
const TalentsSignupPage = lazy(() => import('@/pages/talents/TalentsSignupPage'));
const TalentsMyProfilePage = lazy(() => import('@/pages/talents/TalentsMyProfilePage'));
const InfluencersLandingPage = lazy(() => import('@/pages/influencers/InfluencersLandingPage'));
const InfluencersFeedPage = lazy(() => import('@/pages/influencers/InfluencersFeedPage'));
const InfluencersProfilePage = lazy(() => import('@/pages/influencers/InfluencersProfilePage'));
const InfluencersSignupPage = lazy(() => import('@/pages/influencers/InfluencersSignupPage'));
const InfluencersLinksPage = lazy(() => import('@/pages/influencers/InfluencersLinksPage'));
const InfluencersInboxPage = lazy(() => import('@/pages/influencers/InfluencersInboxPage'));
const InfluencersMyProfilePage = lazy(() => import('@/pages/influencers/InfluencersMyProfilePage'));
const ApiKeysPage = lazy(() => import('@/pages/settings/ApiKeysPage'));
const CloneSetupPage = lazy(() => import('@/pages/admin/CloneSetupPage'));
const CloneInboxPage = lazy(() => import('@/pages/admin/CloneInboxPage'));

// ── HR ──
const HRRedesignPage = lazy(() => import('@/pages/hr/HRRedesignPage'));
const WorkflowRedesignPage = lazy(() => import('@/pages/workflow/WorkflowRedesignPage'));
const DataScientistRedesignPage = lazy(() => import('@/pages/datascientist/DataScientistRedesignPage'));
const KoraPage = lazy(() => import('@/pages/kora/KoraPage'));

// ── Finance ──
const FinanceRedesignPage = lazy(() => import('@/pages/finance/FinanceRedesignPage'));

// ── Commerce / Boutique WhatsApp ──
const BoutiqueRedesignPage = lazy(() => import('@/pages/commerce/BoutiqueRedesignPage'));
const RestaurantRedesignPage = lazy(() => import('@/pages/restaurant/RestaurantRedesignPage'));
const HotelRedesignPage = lazy(() => import('@/pages/hotel/HotelRedesignPage'));
const ServiceRedesignPage = lazy(() => import('@/pages/service/ServiceRedesignPage'));
const CabinetRedesignPage = lazy(() => import('@/pages/cabinet/CabinetRedesignPage'));
const RealEstateRedesignPage = lazy(() => import('@/pages/realestate/RealEstateRedesignPage'));
const ResidenceRedesignPage = lazy(() => import('@/pages/residence/ResidenceRedesignPage'));
const PMEHubPage = lazy(() => import('@/pages/pme/PMEHubPage'));
const SantePack       = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.SantePack })));
const ArtisanPack     = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.ArtisanPack })));
const AgriculturePack = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.AgriculturePack })));
const SecuriteTotPack = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.SecuriteTotPack })));
const SecuriteSitePack= lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.SecuriteSitePack })));
const ModePack        = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.ModePack })));
const EducationPack   = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.EducationPack })));
const SuperPack       = lazy(() => import('@/pages/bundles/BundleHubPage').then(m => ({ default: m.SuperPack })));
const EnterpriseHubPage = lazy(() => import('@/pages/enterprise/EnterpriseHubPage'));
const MultiPackHomePage = lazy(() => import('@/pages/MultiPackHomePage'));

// ── Sales ──
const SalesDashboardPage = lazy(() => import('@/pages/sales/SalesDashboardPage'));
const SalesProPage = lazy(() => import('@/pages/sales/SalesProPage'));
const SalesForecastPage = lazy(() => import('@/pages/sales/SalesForecastPage'));
const SalesPipelinePage = lazy(() => import('@/pages/sales/SalesPipelinePage'));
const SalesLeadsPage = lazy(() => import('@/pages/sales/SalesLeadsPage'));
const LeadDetailPage = lazy(() => import('@/pages/sales/LeadDetailPage'));
const QuotesPage = lazy(() => import('@/pages/sales/QuotesPage'));
const SalesClientsPage = lazy(() => import('@/pages/sales/SalesClientsPage'));
const SalesFollowupsPage = lazy(() => import('@/pages/sales/SalesFollowupsPage'));
const SalesAuditLogPage = lazy(() => import('@/pages/sales/SalesAuditLogPage'));
const SalesInvoicesPage = lazy(() => import('@/pages/sales/SalesInvoicesPage'));
const SalesActivitiesPage = lazy(() => import('@/pages/sales/SalesActivitiesPage'));
const SalesReportsPage = lazy(() => import('@/pages/sales/SalesReportsPage'));
const SalesAIChatPage = lazy(() => import('@/pages/sales/SalesAIChatPage'));

// ── Support ──
const SupportCenterPage = lazy(() => import('@/pages/support/SupportCenterPage'));
const SupportProPage = lazy(() => import('@/pages/support/SupportProPage'));
const TicketDetailPage = lazy(() => import('@/pages/support/TicketDetailPage'));
const KnowledgeBasePage = lazy(() => import('@/pages/support/KnowledgeBasePage'));

// ── IT ──
const ITDashboardPage = lazy(() => import('@/pages/it/ITDashboardPage'));
const ITProPage = lazy(() => import('@/pages/it/ITProPage'));
const ITAssetsPage = lazy(() => import('@/pages/it/ITAssetsPage'));
const ITTicketsPage = lazy(() => import('@/pages/it/ITTicketsPage'));
const ITLicensesPage = lazy(() => import('@/pages/it/ITLicensesPage'));

// ── Security ──
const SecurityDashboardPage = lazy(() => import('@/pages/SecurityDashboardPage'));
const SecurityIncidentsPage = lazy(() => import('@/pages/SecurityIncidentsPage'));
const VulnerabilitiesPage = lazy(() => import('@/pages/security/VulnerabilitiesPage'));
const PhishingPage = lazy(() => import('@/pages/security/PhishingPage'));
const CompliancePage = lazy(() => import('@/pages/security/CompliancePage'));
const PoliciesPage = lazy(() => import('@/pages/security/PoliciesPage'));
const AccessReviewPage = lazy(() => import('@/pages/security/AccessReviewPage'));
const SecurityAuditLogsPage = lazy(() => import('@/pages/security/AuditLogsPage'));

// ── Marketing ──
const MarketingRedesignPage = lazy(() => import('@/pages/marketing/MarketingRedesignPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));

// ── Training ──
const LearningCenterPage = lazy(() => import('@/pages/training/LearningCenterPage'));
const CoursePage = lazy(() => import('@/pages/training/CoursePage'));
const QuizPage = lazy(() => import('@/pages/training/QuizPage'));
const CourseManagerPage = lazy(() => import('@/pages/training/CourseManagerPage'));

// ── Contracts / Legal — unified into LegalRedesignPage ──
const LegalRedesignPage = lazy(() => import('@/pages/legal/LegalRedesignPage'));
const ContractSignPage = lazy(() => import('@/pages/ContractSignPage'));
const DocumentUploadPublicPage = lazy(() => import('@/pages/DocumentUploadPublicPage'));

// ── Legal (bilingual FR/EN public pages) ──
const TermsPage = lazy(() => import('@/pages/public/LegalPages').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/public/LegalPages').then(m => ({ default: m.PrivacyPage })));
const LegalNoticePage = lazy(() => import('@/pages/public/LegalPages').then(m => ({ default: m.LegalNoticePage })));
const DataDeletionPage = lazy(() => import('@/pages/public/DataDeletionPage'));

// ── Commercial ──
const CommercialPage = lazy(() => import('@/pages/CommercialPage'));
const VoiceOnlyPage = lazy(() => import('@/pages/VoiceOnlyPage'));
const SupportWidgetPage = lazy(() => import('@/pages/SupportWidgetPage'));

// ── Admin ──
const CompanySettingsPage = lazy(() => import('@/pages/admin/CompanySettingsPage'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const InviteUserPage = lazy(() => import('@/pages/admin/InviteUserPage'));
const RolesPermissionsPage = lazy(() => import('@/pages/admin/RolesPermissionsPage'));
const AgentPermissionsPage = lazy(() => import('@/pages/admin/AgentPermissionsPage'));
const AgentConfigPage = lazy(() => import('@/pages/admin/AgentConfigPage'));
const AgentIntelligencePage = lazy(() => import('@/pages/admin/AgentIntelligencePage'));
const SkillsManagerPage = lazy(() => import('@/pages/admin/SkillsManagerPage'));
const MCPConnectionsPage = lazy(() => import('@/pages/admin/MCPConnectionsPage'));
const APIKeysPage = lazy(() => import('@/pages/admin/APIKeysPage'));
const SecuritySettingsPage = lazy(() => import('@/pages/admin/SecuritySettingsPage'));
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'));
const OrchestratorDashboardPage = lazy(() => import('@/pages/admin/OrchestratorDashboardPage'));

// ── News/Veille ──
const NewsDashboardPage = lazy(() => import('@/pages/news/NewsDashboardPage'));
const CompetitorTrackerPage = lazy(() => import('@/pages/news/CompetitorTrackerPage'));
const RGPDCenterPage = lazy(() => import('@/pages/admin/RGPDCenterPage'));
const BillingPage = lazy(() => import('@/pages/admin/BillingPage'));
const BrainPage = lazy(() => import('@/pages/admin/BrainPage'));
const DomainPage = lazy(() => import('@/pages/admin/DomainPage'));
const StudioPage = lazy(() => import('@/pages/studio/StudioPage'));
const ContractsPage = lazy(() => import('@/pages/admin/ContractsPage'));
const ByoeSetupPage = lazy(() => import('@/pages/admin/ByoeSetupPage'));
const PlansPage = lazy(() => import('@/pages/admin/PlansPage'));
const PlanAgentPickerPage = lazy(() => import('@/pages/admin/PlanAgentPickerPage'));
const MyAgentsPage = lazy(() => import('@/pages/MyAgentsPage'));
const AgentMarketplacePage = lazy(() => import('@/pages/marketplace/MarketplaceRedesignPage'));
const AgentWorkspacePage = lazy(() => import('@/pages/agent/AgentWorkspacePage'));
const BuiltInAgentDashboardPage = lazy(() => import('@/pages/agent/BuiltInAgentDashboardPage'));
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'));
const TeamPage = lazy(() => import('@/pages/team/TeamRedesignPage'));
const MarketplaceAnalyticsPage = lazy(() => import('@/pages/admin/MarketplaceAnalyticsPage'));
const CreatorDashboardPage = lazy(() => import('@/pages/creator/CreatorPortalRedesignPage'));
const AgentBuilderPage = lazy(() => import('@/pages/creator/AgentBuilderPage'));
const CreatorRegisterPage = lazy(() => import('@/pages/creator/CreatorRegisterPage'));
const UsageStatsPage = lazy(() => import('@/pages/admin/UsageStatsPage'));
const PublicAPIDashboardPage = lazy(() => import('@/pages/admin/PublicAPIDashboardPage'));
const APIDocsPage = lazy(() => import('@/pages/admin/APIDocsPage'));
const WebhooksPage = lazy(() => import('@/pages/admin/WebhooksPage'));
const DangerZonePage = lazy(() => import('@/pages/admin/DangerZonePage'));
const WhatsAppPage = lazy(() => import('@/pages/admin/WhatsAppConfigPage'));
const InboxPage = lazy(() => import('@/pages/admin/InboxPage'));
const WhatsAppLeadsPage = lazy(() => import('@/pages/admin/WhatsAppLeadsPage'));
const WhatsAppTemplatesPage = lazy(() => import('@/pages/admin/WhatsAppTemplatesPage'));
const WhatsAppBroadcastsPage = lazy(() => import('@/pages/admin/WhatsAppBroadcastsPage'));
const WhatsAppAutoBroadcastsPage = lazy(() => import('@/pages/admin/WhatsAppAutoBroadcastsPage'));
const WhatsAppCatalogPage = lazy(() => import('@/pages/admin/WhatsAppCatalogPage'));
const WhatsAppAdsPage = lazy(() => import('@/pages/admin/WhatsAppAdsPage'));
const MetaAdsConfigPage = lazy(() => import('@/pages/admin/MetaAdsConfigPage'));
const TelegramPage = lazy(() => import('@/pages/admin/TelegramConfigPage'));
const AppointmentsAdminPage = lazy(() => import('@/pages/admin/AppointmentsAdminPage'));
const ReservationsAdminPage = lazy(() => import('@/pages/admin/ReservationsAdminPage'));
const ShopAdminPage = lazy(() => import('@/pages/admin/ShopAdminPage'));
const CloneAnalyticsPage = lazy(() => import('@/pages/admin/CloneAnalyticsPage'));
const ServiceAssignmentsPage = lazy(() => import('@/pages/admin/ServiceAssignmentsPage'));
const VoicePermissionsPage = lazy(() => import('@/pages/admin/VoicePermissionsPage'));
const AzureSettingsPage = lazy(() => import('@/pages/admin/AzureSettingsPage'));
const WidgetSettingsPage = lazy(() => import('@/pages/admin/WidgetSettingsPage'));
const WebsiteEditorPage = lazy(() => import('@/pages/WebsiteEditorPage'));
const WebsiteBuilderRedesignPage = lazy(() => import('@/pages/website/WebsiteBuilderRedesignPage'));
const SocialNetworksPage = lazy(() => import('@/pages/admin/SocialNetworksPage'));
const SocialComposerPage = lazy(() => import('@/pages/admin/SocialComposerPage'));
const SocialPostsPage = lazy(() => import('@/pages/admin/SocialPostsPage'));
const VideoStudioPage = lazy(() => import('@/pages/admin/VideoStudioPage'));

// ── 3D Demo ──
const Demo3DPage = lazy(() => import('@/pages/Demo3DPage'));
const FirebaseConnect3DPage = lazy(() => import('@/pages/FirebaseConnect3DPage'));

// ── Kiosk ──
const KioskWelcomePage = lazy(() => import('@/pages/kiosk/KioskWelcomePage'));
const KioskCheckInPage = lazy(() => import('@/pages/kiosk/KioskCheckInPage'));
const KioskBadgePage = lazy(() => import('@/pages/kiosk/KioskBadgePage'));
const KioskCodePage = lazy(() => import('@/pages/kiosk/KioskCodePage'));
const AgentKioskPage = lazy(() => import('@/pages/kiosk/AgentKioskPage'));

// ── Landing ──
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LandingV2Page = lazy(() => import('@/pages/LandingV2Page'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));

// ── Super Admin ──
const CompaniesListPage = lazy(() => import('@/pages/superadmin/CompaniesListPage'));
const CompaniesMembersPage = lazy(() => import('@/pages/superadmin/CompaniesMembersPage'));
const CompanyDetailPage = lazy(() => import('@/pages/superadmin/CompanyDetailPage'));
const PlatformAnalyticsPage = lazy(() => import('@/pages/superadmin/PlatformAnalyticsPage'));
const PlatformSupportPage = lazy(() => import('@/pages/superadmin/PlatformSupportPage'));
const DeploymentsPage = lazy(() => import('@/pages/superadmin/DeploymentsPage'));
const SAUsersPage = lazy(() => import('@/pages/superadmin/UsersPage'));
const SAPaymentsPage = lazy(() => import('@/pages/superadmin/PaymentsPage'));
const SAPlatformSettingsPage = lazy(() => import('@/pages/superadmin/PlatformSettingsPage'));
const SAMarketplacePage = lazy(() => import('@/pages/superadmin/MarketplaceAdminPage'));
const SAInfluencersPage = lazy(() => import('@/pages/superadmin/InfluencersAdminPage'));
const SATalentsPage = lazy(() => import('@/pages/superadmin/TalentsAdminPage'));
const SAMarketplaceStudioPage = lazy(() => import('@/pages/superadmin/MarketplaceStudioPage'));
const SALandingEditorPage = lazy(() => import('@/pages/superadmin/LandingEditorPage'));
const SAHealthPage = lazy(() => import('@/pages/superadmin/SystemHealthPage'));
const SAPlatformMCPCatalogPage = lazy(() => import('@/pages/superadmin/PlatformMCPCatalogPage'));
const SAPacksPage = lazy(() => import('@/pages/superadmin/PacksPage'));

// ── Other ──
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ReferralPage = lazy(() => import('@/pages/ReferralPage'));
const SiteRendererPage = lazy(() => import('@/pages/SiteRendererPage'));
const AgentSEOPage = lazy(() => import('@/pages/seo/AgentSEOPage'));

export default function App() {
  const { setUser, setCompany, setLoading, isLoading } = useAuthStore();
  const loadAgentRoles = useAgentRolesStore(s => s.load);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        // Base user from Firebase Auth (always available even without Firestore)
        const baseUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? null,
          companyId: '',
          role: 'admin' as const,   // default to admin in dev — override by Firestore in prod
          createdAt: new Date(),
        };

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();
          const isSuperAdmin = userData?.superAdmin === true;
          console.log('[Auth] uid:', firebaseUser.uid, 'docExists:', userDoc.exists(), 'userData:', JSON.stringify(userData), 'superAdmin:', userData?.superAdmin, '→', isSuperAdmin);
          setUser({
            ...baseUser,
            displayName: firebaseUser.displayName ?? userData?.displayName ?? '',
            photoURL: firebaseUser.photoURL ?? userData?.photoURL ?? null,
            companyId: userData?.companyId ?? '',
            role: userData?.role ?? 'admin',
            superAdmin: isSuperAdmin,
            createdAt: userData?.createdAt?.toDate() ?? new Date(),
          });

          if (userData?.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Parameters<typeof setCompany>[0]);
            }
          }

          // Load per-agent RBAC for this user (sidebar/pages read from this store)
          loadAgentRoles().catch(() => {});
        } catch (err) {
          console.warn('Firestore unavailable — using Firebase Auth data only:', err);
          setUser(baseUser);
        }
      } else {
        setUser(null);
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setCompany, setLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader size="lg" />
      </div>
    );
  }

  /** "/" → Show the new About-style landing (BYOE positioning, $20/pack, DemoReel). */
  function RootRedirect() {
    return <AboutPage />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader /></div>}>
      <Routes>
        {/* ── Landing (public, no layout) ── */}
        <Route path="/landing" element={<AboutPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<LandingPage />} />
        <Route path="/v2" element={<LandingV2Page />} />
        <Route path="/" element={<RootRedirect />} />

        {/* ── Standalone public pages (no layout wrapper) ──────────── */}
        <Route path="/business/:companyId" element={<BusinessHubPage />} />
        <Route path="/clone/:companyId" element={<CloneChatPage />} />
        <Route path="/clone/:companyId/voice" element={<CloneVoicePage />} />
        <Route path="/my/:token" element={<MyStatusPage />} />
        <Route path="/book/:companyId" element={<BookVisitPage />} />
        <Route path="/shop/:slug" element={<PublicShopPage />} />
        <Route path="/menu/:slug" element={<PublicMenuPage />} />
        <Route path="/hotel/:slug" element={<PublicHotelPage />} />
        <Route path="/salon/:slug" element={<PublicSalonPage />} />
        <Route path="/cabinet/:slug" element={<PublicHealthPage />} />
        <Route path="/biens/:slug" element={<PublicRealEstatePage />} />
        <Route path="/residence/:slug" element={<PublicResidencePage />} />
        <Route path="/residences/:slug" element={<PublicResidencePage />} />
        <Route path="/shop/:companyId/:storeId" element={<PublicShopPage />} />

        {/* ── Channel landing pages (marketing) ──────────────────────── */}
        <Route path="/whatsapp" element={<WhatsAppLandingPage />} />
        <Route path="/telegram" element={<TelegramLandingPage />} />

        {/* ── Orlode Talents (separate product, same Firebase backend) ─ */}
        <Route path="/talents" element={<TalentsLandingPage />} />
        <Route path="/talents/feed" element={<TalentsFeedPage />} />
        <Route path="/talents/inbox" element={<TalentsInboxPage />} />
        <Route path="/talents/inscription" element={<TalentsSignupPage />} />
        <Route path="/talents/mon-profil" element={<TalentsMyProfilePage />} />
        <Route path="/talents/:id" element={<TalentsProfilePage />} />

        {/* ── Orlode Influenceurs (same Firebase, brand-creator marketplace) ─ */}
        <Route path="/influenceurs" element={<InfluencersLandingPage />} />
        <Route path="/influenceurs/feed" element={<InfluencersFeedPage />} />
        <Route path="/influenceurs/inscription" element={<InfluencersSignupPage />} />
        <Route path="/influenceurs/mes-liens" element={<InfluencersLinksPage />} />
        <Route path="/influenceurs/inbox" element={<InfluencersInboxPage />} />
        <Route path="/influenceurs/mon-profil" element={<InfluencersMyProfilePage />} />
        <Route path="/influenceurs/:id" element={<InfluencersProfilePage />} />

        {/* ── Public / Auth ─────────────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/select-company" element={<SelectCompanyPage />} />
        </Route>

        {/* ── Setup (authenticated, no company required) ─────────────── */}
        <Route element={<AuthGuard />}>
          <Route path="/setup" element={<SetupWizardPage />} />
          <Route path="/setup-guide" element={<SetupGuidePage />} />
          <Route path="/onboarding" element={<OnboardingWizardPage />} />
        </Route>

        {/* ── 3D Demo ──────────────────────────────────────────────── */}
        <Route path="/demo-3d" element={<Demo3DPage />} />
        <Route path="/docs/firebase-3d" element={<FirebaseConnect3DPage />} />

        {/* ── Kiosk (no auth required) ───────────────────────────────── */}
        <Route element={<KioskLayout />}>
          <Route path="/kiosk" element={<KioskWelcomePage />} />
          <Route path="/kiosk/checkin" element={<KioskCheckInPage />} />
          <Route path="/kiosk/badge" element={<KioskBadgePage />} />
          <Route path="/kiosk/code" element={<KioskCodePage />} />
          <Route path="/kiosk/:agentId" element={<AgentKioskPage />} />
        </Route>

        {/* ── Voice & Embed & Public signing (standalone) ──────────────── */}
        <Route path="/voice" element={<VoiceOnlyPage />} />
        <Route path="/embed/support" element={<SupportWidgetPage />} />
        <Route path="/sign/:uniqueLink" element={<ContractSignPage />} />
        <Route path="/upload/:token" element={<DocumentUploadPublicPage />} />

        {/* ── Legal pages (bilingual FR/EN) ──────────────────────────── */}
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/notice" element={<LegalNoticePage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />

        {/* ── Main App ───────────────────────────────────────────────── */}
        <Route element={<AuthGuard requireCompany />}>
          <Route element={<MainLayout />}>
            {/* NO index route here — `/` is reserved for the public landing above. */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="knowledge" element={<Navigate to="/agents/knowledge" replace />} />
            <Route path="data" element={<Navigate to="/agents/knowledge" replace />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="connectors" element={<Navigate to="/admin/connectors" replace />} />
            <Route path="admin/connectors" element={<ConnectorsPage />} />

            {/* Agents */}
            <Route path="agents" element={<AgentMonitorPage />} />
            <Route path="agents/:agentId" element={<BuiltInAgentDashboardPage />} />

            {/* Settings */}
            <Route path="settings" element={<UserSettingsPage />}>
              <Route index element={<ProfilePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationSettingsPage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
            </Route>

            {/* Meetings — MeetingProPage est le hub redesigné (4 onglets : Live / Meetings / Detail / Chat) */}
            <Route path="meetings" element={<MeetingProPage />} />
            <Route path="meetings/list" element={<MeetingsListPage />} />
            <Route path="meetings/:id" element={<MeetingRoomPage />} />
            <Route path="meetings/:id/summary" element={<MeetingSummaryPage />} />
            <Route path="meetings/pro" element={<MeetingProPage />} />

            {/* Orlode Studio — 5-step onboarding wizard (template → theme → identity → domain → launch) */}
            <Route path="studio" element={<StudioPage />} />
            <Route path="studio/*" element={<StudioPage />} />

            {/* Business */}
            <Route path="insights" element={<InsightsPage />} />
            {/* Communications — toutes les sous-pages dans CommunicationsRedesignPage */}
            <Route path="emails" element={<CommunicationsRedesignPage />} />
            <Route path="comms" element={<CommunicationsRedesignPage />} />
            <Route path="comms/*" element={<CommunicationsRedesignPage />} />

            {/* Réception — toutes les sous-pages sont des onglets dans ReceptionRedesignPage */}
            <Route path="reception" element={<ReceptionRedesignPage />} />
            <Route path="reception/*" element={<ReceptionRedesignPage />} />
            <Route path="admin/employee-codes" element={<ReceptionRedesignPage />} />
            {/* Old plan-based subscription page is gone since the pricing pivot
                ($20/mo per pack). Redirect to /marketplace where packs live. */}
            <Route path="admin/subscription" element={<Navigate to="/marketplace" replace />} />
            <Route path="marketplace" element={<AgentMarketplacePage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="agent/:agentId" element={<AgentWorkspacePage />} />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="creator" element={<CreatorDashboardPage />} />
            <Route path="creator/register" element={<CreatorRegisterPage />} />
            <Route path="creator/new" element={<AgentBuilderPage />} />
            <Route path="creator/edit/:id" element={<AgentBuilderPage />} />

            {/* HR — toutes les sous-pages sont accessibles via les onglets de HRRedesignPage */}
            <Route path="hr" element={<HRRedesignPage />} />
            <Route path="hr/*" element={<HRRedesignPage />} />

            {/* Finance */}
            {/* Finance — toutes les sous-pages sont des onglets dans FinanceRedesignPage */}
            <Route path="finance" element={<FinanceRedesignPage />} />
            <Route path="finance/*" element={<FinanceRedesignPage />} />

            {/* Pack admin URLs — canonical is /agents/<pack> (plural, matches
                the orlode.com domain convention). Old /agent/<pack> singular
                paths redirect for backward compat. Note: explicit static paths
                like "agents/restaurant" beat the dynamic "agents/:agentId" route. */}
            <Route path="agents/commerce" element={<BoutiqueRedesignPage />} />
            <Route path="agents/boutique" element={<BoutiqueRedesignPage />} />
            <Route path="agent/commerce" element={<Navigate to="/agents/commerce" replace />} />
            <Route path="agent/boutique" element={<Navigate to="/agents/commerce" replace />} />
            <Route path="boutique" element={<Navigate to="/agents/commerce" replace />} />
            <Route path="commerce" element={<Navigate to="/agents/commerce" replace />} />

            <Route path="agents/restaurant" element={<RestaurantRedesignPage />} />
            <Route path="agent/restaurant" element={<Navigate to="/agents/restaurant" replace />} />
            <Route path="restaurant" element={<Navigate to="/agents/restaurant" replace />} />

            <Route path="agents/hotel" element={<HotelRedesignPage />} />
            <Route path="agent/hotel" element={<Navigate to="/agents/hotel" replace />} />
            <Route path="hotel" element={<Navigate to="/agents/hotel" replace />} />

            <Route path="agents/service" element={<ServiceRedesignPage />} />
            <Route path="agents/salon" element={<ServiceRedesignPage />} />
            <Route path="agent/service" element={<Navigate to="/agents/service" replace />} />
            <Route path="agent/salon" element={<Navigate to="/agents/service" replace />} />
            <Route path="service" element={<Navigate to="/agents/service" replace />} />
            <Route path="salon" element={<Navigate to="/agents/service" replace />} />

            {/* Cabinet — page multi-profil (méd/dent/avo/not/comptable/véto).
                /agents/health et /agents/sante redirigent désormais ici (ancien Health pack). */}
            <Route path="agents/cabinet" element={<CabinetRedesignPage />} />
            <Route path="agents/health" element={<CabinetRedesignPage />} />
            <Route path="agents/sante" element={<CabinetRedesignPage />} />
            <Route path="agents/medecin" element={<CabinetRedesignPage />} />
            <Route path="agents/dentiste" element={<CabinetRedesignPage />} />
            <Route path="agents/avocat" element={<CabinetRedesignPage />} />
            <Route path="agents/notaire" element={<CabinetRedesignPage />} />
            <Route path="agents/comptable" element={<CabinetRedesignPage />} />
            <Route path="agents/veto" element={<CabinetRedesignPage />} />
            <Route path="agent/cabinet" element={<Navigate to="/agents/cabinet" replace />} />
            <Route path="agent/health" element={<Navigate to="/agents/cabinet" replace />} />
            <Route path="agent/sante" element={<Navigate to="/agents/cabinet" replace />} />
            <Route path="cabinet" element={<Navigate to="/agents/cabinet" replace />} />
            <Route path="health" element={<Navigate to="/agents/cabinet" replace />} />
            <Route path="sante" element={<Navigate to="/agents/cabinet" replace />} />

            <Route path="agents/realestate" element={<RealEstateRedesignPage />} />
            <Route path="agents/immobilier" element={<RealEstateRedesignPage />} />
            <Route path="agents/residence" element={<ResidenceRedesignPage />} />
            <Route path="agents/residences" element={<ResidenceRedesignPage />} />
            <Route path="agent/residence" element={<Navigate to="/agents/residences" replace />} />
            <Route path="agent/residences" element={<Navigate to="/agents/residences" replace />} />
            <Route path="residences" element={<Navigate to="/agents/residences" replace />} />
            <Route path="agent/realestate" element={<Navigate to="/agents/realestate" replace />} />
            <Route path="agent/immobilier" element={<Navigate to="/agents/realestate" replace />} />
            <Route path="realestate" element={<Navigate to="/agents/realestate" replace />} />
            <Route path="immobilier" element={<Navigate to="/agents/realestate" replace />} />

            <Route path="agents/pme" element={<PMEHubPage />} />
            <Route path="agent/pme" element={<Navigate to="/agents/pme" replace />} />
            <Route path="pme" element={<Navigate to="/agents/pme" replace />} />

            {/* Marketplace 4-agent bundle hubs — generic factory page per pack */}
            <Route path="agents/sante"           element={<SantePack />} />
            <Route path="agents/artisan"         element={<ArtisanPack />} />
            <Route path="agents/agriculture"     element={<AgriculturePack />} />
            <Route path="agents/securite-totale" element={<SecuriteTotPack />} />
            <Route path="agents/securite-site"   element={<SecuriteSitePack />} />
            <Route path="agents/mode"            element={<ModePack />} />
            <Route path="agents/education"       element={<EducationPack />} />
            <Route path="agents/super"           element={<SuperPack />} />
            <Route path="agents/super-enterprise" element={<Navigate to="/agents/super" replace />} />

            <Route path="agents/datascientist" element={<DataScientistRedesignPage />} />
            <Route path="agents/kora" element={<KoraPage />} />
            <Route path="kora" element={<Navigate to="/agents/kora" replace />} />
            <Route path="agents/datascience" element={<Navigate to="/agents/datascientist" replace />} />
            <Route path="agents/data-scientist" element={<Navigate to="/agents/datascientist" replace />} />
            <Route path="agent/datascientist" element={<Navigate to="/agents/datascientist" replace />} />
            <Route path="datascientist" element={<Navigate to="/agents/datascientist" replace />} />

            <Route path="agents/enterprise" element={<EnterpriseHubPage />} />
            <Route path="agents/entreprise" element={<EnterpriseHubPage />} />
            <Route path="agent/enterprise" element={<Navigate to="/agents/enterprise" replace />} />
            <Route path="agent/entreprise" element={<Navigate to="/agents/enterprise" replace />} />
            <Route path="entreprise" element={<Navigate to="/agents/enterprise" replace />} />

            {/* Multi-Pack Home — auto-detects activated packs, shows quick switcher */}
            <Route path="agent" element={<MultiPackHomePage />} />
            <Route path="packs" element={<Navigate to="/agent" replace />} />
            <Route path="home" element={<Navigate to="/agent" replace />} />

            {/* Sales — canonical hub at /sales; /agents/sales redirects */}
            <Route path="agents/sales" element={<SalesDashboardPage />} />
            <Route path="agents/commercial" element={<Navigate to="/agents/sales" replace />} />
            <Route path="agent/sales" element={<Navigate to="/agents/sales" replace />} />
            <Route path="sales" element={<SalesDashboardPage />} />
            <Route path="sales/pipeline" element={<SalesPipelinePage />} />
            <Route path="sales/leads" element={<SalesLeadsPage />} />
            <Route path="sales/leads/:id" element={<LeadDetailPage />} />
            <Route path="sales/quotes" element={<QuotesPage />} />
            <Route path="sales/clients" element={<SalesClientsPage />} />
            <Route path="sales/followups" element={<SalesFollowupsPage />} />
            <Route path="sales/audit" element={<SalesAuditLogPage />} />
            <Route path="sales/invoices" element={<SalesInvoicesPage />} />
            <Route path="sales/activities" element={<SalesActivitiesPage />} />
            <Route path="sales/reports" element={<SalesReportsPage />} />
            <Route path="sales/ai-chat" element={<SalesAIChatPage />} />
            <Route path="sales/pro" element={<SalesProPage />} />
            <Route path="sales/forecast" element={<SalesForecastPage />} />

            {/* Support */}
            <Route path="support" element={<SupportCenterPage />} />
            <Route path="support/pro" element={<SupportProPage />} />
            <Route path="support/:id" element={<TicketDetailPage />} />
            <Route path="support/kb" element={<KnowledgeBasePage />} />

            {/* IT */}
            <Route path="it" element={<ITDashboardPage />} />
            <Route path="it/pro" element={<ITProPage />} />
            <Route path="it/assets" element={<ITAssetsPage />} />
            <Route path="it/tickets" element={<ITTicketsPage />} />
            <Route path="it/licenses" element={<ITLicensesPage />} />

            {/* Security */}
            <Route path="security" element={<SecurityDashboardPage />} />
            <Route path="security/incidents" element={<SecurityIncidentsPage />} />
            <Route path="security/vulnerabilities" element={<VulnerabilitiesPage />} />
            <Route path="security/phishing" element={<PhishingPage />} />
            <Route path="security/compliance" element={<CompliancePage />} />
            <Route path="security/policies" element={<PoliciesPage />} />
            <Route path="security/access" element={<AccessReviewPage />} />
            <Route path="security/audit" element={<SecurityAuditLogsPage />} />

            {/* Marketing */}
            {/* Marketing — toutes les sous-pages dans MarketingRedesignPage */}
            <Route path="marketing" element={<MarketingRedesignPage />} />
            <Route path="marketing/*" element={<MarketingRedesignPage />} />

            {/* Workflow Automation */}
            <Route path="workflow" element={<WorkflowRedesignPage />} />
            <Route path="workflow/*" element={<WorkflowRedesignPage />} />
            <Route path="automation" element={<WorkflowRedesignPage />} />
            <Route path="automation/*" element={<WorkflowRedesignPage />} />
            {/* Legal & Contracts — unified */}
            <Route path="legal" element={<LegalRedesignPage />} />
            <Route path="legal/*" element={<LegalRedesignPage />} />
            <Route path="contracts" element={<LegalRedesignPage />} />
            <Route path="contracts/*" element={<LegalRedesignPage />} />
            <Route path="commercial" element={<CommercialPage />} />

            {/* Training */}
            <Route path="training" element={<LearningCenterPage />} />
            <Route path="training/courses/:courseId" element={<CoursePage />} />
            <Route path="training/quiz/:quizId" element={<QuizPage />} />
            <Route path="training/manage" element={<CourseManagerPage />} />

            {/* Faces */}
            <Route path="faces" element={<FaceDirectoryPage />} />
            <Route path="faces/register" element={<FaceRegisterPage />} />
            <Route path="vision/settings" element={<VisionSettingsPage />} />
            <Route path="faces/settings" element={<Navigate to="/vision/settings" replace />} />
          </Route>
        </Route>

        {/* ── Admin ──────────────────────────────────────────────────── */}
        <Route element={<AuthGuard requireCompany requireRole={['admin', 'manager']} />}>
          <Route element={<AdminLayout />}>
            <Route path="admin" element={<CompanySettingsPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="admin/users/invite" element={<InviteUserPage />} />
            <Route path="admin/roles" element={<RolesPermissionsPage />} />
            <Route path="admin/agent-permissions" element={<AgentPermissionsPage />} />
            <Route path="admin/agents" element={<AgentConfigPage />} />
            <Route path="admin/skills" element={<SkillsManagerPage />} />
            <Route path="admin/mcp" element={<MCPConnectionsPage />} />
            <Route path="admin/api-keys" element={<APIKeysPage />} />
            <Route path="admin/security" element={<SecuritySettingsPage />} />
            <Route path="admin/audit" element={<AuditLogsPage />} />
            <Route path="admin/orchestrator" element={<OrchestratorDashboardPage />} />
            <Route path="admin/clone" element={<CloneSetupPage />} />
            <Route path="admin/clone/inbox" element={<CloneInboxPage />} />
            <Route path="admin/intelligence" element={<AgentIntelligencePage />} />

            {/* News/Veille */}
            <Route path="news" element={<NewsDashboardPage />} />
            <Route path="news/competitors" element={<CompetitorTrackerPage />} />
            <Route path="admin/rgpd" element={<RGPDCenterPage />} />
            <Route path="admin/billing" element={<BillingPage />} />

            {/* 🧠 Cerveau de l'entreprise — page unique pour nourrir l'IA */}
            <Route path="admin/brain" element={<BrainPage />} />
            <Route path="admin/cerveau" element={<BrainPage />} />
            <Route path="setup/brain" element={<BrainPage />} />
            <Route path="admin/domain" element={<DomainPage />} />
            <Route path="admin/domains" element={<Navigate to="/admin/domain" replace />} />
            <Route path="admin/domaine" element={<Navigate to="/admin/domain" replace />} />
            <Route path="admin/contracts" element={<ContractsPage />} />
            <Route path="admin/byoe" element={<ByoeSetupPage />} />
            <Route path="admin/usage" element={<UsageStatsPage />} />
            <Route path="admin/public-api" element={<PublicAPIDashboardPage />} />
            <Route path="admin/api-docs" element={<APIDocsPage />} />
            <Route path="admin/webhooks" element={<WebhooksPage />} />
            <Route path="admin/danger" element={<DangerZonePage />} />
            <Route path="admin/inbox" element={<InboxPage />} />
            <Route path="admin/messages" element={<Navigate to="/admin/inbox" replace />} />
            <Route path="admin/whatsapp" element={<WhatsAppPage />} />
            <Route path="admin/whatsapp/leads" element={<WhatsAppLeadsPage />} />
            <Route path="admin/whatsapp/templates" element={<WhatsAppTemplatesPage />} />
            <Route path="admin/whatsapp/broadcasts" element={<WhatsAppBroadcastsPage />} />
            <Route path="admin/whatsapp/auto-broadcasts" element={<WhatsAppAutoBroadcastsPage />} />
            <Route path="admin/whatsapp/catalog" element={<WhatsAppCatalogPage />} />
            <Route path="admin/whatsapp/ads" element={<WhatsAppAdsPage />} />
            <Route path="admin/meta-ads" element={<MetaAdsConfigPage />} />
            <Route path="admin/telegram" element={<TelegramPage />} />
            <Route path="admin/appointments" element={<AppointmentsAdminPage />} />
            <Route path="admin/reservations" element={<ReservationsAdminPage />} />
            <Route path="admin/shop" element={<ShopAdminPage />} />
            <Route path="admin/clone/analytics" element={<CloneAnalyticsPage />} />
            <Route path="admin/clone/assignments" element={<ServiceAssignmentsPage />} />
            <Route path="admin/voice-permissions" element={<VoicePermissionsPage />} />
            <Route path="admin/azure" element={<AzureSettingsPage />} />
            <Route path="admin/widget" element={<WidgetSettingsPage />} />
            <Route path="website-editor" element={<WebsiteEditorPage />} />
            <Route path="website" element={<WebsiteBuilderRedesignPage />} />
            <Route path="website/*" element={<WebsiteBuilderRedesignPage />} />
            <Route path="admin/social" element={<SocialNetworksPage />} />
            <Route path="admin/social/composer" element={<SocialComposerPage />} />
            <Route path="admin/social/posts" element={<SocialPostsPage />} />
            <Route path="admin/video" element={<VideoStudioPage />} />
            <Route path="admin/marketplace-analytics" element={<MarketplaceAnalyticsPage />} />
          </Route>
        </Route>

        {/* ── Super Admin ────────────────────────────────────────────── */}
        <Route element={<AuthGuard requireSuperAdmin />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="superadmin/companies" element={<CompaniesListPage />} />
            <Route path="superadmin/companies-members" element={<CompaniesMembersPage />} />
            <Route path="superadmin/companies/:companyId" element={<CompanyDetailPage />} />
            <Route path="superadmin/users" element={<SAUsersPage />} />
            <Route path="superadmin/analytics" element={<PlatformAnalyticsPage />} />
            <Route path="superadmin/payments" element={<SAPaymentsPage />} />
            <Route path="superadmin/platform-settings" element={<SAPlatformSettingsPage />} />
            <Route path="superadmin/packs" element={<SAPacksPage />} />
            <Route path="superadmin/marketplace" element={<SAMarketplacePage />} />
            <Route path="superadmin/influencers" element={<SAInfluencersPage />} />
            <Route path="superadmin/talents" element={<SATalentsPage />} />
            <Route path="superadmin/marketplace-studio" element={<SAMarketplaceStudioPage />} />
            <Route path="superadmin/landing" element={<SALandingEditorPage />} />
            <Route path="superadmin/health" element={<SAHealthPage />} />
            <Route path="superadmin/mcp-catalog" element={<SAPlatformMCPCatalogPage />} />
            <Route path="superadmin/support" element={<PlatformSupportPage />} />
          </Route>
        </Route>

        {/* ── Fallback ───────────────────────────────────────────────── */}
        <Route path="ref/:creatorId" element={<ReferralPage />} />
        <Route path="site/:companyId" element={<SiteRendererPage />} />
        <Route path="ai/:slug" element={<AgentSEOPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
