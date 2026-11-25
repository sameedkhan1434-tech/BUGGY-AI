import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Attachment, ChatMessage } from '../types/chat';
import { formatFileSize } from '../utils/files';
import { BuggyLogo } from './BuggyLogo';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  speakingMessageId: string | null;
  ttsSupported: boolean;
  onCopy: (content: string) => Promise<void>;
  onRegenerate: (assistantMessageId: string) => void;
  onToggleSpeak: (message: ChatMessage) => void;
}

const AttachmentChip: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  if (attachment.kind === 'image' && attachment.previewUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          referrerPolicy="no-referrer"
          className="max-h-56 max-w-[260px] object-contain"
        />
        <div className="border-t border-zinc-100 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="block max-w-[220px] truncate">{attachment.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <FileText className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span className="truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums">
        {formatFileSize(attachment.size)}
      </span>
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  speakingMessageId,
  ttsSupported,
  onCopy,
  onRegenerate,
  onToggleSpeak,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (msg: ChatMessage) => {
    await onCopy(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === msg.id ? null : prev));
    }, 1800);
  };

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 py-6 sm:px-6">
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        const isCurrentlyStreaming = isStreaming && isLast && msg.role === 'assistant';

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex flex-col items-end">
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2 flex max-w-[88%] flex-wrap justify-end gap-2 sm:max-w-[78%]">
                  {msg.attachments.map((att) => (
                    <AttachmentChip key={att.id} attachment={att} />
                  ))}
                </div>
              )}

              {msg.content && (
                <div className="max-w-[88%] rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 sm:max-w-[78%] dark:bg-zinc-800 dark:text-zinc-100">
                  {msg.content}
                </div>
              )}
            </div>
          );
        }

        const isSpeaking = speakingMessageId === msg.id;

        return (
          <div key={msg.id} className="group flex items-start gap-3 sm:gap-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              <BuggyLogo size={18} />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              {msg.isDemo && (
                <div className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Demo preview · Simulated response (API key not configured)
                </div>
              )}

              {msg.isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <div className="flex-1">
                      <p className="leading-relaxed">{msg.content}</p>
                      <button
                        type="button"
                        onClick={() => onRegenerate(msg.id)}
                        disabled={isStreaming}
                        className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : isCurrentlyStreaming && !msg.content ? (
                <div className="flex items-center gap-1.5 py-2" aria-label="BUGGY AI is thinking">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s] dark:bg-zinc-500" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s] dark:bg-zinc-500" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" />
                </div>
              ) : (
                <div className="min-w-0">
                  <MarkdownRenderer content={msg.content} />
                  {isCurrentlyStreaming && (
                    <span
                      className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-xs bg-zinc-900 align-middle dark:bg-zinc-100"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}

              {/* Message Footer Controls */}
              {!isCurrentlyStreaming && !msg.isError && msg.content && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(msg)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    aria-label="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {ttsSupported && (
                    <button
                      type="button"
                      onClick={() => onToggleSpeak(msg)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSpeaking
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                      }`}
                      aria-label={isSpeaking ? 'Stop reading aloud' : 'Read response aloud'}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="h-3.5 w-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRegenerate(msg.id)}
                    disabled={isStreaming}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    aria-label="Regenerate response"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Regenerate</span>
                  </button>

                  {msg.stopped && (
                    <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                      · Generation stopped
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
