import { useCallback, useEffect, useRef } from 'react'
import { useSuperAgentStore } from '../store/superAgentStore'
import type { SafetyLevel } from '../../shared/types'

// ANSI escape code regex for stripping terminal colors
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g

// System prompt for the Super Agent LLM
const SYSTEM_PROMPT = `You are an autonomous agent controlling Claude Code CLI. Your job is to keep Claude working on the task until it's PERFECT.

ORIGINAL TASK: {TASK}

TERMINAL OUTPUT:
{OUTPUT}

=== DECISION RULES (in priority order) ===

1. CLAUDE IS WORKING - If you see ANY of these, respond "WAIT":
   - Spinner characters (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
   - "..." at end of line
   - "thinking", "analyzing", "searching", "reading", "writing"
   - Tool names like "Read(", "Write(", "Edit(", "Bash("

2. YES/NO PROMPT - If you see "(y/n)" or "[Y/n]" or "Allow?":
   → respond: y

3. QUESTION - If Claude asks a question (ends with ?):
   → Give a specific, helpful answer that advances the task

4. OPTIONS - If Claude shows numbered options [1] [2] [3]:
   → Pick the best number for the task

5. CLAUDE FINISHED OR ASKING "anything else?" - KEEP ITERATING:
   → Suggest a specific improvement, enhancement, or polish
   → Examples: "add error handling", "improve the styling", "add comments", "make it more responsive", "add loading states", "improve performance"
   → NEVER say "DONE" - always find something to improve

6. WAITING FOR INPUT (❯ prompt visible):
   → If task is just starting: guide Claude on first steps
   → If task is in progress: suggest next feature or improvement
   → NEVER say "DONE" - keep pushing for perfection

=== CRITICAL RULES ===
- Output ONLY your response text, nothing else
- If Claude is working, respond exactly "WAIT"
- NEVER respond "DONE" - always suggest improvements until time runs out
- Never repeat the exact same message twice
- Be specific with improvement suggestions, not vague`

// Patterns that indicate Claude is waiting for input (check last few lines)
const WAITING_PATTERNS = [
  // Startup/trust screens
  /trust this project/i,
  /trust settings/i,
  /\(y\)/i, // Simple (y) prompt
  /\(n\)/i, // Simple (n) prompt
  /\(y\/n\)/i, // Yes/no prompt
  /\[y\/N\]/i, // Yes/no with default
  /\[Y\/n\]/i, // Yes/no with default
  /Allow\?/i, // Permission prompt
  /Proceed\?/i, // Proceed prompt
  /Continue\?/i, // Continue prompt
  /Do you want to/i, // Confirmation
  /Press Enter/i, // Enter prompt
  // Ready for input
  /❯\s*$/m, // Claude prompt at end of output
  />\s*$/m, // Generic prompt
  /What would you like/i, // Open question
  /How can I help/i, // Ready for input
  /anything else/i // Task complete question
]

