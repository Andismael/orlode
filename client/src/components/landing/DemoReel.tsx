import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============ Scenarios ============
type Side = 'left' | 'right';
interface Scenario {
  id: string;
  title: string;
  badge: string;
  emoji: string;
  agent: string;
  resultIcon: string;
  resultText: string;
  messages: { side: Side; text: string }[];
  actions: { icon: string; text: string }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'appointment',
    title: 'Booking',
    badge: 'Reception AI',
    emoji: '📅',
    agent: 'Reception',
    resultIcon: '✅',
    resultText: 'Appointment confirmed + reminder scheduled',
    messages: [
      { side: 'left',  text: "Hi, I'd like to book an appointment." },
      { side: 'right', text: 'Sure! What day works for you?' },
      { side: 'left',  text: 'Tomorrow morning if possible.' },
      { side: 'right', text: 'I have 10:00 AM or 11:30 AM. Which one?' },
      { side: 'left',  text: '10 AM works perfectly.' },
      { side: 'right', text: 'Confirmed! Reminder sent on WhatsApp 📲' },
    ],
    actions: [
      { icon: '📆', text: 'Calendar checked' },
      { icon: '🟢', text: 'Slot 10:00 AM reserved' },
      { icon: '✉️', text: 'Confirmation sent on WhatsApp' },
      { icon: '⏰', text: 'Reminder scheduled (24h before)' },
      { icon: '👤', text: 'Customer added to CRM' },
    ],
  },
  {
    id: 'order',
    title: 'Order',
    badge: 'Restaurant AI',
    emoji: '🍽️',
    agent: 'Support',
    resultIcon: '🛵',
    resultText: 'Order confirmed + delivery dispatched',
    messages: [
      { side: 'left',  text: "I'd like to order food please." },
      { side: 'right', text: 'Sure! What would you like?' },
      { side: 'left',  text: 'Pad Thai + 2 spring rolls.' },
      { side: 'right', text: 'Total $24. Delivery to your saved address?' },
      { side: 'left',  text: 'Yes 🙏' },
      { side: 'right', text: 'Order confirmed! Delivery in 35 min 🛵' },
    ],
    actions: [
      { icon: '📋', text: 'Menu items found' },
      { icon: '🆔', text: 'Order #A2891 created' },
      { icon: '💳', text: 'Payment processed' },
      { icon: '🛵', text: 'Delivery driver assigned' },
      { icon: '📍', text: 'Tracking link sent' },
    ],
  },
  {
    id: 'lead',
    title: 'Quote',
    badge: 'Sales AI',
    emoji: '💼',
    agent: 'Finance',
    resultIcon: '🎯',
    resultText: 'Quote sent + lead saved in CRM',
    messages: [
      { side: 'left',  text: 'I need a quote for 50 employees onboarding.' },
      { side: 'right', text: 'Got it. What industry?' },
      { side: 'left',  text: 'Tech / SaaS startup.' },
      { side: 'right', text: 'Enterprise plan: $1,500/mo. Drafting your quote…' },
      { side: 'left',  text: 'Send via email please.' },
      { side: 'right', text: 'Quote PDF sent! Lead also saved 🎯' },
    ],
    actions: [
      { icon: '🎯', text: 'Lead qualified (score 87/100)' },
      { icon: '🧮', text: 'Pricing engine consulted' },
      { icon: '📄', text: 'Quote PDF generated' },
      { icon: '✉️', text: 'Quote sent to email' },
      { icon: '💾', text: 'Lead saved to CRM' },
      { icon: '🔔', text: 'Sales notified on Slack' },
    ],
  },
];

// ============ Reusable bits ============
function ChatBubble({ side, children }: { side: Side; children: React.ReactNode }) {
  const isRight = side === 'right';
  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 18 : -18, y: 6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isRight
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-br-md'
            : 'bg-white text-slate-800 rounded-bl-md border border-slate-100'
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-end"
    >
      <div className="bg-white border border-slate-100 rounded-2xl rounded-br-md px-4 py-3 flex items-center gap-1.5 shadow-sm">
        {[0, 0.15, 0.3].map((d) => (
          <motion.span
            key={d}
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: d }}
            className="block w-1.5 h-1.5 rounded-full bg-emerald-500"
          />
        ))}
      </div>
    </motion.div>
  );
}

function ActionItem({ icon, text, idx }: { icon: string; text: string; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: idx * 0.05 }}
      className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20"
    >
      <motion.span
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="text-base"
      >
        {icon}
      </motion.span>
      <span className="text-sm text-emerald-50/95 font-medium flex-1">{text}</span>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 16 }}
        className="text-emerald-300"
      >
        ✓
      </motion.span>
    </motion.div>
  );
}

