import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store'
import { ChevronUp, ChevronDown, X, Search, Copy, Clipboard, Trash2, ArrowDownToLine } from 'lucide-react'

// ANSI color codes for terminal highlighting
const ANSI_COLORS = {
  // Standard colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  // Reset
  reset: '\x1b[0m',
  // Bold
  bold: '\x1b[1m'
}

// Pattern highlighter for terminal output
interface HighlightPattern {
  regex: RegExp
  color: string
  bold?: boolean
}

const HIGHLIGHT_PATTERNS: HighlightPattern[] = [
  // Errors
  { regex: /\b(error|Error|ERROR|failed|Failed|FAILED|exception|Exception)\b/g, color: ANSI_COLORS.brightRed, bold: true },
  { regex: /\b(fatal|Fatal|FATAL|critical|Critical|CRITICAL)\b/g, color: ANSI_COLORS.brightRed, bold: true },
  // Warnings
  { regex: /\b(warning|Warning|WARNING|warn|Warn|WARN)\b/g, color: ANSI_COLORS.brightYellow },
  // Success
  { regex: /\b(success|Success|SUCCESS|passed|Passed|PASSED|ok|OK|done|Done|DONE)\b/g, color: ANSI_COLORS.brightGreen },
  { regex: /\b(completed|Completed|COMPLETED)\b/g, color: ANSI_COLORS.brightGreen },
  // Info
  { regex: /\b(info|Info|INFO|note|Note|NOTE)\b/g, color: ANSI_COLORS.brightBlue },
  // File paths (simple detection)
  { regex: /(?:^|\s)(\/[\w\-./]+(?:\.\w+)?)/g, color: ANSI_COLORS.cyan },
  // URLs
  { regex: /(https?:\/\/[^\s]+)/g, color: ANSI_COLORS.cyan },
  // Numbers/versions
  { regex: /\b(v?\d+\.\d+(?:\.\d+)?)\b/g, color: ANSI_COLORS.magenta }
]

// All 8 themes matching SettingsPanel.tsx
const THEMES: Record<string, Record<string, string>> = {
  default: {
    background: '#1a1a1a',
    foreground: '#e0e0e0',
    cursor: '#cc785c',
    cursorAccent: '#1a1a1a',
    selectionBackground: 'rgba(204, 120, 92, 0.3)'
  },
  pro: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#569cd6',
    cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(86, 156, 214, 0.3)'
  },
  homebrew: {
    background: '#000000',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(0, 255, 0, 0.3)'
  },
  ocean: {
    background: '#1b2b34',
    foreground: '#c0c5ce',
    cursor: '#5fb3b3',
    cursorAccent: '#1b2b34',
    selectionBackground: 'rgba(95, 179, 179, 0.3)'
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#ff79c6',
    cursorAccent: '#282a36',
    selectionBackground: 'rgba(255, 121, 198, 0.3)'
  },
  neon: {
    background: '#0a0a0f',
    foreground: '#e0e0e0',
    cursor: '#00ffff',
    cursorAccent: '#0a0a0f',
    selectionBackground: 'rgba(0, 255, 255, 0.3)'
  },
  aurora: {
    background: '#0d0d0d',
    foreground: '#e0e0e0',
    cursor: '#ff9500',
    cursorAccent: '#0d0d0d',
    selectionBackground: 'rgba(255, 149, 0, 0.3)'
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#b58900',
    cursorAccent: '#002b36',
    selectionBackground: 'rgba(181, 137, 0, 0.3)'
  }
}

// Context menu item interface
interface ContextMenuItem {
  label: string
  icon: React.ReactNode
  action: () => void
  shortcut?: string
  divider?: boolean
}

export interface TerminalRef {
  clear: () => void
  scrollToBottom: () => void
  copyAll: () => void
  getTerminalId: () => string | null
}

interface TerminalProps {
  onResize?: (cols: number, rows: number) => void
  scanLinesEnabled?: boolean
  zoomLevel?: number
  highlightPatterns?: boolean
  onLocalhostDetected?: (url: string) => void
  onTerminalData?: (data: string, terminalId: string) => void
  onTerminalIdReady?: (terminalId: string) => void
}

