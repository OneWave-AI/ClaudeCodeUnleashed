import { useState, useEffect } from 'react'
import { Trophy, Flag, Zap, X, Play, Square, RotateCcw, Clock, CheckCircle, AlertCircle, Code2, TestTube, FileCode, ShieldAlert, Lightbulb } from 'lucide-react'
import { useRace } from '../../hooks/useRace'
import { useAppStore } from '../../store'
import type { CLIProvider, RaceTerminalMetrics } from '../../../shared/types'

interface Props {
  onClose: () => void
}

const PROVIDER_COLORS: Record<CLIProvider, string> = {
  claude: 'emerald',
  codex: 'blue'
}

const PROVIDER_LABELS: Record<CLIProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex (GPT)'
}

function MetricBadge({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <Icon size={11} className={`text-${color}-400`} />
      <span className="text-white font-mono font-bold">{value}</span>
      <span className="text-[#666]">{label}</span>
    </div>
  )
}

function TerminalCard({
  metrics,
  isWinner,
  elapsed
}: {
  metrics: RaceTerminalMetrics
  isWinner: boolean
  elapsed: number
}) {
  const color = PROVIDER_COLORS[metrics.provider]
  const label = PROVIDER_LABELS[metrics.provider]

  const statusIcon = {
    waiting: <Clock size={12} className="text-yellow-400 animate-pulse" />,
    running: <Zap size={12} className={`text-${color}-400 animate-pulse`} />,
    done: <CheckCircle size={12} className="text-emerald-400" />,
    error: <AlertCircle size={12} className="text-red-400" />
  }[metrics.status]

  const completionSecs = metrics.completionTime && metrics.startTime
    ? ((metrics.completionTime - metrics.startTime) / 1000).toFixed(1)
    : null

  return (
    <div className={`relative flex-1 min-w-0 rounded-xl border bg-[#111] transition-all duration-300
      ${isWinner ? `border-${color}-500 shadow-lg shadow-${color}-900/30` : 'border-[#2a2a2a]'}`}>

      {/* Winner badge */}
      {isWinner && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-0.5 rounded-full bg-${color}-600 text-white text-xs font-bold`}>
          <Trophy size={10} />
          WINNER
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isWinner ? `border-${color}-800` : 'border-[#222]'}`}>
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className={`text-sm font-semibold text-${color}-400`}>{label}</span>
        </div>
        <div className={`text-2xl font-black font-mono ${isWinner ? `text-${color}-300` : 'text-white'}`}>
          {metrics.score}
          <span className="text-xs font-normal text-[#555] ml-1">pts</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-y-2">
        <MetricBadge icon={TestTube} value={metrics.testsPassed} label="tests" color="emerald" />
        <MetricBadge icon={FileCode} value={metrics.filesCreated} label="files" color="blue" />
        <MetricBadge icon={Code2} value={metrics.linesOfCode} label="lines" color="purple" />
        <MetricBadge icon={AlertCircle} value={metrics.errorsHit} label="errors" color="red" />
      </div>

      {/* Completion time */}
      {completionSecs && (
        <div className="px-4 pb-3 text-xs text-[#666]">
          Completed in <span className="text-white font-mono">{completionSecs}s</span>
        </div>
      )}

      {/* Live activity log */}
      <div className="border-t border-[#1a1a1a] mx-0">
        <div className="h-28 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed scrollbar-thin scrollbar-thumb-[#333]">
          {metrics.activityLog.length === 0 ? (
            <span className="text-[#444]">Waiting for activity...</span>
          ) : (
            [...metrics.activityLog].reverse().slice(0, 20).map((entry, i) => (
              <div key={i} className="text-[#888] truncate">
                <span className={`text-${color}-600 mr-1`}>[{entry.type}]</span>
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function RaceModal({ onClose }: Props) {
  const cliProvider = useAppStore((s) => s.cliProvider)
  const cwd = useAppStore((s) => s.cwd)

  const { status, task, startTime, endTime, terminals, winnerId, startRace, stopRace, resetRace } = useRace()

  const [taskInput, setTaskInput] = useState('')
  const [selectedProviders, setSelectedProviders] = useState<CLIProvider[]>(['claude', 'codex'])
  const [elapsed, setElapsed] = useState(0)
  const [authErrors, setAuthErrors] = useState<Partial<Record<CLIProvider, string>>>({})
  const [authChecking, setAuthChecking] = useState(false)
  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  // Elapsed timer
  useEffect(() => {
    if (status !== 'racing' || !startTime) {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, startTime])

  const runAuthCheck = async () => {
    setAuthChecking(true)
    const results = await Promise.all(
      selectedProviders.map(async (p) => {
        const result = await window.api.raceCheckAuth(p)
        return [p, result] as const
      })
    )
    const errors: Partial<Record<CLIProvider, string>> = {}
    for (const [p, result] of results) {
      if (!result.ready && result.error) errors[p] = result.error
    }
    setAuthErrors(errors)
    setAuthChecking(false)
  }

  // Run auth pre-flight when providers change
  useEffect(() => {
    if (status !== 'idle' && status !== 'configuring') return
    runAuthCheck()
  }, [selectedProviders, status])

  const handleSaveOpenaiKey = async () => {
    if (!openaiKeyInput.trim()) return
    setSavingKey(true)
    const settings = await window.api.loadSettings()
    await window.api.saveSettings({ ...settings, openaiApiKey: openaiKeyInput.trim() })
    setSavingKey(false)
    // Re-run auth check now that key is saved
    await runAuthCheck()
  }

  const handleStart = async () => {
    if (!taskInput.trim() || selectedProviders.length < 2) return
    if (Object.keys(authErrors).length > 0) return // block if auth issues
    await startRace(taskInput.trim(), selectedProviders, cwd)
  }

  const handleStop = async () => {
    await stopRace()
  }

  const handleReset = async () => {
    await resetRace()
    setTaskInput('')
  }

  const toggleProvider = (p: CLIProvider) => {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const terminalList = Array.from(terminals.values())

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Agent Race</h2>
              <p className="text-[#666] text-xs">Claude vs Codex — same task, may the best agent win</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status === 'racing' && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#333]">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-mono text-sm font-bold">{formatTime(elapsed)}</span>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-[#1e1e1e] rounded-lg transition-colors">
              <X size={16} className="text-[#666]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Configuration (shown when idle/configuring) */}
          {(status === 'idle' || status === 'configuring') && (
            <div className="space-y-5">
              {/* Task input */}
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2 block">
                  Task for both agents
                </label>
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="e.g. Build a REST API with authentication and CRUD endpoints for a todo app"
                  className="w-full h-24 bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              {/* Provider selection */}
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3 block">
                  Competitors (select 2)
                </label>
                <div className="flex gap-3">
                  {(['claude', 'codex'] as CLIProvider[]).map((p) => {
                    const active = selectedProviders.includes(p)
                    const color = PROVIDER_COLORS[p]
                    return (
                      <button
                        key={p}
                        onClick={() => toggleProvider(p)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all
                          ${active
                            ? `bg-${color}-950 border-${color}-600 text-${color}-300`
                            : 'bg-[#111] border-[#2a2a2a] text-[#555] hover:border-[#444]'
                          }`}
                      >
                        <Flag size={14} />
                        {PROVIDER_LABELS[p]}
                      </button>
                    )
                  })}
                </div>
                {selectedProviders.length < 2 && (
                  <p className="text-xs text-yellow-600 mt-2">Select at least 2 competitors to race</p>
                )}
              </div>

              {/* Auth errors */}
              {Object.entries(authErrors).map(([provider, error]) => (
                <div key={provider} className="rounded-xl border border-red-900 bg-red-950/20 overflow-hidden">
                  <div className="flex gap-2 px-3 py-2.5 text-xs text-red-300">
                    <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-red-200">{PROVIDER_LABELS[provider as CLIProvider]}: </span>
                      {error}
                    </div>
                  </div>

                  {/* Inline OpenAI key input */}
                  {provider === 'codex' && (
                    <div className="px-3 pb-3 space-y-2 border-t border-red-900/50 pt-2">
                      <p className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">Enter OpenAI API Key</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={keyVisible ? 'text' : 'password'}
                            value={openaiKeyInput}
                            onChange={(e) => setOpenaiKeyInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveOpenaiKey()}
                            placeholder="sk-..."
                            className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#444] focus:outline-none focus:border-blue-600 font-mono pr-8"
                          />
                          <button
                            onClick={() => setKeyVisible(!keyVisible)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] text-[10px]"
                          >
                            {keyVisible ? 'hide' : 'show'}
                          </button>
                        </div>
                        <button
                          onClick={handleSaveOpenaiKey}
                          disabled={!openaiKeyInput.trim() || savingKey}
                          className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 transition-all whitespace-nowrap"
                        >
                          {savingKey ? 'Saving...' : 'Save & Retry'}
                        </button>
                      </div>
                      <p className="text-[10px] text-[#555]">
                        Stored in app settings — never shared, never sent to any server.
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Task hint */}
              <div className="flex gap-2 p-3 rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] text-xs text-[#666]">
                <Lightbulb size={13} className="text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[#888] font-semibold">Use code-generating tasks to see scores. </span>
                  Simple tasks like "create a folder" score 0. Try: <span className="text-emerald-400">Write a Python script to parse CSV files</span> or <span className="text-emerald-400">Build a TypeScript utility class with unit tests</span>
                </div>
              </div>

              {/* Scoring explanation */}
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0a0a0a] p-4 text-xs text-[#666] space-y-1">
                <div className="text-[#888] font-semibold mb-2">Scoring formula</div>
                <div className="flex gap-6">
                  <span><span className="text-emerald-400">+30</span> per test passed</span>
                  <span><span className="text-blue-400">+10</span> per file created</span>
                  <span><span className="text-purple-400">+0.1</span> per line of code</span>
                  <span><span className="text-red-400">-5</span> per error</span>
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={!taskInput.trim() || selectedProviders.length < 2 || Object.keys(authErrors).length > 0 || authChecking}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:from-yellow-500 hover:to-orange-500 transition-all"
              >
                <Play size={15} />
                {authChecking ? 'Checking auth...' : 'Start Race'}
              </button>
            </div>
          )}

          {/* Live leaderboard */}
          {(status === 'racing' || status === 'finished') && terminalList.length > 0 && (
            <div className="space-y-4">
              {/* Task reminder */}
              <div className="text-xs text-[#666] bg-[#111] rounded-lg px-3 py-2 border border-[#1e1e1e]">
                <span className="text-[#888] font-semibold">Task: </span>
                <span className="text-white">{task}</span>
              </div>

              {/* Cards */}
              <div className="flex gap-4">
                {terminalList.map((m) => (
                  <TerminalCard
                    key={m.terminalId}
                    metrics={m}
                    isWinner={winnerId === m.terminalId}
                    elapsed={elapsed}
                  />
                ))}
              </div>

              {/* Winner announcement */}
              {status === 'finished' && winnerId && (
                <div className="rounded-xl border border-yellow-800 bg-yellow-950/30 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-300 font-bold">
                    <Trophy size={18} />
                    {PROVIDER_LABELS[terminals.get(winnerId)!.provider]} wins!
                  </div>
                  {endTime && startTime && (
                    <div className="text-xs text-[#666] mt-1">
                      Race duration: {formatTime(Math.floor((endTime - startTime) / 1000))}
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-3">
                {status === 'racing' && (
                  <button
                    onClick={handleStop}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#aaa] text-sm font-semibold hover:bg-[#222] transition-all"
                  >
                    <Square size={13} />
                    Stop & Score
                  </button>
                )}
                {status === 'finished' && (
                  <button
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-[#aaa] text-sm font-semibold hover:bg-[#222] transition-all"
                  >
                    <RotateCcw size={13} />
                    New Race
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