// ============ Main ============
const TICK_MS = 750;
const PAUSE_TICKS_AFTER = 3;

export default function DemoReel() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[scenarioIdx];
  const messageCount = scenario.messages.length;
  const actionCount = scenario.actions.length;
  const totalSteps = messageCount + actionCount + PAUSE_TICKS_AFTER;

  // Animate progression: each tick reveals next message, then actions, then pause, then next scenario
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step >= totalSteps) {
        setScenarioIdx((idx) => (idx + 1) % SCENARIOS.length);
        setStep(0);
      } else {
        setStep((s) => s + 1);
      }
    }, TICK_MS);
    return () => clearTimeout(timer);
  }, [step, totalSteps]);

  // Auto-scroll the chat to bottom whenever new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [step]);

  const visibleMessages = scenario.messages.slice(0, Math.min(step, messageCount));
  const visibleActionsCount = Math.max(0, Math.min(step - messageCount, actionCount));
  const visibleActions = scenario.actions.slice(0, visibleActionsCount);
  // Show typing indicator just before each AI ('right') message reveal
  const isTyping =
    step < messageCount &&
    scenario.messages[step]?.side === 'right';
  const allActionsShown = visibleActionsCount === actionCount;

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      {/* Glow */}
      <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-emerald-500/20 via-cyan-400/20 to-violet-500/20 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400"
            />
            LIVE DEMO
          </div>
          <span className="text-sm text-white/60">
            Scenario {scenarioIdx + 1}/{SCENARIOS.length} · {scenario.title}
          </span>
        </div>

        {/* Scenario selector pills */}
        <div className="flex gap-1.5">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setScenarioIdx(i); setStep(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                i === scenarioIdx
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <span>{s.emoji}</span>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main panel: chat + actions */}
      <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-4 rounded-[2rem] bg-slate-950/80 border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* WhatsApp-style chat */}
        <div className="flex flex-col bg-[#0c1410]">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-emerald-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-lg font-black text-white shadow-md">
                {scenario.emoji}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{scenario.badge}</p>
                <p className="text-[10px] text-emerald-200/80">
                  {isTyping ? 'typing…' : 'online'}
                </p>
              </div>
            </div>
            <div className="text-emerald-300 text-[10px] font-bold tracking-wider">WHATSAPP</div>
          </div>

          {/* Chat messages */}
          <div
            ref={scrollRef}
            className="flex-1 px-4 py-4 space-y-2.5 min-h-[420px] max-h-[480px] overflow-y-auto"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(16,185,129,0.04) 0%, transparent 50%)',
            }}
          >
            <AnimatePresence mode="sync">
              <motion.div
                key={`scenario-${scenarioIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-2.5"
              >
                {visibleMessages.map((m, i) => (
                  <ChatBubble key={`${scenarioIdx}-${i}`} side={m.side}>
                    {m.text}
                  </ChatBubble>
                ))}
                {isTyping && <TypingDots />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Chat input (decorative) */}
          <div className="border-t border-white/10 px-3 py-2.5 flex items-center gap-2 bg-slate-950/40">
            <div className="flex-1 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs text-white/40">
              Message…
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* System Action Panel */}
        <div className="flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 border-l border-white/5">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs">
                ⚡
              </div>
              <p className="text-sm font-bold text-white">System actions</p>
            </div>
            <div className="text-[10px] text-white/40 font-mono">
              {visibleActionsCount}/{actionCount}
            </div>
          </div>

          {/* Actions list */}
          <div className="flex-1 px-4 py-4 space-y-2 min-h-[420px] max-h-[480px] overflow-y-auto">
            {visibleActions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center px-4">
                <div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    className="text-3xl mb-2"
                  >
                    ⏳
                  </motion.div>
                  <p className="text-xs text-white/40 font-medium">
                    Waiting for client message…
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {visibleActions.map((a, i) => (
                  <ActionItem key={`${scenarioIdx}-action-${i}`} icon={a.icon} text={a.text} idx={i} />
                ))}
              </AnimatePresence>
            )}

            {/* Final result card */}
            {allActionsShown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 }}
                className="mt-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-400/40 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{scenario.resultIcon}</span>
                  <p className="text-[10px] font-bold tracking-wider text-emerald-200">RESULT</p>
                </div>
                <p className="text-sm font-bold text-white leading-tight">{scenario.resultText}</p>
              </motion.div>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-4 py-3 border-t border-white/10">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1.5 font-medium">
              Auto-rotates to next scenario in {Math.max(0, totalSteps - step)}s
            </p>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="relative z-10 mt-4 text-center text-xs text-white/40">
        Click a scenario above to see how Orlode handles real business conversations end-to-end.
      </p>
    </div>
  );
}
