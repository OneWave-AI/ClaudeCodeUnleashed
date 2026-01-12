import { useState, useEffect, useRef, useCallback } from 'react'
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
  Zap,
  ClipboardList,
  Play,
  Loader2,
  CheckCircle,
  History,
  Paintbrush,
  Layers,
  Route,
  Server,
  Link2
} from 'lucide-react'

// Custom Bee Icon for Swarm
const BeeIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Body */}
    <ellipse cx="12" cy="14" rx="5" ry="6" />
    {/* Stripes */}
    <path d="M8 12h8" />
    <path d="M8 15h8" />
    {/* Head */}
    <circle cx="12" cy="6" r="3" />
    {/* Wings */}
    <ellipse cx="7" cy="11" rx="3" ry="2" fill="currentColor" opacity="0.3" />
    <ellipse cx="17" cy="11" rx="3" ry="2" fill="currentColor" opacity="0.3" />
    {/* Antennae */}
    <path d="M10 4 L8 1" />
    <path d="M14 4 L16 1" />
    {/* Stinger */}
    <path d="M12 20 L12 22" />
  </svg>
)
import Toolbelt from '../common/Toolbelt'
import { useAppStore } from '../../store'
import { useToast } from '../common/Toast'

interface SwarmAgent {
  id: string
  name: string
  role: string
  status: 'pending' | 'running' | 'complete' | 'error'
  output?: string
}

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
  // Plan props
  planCount?: number
  showPlan?: boolean
  onTogglePlan?: () => void
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
  onOpenSuperAgent,
  planCount = 0,
  showPlan = false,
  onTogglePlan
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

  // Swarm state
  const [showSwarmMenu, setShowSwarmMenu] = useState(false)
  const [swarmRunning, setSwarmRunning] = useState(false)
  const [swarmAgents, setSwarmAgents] = useState<SwarmAgent[]>([])
  const swarmMenuRef = useRef<HTMLDivElement>(null)

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
      if (swarmMenuRef.current && !swarmMenuRef.current.contains(e.target as Node)) setShowSwarmMenu(false)
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

  // Swarm: Launch audit agents
  const launchSwarmAudit = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)

    const placeholderAgents: SwarmAgent[] = [
      { id: '1', name: 'Analyzing...', role: 'Claude is selecting agents', status: 'pending' },
      { id: '2', name: 'Analyzing...', role: 'Claude is selecting agents', status: 'pending' },
      { id: '3', name: 'Analyzing...', role: 'Claude is selecting agents', status: 'pending' },
    ]
    setSwarmAgents(placeholderAgents)

    const swarmPrompt = `🐝 **SWARM AUDIT MODE ACTIVATED**

Analyze the current situation, our recent conversation, and the codebase context. You need to launch a coordinated agent swarm (minimum 3 agents) to audit and review.

**YOUR TASK:**
1. First, briefly analyze what we've been working on and what needs attention
2. Then CHOOSE 3-5 specialized agents that are most relevant to THIS specific situation
3. For each agent you spawn, clearly announce: "🐝 Spawning Agent: [Name] - [Role]"
4. Have each agent perform their analysis and report findings

**AGENT SELECTION GUIDELINES:**
Pick agents based on what's actually needed. Examples of agent types you might choose:
- Code Quality Reviewer (patterns, structure, readability)
- Security Auditor (vulnerabilities, auth, data handling)
- Performance Analyst (bottlenecks, optimization)
- API Reviewer (endpoints, contracts, error handling)
- UI/UX Reviewer (accessibility, responsiveness, UX)
- Test Coverage Analyst (missing tests, edge cases)
- Type Safety Reviewer (TypeScript, type coverage)

**OUTPUT FORMAT:**
For each agent, provide:
- Agent name and role
- Key findings (with file:line references)
- Severity: 🔴 Critical | 🟠 Warning | 🟡 Info
- Recommended actions

Begin by analyzing the context and selecting your agents now.`

    window.api.terminalSendText(swarmPrompt, activeTerminalId)
    showToast('info', 'Swarm Started', 'Audit agents analyzing codebase')

    // Update agents as Claude works (simulated)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, name: 'Agent 1', status: 'running' } : a))
    }, 2000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, name: 'Agent 2', status: 'running' } : a))
    }, 4000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, name: 'Agent 3', status: 'running' } : a))
    }, 6000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' })))
      setSwarmRunning(false)
    }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: Launch action agents to fix issues
  const launchSwarmAction = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)

    const placeholderAgents: SwarmAgent[] = [
      { id: '1', name: 'Planning...', role: 'Claude is selecting agents', status: 'pending' },
      { id: '2', name: 'Planning...', role: 'Claude is selecting agents', status: 'pending' },
      { id: '3', name: 'Planning...', role: 'Claude is selecting agents', status: 'pending' },
    ]
    setSwarmAgents(placeholderAgents)

    const actionPrompt = `🐝 **SWARM ACTION MODE ACTIVATED**

Based on our conversation and any previous audit findings, launch a coordinated agent swarm (minimum 3 agents) to take action and implement improvements.

**YOUR TASK:**
1. First, summarize what needs to be fixed/improved based on context
2. Then CHOOSE 3-5 specialized agents that can best address these issues
3. For each agent you spawn, clearly announce: "🐝 Spawning Agent: [Name] - [Mission]"
4. Have each agent execute their tasks and show the changes

**AGENT SELECTION GUIDELINES:**
Pick agents based on what actions are actually needed. Examples:
- Bug Fixer (fix identified bugs, handle edge cases)
- Security Patcher (fix vulnerabilities, add validation)
- Performance Optimizer (optimize slow code, add caching)
- Refactoring Agent (clean up code, improve structure)
- Test Writer (add unit tests, integration tests)
- Type Fixer (add/fix TypeScript types)
- Error Handler (add try/catch, improve error messages)

**EXECUTION RULES:**
- Prioritize: 🔴 Security first → 🟠 Bugs → 🟡 Improvements
- Show each change with file:line references
- Explain what was changed and why
- Each agent should complete their task before the next begins

Begin by analyzing what needs action and selecting your agents now.`

    window.api.terminalSendText(actionPrompt, activeTerminalId)
    showToast('info', 'Swarm Started', 'Action agents fixing issues')

    // Update agents as Claude works
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, name: 'Agent 1', status: 'running' } : a))
    }, 2000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, name: 'Agent 2', status: 'running' } : a))
    }, 5000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, name: 'Agent 3', status: 'running' } : a))
    }, 8000)
    setTimeout(() => {
      setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' })))
      setSwarmRunning(false)
    }, 45000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: Design Polish - improve visual design
  const launchSwarmDesign = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'Design Analysis', role: 'Analyzing visual design', status: 'pending' },
      { id: '2', name: 'Style Improvements', role: 'Improving styles', status: 'pending' },
      { id: '3', name: 'Polish Agent', role: 'Final polish', status: 'pending' },
    ])
    const prompt = `🎨 **SWARM DESIGN POLISH MODE**\n\nAnalyze the UI/UX and visual design of the current codebase. Focus on:\n1. Color consistency and palette\n2. Spacing and alignment\n3. Typography hierarchy\n4. Visual polish and micro-interactions\n5. Accessibility (contrast, focus states)\n\nLaunch 3 specialized design agents to improve the visual quality. Show specific CSS/style changes with file:line references.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'Design Swarm', 'Polishing visual design')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 5000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 8000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: UI Fix - fix UI bugs and layout issues
  const launchSwarmUIFix = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'Bug Scanner', role: 'Finding UI bugs', status: 'pending' },
      { id: '2', name: 'Layout Fixer', role: 'Fixing layouts', status: 'pending' },
      { id: '3', name: 'Render Optimizer', role: 'Optimizing renders', status: 'pending' },
    ])
    const prompt = `🔧 **SWARM UI FIX MODE**\n\nScan for and fix UI bugs and layout issues:\n1. Overflow and clipping problems\n2. Z-index and stacking issues\n3. Responsive breakpoint bugs\n4. Hover/focus state issues\n5. Animation glitches\n6. Missing error boundaries\n\nLaunch 3 specialized agents to identify and fix UI bugs. Provide specific fixes with file:line references.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'UI Fix Swarm', 'Finding and fixing UI bugs')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 5000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 8000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: Route - improve routing and navigation
  const launchSwarmRoute = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'Route Analyzer', role: 'Analyzing routes', status: 'pending' },
      { id: '2', name: 'Nav Optimizer', role: 'Improving navigation', status: 'pending' },
      { id: '3', name: 'Flow Agent', role: 'Optimizing user flow', status: 'pending' },
    ])
    const prompt = `🗺️ **SWARM ROUTE MODE**\n\nAnalyze and improve routing and navigation:\n1. Route structure and organization\n2. Navigation patterns and UX\n3. Deep linking and URL structure\n4. Route guards and auth flow\n5. Loading states and transitions\n6. Back/forward navigation\n\nLaunch 3 specialized agents to improve the routing architecture. Show specific improvements with file:line references.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'Route Swarm', 'Improving navigation')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 5000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 8000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: API - improve API layer and data fetching
  const launchSwarmAPI = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'API Auditor', role: 'Auditing API layer', status: 'pending' },
      { id: '2', name: 'Data Optimizer', role: 'Optimizing data flow', status: 'pending' },
      { id: '3', name: 'IPC Agent', role: 'Improving IPC handlers', status: 'pending' },
    ])
    const prompt = `⚡ **SWARM API MODE**\n\nAnalyze and improve the API layer:\n1. API endpoint structure and naming\n2. Error handling and responses\n3. Data validation and types\n4. IPC handlers (Electron)\n5. Caching and optimization\n6. Loading and error states\n\nLaunch 3 specialized agents to improve the API architecture. Show specific improvements with file:line references.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'API Swarm', 'Improving API layer')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 5000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 8000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: Connector - improve integrations
  const launchSwarmConnector = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'Integration Auditor', role: 'Auditing integrations', status: 'pending' },
      { id: '2', name: 'MCP Agent', role: 'Improving MCP', status: 'pending' },
      { id: '3', name: 'Git Agent', role: 'Improving Git integration', status: 'pending' },
    ])
    const prompt = `🔗 **SWARM CONNECTOR MODE**\n\nAnalyze and improve integrations:\n1. MCP server connections\n2. Git integration (commit, push, PR)\n3. File system operations\n4. External service connections\n5. CLI tool integration\n6. Plugin/extension system\n\nLaunch 3 specialized agents to improve integrations. Show specific improvements with file:line references.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'Connector Swarm', 'Improving integrations')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 5000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 8000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 30000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Swarm: Research - deep web research on GitHub, Reddit, docs
  const launchSwarmResearch = useCallback(() => {
    if (!activeTerminalId || swarmRunning) return
    setShowSwarmMenu(false)
    setSwarmRunning(true)
    setSwarmAgents([
      { id: '1', name: 'Web Researcher', role: 'Searching the web', status: 'pending' },
      { id: '2', name: 'GitHub Agent', role: 'Searching repos/issues', status: 'pending' },
      { id: '3', name: 'Reddit Agent', role: 'Finding discussions', status: 'pending' },
    ])
    const prompt = `🔍 **SWARM RESEARCH MODE**

