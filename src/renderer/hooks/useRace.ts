import { useCallback, useRef, useEffect } from 'react'
import { useRaceStore } from '../store/raceStore'
import { CLI_PROVIDERS } from '../../shared/providers'
import type { CLIProvider } from '../../shared/types'

const ANSI_STRIP = /(\x9B|\x1B\[)[0-9:;<>=?]*[ -/]*[@-~]|\x1B[PX^_].*?\x1B\\|\x1B][^\x07]*\x07|\x1B[^[\]PX^_]|\r/g

// Patterns that indicate the agent completed its task
const DONE_PATTERNS = [
  /task (?:complete|completed|done|finished)/i,
  /implementation (?:complete|done|finished)/i,
  /all (?:done|complete|finished)/i,
  /feature (?:complete|done|implemented)/i
]

// How long to wait before force-sending the task if the prompt is never detected
const PROMPT_TIMEOUT_MS = 8000

export function useRace() {
  const store = useRaceStore()

  // Tracks which terminals belong to this race: terminalId -> provider
  const raceTerminalsRef = useRef<Map<string, CLIProvider>>(new Map())
  // Tracks which terminals have had the task sent
  const readyRef = useRef<Map<string, boolean>>(new Map())
  // Per-terminal fallback timers in case promptChar is never detected
  const promptTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const outputUnsubRef = useRef<(() => void) | null>(null)
  const autoFinishTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      if (outputUnsubRef.current) outputUnsubRef.current()
      if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current)
      for (const t of promptTimersRef.current.values()) clearTimeout(t)
    }
  }, [])

  /** Send the task to a terminal and mark it as ready */
  const sendTask = useCallback(
    (terminalId: string, task: string, source: string) => {
      if (readyRef.current.get(terminalId)) return // already sent
      readyRef.current.set(terminalId, true)

      // Clear fallback timer if prompt was naturally detected
      const timer = promptTimersRef.current.get(terminalId)
      if (timer) {
        clearTimeout(timer)
        promptTimersRef.current.delete(terminalId)
      }

      store.addLog(terminalId, 'ready', `CLI ready (${source}) — sending task`)
      store.updateMetrics(terminalId, { status: 'running', startTime: Date.now() })
      window.api.terminalSendText(task + '\n', terminalId).catch(console.error)
    },
    [store]
  )

  /**
   * Launch the race: create a terminal per provider, subscribe to output, send task on ready.
   */
  const startRace = useCallback(
    async (task: string, providers: CLIProvider[], projectFolder: string) => {
      // Clean up any previous run
      if (outputUnsubRef.current) {
        outputUnsubRef.current()
        outputUnsubRef.current = null
      }
      if (autoFinishTimerRef.current) {
        clearTimeout(autoFinishTimerRef.current)
        autoFinishTimerRef.current = null
      }
      for (const t of promptTimersRef.current.values()) clearTimeout(t)

      raceTerminalsRef.current = new Map()
      readyRef.current = new Map()
      promptTimersRef.current = new Map()

      store.configureRace(task)

      // Subscribe BEFORE creating terminals so we never miss the initial CLI prompt.
      const cleanup = window.api.onTerminalData((data, terminalId) => {
        if (!raceTerminalsRef.current.has(terminalId)) return

        const provider = raceTerminalsRef.current.get(terminalId)!
        const providerConfig = CLI_PROVIDERS[provider]
        const isReady = readyRef.current.get(terminalId) ?? false

        // Buffer raw output in store (metrics extracted there)
        store.appendOutput(terminalId, data)

        if (!isReady) {
          // Test both the current chunk AND the accumulated buffer (last 500 chars)
          const chunkClean = data.replace(ANSI_STRIP, '').replace(/\r/g, '')
          const storeState = useRaceStore.getState()
          const termMetrics = storeState.terminals.get(terminalId)
          const bufferTail = (termMetrics?.outputBuffer ?? '').slice(-500).replace(ANSI_STRIP, '').replace(/\r/g, '')

          const textToCheck = chunkClean + '\n' + bufferTail
          const nonEmptyLines = textToCheck.split('\n').filter((l) => l.trim().length > 0)
          const lastLines = nonEmptyLines.slice(-15).join('\n')

          if (providerConfig.promptChar.test(lastLines)) {
            sendTask(terminalId, task, 'prompt-detected')
          }
          return
        }

        // Check if the agent declared completion
        const cleanData = data.replace(ANSI_STRIP, '')
        const isDone = DONE_PATTERNS.some((p) => p.test(cleanData))
        if (isDone) {
          const raceState = useRaceStore.getState()
          if (raceState.status === 'racing') {
            raceState.markTerminalDone(terminalId)
            store.addLog(terminalId, 'complete', 'Task completed!')
          }
        }
      }) as () => void

      outputUnsubRef.current = cleanup

      // Create one terminal per provider
      for (const provider of providers) {
        let terminalId: string
        try {
          terminalId = await window.api.createTerminal(220, 50)
        } catch (err) {
          console.error('[Race] Failed to create terminal for', provider, err)
          continue
        }

        raceTerminalsRef.current.set(terminalId, provider)
        readyRef.current.set(terminalId, false)
        store.addTerminal(terminalId, provider)

        // Launch the CLI inside the terminal
        const providerConfig = CLI_PROVIDERS[provider]
        const launchCmd = projectFolder
          ? `cd "${projectFolder}" && ${providerConfig.binaryName}\n`
          : `${providerConfig.binaryName}\n`

        try {
          await window.api.terminalSendText(launchCmd, terminalId)
        } catch (err) {
          console.error('[Race] Failed to launch CLI in terminal', terminalId, err)
        }

        // Fallback: if promptChar never fires within PROMPT_TIMEOUT_MS, send the task anyway.
        // This handles CLIs that use non-standard prompts or when the prompt arrives
        // in a chunk that was processed before the subscription could check it.
        const tid = terminalId // capture for closure
        const fallbackTimer = setTimeout(() => {
          if (!readyRef.current.get(tid)) {
            console.warn(`[Race] Prompt not detected for ${provider} after ${PROMPT_TIMEOUT_MS}ms — sending task anyway`)
            sendTask(tid, task, 'timeout-fallback')
          }
        }, PROMPT_TIMEOUT_MS)
        promptTimersRef.current.set(terminalId, fallbackTimer)
      }

      store.startRace()

      // Add start logs after startRace() so they aren't wiped by the store reset
      for (const [terminalId, provider] of raceTerminalsRef.current) {
        store.addLog(terminalId, 'start', `${provider} terminal launched`)
      }

      // Auto-finish after 10 minutes — compare by score
      autoFinishTimerRef.current = setTimeout(() => {
        const raceState = useRaceStore.getState()
        if (raceState.status === 'racing') {
          raceState.finishRace()
        }
      }, 10 * 60 * 1000)
    },
    [store, sendTask]
  )

  /**
   * Stop the race, clean up terminals and timers.
   */
  const stopRace = useCallback(async () => {
    store.finishRace()

    if (outputUnsubRef.current) {
      outputUnsubRef.current()
      outputUnsubRef.current = null
    }
    if (autoFinishTimerRef.current) {
      clearTimeout(autoFinishTimerRef.current)
      autoFinishTimerRef.current = null
    }
    for (const t of promptTimersRef.current.values()) clearTimeout(t)
    promptTimersRef.current = new Map()

    // Gracefully stop all race terminals
    for (const terminalId of raceTerminalsRef.current.keys()) {
      await window.api.stopTerminal(terminalId).catch(() => {})
    }
    raceTerminalsRef.current = new Map()
    readyRef.current = new Map()
  }, [store])

  const resetRace = useCallback(async () => {
    await stopRace()
    store.resetRace()
  }, [stopRace, store])

  return {
    // Store state
    status: store.status,
    task: store.task,
    startTime: store.startTime,
    endTime: store.endTime,
    terminals: store.terminals,
    winnerId: store.winnerId,

    // Actions
    startRace,
    stopRace,
    resetRace
  }
}
