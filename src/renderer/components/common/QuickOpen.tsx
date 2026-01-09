import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Image,
  Folder,
  X,
  Clock,
  ChevronRight
} from 'lucide-react'
import { useFocusTrap } from '../../hooks'

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

interface QuickOpenProps {
  isOpen: boolean
  onClose: () => void
  cwd: string
  onSelectFile: (filePath: string) => void
}

// File extension to icon mapping
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  const iconMap: Record<string, typeof File> = {
    // Code files
    ts: FileCode,
    tsx: FileCode,
    js: FileCode,
    jsx: FileCode,
    py: FileCode,
    rb: FileCode,
    go: FileCode,
    rs: FileCode,
    cpp: FileCode,
    c: FileCode,
    java: FileCode,
    swift: FileCode,
    kt: FileCode,
    vue: FileCode,
    svelte: FileCode,
    // Config/Data
    json: FileJson,
    yaml: FileJson,
    yml: FileJson,
    toml: FileJson,
    xml: FileJson,
    // Text/Docs
    md: FileText,
    txt: FileText,
    doc: FileText,
    docx: FileText,
    pdf: FileText,
    // Style
    css: FileType,
    scss: FileType,
    sass: FileType,
    less: FileType,
    // Images
    png: Image,
    jpg: Image,
    jpeg: Image,
    gif: Image,
    svg: Image,
    webp: Image,
    ico: Image
  }

  return iconMap[ext] || File
}

// Simple fuzzy match scoring
const fuzzyMatch = (query: string, target: string): { match: boolean; score: number } => {
  if (!query) return { match: true, score: 0 }

  const queryLower = query.toLowerCase()
  const targetLower = target.toLowerCase()

  // Exact match gets highest score
  if (targetLower === queryLower) return { match: true, score: 100 }

  // Starts with query
  if (targetLower.startsWith(queryLower)) return { match: true, score: 80 }

  // Contains query as substring
  if (targetLower.includes(queryLower)) return { match: true, score: 60 }

  // Fuzzy character matching
  let queryIndex = 0
  let score = 0
  let consecutiveBonus = 0

  for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIndex]) {
      score += 10 + consecutiveBonus
      consecutiveBonus += 5
      queryIndex++
    } else {
      consecutiveBonus = 0
    }
  }

  if (queryIndex === queryLower.length) {
    // Normalize score by query length
    return { match: true, score: Math.min(50, score / queryLower.length) }
  }

  return { match: false, score: 0 }
}

// Recent files storage key
const RECENT_FILES_KEY = 'quickopen_recent_files'
const MAX_RECENT_FILES = 5

