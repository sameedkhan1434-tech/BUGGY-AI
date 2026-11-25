import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Eraser,
  Menu,
  Moon,
  PanelLeftOpen,
  SquarePen,
  Sun,
  X,
} from 'lucide-react';
import { BuggyLogo } from './components/BuggyLogo';
import { Composer } from './components/Composer';
import { InfoModal } from './components/InfoModal';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import type {
  Attachment,
  ChatMessage,
  Conversation,
  HealthStatus,
  ModelId,
  ModelOption,
  ThemeMode,
} from './types/chat';
import { buildLocalDemoResponse } from './utils/demo';
import {
  applyThemeToDocument,
  createId,
  loadConversations,
  loadSelectedModel,
  loadTheme,
  markdownToPlainText,
  saveConversations,
  saveSelectedModel,
  saveTheme,
} from './utils/storage';

function normalizeApiBase(raw: string | undefined): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\/[^/\s]+/i.test(trimmed) ? trimmed : '';
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
const isGitHubPagesHost =
  typeof window !== 'undefined' &&
  window.location.hostname.toLowerCase().endsWith('.github.io');
const isStaticGitHubPages = isGitHubPagesHost && !API_BASE;

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Buggy Standard',
    description: 'Gemini 4 Hydrogen — balanced reasoning, coding, vision & PDFs',
    freeTierNote: 'Free tier supported with rate limits',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Buggy Lite',
    description: 'Gemini 3.1 Flash Lite — ultra-fast responses & higher free quota',
    freeTierNote: 'Free tier supported with higher throughput',
  },
];

