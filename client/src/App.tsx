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
const CloneChatPage = lazy(() => import('@/pages/public/CloneChatPage'));
const CloneVoicePage = lazy(() => import('@/pages/public/CloneVoicePage'));
const MyStatusPage = lazy(() => import('@/pages/public/MyStatusPage'));
const ApiKeysPage = lazy(() => import('@/pages/settings/ApiKeysPage'));
const CloneSetupPage = lazy(() => import('@/pages/admin/CloneSetupPage'));
const CloneInboxPage = lazy(() => import('@/pages/admin/CloneInboxPage'));

// ── HR ──
const HRRedesignPage = lazy(() => import('@/pages/hr/HRRedesignPage'));
const WorkflowRedesignPage = lazy(() => import('@/pages/workflow/WorkflowRedesignPage'));

// ── Finance ──
const FinanceRedesignPage = lazy(() => import('@/pages/finance/FinanceRedesignPage'));

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
const WhatsAppLeadsPage = lazy(() => import('@/pages/admin/WhatsAppLeadsPage'));
const WhatsAppTemplatesPage = lazy(() => import('@/pages/admin/WhatsAppTemplatesPage'));
const WhatsAppBroadcastsPage = lazy(() => import('@/pages/admin/WhatsAppBroadcastsPage'));
const WhatsAppAutoBroadcastsPage = lazy(() => import('@/pages/admin/WhatsAppAutoBroadcastsPage'));
const WhatsAppCatalogPage = lazy(() => import('@/pages/admin/WhatsAppCatalogPage'));
const WhatsAppAdsPage = lazy(() => import('@/pages/admin/WhatsAppAdsPage'));
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
const SAMarketplaceStudioPage = lazy(() => import('@/pages/superadmin/MarketplaceStudioPage'));
const SALandingEditorPage = lazy(() => import('@/pages/superadmin/LandingEditorPage'));
const SAHealthPage = lazy(() => import('@/pages/superadmin/SystemHealthPage'));
const SAPlatformMCPCatalogPage = lazy(() => import('@/pages/superadmin/PlatformMCPCatalogPage'));

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
        <Route path="/clone/:companyId" element={<CloneChatPage />} />
        <Route path="/clone/:companyId/voice" element={<CloneVoicePage />} />
        <Route path="/my/:token" element={<MyStatusPage />} />
        <Route path="/book/:companyId" element={<BookVisitPage />} />

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
            <Route path="admin/subscription" element={<PlanAgentPickerPage />} />
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

            {/* Sales */}
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
            <Route path="admin/contracts" element={<ContractsPage />} />
            <Route path="admin/byoe" element={<ByoeSetupPage />} />
            <Route path="admin/usage" element={<UsageStatsPage />} />
            <Route path="admin/public-api" element={<PublicAPIDashboardPage />} />
            <Route path="admin/api-docs" element={<APIDocsPage />} />
            <Route path="admin/webhooks" element={<WebhooksPage />} />
            <Route path="admin/danger" element={<DangerZonePage />} />
            <Route path="admin/whatsapp" element={<WhatsAppPage />} />
            <Route path="admin/whatsapp/leads" element={<WhatsAppLeadsPage />} />
            <Route path="admin/whatsapp/templates" element={<WhatsAppTemplatesPage />} />
            <Route path="admin/whatsapp/broadcasts" element={<WhatsAppBroadcastsPage />} />
            <Route path="admin/whatsapp/auto-broadcasts" element={<WhatsAppAutoBroadcastsPage />} />
            <Route path="admin/whatsapp/catalog" element={<WhatsAppCatalogPage />} />
            <Route path="admin/whatsapp/ads" element={<WhatsAppAdsPage />} />
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
            <Route path="superadmin/marketplace" element={<SAMarketplacePage />} />
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
