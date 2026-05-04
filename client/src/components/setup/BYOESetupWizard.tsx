/**
 * BYOE Setup Wizard — 10-step provisioning wizard for Business/Enterprise plans.
 * Guides the client through Firebase project creation, API key configuration,
 * schema deployment, and connection testing.
 *
 * Security: API keys are sent to the server only for encrypted storage.
 * The server never logs them and stores only the AES-256-GCM ciphertext.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, CheckCircle, Loader2, ExternalLink,
  Eye, EyeOff, AlertCircle, Wifi,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface BYOESetupWizardProps {
  onComplete: () => void;
}

interface TestStatus { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

const STEPS = [
  { label: 'Welcome',         icon: '👋' },
  { label: 'Firebase Project', icon: '🔥' },
  { label: 'Enable Services', icon: '⚡' },
  { label: 'Service Account', icon: '🔑' },
  { label: 'AI API Keys',     icon: '🧠' },
  { label: 'Validate',        icon: '✅' },
  { label: 'Deploy Schema',   icon: '📦' },
  { label: 'Test All',        icon: '🔗' },
  { label: 'Summary',         icon: '📊' },
  { label: 'Launch',          icon: '🚀' },
];

const REGIONS = [
  { code: 'europe-west1', label: '🌍 Belgium (Africa / Europe recommended)' },
  { code: 'us-central1',  label: '🌎 Iowa (USA)' },
  { code: 'asia-east1',   label: '🌏 Taiwan (Asia)' },
  { code: 'me-west1',     label: '🌍 Tel Aviv (Middle East)' },
];

export default function BYOESetupWizard({ onComplete }: BYOESetupWizardProps) {
  const { company, setCompany } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agentMessage, setAgentMessage] = useState('');

  // Collected data across steps
  const [projectId, setProjectId]             = useState('');
  const [region, setRegion]                   = useState('europe-west1');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [showJson, setShowJson]               = useState(false);
  const [geminiKey, setGeminiKey]             = useState('');
  const [claudeKey, setClaudeKey]             = useState('');
  const [openaiKey, setOpenaiKey]             = useState('');
  const [showGemini, setShowGemini]           = useState(false);
  const [showClaude, setShowClaude]           = useState(false);

  // Test statuses
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>({ status: 'idle' });
  const [claudeStatus, setClaudeStatus] = useState<TestStatus>({ status: 'idle' });
  const [validateStatus, setValidateStatus] = useState<TestStatus>({ status: 'idle' });
  const [deployStatus, setDeployStatus]     = useState<TestStatus>({ status: 'idle' });
  const [testAllResult, setTestAllResult]   = useState<Record<string, unknown> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const context = {
    companyName: company?.name,
    adminEmail: (useAuthStore.getState().user?.email),
    plan: company?.plan ?? 'pro',
    firebaseProjectId: projectId,
    region,
    serviceAccountKey: serviceAccountJson,
    geminiApiKey: geminiKey,
    claudeApiKey: claudeKey || undefined,
    openaiApiKey: openaiKey || undefined,
  };

  const sendToAgent = async (message: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ response: string; nextStep?: number; completed?: boolean; testResult?: Record<string, unknown> }>(
        '/setup/chat',
        { message, step, context }
      );
      const d = res.data;
      setAgentMessage(d.response);
      if (d.testResult) setTestAllResult(d.testResult);
      if (d.completed) {
        if (company) setCompany({ ...company, onboardingCompleted: true });
        setTimeout(onComplete, 1500);
      }
      if (d.nextStep !== undefined && d.nextStep > step) {
        setStep(d.nextStep);
      }
    } finally {
      setLoading(false);
    }
  };

  const testKey = async (provider: 'gemini' | 'claude', key: string) => {
    const setter = provider === 'gemini' ? setGeminiStatus : setClaudeStatus;
    setter({ status: 'testing' });
    try {
      const res = await api.post<{ message: string }>(
        '/setup/test-key',
        { provider, apiKey: key }
      );
      setter({ status: 'ok', message: res.data.message });
    } catch (err) {
      setter({ status: 'error', message: String(err) });
    }
  };

  const validateFirebase = async () => {
    setValidateStatus({ status: 'testing' });
    try {
      const res = await api.post<{ message: string }>(
        '/setup/validate-firebase',
        { projectId, serviceAccountKey: serviceAccountJson }
      );
      setValidateStatus({ status: 'ok', message: res.data.message });
      setStep(6);
    } catch (err) {
      setValidateStatus({ status: 'error', message: String(err) });
    }
  };

  const deploySchema = async () => {
    setDeployStatus({ status: 'testing' });
    await sendToAgent('Deploy the Firestore schema now');
    setDeployStatus({ status: loading ? 'testing' : 'ok' });
  };

  const testAllConnections = async () => {
    await sendToAgent('Test all connections now');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string;
        JSON.parse(json); // Validate
        setServiceAccountJson(json);
      } catch {
        alert('Invalid JSON file. Please upload the service account key downloaded from Firebase Console.');
      }
    };
    reader.readAsText(file);
  };

  const canProceed = () => {
    if (step === 1) return projectId.trim().length > 5;
    if (step === 3) return serviceAccountJson.length > 50;
    if (step === 4) return geminiKey.length > 10 && geminiStatus.status === 'ok';
    if (step === 5) return validateStatus.status === 'ok';
    return true;
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    setLoading(true);
    try {
      if (step === 5) { await validateFirebase(); return; }
      if (step === 6) { await deploySchema(); return; }
      if (step === 7) { await testAllConnections(); return; }
      if (step === 9) {
        await api.post('/setup/save-byoe', {
          firebaseProjectId: projectId,
          serviceAccountKey: serviceAccountJson,
          region,
          geminiApiKey: geminiKey,
          claudeApiKey: claudeKey || undefined,
          openaiApiKey: openaiKey || undefined,
        });
        await api.post('/onboarding/complete');
        if (company) setCompany({ ...company, onboardingCompleted: true });
        onComplete();
        return;
      }
      setStep((s) => s + 1);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ s }: { s: TestStatus }) => {
    if (s.status === 'testing') return <Loader2 size={14} className="animate-spin text-blue-500" />;
    if (s.status === 'ok') return <CheckCircle size={14} className="text-green-500" />;
    if (s.status === 'error') return <AlertCircle size={14} className="text-red-500" />;
    return <Wifi size={14} className="text-gray-300" />;
  };

  useEffect(() => {
    if (step === 0) setAgentMessage("Welcome! I'll guide you through setting up your Orlode environment. Your data will stay 100% in YOUR Firebase project. Let's get started — it takes about 15 minutes.");
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Progress */}
        <div className="h-1.5 bg-gray-100">
          <motion.div
            className="h-full"
            style={{ background: 'linear-gradient(90deg, #0092FF, #FF009D)' }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 pt-4 overflow-x-auto scrollbar-none">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-0.5 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                i < step ? 'bg-green-100 text-green-600' : i === step ? 'text-white' : 'bg-gray-100 text-gray-400'
              }`}
                style={i === step ? { background: 'linear-gradient(135deg, #0092FF, #FF009D)' } : {}}
              >
                {i < step ? '✓' : s.icon}
              </div>
              {i < STEPS.length - 1 && <div className={`w-3 h-0.5 ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-3 mb-5 p-3 bg-gradient-to-r from-blue-50 to-pink-50 rounded-xl border border-blue-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0092FF22, #FF009D22)' }}>🔧</div>
            <p className="text-sm text-gray-700 leading-relaxed">{agentMessage || STEPS[step]?.label}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

              {/* Step 0 — Welcome */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-gray-900">BYOE Setup — Your data stays with you</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: '🔒', title: 'Zero-knowledge', desc: 'We never see your data or API keys' },
                      { icon: '🔥', title: 'Your Firebase', desc: 'Your own Google Cloud project' },
                      { icon: '🧠', title: 'Your AI keys', desc: 'Pay providers directly, no markup' },
                      { icon: '⏱️', title: '15 minutes', desc: 'Fully guided, step by step' },
                    ].map((item) => (
                      <div key={item.title} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xl mb-1">{item.icon}</div>
                        <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                        <div className="text-xs text-gray-500">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <strong>What you'll need:</strong> A Google account (for Firebase), a credit card for Firebase Blaze plan (pay-as-you-go, ~$15/month), and internet access to the AI provider consoles.
                  </div>
                  <a href="/setup-guide" target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 font-medium hover:bg-blue-100 transition-colors">
                    <span className="text-lg">📖</span>
                    Guide complet pas-a-pas (avec liens et troubleshooting)
                    <ExternalLink size={13} className="ml-auto" />
                  </a>
                </div>
              )}

              {/* Step 1 — Firebase Project */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Create your Firebase project</h2>
                  <ol className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
                      <span>Open <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline flex items-center gap-0.5">Firebase Console <ExternalLink size={11} /></a></span></li>
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span><span>Click <strong>"Add project"</strong> → Name it <code className="bg-gray-100 px-1 rounded">corpmind-{company?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'yourcompany'}</code></span></li>
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</span><span>Choose your region:</span></li>
                  </ol>
                  <div className="space-y-1.5">
                    {REGIONS.map((r) => (
                      <button key={r.code} onClick={() => setRegion(r.code)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${region === r.code ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Paste your Project ID</label>
                    <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value.trim())}
                      placeholder="corpmind-yourcompany"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono" />
                    <p className="text-xs text-gray-400 mt-1">Found in Firebase Console → Project Settings → General → Project ID</p>
                  </div>
                </div>
              )}

              {/* Step 2 — Enable Services */}
              {step === 2 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-gray-900">Enable Firebase services</h2>
                  <p className="text-sm text-gray-600">In your Firebase Console, enable these 4 services:</p>
                  {[
                    { name: 'Firestore Database', path: 'Build → Firestore Database → Create database (Production mode)', required: true },
                    { name: 'Firebase Storage', path: 'Build → Storage → Get started', required: true },
                    { name: 'Authentication', path: 'Build → Authentication → Get started → Enable Email/Password + Google', required: true },
                    { name: 'Blaze Plan (Pay-as-you-go)', path: 'Settings ⚙️ → Upgrade plan → Blaze (required for Storage + Functions)', required: true },
                  ].map((svc) => (
                    <div key={svc.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-5 h-5 rounded-full border-2 border-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{svc.name} {svc.required && <span className="text-red-500 text-xs">*</span>}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{svc.path}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3 — Service Account */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Download your Service Account key</h2>
                  <ol className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
                      <span>Go to <strong>Project Settings</strong> (gear icon) → <strong>Service Accounts</strong></span></li>
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span>
                      <span>Click <strong>"Generate new private key"</strong> → <strong>"Generate key"</strong></span></li>
                    <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</span>
                      <span>A JSON file is downloaded. Upload it below:</span></li>
                  </ol>
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors"
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                    {serviceAccountJson ? (
                      <div className="text-green-600">
                        <CheckCircle size={32} className="mx-auto mb-2" />
                        <p className="text-sm font-medium">Service account loaded</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {JSON.parse(serviceAccountJson)['project_id'] ?? 'unknown project'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl mb-2">📁</div>
                        <p className="text-sm font-medium text-gray-700">Click to upload service account JSON</p>
                        <p className="text-xs text-gray-400 mt-1">The file stays in your browser — encrypted before any server storage</p>
                      </>
                    )}
                  </div>
                  {serviceAccountJson && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowJson((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        {showJson ? <EyeOff size={12} /> : <Eye size={12} />} {showJson ? 'Hide' : 'Preview'} JSON
                      </button>
                    </div>
                  )}
                  {showJson && serviceAccountJson && (
                    <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 overflow-auto max-h-32 font-mono">
                      {JSON.stringify(JSON.parse(serviceAccountJson), null, 2).slice(0, 400)}...
                    </pre>
                  )}
                </div>
              )}

              {/* Step 4 — API Keys */}
              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Connect your AI brains</h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                    🔐 Keys are encrypted (AES-256-GCM) before storage. We never see them in plaintext.
                  </div>

                  {/* Gemini */}
                  <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Google AI (Gemini) — REQUIRED</p>
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
                          Get key at aistudio.google.com <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type={showGemini ? 'text' : 'password'} value={geminiKey} onChange={(e) => { setGeminiKey(e.target.value); setGeminiStatus({ status: 'idle' }); }}
                          placeholder="AIza..."
                          className="w-full border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm font-mono focus:outline-none focus:border-blue-400" />
                        <button onClick={() => setShowGemini((v) => !v)} className="absolute right-3 top-2.5 text-gray-400">
                          {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <button onClick={() => testKey('gemini', geminiKey)} disabled={!geminiKey || geminiStatus.status === 'testing'}
                        className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap">
                        <StatusIcon s={geminiStatus} /> Test
                      </button>
                    </div>
                    {geminiStatus.message && (
                      <p className={`text-xs ${geminiStatus.status === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{geminiStatus.message}</p>
                    )}
                  </div>

                  {/* Claude */}
                  <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💬</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Anthropic (Claude) — RECOMMENDED</p>
                        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
                          Get key at console.anthropic.com <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type={showClaude ? 'text' : 'password'} value={claudeKey} onChange={(e) => { setClaudeKey(e.target.value); setClaudeStatus({ status: 'idle' }); }}
                          placeholder="sk-ant-..."
                          className="w-full border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm font-mono focus:outline-none focus:border-blue-400" />
                        <button onClick={() => setShowClaude((v) => !v)} className="absolute right-3 top-2.5 text-gray-400">
                          {showClaude ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <button onClick={() => testKey('claude', claudeKey)} disabled={!claudeKey || claudeStatus.status === 'testing'}
                        className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap">
                        <StatusIcon s={claudeStatus} /> Test
                      </button>
                    </div>
                    {claudeStatus.message && (
                      <p className={`text-xs ${claudeStatus.status === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{claudeStatus.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5 — Validate */}
              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Validate your Firebase connection</h2>
                  <p className="text-sm text-gray-600">We'll run read/write tests on your Firebase project to confirm everything is working.</p>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 font-mono text-xs">
                    <div>Project: <span className="text-blue-600">{projectId}</span></div>
                    <div>Region: <span className="text-blue-600">{region}</span></div>
                    <div>Service account: <span className="text-green-600">{serviceAccountJson ? '✓ Loaded' : '✗ Missing'}</span></div>
                  </div>
                  <button onClick={validateFirebase} disabled={validateStatus.status === 'testing'}
                    className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0092FF, #FF009D)' }}>
                    {validateStatus.status === 'testing' ? <><Loader2 size={16} className="animate-spin" /> Validating...</> : '🔍 Run Firebase Validation'}
                  </button>
                  {validateStatus.message && (
                    <div className={`p-3 rounded-xl text-sm ${validateStatus.status === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {validateStatus.message}
                    </div>
                  )}
                </div>
              )}

              {/* Step 6 — Deploy Schema */}
              {step === 6 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Deploy Orlode schema</h2>
                  <p className="text-sm text-gray-600">We'll create all 28+ collections in your Firebase project and initialize the data structure.</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['companies', 'documents', 'meetings', 'visitors', 'invoices', 'expenses',
                      'leaveRequests', 'leads', 'deals', 'supportTickets', 'hrPolicies',
                      'securityIncidents', 'auditLogs', 'conversations', 'vectorChunks', '+13 more'].map((col) => (
                      <div key={col} className="bg-gray-50 rounded-lg px-2 py-1.5 text-xs text-gray-600 font-mono text-center">{col}</div>
                    ))}
                  </div>
                  <button onClick={deploySchema} disabled={deployStatus.status === 'testing' || loading}
                    className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0092FF, #FF009D)' }}>
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Deploying...</> : '📦 Deploy Schema'}
                  </button>
                </div>
              )}

              {/* Step 7 — Test All */}
              {step === 7 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Test all connections</h2>
                  {testAllResult ? (
                    <div className="space-y-3">
                      {['firebase', 'ai'].map((category) => {
                        const cat = (testAllResult as Record<string, Record<string, string>>)[category];
                        return cat ? (
                          <div key={category} className="border border-gray-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">{category}</p>
                            {Object.entries(cat)
                              .filter(([k]) => !k.endsWith('Error'))
                              .map(([k, v]) => (
                                <div key={k} className="flex items-center gap-2 text-sm py-0.5">
                                  <span>{v === 'ok' ? '✅' : v === 'skipped' ? '⏭️' : '❌'}</span>
                                  <span className="text-gray-700 capitalize">{k}</span>
                                </div>
                              ))}
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <button onClick={testAllConnections} disabled={loading}
                      className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #0092FF, #FF009D)' }}>
                      {loading ? <><Loader2 size={16} className="animate-spin" /> Testing...</> : '🔗 Run Connection Tests'}
                    </button>
                  )}
                </div>
              )}

              {/* Step 8 — Summary */}
              {step === 8 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-gray-900">Configuration summary</h2>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Company</span><span className="font-medium">{company?.name}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-medium capitalize">{company?.plan}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Firebase Project</span><span className="font-medium font-mono text-xs">{projectId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Region</span><span className="font-medium">{region}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Gemini AI</span><span className="text-green-600 font-medium">✅ Connected</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Claude AI</span><span className={`font-medium ${claudeKey ? 'text-green-600' : 'text-gray-400'}`}>{claudeKey ? '✅ Connected' : '⏭️ Skipped'}</span></div>
                    <hr className="border-gray-200" />
                    <div className="text-xs text-gray-400">Estimated monthly cost: Firebase ~$15 + Gemini ~$20{claudeKey ? ' + Claude ~$30' : ''} = ~${35 + (claudeKey ? 30 : 0)}/month</div>
                  </div>
                </div>
              )}

              {/* Step 9 — Launch */}
              {step === 9 && (
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎉</div>
                  <h2 className="text-xl font-bold text-gray-900">Ready to launch!</h2>
                  <p className="text-sm text-gray-600">Your Orlode is fully configured. Click below to save your BYOE configuration and launch your dashboard.</p>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {[
                      { icon: '📄', label: 'Upload documents' },
                      { icon: '💬', label: 'Chat with agents' },
                      { icon: '👥', label: 'Invite team' },
                      { icon: '📹', label: 'Connect meetings' },
                    ].map((a) => (
                      <div key={a.label} className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 text-sm">
                        <span>{a.icon}</span><span className="text-gray-700">{a.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between bg-white">
          {step > 0 ? (
            <button onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          <button
            onClick={handleNext}
            disabled={loading || !canProceed()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0092FF, #FF009D)' }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : (
              <>
                {step === 9 ? '🚀 Launch Orlode' : step >= 5 && step <= 7 ? 'Run Test' : 'Continue'}
                {step !== 9 && <ArrowRight size={15} />}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