const STATIC_HOST_HEALTH: HealthStatus = {
  ok: false,
  aiConfigured: false,
  provider: 'GitHub Pages Static Demo',
  defaultModel: 'gemini-4-hydrogen',
  models: FALLBACK_MODELS,
  freeTierLimits: 'GitHub Pages serves static assets only — running local Demo Mode in your browser.',
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => loadSelectedModel());
  const [health, setHealth] = useState<HealthStatus | null>(() =>
    isStaticGitHubPages ? STATIC_HOST_HEALTH : null,
  );
  const [demoMode, setDemoMode] = useState<boolean>(() => isStaticGitHubPages);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  const userToggledDemoRef = useRef(false);

  const ttsSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const checkHealth = useCallback(async () => {
    if (isStaticGitHubPages) {
      return;
    }

    setIsCheckingHealth(true);
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthStatus;
      if (data && typeof data.ok === 'boolean') {
        setHealth(data);
      }
    } catch {
      setHealth({
        ok: false,
        aiConfigured: false,
        provider: 'Unavailable',
        defaultModel: 'gemini-4-hydrogen',
        models: FALLBACK_MODELS,
        freeTierLimits: API_BASE
          ? 'Configured AI backend is currently unreachable or waking up.'
          : 'Static hosting detected or backend unavailable.',
      });
      if (!API_BASE && !userToggledDemoRef.current) {
        setDemoMode(true);
      }
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Fetch backend health & capabilities on mount (skip on static GitHub Pages)
  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  // Persist conversations
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Persist & apply theme
  useEffect(() => {
    applyThemeToDocument(theme);
    saveTheme(theme);
  }, [theme]);

  // Persist model choice
  useEffect(() => {
    saveSelectedModel(selectedModel);
  }, [selectedModel]);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId],
  );

  const models = health?.models?.length ? health.models : FALLBACK_MODELS;

  const scrollToBottom = useCallback((force = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (force || !userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 120;
  };

  const stopSpeech = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, [ttsSupported]);

  const handleToggleSpeak = useCallback(
    (msg: ChatMessage) => {
      if (!ttsSupported) return;
      if (speakingMessageId === msg.id) {
        stopSpeech();
        return;
      }

      window.speechSynthesis.cancel();
      const plain = markdownToPlainText(msg.content);
      if (!plain) return;

      const utterance = new SpeechSynthesisUtterance(plain);
      utterance.rate = 1;
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      setSpeakingMessageId(msg.id);
      window.speechSynthesis.speak(utterance);
    },
    [speakingMessageId, stopSpeech, ttsSupported],
  );

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setBannerError('Could not copy to clipboard. Check browser clipboard permissions.');
    }
  }, []);

  const updateAssistantMessage = useCallback(
    (
      convId: string,
      assistantId: string,
      updater: (prev: ChatMessage) => ChatMessage,
    ) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== convId) return conv;
          return {
            ...conv,
            updatedAt: Date.now(),
            messages: conv.messages.map((m) => (m.id === assistantId ? updater(m) : m)),
          };
        }),
      );
    },
    [],
  );

  const runDemoStream = useCallback(
    async (
      convId: string,
      assistantId: string,
      promptText: string,
      modelToUse: ModelId,
      messageAttachments: Attachment[] | undefined,
      isStaticHost: boolean,
      signal: AbortSignal,
    ) => {
      const demoResponse = buildLocalDemoResponse({
        promptText,
        model: modelToUse,
        attachments: messageAttachments,
        isStaticHost,
      });

      const words = demoResponse.split(/(\s+)/);
      for (const token of words) {
        if (signal.aborted) {
          updateAssistantMessage(convId, assistantId, (m) => ({
            ...m,
            isDemo: true,
            stopped: true,
          }));
          return;
        }
        updateAssistantMessage(convId, assistantId, (m) => ({
          ...m,
          isDemo: true,
          content: m.content + token,
        }));
        scrollToBottom();
        await new Promise((r) => setTimeout(r, 14));
      }
    },
    [scrollToBottom, updateAssistantMessage],
  );

  const streamResponse = useCallback(
    async (
      convId: string,
      historyForApi: ChatMessage[],
      assistantId: string,
      modelToUse: ModelId,
      isFirstExchange: boolean,
    ) => {
      setIsStreaming(true);
      setBannerError(null);
      userScrolledUpRef.current = false;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const isStaticNoBackend =
          isStaticGitHubPages || (!API_BASE && health !== null && !health.ok);
        const isLiveBackendConfigured = Boolean(health?.ok && health.aiConfigured);

        if (demoMode && !isLiveBackendConfigured) {
          const lastUser = [...historyForApi].reverse().find((m) => m.role === 'user');
          await runDemoStream(
            convId,
            assistantId,
            lastUser?.content || '',
            modelToUse,
            lastUser?.attachments,
            isStaticNoBackend,
            controller.signal,
          );
          return;
        }

        if (isStaticNoBackend) {
          updateAssistantMessage(convId, assistantId, (m) => ({
            ...m,
            isDemo: true,
            content:
              'Live AI backend is not available on static GitHub Pages hosting, and Demo Mode is currently paused. Re-enable Demo Mode on the welcome screen to continue testing local simulated responses without backend requests.',
          }));
          return;
        }

        const payloadMessages = historyForApi
          .filter((m) => !m.isError)
          .map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              kind: a.kind,
              base64: a.base64,
              textContent: a.textContent,
            })),
          }));

        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            messages: payloadMessages,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorText =
            response.status === 404 || response.status === 405
              ? API_BASE
                ? `Configured backend (${API_BASE}) returned HTTP ${response.status}. Verify VITE_API_URL points to your deployed BUGGY AI server.`
                : 'Live AI backend is not available on static GitHub Pages hosting. Enable Demo Mode on the home screen to preview the interface, or connect a free Node.js backend (server.ts).'
              : `Request failed (${response.status}).`;
          try {
            const errJson = (await response.json()) as { error?: string };
            if (errJson?.error) errorText = errJson.error;
          } catch {
            // Keep default status message
          }
          updateAssistantMessage(convId, assistantId, (m) => ({
            ...m,
            content: errorText,
            isError: true,
          }));
          return;
        }

        if (!response.body) {
          throw new Error('Server did not return a readable stream.');
        }

        if (health && !health.ok) {
          void checkHealth();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as {
                type: 'delta' | 'done' | 'error';
                text?: string;
                message?: string;
              };

              if (event.type === 'delta' && event.text) {
                updateAssistantMessage(convId, assistantId, (m) => ({
                  ...m,
                  content: m.content + event.text,
                }));
                scrollToBottom();
              } else if (event.type === 'error') {
                updateAssistantMessage(convId, assistantId, (m) => ({
                  ...m,
                  content: event.message || 'An error occurred while generating the response.',
                  isError: true,
                }));
              }
            } catch {
              // Ignore malformed partial SSE line
            }
          }
        }

        // Generate clean conversation title after first exchange
        if (isFirstExchange) {
          const firstUserMsg = historyForApi.find((m) => m.role === 'user');
          if (firstUserMsg?.content.trim()) {
            fetch(`${API_BASE}/api/title`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: firstUserMsg.content }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { title?: string } | null) => {
                if (data?.title) {
                  setConversations((prev) =>
                    prev.map((c) => (c.id === convId ? { ...c, title: data.title! } : c)),
                  );
                }
              })
              .catch(() => {
                // Keep truncated prompt title
              });
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateAssistantMessage(convId, assistantId, (m) => ({
            ...m,
            stopped: true,
            content: m.content || 'Generation stopped.',
          }));
        } else {
          const rawMsg =
            err instanceof Error
              ? err.message
              : 'Network error while connecting to BUGGY AI server.';
          const message =
            API_BASE && /failed to fetch|networkerror|load failed/i.test(rawMsg)
              ? `Could not reach the configured AI backend (${API_BASE}). If you use a free-tier host, it may still be waking up—wait 30 seconds and click Retry, or verify CORS (ALLOWED_ORIGIN) includes this site.`
              : rawMsg;
          updateAssistantMessage(convId, assistantId, (m) => ({
            ...m,
            content: message,
            isError: true,
          }));
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        scrollToBottom();
      }
    },
    [checkHealth, demoMode, health, runDemoStream, scrollToBottom, updateAssistantMessage],
  );

  const handleSend = useCallback(
    async (overridePrompt?: string) => {
      if (isStreaming) return;
      const textToSend = (overridePrompt !== undefined ? overridePrompt : input).trim();
      const filesToSend = overridePrompt !== undefined ? [] : attachments;

      if (!textToSend && filesToSend.length === 0) return;

      stopSpeech();
      setConfirmClearChat(false);
      setBannerError(null);

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: textToSend,
        attachments: filesToSend.length > 0 ? filesToSend : undefined,
        createdAt: Date.now(),
      };

      const assistantPlaceholder: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      let targetConvId = activeConversationId;
      let historyForApi: ChatMessage[] = [];
      let isFirstExchange = false;

      if (!targetConvId || !conversations.some((c) => c.id === targetConvId)) {
        const initialTitle = textToSend
          ? textToSend.length > 42
            ? `${textToSend.slice(0, 39).trimEnd()}...`
            : textToSend
          : filesToSend[0]?.name || 'New conversation';

        const newConv: Conversation = {
          id: createId(),
          title: initialTitle,
          messages: [userMessage, assistantPlaceholder],
          model: selectedModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        targetConvId = newConv.id;
        historyForApi = [userMessage];
        isFirstExchange = true;

        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
      } else {
        const existing = conversations.find((c) => c.id === targetConvId)!;
        isFirstExchange = existing.messages.length === 0;
        historyForApi = [...existing.messages, userMessage];

        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    title:
                      c.messages.length === 0 && textToSend
                        ? textToSend.length > 42
                          ? `${textToSend.slice(0, 39).trimEnd()}...`
                          : textToSend
                        : c.title,
                    messages: [...c.messages, userMessage, assistantPlaceholder],
                    updatedAt: Date.now(),
                  }
                : c,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt),
        );
      }

      if (overridePrompt === undefined) {
        setInput('');
        setAttachments([]);
      }

      requestAnimationFrame(() => scrollToBottom(true));
      await streamResponse(
        targetConvId,
        historyForApi,
        assistantPlaceholder.id,
        selectedModel,
        isFirstExchange,
      );
    },
    [
      activeConversationId,
      attachments,
      conversations,
      input,
      isStreaming,
      scrollToBottom,
      selectedModel,
      stopSpeech,
      streamResponse,
    ],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleRegenerate = useCallback(
    async (assistantMessageId: string) => {
      if (isStreaming || !activeConversation) return;
      stopSpeech();

      const idx = activeConversation.messages.findIndex((m) => m.id === assistantMessageId);
      if (idx === -1) return;

      // Keep history up to the user message right before this assistant message
      const precedingHistory = activeConversation.messages.slice(0, idx);
      const hasUserPrompt = precedingHistory.some((m) => m.role === 'user');
      if (!hasUserPrompt) return;

      const freshAssistant: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: [...precedingHistory, freshAssistant],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );

      requestAnimationFrame(() => scrollToBottom(true));
      await streamResponse(
        activeConversation.id,
        precedingHistory,
        freshAssistant.id,
        selectedModel,
        false,
      );
    },
    [activeConversation, isStreaming, scrollToBottom, selectedModel, stopSpeech, streamResponse],
  );

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    stopSpeech();
    setConfirmClearChat(false);
    setBannerError(null);
    setActiveConversationId(null);
    setInput('');
    setAttachments([]);
  }, [isStreaming, stopSpeech]);

  const handleClearConversation = useCallback(() => {
    if (!activeConversation) return;
    if (isStreaming) {
      abortControllerRef.current?.abort();
    }
    stopSpeech();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [], updatedAt: Date.now() }
          : c,
      ),
    );
    setConfirmClearChat(false);
  }, [activeConversation, isStreaming, stopSpeech]);

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
    );
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (activeConversationId === id) {
        if (isStreaming) abortControllerRef.current?.abort();
        stopSpeech();
        setActiveConversationId(null);
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
    },
    [activeConversationId, isStreaming, stopSpeech],
  );

  const hasMessages = Boolean(activeConversation && activeConversation.messages.length > 0);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        theme={theme}
        isDesktopCollapsed={isDesktopCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onSelectConversation={(id) => {
          if (isStreaming) abortControllerRef.current?.abort();
          stopSpeech();
          setConfirmClearChat(false);
          setBannerError(null);
          setActiveConversationId(id);
        }}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onToggleDesktopCollapse={() => setIsDesktopCollapsed((prev) => !prev)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Header (<= 52px for mobile sticky budget) */}
        <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white/90 px-3 backdrop-blur-md sm:px-4 dark:border-zinc-800/80 dark:bg-zinc-950/90">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile drawer button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop expand sidebar button when collapsed */}
            {isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(false)}
                className="hidden min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 lg:flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div className="flex min-w-0 items-center gap-2">
              {(isDesktopCollapsed || !hasMessages) && (
                <BuggyLogo
                  size={20}
                  className="shrink-0 text-zinc-900 lg:hidden dark:text-zinc-100"
                />
              )}
              <span className="truncate font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {activeConversation ? activeConversation.title : 'BUGGY AI'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {hasMessages && (
              confirmClearChat ? (
                <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="hidden text-zinc-600 sm:inline dark:text-zinc-300">
                    Clear messages?
                  </span>
                  <button
                    type="button"
                    onClick={handleClearConversation}
                    className="rounded-lg bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearChat(false)}
                    className="rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearChat(true)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <Eraser className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )
            )}

            {/* Quick Mobile New Chat & Theme Toggle */}
            <button
              type="button"
              onClick={handleNewChat}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="New chat"
              title="New chat"
            >
              <SquarePen className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Scrollable Chat Viewport */}
        <main
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          {!hasMessages ? (
            <WelcomeScreen
              health={health}
              demoMode={demoMode}
              hasConfiguredBackend={Boolean(API_BASE)}
              isCheckingHealth={isCheckingHealth}
              onRetryHealth={() => void checkHealth()}
              onToggleDemoMode={() => {
                userToggledDemoRef.current = true;
                setDemoMode((prev) => !prev);
              }}
              onSelectPrompt={(prompt) => {
                void handleSend(prompt);
              }}
            />
          ) : (
            <MessageList
              messages={activeConversation!.messages}
              isStreaming={isStreaming}
              speakingMessageId={speakingMessageId}
              ttsSupported={ttsSupported}
              onCopy={handleCopy}
              onRegenerate={handleRegenerate}
              onToggleSpeak={handleToggleSpeak}
            />
          )}
        </main>

        {/* Inline Dismissible Banner for File/Voice/Clipboard Notices */}
        {bannerError && (
          <div className="mx-auto mb-2 w-full max-w-[760px] px-3 sm:px-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{bannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <Composer
          input={input}
          attachments={attachments}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          models={models}
          onInputChange={setInput}
          onAddAttachments={(newItems) => {
            setBannerError(null);
            setAttachments((prev) => [...prev, ...newItems].slice(0, 5));
          }}
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((item) => item.id !== id))
          }
          onSend={() => void handleSend()}
          onStop={handleStop}
          onSelectModel={setSelectedModel}
          onFileError={setBannerError}
        />
      </div>

      <InfoModal
        isOpen={isInfoModalOpen}
        health={health}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
