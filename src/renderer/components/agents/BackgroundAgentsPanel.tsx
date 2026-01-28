import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Settings,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import type { BackgroundAgentTask, BackgroundAgentQueueStatus } from '../../../shared/types'
import { useAppStore } from '../../store'

interface BackgroundAgentsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function BackgroundAgentsPanel({ isOpen, onClose }: BackgroundAgentsPanelProps) {
  const [tasks, setTasks] = useState<BackgroundAgentTask[]>([])
  const [queueStatus, setQueueStatus] = useState<BackgroundAgentQueueStatus | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskPrompt, setNewTaskPrompt] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [taskOutputs, setTaskOutputs] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const outputRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { cwd } = useAppStore()

  // Load tasks and status
  const loadData = useCallback(async () => {
    try {
      const [taskList, status] = await Promise.all([
        window.api.backgroundAgentList(),
        window.api.backgroundAgentQueueStatus()
      ])
      setTasks(taskList)
      setQueueStatus(status)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  // Subscribe to updates
  useEffect(() => {
    const unsubUpdate = window.api.onBackgroundAgentUpdate?.((task) => {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === task.id)
        if (idx === -1) {
          return [...prev, task]
        }
        const updated = [...prev]
        updated[idx] = task
        return updated
      })
      loadData() // Refresh status
    })

    const unsubOutput = window.api.onBackgroundAgentOutput?.((data) => {
      setTaskOutputs(prev => ({
        ...prev,
        [data.taskId]: [...(prev[data.taskId] || []), data.data]
      }))
      // Auto-scroll output
      const ref = outputRefs.current[data.taskId]
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })

    return () => {
      unsubUpdate?.()
      unsubOutput?.()
    }
  }, [loadData])

  const handleAddTask = async () => {
    if (!newTaskName.trim() || !newTaskPrompt.trim()) return

    await window.api.backgroundAgentAdd({
      name: newTaskName.trim(),
      prompt: newTaskPrompt.trim(),
      projectPath: cwd,
      priority: newTaskPriority
    })

    setNewTaskName('')
    setNewTaskPrompt('')
    setNewTaskPriority('normal')
    setShowAddForm(false)
    loadData()
  }

  const handleStartQueue = async () => {
    await window.api.backgroundAgentStartQueue()
    loadData()
  }

  const handlePauseQueue = async () => {
    await window.api.backgroundAgentPauseQueue()
    loadData()
  }

  const handleCancelTask = async (taskId: string) => {
    await window.api.backgroundAgentCancel(taskId)
    loadData()
  }

  const handleRemoveTask = async (taskId: string) => {
    await window.api.backgroundAgentRemove(taskId)
    loadData()
  }

  const handleRetryTask = async (taskId: string) => {
    await window.api.backgroundAgentRetry(taskId)
    loadData()
  }

  const handleClearCompleted = async () => {
    await window.api.backgroundAgentClearCompleted()
    loadData()
  }

  const handleSetMaxConcurrent = async (max: number) => {
    await window.api.backgroundAgentSetMaxConcurrent(max)
    loadData()
  }

  const handleSetPriority = async (taskId: string, priority: 'low' | 'normal' | 'high') => {
    await window.api.backgroundAgentSetPriority(taskId, priority)
    loadData()
  }

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const getStatusIcon = (status: BackgroundAgentTask['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-400" />
      default:
        return null
    }
  }

  const getPriorityColor = (priority: 'low' | 'normal' | 'high') => {
    switch (priority) {
      case 'high':
        return 'text-red-400'
      case 'normal':
        return 'text-blue-400'
      case 'low':
        return 'text-gray-400'
    }
  }

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return '-'
    const endTime = end || Date.now()
    const duration = Math.floor((endTime - start) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}m ${seconds}s`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] w-[900px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-white">Background Agents</h2>
            {queueStatus && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{queueStatus.runningTasks} running</span>
                <span>/</span>
                <span>{queueStatus.queuedTasks} queued</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-400">Max Concurrent Tasks:</label>
              <select
                value={queueStatus?.maxConcurrent || 2}
                onChange={(e) => handleSetMaxConcurrent(parseInt(e.target.value))}
                className="bg-black/30 border border-white/[0.1] rounded px-3 py-1 text-sm text-white"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                onClick={handleClearCompleted}
                className="ml-auto text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear Completed
              </button>
            </div>
          </div>
        )}

        {/* Queue Controls */}
        <div className="flex items-center gap-2 p-4 border-b border-white/[0.06]">
          {queueStatus?.isRunning ? (
            <button
              onClick={handlePauseQueue}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause Queue
            </button>
          ) : (
            <button
              onClick={handleStartQueue}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Queue
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Add Task Form */}
        {showAddForm && (
          <div className="p-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="space-y-3">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Task name..."
                className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-4 py-2 text-white placeholder-gray-500"
              />
              <textarea
                value={newTaskPrompt}
                onChange={(e) => setNewTaskPrompt(e.target.value)}
                placeholder="What should Claude do?"
                rows={3}
                className="w-full bg-black/30 border border-white/[0.1] rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none"
              />
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-400">Priority:</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'normal' | 'high')}
                  className="bg-black/30 border border-white/[0.1] rounded px-3 py-1 text-sm text-white"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
                <div className="flex-1" />
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskName.trim() || !newTaskPrompt.trim()}
                  className="px-4 py-2 bg-[#E5484D] hover:bg-[#E5484D]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">No background tasks</p>
              <p className="text-sm">Add a task to have Claude work on it in the background</p>
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className="bg-white/[0.03] rounded-lg border border-white/[0.06] overflow-hidden"
              >
                {/* Task Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleExpanded(task.id)}
                >
                  <button className="text-gray-400">
                    {expandedTasks.has(task.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{task.name}</span>
                      <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{task.prompt}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(task.startedAt, task.completedAt)}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {task.status === 'queued' && (
                      <>
                        <button
                          onClick={() => handleSetPriority(task.id, 'high')}
                          className="p-1 rounded hover:bg-white/[0.1] text-gray-400 hover:text-white"
                          title="Increase Priority"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSetPriority(task.id, 'low')}
                          className="p-1 rounded hover:bg-white/[0.1] text-gray-400 hover:text-white"
                          title="Decrease Priority"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {task.status === 'running' && (
                      <button
                        onClick={() => handleCancelTask(task.id)}
                        className="p-1 rounded hover:bg-white/[0.1] text-red-400"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {(task.status === 'failed' || task.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetryTask(task.id)}
                        className="p-1 rounded hover:bg-white/[0.1] text-yellow-400"
                        title="Retry"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
                      <button
                        onClick={() => handleRemoveTask(task.id)}
                        className="p-1 rounded hover:bg-white/[0.1] text-gray-400 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Task Output */}
                {expandedTasks.has(task.id) && (
                  <div className="border-t border-white/[0.06]">
                    <div
                      ref={(el) => { outputRefs.current[task.id] = el }}
                      className="bg-black/30 p-3 max-h-[200px] overflow-y-auto font-mono text-xs text-gray-300"
                    >
                      {(taskOutputs[task.id] || task.output).length === 0 ? (
                        <span className="text-gray-500">No output yet...</span>
                      ) : (
                        (taskOutputs[task.id] || task.output).map((line, i) => (
                          <span key={i} dangerouslySetInnerHTML={{ __html: line }} />
                        ))
                      )}
                    </div>
                    {task.error && (
                      <div className="p-3 bg-red-500/10 text-red-400 text-sm">
                        Error: {task.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
