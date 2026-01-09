import React, { useState, useEffect } from 'react'
import { X, Zap, Shield, ShieldAlert, ShieldOff, Loader2, Rocket, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { useSuperAgent } from '../../hooks/useSuperAgent'
import type { SafetyLevel, LLMProvider } from '../../../shared/types'

interface SuperAgentModalProps {
  isOpen: boolean
  onClose: () => void
  terminalId: string
  onStart: () => void
}

const QUICK_TASKS = [
  { label: 'Build a website', prompt: 'Build a modern, responsive website with' },
  { label: 'Fix a bug', prompt: 'Find and fix the bug in' },
  { label: 'Write tests', prompt: 'Write comprehensive tests for' },
  { label: 'Create component', prompt: 'Create a new React component for' },
]

export function SuperAgentModal({ isOpen, onClose, terminalId, onStart }: SuperAgentModalProps) {
  const { startSuperAgent, config, provider, setProvider, timeLimit, setTimeLimit, safetyLevel, setSafetyLevel, loadConfig } =
    useSuperAgent()

  const [task, setTask] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTask('')
      setError(null)
      setIsStarting(false)
      setShowAdvanced(false)
      setIsLoadingConfig(true)
      loadConfig().finally(() => setIsLoadingConfig(false))
    }
  }, [isOpen, loadConfig])

  const handleStart = async () => {
    if (!task.trim()) {
      setError('Tell Claude what to build')
      return
    }

    if (!config) {
      setError('Loading... try again')
      return
    }

    const apiKey = provider === 'openai' ? config.openaiApiKey : config.groqApiKey
    if (!apiKey) {
      setError(`Add ${provider === 'openai' ? 'OpenAI' : 'Groq'} API key in Settings`)
      return
    }

    if (!terminalId) {
      setError('Start a terminal session first')
      return
    }

    setIsStarting(true)
    setError(null)

    const success = await startSuperAgent(task, terminalId, { timeLimit, safetyLevel })

    if (success) {
      onStart()
      onClose()
    } else {
      setError('Failed to start. Check API key in Settings.')
      setIsStarting(false)
    }
  }

  const handleQuickTask = (prompt: string) => {
    setTask(prompt + ' ')
    setTimeout(() => {
      const textarea = document.getElementById('task-input') as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(prompt.length + 1, prompt.length + 1)
      }
    }, 50)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#1a1a1c] rounded-2xl w-full max-w-md overflow-hidden border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#cc785c]/20 to-transparent" />
          <div className="relative flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-[#cc785c] to-[#a55d45] rounded-xl shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Super Agent</h2>
                <p className="text-xs text-gray-400">Autonomous mode</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Requirement */}
          <p className="text-xs text-gray-500 text-center">
            Make sure Claude shows the <span className="text-white font-mono">❯</span> prompt before launching
          </p>

          {/* Task Input */}
          <div>
            <textarea
              id="task-input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What should Claude build? Be specific..."
              className="w-full h-24 bg-[#0d0d0d] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#cc785c]/50 focus:ring-1 focus:ring-[#cc785c]/30 resize-none text-sm leading-relaxed"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  handleStart()
                }
              }}
            />
          </div>

          {/* Quick Tasks */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TASKS.map((qt) => (
              <button
                key={qt.label}
                onClick={() => handleQuickTask(qt.prompt)}
                className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-[11px] text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {qt.label}
              </button>
            ))}
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors py-1"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAdvanced ? 'Hide options' : 'Show options'}
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Provider */}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Provider</label>
                <div className="flex gap-0.5 p-0.5 bg-[#0d0d0d] rounded-lg">
                  {(['groq', 'openai'] as LLMProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${
                        provider === p
                          ? 'bg-[#cc785c] text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {p === 'groq' ? 'Groq' : 'OpenAI'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Duration</label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full py-1.5 px-2 bg-[#0d0d0d] border border-white/[0.08] rounded-lg text-[10px] text-white focus:outline-none appearance-none cursor-pointer"
                >
                  <option value={5}>5 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={0}>No limit</option>
                </select>
              </div>

              {/* Safety */}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Safety</label>
                <div className="flex gap-0.5 p-0.5 bg-[#0d0d0d] rounded-lg">
                  {([
                    { level: 'safe' as SafetyLevel, icon: Shield, color: 'text-emerald-400' },
                    { level: 'moderate' as SafetyLevel, icon: ShieldAlert, color: 'text-amber-400' },
                    { level: 'yolo' as SafetyLevel, icon: ShieldOff, color: 'text-red-400' }
                  ]).map(({ level, icon: Icon, color }) => (
                    <button
                      key={level}
                      onClick={() => setSafetyLevel(level)}
                      className={`flex-1 py-1.5 rounded transition-all flex items-center justify-center ${
                        safetyLevel === level
                          ? `bg-white/[0.1] ${color}`
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Launch Button */}
          <button
            onClick={handleStart}
            disabled={isStarting || isLoadingConfig || !task.trim()}
            className="w-full py-3 bg-gradient-to-r from-[#cc785c] to-[#a55d45] hover:from-[#b86a50] hover:to-[#944d39] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {isLoadingConfig ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </>
            ) : isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Launch Super Agent
              </>
            )}
          </button>

          <p className="text-[10px] text-gray-600 text-center">
            <kbd className="px-1 py-0.5 bg-white/[0.04] rounded">⌘</kbd> + <kbd className="px-1 py-0.5 bg-white/[0.04] rounded">Enter</kbd> to launch
          </p>
        </div>
      </div>
    </div>
  )
}
