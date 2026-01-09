import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import {
  Clock,
  Folder,
  ArrowLeft,
  Play,
  Search,
  Calendar,
  ArrowUpDown,
  Pin,
  PinOff,
  Trash2,
  Download,
  MessageSquare,
  Timer,
  ChevronDown,
  X,
  AlertTriangle,
  Zap,
  User,
  Bot,
  PanelRightClose,
  PanelRight
} from 'lucide-react'
import type { Conversation, ConversationMessage, ConversationStats } from '../../../shared/types'
import { useToast, LoadingError, NoConversationsEmptyState } from '../common'
import { logger } from '../../utils'

type DateFilter = 'all' | 'today' | 'week' | 'month'
type SortBy = 'date' | 'project'
type GroupBy = 'none' | 'project' | 'date'

interface HistoryBrowserProps {
  onBack: () => void
  onResumeSession: (conversation: Conversation) => void
}

const ITEMS_PER_PAGE = 20

// Simple markdown code block renderer
function renderMessageContent(content: string): React.ReactNode {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {content.slice(lastIndex, match.index)}
        </span>
      )
    }

    // Add the code block
    const language = match[1] || ''
    const code = match[2].trim()
    parts.push(
      <div key={`code-${match.index}`} className="my-2 rounded-lg overflow-hidden">
        {language && (
          <div className="px-3 py-1.5 text-xs text-gray-400 bg-black/40 border-b border-white/5">
            {language}
          </div>
        )}
        <pre className="p-3 bg-black/30 text-sm overflow-x-auto">
          <code className="text-gray-300">{code}</code>
        </pre>
      </div>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>
    )
  }

  return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{content}</span>
}

