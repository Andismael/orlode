/**
 * Setup Guide Page — Step-by-step BYOE setup instructions
 * Accessible during onboarding at /setup-guide
 */
import { useState } from 'react';
import {
  ChevronDown, ChevronRight, ExternalLink, CheckCircle2, Circle,
  AlertTriangle, Copy, Check, Flame, Key, Shield, Database,
  Cloud, Bot, CreditCard, Link2, HelpCircle, ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLangStore } from '@/store/langStore';

interface StepProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  duration: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function GuideStep({ number, title, icon, duration, children, defaultOpen = false }: StepProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2B4AFF, #0092FF)' }}>
          <span className="text-white font-bold text-sm">{number}</span>
        </div>
        <div className="flex-shrink-0 text-blue-500">{icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{duration}</p>
        </div>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

function ExternalLink2({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline underline-offset-2 text-sm font-medium">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 font-mono text-sm mt-2 mb-3">
      <code className="flex-1 overflow-x-auto">{text}</code>
      <button onClick={copy} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };
  return (
    <div className="space-y-2 mt-3">
      {items.map((item, i) => (
        <button key={i} onClick={() => toggle(i)}
          className="flex items-center gap-3 w-full text-left text-sm text-gray-700 hover:text-gray-900 transition-colors">
          {checked.has(i)
            ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
            : <Circle size={18} className="text-gray-300 flex-shrink-0" />
          }
          <span className={checked.has(i) ? 'line-through text-gray-400' : ''}>{item}</span>
        </button>
      ))}
    </div>
  );
}

function TroubleshootBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
        <AlertTriangle size={15} />
        {title}
      </div>
      <div className="text-sm text-amber-800 leading-relaxed">{children}</div>
    </div>
  );
}

