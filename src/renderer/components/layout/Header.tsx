import { useState, useEffect, useRef } from 'react'
import {
  Folder,
  Settings,
  ChevronDown,
  Search,
  GitBranch,
  GitCommit,
  Upload,
  GitPullRequest,
  Rocket,
  Globe,
  Plug,
  Home,
  Eye,
  ExternalLink,
  FolderOpen,
  X,
  Copy,
  Check,
  Zap
} from 'lucide-react'
import Toolbelt from '../common/Toolbelt'
import { useAppStore } from '../../store'
import { useToast } from '../common/Toast'

interface HeaderProps {
  cwd: string
  onSelectFolder: () => void
  onHome: () => void
  onOpenSettings: () => void
  onOpenCommandPalette?: () => void
  screen: string
  onNavigate?: (screen: string) => void
  onOpenPreview?: (url: string) => void
  onOpenSuperAgent?: () => void
}

export default function Header({
  cwd,
  onSelectFolder,
  onHome,
  onOpenSettings,
  onOpenCommandPalette,
  screen,
  onNavigate,
  onOpenPreview,
  onOpenSuperAgent
}: HeaderProps) {
  const folderName = cwd ? cwd.split('/').pop() : 'No folder'
  const [mcpCount, setMcpCount] = useState(0)
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const [showGitMenu, setShowGitMenu] = useState(false)
  const [showDeployMenu, setShowDeployMenu] = useState(false)
  const [showPreviewPopover, setShowPreviewPopover] = useState(false)
  const [previewPath, setPreviewPath] = useState('')
  const [copied, setCopied] = useState(false)
  const activeTerminalId = useAppStore((state) => state.activeTerminalId)
  const { showToast } = useToast()
  const gitMenuRef = useRef<HTMLDivElement>(null)
  const deployMenuRef = useRef<HTMLDivElement>(null)
  const previewMenuRef = useRef<HTMLDivElement>(null)

  // Load MCP count and git branch
  useEffect(() => {
    const load = async () => {
      try {
        const servers = await window.api.mcpList()
        setMcpCount(servers.filter((s: { enabled: boolean }) => s.enabled).length)
      } catch {}
      try {
        const status = await window.api.gitStatus()
        setGitBranch(status?.branch || null)
      } catch {
        setGitBranch(null)
      }
    }
    load()
    const i = setInterval(load, 10000)
    return () => clearInterval(i)
  }, [cwd])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (gitMenuRef.current && !gitMenuRef.current.contains(e.target as Node)) setShowGitMenu(false)
      if (deployMenuRef.current && !deployMenuRef.current.contains(e.target as Node)) setShowDeployMenu(false)
      if (previewMenuRef.current && !previewMenuRef.current.contains(e.target as Node)) setShowPreviewPopover(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Send prompt to Claude CLI
  const sendPrompt = async (prompt: string) => {
    if (!activeTerminalId) {
      showToast('warning', 'No Session', 'Start a terminal session first')
      return
    }
    try {
      await window.api.terminalSendText(prompt, activeTerminalId)
      showToast('info', 'Sent to Claude', 'Check the terminal')
    } catch {
      showToast('error', 'Failed', 'Could not send command')
    }
  }

  // Preview file functions
  const openPreviewFile = () => {
    if (!previewPath.trim()) {
      showToast('warning', 'No Path', 'Enter a file path first')
      return
    }
    // Open in-app preview pane
    onOpenPreview?.(previewPath.trim())
    setShowPreviewPopover(false)
    showToast('info', 'Preview', 'Opening in split view')
  }

  const openInExternalBrowser = async () => {
    if (!previewPath.trim()) {
      showToast('warning', 'No Path', 'Enter a file path first')
      return
    }
    try {
      await window.api.openFileExternal(previewPath.trim())
      showToast('info', 'Opening', 'File opened in default app')
      setShowPreviewPopover(false)
    } catch {
      showToast('error', 'Failed', 'Could not open file')
    }
  }

  const showInFinder = async () => {
    if (!previewPath.trim()) {
      showToast('warning', 'No Path', 'Enter a file path first')
      return
    }
    try {
      await window.api.showInFinder(previewPath.trim())
      setShowPreviewPopover(false)
    } catch {
      showToast('error', 'Failed', 'Could not show in Finder')
    }
  }

  const copyPath = async () => {
    if (!previewPath.trim()) return
    try {
      await navigator.clipboard.writeText(previewPath.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('error', 'Failed', 'Could not copy path')
    }
  }

  // Git actions as Claude prompts
  const gitActions = [
    { id: 'commit', label: 'Commit Changes', icon: GitCommit, prompt: 'Please commit all my changes with a good commit message describing what changed' },
    { id: 'push', label: 'Push to Remote', icon: Upload, prompt: 'Please push my commits to the remote repository' },
    { id: 'pr', label: 'Create Pull Request', icon: GitPullRequest, prompt: 'Please create a pull request for my current branch with a good title and description' }
  ]

  // Deploy actions as Claude prompts
  const deployActions = [
    { id: 'vercel', label: 'Deploy to Vercel', icon: Rocket, prompt: 'Please deploy this project to Vercel' },
    { id: 'gh-pages', label: 'GitHub Pages', icon: Globe, prompt: 'Please deploy this project to GitHub Pages' }
  ]

  return (
    <header className="titlebar-drag h-12 flex items-center justify-between px-3 bg-[#1a1a1c] border-b border-white/[0.06]">
      {/* Left: Traffic light space + Logo + Folder */}
      <div className="flex items-center gap-2">
        {/* Spacer for macOS native traffic lights */}
        <div className="w-16" />

        {/* Logo/Home */}
        <button
          onClick={onHome}
          className="titlebar-no-drag p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Home"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#cc785c] to-[#a55d45] flex items-center justify-center">
            <Home size={12} className="text-white" />
          </div>
        </button>

        {/* Folder */}
        <button
          onClick={onSelectFolder}
          className="titlebar-no-drag flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          title={cwd || 'Select folder'}
        >
          <Folder size={14} className="text-gray-500" />
          <span className="text-sm text-gray-300 max-w-[140px] truncate">{folderName}</span>
          <ChevronDown size={12} className="text-gray-500" />
        </button>
      </div>

      {/* Center: Screen indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="text-xs text-gray-500 capitalize">{screen}</span>
      </div>

      {/* Right: Actions */}
      <div className="titlebar-no-drag flex items-center gap-1">
        {/* Super Agent - Only on terminal */}
        {screen === 'terminal' && (
          <button
            onClick={onOpenSuperAgent}
            disabled={!activeTerminalId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-gradient-to-r from-[#cc785c]/20 to-[#a55d45]/20 hover:from-[#cc785c]/30 hover:to-[#a55d45]/30 border border-[#cc785c]/30 text-[#cc785c] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Launch Super Agent"
          >
            <Zap size={12} />
            <span>Super Agent</span>
          </button>
        )}

        {/* Git Menu - Only on terminal */}
        {screen === 'terminal' && gitBranch && (
          <div className="relative" ref={gitMenuRef}>
            <button
              onClick={() => setShowGitMenu(!showGitMenu)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                showGitMenu ? 'bg-[#cc785c]/20 text-[#cc785c]' : 'hover:bg-white/[0.06] text-gray-400'
              }`}
            >
              <GitBranch size={12} />
              <span className="max-w-[60px] truncate">{gitBranch}</span>
              <ChevronDown size={10} className={`transition-transform ${showGitMenu ? 'rotate-180' : ''}`} />
            </button>

            {showGitMenu && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-[#1e1e1e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-gray-500">
                  Git Actions
                </div>
                {gitActions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => { sendPrompt(action.prompt); setShowGitMenu(false) }}
                    disabled={!activeTerminalId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <action.icon size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-300">{action.label}</span>
                  </button>
                ))}
                {!activeTerminalId && (
                  <div className="px-3 py-2 text-[10px] text-amber-500/80 border-t border-white/[0.06]">
                    Start a session first
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toolbelt - Only on terminal */}
        {screen === 'terminal' && <Toolbelt activeTerminalId={activeTerminalId} />}

        {/* Deploy Menu - Only on terminal */}
        {screen === 'terminal' && (
          <div className="relative" ref={deployMenuRef}>
            <button
              onClick={() => setShowDeployMenu(!showDeployMenu)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                showDeployMenu ? 'bg-[#cc785c]/20 text-[#cc785c]' : 'hover:bg-white/[0.06] text-gray-400'
              }`}
            >
              <Rocket size={12} />
              <span>Deploy</span>
              <ChevronDown size={10} className={`transition-transform ${showDeployMenu ? 'rotate-180' : ''}`} />
            </button>

            {showDeployMenu && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-[#1e1e1e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-gray-500">
                  Deploy To
                </div>
                {deployActions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => { sendPrompt(action.prompt); setShowDeployMenu(false) }}
                    disabled={!activeTerminalId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <action.icon size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-300">{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview File - Only on terminal */}
        {screen === 'terminal' && (
          <div className="relative" ref={previewMenuRef}>
            <button
              onClick={() => setShowPreviewPopover(!showPreviewPopover)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                showPreviewPopover ? 'bg-[#cc785c]/20 text-[#cc785c]' : 'hover:bg-white/[0.06] text-gray-400'
              }`}
              title="Preview file"
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>

            {showPreviewPopover && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-[#1e1e1e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Preview File</span>
                  <button
                    onClick={() => setShowPreviewPopover(false)}
                    className="p-0.5 hover:bg-white/[0.06] rounded"
                  >
                    <X size={12} className="text-gray-500" />
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={previewPath}
                      onChange={(e) => setPreviewPath(e.target.value)}
                      placeholder="/path/to/file.html"
                      className="flex-1 px-3 py-2 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#cc785c]/50"
                      onKeyDown={(e) => e.key === 'Enter' && openPreviewFile()}
                    />
                    <button
                      onClick={copyPath}
                      className="p-2 bg-[#141414] border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors"
                      title="Copy path"
                    >
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={openPreviewFile}
                      disabled={!previewPath.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#cc785c] hover:bg-[#cc785c]/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                    >
                      <Eye size={14} />
                      Preview
                    </button>
                    <button
                      onClick={openInExternalBrowser}
                      disabled={!previewPath.trim()}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-[#141414] border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-300 transition-colors"
                      title="Open in external browser"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={showInFinder}
                      disabled={!previewPath.trim()}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-[#141414] border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-300 transition-colors"
                      title="Show in Finder"
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Paste a file path to preview in split view
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* MCP Status */}
        <button
          onClick={() => onNavigate?.('skills')}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          title={`${mcpCount} MCP servers`}
        >
          <Plug size={12} className={mcpCount > 0 ? 'text-green-400' : 'text-gray-500'} />
          <span className={`text-xs ${mcpCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>{mcpCount}</span>
        </button>

        {/* Search */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.06] text-gray-400 transition-colors"
          title="Search (Cmd+K)"
        >
          <Search size={14} />
          <kbd className="text-[10px] text-gray-600 px-1 py-0.5 rounded bg-white/[0.04]">Cmd K</kbd>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
