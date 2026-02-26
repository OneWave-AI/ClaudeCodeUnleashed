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

export function useRace() {
  const store = useRaceStore()

  // Tracks which terminals belong to this race: terminalId -> provider
  const raceTerminalsRef = useRef<Map<string, CLIProvider>>(new Map())
  // Tracks which terminals have shown the ready prompt and had the task sent
  const readyRef = useRef<Map<string, boolean>>(new Map())

  const outputUnsubRef = useRef<(() => void) | null>(null)
  const autoFinishTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      if (outputUnsubRef.current) outputUnsubRef.current()
      if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current)
    }
  }, [])

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

      raceTerminalsRef.current = new Map()
      readyRef.current = new Map()

      store.configureRace(task)

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
        store.addLog(terminalId, 'start', `${provider} terminal ready`)

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
      }

      store.startRace()

      // Subscribe to all terminal output
      const cleanup = window.api.onTerminalData((data, terminalId) => {
        if (!raceTerminalsRef.current.has(terminalId)) return

        const provider = raceTerminalsRef.current.get(terminalId)!
        const providerConfig = CLI_PROVIDERS[provider]
        const isReady = readyRef.current.get(terminalId) ?? false

        // Buffer raw output in store (metrics extracted there)
        store.appendOutput(terminalId, data)

        if (!isReady) {
          // Watch for the CLI ready prompt before sending the task
          const clean = data.replace(ANSI_STRIP, '').replace(/\r/g, '')
          const nonEmptyLines = clean.split('\n').filter((l) => l.trim().length > 0)
          const lastLines = nonEmptyLines.slice(-10).join('\n')

          if (providerConfig.promptChar.test(lastLines)) {
            readyRef.current.set(terminalId, true)
            store.addLog(terminalId, 'ready', 'CLI ready — sending task')
            store.updateMetrics(terminalId, { status: 'running', startTime: Date.now() })
            window.api.terminalSendText(task + '\n', terminalId).catch(console.error)
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

      // Auto-finish after 10 minutes — compare by score
      autoFinishTimerRef.current = setTimeout(() => {
        const raceState = useRaceStore.getState()
        if (raceState.status === 'racing') {
          raceState.finishRace()
        }
      }, 10 * 60 * 1000)
    },
    [store]
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
