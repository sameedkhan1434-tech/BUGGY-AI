import React from 'react';
import { X } from 'lucide-react';
import type { HealthStatus } from '../types/chat';
import { BuggyLogo } from './BuggyLogo';

interface InfoModalProps {
  isOpen: boolean;
  health: HealthStatus | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, health, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buggy-info-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BuggyLogo size={22} className="text-zinc-900 dark:text-zinc-100" />
            <h2
              id="buggy-info-title"
              className="font-display text-lg font-semibold text-zinc-950 dark:text-zinc-50"
            >
              About BUGGY AI
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              100% Free-Tier Architecture
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              BUGGY AI has no paid plans, subscriptions, or paywalls. Requests run securely through the backend using Google&apos;s free-tier Gemini models (<code className="font-mono">gemini-4-hydrogen</code> and <code className="font-mono">gemini-3.1-flash-lite</code>). Free-tier quotas apply per minute and per day; if rate-limited, switch to <strong>Buggy Lite</strong> or wait briefly.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Supported Attachments &amp; Voice
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Attach PNG, JPEG, WebP, GIF images (up to 10 MB), PDFs (up to 10 MB), and text/code files (up to 1 MB). Voice input and Read Aloud use your browser&apos;s built-in Web Speech APIs (supported in Android Chrome and desktop Chrome/Edge).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Local Chat History
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Your conversations are saved locally in your browser&apos;s storage without requiring an account or external database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
