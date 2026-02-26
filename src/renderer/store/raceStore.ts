import { create } from 'zustand'
import type { RaceStatus, RaceTerminalMetrics, ActivityLogEntry, CLIProvider } from '../../shared/types'

// Weighted scoring: tests matter most, files next, errors penalise
function calculateScore(m: RaceTerminalMetrics): number {
  return (m.testsPassed * 30) + (m.filesCreated * 10) - (m.errorsHit * 5) + Math.floor(m.linesOfCode * 0.1)
}

function defaultMetrics(terminalId: string, provider: CLIProvider): RaceTerminalMetrics {
  return {
    terminalId,
    provider,
    status: 'waiting',
    score: 0,
    linesOfCode: 0,
    testsPassed: 0,
    errorsHit: 0,
    filesCreated: 0,
    startTime: null,
    completionTime: null,
    activityLog: [],
    outputBuffer: ''
  }
}

// Patterns for live metric extraction from raw terminal output
const ANSI_STRIP = /(\x9B|\x1B\[)[0-9:;<>=?]*[ -/]*[@-~]|\x1B[PX^_].*?\x1B\\|\x1B][^\x07]*\x07|\x1B[^[\]PX^_]|\r/g

const PATTERNS = {
  testPass: /(\d+)\s*(?:tests?\s+)?passed|(\d+)\s*✓|passing\s+\(|(\d+)\s*passing/i,
  testFail: /(\d+)\s*(?:tests?\s+)?failed|(\d+)\s*✗|failing/i,
  error: /\berror[:\s]|exception:|traceback|✗\s|FAIL\b/i,
  fileCreated: /(?:created?|wrote?|written|saved?)\s+.*\.(ts|tsx|js|jsx|py|go|rs|java|css|html|json|md)/i,
  codeBlock: /^\s{0,4}(?:const|let|var|function|class|def |fn |pub |import |export |type |interface )/m
}

interface RaceState {
  status: RaceStatus
  task: string
  startTime: number | null
  endTime: number | null
  terminals: Map<string, RaceTerminalMetrics>
  winnerId: string | null

  // Actions
  configureRace: (task: string) => void
  startRace: () => void
  addTerminal: (terminalId: string, provider: CLIProvider) => void
  updateMetrics: (terminalId: string, updates: Partial<RaceTerminalMetrics>) => void
  appendOutput: (terminalId: string, data: string) => void
  addLog: (terminalId: string, type: ActivityLogEntry['type'], message: string) => void
  markTerminalDone: (terminalId: string) => void
  finishRace: () => void
  resetRace: () => void
}

export const useRaceStore = create<RaceState>((set, get) => ({
  status: 'idle',
  task: '',
  startTime: null,
  endTime: null,
  terminals: new Map(),
  winnerId: null,

  configureRace: (task) => set({ status: 'configuring', task }),

  startRace: () =>
    set((s) => ({
      status: 'racing',
      startTime: Date.now(),
      endTime: null,
      winnerId: null,
      // Reset all terminal metrics to fresh start
      terminals: new Map(
        Array.from(s.terminals.entries()).map(([id, m]) => [
          id,
          { ...m, status: 'waiting', score: 0, linesOfCode: 0, testsPassed: 0, errorsHit: 0, filesCreated: 0, startTime: null, completionTime: null, activityLog: [], outputBuffer: '' }
        ])
      )
    })),

  addTerminal: (terminalId, provider) => {
    const terminals = new Map(get().terminals)
    terminals.set(terminalId, defaultMetrics(terminalId, provider))
    set({ terminals })
  },

  updateMetrics: (terminalId, updates) => {
    const terminals = new Map(get().terminals)
    const existing = terminals.get(terminalId)
    if (!existing) return
    const updated = { ...existing, ...updates }
    updated.score = calculateScore(updated)
    terminals.set(terminalId, updated)
    set({ terminals })
  },

  appendOutput: (terminalId, data) => {
    const state = get()
    const terminals = new Map(state.terminals)
    const existing = terminals.get(terminalId)
    if (!existing) return

    const MAX_BUF = 60_000
    const newBuf = existing.outputBuffer + data
    const clean = data.replace(ANSI_STRIP, '')

    // Incremental metric extraction from this chunk
    let { testsPassed, errorsHit, filesCreated, linesOfCode, status } = existing

    // Parse test passes
    const passMatch = clean.match(PATTERNS.testPass)
    if (passMatch) {
      const count = parseInt(passMatch[1] ?? passMatch[2] ?? passMatch[3] ?? '1', 10)
      testsPassed = Math.max(testsPassed, isNaN(count) ? testsPassed + 1 : count)
    }

    // Parse errors (don't double-count per chunk)
    if (PATTERNS.error.test(clean)) errorsHit++

    // Detect file creation events
    if (PATTERNS.fileCreated.test(clean)) filesCreated++

    // Rough LOC estimate: count lines that look like code
    const codeLines = clean.split('\n').filter((l) => PATTERNS.codeBlock.test(l))
    linesOfCode += codeLines.length

    // Transition to running once we get real output
    if (status === 'waiting' && clean.trim().length > 0) {
      status = 'running'
    }

    const updated: RaceTerminalMetrics = {
      ...existing,
      outputBuffer: newBuf.length > MAX_BUF ? newBuf.slice(-MAX_BUF) : newBuf,
      testsPassed,
      errorsHit,
      filesCreated,
      linesOfCode,
      status
    }
    updated.score = calculateScore(updated)
    terminals.set(terminalId, updated)
    set({ terminals })
  },

  addLog: (terminalId, type, message) => {
    const terminals = new Map(get().terminals)
    const existing = terminals.get(terminalId)
    if (!existing) return
    terminals.set(terminalId, {
      ...existing,
      activityLog: [
        ...existing.activityLog.slice(-199),
        { timestamp: Date.now(), type, message }
      ]
    })
    set({ terminals })
  },

  markTerminalDone: (terminalId) => {
    const state = get()
    // Only set winner if none yet
    const terminals = new Map(state.terminals)
    const existing = terminals.get(terminalId)
    if (!existing) return

    const updated = {
      ...existing,
      status: 'done' as const,
      completionTime: Date.now()
    }
    updated.score = calculateScore(updated)
    terminals.set(terminalId, updated)

    const newWinner = state.winnerId ?? terminalId
    set({ terminals, winnerId: newWinner, status: 'finished', endTime: Date.now() })
  },

  finishRace: () => {
    const state = get()
    if (state.status === 'finished') return

    // Pick winner by highest score
    let bestScore = -Infinity
    let winnerId: string | null = null
    for (const [id, metrics] of state.terminals) {
      if (metrics.score > bestScore) {
        bestScore = metrics.score
        winnerId = id
      }
    }
    set({ status: 'finished', endTime: Date.now(), winnerId })
  },

  resetRace: () =>
    set({
      status: 'idle',
      task: '',
      startTime: null,
      endTime: null,
      terminals: new Map(),
      winnerId: null
    })
}))
