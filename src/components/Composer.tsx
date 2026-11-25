import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Plus,
  Square,
  X,
} from 'lucide-react';
import type { Attachment, ModelId, ModelOption } from '../types/chat';
import { formatFileSize, processUploadedFile } from '../utils/files';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface ComposerProps {
  input: string;
  attachments: Attachment[];
  isStreaming: boolean;
  selectedModel: ModelId;
  models: ModelOption[];
  onInputChange: (value: string) => void;
  onAddAttachments: (newItems: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onStop: () => void;
  onSelectModel: (model: ModelId) => void;
  onFileError: (message: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  attachments,
  isStreaming,
  selectedModel,
  models,
  onInputChange,
  onAddAttachments,
  onRemoveAttachment,
  onSend,
  onStop,
  onSelectModel,
  onFileError,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextBeforeSpeechRef = useRef<string>('');

  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  // Auto-resize textarea smoothly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isModelMenuOpen && !isAttachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen, isAttachMenuOpen]);

  // Cleanup active voice recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = 5 - attachments.length;
    if (remainingSlots <= 0) {
      onFileError('You can attach up to 5 files per message.');
      return;
    }

    const filesToProcess = Array.from(fileList).slice(0, remainingSlots);
    const processed: Attachment[] = [];

    for (const file of filesToProcess) {
      try {
        const item = await processUploadedFile(file);
        processed.push(item);
      } catch (err) {
        onFileError(err instanceof Error ? err.message : 'Unable to attach file.');
      }
    }

    if (processed.length > 0) {
      onAddAttachments(processed);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      pastedFiles.forEach((f) => dt.items.add(f));
      await handleFiles(dt.files);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      onFileError(
        'Voice input is not supported in this browser. Try Chrome or Edge on desktop or Android.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      baseTextBeforeSpeechRef.current = input.trimEnd();

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const spoken = `${finalTranscript}${interimTranscript}`.trim();
        const base = baseTextBeforeSpeechRef.current;
        const combined = base ? (spoken ? `${base} ${spoken}` : base) : spoken;
        onInputChange(combined);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          onFileError('Microphone permission was denied. Enable microphone access to use voice input.');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onFileError(`Voice input stopped (${event.error}).`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      onFileError('Could not start voice input on this device.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Avoid hijacking Enter on mobile soft keyboards unless user explicitly hits send
      const isCoarsePointer =
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
      if (!isCoarsePointer) {
        e.preventDefault();
        if (canSend) {
          if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
          }
          onSend();
        }
      }
    }
  };

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <div className="mx-auto w-full max-w-[760px] px-3 pb-3 sm:px-6 sm:pb-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          await handleFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-2xl border bg-white shadow-xs transition-colors dark:bg-zinc-900 ${
          isDragging
            ? 'border-zinc-900 ring-2 ring-zinc-900/10 dark:border-zinc-100 dark:ring-zinc-100/10'
            : 'border-zinc-200 focus-within:border-zinc-400 dark:border-zinc-800 dark:focus-within:border-zinc-600'
        }`}
      >
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-zinc-100 px-3.5 pt-3 pb-2.5 dark:border-zinc-800">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 pr-7 text-xs dark:border-zinc-700 dark:bg-zinc-800"
              >
                {att.kind === 'image' && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-200/70 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    <FileText className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="max-w-[140px] truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {att.name}
                  </p>
                  <p className="font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                    {formatFileSize(att.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isListening ? 'Listening... speak clearly' : 'Message BUGGY AI...'
            }
            aria-label="Message BUGGY AI"
            className="max-h-[200px] min-h-[28px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Bottom Controls Bar */}
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-2.5">
          <div className="flex items-center gap-1">
            <input
              ref={photoInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (e) => {
                await handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,.txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.xml,.yaml,.yml,.log"
              onChange={async (e) => {
                await handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <div className="relative" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsModelMenuOpen(false);
                  setIsAttachMenuOpen((prev) => !prev);
                }}
                disabled={isStreaming}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Add photos or files"
                aria-haspopup="menu"
                aria-expanded={isAttachMenuOpen}
                title="Add photos or files"
              >
                <Plus className={`h-5 w-5 transition-transform duration-150 ${isAttachMenuOpen ? 'rotate-45' : ''}`} />
              </button>

              {isAttachMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 z-30 mb-2 w-52 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      photoInputRef.current?.click();
                    }}
                    className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ImageIcon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span>Upload photo</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span>Upload PDF or file</span>
                  </button>
                </div>
              )}
            </div>

            {/* Free-tier Model Selector */}
            {models.length > 0 && (
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsModelMenuOpen((prev) => !prev)}
                  disabled={isStreaming}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-haspopup="listbox"
                  aria-expanded={isModelMenuOpen}
                >
                  <span className="whitespace-nowrap">{currentModel?.label || 'Buggy Standard'}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </button>

                {isModelMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {models.map((m) => {
                      const active = m.id === selectedModel;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onSelectModel(m.id);
                            setIsModelMenuOpen(false);
                          }}
                          className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${
                            active
                              ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
                              : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <span className="text-xs font-semibold">{m.label}</span>
                          <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {m.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isStreaming}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
                isListening
                  ? 'bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-900'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop voice input' : 'Voice input'}
            >
              {isListening ? (
                <MicOff className="h-5 w-5 animate-pulse" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                  }
                  onSend();
                }}
                disabled={!canSend}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-zinc-900 text-white transition-all hover:bg-zinc-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                aria-label="Send message"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
        BUGGY AI can make mistakes. Verify important code and facts.
      </p>
    </div>
  );
};