// Patterns that indicate Claude is actively working (DON'T interrupt)
const WORKING_PATTERNS = [
  /\.\.\.\s*$/m, // Progress dots at end
  /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/m, // Spinner characters
  /thinking/i,
  /analyzing/i,
  /searching/i,
  /reading/i,
  /writing/i,
  /running/i,
  /executing/i,
  /loading/i,
  /processing/i,
  /building/i,
  /compiling/i,
  /installing/i,
  /fetching/i,
  /downloading/i,
  /creating/i,
  /updating/i,
  /Tool:/i, // Tool being used
  /Read\(/i, // Reading file
  /Write\(/i, // Writing file
  /Edit\(/i, // Editing file
  /Bash\(/i, // Running bash
  /Task\(/i // Running task
]

// Detect Claude's current status from output
type ClaudeStatus = 'working' | 'waiting' | 'unknown'

function detectClaudeStatus(output: string): ClaudeStatus {
  const cleanOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  const lastLines = cleanOutput.split('\n').slice(-10).join('\n')

  // Check working patterns first (higher priority)
  for (const pattern of WORKING_PATTERNS) {
    if (pattern.test(lastLines)) {
      return 'working'
    }
  }

  // Check waiting patterns
  for (const pattern of WAITING_PATTERNS) {
    if (pattern.test(lastLines)) {
      return 'waiting'
    }
  }

  // Check if output ends with a clean prompt
  if (/[❯>$]\s*$/.test(lastLines)) {
    return 'waiting'
  }

  return 'unknown'
}

// Dangerous commands to block in safe mode
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /rm\s+--force/i,
  /git\s+push\s+--force/i,
  /git\s+push\s+-f/i,
  /drop\s+database/i,
  /truncate\s+table/i,
  /delete\s+from.*where.*1\s*=\s*1/i,
  /format\s+c:/i,
  /mkfs/i,
  /dd\s+if=/i
]

// Helper to get store state without causing re-renders
const getStore = () => useSuperAgentStore.getState()

export function useSuperAgent() {
  // Subscribe to specific state we need for rendering
  const isRunning = useSuperAgentStore((s) => s.isRunning)
  const task = useSuperAgentStore((s) => s.task)
  const startTime = useSuperAgentStore((s) => s.startTime)
  const timeLimit = useSuperAgentStore((s) => s.timeLimit)
  const safetyLevel = useSuperAgentStore((s) => s.safetyLevel)
  const activityLog = useSuperAgentStore((s) => s.activityLog)
  const config = useSuperAgentStore((s) => s.config)
  const provider = useSuperAgentStore((s) => s.provider)

  // Actions from store
  const setTimeLimit = useSuperAgentStore((s) => s.setTimeLimit)
  const setSafetyLevel = useSuperAgentStore((s) => s.setSafetyLevel)
  const setProvider = useSuperAgentStore((s) => s.setProvider)

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processingRef = useRef(false)
  const taskSentRef = useRef(false) // Track if initial task has been sent
  const lastResponseRef = useRef<string>('') // Track last response to avoid repeats
  const waitingStartRef = useRef<number | null>(null) // Track when Claude started waiting
  const consecutiveWaitsRef = useRef(0) // Track consecutive WAIT responses
  const lastStatusRef = useRef<ClaudeStatus>('unknown') // Track last status to avoid duplicate logs

  // Load config function - stable, no dependencies
  const loadConfig = useCallback(async () => {
    try {
      const loadedConfig = await window.api.loadSuperAgentConfig()
      if (loadedConfig) {
        getStore().setConfig(loadedConfig)
        return loadedConfig
      }
    } catch (err) {
      console.error('Failed to load Super Agent config:', err)
    }
    return getStore().config
  }, [])

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Strip ANSI codes from terminal output
  const stripAnsi = useCallback((str: string): string => {
    return str.replace(ANSI_REGEX, '')
  }, [])

  // Check if command is dangerous
  const isDangerous = useCallback((command: string, level: SafetyLevel): boolean => {
    if (level === 'yolo') return false
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))
  }, [])

  // Call the LLM to decide what to do
  const callLLM = useCallback(async (output: string): Promise<string | null> => {
    const store = getStore()
    const { config: cfg, provider: prov, task: currentTask } = store

    if (!cfg) return null

    const apiKey = prov === 'openai' ? cfg.openaiApiKey : cfg.groqApiKey
    const model = prov === 'openai' ? cfg.openaiModel : cfg.groqModel

    if (!apiKey) {
      store.addLog('error', `No API key configured for ${prov}`)
      return null
    }

    // Add context about state
    let stateContext = ''
    if (taskSentRef.current) {
      stateContext = '\n\nIMPORTANT: The task has ALREADY been sent to Claude. DO NOT send the task again. Either respond WAIT, answer a question, approve a prompt, or suggest an improvement.'
    }
    if (lastResponseRef.current) {
      stateContext += `\n\nYour last response was: "${lastResponseRef.current}" - DO NOT repeat it.`
    }

    // Check if Claude has been waiting too long (>7 seconds)
    const waitingTooLong = waitingStartRef.current && (Date.now() - waitingStartRef.current > 7000)
    const tooManyWaits = consecutiveWaitsRef.current >= 2

    if (waitingTooLong || tooManyWaits) {
      stateContext += `\n\n🚨 URGENT: Claude has been WAITING for input for ${Math.floor((Date.now() - (waitingStartRef.current || Date.now())) / 1000)} seconds! You've said WAIT ${consecutiveWaitsRef.current} times. DO NOT say WAIT again. You MUST provide actual input now - suggest an improvement, answer a question, or give Claude something to do. The terminal shows the ❯ prompt which means Claude is READY for your input.`
    }

    const cleanedOutput = stripAnsi(output).slice(-3500)
    const systemPrompt = SYSTEM_PROMPT.replace('{TASK}', currentTask).replace(
      '{OUTPUT}',
      cleanedOutput
    ) + stateContext

    // Log what the LLM is seeing (last 500 chars for debugging)
    console.log('[SuperAgent] LLM seeing output (last 500 chars):', cleanedOutput.slice(-500))

    try {
      const response = await window.api.callLLMApi({
        provider: prov,
        apiKey,
        model,
        systemPrompt,
        userPrompt: 'Analyze the terminal output. What EXACTLY should I type? Just the response, nothing else.',
        temperature: 0.2
      })

      if (!response.success) {
        store.addLog('error', `LLM error: ${response.error}`)
        return null
      }

      return response.content || null
    } catch (error) {
      store.addLog('error', `LLM call failed: ${error}`)
      return null
    }
  }, [stripAnsi])

  // Send input to terminal
  const sendToTerminal = useCallback(async (input: string) => {
    const store = getStore()
    const { activeTerminalId, safetyLevel: level } = store

    if (!activeTerminalId) {
      store.addLog('error', 'No active terminal')
      return
    }

    if (isDangerous(input, level)) {
      store.addLog('error', `Blocked dangerous command: ${input}`)
      return
    }

    store.addLog('input', `Sending: ${input}`)
    // terminalSendText already adds \r (Enter), don't add \n
    await window.api.terminalSendText(input, activeTerminalId)
  }, [isDangerous])

  // Handle idle detection - called when Claude stops outputting
  const handleIdle = useCallback(async () => {
    console.log('[SuperAgent] handleIdle called')
    const store = getStore()
    if (processingRef.current) {
      console.log('[SuperAgent] handleIdle skipped - already processing')
      return
    }
    if (!store.isRunning) {
      console.log('[SuperAgent] handleIdle skipped - not running')
      return
    }
    processingRef.current = true

    try {
      const { outputBuffer } = store
      console.log('[SuperAgent] Output buffer length:', outputBuffer.length)

      // Simple approach: if terminal is idle, consult the LLM
      // The LLM can see the output and decide if Claude is working or waiting
      store.setIdle(true)
      store.addLog('decision', 'Terminal idle, consulting LLM...')

      const decision = await callLLM(outputBuffer)

      if (!decision) {
        processingRef.current = false
        return
      }

      const trimmedDecision = decision.trim()
      const upperDecision = trimmedDecision.toUpperCase()

      // Avoid repeating the exact same response, EXCEPT:
      // - WAIT (always re-check)
      // - Short responses like numbers/letters (menu selections) - these are OK to repeat
      const isShortResponse = trimmedDecision.length <= 3
      if (trimmedDecision === lastResponseRef.current && upperDecision !== 'WAIT' && !isShortResponse) {
        store.addLog('decision', `Skipping repeated response: ${trimmedDecision}`)
        processingRef.current = false
        return
      }

      store.addLog('decision', `LLM decided: ${trimmedDecision}`)
      if (upperDecision !== 'WAIT') {
        lastResponseRef.current = trimmedDecision
      }

      if (upperDecision === 'WAIT') {
        consecutiveWaitsRef.current++
        // Start tracking waiting time if not already
        if (!waitingStartRef.current) {
          waitingStartRef.current = Date.now()
        }
        const waitTime = Math.floor((Date.now() - waitingStartRef.current) / 1000)
        store.addLog('decision', `Waiting for Claude... (${waitTime}s, ${consecutiveWaitsRef.current} checks)`)

        // Set a new idle timer to check again - don't get stuck!
        const cfg = getStore().config
        // Use shorter timeout if we've been waiting too long
        const baseTimeout = (cfg?.idleTimeout || 5) * 1000
        const idleTimeout = consecutiveWaitsRef.current >= 2 ? Math.min(baseTimeout, 3000) : baseTimeout

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          console.log('[SuperAgent] Re-checking after WAIT...')
          handleIdle()
        }, idleTimeout)
      } else if (upperDecision === 'DONE') {
        // LLM tried to stop - override and ask for improvements instead
        store.addLog('decision', 'Overriding DONE - asking for improvements')
        waitingStartRef.current = null
        consecutiveWaitsRef.current = 0
        await sendToTerminal('Please add more polish, error handling, or improvements to make this even better')
        store.clearOutput()
      } else if (upperDecision === 'ENTER') {
        // Just press Enter - terminalSendText adds \r automatically
        store.addLog('input', 'Pressing Enter')
        waitingStartRef.current = null
        consecutiveWaitsRef.current = 0
        await window.api.terminalSendText('', getStore().activeTerminalId!)
        store.clearOutput()
      } else if (upperDecision === 'TASK') {
        // Send the actual task instruction
        const currentTask = getStore().task
        store.addLog('input', `Sending task: ${currentTask}`)
        waitingStartRef.current = null
        consecutiveWaitsRef.current = 0
        taskSentRef.current = true
        await sendToTerminal(currentTask)
        store.clearOutput()
      } else if (upperDecision === 'Y' || upperDecision === 'N') {
        // Simple y/n approval
        waitingStartRef.current = null
        consecutiveWaitsRef.current = 0
        await sendToTerminal(trimmedDecision.toLowerCase())
        store.clearOutput()
      } else {
        // This is likely a task instruction or detailed response
        // Mark task as sent if it's a long instruction (> 20 chars)
        waitingStartRef.current = null
        consecutiveWaitsRef.current = 0
        if (trimmedDecision.length > 20 && !taskSentRef.current) {
          taskSentRef.current = true
        }
        await sendToTerminal(trimmedDecision)
        store.clearOutput()
      }
    } finally {
      processingRef.current = false
    }
  }, [callLLM, sendToTerminal])

  // Process incoming terminal output
  const processOutput = useCallback((data: string, terminalId: string) => {
    const store = getStore()
    const { isRunning: running, activeTerminalId, config: cfg, outputBuffer } = store

    // Debug: log why we might skip processing
    if (!running) {
      return // Super Agent not running
    }
    if (terminalId !== activeTerminalId) {
      console.log('[SuperAgent] Terminal ID mismatch:', { incoming: terminalId, expected: activeTerminalId })
      return
    }

    store.appendOutput(data)
    console.log('[SuperAgent] Received data, setting idle timer')

    // Detect Claude's current status and log state changes
    const currentStatus = detectClaudeStatus(outputBuffer + data)
    if (currentStatus !== lastStatusRef.current && currentStatus !== 'unknown') {
      lastStatusRef.current = currentStatus
      if (currentStatus === 'working') {
        store.addLog('working', 'Claude is working...')
      } else if (currentStatus === 'waiting') {
        store.addLog('waiting', 'Claude is waiting for input')
      }
    }

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }

    // Set new idle timer
    const idleTimeout = (cfg?.idleTimeout || 5) * 1000
    console.log('[SuperAgent] Idle timeout:', idleTimeout, 'ms')
    idleTimerRef.current = setTimeout(() => {
      console.log('[SuperAgent] Idle timer fired, calling handleIdle')
      handleIdle()
    }, idleTimeout)
  }, [handleIdle])

  // Start Super Agent session
  const startSuperAgent = useCallback(async (
    taskDescription: string,
    terminalId: string,
    options?: { timeLimit?: number; safetyLevel?: SafetyLevel }
  ) => {
    console.log('[SuperAgent] Starting with terminalId:', terminalId)
    const store = getStore()
    const { config: cfg, provider: prov } = store

    if (!cfg) {
      console.error('Super Agent config not loaded')
      return false
    }

    const apiKey = prov === 'openai' ? cfg.openaiApiKey : cfg.groqApiKey
    if (!apiKey) {
      console.error(`No ${prov} API key configured`)
      return false
    }

    // Reset state for new session
    taskSentRef.current = false
    lastResponseRef.current = ''
    waitingStartRef.current = null
    consecutiveWaitsRef.current = 0

    // Set options
    if (options?.timeLimit !== undefined) store.setTimeLimit(options.timeLimit)
    if (options?.safetyLevel) store.setSafetyLevel(options.safetyLevel)

    // Start session
    store.startSession(taskDescription, terminalId)

    // Set duration timer if time limit is set
    const limit = options?.timeLimit ?? store.timeLimit
    if (limit > 0) {
      durationTimerRef.current = setTimeout(() => {
        getStore().addLog('stop', `Time limit reached (${limit} minutes)`)
        getStore().stopSession()
      }, limit * 60 * 1000)
    }

    // Send task immediately - user must ensure Claude is ready first
    store.addLog('input', `Sending task: ${taskDescription}`)
    taskSentRef.current = true
    await window.api.terminalSendText(taskDescription, terminalId)

    return true
  }, [])

  // Stop Super Agent session
  const stopSuperAgent = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current)
      durationTimerRef.current = null
    }
    getStore().stopSession()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current)
    }
  }, [])

  return {
    // State (subscribed via selectors)
    isRunning,
    task,
    startTime,
    timeLimit,
    safetyLevel,
    activityLog,
    config,
    provider,

    // Actions
    setTimeLimit,
    setSafetyLevel,
    setProvider,
    loadConfig,
    startSuperAgent,
    stopSuperAgent,
    processOutput
  }
}
