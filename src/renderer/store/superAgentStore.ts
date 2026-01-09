import { create } from 'zustand'
import type { LLMProvider, SafetyLevel, ActivityLogEntry, SuperAgentConfig } from '../../shared/types'

interface SuperAgentState {
  // Running state
  isRunning: boolean
  task: string
  startTime: number | null
  timeLimit: number // minutes (0 = unlimited)
  safetyLevel: SafetyLevel

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

  // Output handling
  appendOutput: (data: string) => void
  clearOutput: () => void
  setIdle: (idle: boolean) => void

  // Logging
  addLog: (type: ActivityLogEntry['type'], message: string) => void
  clearLogs: () => void

  // Session management
  startSession: (task: string, terminalId: string) => void
  stopSession: () => void
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
  startSession: (task, terminalId) =>
    set({
      isRunning: true,
      task,
      startTime: Date.now(),
      activeTerminalId: terminalId,
      outputBuffer: '',
      lastOutputTime: Date.now(),
      isIdle: false,
      activityLog: [
        { timestamp: Date.now(), type: 'start', message: `Task started: ${task}` }
      ]
    }),

  stopSession: () => {
    const state = get()
    set({
      isRunning: false,
      startTime: null,
      activeTerminalId: null,
      isIdle: false,
      activityLog: [
        ...state.activityLog,
        { timestamp: Date.now(), type: 'stop', message: 'Super Agent stopped' }
      ]
    })
  },

  reset: () =>
    set({
      isRunning: false,
      task: '',
      startTime: null,
      timeLimit: 30,
      safetyLevel: 'safe',
      outputBuffer: '',
      lastOutputTime: 0,
      isIdle: false,
      activityLog: [],
      activeTerminalId: null
    })
}))
