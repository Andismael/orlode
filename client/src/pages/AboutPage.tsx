import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';
import DemoReel from "@/components/landing/DemoReel";
import { useLangStore, LANGUAGES, type LangCode } from '@/store/langStore';
import { useSEO } from '@/hooks/useSEO';

const aiProviders = ["OpenAI", "Claude", "Gemini"];
const agents = ["Reception", "Marketing", "Support", "Finance"];

const conversations: Array<Array<{ side: 'left' | 'right'; text: string }>> = [
  [
    { side: "left", text: "Hi, I want to book an appointment." },
    { side: "right", text: "Available at 10 AM or 2 PM. Which works?" },
    { side: "left", text: "10 AM please." },
    { side: "right", text: "Confirmed. Reminder sent." },
  ],
  [
    { side: "left", text: "Do you deliver today?" },
    { side: "right", text: "Yes, delivery in 45 minutes." },
    { side: "left", text: "Perfect." },
    { side: "right", text: "Order confirmed." },
  ],
  [
    { side: "left", text: "I need a quote." },
    { side: "right", text: "Sending a quote now." },
    { side: "right", text: "Quote sent via WhatsApp." },
  ],
];

function GlowBlob({ className }: { className: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.25, 1], rotate: [0, 120, 360] }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      className={`absolute rounded-full blur-[120px] opacity-35 ${className}`}
    />
  );
}

function FloatingParticle({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -28, 0], opacity: [0.25, 0.9, 0.25] }}
      transition={{ duration: 4, repeat: Infinity, delay }}
      className={`absolute h-2 w-2 rounded-full bg-cyan-300 ${className}`}
    />
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className={`rounded-[2rem] bg-white/[0.07] border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/30 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function ChatBubble({ side = "left", children, delay = 0 }: { side?: 'left' | 'right'; children: React.ReactNode; delay?: number }) {
  const isRight = side === "right";
  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 24 : -24, y: 12 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, duration: 0.55 }}
      className={`flex ${isRight ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isRight
            ? "bg-gradient-to-r from-emerald-500 to-cyan-400 text-black font-semibold rounded-br-md"
            : "bg-white/10 border border-white/10 text-white/85 rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function MiniAgentRow({ name, index }: { name: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 35 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.55 + index * 0.12 }}
      className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.06] border border-white/10"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center text-xl shadow-lg">
          🤖
        </div>
        <div>
          <p className="font-black">{name} AI</p>
          <p className="text-xs text-white/45">Connected · BYOE</p>
        </div>
      </div>
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.2 }}
        className="text-emerald-300 text-sm font-black"
      >
        ● Live
      </motion.div>
    </motion.div>
  );
}

