import React from 'react';
import { AlertTriangle, ArrowUpRight, Code2, FileText, Lightbulb, PenLine } from 'lucide-react';
import type { HealthStatus } from '../types/chat';
import { BuggyLogo } from './BuggyLogo';

interface WelcomeScreenProps {
  health: HealthStatus | null;
  demoMode: boolean;
  hasConfiguredBackend?: boolean;
  isCheckingHealth?: boolean;
  onRetryHealth?: () => void;
  onToggleDemoMode: () => void;
  onSelectPrompt: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    icon: Code2,
    title: 'Debug or write clean code',
    prompt: 'Write a clean TypeScript utility with unit tests for debouncing async search requests and avoiding race conditions.',
  },
  {
    icon: FileText,
    title: 'Summarize a PDF or document',
    prompt: 'I want to attach a document or paste notes—help me extract the key decisions, risks, and action items.',
  },
  {
    icon: PenLine,
    title: 'Draft or polish writing',
    prompt: 'Help me rewrite a technical project update so it is concise, clear, and easy for non-technical readers to follow.',
  },
  {
    icon: Lightbulb,
    title: 'Explain a complex concept',
    prompt: 'Explain how Server-Sent Events (SSE) work compared to WebSockets, including pros, cons, and when to choose each.',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  health,
  demoMode,
  hasConfiguredBackend = false,
  isCheckingHealth = false,
  onRetryHealth,
  onToggleDemoMode,
  onSelectPrompt,
}) => {
  const isStaticHost = health !== null && !health.ok;
  const isMissingKey = health !== null && health.ok && !health.aiConfigured;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <BuggyLogo size={28} />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-3xl dark:text-zinc-50">
          {getGreeting()}. How can BUGGY AI help?
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Ask questions, write and review code, analyze images or PDFs, or dictate with voice.
        </p>
      </div>

      {(isStaticHost || isMissingKey) && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-950 dark:text-amber-200">
                {isStaticHost
                  ? hasConfiguredBackend
                    ? 'AI Backend Waking Up or Unreachable'
                    : demoMode
                      ? 'GitHub Pages Demo Mode Active'
                      : 'Static Hosting Preview (No Backend Server)'
                  : 'Server API key not configured'}
              </p>
              <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-300/90">
                {isStaticHost ? (
                  hasConfiguredBackend ? (
                    <>
                      Could not connect to the configured backend server yet. Free-tier Node hosts can take 30–50 seconds to wake up from sleep—try retrying in a moment, or verify <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">VITE_API_URL</code> and CORS settings.
                    </>
                  ) : demoMode ? (
                    <>
                      GitHub Pages serves the static frontend only without a Node.js backend (<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">server.ts</code>). Local Demo Mode is enabled—type any message below to test the interface with clearly labelled simulated replies and zero backend requests.
                    </>
                  ) : (
                    <>
                      GitHub Pages serves the frontend UI only and cannot run <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">server.ts</code>. Deploy the backend on a free Node host for live AI, or enable Demo Mode below to test locally.
                    </>
                  )
                ) : (
                  <>
                    Live AI responses require <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">GEMINI_API_KEY</code> in your server environment variables (Settings &gt; Secrets in AI Studio, or <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">.env</code> on your host).
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {hasConfiguredBackend && isStaticHost && onRetryHealth && (
                  <button
                    type="button"
                    onClick={onRetryHealth}
                    disabled={isCheckingHealth}
                    className="min-h-[38px] rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300"
                  >
                    {isCheckingHealth ? 'Checking Backend...' : 'Retry Connection'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleDemoMode}
                  className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    demoMode
                      ? 'bg-amber-900 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300'
                      : 'border border-amber-300 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200 dark:hover:bg-amber-900/40'
                  }`}
                >
                  {demoMode ? 'Demo Mode Enabled (Click to Pause)' : 'Enable Clearly-Labelled Demo Mode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Prompts Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="group flex min-h-[88px] flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50/80 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Icon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span>{item.title}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.prompt}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
