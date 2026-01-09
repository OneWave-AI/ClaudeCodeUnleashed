import { create } from 'zustand'
import type { LLMProvider, SafetyLevel, ActivityLogEntry, SuperAgentConfig } from '../../shared/types'

interface SuperAgentState {
  // Running state
  isRunning: boolean
  task: string
  startTime: number | null
  timeLimit: number // minutes (0 = unlimited)
  safetyLevel: SafetyLevel
  projectFolder: string

  // Output tracking
  outputBuffer: string
  lastOutputTime: number
  isIdle: boolean

  // Activity log
  activityLog: ActivityLogEntry[]

  // Config
  config: SuperAgentConfig
  provider: LLMProvider

  // Terminal reference
  activeTerminalId: string | null

  // Actions
  setRunning: (running: boolean) => void
  setTask: (task: string) => void
  setTimeLimit: (minutes: number) => void
  setSafetyLevel: (level: SafetyLevel) => void
  setProvider: (provider: LLMProvider) => void
  setConfig: (config: SuperAgentConfig) => void
  setActiveTerminalId: (id: string | null) => void
  setProjectFolder: (folder: string) => void

  // Output handling
  appendOutput: (data: string) => void
  clearOutput: () => void
  setIdle: (idle: boolean) => void

  // Logging
  addLog: (type: ActivityLogEntry['type'], message: string) => void
  clearLogs: () => void

  // Session management
  startSession: (task: string, terminalId: string, projectFolder: string) => void
  stopSession: (status?: 'completed' | 'stopped' | 'error') => void
  reset: () => void
}

const DEFAULT_CONFIG: SuperAgentConfig = {
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  defaultProvider: 'groq',
  idleTimeout: 5,
  maxDuration: 30,
  defaultSafetyLevel: 'safe'
}

export const useSuperAgentStore = create<SuperAgentState>((set, get) => ({
  // Initial state - use DEFAULT_CONFIG immediately to prevent loading state
  isRunning: false,
  task: '',
  startTime: null,
  timeLimit: 30,
  safetyLevel: 'safe',
  projectFolder: '',
  outputBuffer: '',
  lastOutputTime: 0,
  isIdle: false,
  activityLog: [],
  config: DEFAULT_CONFIG,
  provider: 'groq',
  activeTerminalId: null,

  // Actions
  setRunning: (running) => set({ isRunning: running }),
  setTask: (task) => set({ task }),
  setTimeLimit: (minutes) => set({ timeLimit: minutes }),
  setSafetyLevel: (level) => set({ safetyLevel: level }),
  setProvider: (provider) => set({ provider }),
  setConfig: (config) => set({ config, provider: config.defaultProvider }),
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),
  setProjectFolder: (folder) => set({ projectFolder: folder }),

  // Output handling
  appendOutput: (data) =>
    set((state) => ({
      outputBuffer: state.outputBuffer + data,
      lastOutputTime: Date.now(),
      isIdle: false
    })),

  clearOutput: () => set({ outputBuffer: '', isIdle: false }),

  setIdle: (idle) => set({ isIdle: idle }),

  // Logging
  addLog: (type, message) =>
    set((state) => ({
      activityLog: [
        ...state.activityLog,
        { timestamp: Date.now(), type, message }
      ]
    })),

  clearLogs: () => set({ activityLog: [] }),

  // Session management
  startSession: (task, terminalId, projectFolder) =>
    set({
      isRunning: true,
      task,
      startTime: Date.now(),
      activeTerminalId: terminalId,
      projectFolder,
      outputBuffer: '',
      lastOutputTime: Date.now(),
      isIdle: false,
      activityLog: [
        { timestamp: Date.now(), type: 'start', message: `Task started: ${task}` }
      ]
    }),

  stopSession: (status = 'stopped') => {
    const state = get()
    const endTime = Date.now()
    const duration = state.startTime ? Math.floor((endTime - state.startTime) / 1000) : 0

    // Add stop log entry
    const finalLog = [
      ...state.activityLog,
      { timestamp: endTime, type: 'stop' as const, message: `Super Agent ${status}` }
    ]

    // Save session to history
    if (state.startTime && state.task) {
      const session = {
        id: `sa_${state.startTime}_${Math.random().toString(36).substr(2, 9)}`,
        task: state.task,
        startTime: state.startTime,
        endTime,
        duration,
        status,
        activityLog: finalLog,
        provider: state.provider,
        projectFolder: state.projectFolder
      }
      // Save async - don't block
      window.api.saveSuperAgentSession(session).catch(err =>
        console.error('Failed to save Super Agent session:', err)
      )
    }

    set({
      isRunning: false,
      startTime: null,
      activeTerminalId: null,
      isIdle: false,
      activityLog: finalLog
    })
  },

  reset: () =>
    set({
      isRunning: false,
      task: '',
      startTime: null,
      timeLimit: 30,
      safetyLevel: 'safe',
      projectFolder: '',
      outputBuffer: '',
      lastOutputTime: 0,
      isIdle: false,
      activityLog: [],
      activeTerminalId: null
    })
}))