function PackCard({ emoji, title, desc, color }: { emoji: string; title: string; desc: string; color: string }) {
  return (
    <GlassCard className="p-7 relative overflow-hidden group">
      <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-40 ${color}`} />
      <div className="relative z-10">
        <div className="text-5xl mb-5">{emoji}</div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-black">{title}</h3>
          <span className="rounded-full bg-white text-slate-950 px-3 py-1 text-sm font-black">$20</span>
        </div>
        <p className="text-white/60 mt-3 leading-relaxed">{desc}</p>
        <div className="mt-6 space-y-3 text-sm text-white/80">
          {["4 agents included", "WhatsApp ready", "Client-owned API keys"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center text-xs">✓</span>
              {item}
            </div>
          ))}
        </div>
        <button className="mt-7 w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-400 font-black shadow-xl group-hover:scale-[1.03] transition">
          Activate Pack
        </button>
      </div>
    </GlassCard>
  );
}

export default function AboutPage() {
  useSEO({
    title: 'Orlode — Bring Your Own AI · $20 per pack',
    description: 'Your AI + Messaging system, powered by your infrastructure. Connect OpenAI, Claude or Gemini. No usage markup, no lock-in. $20 per business pack.',
    path: '/about',
  });

  const { lang, setLang } = useLangStore();
  const [langOpen, setLangOpen] = useState(false);
  // Lightweight i18n: lp('FR text', 'EN text')
  const lp = (fr: string, en?: string) => lang === 'fr' ? fr : (en ?? fr);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % conversations.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050512] text-white overflow-hidden relative selection:bg-cyan-300 selection:text-black">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <GlowBlob className="-top-44 -left-40 w-[560px] h-[560px] bg-violet-600" />
      <GlowBlob className="top-28 -right-48 w-[520px] h-[520px] bg-cyan-500" />
      <GlowBlob className="bottom-20 left-1/3 w-[440px] h-[440px] bg-fuchsia-600" />
      <FloatingParticle className="top-36 left-[12%]" />
      <FloatingParticle className="top-72 right-[18%]" delay={0.9} />
      <FloatingParticle className="bottom-96 left-[48%]" delay={1.8} />

      <header className="relative z-20 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 no-underline text-white">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-xl shadow-cyan-500/20 overflow-hidden"
          >
            <img src="/logo.png" alt="Orlode" className="w-9 h-9 object-contain" />
          </motion.div>
          <div>
            <p className="text-2xl font-black tracking-tight">Orlode</p>
            <p className="text-xs text-white/50">{lp("Apportez votre propre IA", 'Bring Your Own AI Platform')}</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm text-white/65">
          <a href="#reel" className="hover:text-white">{lp('Démo', 'Demo')}</a>
          <a href="#packs" className="hover:text-white">{lp('Packs', 'Packs')}</a>
          <Link to="/talents" className="hover:text-white no-underline inline-flex items-center gap-1.5">
            Talents
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider bg-emerald-400 text-emerald-950">NEW</span>
          </Link>
          <Link to="/influenceurs" className="hover:text-white no-underline inline-flex items-center gap-1.5">
            Influenceurs
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider bg-violet-400 text-violet-950">NEW</span>
          </Link>
          <a href="#pricing" className="hover:text-white">{lp('Tarifs', 'Pricing')}</a>
        </nav>
        <div className="flex items-center gap-3">
          {/* Lang switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(o => !o)}
              onBlur={() => setTimeout(() => setLangOpen(false), 150)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 transition"
            >
              <span>{LANGUAGES.find(l => l.code === lang)?.flag ?? '🌐'}</span>
              <span className="font-bold">{lang.toUpperCase()}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onMouseDown={(e) => { e.preventDefault(); setLang(l.code as LangCode); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5 transition ${lang === l.code ? 'bg-white/5 text-white' : 'text-white/70'}`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link to="/register" className="rounded-full bg-white text-slate-950 px-6 py-3 font-black text-sm hover:scale-105 transition shadow-xl no-underline">
            {lp('Commencer', 'Start Free')}
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-[1fr_0.95fr] gap-14 items-center">
          <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm text-white/80 mb-7 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              {lp('20 $ par pack · Le client paie sa propre IA + WhatsApp', '$20 per pack · Client pays own AI + WhatsApp')}
            </div>
            <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tight">
              {lp('Votre IA + système de messagerie.', 'Your AI + Messaging system.')}
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                {lp('Sur votre infrastructure.', 'Powered by your infrastructure.')}
              </span>
            </h1>
            <p className="mt-7 text-xl text-white/68 max-w-2xl leading-relaxed">
              {lp(
                "Connectez OpenAI, Claude ou Gemini. Connectez VOTRE WhatsApp. Utilisez Orlode Messaging — votre propre système type Slack, intégré à vos agents, votre équipe et vos workflows.",
                'Connect OpenAI, Claude or Gemini. Connect YOUR WhatsApp. Use Orlode Messaging — your own Slack-like system, fully integrated with your agents, your team and your workflows.'
              )}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/register"
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 font-black text-lg shadow-2xl shadow-violet-900/50 inline-block text-center no-underline text-white"
                >
                  {lp('Créer mon équipe IA →', 'Create my AI team →')}
                </Link>
              </motion.div>
              <motion.a
                href="#reel"
                whileHover={{ scale: 1.04 }}
                className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition font-bold inline-block text-center no-underline text-white"
              >
                {lp('Voir la démo live', 'Watch live demo')}
              </motion.a>
            </div>

            <div className="mt-9 grid grid-cols-3 gap-4 max-w-2xl">
              {[
                ["0%", lp('majoration usage', 'usage markup')],
                ["3", lp('fournisseurs IA', 'AI providers')],
                ["5 min", lp('setup guidé', 'guided setup')],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 backdrop-blur-xl">
                  <p className="text-3xl font-black">{value}</p>
                  <p className="text-xs text-white/45 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div id="demo" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-r from-violet-600/35 to-cyan-400/30 blur-3xl" />
            <div className="relative rounded-[2.4rem] bg-slate-950/75 border border-white/15 backdrop-blur-2xl shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
                <div>
                  <p className="font-black">Orlode Command Center</p>
                  <p className="text-xs text-white/45">Orlode Messaging + AI Agents (your own internal Slack + external WhatsApp automation)</p>
                </div>
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
              </div>

              <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-0">
                <div className="p-5 border-r border-white/10 space-y-3">
                  {agents.map((agent, idx) => (
                    <MiniAgentRow key={agent} name={agent} index={idx} />
                  ))}
                </div>
                <div className="p-5 bg-black/20">
                  <div className="rounded-3xl bg-[#071b15] border border-emerald-300/15 p-4 min-h-[380px] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-400 text-black flex items-center justify-center font-black">W</div>
                          <div>
                            <p className="font-black">WhatsApp Client</p>
                            <p className="text-xs text-emerald-200/60">Reception AI is typing...</p>
                          </div>
                        </div>
                        <span className="text-xs bg-emerald-400/15 text-emerald-200 px-3 py-1 rounded-full">LIVE</span>
                      </div>
                      <div className="space-y-3">
                        <motion.div
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4 }}
                          className="space-y-3"
                        >
                          {conversations[index].map((msg, i) => (
                            <ChatBubble key={i} side={msg.side} delay={0.3 + i * 0.4}>
                              {msg.text}
                            </ChatBubble>
                          ))}
                        </motion.div>
                      </div>
                    </div>
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="mt-5 rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white/60"
                    >
                      Agent action: Calendar checked · Confirmation sent · Lead updated
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-10">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] backdrop-blur-xl p-5 grid md:grid-cols-3 gap-4">
            {aiProviders.map((provider, idx) => (
              <motion.div
                key={provider}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.15 }}
                className="rounded-2xl bg-black/30 border border-white/10 p-5 text-center"
              >
                <p className="text-sm text-white/45">{lp('Connecter', 'Connect')}</p>
                <p className="text-2xl font-black mt-1">{provider}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ INTERACTIVE DEMO REEL ============ */}
        <section id="reel" className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="text-emerald-300 font-black tracking-wider text-sm">{lp('À L\'ŒUVRE', 'SEE IT IN ACTION')}</p>
            <h2 className="text-5xl md:text-6xl font-black mt-3 leading-tight">
              {lp("D'un simple message,", 'From a simple message,')}
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
                {lp('un résultat business.', 'a business outcome.')}
              </span>
            </h2>
            <p className="mt-5 text-white/60 text-lg">
              {lp(
                "Regardez de vrais scénarios se dérouler sur WhatsApp pendant qu'Orlode gère votre back-office automatiquement.",
                'Watch real scenarios play out in WhatsApp while Orlode runs your back-office automatically.'
              )}
            </p>
          </div>
          <DemoReel />

          {/* Orlode Talents + Influenceurs teasers — separate products, same Firebase backend */}
          <div className="mt-12 grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <Link to="/talents" className="block no-underline">
              <div className="h-full rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/8 to-emerald-500/10 border border-amber-400/30 backdrop-blur-xl p-6 hover:scale-[1.02] hover:border-amber-400/60 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-xl shadow-amber-500/30 flex-shrink-0">
                    🎬
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-amber-300 tracking-wider">{lp('NOUVEAU PRODUIT', 'NEW PRODUCT')}</p>
                    <h3 className="text-xl font-black text-white mt-0.5">
                      Orlode <em className="italic text-amber-300">Talents</em>
                    </h3>
                    <p className="text-xs text-white/65 mt-2 leading-relaxed">{lp(
                      'Recrutement vidéo. 1 minute, pas de CV, contact WhatsApp direct.',
                      'Video recruiting. 1 minute, no resume, direct WhatsApp contact.',
                    )}</p>
                  </div>
                  <span className="text-amber-300 text-xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
            <Link to="/influenceurs" className="block no-underline">
              <div className="h-full rounded-3xl bg-gradient-to-br from-violet-500/15 via-indigo-500/8 to-fuchsia-500/10 border border-violet-400/30 backdrop-blur-xl p-6 hover:scale-[1.02] hover:border-violet-400/60 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-2xl shadow-xl shadow-violet-500/30 flex-shrink-0">
                    📢
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-violet-300 tracking-wider">{lp('NOUVEAU PRODUIT', 'NEW PRODUCT')}</p>
                    <h3 className="text-xl font-black text-white mt-0.5">
                      Orlode <em className="italic text-violet-300">Influenceurs</em>
                    </h3>
                    <p className="text-xs text-white/65 mt-2 leading-relaxed">{lp(
                      'Marketplace marques ↔ créateurs Afrique. Sans agence, 5% transaction.',
                      'Brand ↔ creator marketplace Africa. No agency, 5% transaction.',
                    )}</p>
                  </div>
                  <span className="text-violet-300 text-xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Channel demo links — point visitors to the standalone landing pages */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <Link to="/whatsapp" className="group no-underline">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/8 to-transparent border border-emerald-400/30 backdrop-blur-xl p-6 hover:scale-[1.02] hover:border-emerald-400/60 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-2xl shadow-xl shadow-emerald-500/30">
                    💬
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-emerald-300 tracking-wider">{lp('DÉMO INTERACTIVE', 'INTERACTIVE DEMO')}</p>
                    <h3 className="text-xl font-black text-white mt-0.5">Pack WhatsApp</h3>
                    <p className="text-sm text-white/55 mt-1">{lp('Boutique 24/7, commandes, RDV', '24/7 shop, orders, bookings')}</p>
                  </div>
                  <span className="text-emerald-300 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
            <Link to="/telegram" className="group no-underline">
              <div className="rounded-3xl bg-gradient-to-br from-cyan-500/15 via-cyan-500/8 to-transparent border border-cyan-400/30 backdrop-blur-xl p-6 hover:scale-[1.02] hover:border-cyan-400/60 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-2xl shadow-xl shadow-cyan-500/30">
                    ✈️
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-cyan-300 tracking-wider">{lp('DÉMO INTERACTIVE', 'INTERACTIVE DEMO')}</p>
                    <h3 className="text-xl font-black text-white mt-0.5">Pack Telegram</h3>
                    <p className="text-sm text-white/55 mt-1">{lp('Bots, channels, communautés', 'Bots, channels, communities')}</p>
                  </div>
                  <span className="text-cyan-300 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <section id="packs" className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-cyan-300 font-black">{lp('Packs métiers', 'Business packs')}</p>
            <h2 className="text-5xl md:text-6xl font-black mt-3">{lp('Vendez des systèmes, pas des outils.', 'Sell systems, not tools.')}</h2>
            <p className="mt-5 text-white/60 text-lg">{lp(
              "Chaque pack donne à une entreprise un système complet : agents + messagerie + workflows, tous connectés.",
              'Each pack gives a business a full system: agents + messaging + workflows, all connected.'
            )}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <PackCard emoji="🍽️" title={lp('Restaurant', 'Restaurant')} color="bg-orange-500" desc={lp(
              'Réservations, livraison, messages clients et campagnes fidélité automatisées.',
              'Reservations, delivery, customer messages and loyalty campaigns automated.'
            )} />
            <PackCard emoji="🏢" title={lp('Entreprise', 'Business')} color="bg-cyan-500" desc={lp(
              'Ventes, factures, support et communication interne dans un seul workspace IA.',
              'Sales, invoices, support and internal communication in one AI workspace.'
            )} />
            <PackCard emoji="🏠" title={lp('Immobilier', 'Real Estate')} color="bg-violet-500" desc={lp(
              "Qualification des leads, suivi des biens, réponses WhatsApp et prise de RDV.",
              'Lead qualification, property follow-up, WhatsApp replies and appointment booking.'
            )} />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-8 items-center">
          <GlassCard className="p-9">
            <p className="text-fuchsia-300 font-black">{lp('Pourquoi les clients nous font confiance', 'Why customers trust it')}</p>
            <h2 className="text-5xl font-black mt-3 leading-tight">{lp(
              "Pas de facture IA cachée. Pas de markup WhatsApp.",
              'No hidden AI bill. No WhatsApp markup.'
            )}</h2>
            <p className="mt-5 text-white/62 text-lg leading-relaxed">
              {lp(
                "Vos clients utilisent leur propre fournisseur IA, leur propre compte WhatsApp Business et leur propre carte. Orlode vend la plateforme, l'automatisation et l'expérience agent.",
                'Your customers use their own AI provider, their own WhatsApp Business account and their own card. Orlode sells the platform, automation and agent experience.'
              )}
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[
                lp('Le client possède sa data', 'Client owns data'),
                lp('Le client contrôle ses coûts', 'Client controls cost'),
                lp('Vous scalez avec marge', 'You scale with margin'),
                lp('Tarifs ONG-friendly', 'NGO-friendly pricing'),
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center">✓</span>
                  <span className="font-bold">{item}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-9 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-400/30 rounded-full blur-3xl" />
            <div className="relative z-10">
              <p className="text-cyan-300 font-black">{lp('Mot du fondateur', 'Founder message')}</p>
              <h3 className="text-4xl font-black mt-3">{lp('« Rendre l\'IA accessible. »', '"We make AI accessible."')}</h3>
              <p className="mt-5 text-white/65 leading-relaxed text-lg">
                {lp(
                  "Orlode est pensé pour les PME, ONG et entrepreneurs qui veulent automatiser sans abonnements coûteux ni complexité technique.",
                  'Orlode is designed for small businesses, NGOs and entrepreneurs who need automation without expensive subscriptions or technical complexity.'
                )}
              </p>
              <div className="mt-8 rounded-3xl bg-black/30 border border-white/10 p-5">
                <p className="text-white/45 text-sm">{lp('Positionnement', 'Positioning')}</p>
                <p className="text-2xl font-black mt-1 bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
                  {lp("Le Shopify des agents IA", 'The Shopify of AI Agents')}
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[2.5rem] bg-white text-slate-950 p-8 md:p-12 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-cyan-300/50 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-violet-400/40 blur-3xl" />
            <div className="relative z-10 grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <div>
                <p className="font-black text-violet-600">{lp('Tarification simple', 'Simple pricing')}</p>
                <h2 className="text-5xl md:text-6xl font-black mt-2 leading-tight">{lp('20 $ par pack.', '$20 per pack.')}</h2>
                <p className="mt-5 text-slate-600 text-lg leading-relaxed">
                  {lp(
                    "Les clients apportent leur IA et leur WhatsApp. Orlode fournit la messagerie, le système d'agents et le cœur d'automatisation business.",
                    'Customers bring their AI and WhatsApp. Orlode provides the messaging layer, the agent system and the business automation core.'
                  )}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  {[
                    lp('Aucune majoration usage', 'No usage markup'),
                    lp('Sans engagement', 'No lock-in'),
                    lp('Multi-IA', 'Multi-AI'),
                    lp('WhatsApp prêt', 'WhatsApp-ready'),
                  ].map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-[2rem] bg-slate-950 text-white p-7 shadow-2xl">
                <p className="text-white/50">{lp('À partir de', 'Starts at')}</p>
                <div className="flex items-end gap-2 mt-2">
                  <p className="text-7xl font-black">$20</p>
                  <p className="mb-3 text-white/50">/{lp('mois', 'mo')}</p>
                </div>
                <p className="text-white/60">{lp('par pack métier', 'per business pack')}</p>
                <Link to="/register" className="mt-8 w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-400 font-black hover:scale-[1.03] transition inline-block text-center text-white no-underline">
                  {lp('Lancer Orlode', 'Launch Orlode')}
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="relative z-10 border-t border-white/10 mt-20">
          <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Orlode" className="w-7 h-7 object-contain" />
                </div>
                <p className="text-xl font-black">Orlode</p>
              </div>
              <p className="text-sm text-white/55 leading-relaxed">
                {lp(
                  "L'équipe IA + messagerie pour votre entreprise. Sur votre infrastructure.",
                  'AI + messaging team for your business. On your infrastructure.'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-black text-white/40 tracking-wider mb-4">{lp('PRODUIT', 'PRODUCT')}</p>
              <ul className="space-y-2 text-sm text-white/65">
                <li><a href="#reel" className="hover:text-white">{lp('Démo', 'Demo')}</a></li>
                <li><a href="#packs" className="hover:text-white">{lp('Packs', 'Packs')}</a></li>
                <li><a href="#pricing" className="hover:text-white">{lp('Tarifs', 'Pricing')}</a></li>
                <li><Link to="/features" className="hover:text-white no-underline">{lp('Toutes les fonctionnalités', 'All features')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-black text-white/40 tracking-wider mb-4">{lp('ENTREPRISE', 'COMPANY')}</p>
              <ul className="space-y-2 text-sm text-white/65">
                <li><Link to="/" className="hover:text-white no-underline">{lp('Accueil', 'Home')}</Link></li>
                <li><a href="mailto:contact@orlode.ai" className="hover:text-white">{lp('Contact', 'Contact')}</a></li>
                <li><Link to="/legal/terms" className="hover:text-white no-underline">{lp('Conditions', 'Terms')}</Link></li>
                <li><Link to="/legal/privacy" className="hover:text-white no-underline">{lp('Confidentialité', 'Privacy')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-black text-white/40 tracking-wider mb-4">{lp('CONFORMITÉ', 'COMPLIANCE')}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-xs font-bold text-emerald-300">RGPD</span>
                <span className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/30 text-xs font-bold text-violet-300">SOC 2</span>
                <span className="px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-xs font-bold text-cyan-300">BYOE</span>
              </div>
              <p className="mt-4 text-xs text-white/40">
                © {new Date().getFullYear()} Orlode AI · {lp('Tous droits réservés', 'All rights reserved')}
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