export default function SetupGuidePage() {
  const { t } = useLangStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/setup')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Guide de Setup BYOE</h1>
            <p className="text-xs text-gray-500">Configurez votre environnement en 15 minutes</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">
            <HelpCircle size={13} />
            Besoin d'aide ? zinakonect@gmail.com
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* Intro card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl px-6 py-6 text-white mb-8">
          <h2 className="text-xl font-bold mb-2">Bienvenue dans le Setup BYOE</h2>
          <p className="text-blue-100 text-sm leading-relaxed mb-4">
            BYOE (Bring Your Own Environment) signifie que vos données restent dans <strong>VOTRE</strong> projet Firebase.
            Orlode ne touche jamais vos donnees. Suivez ce guide etape par etape — ca prend environ 15 minutes.
          </p>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-blue-200">Pre-requis</span>
              <p className="font-semibold">Compte Google + Carte bancaire (Firebase Blaze)</p>
            </div>
            <div>
              <span className="text-blue-200">Duree totale</span>
              <p className="font-semibold">~15 minutes</p>
            </div>
          </div>
        </div>

        {/* ── STEP 1: Create Firebase Project ────────────────── */}
        <GuideStep number={1} title="Creer un projet Firebase" icon={<Flame size={20} />} duration="~3 min" defaultOpen>
          <ol className="space-y-3 text-sm text-gray-700 leading-relaxed list-decimal list-inside">
            <li>
              Allez sur{' '}
              <ExternalLink2 href="https://console.firebase.google.com/">Firebase Console</ExternalLink2>
            </li>
            <li>Cliquez <strong>"Add project"</strong> (Ajouter un projet)</li>
            <li>Donnez un nom (ex: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">corpmind-votre-entreprise</code>)</li>
            <li>Desactivez Google Analytics (pas necessaire)</li>
            <li>Cliquez <strong>"Create project"</strong></li>
          </ol>

          <Checklist items={[
            'Projet Firebase cree',
            'Nom du projet note (ex: corpmind-acme-corp)',
          ]} />

          <TroubleshootBox title="Le projet ne se cree pas ?">
            <p>Verifiez que votre compte Google n'a pas atteint la limite de projets (25 max). Sinon, supprimez un ancien projet inutilise.</p>
          </TroubleshootBox>
        </GuideStep>

        {/* ── STEP 2: Upgrade to Blaze ──────────────────────── */}
        <GuideStep number={2} title="Activer le plan Blaze (pay-as-you-go)" icon={<CreditCard size={20} />} duration="~2 min">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Pourquoi Blaze ?</strong> Le plan gratuit (Spark) ne supporte pas Cloud Functions ni le stockage au-dela de 1GB.
              Blaze = pay-as-you-go. Pour une PME, le cout Firebase est <strong>~$15/mois</strong>.
            </p>
          </div>

          <ol className="space-y-3 text-sm text-gray-700 leading-relaxed list-decimal list-inside">
            <li>Dans votre projet Firebase, cliquez sur <strong>"Upgrade"</strong> en bas a gauche</li>
            <li>Selectionnez <strong>"Blaze (pay as you go)"</strong></li>
            <li>Ajoutez une carte bancaire</li>
            <li>Confirmez</li>
          </ol>

          <Checklist items={[
            'Plan Blaze active',
            'Carte bancaire ajoutee',
          ]} />

          <TroubleshootBox title="Carte refusee ?">
            <p>Firebase accepte Visa, Mastercard, Amex. Les cartes prepayees peuvent etre refusees. Essayez une carte bancaire classique.</p>
          </TroubleshootBox>
        </GuideStep>

        {/* ── STEP 3: Enable Services ───────────────────────── */}
        <GuideStep number={3} title="Activer les services Firebase" icon={<Database size={20} />} duration="~3 min">
          <p className="text-sm text-gray-600 mb-4">Activez ces 3 services dans votre projet :</p>

          <div className="space-y-4">
            {/* Firestore */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <h4 className="font-semibold text-sm text-gray-900 mb-2">A. Firestore Database</h4>
              <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
                <li>Menu gauche → <strong>Firestore Database</strong></li>
                <li>Cliquez <strong>"Create database"</strong></li>
                <li>Choisissez <strong>"Start in test mode"</strong> (on securisera plus tard)</li>
                <li>Region : <strong>europe-west1 (Belgium)</strong> recommande pour l'Afrique/Europe</li>
                <li>Cliquez <strong>"Enable"</strong></li>
              </ol>
            </div>

            {/* Storage */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <h4 className="font-semibold text-sm text-gray-900 mb-2">B. Storage</h4>
              <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
                <li>Menu gauche → <strong>Storage</strong></li>
                <li>Cliquez <strong>"Get started"</strong></li>
                <li>Regles par defaut → <strong>Next</strong></li>
                <li>Region : meme que Firestore → <strong>Done</strong></li>
              </ol>
            </div>

            {/* Auth */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <h4 className="font-semibold text-sm text-gray-900 mb-2">C. Authentication</h4>
              <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
                <li>Menu gauche → <strong>Authentication</strong></li>
                <li>Cliquez <strong>"Get started"</strong></li>
                <li>Activez <strong>"Email/Password"</strong> comme provider</li>
                <li>(Optionnel) Activez <strong>"Google"</strong> pour le sign-in Google</li>
              </ol>
            </div>
          </div>

          <Checklist items={[
            'Firestore Database cree (region europe-west1)',
            'Storage active',
            'Authentication active avec Email/Password',
          ]} />

          <TroubleshootBox title="Storage ne s'active pas ?">
            <p>Verifiez que le plan Blaze est bien actif. Storage necessite Blaze. Rafraichissez la page si besoin.</p>
          </TroubleshootBox>
        </GuideStep>

        {/* ── STEP 4: Service Account ───────────────────────── */}
        <GuideStep number={4} title="Telecharger le Service Account" icon={<Key size={20} />} duration="~2 min">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-800">
              <strong>Important :</strong> Ce fichier JSON donne un acces admin a votre projet Firebase.
              Ne le partagez JAMAIS publiquement. Orlode le chiffre avec AES-256-GCM avant stockage.
            </p>
          </div>

          <ol className="space-y-3 text-sm text-gray-700 leading-relaxed list-decimal list-inside">
            <li>
              Allez dans{' '}
              <ExternalLink2 href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk">
                Project Settings → Service Accounts
              </ExternalLink2>
            </li>
            <li>Cliquez <strong>"Generate new private key"</strong></li>
            <li>Confirmez → un fichier <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.json</code> se telecharge</li>
            <li>Dans le wizard Orlode, uploadez ce fichier ou collez son contenu</li>
          </ol>

          <Checklist items={[
            'Fichier JSON service account telecharge',
            'Upload dans le wizard Orlode',
          ]} />

          {/* Permissions fix */}
          <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3">
            <h4 className="font-semibold text-sm text-gray-900 mb-2">Permissions supplementaires (si le test Auth echoue)</h4>
            <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
              <li>
                Allez sur{' '}
                <ExternalLink2 href="https://console.cloud.google.com/iam-admin/iam">
                  Google Cloud Console → IAM
                </ExternalLink2>
              </li>
              <li>Trouvez votre service account <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">firebase-adminsdk-xxxxx@votre-projet.iam.gserviceaccount.com</code></li>
              <li>Cliquez le crayon (modifier)</li>
              <li>Ajoutez le role <strong>"Service Usage Consumer"</strong></li>
              <li>Sauvegardez et attendez 2-3 minutes</li>
            </ol>
          </div>

          <TroubleshootBox title="Auth test echoue avec 'PERMISSION_DENIED' ?">
            <p>C'est le probleme le plus courant. Le service account a besoin du role <strong>Service Usage Consumer</strong>. Suivez les instructions ci-dessus dans Google Cloud Console → IAM.</p>
          </TroubleshootBox>
        </GuideStep>

        {/* ── STEP 5: API Keys ──────────────────────────────── */}
        <GuideStep number={5} title="Obtenir les cles API AI" icon={<Bot size={20} />} duration="~3 min">
          <p className="text-sm text-gray-600 mb-4">Orlode utilise 2 APIs AI. Seule Gemini est obligatoire.</p>

          <div className="space-y-4">
            {/* Gemini */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-gray-900">A. Google AI (Gemini)</h4>
                <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">Obligatoire</span>
              </div>
              <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
                <li>
                  Allez sur{' '}
                  <ExternalLink2 href="https://aistudio.google.com/apikey">Google AI Studio</ExternalLink2>
                </li>
                <li>Cliquez <strong>"Create API Key"</strong></li>
                <li>Selectionnez votre projet Firebase</li>
                <li>Copiez la cle (commence par <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">AIza...</code>)</li>
              </ol>
              <p className="text-xs text-gray-500 mt-2">Cout : ~$5-25/mois selon l'usage. Tier gratuit disponible.</p>
            </div>

            {/* Claude */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-gray-900">B. Anthropic (Claude)</h4>
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">Recommande</span>
              </div>
              <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
                <li>
                  Allez sur{' '}
                  <ExternalLink2 href="https://console.anthropic.com/settings/keys">Console Anthropic</ExternalLink2>
                </li>
                <li>Cliquez <strong>"Create Key"</strong></li>
                <li>Copiez la cle (commence par <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">sk-ant-...</code>)</li>
              </ol>
              <p className="text-xs text-gray-500 mt-2">Utilise pour le Q&A et l'Agent Commercial. Cout : ~$20-40/mois. Optionnel mais ameliore la qualite des reponses.</p>
            </div>

            {/* OpenAI */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-gray-900">C. OpenAI</h4>
                <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">(`${t('other')}`)</span>
              </div>
              <p className="text-sm text-gray-500">Non requis par defaut. Orlode fonctionne avec Gemini + Claude uniquement. Vous pouvez l'ajouter plus tard via BYOE si necessaire.</p>
            </div>
          </div>

          <Checklist items={[
            'Cle Gemini API obtenue et testee',
            'Cle Claude API obtenue et testee (optionnel)',
          ]} />
        </GuideStep>

        {/* ── STEP 6: Validate & Deploy ─────────────────────── */}
        <GuideStep number={6} title="Valider et deployer le schema" icon={<Shield size={20} />} duration="~2 min">
          <p className="text-sm text-gray-600 mb-4">
            Le wizard Orlode va automatiquement :
          </p>
          <div className="space-y-2">
            {[
              'Verifier la connexion a votre Firebase (Firestore, Storage, Auth)',
              'Deployer 29 collections Firestore (documents, meetings, leads, invoices...)',
              'Tester toutes les cles API',
              'Chiffrer et sauvegarder votre configuration BYOE',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600 mt-4">
            Retournez au{' '}
            <button onClick={() => navigate('/setup')} className="text-blue-600 hover:text-blue-800 underline font-medium">
              Wizard de Setup
            </button>
            {' '}et cliquez <strong>"Validate Firebase"</strong> puis <strong>"Deploy Schema"</strong>.
          </p>

          <TroubleshootBox title="Le deploy echoue ?">
            <p>Verifiez que Firestore est bien en mode <strong>test</strong> (pas locked). Allez dans Firebase Console → Firestore → Rules et assurez-vous que les regles permettent l'ecriture.</p>
            <CopyBlock text={`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`} />
            <p className="text-xs text-amber-600 mt-1">Note : Ces regles sont pour le setup uniquement. Orlode deploie des regles securisees apres.</p>
          </TroubleshootBox>
        </GuideStep>

        {/* ── STEP 7: Test & Launch ─────────────────────────── */}
        <GuideStep number={7} title="Tester et lancer" icon={<Link2 size={20} />} duration="~2 min">
          <p className="text-sm text-gray-600 mb-4">
            Le test final verifie que tous les services sont connectes :
          </p>

          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Service</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Ce qui est teste</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">*</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-100"><td className="px-4 py-2">Firestore</td><td className="px-4 py-2">Lecture/ecriture d'un document test</td><td className="px-4 py-2 text-green-600 font-medium">{`${t('yes')}`}</td></tr>
                <tr className="border-b border-gray-100"><td className="px-4 py-2">Storage</td><td className="px-4 py-2">Le bucket existe et est accessible</td><td className="px-4 py-2 text-green-600 font-medium">{`${t('yes')}`}</td></tr>
                <tr className="border-b border-gray-100"><td className="px-4 py-2">Auth</td><td className="px-4 py-2">Peut lister les utilisateurs</td><td className="px-4 py-2 text-green-600 font-medium">{`${t('yes')}`}</td></tr>
                <tr className="border-b border-gray-100"><td className="px-4 py-2">Gemini</td><td className="px-4 py-2">Liste les modeles disponibles</td><td className="px-4 py-2 text-green-600 font-medium">{`${t('yes')}`}</td></tr>
                <tr className="border-b border-gray-100"><td className="px-4 py-2">Claude</td><td className="px-4 py-2">Envoie un message test</td><td className="px-4 py-2 text-gray-400">(`${t('other')}`)</td></tr>
                <tr><td className="px-4 py-2">OpenAI</td><td className="px-4 py-2">Liste les modeles</td><td className="px-4 py-2 text-gray-400">(`${t('other')}`)</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm text-gray-600 mt-4">
            Les 4 services requis doivent etre au vert. Claude et OpenAI sont optionnels — un skip est normal si vous n'avez pas fourni de cle.
          </p>

          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm text-green-800">
              <strong>Une fois tout au vert :</strong> Cliquez <strong>"Launch"</strong> pour finaliser. Votre configuration BYOE est chiffree (AES-256-GCM) et sauvegardee. Vous pouvez commencer a utiliser Orlode !
            </p>
          </div>
        </GuideStep>

        {/* ── Cost Summary ──────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-6 mt-8">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Cloud size={20} className="text-blue-500" />
            Resume des couts mensuels
          </h3>
          <div className="space-y-2">
            {[
              { service: 'Firebase (Blaze)', cost: '~$15/mois', note: 'Firestore + Storage + Auth' },
              { service: 'Google AI (Gemini)', cost: '~$5-25/mois', note: 'Flash + Pro selon usage' },
              { service: 'Anthropic (Claude)', cost: '~$20-40/mois', note: 'Q&A + Agent Commercial (optionnel)' },
              { service: 'Licence Orlode', cost: '$49.99/mois', note: 'Plan Business' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-900">{item.service}</span>
                  <span className="text-xs text-gray-400 ml-2">{item.note}</span>
                </div>
                <span className="text-sm font-semibold text-gray-700">{item.cost}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-900">Total estime</span>
              <span className="font-bold text-blue-600 text-lg">~$90-130/mois</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">VS embaucher 1 assistant : $500-1,500/mois. Orlode = 3-10x moins cher.</p>
        </div>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HelpCircle size={20} className="text-blue-500" />
            Questions frequentes
          </h3>
          <div className="space-y-4">
            {[
              {
                q: 'Mes donnees sont-elles en securite ?',
                a: 'Oui. Vos donnees restent dans VOTRE projet Firebase. Orlode n\'y accede que via votre service account chiffre. Nous ne stockons jamais vos donnees sur nos serveurs.',
              },
              {
                q: 'Puis-je changer de cles API plus tard ?',
                a: 'Oui. Allez dans Admin → Settings → BYOE Configuration pour mettre a jour vos cles a tout moment.',
              },
              {
                q: 'Que se passe-t-il si je depasse le tier gratuit Firebase ?',
                a: 'Le plan Blaze est pay-as-you-go. Vous ne payez que ce que vous utilisez. Pour une PME, ca represente environ $15/mois.',
              },
              {
                q: 'OpenAI est-il necessaire ?',
                a: 'Non. Orlode fonctionne avec Gemini (obligatoire) + Claude (recommande). OpenAI est une option BYOE pour les clients qui le souhaitent.',
              },
              {
                q: 'Combien de temps prend le setup ?',
                a: 'Environ 15 minutes si vous suivez ce guide. La plupart du temps est pris par la creation du projet Firebase et l\'activation des services.',
              },
            ].map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                  {faq.q}
                  <ChevronRight size={14} className="text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-gray-600 mt-2 pl-0 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <button onClick={() => navigate('/setup')}
            className="px-8 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #2B4AFF, #0092FF)' }}>
            Retourner au Wizard de Setup
          </button>
        </div>
      </div>
    </div>
  );
}
