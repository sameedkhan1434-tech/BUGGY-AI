import React, { useMemo, useState } from 'react';
import {
  Check,
  Info,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation, ThemeMode } from '../types/chat';
import { groupConversationsByDate } from '../utils/storage';
import { BuggyLogo } from './BuggyLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  theme: ThemeMode;
  isDesktopCollapsed: boolean;
  isMobileOpen: boolean;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onToggleTheme: () => void;
  onToggleDesktopCollapse: () => void;
  onCloseMobile: () => void;
  onOpenInfoModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  theme,
  isDesktopCollapsed,
  isMobileOpen,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onToggleTheme,
  onToggleDesktopCollapse,
  onCloseMobile,
  onOpenInfoModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conv) => {
      if (conv.title.toLowerCase().includes(q)) return true;
      return conv.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [conversations, searchQuery]);

  const grouped = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations],
  );

  const startEditing = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitEdit = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  const renderSidebarBody = (isMobile: boolean) => (
    <div className="flex h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Top Brand & Collapse/Close */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (isMobile) onCloseMobile();
          }}
          className="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
        >
          <BuggyLogo size={24} className="shrink-0 text-zinc-900 dark:text-zinc-100" />
          <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
            BUGGY AI
          </span>
        </button>

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Primary New Chat CTA */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (isMobile) onCloseMobile();
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-2xs transition-colors hover:bg-zinc-100 active:scale-[0.99] dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">New Chat</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-white pr-8 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {grouped.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {searchQuery.trim()
                ? 'No matching conversations found.'
                : 'Your conversation history will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-2.5 pb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    const isEditing = editingId === conv.id;
                    const isConfirmingDelete = confirmDeleteId === conv.id;

                    return (
                      <li key={conv.id}>
                        {isEditing ? (
                          <div className="flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-600">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(conv.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              aria-label="Conversation title"
                              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
                            />
                            <button
                              type="button"
                              onClick={() => commitEdit(conv.id)}
                              className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                              aria-label="Save title"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                              aria-label="Cancel rename"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : isConfirmingDelete ? (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs dark:border-red-900/60 dark:bg-red-950/40">
                            <span className="truncate font-medium text-red-700 dark:text-red-300">
                              Delete chat?
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteConversation(conv.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`group flex min-h-[42px] items-center justify-between gap-1 rounded-xl px-2.5 transition-colors ${
                              isActive
                                ? 'bg-zinc-200/75 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
                                : 'text-zinc-700 hover:bg-zinc-200/45 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectConversation(conv.id);
                                if (isMobile) onCloseMobile();
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-sm"
                            >
                              <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                              <span className="truncate font-medium">{conv.title}</span>
                            </button>

                            <div
                              className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
                                isActive
                                  ? 'opacity-100'
                                  : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => startEditing(conv, e)}
                                className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-300/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                aria-label={`Rename ${conv.title}`}
                                title="Rename"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(null);
                                  setConfirmDeleteId(conv.id);
                                }}
                                className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                                aria-label={`Delete ${conv.title}`}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Utility Controls */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex min-h-[44px] flex-1 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Dark Mode</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenInfoModal}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Free tier and capabilities info"
            title="Free tier & info"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-zinc-200 transition-[width] duration-200 ease-out dark:border-zinc-800 lg:block ${
          isDesktopCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-[272px]'
        }`}
      >
        <div className="h-full w-[272px]">{renderSidebarBody(false)}</div>
      </aside>

      {/* Mobile & Tablet Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-[290px] max-w-[85vw] border-r border-zinc-200 shadow-xl dark:border-zinc-800">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