You are now in DEEP RESEARCH MODE. Your task is to conduct comprehensive research using all available tools.

**RESEARCH STRATEGY:**
1. **Web Search**: Use WebSearch tool to find relevant documentation, tutorials, blog posts
2. **GitHub Search**: Search for related repositories, issues, pull requests, code examples
3. **Reddit/Forums**: Look for community discussions, solutions, experiences
4. **Documentation**: Find official docs, API references, guides

**TOOLS TO USE:**
- Use the WebSearch tool extensively
- Use WebFetch to read detailed pages
- Search GitHub for code examples and issues
- Look for Stack Overflow answers
- Find Reddit discussions

**OUTPUT FORMAT:**
For each finding, provide:
- Source URL
- Key insight or solution
- Relevance to current task
- Code examples if applicable

**Begin researching now.** Start with a WebSearch for the most relevant query based on our conversation context.`
    window.api.terminalSendText(prompt, activeTerminalId)
    showToast('info', 'Research Swarm', 'Starting deep web research')
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 0 ? { ...a, status: 'running' } : a)), 2000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 1 ? { ...a, status: 'running' } : a)), 6000)
    setTimeout(() => setSwarmAgents(prev => prev.map((a, i) => i === 2 ? { ...a, status: 'running' } : a)), 10000)
    setTimeout(() => { setSwarmAgents(prev => prev.map(a => ({ ...a, status: 'complete' }))); setSwarmRunning(false) }, 60000)
  }, [activeTerminalId, swarmRunning, showToast])

  // Kill swarm
  const handleKillSwarm = useCallback(() => {
    if (activeTerminalId) {
      window.api.terminalSendText('\x03', activeTerminalId) // Ctrl+C
    }
    setSwarmRunning(false)
    setSwarmAgents([])
    showToast('info', 'Swarm Stopped', 'All agents terminated')
  }, [activeTerminalId, showToast])

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
      <div className="titlebar-no-drag flex items-center gap-0.5">
        {/* Plan Button - Only on terminal */}
        {screen === 'terminal' && (
          <button
            onClick={onTogglePlan}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              showPlan
                ? 'bg-gradient-to-r from-orange-500/25 to-amber-500/25 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.3)] border border-orange-500/30'
                : planCount > 0
                ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)] border border-orange-500/25'
                : 'bg-orange-500/10 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/15 hover:to-amber-500/15 hover:shadow-[0_0_12px_rgba(249,115,22,0.15)] border border-orange-500/20 hover:border-orange-500/30'
            }`}
            title="View current plan"
          >
            <ClipboardList size={16} />
            <span>Plan</span>
            {planCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-orange-500 text-[10px] text-white font-bold shadow-[0_0_8px_rgba(249,115,22,0.6)]">{planCount}</span>
            )}
          </button>
        )}

        {/* Swarm/Hive Button - Only on terminal */}
        {screen === 'terminal' && (
          <div className="relative" ref={swarmMenuRef}>
            <button
              onClick={() => setShowSwarmMenu(!showSwarmMenu)}
              disabled={!activeTerminalId}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                swarmRunning
                  ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)] border border-amber-500/30'
                  : showSwarmMenu
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)] border border-amber-500/25'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-gradient-to-r hover:from-amber-500/15 hover:to-yellow-500/15 hover:shadow-[0_0_12px_rgba(251,191,36,0.15)] border border-amber-500/20 hover:border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
              }`}
              title="Agent Swarm"
            >
              {swarmRunning ? (
                <BeeIcon size={16} className="animate-bounce" />
              ) : (
                <BeeIcon size={16} />
              )}
              <span>Hive</span>
              {swarmRunning && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              )}
            </button>

            {/* Swarm Dropdown Menu */}
            {showSwarmMenu && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-[#161616] border border-amber-500/20 rounded-xl shadow-2xl shadow-amber-500/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border-b border-amber-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-lg">
                        <BeeIcon size={16} className="text-black" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">Agent Swarm</span>
                        <p className="text-[10px] text-amber-400/60">AI-powered multi-agent system</p>
                      </div>
                    </div>
                    {swarmRunning && (
                      <button
                        onClick={handleKillSwarm}
                        className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Options */}
                {!swarmRunning && (
                  <div className="p-2 space-y-1">
                    <button
                      onClick={launchSwarmAudit}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-500/10 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25 group-hover:scale-110 transition-all">
                        <Search size={14} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-blue-300">Audit & Review</span>
                        <p className="text-[10px] text-gray-500">Security, performance, quality</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-blue-500/15 text-blue-400">3+</span>
                    </button>

                    <button
                      onClick={launchSwarmAction}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-500/10 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-green-500/15 text-green-400 group-hover:bg-green-500/25 group-hover:scale-110 transition-all">
                        <Play size={14} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-green-300">Fix & Improve</span>
                        <p className="text-[10px] text-gray-500">Bug fixes, refactoring, tests</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-green-500/15 text-green-400">3+</span>
                    </button>

                    {/* Divider */}
                    <div className="border-t border-white/[0.06] my-2" />

                    {/* New Specialized Swarms */}
                    <button
                      onClick={launchSwarmDesign}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-pink-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-pink-500/15 text-pink-400 group-hover:bg-pink-500/25 transition-all">
                        <Paintbrush size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-pink-300">Design Polish</span>
                        <p className="text-[9px] text-gray-500">Colors, spacing, visual polish</p>
                      </div>
                    </button>

                    <button
                      onClick={launchSwarmUIFix}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-orange-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-400 group-hover:bg-orange-500/25 transition-all">
                        <Layers size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-orange-300">UI Fix</span>
                        <p className="text-[9px] text-gray-500">Layout bugs, overflow, z-index</p>
                      </div>
                    </button>

                    <button
                      onClick={launchSwarmRoute}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-cyan-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 group-hover:bg-cyan-500/25 transition-all">
                        <Route size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-cyan-300">Route</span>
                        <p className="text-[9px] text-gray-500">Navigation, routing, flow</p>
                      </div>
                    </button>

                    <button
                      onClick={launchSwarmAPI}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-purple-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 group-hover:bg-purple-500/25 transition-all">
                        <Server size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-purple-300">API</span>
                        <p className="text-[9px] text-gray-500">Data fetching, IPC, handlers</p>
                      </div>
                    </button>

                    <button
                      onClick={launchSwarmConnector}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-teal-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400 group-hover:bg-teal-500/25 transition-all">
                        <Link2 size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-teal-300">Connector</span>
                        <p className="text-[9px] text-gray-500">MCP, Git, integrations</p>
                      </div>
                    </button>

                    <button
                      onClick={launchSwarmResearch}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-indigo-500/10 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-all">
                        <Search size={12} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-white group-hover:text-indigo-300">Research</span>
                        <p className="text-[9px] text-gray-500">Web, GitHub, Reddit, docs</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Agent Status */}
                {swarmAgents.length > 0 && (
                  <div className="px-3 py-2 bg-black/40 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">Agents</span>
                      <span className="text-[9px] text-amber-400 font-mono">
                        {swarmAgents.filter(a => a.status === 'complete').length}/{swarmAgents.length}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 mb-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
                        style={{ width: `${(swarmAgents.filter(a => a.status === 'complete').length / swarmAgents.length) * 100}%` }}
                      />
                    </div>
                    <div className="space-y-1">
                      {swarmAgents.slice(0, 3).map(agent => (
                        <div key={agent.id} className="flex items-center gap-2 text-[10px]">
                          {agent.status === 'running' ? (
                            <Loader2 size={10} className="text-amber-400 animate-spin" />
                          ) : agent.status === 'complete' ? (
                            <CheckCircle size={10} className="text-green-400" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
                          )}
                          <span className={agent.status === 'running' ? 'text-amber-400' : agent.status === 'complete' ? 'text-green-400' : 'text-gray-600'}>
                            {agent.name}
                          </span>
                        </div>
                      ))}
                      {swarmAgents.length > 3 && (
                        <span className="text-[9px] text-gray-600">+{swarmAgents.length - 3} more</span>
                      )}
                    </div>
                    {!swarmRunning && (
                      <button onClick={() => setSwarmAgents([])} className="w-full mt-2 py-1 text-[9px] text-gray-600 hover:text-gray-400 transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
        {screen === 'terminal' && (
          <div className="relative" ref={gitMenuRef}>
            <button
              onClick={() => setShowGitMenu(!showGitMenu)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                showGitMenu ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/[0.06] text-gray-400'
              }`}
              title="Git actions"
            >
              <GitBranch size={14} />
              {gitBranch && <span className="max-w-[50px] truncate text-[10px]">{gitBranch}</span>}
            </button>

            {showGitMenu && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-[#1e1e1e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-gray-500">
                  Git Actions {gitBranch && <span className="text-green-400 ml-1">({gitBranch})</span>}
                </div>
                {gitActions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => { sendPrompt(action.prompt); setShowGitMenu(false) }}
                    disabled={!activeTerminalId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                showDeployMenu ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/[0.06] text-gray-400'
              }`}
              title="Deploy"
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
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
                  <button onClick={() => setShowPreviewPopover(false)} className="p-0.5 hover:bg-white/[0.06] rounded">
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
                    <button onClick={copyPath} className="p-2 bg-[#141414] border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors" title="Copy path">
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={openPreviewFile} disabled={!previewPath.trim()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#cc785c] hover:bg-[#cc785c]/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors">
                      <Eye size={14} /> Preview
                    </button>
                    <button onClick={openInExternalBrowser} disabled={!previewPath.trim()} className="flex items-center justify-center px-3 py-2 bg-[#141414] border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-300 transition-colors" title="Open in browser">
                      <ExternalLink size={14} />
                    </button>
                    <button onClick={showInFinder} disabled={!previewPath.trim()} className="flex items-center justify-center px-3 py-2 bg-[#141414] border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-300 transition-colors" title="Show in Finder">
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

        {/* History - Quick access */}
        <button
          onClick={() => onNavigate?.('history')}
          className="flex items-center px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors"
          title="Session History"
        >
          <History size={14} />
        </button>

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