// Regex to detect localhost URLs
const LOCALHOST_REGEX = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s)}\]'"]*)?/g

// Function to apply highlighting to terminal output
const applyHighlighting = (text: string, enabled: boolean): string => {
  if (!enabled) return text

  // Don't highlight text that already contains ANSI codes
  if (text.includes('\x1b[')) return text

  let result = text

  for (const pattern of HIGHLIGHT_PATTERNS) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0
    result = result.replace(pattern.regex, (match) => {
      const prefix = pattern.bold ? ANSI_COLORS.bold : ''
      return `${prefix}${pattern.color}${match}${ANSI_COLORS.reset}`
    })
  }

  return result
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({ onResize, scanLinesEnabled = false, zoomLevel = 100, highlightPatterns = false, onLocalhostDetected, onTerminalData, onTerminalIdReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const lastDetectedUrlRef = useRef<string | null>(null)

  const { theme, fontSize, fontFamily, setActiveTerminalId } = useAppStore()

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ current: number; total: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Scroll buttons visibility
  const [isHovering, setIsHovering] = useState(false)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Activity state tracking
  type ActivityState = 'idle' | 'user_typing' | 'claude_working' | 'claude_waiting'
  const [activityState, setActivityState] = useState<ActivityState>('idle')
  const [activityLog, setActivityLog] = useState<{ state: ActivityState; time: Date }[]>([])
  const lastOutputRef = useRef<number>(Date.now())
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const outputAccumulatorRef = useRef<string>('')

  // Detect if Claude is waiting for input (prompt patterns)
  const PROMPT_PATTERNS = [
    />\s*$/,           // Simple prompt
    /\$\s*$/,          // Shell prompt
    /❯\s*$/,           // Fancy prompt
    /claude>\s*$/i,    // Claude prompt
    /\?\s*$/,          // Question prompt
    /\[Y\/n\]/i,       // Yes/no prompt
    /Press enter/i,    // Press enter prompt
  ]

  const isPromptLine = (text: string): boolean => {
    const lines = text.split('\n')
    const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || ''
    return PROMPT_PATTERNS.some(pattern => pattern.test(lastLine.trim()))
  }

  // Add to activity log
  const logActivity = useCallback((newState: ActivityState) => {
    setActivityLog(prev => {
      // Only add if state actually changed
      if (prev.length > 0 && prev[prev.length - 1].state === newState) {
        return prev
      }
      // Keep last 10 activities
      const updated = [...prev, { state: newState, time: new Date() }]
      return updated.slice(-10)
    })
  }, [])

  // Calculate effective font size with zoom
  const effectiveFontSize = Math.round(fontSize * (zoomLevel / 100))

  // Check scroll position
  const updateScrollState = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    const viewport = terminal.buffer.active
    const scrollTop = viewport.baseY - viewport.viewportY
    const maxScroll = viewport.baseY

    setCanScrollUp(scrollTop > 0)
    setCanScrollDown(viewport.viewportY < viewport.baseY)
  }, [])

  // Scroll to top
  const scrollToTop = useCallback(() => {
    const terminal = terminalRef.current
    if (terminal) {
      terminal.scrollToTop()
      updateScrollState()
    }
  }, [updateScrollState])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const terminal = terminalRef.current
    if (terminal) {
      terminal.scrollToBottom()
      updateScrollState()
    }
  }, [updateScrollState])

  // Clear terminal
  const clearTerminal = useCallback(() => {
    const terminal = terminalRef.current
    if (terminal) {
      terminal.clear()
      updateScrollState()
    }
  }, [updateScrollState])

  // Copy all terminal content
  const copyAll = useCallback(() => {
    const terminal = terminalRef.current
    if (terminal) {
      terminal.selectAll()
      const selection = terminal.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
      terminal.clearSelection()
    }
  }, [])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clear: clearTerminal,
    scrollToBottom,
    copyAll,
    getTerminalId: () => terminalIdRef.current
  }), [clearTerminal, scrollToBottom, copyAll])

  // Handle search
  const handleSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    const searchAddon = searchAddonRef.current
    if (!searchAddon || !query) {
      setSearchResults(null)
      return
    }

    const options = {
      incremental: true,
      regex: false,
      wholeWord: false,
      caseSensitive: false
    }

    if (direction === 'next') {
      searchAddon.findNext(query, options)
    } else {
      searchAddon.findPrevious(query, options)
    }
  }, [])

  // Close search
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
    searchAddonRef.current?.clearDecorations()
    terminalRef.current?.focus()
  }, [])

  // Copy selection handler
  const handleCopy = useCallback(() => {
    const terminal = terminalRef.current
    if (terminal) {
      const selection = terminal.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
        return true
      }
    }
    return false
  }, [])

  // Paste handler
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && terminalIdRef.current) {
        window.api.terminalInput(text, terminalIdRef.current)
      }
    } catch (err) {
      console.error('Failed to paste:', err)
    }
  }, [])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Copy',
      icon: <Copy size={14} />,
      action: () => { handleCopy(); closeContextMenu() },
      shortcut: 'Cmd+C'
    },
    {
      label: 'Paste',
      icon: <Clipboard size={14} />,
      action: () => { handlePaste(); closeContextMenu() },
      shortcut: 'Cmd+V'
    },
    {
      label: 'Copy All',
      icon: <Copy size={14} />,
      action: () => { copyAll(); closeContextMenu() },
      divider: true
    },
    {
      label: 'Clear',
      icon: <Trash2 size={14} />,
      action: () => { clearTerminal(); closeContextMenu() },
      shortcut: 'Cmd+K'
    },
    {
      label: 'Scroll to Bottom',
      icon: <ArrowDownToLine size={14} />,
      action: () => { scrollToBottom(); closeContextMenu() }
    }
  ]

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }

      // Escape to close search or context menu
      if (e.key === 'Escape') {
        if (isSearchOpen) closeSearch()
        if (contextMenu) closeContextMenu()
      }

      // Cmd+C to copy selection
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (handleCopy()) {
          e.preventDefault()
        }
      }

      // Cmd+V to paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        // Let the terminal handle paste
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen, closeSearch, handleCopy, contextMenu, closeContextMenu])

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu()
      window.addEventListener('click', handleClick)
      return () => window.removeEventListener('click', handleClick)
    }
  }, [contextMenu, closeContextMenu])

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const themeConfig = THEMES[theme] || THEMES.default
    const fontFamilyWithFallback = `${fontFamily}, Menlo, Monaco, monospace`

    const terminal = new XTerm({
      fontFamily: fontFamilyWithFallback,
      fontSize: effectiveFontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: themeConfig,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Open links in default browser
      window.open(uri, '_blank')
    }, {
      urlRegex: /https?:\/\/[^\s\])"']+/
    })

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(webLinksAddon)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    terminal.open(containerRef.current)
    fitAddon.fit()

    // Update scroll state on scroll
    terminal.onScroll(() => updateScrollState())

    // Register terminal data handler ONCE before creating terminal
    window.api.onTerminalData((data: string, id: string) => {
      if (id === terminalIdRef.current) {
        // Apply pattern highlighting if enabled
        const processedData = applyHighlighting(data, highlightPatterns)
        terminal.write(processedData)
        setTimeout(updateScrollState, 10)

        // Notify Super Agent of terminal data
        if (onTerminalData && terminalIdRef.current) {
          onTerminalData(data, terminalIdRef.current)
        }

        // Track activity state based on output
        lastOutputRef.current = Date.now()
        outputAccumulatorRef.current += data

        // Check if this looks like a prompt (Claude waiting for input)
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }

        // Set state to working while receiving output
        if (activityState !== 'claude_working') {
          setActivityState('claude_working')
          logActivity('claude_working')
        }

        // After output stops for 300ms, check if it's a prompt
        activityTimeoutRef.current = setTimeout(() => {
          if (isPromptLine(outputAccumulatorRef.current)) {
            setActivityState('claude_waiting')
            logActivity('claude_waiting')
          }
          outputAccumulatorRef.current = ''
        }, 300)

        // Scan for localhost URLs (only trigger if URL changed)
        if (onLocalhostDetected) {
          // Reset regex lastIndex
          LOCALHOST_REGEX.lastIndex = 0
          const matches = data.match(LOCALHOST_REGEX)
          if (matches && matches.length > 0) {
            // Get the first detected URL (most recent)
            const detectedUrl = matches[0]
            // Only notify if this is a different URL than last detected
            if (detectedUrl !== lastDetectedUrlRef.current) {
              lastDetectedUrlRef.current = detectedUrl
              onLocalhostDetected(detectedUrl)
            }
          }
        }
      }
    })

    // Create terminal in main process
    const cols = terminal.cols
    const rows = terminal.rows

    window.api.createTerminal(cols, rows).then(async (id) => {
      terminalIdRef.current = id
      setActiveTerminalId(id)
      // Notify parent immediately when terminal ID is ready
      onTerminalIdReady?.(id)

      // Check if Claude is installed before starting
      try {
        const isClaudeInstalled = await window.api.checkClaudeInstalled()
        if (isClaudeInstalled) {
          // Start Claude CLI
          window.api.terminalInput('claude\n', id)
        } else {
          // Show message that Claude is not installed
          terminal.writeln('\x1b[33mClaude CLI is not installed.\x1b[0m')
          terminal.writeln('Run \x1b[36mnpm install -g @anthropic-ai/claude-code\x1b[0m to install it.')
          terminal.writeln('')
        }
      } catch (err) {
        console.error('Failed to check Claude installation:', err)
        // Try to start Claude anyway
        window.api.terminalInput('claude\n', id)
      }
    }).catch((err) => {
      console.error('Failed to create terminal:', err)
      terminal.writeln(`\x1b[31mFailed to create terminal: ${err.message || 'Unknown error'}\x1b[0m`)
    })

    // Handle user input
    terminal.onData((data) => {
      if (terminalIdRef.current) {
        window.api.terminalInput(data, terminalIdRef.current)

        // Track user typing activity
        if (data.includes('\r') || data.includes('\n')) {
          // User submitted input - expect Claude to start working
          setActivityState('claude_working')
          logActivity('user_typing')
          logActivity('claude_working')
        } else {
          // User is typing
          if (activityState !== 'user_typing') {
            setActivityState('user_typing')
          }
        }
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (terminalIdRef.current) {
        window.api.terminalResize(terminal.cols, terminal.rows, terminalIdRef.current)
      }
      onResize?.(terminal.cols, terminal.rows)
      updateScrollState()
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
      if (terminalIdRef.current) {
        window.api.stopTerminal(terminalIdRef.current)
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }
    }
  }, []) // Empty deps - only run once

  // Update theme when it changes
  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal) {
      const themeConfig = THEMES[theme] || THEMES.default
      terminal.options.theme = themeConfig
    }
  }, [theme])

  // Update font size when it changes (including zoom)
  useEffect(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (terminal && fitAddon) {
      terminal.options.fontSize = effectiveFontSize
      fitAddon.fit()
    }
  }, [effectiveFontSize])

  // Update font family when it changes
  useEffect(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (terminal && fitAddon) {
      terminal.options.fontFamily = `${fontFamily}, Menlo, Monaco, monospace`
      fitAddon.fit()
    }
  }, [fontFamily])

  const themeConfig = THEMES[theme] || THEMES.default

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onContextMenu={handleContextMenu}
      style={{ backgroundColor: themeConfig.background }}
    >
      {/* Scan Lines Effect */}
      {scanLinesEnabled && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)',
            animation: 'scanlines 0.1s linear infinite'
          }}
          aria-hidden="true"
        />
      )}

      {/* Activity Indicator */}
      {activityState !== 'idle' && (
        <div
          className="absolute top-2 left-2 z-10 flex flex-col gap-2"
        >
          {/* Current State */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm"
            style={{
              backgroundColor: `${themeConfig.background}ee`,
              borderColor: activityState === 'claude_working'
                ? 'rgba(204, 120, 92, 0.4)'
                : activityState === 'claude_waiting'
                  ? 'rgba(139, 92, 246, 0.4)'
                  : 'rgba(100, 200, 100, 0.4)'
            }}
          >
            {activityState === 'claude_working' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-[#cc785c] font-medium">Claude working...</span>
              </>
            )}
            {activityState === 'claude_waiting' && (
              <>
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-xs text-purple-400 font-medium">Waiting for input</span>
              </>
            )}
            {activityState === 'user_typing' && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-400 font-medium">You're typing...</span>
              </>
            )}
          </div>

          {/* Activity Timeline */}
          {activityLog.length > 1 && (
            <div
              className="flex items-center gap-0.5 px-2 py-1 rounded-md"
              style={{
                backgroundColor: `${themeConfig.background}dd`,
              }}
            >
              {activityLog.slice(-8).map((activity, index) => (
                <div
                  key={index}
                  className="group relative"
                >
                  <div
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === activityLog.slice(-8).length - 1 ? 'scale-125' : ''
                    }`}
                    style={{
                      backgroundColor:
                        activity.state === 'claude_working' ? '#cc785c' :
                        activity.state === 'claude_waiting' ? '#8b5cf6' :
                        activity.state === 'user_typing' ? '#22c55e' :
                        '#666',
                      opacity: 0.4 + (index / activityLog.slice(-8).length) * 0.6
                    }}
                  />
                  {/* Connector line */}
                  {index < activityLog.slice(-8).length - 1 && (
                    <div
                      className="absolute top-1/2 left-2 w-1.5 h-0.5 -translate-y-1/2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    />
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20">
                    <div className="px-2 py-1 rounded text-[10px] whitespace-nowrap" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="font-medium" style={{
                        color: activity.state === 'claude_working' ? '#cc785c' :
                               activity.state === 'claude_waiting' ? '#8b5cf6' :
                               activity.state === 'user_typing' ? '#22c55e' : '#666'
                      }}>
                        {activity.state === 'claude_working' ? 'Working' :
                         activity.state === 'claude_waiting' ? 'Waiting' :
                         activity.state === 'user_typing' ? 'User input' : 'Idle'}
                      </div>
                      <div className="text-gray-500">
                        {activity.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      {isSearchOpen && (
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg"
          style={{
            backgroundColor: themeConfig.background,
            borderColor: 'rgba(255,255,255,0.1)'
          }}
        >
          <Search size={14} className="text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearch(searchQuery, e.shiftKey ? 'prev' : 'next')
              }
            }}
            placeholder="Search..."
            className="bg-transparent text-sm text-white outline-none w-48 placeholder-gray-500"
            style={{ color: themeConfig.foreground }}
          />
          {searchResults && (
            <span className="text-xs text-gray-400">
              {searchResults.current}/{searchResults.total}
            </span>
          )}
          <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
            <button
              onClick={() => handleSearch(searchQuery, 'prev')}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Previous (Shift+Enter)"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => handleSearch(searchQuery, 'next')}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Next (Enter)"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={closeSearch}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Close (Escape)"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] py-1 rounded-lg border shadow-xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#1a1a1a',
            borderColor: 'rgba(255,255,255,0.1)'
          }}
        >
          {contextMenuItems.map((item, index) => (
            <div key={index}>
              {item.divider && index > 0 && (
                <div className="h-px bg-white/10 my-1" />
              )}
              <button
                onClick={item.action}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-gray-300 hover:bg-[#cc785c]/20 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-xs text-gray-500">{item.shortcut}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scroll Buttons */}
      {isHovering && (canScrollUp || canScrollDown) && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2"
        >
          {canScrollUp && (
            <button
              onClick={scrollToTop}
              className="p-2 rounded-lg border backdrop-blur-sm transition-all hover:scale-105"
              style={{
                backgroundColor: `${themeConfig.background}cc`,
                borderColor: 'rgba(255,255,255,0.1)',
                color: themeConfig.cursor
              }}
              title="Scroll to top"
            >
              <ChevronUp size={16} />
            </button>
          )}
          {canScrollDown && (
            <button
              onClick={scrollToBottom}
              className="p-2 rounded-lg border backdrop-blur-sm transition-all hover:scale-105"
              style={{
                backgroundColor: `${themeConfig.background}cc`,
                borderColor: 'rgba(255,255,255,0.1)',
                color: themeConfig.cursor
              }}
              title="Scroll to bottom"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      )}

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="h-full w-full p-2"
        style={{ minHeight: '100%' }}
      />

      {/* Scanlines CSS Animation */}
      <style>{`
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `}</style>
    </div>
  )
})

Terminal.displayName = 'Terminal'

export default Terminal
