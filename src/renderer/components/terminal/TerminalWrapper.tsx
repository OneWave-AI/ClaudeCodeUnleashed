import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  X,
  Settings,
  Maximize2,
  Minimize2,
  Terminal as TerminalIcon,
  Sparkles,
  GripVertical,
  SplitSquareVertical,
  ZoomIn,
  ZoomOut,
  Trash2,
  ArrowDownToLine,
  Copy,
  Monitor,
  Clock,
  MemoryStick,
  Highlighter,
  RotateCcw,
  ExternalLink
} from 'lucide-react'
import Terminal, { TerminalRef } from './Terminal'
import PreviewBar from './PreviewBar'

interface Tab {
  id: string
  name: string
  active: boolean
}

interface TerminalWrapperProps {
  onOpenSettings: () => void
  onTerminalData?: (data: string, terminalId: string) => void
  onTerminalIdChange?: (terminalId: string | null) => void
  previewUrl?: string | null
  onClosePreview?: () => void
  onOpenPreview?: (url: string) => void
}

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Format duration
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export default function TerminalWrapper({ onOpenSettings, onTerminalData, onTerminalIdChange, previewUrl, onClosePreview, onOpenPreview }: TerminalWrapperProps) {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', name: 'Claude', active: true }
  ])
  const [isMaximized, setIsMaximized] = useState(false)
  const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 })

  // Split terminal state
  const [isSplit, setIsSplit] = useState(false)

  // Zoom level (percentage)
  const [zoomLevel, setZoomLevel] = useState(100)

  // Scan lines effect
  const [scanLinesEnabled, setScanLinesEnabled] = useState(false)

  // Pattern highlighting
  const [highlightPatterns, setHighlightPatterns] = useState(false)

  // Claude status: 'working' | 'waiting' | 'idle'
  const [claudeStatus, setClaudeStatus] = useState<'working' | 'waiting' | 'idle'>('idle')
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Detected localhost URL for preview
  const [detectedLocalhostUrl, setDetectedLocalhostUrl] = useState<string | null>(null)

  // Detected HTML file for auto-preview
  const [detectedHtmlFile, setDetectedHtmlFile] = useState<string | null>(null)
  const lastDetectedFileRef = useRef<string | null>(null)

  // Drag state for tab reordering
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  // Session duration
  const [sessionStart] = useState(Date.now())
  const [sessionDuration, setSessionDuration] = useState(0)

  // Memory usage
  const [memoryUsage, setMemoryUsage] = useState(0)

  // Terminal refs
  const terminalRef = useRef<TerminalRef>(null)
  const splitTerminalRef = useRef<TerminalRef>(null)

  // Debounce ref to prevent spam-opening URLs
  const lastOpenedUrlRef = useRef<{ url: string; time: number } | null>(null)

  const activeTab = tabs.find(t => t.active)

  // Update session duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStart) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionStart])

  // Update memory usage periodically
  useEffect(() => {
    const updateMemory = () => {
      if ((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory) {
        setMemoryUsage((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize)
      }
    }
    updateMemory()
    const interval = setInterval(updateMemory, 5000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup status timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  const addTab = useCallback(() => {
    const newTab: Tab = {
      id: Date.now().toString(),
      name: `Terminal ${tabs.length + 1}`,
      active: true
    }
    setTabs(tabs.map(t => ({ ...t, active: false })).concat(newTab))
  }, [tabs])

  const closeTab = useCallback((id: string) => {
    if (tabs.length === 1) return
    const newTabs = tabs.filter(t => t.id !== id)
    if (tabs.find(t => t.id === id)?.active && newTabs.length > 0) {
      newTabs[newTabs.length - 1].active = true
    }
    setTabs(newTabs)
  }, [tabs])

  const selectTab = useCallback((id: string) => {
    setTabs(tabs.map(t => ({ ...t, active: t.id === id })))
  }, [tabs])

  // Tab drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (tabId !== draggedTabId) {
      setDragOverTabId(tabId)
    }
  }, [draggedTabId])

  const handleDragLeave = useCallback(() => {
    setDragOverTabId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === targetTabId) return

    const newTabs = [...tabs]
    const draggedIndex = newTabs.findIndex(t => t.id === draggedTabId)
    const targetIndex = newTabs.findIndex(t => t.id === targetTabId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedTab] = newTabs.splice(draggedIndex, 1)
      newTabs.splice(targetIndex, 0, draggedTab)
      setTabs(newTabs)
    }

    setDraggedTabId(null)
    setDragOverTabId(null)
  }, [draggedTabId, tabs])

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null)
    setDragOverTabId(null)
  }, [])

  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 200))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(100)
  }, [])

  // Quick actions
  const handleClear = useCallback(() => {
    terminalRef.current?.clear()
    if (isSplit) {
      splitTerminalRef.current?.clear()
    }
  }, [isSplit])

  const handleScrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom()
    if (isSplit) {
      splitTerminalRef.current?.scrollToBottom()
    }
  }, [isSplit])

  const handleCopyAll = useCallback(() => {
    terminalRef.current?.copyAll()
  }, [])

  const toggleSplit = useCallback(() => {
    setIsSplit(prev => !prev)
  }, [])

  // Detect Claude status from terminal output
  const detectClaudeStatus = useCallback((data: string) => {
    // Clear any pending status timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current)
    }

    const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    const lastLines = cleanData.split('\n').slice(-10).join('\n')

    // Check for working patterns (DON'T interrupt)
    const workingPatterns = [
      /\.\.\.\s*$/m, // Progress dots at end
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/m, // Spinner characters
      /thinking/i,
      /analyzing/i,
      /searching/i,
      /reading/i,
      /writing/i,
      /running/i,
      /executing/i,
      /loading/i,
      /processing/i,
      /building/i,
      /compiling/i,
      /installing/i,
      /fetching/i,
      /creating/i,
      /updating/i,
      /Tool:/i,
      /Read\(/i,
      /Write\(/i,
      /Edit\(/i,
      /Bash\(/i
    ]

    // Check for waiting/prompt patterns
    const waitingPatterns = [
      /❯\s*$/m, // Claude prompt at end
      />\s*$/m, // Generic prompt at end
      /\(y\/n\)\s*$/im, // Yes/no prompt
      /\[Y\/n\]\s*$/im,
      /\[y\/N\]\s*$/im,
      /What would you like/i,
      /How can I help/i,
      /anything else/i,
      /Do you want to/i
    ]

    // Check working patterns first (higher priority)
    for (const pattern of workingPatterns) {
      if (pattern.test(lastLines)) {
        setClaudeStatus('working')
        // Still set timeout to catch when output stops
        statusTimeoutRef.current = setTimeout(() => {
          setClaudeStatus('waiting')
        }, 3000)
        return
      }
    }

    // Check waiting patterns
    for (const pattern of waitingPatterns) {
      if (pattern.test(lastLines)) {
        setClaudeStatus('waiting')
        return
      }
    }

    // Default to working if we're getting output
    setClaudeStatus('working')

    // After 3 seconds of no activity, assume waiting
    statusTimeoutRef.current = setTimeout(() => {
      setClaudeStatus('waiting')
    }, 3000)
  }, [])

  // Detect HTML files in terminal output
  const detectHtmlFile = useCallback((data: string) => {
    const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')

    // Patterns for file creation messages
    const patterns = [
      /(?:created|wrote|saved|generated|file is ready at|file saved to)\s+([^\s]+\.html)/i,
      /([\/~][^\s]+\.html)\b/,
      /Writing to:\s*([^\s]+\.html)/i,
      /Output:\s*([^\s]+\.html)/i
    ]

    for (const pattern of patterns) {
      const match = cleanData.match(pattern)
      if (match && match[1]) {
        let filePath = match[1]
        // Expand ~ to home directory
        if (filePath.startsWith('~')) {
          filePath = filePath.replace('~', '')
        }
        // Only show if it's a new file (not the same one we already detected)
        if (filePath !== lastDetectedFileRef.current) {
          lastDetectedFileRef.current = filePath
          setDetectedHtmlFile(filePath)
        }
        return
      }
    }
  }, [])

  // Watch preview file for live reload
  useEffect(() => {
    if (!previewUrl) return

    const filePath = previewUrl.replace('file://', '')

    // Start watching the file
    window.api.watchFile(filePath)

    // Listen for file changes
    window.api.onFileChanged((changedPath) => {
      if (changedPath === filePath) {
        // Refresh the webview
        const webview = document.getElementById('preview-iframe') as Electron.WebviewTag | null
        if (webview && 'reload' in webview) {
          webview.reload()
        }
      }
    })

    // Cleanup: stop watching when preview closes
    return () => {
      window.api.unwatchFile(filePath)
    }
  }, [previewUrl])

  // Handle preview HTML file
  const handlePreviewHtmlFile = useCallback((filePath: string) => {
    setDetectedHtmlFile(null)
    // Open in the in-app preview pane
    if (onOpenPreview) {
      onOpenPreview(filePath)
    } else {
      // Fallback to external
      window.api.openFileExternal(filePath)
    }
  }, [onOpenPreview])

  const handleDismissHtmlFile = useCallback(() => {
    setDetectedHtmlFile(null)
  }, [])

  // Preview bar handlers
  const handleLocalhostDetected = useCallback((url: string) => {
    setDetectedLocalhostUrl(url)
  }, [])

  const handleDismissPreview = useCallback(() => {
    setDetectedLocalhostUrl(null)
  }, [])

  const handleOpenPreview = useCallback((url: string) => {
    // Debounce: prevent opening same URL within 2 seconds
    const now = Date.now()
    if (lastOpenedUrlRef.current &&
        lastOpenedUrlRef.current.url === url &&
        now - lastOpenedUrlRef.current.time < 2000) {
      return // Skip duplicate open
    }
    lastOpenedUrlRef.current = { url, time: now }
    // For now, open externally (webview can be added later)
    window.api.openUrlExternal(url)
  }, [])

  const handleOpenInBrowser = useCallback((url: string) => {
    // Debounce: prevent opening same URL within 2 seconds
    const now = Date.now()
    if (lastOpenedUrlRef.current &&
        lastOpenedUrlRef.current.url === url &&
        now - lastOpenedUrlRef.current.time < 2000) {
      return // Skip duplicate open
    }
    lastOpenedUrlRef.current = { url, time: now }
    window.api.openUrlExternal(url)
  }, [])

  return (
    <div
      className="h-full flex-1 flex flex-col bg-[#0a0a0a] relative overflow-hidden"
      role="region"
      aria-label="Terminal panel"
    >
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#cc785c]/30 to-transparent" />
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-radial from-[#cc785c]/5 to-transparent" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-purple-500/5 to-transparent" />
      </div>

      {/* Premium Terminal Header */}
      <div className="relative flex items-center justify-between px-2 py-1.5 bg-gradient-to-b from-[#1a1a1a] to-[#141414] border-b border-white/[0.06]">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />

        {/* Tabs */}
        <div
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label="Terminal tabs"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.active}
              aria-controls={`terminal-panel-${tab.id}`}
              id={`terminal-tab-${tab.id}`}
              tabIndex={tab.active ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, tab.id)}
              onDragEnd={handleDragEnd}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 focus-ring ${
                tab.active
                  ? 'bg-[#cc785c]/15 text-[#cc785c] shadow-[0_0_20px_rgba(204,120,92,0.1)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              } ${
                draggedTabId === tab.id ? 'opacity-50 scale-95' : ''
              } ${
                dragOverTabId === tab.id ? 'border-l-2 border-[#cc785c]' : ''
              }`}
              style={{
                transform: draggedTabId === tab.id ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  const nextIndex = (index + 1) % tabs.length
                  selectTab(tabs[nextIndex].id)
                  document.getElementById(`terminal-tab-${tabs[nextIndex].id}`)?.focus()
                } else if (e.key === 'ArrowLeft') {
                  const prevIndex = (index - 1 + tabs.length) % tabs.length
                  selectTab(tabs[prevIndex].id)
                  document.getElementById(`terminal-tab-${tabs[prevIndex].id}`)?.focus()
                }
              }}
            >
              {tab.active && (
                <div
                  className="absolute inset-0 rounded-lg bg-gradient-to-b from-[#cc785c]/10 to-transparent animate-pulse-slow"
                  aria-hidden="true"
                />
              )}
              <GripVertical
                size={10}
                className="relative z-10 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing transition-opacity"
                aria-hidden="true"
              />
              <TerminalIcon size={12} className="relative z-10" aria-hidden="true" />
              <span className="relative z-10">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="relative z-10 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all duration-200 focus-ring"
                  aria-label={`Close ${tab.name} tab`}
                  tabIndex={tab.active ? 0 : -1}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              )}
            </button>
          ))}

          {/* New Tab Button */}
          <button
            onClick={addTab}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all duration-300 hover:scale-110 focus-ring"
            aria-label="Open new terminal tab"
            title="New Terminal"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Right Controls */}
        <div
          className="flex items-center gap-1"
          role="toolbar"
          aria-label="Terminal controls"
        >
          {/* Terminal Size Indicator */}
          <div
            className="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-600 font-mono"
            aria-label={`Terminal size: ${terminalSize.cols} columns by ${terminalSize.rows} rows`}
          >
            {terminalSize.cols}x{terminalSize.rows}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={zoomOut}
              className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all focus-ring"
              aria-label="Zoom out"
              title="Zoom Out"
              disabled={zoomLevel <= 50}
            >
              <ZoomOut size={12} aria-hidden="true" />
            </button>
            <button
              onClick={resetZoom}
              className="px-1.5 py-0.5 rounded text-[10px] text-gray-500 hover:text-white hover:bg-white/5 transition-all focus-ring font-mono"
              aria-label={`Zoom level ${zoomLevel}%`}
              title="Reset Zoom"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all focus-ring"
              aria-label="Zoom in"
              title="Zoom In"
              disabled={zoomLevel >= 200}
            >
              <ZoomIn size={12} aria-hidden="true" />
            </button>
          </div>

          {/* Claude Status */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ml-1 transition-colors ${
              claudeStatus === 'working'
                ? 'bg-green-500/10 text-green-400'
                : claudeStatus === 'waiting'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-gray-500/10 text-gray-400'
            }`}
            role="status"
            aria-live="polite"
            aria-label={`Claude is ${claudeStatus}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                claudeStatus === 'working'
                  ? 'bg-green-400 animate-pulse'
                  : claudeStatus === 'waiting'
                  ? 'bg-amber-400'
                  : 'bg-gray-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-[10px] font-medium">
              {claudeStatus === 'working' ? 'Working...' : claudeStatus === 'waiting' ? 'Waiting' : 'Idle'}
            </span>
          </div>

          <div className="w-px h-4 bg-white/10 mx-1" role="separator" aria-hidden="true" />

          {/* Pattern Highlighting Toggle */}
          <button
            onClick={() => setHighlightPatterns(!highlightPatterns)}
            className={`p-1.5 rounded-lg transition-all focus-ring ${
              highlightPatterns
                ? 'text-[#cc785c] bg-[#cc785c]/10'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            aria-label={highlightPatterns ? 'Disable pattern highlighting' : 'Enable pattern highlighting'}
            aria-pressed={highlightPatterns}
            title="Highlight Patterns (errors, success, etc.)"
          >
            <Highlighter size={14} aria-hidden="true" />
          </button>

          {/* Scan Lines Toggle */}
          <button
            onClick={() => setScanLinesEnabled(!scanLinesEnabled)}
            className={`p-1.5 rounded-lg transition-all focus-ring ${
              scanLinesEnabled
                ? 'text-[#cc785c] bg-[#cc785c]/10'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            aria-label={scanLinesEnabled ? 'Disable scan lines' : 'Enable scan lines'}
            aria-pressed={scanLinesEnabled}
            title="Retro Scan Lines"
          >
            <Monitor size={14} aria-hidden="true" />
          </button>

          {/* Split Terminal */}
          <button
            onClick={toggleSplit}
            className={`p-1.5 rounded-lg transition-all focus-ring ${
              isSplit
                ? 'text-[#cc785c] bg-[#cc785c]/10'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
            aria-label={isSplit ? 'Close split terminal' : 'Split terminal'}
            aria-pressed={isSplit}
            title="Split Terminal"
          >
            <SplitSquareVertical size={14} aria-hidden="true" />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all focus-ring"
            aria-label="Open terminal settings"
            title="Settings"
          >
            <Settings size={14} aria-hidden="true" />
          </button>

          {/* Maximize */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all focus-ring"
            aria-label={isMaximized ? 'Restore terminal size' : 'Maximize terminal'}
            aria-pressed={isMaximized}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        className={`flex-1 relative ${isSplit || previewUrl ? 'flex' : ''}`}
        id={activeTab ? `terminal-panel-${activeTab.id}` : undefined}
        role="tabpanel"
        aria-labelledby={activeTab ? `terminal-tab-${activeTab.id}` : undefined}
        tabIndex={0}
      >
        {/* Inner glow frame */}
        <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
          <div className="absolute inset-0 border border-white/[0.03] rounded-sm" />
          {/* Subtle vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
        </div>

        {/* Main Terminal */}
        <div className={`h-full bg-[#0d0d0d] ${isSplit || previewUrl ? 'w-1/2' : 'w-full'}`}>
          <Terminal
            ref={terminalRef}
            onResize={(cols, rows) => setTerminalSize({ cols, rows })}
            scanLinesEnabled={scanLinesEnabled}
            zoomLevel={zoomLevel}
            highlightPatterns={highlightPatterns}
            onLocalhostDetected={handleLocalhostDetected}
            onTerminalIdReady={(terminalId) => {
              // Notify parent immediately when terminal is ready
              onTerminalIdChange?.(terminalId)
            }}
            onTerminalData={(data, terminalId) => {
              detectClaudeStatus(data)
              detectHtmlFile(data)
              onTerminalData?.(data, terminalId)
            }}
          />
        </div>

        {/* Split Divider */}
        {isSplit && (
          <div
            className="w-1 bg-[#1a1a1a] hover:bg-[#cc785c]/30 cursor-col-resize transition-colors"
            aria-hidden="true"
          />
        )}

        {/* Split Terminal */}
        {isSplit && !previewUrl && (
          <div className="h-full w-1/2 bg-[#0d0d0d]">
            <Terminal
              ref={splitTerminalRef}
              scanLinesEnabled={scanLinesEnabled}
              zoomLevel={zoomLevel}
              highlightPatterns={highlightPatterns}
              onLocalhostDetected={handleLocalhostDetected}
            />
          </div>
        )}

        {/* File Preview Pane */}
        {previewUrl && (
          <>
            {/* Divider */}
            <div
              className="w-1 bg-[#1a1a1a] hover:bg-[#cc785c]/30 cursor-col-resize transition-colors"
              aria-hidden="true"
            />
            {/* Preview Panel */}
            <div className="h-full w-1/2 bg-[#0d0d0d] flex flex-col">
              {/* Preview Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#141414] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#cc785c] animate-pulse" />
                  <span className="text-xs text-gray-400">Preview</span>
                  <span className="text-[10px] text-gray-600 font-mono truncate max-w-[200px]" title={previewUrl}>
                    {previewUrl.split('/').pop()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const webview = document.getElementById('preview-iframe') as Electron.WebviewTag | null
                      if (webview && 'reload' in webview) {
                        webview.reload()
                      }
                    }}
                    className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors"
                    title="Refresh"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => window.api.openFileExternal(previewUrl)}
                    className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors"
                    title="Open in Browser"
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    onClick={onClosePreview}
                    className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors"
                    title="Close Preview"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Preview Content */}
              <div className="flex-1 bg-white overflow-hidden">
                <webview
                  id="preview-iframe"
                  src={`file://${previewUrl.replace('file://', '')}`}
                  className="w-full h-full"
                  style={{ display: 'flex', flex: 1 }}
                />
              </div>
            </div>
          </>
        )}

        {/* Preview Bar for detected localhost URLs */}
        <PreviewBar
          url={detectedLocalhostUrl}
          onDismiss={handleDismissPreview}
          onOpenPreview={handleOpenPreview}
          onOpenInBrowser={handleOpenInBrowser}
        />

        {/* HTML File Detection Bar */}
        {detectedHtmlFile && (
          <div className="absolute bottom-16 left-4 right-4 bg-[#1a1a1c] border border-[#cc785c]/30 rounded-xl shadow-xl z-40 overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#cc785c]/20 rounded-lg">
                  <Monitor size={16} className="text-[#cc785c]" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">HTML file created</p>
                  <p className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{detectedHtmlFile}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreviewHtmlFile(detectedHtmlFile)}
                  className="px-3 py-1.5 bg-[#cc785c] hover:bg-[#b86a50] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Preview
                </button>
                <button
                  onClick={handleDismissHtmlFile}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg text-gray-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Status Bar */}
      <footer className="relative flex items-center justify-between px-3 py-1.5 bg-gradient-to-b from-[#141414] to-[#0d0d0d] border-t border-white/[0.04]">
        {/* Left: Session info */}
        <div
          className="flex items-center gap-3 text-[10px] text-gray-600"
          role="status"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-[#cc785c]" aria-hidden="true" />
            <span>Claude Code</span>
          </div>
          <span className="text-gray-700" aria-hidden="true">|</span>
          <div className="flex items-center gap-1">
            <Clock size={10} aria-hidden="true" />
            <span>{formatDuration(sessionDuration)}</span>
          </div>
          {memoryUsage > 0 && (
            <>
              <span className="text-gray-700" aria-hidden="true">|</span>
              <div className="flex items-center gap-1">
                <MemoryStick size={10} aria-hidden="true" />
                <span>{formatBytes(memoryUsage)}</span>
              </div>
            </>
          )}
        </div>

        {/* Center: Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-600 hover:text-white hover:bg-white/5 transition-all focus-ring"
            aria-label="Clear terminal"
            title="Clear"
          >
            <Trash2 size={10} aria-hidden="true" />
            <span>Clear</span>
          </button>
          <button
            onClick={handleScrollToBottom}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-600 hover:text-white hover:bg-white/5 transition-all focus-ring"
            aria-label="Scroll to bottom"
            title="Scroll to Bottom"
          >
            <ArrowDownToLine size={10} aria-hidden="true" />
            <span>Bottom</span>
          </button>
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-600 hover:text-white hover:bg-white/5 transition-all focus-ring"
            aria-label="Copy all terminal content"
            title="Copy All"
          >
            <Copy size={10} aria-hidden="true" />
            <span>Copy All</span>
          </button>
        </div>

        {/* Right: Quick actions hint */}
        <div
          className="flex items-center gap-4 text-[10px] text-gray-700"
          aria-label="Keyboard shortcuts"
        >
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-gray-600" aria-label="Command">Cmd</kbd>
            <span aria-hidden="true">+</span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-gray-600 ml-0.5">K</kbd>
            <span className="ml-1">Clear</span>
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-gray-600" aria-label="Command">Cmd</kbd>
            <span aria-hidden="true">+</span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-gray-600 ml-0.5">P</kbd>
            <span className="ml-1">Palette</span>
          </span>
        </div>
      </footer>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