export default function QuickOpen({ isOpen, onClose, cwd, onSelectFile }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen, {
    restoreFocus: true,
    autoFocus: false,
    initialFocus: 'input[type="text"]'
  })

  // Load recent files from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_FILES_KEY)
      if (stored) {
        setRecentFiles(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(false)
        })
      })
    } else {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setIsAnimating(false)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Load files when modal opens
  useEffect(() => {
    if (isOpen && cwd) {
      loadFiles()
      // Focus input after a brief delay for animation
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen, cwd])

  const loadFiles = async () => {
    setLoading(true)
    try {
      const fileList = await window.api.listFiles()
      // Filter to only show files, not directories
      setFiles(fileList.filter(f => !f.isDirectory))
    } catch (err) {
      console.error('Failed to load files:', err)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort files based on query
  const filteredFiles = useMemo(() => {
    if (!query.trim()) {
      // Show all files sorted alphabetically when no query
      return [...files].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50)
    }

    return files
      .map(file => ({
        file,
        ...fuzzyMatch(query, file.name)
      }))
      .filter(item => item.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(item => item.file)
  }, [files, query])

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredFiles])

  // Scroll selected item into view and update fade states
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedEl?.scrollIntoView({ block: 'nearest' })

      // Update fade indicators
      const { scrollTop, scrollHeight, clientHeight } = listRef.current
      setShowTopFade(scrollTop > 10)
      setShowBottomFade(scrollTop < scrollHeight - clientHeight - 10)
    }
  }, [selectedIndex])

  // Handle scroll for fade indicators
  const handleScroll = useCallback(() => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current
      setShowTopFade(scrollTop > 10)
      setShowBottomFade(scrollTop < scrollHeight - clientHeight - 10)
    }
  }, [])

  const handleSelect = useCallback((filePath: string) => {
    // Update recent files
    const newRecent = [filePath, ...recentFiles.filter(f => f !== filePath)].slice(0, MAX_RECENT_FILES)
    setRecentFiles(newRecent)
    try {
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(newRecent))
    } catch {
      // Ignore localStorage errors
    }

    onSelectFile(filePath)
    onClose()
  }, [recentFiles, onSelectFile, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredFiles.length + (query ? 0 : recentFiles.length)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(1, totalItems))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems))
        break
      case 'Enter':
        e.preventDefault()
        if (!query && selectedIndex < recentFiles.length) {
          handleSelect(recentFiles[selectedIndex])
        } else {
          const fileIndex = query ? selectedIndex : selectedIndex - recentFiles.length
          if (filteredFiles[fileIndex]) {
            handleSelect(filteredFiles[fileIndex].path)
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredFiles, recentFiles, selectedIndex, query, handleSelect, onClose])

  // Get relative path from cwd
  const getRelativePath = (fullPath: string) => {
    if (fullPath.startsWith(cwd)) {
      return fullPath.slice(cwd.length + 1)
    }
    return fullPath
  }

  // Get directory from path
  const getDirectory = (filePath: string) => {
    const parts = filePath.split('/')
    parts.pop()
    return parts.join('/')
  }

  if (!isVisible) return null

  // Compute the selected file for aria-activedescendant
  const totalItems = filteredFiles.length + (query ? 0 : recentFiles.length)
  const selectedId = !query && selectedIndex < recentFiles.length
    ? `recent-file-${selectedIndex}`
    : `file-${query ? selectedIndex : selectedIndex - recentFiles.length}`

  return (
    <>
      {/* Backdrop with radial gradient */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${
          isOpen && !isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: `
            radial-gradient(
              ellipse at center,
              rgba(0, 0, 0, 0.5) 0%,
              rgba(0, 0, 0, 0.7) 50%,
              rgba(0, 0, 0, 0.85) 100%
            )
          `,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={focusTrapRef}
        className={`fixed top-[15%] left-1/2 -translate-x-1/2 w-[560px] max-h-[70vh] z-50 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen && !isAnimating
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-4 scale-[0.97]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Open"
        aria-describedby="quick-open-description"
      >
        <span id="quick-open-description" className="sr-only">
          Search and open files. Use arrow keys to navigate, Enter to open, Escape to close.
        </span>
        {/* Glass container */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 0 0 1px rgba(0, 0, 0, 0.5),
              0 25px 50px -12px rgba(0, 0, 0, 0.7),
              0 0 100px -20px rgba(204, 120, 92, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `
          }}
        >
          {/* Subtle top glow accent */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(204, 120, 92, 0.5), transparent)'
            }}
            aria-hidden="true"
          />

          {/* Search Header */}
          <div className="relative border-b border-white/[0.06]">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search files by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-32 py-4 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls="file-list"
              aria-activedescendant={totalItems > 0 ? selectedId : undefined}
              aria-label="Search files"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-gray-500 font-medium" aria-hidden="true">
                <span className="text-[9px]">ESC</span>
                <span className="text-gray-600">to close</span>
              </kbd>
              <button
                onClick={onClose}
                className="group p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all duration-200 focus-ring"
                aria-label="Close quick open"
              >
                <X size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>

            {/* Accent glow line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(204, 120, 92, 0.3), transparent)'
              }}
              aria-hidden="true"
            />
          </div>

          {/* Results with fade edges */}
          <div className="relative">
            {/* Top fade */}
            <div
              className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#121212] to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
                showTopFade ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
            />

            <div
              ref={listRef}
              id="file-list"
              role="listbox"
              aria-label="File results"
              className="overflow-y-auto max-h-[400px] py-2 scroll-smooth"
              onScroll={handleScroll}
            >
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-500" role="status" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 border-2 border-[#cc785c]/30 border-t-[#cc785c] rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <span className="text-sm">Loading files...</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Recent Files Section (only shown when no query) */}
                  {!query && recentFiles.length > 0 && (
                    <div
                      className="mb-2 transition-all duration-300"
                      role="group"
                      aria-labelledby="recent-files-heading"
                      style={{
                        opacity: isOpen && !isAnimating ? 1 : 0,
                        transform: isOpen && !isAnimating ? 'translateY(0)' : 'translateY(8px)'
                      }}
                    >
                      <div className="px-4 py-2 flex items-center gap-2" id="recent-files-heading">
                        <Clock size={12} className="text-gray-600" aria-hidden="true" />
                        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
                          Recent
                        </span>
                      </div>
                      {recentFiles.map((filePath, index) => {
                        const fileName = filePath.split('/').pop() || ''
                        const FileIcon = getFileIcon(fileName)
                        const isSelected = selectedIndex === index

                        return (
                          <button
                            key={filePath}
                            id={`recent-file-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelect(filePath)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 focus-ring ${
                              isSelected
                                ? 'bg-[#cc785c]/15'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                                isSelected
                                  ? 'bg-[#cc785c]/20 scale-110'
                                  : 'bg-white/[0.04]'
                              }`}
                            >
                              <FileIcon
                                size={16}
                                className={isSelected ? 'text-[#cc785c]' : 'text-gray-500'}
                                aria-hidden="true"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm truncate transition-colors duration-150 ${
                                isSelected ? 'text-white' : 'text-gray-300'
                              }`}>
                                {fileName}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {getRelativePath(getDirectory(filePath))}
                              </div>
                            </div>
                            {isSelected && (
                              <ChevronRight size={14} className="text-[#cc785c] flex-shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* All Files Section */}
                  {filteredFiles.length > 0 && (
                    <div
                      role="group"
                      aria-labelledby={!query && recentFiles.length > 0 ? "all-files-heading" : undefined}
                      className="transition-all duration-300"
                      style={{
                        opacity: isOpen && !isAnimating ? 1 : 0,
                        transform: isOpen && !isAnimating ? 'translateY(0)' : 'translateY(8px)',
                        transitionDelay: !query && recentFiles.length > 0 ? '30ms' : '0ms'
                      }}
                    >
                      {!query && recentFiles.length > 0 && (
                        <div className="px-4 py-2 flex items-center gap-2 border-t border-white/[0.04] mt-1" id="all-files-heading">
                          <Folder size={12} className="text-gray-600" aria-hidden="true" />
                          <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
                            All Files
                          </span>
                        </div>
                      )}
                      {filteredFiles.map((file, index) => {
                        const adjustedIndex = query ? index : index + recentFiles.length
                        const isSelected = selectedIndex === adjustedIndex
                        const FileIcon = getFileIcon(file.name)

                        return (
                          <button
                            key={file.path}
                            id={`file-${index}`}
                            data-index={adjustedIndex}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelect(file.path)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 focus-ring ${
                              isSelected
                                ? 'bg-[#cc785c]/15'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                                isSelected
                                  ? 'bg-[#cc785c]/20 scale-110'
                                  : 'bg-white/[0.04]'
                              }`}
                            >
                              <FileIcon
                                size={16}
                                className={isSelected ? 'text-[#cc785c]' : 'text-gray-500'}
                                aria-hidden="true"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm truncate transition-colors duration-150 ${
                                isSelected ? 'text-white' : 'text-gray-300'
                              }`}>
                                {file.name}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {getRelativePath(getDirectory(file.path))}
                              </div>
                            </div>
                            {isSelected && (
                              <ChevronRight size={14} className="text-[#cc785c] flex-shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Empty State */}
                  {!loading && filteredFiles.length === 0 && (
                    <div
                      className="flex flex-col items-center justify-center py-12 text-center transition-all duration-300"
                      style={{
                        opacity: isOpen && !isAnimating ? 1 : 0,
                        transform: isOpen && !isAnimating ? 'translateY(0)' : 'translateY(8px)'
                      }}
                    >
                      <div
                        className="p-3 rounded-xl mb-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(204, 120, 92, 0.1) 0%, rgba(204, 120, 92, 0.05) 100%)',
                          border: '1px solid rgba(204, 120, 92, 0.1)'
                        }}
                      >
                        <Search size={20} className="text-[#cc785c]/60" />
                      </div>
                      <p className="text-sm text-gray-500">
                        {query ? 'No files match your search' : 'No files found in this project'}
                      </p>
                      {query && (
                        <p className="text-xs text-gray-600 mt-1">
                          Try a different search term
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom fade */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#121212] to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
                showBottomFade ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
            />
          </div>

          {/* Footer with keyboard hints */}
          <div
            className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between"
            style={{ background: 'rgba(0, 0, 0, 0.2)' }}
          >
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-gray-500 font-mono text-[10px]">
                  {'\u2191\u2193'}
                </kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-gray-500 font-mono text-[10px]">
                  {'\u21B5'}
                </kbd>
                <span>open</span>
              </span>
            </div>
            <span className="text-[10px] text-gray-600">
              {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