export default function HistoryBrowser({ onBack, onResumeSession }: HistoryBrowserProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [showFilters, setShowFilters] = useState(false)
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [searching, setSearching] = useState(false)

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Selected conversation for preview panel
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [previewMessages, setPreviewMessages] = useState<ConversationMessage[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showPreviewPanel, setShowPreviewPanel] = useState(true)

  // Scroll container ref for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)

  const { showToast } = useToast()

  const loadConversations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.listConversations()
      setConversations(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations'
      setError(errorMessage)
      logger.error(err instanceof Error ? err : errorMessage, {
        component: 'HistoryBrowser',
        action: 'loadConversations'
      })
      showToast('error', 'Failed to load history', 'Please try again')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setPreviewMessages([])
      return
    }

    const loadMessages = async () => {
      setLoadingPreview(true)
      try {
        const messages = await window.api.getConversationMessages(
          selectedConversation.id,
          selectedConversation.projectFolder
        )
        setPreviewMessages(messages)
      } catch (err) {
        console.error('Failed to load messages:', err)
        setPreviewMessages([])
      } finally {
        setLoadingPreview(false)
      }
    }

    loadMessages()
  }, [selectedConversation])

  // Infinite scroll handler
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollHeight - scrollTop - clientHeight < 200) {
        setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      loadConversations()
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await window.api.searchConversations(searchQuery)
        setConversations(results)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed'
        logger.warn(err instanceof Error ? err : errorMessage, {
          component: 'HistoryBrowser',
          action: 'searchConversations',
          metadata: { query: searchQuery }
        })
        showToast('warning', 'Search failed', 'Try a different search term')
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, loadConversations, showToast])

  const filterByDate = useCallback(
    (conv: Conversation) => {
      if (dateFilter === 'all') return true

      const now = Date.now()
      const timestamp = conv.timestamp

      switch (dateFilter) {
        case 'today': {
          const todayStart = new Date().setHours(0, 0, 0, 0)
          return timestamp >= todayStart
        }
        case 'week': {
          const weekAgo = now - 7 * 24 * 60 * 60 * 1000
          return timestamp >= weekAgo
        }
        case 'month': {
          const monthAgo = now - 30 * 24 * 60 * 60 * 1000
          return timestamp >= monthAgo
        }
        default:
          return true
      }
    },
    [dateFilter]
  )

  const filteredAndSortedConversations = useMemo(() => {
    let result = conversations.filter(filterByDate)

    // Sort
    if (sortBy === 'date') {
      result.sort((a, b) => {
        // Pinned first
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.timestamp - a.timestamp
      })
    } else if (sortBy === 'project') {
      result.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return a.projectFolder.localeCompare(b.projectFolder)
      })
    }

    return result
  }, [conversations, filterByDate, sortBy])

  const displayedConversations = useMemo(() => {
    return filteredAndSortedConversations.slice(0, displayCount)
  }, [filteredAndSortedConversations, displayCount])

  const groupedConversations = useMemo(() => {
    if (groupBy === 'none') {
      return { All: displayedConversations }
    }

    if (groupBy === 'project') {
      const groups: Record<string, Conversation[]> = {}
      displayedConversations.forEach((c) => {
        const project = c.projectFolder || 'Unknown'
        if (!groups[project]) {
          groups[project] = []
        }
        groups[project].push(c)
      })
      return groups
    }

    if (groupBy === 'date') {
      const groups: Record<string, Conversation[]> = {}
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
      const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000

      displayedConversations.forEach((c) => {
        let group: string
        if (c.timestamp >= todayStart) {
          group = 'Today'
        } else if (c.timestamp >= yesterdayStart) {
          group = 'Yesterday'
        } else if (c.timestamp >= weekStart) {
          group = 'This Week'
        } else {
          group = 'Older'
        }

        if (!groups[group]) {
          groups[group] = []
        }
        groups[group].push(c)
      })

      // Sort groups in order
      const ordered: Record<string, Conversation[]> = {}
      ;['Today', 'Yesterday', 'This Week', 'Older'].forEach((key) => {
        if (groups[key]) {
          ordered[key] = groups[key]
        }
      })
      return ordered
    }

    return { All: displayedConversations }
  }, [displayedConversations, groupBy])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const formatMessageTime = (timestamp?: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatMessageDate = (timestamp?: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handlePin = async (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await window.api.pinConversation(
        conversation.id,
        conversation.projectFolder,
        !conversation.pinned
      )
      if (result.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversation.id && c.projectFolder === conversation.projectFolder
              ? { ...c, pinned: !c.pinned }
              : c
          )
        )
        showToast('success', conversation.pinned ? 'Unpinned' : 'Pinned', 'Conversation updated')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin conversation'
      logger.error(err instanceof Error ? err : errorMessage, {
        component: 'HistoryBrowser',
        action: 'pinConversation',
        metadata: { conversationId: conversation.id }
      })
      showToast('error', 'Failed to update', errorMessage)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const result = await window.api.deleteConversation(
        deleteTarget.id,
        deleteTarget.projectFolder
      )
      if (result.success) {
        setConversations((prev) =>
          prev.filter(
            (c) =>
              !(c.id === deleteTarget.id && c.projectFolder === deleteTarget.projectFolder)
          )
        )
        // Clear selection if deleted conversation was selected
        if (selectedConversation?.id === deleteTarget.id) {
          setSelectedConversation(null)
        }
        setDeleteTarget(null)
        showToast('success', 'Conversation deleted', 'The conversation has been removed')
      } else {
        showToast('error', 'Delete failed', result.error || 'Could not delete conversation')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation'
      logger.error(err instanceof Error ? err : errorMessage, {
        component: 'HistoryBrowser',
        action: 'deleteConversation',
        metadata: { conversationId: deleteTarget.id }
      })
      showToast('error', 'Delete failed', errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = async (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await window.api.exportConversation(conversation.id, conversation.projectFolder, {
        includeStats: true,
        includeTimestamps: true
      })
      showToast('success', 'Exported', 'Conversation exported to Markdown')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export conversation'
      logger.error(err instanceof Error ? err : errorMessage, {
        component: 'HistoryBrowser',
        action: 'exportConversation',
        metadata: { conversationId: conversation.id }
      })
      showToast('error', 'Export failed', errorMessage)
    }
  }

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
  }

  const pinnedCount = conversations.filter((c) => c.pinned).length
  const hasMore = displayCount < filteredAndSortedConversations.length

  // Page entry animation
  const [pageVisible, setPageVisible] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPageVisible(true))
    })
  }, [])

  return (
    <div className={`h-full flex flex-col bg-[#0d0d0d] transition-all duration-500 ease-out ${
      pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`}>
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-white">History</h1>
          <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-400">
            {filteredAndSortedConversations.length}
          </span>
          {pinnedCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#cc785c]/20 text-[#cc785c]">
              <Pin size={10} />
              {pinnedCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#cc785c]/50"
            />
            {searching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-[#cc785c]/30 border-t-[#cc785c] rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              showFilters
                ? 'bg-[#cc785c]/20 text-[#cc785c]'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
            Filters
          </button>

          {/* Panel Toggle */}
          <button
            onClick={() => setShowPreviewPanel(!showPreviewPanel)}
            className={`p-1.5 rounded-lg transition-colors ${
              showPreviewPanel
                ? 'bg-[#cc785c]/20 text-[#cc785c]'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={showPreviewPanel ? 'Hide preview' : 'Show preview'}
          >
            {showPreviewPanel ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>
        </div>
      </div>

      {/* Compact Filters Bar */}
      {showFilters && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] animate-fade-in-down">
          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-500" />
            <div className="flex gap-0.5">
              {(['all', 'today', 'week', 'month'] as DateFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    dateFilter === filter
                      ? 'bg-[#cc785c]/20 text-[#cc785c]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-white/10" />

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-gray-500" />
            <div className="flex gap-0.5">
              {(['date', 'project'] as SortBy[]).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    sortBy === sort
                      ? 'bg-[#cc785c]/20 text-[#cc785c]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-white/10" />

          {/* Group By */}
          <div className="flex items-center gap-1.5">
            <Folder size={12} className="text-gray-500" />
            <div className="flex gap-0.5">
              {(['none', 'project', 'date'] as GroupBy[]).map((group) => (
                <button
                  key={group}
                  onClick={() => setGroupBy(group)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    groupBy === group
                      ? 'bg-[#cc785c]/20 text-[#cc785c]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {group === 'none' ? 'None' : group.charAt(0).toUpperCase() + group.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Conversation List */}
        <div
          ref={scrollContainerRef}
          className={`overflow-y-auto p-4 border-r border-white/[0.06] transition-all duration-300 ${
            showPreviewPanel ? 'w-[380px] min-w-[380px]' : 'flex-1'
          }`}
        >
          {error ? (
            <LoadingError
              resource="conversations"
              onRetry={loadConversations}
            />
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#cc785c]/30 border-t-[#cc785c] rounded-full animate-spin" />
                <span className="text-sm">Loading conversations...</span>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <NoConversationsEmptyState onStartNew={onBack} />
          ) : filteredAndSortedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-xl bg-white/5 mb-3">
                <Search size={24} className="text-gray-500" />
              </div>
              <h3 className="text-base font-medium text-white mb-1">No matches</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedConversations).map(([group, convos]) => (
                <div key={group}>
                  {groupBy !== 'none' && (
                    <div className="flex items-center gap-2 mb-2">
                      {groupBy === 'project' ? (
                        <Folder size={12} className="text-[#cc785c]" />
                      ) : (
                        <Calendar size={12} className="text-[#cc785c]" />
                      )}
                      <span className="text-xs font-medium text-gray-400">
                        {groupBy === 'project' ? group.split('/').pop() || group : group}
                      </span>
                      <span className="text-xs text-gray-600">{convos.length}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {convos.map((conversation, idx) => (
                      <ConversationListItem
                        key={`${conversation.projectFolder}:${conversation.id}`}
                        conversation={conversation}
                        formatDate={formatDate}
                        isSelected={selectedConversation?.id === conversation.id}
                        onSelect={() => handleSelectConversation(conversation)}
                        onResume={() => onResumeSession(conversation)}
                        onPin={(e) => handlePin(conversation, e)}
                        onDelete={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(conversation)
                        }}
                        onExport={(e) => handleExport(conversation, e)}
                        index={idx}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load More / Infinite Scroll Indicator */}
              {hasMore && (
                <div className="flex justify-center py-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                    Scroll for more...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Message Preview */}
        {showPreviewPanel && (
          <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
            {selectedConversation ? (
              <>
                {/* Preview Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Folder size={12} className="text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-500 truncate">
                        {selectedConversation.projectFolder.split('/').pop() || selectedConversation.projectFolder}
                      </span>
                      {selectedConversation.pinned && (
                        <Pin size={10} className="text-[#cc785c] flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(selectedConversation.timestamp)}
                      </span>
                      {selectedConversation.stats && (
                        <>
                          <span className="flex items-center gap-1">
                            <MessageSquare size={10} />
                            {selectedConversation.stats.messageCount} messages
                          </span>
                          {selectedConversation.stats.estimatedTokens && (
                            <span className="flex items-center gap-1">
                              <Zap size={10} />
                              ~{formatNumber(selectedConversation.stats.estimatedTokens)} tokens
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onResumeSession(selectedConversation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cc785c]/10 text-[#cc785c] text-sm font-medium hover:bg-[#cc785c]/20 transition-all"
                  >
                    <Play size={14} />
                    Resume
                  </button>
                </div>

                {/* Messages */}
                <div
                  ref={previewScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {loadingPreview ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <div className="w-6 h-6 border-2 border-[#cc785c]/30 border-t-[#cc785c] rounded-full animate-spin" />
                        <span className="text-sm">Loading messages...</span>
                      </div>
                    </div>
                  ) : previewMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageSquare size={32} className="mb-2 opacity-50" />
                      <span className="text-sm">No messages found</span>
                    </div>
                  ) : (
                    previewMessages.map((message, idx) => (
                      <MessageBubble
                        key={idx}
                        message={message}
                        formatTime={formatMessageTime}
                        formatDate={formatMessageDate}
                        showDate={idx === 0 || Boolean(
                          message.timestamp &&
                          previewMessages[idx - 1]?.timestamp &&
                          formatMessageDate(message.timestamp) !== formatMessageDate(previewMessages[idx - 1]?.timestamp)
                        )}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <div className="p-4 rounded-2xl bg-white/[0.02] mb-4">
                  <MessageSquare size={40} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium text-gray-400 mb-1">Select a conversation</h3>
                <p className="text-sm text-gray-600">Click on a conversation to preview its messages</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Delete Conversation</h3>
              </div>

              <p className="text-sm text-gray-400 mb-2">
                Are you sure you want to delete this conversation? This action cannot be undone.
              </p>

              <div className="p-3 rounded-lg bg-white/5 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Folder size={12} />
                  {deleteTarget.projectFolder}
                </div>
                <p className="text-sm text-white truncate">
                  {deleteTarget.preview || 'No preview available'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact conversation list item for split view
const ConversationListItem = memo(function ConversationListItem({
  conversation,
  formatDate,
  isSelected,
  onSelect,
  onResume,
  onPin,
  onDelete,
  onExport,
  index = 0
}: {
  conversation: Conversation
  formatDate: (ts: number) => string
  isSelected: boolean
  onSelect: () => void
  onResume: () => void
  onPin: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onExport: (e: React.MouseEvent) => void
  index?: number
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 20)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      } ${
        isSelected
          ? 'border-[#cc785c]/50 bg-[#cc785c]/10'
          : conversation.pinned
            ? 'border-[#cc785c]/20 bg-[#cc785c]/5 hover:border-[#cc785c]/40'
            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {conversation.pinned && <Pin size={10} className="text-[#cc785c]" />}
          <Clock size={10} className="text-gray-500" />
          <span className="text-xs text-gray-500">{formatDate(conversation.timestamp)}</span>
          {conversation.stats && (
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <MessageSquare size={9} />
              {conversation.stats.messageCount}
            </span>
          )}
        </div>
        {conversation.preview && (
          <p className="text-xs text-gray-400 truncate">{conversation.preview}</p>
        )}
      </div>

      {/* Actions - show on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
        <button
          onClick={onPin}
          className={`p-1.5 rounded transition-colors ${
            conversation.pinned
              ? 'text-[#cc785c] hover:bg-[#cc785c]/20'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title={conversation.pinned ? 'Unpin' : 'Pin'}
        >
          {conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={onExport}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Export"
        >
          <Download size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onResume()
          }}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#cc785c]/10 text-[#cc785c] text-xs font-medium hover:bg-[#cc785c]/20 transition-all ml-1"
        >
          <Play size={10} />
          Resume
        </button>
      </div>
    </div>
  )
})

// Message bubble component for preview panel
function MessageBubble({
  message,
  formatTime,
  formatDate,
  showDate
}: {
  message: ConversationMessage
  formatTime: (ts?: number) => string
  formatDate: (ts?: number) => string
  showDate?: boolean
}) {
  const isHuman = message.type === 'human'

  return (
    <>
      {showDate && message.timestamp && (
        <div className="flex items-center justify-center my-4">
          <div className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-500">
            {formatDate(message.timestamp)}
          </div>
        </div>
      )}
      <div className={`flex gap-3 ${isHuman ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isHuman ? 'bg-[#2a4a6a]' : 'bg-[#2a2a2a]'
        }`}>
          {isHuman ? (
            <User size={14} className="text-blue-300" />
          ) : (
            <Bot size={14} className="text-[#cc785c]" />
          )}
        </div>
        <div className={`flex-1 max-w-[85%] ${isHuman ? 'items-end' : 'items-start'}`}>
          <div className={`rounded-xl px-4 py-3 ${
            isHuman
              ? 'bg-[#1e3a5f] text-gray-200 rounded-tr-sm'
              : 'bg-[#1a1a1a] text-gray-300 border border-white/[0.06] rounded-tl-sm'
          }`}>
            <div className="text-sm leading-relaxed break-words">
              {renderMessageContent(message.content)}
            </div>
          </div>
          {message.timestamp && (
            <div className={`mt-1 text-xs text-gray-600 ${isHuman ? 'text-right' : 'text-left'}`}>
              {formatTime(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function formatDuration(ms: number): string {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`
  } else if (ms < 3600000) {
    return `${Math.round(ms / 60000)}m`
  } else {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.round((ms % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}
