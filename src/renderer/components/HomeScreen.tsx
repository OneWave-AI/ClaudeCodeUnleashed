import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Play,
  FolderOpen,
  Sparkles,
  History,
  Download,
  Code2,
  Rocket,
  ArrowRight,
  Zap,
  Bot,
  MessageSquare,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
  Plug,
  Settings,
  TrendingUp,
  DollarSign,
  Timer,
  Activity,
  BarChart3,
  Cpu,
  Wrench,
  GitBranch,
  Terminal,
  Globe,
  FileEdit,
  Search
} from 'lucide-react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions, Engine } from '@tsparticles/engine'

interface HomeScreenProps {
  cwd: string
  claudeInstalled: boolean | null
  onStartSession: () => void
  onSelectFolder: () => void
  onOpenSkills: () => void
  onOpenHistory: () => void
  onOpenSettings?: () => void
  onOpenSuperAgent?: () => void
  onOpenAnalytics?: () => void
}

interface RecentProject {
  folder: string
  name: string
  timestamp: number
}

interface Stats {
  conversations: number
  skills: number
  agents: number
  mcpServers: number
}

interface DetailedStats {
  totalSessions: number
  totalTokens: number
  totalTimeMinutes: number
  avgSessionLength: number
  sessions7Days: number
  sessions30Days: number
  time7Days: number
  time30Days: number
  recentActivity: { date: string; sessions: number; minutes: number }[]
  topProjects: { name: string; folder: string; sessions: number; timeMinutes: number }[]
  totalProjects: number
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

export default function HomeScreen({
  cwd,
  claudeInstalled,
  onStartSession,
  onSelectFolder,
  onOpenSkills,
  onOpenHistory,
  onOpenSettings,
  onOpenSuperAgent,
  onOpenAnalytics
}: HomeScreenProps) {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [stats, setStats] = useState<Stats>({ conversations: 0, skills: 0, agents: 0, mcpServers: 0 })
  const [detailedStats, setDetailedStats] = useState<DetailedStats>({
    totalSessions: 0,
    totalTokens: 0,
    totalTimeMinutes: 0,
    avgSessionLength: 0,
    sessions7Days: 0,
    sessions30Days: 0,
    time7Days: 0,
    time30Days: 0,
    recentActivity: [],
    topProjects: [],
    totalProjects: 0
  })
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [isStarting, setIsStarting] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [particlesReady, setParticlesReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize particles engine
  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine)
    }).then(() => {
      setParticlesReady(true)
    })
  }, [])

  // Trigger mount animation
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  // Lightweight particle configuration for performance
  const particlesOptions: ISourceOptions = useMemo(() => ({
    fullScreen: false,
    background: { color: { value: 'transparent' } },
    fpsLimit: 30,
    particles: {
      number: {
        value: 40,
        density: { enable: true, width: 1920, height: 1080 }
      },
      color: {
        value: ['#cc785c', '#a78bfa', '#60a5fa', '#ffffff']
      },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.4 }
      },
      size: {
        value: { min: 1, max: 3 }
      },
      move: {
        enable: true,
        speed: 0.3,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'out' }
      },
      links: {
        enable: false
      }
    },
    interactivity: {
      events: {
        onHover: { enable: false },
        resize: { enable: true }
      }
    },
    detectRetina: false
  }), [])

  // Load data
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoadingState('loading')
      try {
        const conversations = await window.api.listConversations()
        if (cancelled) return
        const projectMap = new Map<string, RecentProject>()
        for (const conv of conversations) {
          if (conv.projectFolder && !projectMap.has(conv.projectFolder)) {
            projectMap.set(conv.projectFolder, {
              folder: conv.projectFolder,
              name: conv.projectFolder.split('/').pop() || 'Project',
              timestamp: conv.timestamp
            })
          }
        }
        setRecentProjects(Array.from(projectMap.values()).slice(0, 3))
        const [skills, agents, mcpServers] = await Promise.all([
          window.api.listSkills().catch(() => []),
          window.api.listAgents().catch(() => []),
          window.api.mcpList().catch(() => [])
        ])
        if (cancelled) return
        setStats({
          conversations: conversations.length,
          skills: Array.isArray(skills) ? skills.length : 0,
          agents: Array.isArray(agents) ? agents.length : 0,
          mcpServers: Array.isArray(mcpServers) ? mcpServers.filter((s: { enabled: boolean }) => s.enabled).length : 0
        })

        // Calculate detailed stats from conversations using REAL duration data
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        let sessions7Days = 0
        let sessions30Days = 0
        let time7Days = 0
        let time30Days = 0
        let totalTokens = 0
        let totalMinutes = 0

        // Group sessions by date for activity chart (last 7 days)
        const activityMap = new Map<string, { sessions: number; minutes: number }>()
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          activityMap.set(dateStr, { sessions: 0, minutes: 0 })
        }

        // Track projects with time
        const projectCounts = new Map<string, { name: string; folder: string; count: number; timeMinutes: number }>()

        for (const conv of conversations) {
          const convDate = new Date(conv.timestamp)
          const convDateStr = convDate.toISOString().split('T')[0]

          // Get REAL duration from stats (in milliseconds), convert to minutes
          const durationMinutes = conv.stats?.duration
            ? Math.round(conv.stats.duration / 1000 / 60)
            : 10 // Default 10 min if no duration data

          // Get REAL token count from stats
          const tokens = conv.stats?.estimatedTokens || 2500

          // Count by time period
          if (convDate >= sevenDaysAgo) {
            sessions7Days++
            time7Days += durationMinutes
          }
          if (convDate >= thirtyDaysAgo) {
            sessions30Days++
            time30Days += durationMinutes
          }

          // Track activity by date with time
          const dayData = activityMap.get(convDateStr)
          if (dayData) {
            dayData.sessions++
            dayData.minutes += durationMinutes
          }

          // Track projects with time
          if (conv.projectFolder) {
            const existing = projectCounts.get(conv.projectFolder)
            if (existing) {
              existing.count++
              existing.timeMinutes += durationMinutes
            } else {
              projectCounts.set(conv.projectFolder, {
                name: conv.projectFolder.split('/').pop() || 'Unknown',
                folder: conv.projectFolder,
                count: 1,
                timeMinutes: durationMinutes
              })
            }
          }

          totalTokens += tokens
          totalMinutes += durationMinutes
        }

        // Sort projects by TIME spent (for developer billing)
        const topProjects = Array.from(projectCounts.values())
          .sort((a, b) => b.timeMinutes - a.timeMinutes)
          .slice(0, 5)
          .map(p => ({ name: p.name, folder: p.folder, sessions: p.count, timeMinutes: p.timeMinutes }))

        // Convert activity map to array
        const recentActivity = Array.from(activityMap.entries())
          .map(([date, data]) => ({ date, sessions: data.sessions, minutes: data.minutes }))

        setDetailedStats({
          totalSessions: conversations.length,
          totalTokens,
          totalTimeMinutes: totalMinutes,
          avgSessionLength: conversations.length > 0 ? Math.round(totalMinutes / conversations.length) : 0,
          sessions7Days,
          sessions30Days,
          time7Days,
          time30Days,
          recentActivity,
          topProjects,
          totalProjects: projectCounts.size
        })

        setLoadingState('loaded')
      } catch {
        if (!cancelled) setLoadingState('error')
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  const handleStart = useCallback(() => {
    if (!cwd || claudeInstalled === false || isStarting) return
    setIsStarting(true)
    onStartSession()
  }, [cwd, claudeInstalled, isStarting, onStartSession])

  const handleProjectClick = useCallback((folder: string) => {
    window.api.setCwd(folder)
    onStartSession()
  }, [onStartSession])

  const canStart = Boolean(cwd) && claudeInstalled !== false

  const formatTime = useMemo(() => (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }, [])

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-[#030305]">
      {/* Layered Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 20%, #0a0a12 0%, #030305 100%)' }} />

        {/* Particles */}
        {particlesReady && <Particles id="space-dust" options={particlesOptions} className="absolute inset-0" />}

        {/* Static gradient orbs - no animation for performance */}
        <div className="absolute w-96 h-96 -top-20 -left-20 rounded-full bg-[#cc785c]/5 blur-3xl" />
        <div className="absolute w-80 h-80 -bottom-20 -right-20 rounded-full bg-purple-500/5 blur-3xl" />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        {/* Vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)' }} />

        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]" style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(204,120,92,0.04) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
      </div>

      {/* Content */}
      <div className={`relative z-10 max-w-3xl mx-auto px-6 py-12 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
        {/* Compact Hero */}
        <div className="text-center mb-10">
          {/* Modern Arena Logo */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-5">
            {/* Outer glow rings */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#cc785c]/20 via-purple-500/10 to-transparent blur-xl animate-pulse-slow" />
            <div className="absolute inset-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent blur-lg" />

            {/* Main container */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0d0d0d] via-[#161618] to-[#0d0d0d] border border-white/[0.08] shadow-2xl shadow-[#cc785c]/20 floating-card overflow-hidden">
              {/* Inner gradient accent */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#cc785c]/10 via-transparent to-purple-500/10" />

              {/* Logo SVG */}
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="relative z-10">
                <defs>
                  <linearGradient id="arenaGradNew" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#cc785c"/>
                    <stop offset="50%" stopColor="#e8956e"/>
                    <stop offset="100%" stopColor="#cc785c"/>
                  </linearGradient>
                  <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa"/>
                    <stop offset="100%" stopColor="#7c3aed"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Outer hexagon - subtle */}
                <polygon points="40,10 66,22 66,58 40,70 14,58 14,22" fill="none" stroke="url(#purpleGrad)" strokeWidth="1" opacity="0.3"/>

                {/* Inner hexagon - more visible */}
                <polygon points="40,18 58,27 58,53 40,62 22,53 22,27" fill="none" stroke="url(#arenaGradNew)" strokeWidth="1.5" opacity="0.5"/>

                {/* Code brackets - main element */}
                <g filter="url(#glow)">
                  <path d="M30,30 L24,40 L30,50" fill="none" stroke="url(#arenaGradNew)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M50,30 L56,40 L50,50" fill="none" stroke="url(#arenaGradNew)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </g>

                {/* Center cursor */}
                <rect x="37" y="33" width="6" height="14" rx="2" fill="url(#arenaGradNew)" opacity="0.9"/>

                {/* Sparkle accents */}
                <circle cx="28" cy="24" r="1.5" fill="#cc785c" opacity="0.6"/>
                <circle cx="52" cy="56" r="1" fill="#a78bfa" opacity="0.5"/>
                <circle cx="58" cy="32" r="1.5" fill="#e8956e" opacity="0.4"/>
              </svg>

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#cc785c]/30 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-purple-500/30 rounded-br-lg" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            <span className="text-white">Claude</span>
            <span className="bg-gradient-to-r from-[#cc785c] to-[#e8956e] bg-clip-text text-transparent">Code</span>
            <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent ml-2">Arena</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Your autonomous AI coding companion. Let Claude build, debug, and ship while you focus on what matters.
          </p>

          {/* Stats summary - always shown */}
          {loadingState === 'loaded' && (
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <span className="text-gray-500"><span className="text-white font-medium">{stats.conversations}</span> chats</span>
              <span className="text-gray-700">•</span>
              <span className="text-gray-500"><span className="text-white font-medium">{stats.skills + stats.agents}</span> tools</span>
              <span className="text-gray-700">•</span>
              <span className="text-gray-500"><span className="text-white font-medium">{stats.mcpServers}</span> MCP</span>
            </div>
          )}
        </div>

        {/* Analytics Dashboard - Skeleton Loader */}
        {loadingState === 'loading' && (
          <div className="mb-6 animate-pulse">
            <div className="floating-card bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5">
              {/* Header skeleton */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                  <div className="w-24 h-4 rounded bg-white/[0.06]" />
                </div>
                <div className="w-20 h-3 rounded bg-white/[0.06]" />
              </div>

              {/* Stats Cards skeleton */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-black/30 rounded-xl p-3 border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded bg-white/[0.06]" />
                      <div className="w-12 h-2 rounded bg-white/[0.06]" />
                    </div>
                    <div className="w-16 h-6 rounded bg-white/[0.08]" />
                  </div>
                ))}
              </div>

              {/* Two columns skeleton */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-20 h-2 rounded bg-white/[0.06]" />
                    <div className="w-3 h-3 rounded bg-white/[0.06]" />
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-white/[0.06]"
                          style={{ height: `${Math.random() * 60 + 20}%` }}
                        />
                        <div className="w-2 h-2 rounded bg-white/[0.04]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-20 h-2 rounded bg-white/[0.06]" />
                    <div className="w-3 h-3 rounded bg-white/[0.06]" />
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded bg-white/[0.06]" />
                        <div className="flex-1 h-2 rounded bg-white/[0.06]" />
                        <div className="w-16 h-1.5 rounded bg-white/[0.06]" />
                        <div className="w-8 h-2 rounded bg-white/[0.06]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer skeleton */}
              <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-2 rounded bg-white/[0.06]" />
                  <div className="w-28 h-2 rounded bg-white/[0.06]" />
                </div>
                <div className="w-16 h-2 rounded bg-white/[0.04]" />
              </div>
            </div>
          </div>
        )}

        {/* Analytics Dashboard - Actual Content */}
        {loadingState === 'loaded' && (
          <div className="mb-6 animate-in fade-in duration-500">
            <div className="floating-card bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-5">
              {/* Dashboard Header with View Details link */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#cc785c]/10">
                    <BarChart3 size={14} className="text-[#cc785c]" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Your Activity</h3>
                </div>
                {onOpenAnalytics && (
                  <button
                    onClick={onOpenAnalytics}
                    className="flex items-center gap-1 text-xs text-[#cc785c] hover:text-[#e8956e] transition-colors"
                  >
                    View Details <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {/* Stats Cards Grid - 4 columns */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <StatCard
                  icon={MessageSquare}
                  label="This Week"
                  value={detailedStats.sessions7Days}
                  color="orange"
                />
                <StatCard
                  icon={Timer}
                  label="Time Coded"
                  value={formatMinutes(detailedStats.time7Days)}
                  color="purple"
                />
                <StatCard
                  icon={Activity}
                  label="Projects"
                  value={detailedStats.totalProjects}
                  color="blue"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Tokens"
                  value={formatNumber(detailedStats.totalTokens)}
                  color="green"
                />
              </div>

              {/* Two columns: Activity Chart + Top Projects */}
              <div className="grid grid-cols-2 gap-4">
                {/* Activity Chart */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">7-Day Activity</span>
                    <TrendingUp size={12} className="text-green-400" />
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {detailedStats.recentActivity.map((day, i) => {
                      const maxSessions = Math.max(...detailedStats.recentActivity.map(d => d.sessions), 1)
                      const height = day.sessions > 0 ? Math.max((day.sessions / maxSessions) * 100, 15) : 8
                      const isToday = i === detailedStats.recentActivity.length - 1
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.sessions} sessions, ${day.minutes}m`}>
                          <div
                            className={`w-full rounded-sm transition-all ${
                              isToday ? 'bg-gradient-to-t from-[#cc785c] to-[#e8956e]' :
                              day.sessions > 0 ? 'bg-[#cc785c]/40' : 'bg-white/[0.06]'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[8px] text-gray-600">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Top Projects by TIME */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Top Projects</span>
                    <Clock size={12} className="text-purple-400" />
                  </div>
                  <div className="space-y-2">
                    {detailedStats.topProjects.slice(0, 4).map((project) => {
                      const maxTime = detailedStats.topProjects[0]?.timeMinutes || 1
                      const percent = (project.timeMinutes / maxTime) * 100
                      return (
                        <div key={project.folder} className="flex items-center gap-2">
                          <Code2 size={10} className="text-gray-500 flex-shrink-0" />
                          <span className="text-[10px] text-gray-400 truncate flex-1">{project.name}</span>
                          <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-gray-500 w-10 text-right flex-shrink-0">{formatMinutes(project.timeMinutes)}</span>
                        </div>
                      )
                    })}
                    {detailedStats.topProjects.length === 0 && (
                      <p className="text-[10px] text-gray-600 text-center py-2">No project data yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Insights */}
              <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Cpu size={10} className="text-[#cc785c]" />
                    Avg session: <span className="text-gray-400">{detailedStats.avgSessionLength}m</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Plug size={10} className="text-purple-400" />
                    30-day: <span className="text-gray-400">{detailedStats.sessions30Days} sessions</span>
                  </span>
                </div>
                <span className="text-[9px] text-gray-700">Updated just now</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="floating-card bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 mb-6">
          {/* Folder Selector - Premium */}
          <button onClick={onSelectFolder} className="w-full group flex items-center gap-4 rounded-xl bg-black/40 hover:bg-black/60 border border-white/[0.08] hover:border-[#cc785c]/40 p-4 mb-4 transition-all duration-300 hover:shadow-lg hover:shadow-[#cc785c]/10">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-[#cc785c]/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#cc785c]/20 to-[#cc785c]/5 flex items-center justify-center group-hover:scale-105 transition-all duration-300 border border-[#cc785c]/20">
                <FolderOpen className="w-5 h-5 text-[#cc785c]" />
              </div>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">Project Folder</p>
              <p className="text-white text-sm font-mono truncate">{cwd || 'Select a folder...'}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#cc785c]/20 transition-all duration-300">
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#cc785c] group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </button>

          {/* Claude not installed */}
          {claudeInstalled === false && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
              <p className="text-amber-400 text-sm mb-2">Claude CLI not installed</p>
              <button onClick={() => window.api.installClaude()} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg py-2 text-sm transition-colors">
                <Download size={16} /> Install Claude CLI
              </button>
            </div>
          )}

          {/* Start Buttons */}
          <div className="flex gap-3">
            {/* Start with Project - Premium */}
            <div className="flex-1 relative group/start">
              {canStart && !isStarting && (
                <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-[#cc785c] to-[#e8956e] opacity-75 blur-sm group-hover/start:opacity-100 transition-opacity" />
              )}
              <button
                onClick={handleStart}
                disabled={!canStart || isStarting}
                className={`relative w-full flex items-center justify-center gap-3 rounded-xl py-4 font-semibold text-lg transition-all duration-300 ${
                  canStart && !isStarting
                    ? 'bg-gradient-to-r from-[#cc785c] via-[#d4856a] to-[#cc785c] bg-[length:200%_100%] animate-gradient-x text-white shadow-xl shadow-[#cc785c]/30 hover:shadow-2xl hover:shadow-[#cc785c]/40 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isStarting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>Starting...</span></>
                ) : (
                  <>
                    <div className="relative">
                      <Play className="w-5 h-5" fill="currentColor" />
                      {canStart && <div className="absolute inset-0 animate-ping opacity-30"><Play className="w-5 h-5" fill="currentColor" /></div>}
                    </div>
                    <span>Start Session</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover/start:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Start Blank Session - Premium */}
            <button
              onClick={() => {
                setIsStarting(true)
                onStartSession()
              }}
              disabled={claudeInstalled === false || isStarting}
              className={`px-6 flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 border ${
                claudeInstalled !== false && !isStarting
                  ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.1] hover:border-white/[0.2] text-gray-300 hover:text-white hover:scale-105 backdrop-blur-sm'
                  : 'bg-gray-800/30 text-gray-600 cursor-not-allowed border-transparent'
              }`}
              title="Start without a project folder"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">Blank</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-3">
            <kbd className="px-1.5 py-1 rounded-md bg-white/5 border border-white/10 text-gray-500 font-mono shadow-sm">⌘</kbd>
            <span className="mx-1">+</span>
            <kbd className="px-1.5 py-1 rounded-md bg-white/5 border border-white/10 text-gray-500 font-mono shadow-sm">↵</kbd>
            <span className="ml-2 text-gray-500">to start with project</span>
          </p>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <QuickAction icon={FolderOpen} label="Open" onClick={onSelectFolder} color="blue" />
          <QuickAction icon={Sparkles} label="Tools" onClick={onOpenSkills} color="orange" badge={stats.skills + stats.agents || undefined} />
          <QuickAction icon={History} label="History" onClick={onOpenHistory} color="purple" badge={stats.conversations || undefined} />
          <QuickAction icon={Settings} label="Settings" onClick={onOpenSettings || (() => {})} color="gray" />
        </div>

        {/* Super Agent Button - Premium Design */}
        {onOpenSuperAgent && (
          <div className="relative mb-6 group">
            {/* Animated gradient border */}
            {claudeInstalled !== false && (
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500 animate-gradient-shift" />
            )}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-purple-500/50 via-pink-500/50 to-purple-500/50 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundSize: '200% 100%', animation: 'gradient-x 3s ease infinite' }} />

            <button
              onClick={onOpenSuperAgent}
              disabled={claudeInstalled === false}
              className={`relative w-full flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ${
                claudeInstalled !== false
                  ? 'bg-[#0d0d15] hover:bg-[#12121a]'
                  : 'bg-gray-800/30 border border-gray-700/30 cursor-not-allowed'
              }`}
            >
              {/* Glowing icon container */}
              <div className="relative">
                {claudeInstalled !== false && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 blur-lg opacity-50 group-hover:opacity-75 transition-opacity animate-pulse-slow" />
                )}
                <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  claudeInstalled !== false
                    ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 group-hover:scale-110 shadow-lg shadow-purple-500/25'
                    : 'bg-gray-700'
                }`}>
                  <Zap className={`w-7 h-7 ${claudeInstalled !== false ? 'text-white drop-shadow-lg' : 'text-gray-500'}`} />
                  {claudeInstalled !== false && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/0 to-white/20" />
                  )}
                </div>
              </div>

              {/* Text content */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`text-lg font-bold tracking-tight ${claudeInstalled !== false ? 'text-white' : 'text-gray-500'}`}>
                    Super Agent
                  </h3>
                  {claudeInstalled !== false && (
                    <span className="relative px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse-slow" />
                      <span className="relative text-white">New</span>
                    </span>
                  )}
                </div>
                <p className={`text-sm ${claudeInstalled !== false ? 'text-gray-400' : 'text-gray-600'}`}>
                  Autonomous AI-powered task execution
                </p>
                {claudeInstalled !== false && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-purple-400/80">
                      <Bot className="w-3 h-3" /> LLM-driven
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-pink-400/80">
                      <Zap className="w-3 h-3" /> Auto-approve
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                claudeInstalled !== false
                  ? 'bg-white/5 group-hover:bg-purple-500/20 group-hover:scale-110'
                  : 'bg-gray-800/50'
              }`}>
                <ChevronRight className={`w-5 h-5 transition-all duration-300 group-hover:translate-x-0.5 ${
                  claudeInstalled !== false ? 'text-purple-400 group-hover:text-purple-300' : 'text-gray-600'
                }`} />
              </div>
            </button>
          </div>
        )}

        {/* Recent Projects - Premium */}
        {recentProjects.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2 font-medium">
              <Clock size={10} className="text-gray-600" /> Recent Projects
            </h3>
            <div className="space-y-2">
              {recentProjects.map((project, index) => (
                <button
                  key={project.folder}
                  onClick={() => handleProjectClick(project.folder)}
                  className="w-full group flex items-center gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-[#cc785c]/30 p-3.5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-[#cc785c]/5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:from-[#cc785c]/20 group-hover:to-[#cc785c]/5 transition-all duration-300 border border-white/5">
                    <Code2 className="w-4 h-4 text-gray-500 group-hover:text-[#cc785c] transition-colors duration-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate font-medium">{project.name}</span>
                    <span className="text-[10px] text-gray-600">{formatTime(project.timestamp)}</span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-white/0 group-hover:bg-white/5 flex items-center justify-center transition-all duration-300">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#cc785c] group-hover:translate-x-0.5 transition-all duration-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <span className="text-[10px] text-gray-700">ClaudeCode Arena • Built with <Rocket className="w-2.5 h-2.5 inline text-purple-400" /></span>
        </div>
      </div>

      <style>{`
        .floating-card {
          animation: float 12s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-style: preserve-3d;
        }

        /* Nebula orbs - smaller and much slower */
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }

        .nebula-1 {
          width: 400px;
          height: 400px;
          top: -10%;
          left: -10%;
          background: radial-gradient(ellipse at center,
            rgba(204,120,92,0.12) 0%,
            rgba(204,120,92,0.04) 40%,
            transparent 70%);
          animation: nebula1 120s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .nebula-2 {
          width: 350px;
          height: 350px;
          bottom: -5%;
          right: -5%;
          background: radial-gradient(ellipse at center,
            rgba(139,92,246,0.1) 0%,
            rgba(139,92,246,0.03) 45%,
            transparent 70%);
          animation: nebula2 150s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .nebula-3 {
          width: 250px;
          height: 250px;
          top: 50%;
          left: 60%;
          background: radial-gradient(ellipse at center,
            rgba(59,130,246,0.08) 0%,
            rgba(59,130,246,0.02) 50%,
            transparent 70%);
          animation: nebula3 100s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .nebula-4 {
          width: 180px;
          height: 180px;
          top: 30%;
          right: 30%;
          background: radial-gradient(ellipse at center,
            rgba(251,191,36,0.06) 0%,
            rgba(251,191,36,0.02) 50%,
            transparent 70%);
          animation: nebula4 90s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateZ(0) rotateX(0deg);
          }
          25% {
            transform: translateY(-2px) translateZ(3px) rotateX(0.3deg);
          }
          50% {
            transform: translateY(-4px) translateZ(6px) rotateX(0.6deg);
          }
          75% {
            transform: translateY(-2px) translateZ(3px) rotateX(0.3deg);
          }
        }

        @keyframes nebula1 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.6;
          }
          25% {
            transform: translate3d(30px, -20px, 10px) scale(1.05);
            opacity: 0.7;
          }
          50% {
            transform: translate3d(15px, 25px, -5px) scale(0.98);
            opacity: 0.55;
          }
          75% {
            transform: translate3d(-20px, 10px, 8px) scale(1.02);
            opacity: 0.65;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.6;
          }
        }

        @keyframes nebula2 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.5;
          }
          33% {
            transform: translate3d(-25px, 15px, 12px) scale(1.04);
            opacity: 0.6;
          }
          66% {
            transform: translate3d(20px, -12px, -8px) scale(0.96);
            opacity: 0.45;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.5;
          }
        }

        @keyframes nebula3 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate3d(-18px, -22px, 15px) scale(1.08);
            opacity: 0.55;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.4;
          }
        }

        @keyframes nebula4 {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.35;
          }
          40% {
            transform: translate3d(15px, -12px, 8px) scale(1.06);
            opacity: 0.5;
          }
          70% {
            transform: translate3d(-10px, 18px, -5px) scale(0.94);
            opacity: 0.3;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.35;
          }
        }

        /* Add perspective to container */
        .perspective-wrap {
          perspective: 1000px;
          transform-style: preserve-3d;
        }

        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.75; }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .floating-card, .nebula, .animate-gradient-x, .animate-pulse-slow { animation: none; }
        }
      `}</style>
    </div>
  )
}

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function formatMinutes(mins: number): string {
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
  }
  return `${mins}m`
}

function getToolIcon(name: string): typeof Terminal {
  const icons: Record<string, typeof Terminal> = {
    Read: FileEdit,
    Write: FileEdit,
    Edit: FileEdit,
    Bash: Terminal,
    Grep: Search,
    Glob: Search,
    Git: GitBranch,
    Browser: Globe
  }
  return icons[name] || Wrench
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string; size?: number }>
  label: string
  value: string | number
  color: 'orange' | 'blue' | 'green' | 'purple'
}) {
  const colors = {
    orange: {
      bg: 'bg-[#cc785c]/10',
      icon: 'text-[#cc785c]',
      glow: 'shadow-[#cc785c]/10'
    },
    blue: {
      bg: 'bg-blue-500/10',
      icon: 'text-blue-400',
      glow: 'shadow-blue-500/10'
    },
    green: {
      bg: 'bg-emerald-500/10',
      icon: 'text-emerald-400',
      glow: 'shadow-emerald-500/10'
    },
    purple: {
      bg: 'bg-purple-500/10',
      icon: 'text-purple-400',
      glow: 'shadow-purple-500/10'
    }
  }

  return (
    <div className={`relative bg-black/30 rounded-xl p-3 border border-white/[0.04] hover:border-white/[0.08] transition-all hover:shadow-lg ${colors[color].glow}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colors[color].bg}`}>
          <Icon size={12} className={colors[color].icon} />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick, color, badge }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  color: 'blue' | 'orange' | 'purple' | 'gray'
  badge?: number
}) {
  const colors = {
    blue: {
      bg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
      icon: 'text-blue-400',
      border: 'hover:border-blue-500/40',
      glow: 'group-hover:shadow-blue-500/20',
      badge: 'bg-blue-500/20 text-blue-300'
    },
    orange: {
      bg: 'bg-[#cc785c]/10 group-hover:bg-[#cc785c]/25',
      icon: 'text-[#cc785c]',
      border: 'hover:border-[#cc785c]/40',
      glow: 'group-hover:shadow-[#cc785c]/20',
      badge: 'bg-[#cc785c]/20 text-[#e8956e]'
    },
    purple: {
      bg: 'bg-purple-500/10 group-hover:bg-purple-500/20',
      icon: 'text-purple-400',
      border: 'hover:border-purple-500/40',
      glow: 'group-hover:shadow-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-300'
    },
    gray: {
      bg: 'bg-gray-500/10 group-hover:bg-gray-500/20',
      icon: 'text-gray-400',
      border: 'hover:border-gray-500/30',
      glow: 'group-hover:shadow-gray-500/10',
      badge: 'bg-gray-500/20 text-gray-400'
    }
  }
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] ${colors[color].border} p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg ${colors[color].glow} backdrop-blur-sm`}
    >
      {badge !== undefined && (
        <div className={`absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full ${colors[color].badge} text-[10px] font-semibold shadow-lg`}>
          {badge}
        </div>
      )}
      <div className={`relative w-11 h-11 rounded-xl ${colors[color].bg} flex items-center justify-center transition-all duration-300 group-hover:scale-110`}>
        <Icon className={`w-5 h-5 ${colors[color].icon} transition-all duration-300`} />
      </div>
      <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors duration-300">{label}</span>
    </button>
  )
}
