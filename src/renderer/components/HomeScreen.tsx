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
  Search,
  Hexagon
} from 'lucide-react'

// Custom Bee Icon component
const BeeIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Body */}
    <ellipse cx="12" cy="14" rx="5" ry="6" fill="currentColor" opacity="0.2"/>
    <ellipse cx="12" cy="14" rx="5" ry="6"/>
    {/* Stripes */}
    <path d="M7.5 12h9" strokeWidth="1.5"/>
    <path d="M7.5 15h9" strokeWidth="1.5"/>
    {/* Head */}
    <circle cx="12" cy="7" r="3" fill="currentColor" opacity="0.3"/>
    <circle cx="12" cy="7" r="3"/>
    {/* Wings */}
    <ellipse cx="7" cy="11" rx="3" ry="2" fill="currentColor" opacity="0.15" transform="rotate(-30 7 11)"/>
    <ellipse cx="17" cy="11" rx="3" ry="2" fill="currentColor" opacity="0.15" transform="rotate(30 17 11)"/>
    {/* Antennae */}
    <path d="M10 5 L8 2"/>
    <path d="M14 5 L16 2"/>
    {/* Stinger */}
    <path d="M12 20 L12 22"/>
  </svg>
)
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions, Engine } from '@tsparticles/engine'
import { useAppStore } from '../store'

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
  onOpenHive?: () => void
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
  // Time analysis
  peakHour: number
  peakDay: string
  hourlyDistribution: number[] // 24 hours, sessions per hour
  dailyDistribution: number[] // 7 days (Sun-Sat), sessions per day
  productivityScore: number // 0-100 based on consistency
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
  onOpenAnalytics,
  onOpenHive
}: HomeScreenProps) {
  // Get setCwd from store to keep it in sync when clicking projects
  const setCwd = useAppStore((state) => state.setCwd)

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [stats, setStats] = useState<Stats>({ conversations: 0, skills: 0, agents: 0, mcpServers: 0 })
  const [dockHoverIndex, setDockHoverIndex] = useState<number | null>(null)
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
    totalProjects: 0,
    peakHour: 0,
    peakDay: 'N/A',
    hourlyDistribution: Array(24).fill(0),
    dailyDistribution: Array(7).fill(0),
    productivityScore: 0
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
        // Use local date strings to avoid timezone issues
        const getLocalDateStr = (d: Date) => {
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }
        const activityMap = new Map<string, { sessions: number; minutes: number }>()
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = getLocalDateStr(date)
          activityMap.set(dateStr, { sessions: 0, minutes: 0 })
        }

        // Track projects with time
        const projectCounts = new Map<string, { name: string; folder: string; count: number; timeMinutes: number }>()

        // Time analysis tracking
        const hourlyDistribution = Array(24).fill(0)
        const dailyDistribution = Array(7).fill(0)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

        for (const conv of conversations) {
          const convDate = new Date(conv.timestamp)
          const convDateStr = getLocalDateStr(convDate)

          // Get REAL duration from stats (in milliseconds), convert to minutes
          const durationMinutes = conv.stats?.duration
            ? Math.round(conv.stats.duration / 1000 / 60)
            : 10 // Default 10 min if no duration data

          // Get REAL token count from stats
          const tokens = conv.stats?.estimatedTokens || 2500

          // Track hourly and daily distribution
          const hour = convDate.getHours()
          const dayOfWeek = convDate.getDay()
          hourlyDistribution[hour]++
          dailyDistribution[dayOfWeek]++

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

        // Calculate peak hour and day
        const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution))
        const peakDayIndex = dailyDistribution.indexOf(Math.max(...dailyDistribution))
        const peakDay = dayNames[peakDayIndex] || 'N/A'

        // Calculate productivity score (based on consistency - how spread out sessions are)
        const avgSessionsPerDay = conversations.length / 7
        const variance = dailyDistribution.reduce((sum, count) => sum + Math.pow(count - avgSessionsPerDay, 2), 0) / 7
        const consistency = Math.max(0, 100 - Math.sqrt(variance) * 10)
        const productivityScore = Math.round(Math.min(100, consistency + (sessions7Days > 0 ? 20 : 0)))

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
          totalProjects: projectCounts.size,
          peakHour,
          peakDay,
          hourlyDistribution,
          dailyDistribution,
          productivityScore
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
    // Update both the store and the main process cwd
    setCwd(folder)
    window.api.setCwd(folder)
    onStartSession()
  }, [setCwd, onStartSession])

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
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            <span className="text-white">Claude</span>
            <span className="bg-gradient-to-r from-[#cc785c] to-[#e8956e] bg-clip-text text-transparent">Code</span>
            <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent ml-2">Unleashed</span>
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
                          style={{ height: `${20 + i * 10}%` }}
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

              {/* Time Analysis Section skeleton */}
              <div className="mt-4 bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-24 h-2 rounded bg-white/[0.06]" />
                  <div className="w-3 h-3 rounded bg-white/[0.06]" />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="text-center">
                      <div className="w-12 h-8 rounded bg-white/[0.08] mx-auto mb-1" />
                      <div className="w-16 h-2 rounded bg-white/[0.04] mx-auto" />
                    </div>
                  ))}
                </div>
                {/* 24h Activity skeleton */}
                <div className="mt-4">
                  <div className="w-16 h-2 rounded bg-white/[0.04] mb-2" />
                  <div className="flex items-end gap-0.5 h-8">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-white/[0.04]"
                        style={{ height: `${10 + (i % 5) * 15}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    {['12am', '6am', '12pm', '6pm', '12am'].map((t) => (
                      <div key={t} className="w-6 h-1.5 rounded bg-white/[0.03]" />
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
                    {(detailedStats.recentActivity.length > 0 ? detailedStats.recentActivity :
                      // Fallback: generate 7 empty days if no data
                      Array.from({ length: 7 }, (_, i) => {
                        const date = new Date()
                        date.setDate(date.getDate() - (6 - i))
                        return { date: date.toISOString().split('T')[0], sessions: 0, minutes: 0 }
                      })
                    ).map((day, i, arr) => {
                      const maxSessions = Math.max(...arr.map(d => d.sessions), 1)
                      const height = day.sessions > 0 ? Math.max((day.sessions / maxSessions) * 100, 15) : 8
                      const isToday = i === arr.length - 1
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

              {/* Time Analysis Section */}
              <div className="mt-4 bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Work Patterns</span>
                  <Clock size={12} className="text-cyan-400" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {/* Peak Hour */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">
                      {detailedStats.peakHour > 12 ? detailedStats.peakHour - 12 : detailedStats.peakHour || 12}
                      <span className="text-sm ml-1">{detailedStats.peakHour >= 12 ? 'PM' : 'AM'}</span>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1">Peak Hour</p>
                  </div>
                  {/* Peak Day */}
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-400">{detailedStats.peakDay.slice(0, 3)}</div>
                    <p className="text-[9px] text-gray-500 mt-1">Most Active Day</p>
                  </div>
                  {/* Productivity Score */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{detailedStats.productivityScore}</div>
                    <p className="text-[9px] text-gray-500 mt-1">Consistency</p>
                  </div>
                </div>
                {/* Hourly Distribution Mini Chart */}
                <div className="mt-4">
                  <p className="text-[8px] text-gray-600 mb-2">24h Activity</p>
                  <div className="flex items-end gap-0.5 h-8">
                    {detailedStats.hourlyDistribution.map((count, hour) => {
                      const max = Math.max(...detailedStats.hourlyDistribution, 1)
                      const height = count > 0 ? Math.max((count / max) * 100, 10) : 4
                      const isWorkHour = hour >= 9 && hour <= 18
                      return (
                        <div
                          key={hour}
                          className={`flex-1 rounded-t-sm transition-all ${
                            count > 0 ? (isWorkHour ? 'bg-cyan-500/60' : 'bg-cyan-500/30') : 'bg-white/[0.04]'
                          }`}
                          style={{ height: `${height}%` }}
                          title={`${hour}:00 - ${count} sessions`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[7px] text-gray-600">12am</span>
                    <span className="text-[7px] text-gray-600">6am</span>
                    <span className="text-[7px] text-gray-600">12pm</span>
                    <span className="text-[7px] text-gray-600">6pm</span>
                    <span className="text-[7px] text-gray-600">12am</span>
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

        {/* Arena Command Bar - Unique Design */}
        <div className="flex justify-center mb-10">
          <div
            className="command-bar relative flex items-center gap-4 px-6 py-4"
            onMouseLeave={() => setDockHoverIndex(null)}
            style={{
              background: 'linear-gradient(135deg, rgba(20,20,25,0.9) 0%, rgba(10,10,12,0.95) 100%)',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 60px -15px rgba(0,0,0,0.7), inset 0 0 30px rgba(204,120,92,0.03)',
            }}
          >
            {/* Animated border glow */}
            <div className="absolute -inset-[1px] rounded-[21px] opacity-40 pointer-events-none" style={{
              background: 'linear-gradient(90deg, rgba(204,120,92,0.3), rgba(168,85,247,0.3), rgba(6,182,212,0.3), rgba(204,120,92,0.3))',
              backgroundSize: '300% 100%',
              animation: 'borderGlow 8s linear infinite'
            }} />

            {/* Inner container */}
            <div className="relative flex items-center gap-3">
              {[
                { id: 'folder', label: 'Projects', onClick: onSelectFolder, gradient: ['#3b82f6', '#1d4ed8'], icon: 'folder' },
                { id: 'tools', label: 'Tools', onClick: onOpenSkills, gradient: ['#f97316', '#dc2626'], icon: 'sparkle', badge: stats.skills + stats.agents || undefined },
                { id: 'hive', label: 'Hive', onClick: onOpenHive || onOpenSuperAgent || (() => {}), gradient: ['#fbbf24', '#f59e0b'], icon: 'bee' },
                { id: 'history', label: 'History', onClick: onOpenHistory, gradient: ['#a855f7', '#7c3aed'], icon: 'clock', badge: stats.conversations || undefined },
                { id: 'analytics', label: 'Stats', onClick: onOpenAnalytics || (() => {}), gradient: ['#06b6d4', '#0891b2'], icon: 'chart' },
                { id: 'settings', label: 'Config', onClick: onOpenSettings || (() => {}), gradient: ['#6b7280', '#4b5563'], icon: 'gear' },
              ].map((item, index) => {
                const isHovered = dockHoverIndex === index
                // Unique wave animation - items rise and glow
                let lift = 0
                let glow = 0
                if (dockHoverIndex !== null) {
                  const distance = Math.abs(index - dockHoverIndex)
                  if (distance === 0) {
                    lift = -16
                    glow = 1
                  } else if (distance === 1) {
                    lift = -8
                    glow = 0.5
                  } else if (distance === 2) {
                    lift = -3
                    glow = 0.2
                  }
                }

                return (
                  <CommandBarItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    onClick={item.onClick}
                    gradient={item.gradient}
                    icon={item.icon}
                    badge={item.badge}
                    lift={lift}
                    glow={glow}
                    onHover={() => setDockHoverIndex(index)}
                    isHovered={isHovered}
                  />
                )
              })}
            </div>
          </div>
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
          <span className="text-[10px] text-gray-700">Claude Code Unleashed • Built with <Rocket className="w-2.5 h-2.5 inline text-purple-400" /></span>
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

        @keyframes shine {
          0% { transform: skewX(-20deg) translateX(-150%); }
          100% { transform: skewX(-20deg) translateX(250%); }
        }

        .animate-shine {
          animation: shine 0.8s ease-out forwards;
        }

        @keyframes borderGlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        /* Command bar hover transition smoothing */
        .command-bar button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .floating-card, .nebula, .animate-gradient-x, .animate-pulse-slow, .animate-shine { animation: none; }
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

// Custom Icon Components for Command Bar
const CommandIcons = {
  folder: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Folder back */}
      <path d="M3 8C3 6.34315 4.34315 5 6 5H10L13 8H22C23.6569 8 25 9.34315 25 11V20C25 21.6569 23.6569 23 22 23H6C4.34315 23 3 21.6569 3 20V8Z" fill={color} fillOpacity="0.3"/>
      {/* Folder front */}
      <path d="M3 11C3 9.89543 3.89543 9 5 9H23C24.1046 9 25 9.89543 25 11V21C25 22.1046 24.1046 23 23 23H5C3.89543 23 3 22.1046 3 21V11Z" fill={color}/>
      {/* Shine */}
      <path d="M5 11H23V13H5V11Z" fill="white" fillOpacity="0.3"/>
      {/* Dot accent */}
      <circle cx="14" cy="16" r="2" fill="white" fillOpacity="0.5"/>
    </svg>
  ),
  sparkle: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Main star */}
      <path d="M14 2L16.5 10.5L25 14L16.5 17.5L14 26L11.5 17.5L3 14L11.5 10.5L14 2Z" fill={color}/>
      {/* Inner glow */}
      <path d="M14 6L15.5 11.5L21 14L15.5 16.5L14 22L12.5 16.5L7 14L12.5 11.5L14 6Z" fill="white" fillOpacity="0.4"/>
      {/* Small sparkles */}
      <circle cx="21" cy="7" r="1.5" fill={color} fillOpacity="0.6"/>
      <circle cx="7" cy="21" r="1" fill={color} fillOpacity="0.4"/>
      <circle cx="23" cy="21" r="1" fill={color} fillOpacity="0.5"/>
    </svg>
  ),
  bee: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Wings */}
      <ellipse cx="8" cy="12" rx="4" ry="3" fill="white" fillOpacity="0.3" transform="rotate(-20 8 12)"/>
      <ellipse cx="20" cy="12" rx="4" ry="3" fill="white" fillOpacity="0.3" transform="rotate(20 20 12)"/>
      {/* Body */}
      <ellipse cx="14" cy="16" rx="6" ry="7" fill={color}/>
      {/* Stripes */}
      <path d="M8.5 14H19.5" stroke="#000" strokeWidth="2" strokeOpacity="0.3"/>
      <path d="M8.5 18H19.5" stroke="#000" strokeWidth="2" strokeOpacity="0.3"/>
      {/* Head */}
      <circle cx="14" cy="8" r="4" fill={color}/>
      {/* Eyes */}
      <circle cx="12" cy="7" r="1.5" fill="#000" fillOpacity="0.5"/>
      <circle cx="16" cy="7" r="1.5" fill="#000" fillOpacity="0.5"/>
      {/* Antennae */}
      <path d="M11 5L9 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 5L19 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Antenna tips */}
      <circle cx="9" cy="2" r="1" fill={color}/>
      <circle cx="19" cy="2" r="1" fill={color}/>
    </svg>
  ),
  clock: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Outer ring */}
      <circle cx="14" cy="14" r="11" fill={color} fillOpacity="0.2"/>
      <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="2"/>
      {/* Inner circle */}
      <circle cx="14" cy="14" r="7" fill={color} fillOpacity="0.3"/>
      {/* Clock hands */}
      <path d="M14 8V14L18 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Center dot */}
      <circle cx="14" cy="14" r="1.5" fill="white"/>
      {/* Hour markers */}
      <circle cx="14" cy="5" r="1" fill={color}/>
      <circle cx="23" cy="14" r="1" fill={color}/>
      <circle cx="14" cy="23" r="1" fill={color}/>
      <circle cx="5" cy="14" r="1" fill={color}/>
    </svg>
  ),
  chart: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Background */}
      <rect x="3" y="3" width="22" height="22" rx="4" fill={color} fillOpacity="0.15"/>
      {/* Bars */}
      <rect x="6" y="15" width="4" height="8" rx="1" fill={color} fillOpacity="0.5"/>
      <rect x="12" y="10" width="4" height="13" rx="1" fill={color}/>
      <rect x="18" y="6" width="4" height="17" rx="1" fill={color} fillOpacity="0.7"/>
      {/* Trend line */}
      <path d="M6 18L12 13L18 8L24 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
      {/* Dots on line */}
      <circle cx="12" cy="13" r="2" fill="white"/>
      <circle cx="18" cy="8" r="2" fill="white"/>
    </svg>
  ),
  gear: ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Gear teeth */}
      <path d="M14 2L16 5H12L14 2Z" fill={color}/>
      <path d="M14 26L12 23H16L14 26Z" fill={color}/>
      <path d="M2 14L5 12V16L2 14Z" fill={color}/>
      <path d="M26 14L23 16V12L26 14Z" fill={color}/>
      <path d="M5.5 5.5L8 7L6 9L5.5 5.5Z" fill={color}/>
      <path d="M22.5 22.5L20 21L22 19L22.5 22.5Z" fill={color}/>
      <path d="M22.5 5.5L19 8L21 6L22.5 5.5Z" fill={color}/>
      <path d="M5.5 22.5L8 20L6 22L5.5 22.5Z" fill={color}/>
      {/* Main gear body */}
      <circle cx="14" cy="14" r="8" fill={color}/>
      {/* Inner circle */}
      <circle cx="14" cy="14" r="5" fill={color} fillOpacity="0.5"/>
      {/* Center hole */}
      <circle cx="14" cy="14" r="2.5" fill="#1a1a1a"/>
      {/* Shine */}
      <path d="M10 10C11 9 13 8 16 10" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round"/>
    </svg>
  )
}

// Arena Command Bar Item - Completely Unique Design
function CommandBarItem({ id, label, onClick, gradient, icon, badge, lift, glow, onHover, isHovered }: {
  id: string
  label: string
  onClick: () => void
  gradient: string[]
  icon: string
  badge?: number
  lift: number
  glow: number
  onHover: () => void
  isHovered: boolean
}) {
  const IconComponent = CommandIcons[icon as keyof typeof CommandIcons]
  const gradientBg = `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})`

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={onHover}
        className="group relative flex flex-col items-center transition-all duration-200 ease-out"
        style={{ transform: `translateY(${lift}px)` }}
      >
        {/* Glow aura */}
        <div
          className="absolute -inset-3 rounded-2xl blur-xl transition-opacity duration-300"
          style={{
            background: gradient[0],
            opacity: glow * 0.4
          }}
        />

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <div
            className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center z-20 border border-white/20"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(239,68,68,0.5)'
            }}
          >
            {badge > 99 ? '99+' : badge}
          </div>
        )}

        {/* Main button container - Hexagonal inspired shape */}
        <div
          className="relative w-14 h-14 flex items-center justify-center transition-all duration-200"
          style={{
            background: gradientBg,
            borderRadius: isHovered ? '16px' : '12px',
            boxShadow: isHovered
              ? `0 0 30px ${gradient[0]}60, 0 8px 25px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`
              : '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {/* Frosted glass overlay */}
          <div className="absolute inset-0 rounded-[inherit] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
          </div>

          {/* Ring accent when hovered */}
          {isHovered && (
            <div
              className="absolute -inset-1 rounded-[18px] border-2 animate-pulse"
              style={{ borderColor: `${gradient[0]}60` }}
            />
          )}

          {/* Custom Icon */}
          <div className="relative z-10">
            {IconComponent && <IconComponent color="white" />}
          </div>
        </div>

        {/* Label - appears on hover */}
        <div
          className={`absolute -bottom-7 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
          style={{
            background: 'rgba(20,20,22,0.95)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {label}
        </div>
      </button>
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
