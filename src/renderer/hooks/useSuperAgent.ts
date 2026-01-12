import { useCallback, useEffect, useRef } from 'react'
import { useSuperAgentStore } from '../store/superAgentStore'
import type { SafetyLevel } from '../../shared/types'

// ANSI escape code regex for stripping terminal colors
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g

// System prompt for the Super Agent LLM
const SYSTEM_PROMPT = `You are an autonomous agent controlling Claude Code CLI. Your job is to keep Claude working on the task until it's PERFECT.

MODE: {MODE}
ORIGINAL TASK: {TASK}

TERMINAL OUTPUT:
{OUTPUT}

{TAKEOVER_CONTEXT}

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
- Output ONLY the EXACT text to type into the terminal - nothing else!
- NEVER say "You should type:" or "Run this command:" - just output the actual text
- NEVER say "Suggest adding..." - instead say "Add..." as a direct instruction
- If Claude is working, respond exactly "WAIT"
- NEVER respond "DONE" - always suggest improvements until time runs out
- Never repeat the exact same message or semantically similar suggestions twice
- Be SPECIFIC with improvements - don't just say "add error handling" repeatedly
- Vary your suggestions: try different aspects like UX, performance, accessibility, animations, tests`

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
  const isPaused = useSuperAgentStore((s) => s.isPaused)
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
  const togglePause = useSuperAgentStore((s) => s.togglePause)

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processingRef = useRef(false)
  const taskSentRef = useRef(false) // Track if initial task has been sent
  const lastResponseRef = useRef<string>('') // Track last response to avoid repeats
  const waitingStartRef = useRef<number | null>(null) // Track when Claude started waiting
  const consecutiveWaitsRef = useRef(0) // Track consecutive WAIT responses
  const lastStatusRef = useRef<ClaudeStatus>('unknown') // Track last status to avoid duplicate logs
  const lastStatusTimeRef = useRef<number>(0) // Debounce status changes
  const statusDebounceRef = useRef<NodeJS.Timeout | null>(null) // Debounce timer
  const waitingForReadyRef = useRef(true) // Wait for user to get Claude ready before taking over
  const takeoverModeRef = useRef(false) // Track if we're in takeover mode
  const waitingForReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Fallback timer for waiting
  const decisionCountRef = useRef(0) // Track decision count for re-anchoring
  const recentSuggestionsRef = useRef<string[]>([]) // Track recent suggestions for semantic dedup
  const errorCountRef = useRef(0) // Track consecutive errors for pattern detection

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

    // Task re-anchoring every 10 decisions to prevent drift
    if (decisionCountRef.current > 0 && decisionCountRef.current % 10 === 0) {
      stateContext += `\n\n📌 REMINDER (Decision #${decisionCountRef.current}): Your original task is: "${currentTask}". Stay focused on this goal and make meaningful progress.`
    }

    const cleanedOutput = stripAnsi(output).slice(-3500)

    // Add takeover context if in takeover mode
    const takeoverContext = takeoverModeRef.current
      ? `=== TAKEOVER MODE ===
You're taking control of an existing Claude conversation that was already in progress.
- Analyze what Claude is currently doing from the terminal output
- If Claude is waiting for input, provide helpful input to continue the work
- If Claude is working, respond WAIT
- Your task guidance may be generic - use the terminal output to understand the actual context
- Focus on helping Claude complete whatever it was working on`
      : ''

    const systemPrompt = SYSTEM_PROMPT
      .replace('{MODE}', takeoverModeRef.current ? 'TAKEOVER' : 'NEW_TASK')
      .replace('{TASK}', currentTask)
      .replace('{OUTPUT}', cleanedOutput)
      .replace('{TAKEOVER_CONTEXT}', takeoverContext) + stateContext

    // Log what the LLM is seeing (last 500 chars for debugging)
    console.log('[SuperAgent] LLM seeing output (last 500 chars):', cleanedOutput.slice(-500))

    // Retry logic with exponential backoff
    const MAX_RETRIES = 3
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await window.api.callLLMApi({
          provider: prov,
          apiKey,
          model,
          systemPrompt,
          userPrompt: 'Analyze the terminal output. What EXACTLY should I type? Just the response, nothing else.',
          temperature: 0.2
        })

        if (response.success) {
          // Log token usage if available
          if (response.usage) {
            const { promptTokens, completionTokens, totalTokens } = response.usage
            console.log(`[SuperAgent] Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total`)
            // Could add to store for cumulative tracking
          }
          return response.content || null
        }

        // API returned error - retry if we have attempts left
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1000 // 1s, 2s, 3s
          store.addLog('error', `LLM failed (${response.error}), retrying in ${delay/1000}s (${attempt}/${MAX_RETRIES})...`)
          await new Promise(r => setTimeout(r, delay))
        } else {
          store.addLog('error', `LLM error after ${MAX_RETRIES} attempts: ${response.error}`)
          return null
        }
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1000
          store.addLog('error', `LLM call failed, retrying in ${delay/1000}s (${attempt}/${MAX_RETRIES})...`)
          await new Promise(r => setTimeout(r, delay))
        } else {
          store.addLog('error', `LLM call failed after ${MAX_RETRIES} attempts: ${error}`)
          return null
        }
      }
    }
    return null
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
    if (store.isPaused) {
      console.log('[SuperAgent] handleIdle skipped - paused')
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
        errorCountRef.current++
        if (errorCountRef.current >= 3) {
          store.addLog('error', `${errorCountRef.current} consecutive LLM failures - consider stopping`)
        }
        processingRef.current = false
        return
      }

      // Reset error count on successful LLM response
      errorCountRef.current = 0

      // Increment decision counter
      decisionCountRef.current++

      let trimmedDecision = decision.trim()

      // Clean up LLM meta-instructions - extract actual text to send
      // Remove patterns like "You should type: '...'" or "Run this command: ..."
      const metaPatterns = [
        /^You should (?:type|say|respond|enter|input):\s*["']?(.+?)["']?$/is,
        /^(?:Type|Say|Respond|Enter|Send):\s*["']?(.+?)["']?$/is,
        /^Run (?:this )?(?:command|script)?:?\s*["']?(.+?)["']?$/is,
        /^Suggest(?:ion)?:?\s*["']?(.+?)["']?$/is,
      ]
      for (const pattern of metaPatterns) {
        const match = trimmedDecision.match(pattern)
        if (match && match[1]) {
          console.log('[SuperAgent] Cleaned meta-instruction:', trimmedDecision, '->', match[1])
          trimmedDecision = match[1].trim()
          break
        }
      }

      // Also clean "Suggest adding X" -> "Add X"
      if (trimmedDecision.toLowerCase().startsWith('suggest adding ')) {
        trimmedDecision = 'Add ' + trimmedDecision.slice(15)
      } else if (trimmedDecision.toLowerCase().startsWith('suggest ')) {
        trimmedDecision = trimmedDecision.slice(8)
      }

      const upperDecision = trimmedDecision.toUpperCase()

      // Semantic duplicate detection - check if response is too similar to recent suggestions
      const isSemanticallyDuplicate = (newResponse: string): boolean => {
        if (newResponse.length <= 5) return false // Short responses OK
        const newWords = new Set(newResponse.toLowerCase().split(/\s+/).filter(w => w.length > 2))
        for (const prev of recentSuggestionsRef.current) {
          const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 2))
          const overlap = [...newWords].filter(w => prevWords.has(w)).length
          const similarity = overlap / Math.max(newWords.size, prevWords.size)
          if (similarity > 0.7) return true
        }
        return false
      }

      // Avoid repeating the exact same response, EXCEPT:
      // - WAIT (always re-check)
      // - Short responses like numbers/letters (menu selections) - these are OK to repeat
      const isShortResponse = trimmedDecision.length <= 3
      if (trimmedDecision === lastResponseRef.current && upperDecision !== 'WAIT' && !isShortResponse) {
        store.addLog('decision', `Skipping repeated response: ${trimmedDecision}`)
        processingRef.current = false
        return
      }

      // Check for semantic duplicates (similar suggestions)
      if (upperDecision !== 'WAIT' && !isShortResponse && isSemanticallyDuplicate(trimmedDecision)) {
        store.addLog('decision', `Skipping similar suggestion: ${trimmedDecision.slice(0, 50)}...`)
        processingRef.current = false
        // Set a timer to re-check
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => handleIdle(), 3000)
        return
      }

      store.addLog('decision', `LLM decided: ${trimmedDecision}`)
      if (upperDecision !== 'WAIT') {
        lastResponseRef.current = trimmedDecision
        // Track recent suggestions for semantic dedup (keep last 5)
        recentSuggestionsRef.current = [...recentSuggestionsRef.current.slice(-4), trimmedDecision]
      }

      // Handle WAIT with hard limit
      if (upperDecision === 'WAIT' || upperDecision.startsWith('WAIT') || trimmedDecision.toLowerCase().includes("i'll wait")) {
        consecutiveWaitsRef.current++

        // HARD LIMIT: After 5 consecutive WAITs, force an action
        if (consecutiveWaitsRef.current >= 5) {
          store.addLog('decision', `⚠️ WAIT limit reached (${consecutiveWaitsRef.current}). Forcing action...`)
          consecutiveWaitsRef.current = 0
          waitingStartRef.current = null
          await sendToTerminal('Please continue with the next step or suggest an improvement')
          store.clearOutput()
          processingRef.current = false
          return
        }

        // Start tracking waiting time if not already
        if (!waitingStartRef.current) {
          waitingStartRef.current = Date.now()
        }
        const waitTime = Math.floor((Date.now() - waitingStartRef.current) / 1000)
        store.addLog('decision', `Waiting for Claude... (${waitTime}s, ${consecutiveWaitsRef.current}/5 checks)`)

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
    const { isRunning: running, activeTerminalId, config: cfg, outputBuffer, task: currentTask } = store

    // Debug: log why we might skip processing
    if (!running) {
      return // Super Agent not running
    }
    if (terminalId !== activeTerminalId) {
      console.log('[SuperAgent] Terminal ID mismatch:', { incoming: terminalId, expected: activeTerminalId })
      return
    }

    // Check if paused - still accumulate output but don't process
    if (store.isPaused) {
      store.appendOutput(data)
      return
    }

    store.appendOutput(data)
    const fullOutput = outputBuffer + data

    // If waiting for user to get Claude ready, watch for the ready prompt
    if (waitingForReadyRef.current) {
      const cleanOutput = fullOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      const lastLines = cleanOutput.split('\n').slice(-5).join('\n')

      // Check if Claude is ready (showing the ❯ prompt and not showing trust/setup prompts)
      const hasReadyPrompt = /❯\s*$/.test(lastLines)
      const hasTrustPrompt = /trust this project|trust settings|\(y\)|\(n\)|y\/n/i.test(lastLines)

      console.log('[SuperAgent] Waiting for ready - hasReadyPrompt:', hasReadyPrompt, 'hasTrustPrompt:', hasTrustPrompt)
      console.log('[SuperAgent] Last lines:', lastLines.slice(-100))

      if (hasReadyPrompt && !hasTrustPrompt) {
        // Guard against race condition - check we're still waiting
        if (!waitingForReadyRef.current) {
          console.log('[SuperAgent] Already started, ignoring duplicate ready trigger')
          return
        }
        console.log('[SuperAgent] Claude is ready! Sending task...')
        // Clear the fallback timer
        if (waitingForReadyTimeoutRef.current) {
          clearTimeout(waitingForReadyTimeoutRef.current)
          waitingForReadyTimeoutRef.current = null
        }
        waitingForReadyRef.current = false
        taskSentRef.current = true
        store.addLog('ready', 'Claude is ready! Taking over now...')
        store.addLog('input', `Sending task: ${currentTask}`)
        window.api.terminalSendText(currentTask, activeTerminalId)
        store.clearOutput()
        return
      } else {
        // Still waiting - don't start autonomous loop yet
        // But DO accumulate output for when we're ready
        return
      }
    }

    console.log('[SuperAgent] Received data, setting idle timer')

    // Detect Claude's current status with debouncing to avoid flip-flopping
    const currentStatus = detectClaudeStatus(fullOutput)
    const now = Date.now()

    // Clear any pending status update
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current)
    }

    // Only update status if it's different and we haven't changed recently (debounce 1.5s)
    if (currentStatus !== lastStatusRef.current && currentStatus !== 'unknown') {
      const timeSinceLastChange = now - lastStatusTimeRef.current

      // If changing to 'working', update immediately (Claude started doing something)
      // If changing to 'waiting', debounce to avoid false positives
      if (currentStatus === 'working' && timeSinceLastChange > 500) {
        lastStatusRef.current = currentStatus
        lastStatusTimeRef.current = now
        store.addLog('working', 'Claude is working...')
      } else if (currentStatus === 'waiting') {
        // Debounce waiting detection - only log after output has stopped for 1.5s
        statusDebounceRef.current = setTimeout(() => {
          if (lastStatusRef.current !== 'waiting') {
            lastStatusRef.current = 'waiting'
            lastStatusTimeRef.current = Date.now()
            store.addLog('waiting', 'Claude is waiting for input')
          }
        }, 1500)
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
    options?: { timeLimit?: number; safetyLevel?: SafetyLevel; projectFolder?: string; takeover?: boolean }
  ) => {
    console.log('[SuperAgent] Starting with terminalId:', terminalId, 'takeover:', options?.takeover)
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
    takeoverModeRef.current = options?.takeover ?? false

    // Set options
    if (options?.timeLimit !== undefined) store.setTimeLimit(options.timeLimit)
    if (options?.safetyLevel) store.setSafetyLevel(options.safetyLevel)

    // Start session with project folder
    const projectFolder = options?.projectFolder || ''
    store.startSession(taskDescription, terminalId, projectFolder)

    // Set duration timer if time limit is set
    const limit = options?.timeLimit ?? store.timeLimit
    if (limit > 0) {
      durationTimerRef.current = setTimeout(() => {
        getStore().addLog('complete', `Time limit reached (${limit} minutes) - task completed full duration`)
        getStore().stopSession('completed')
      }, limit * 60 * 1000)
    }

    if (options?.takeover) {
      // Takeover mode - start immediately, don't wait for ready prompt
      waitingForReadyRef.current = false
      taskSentRef.current = true // Don't send task as initial message
      store.addLog('start', 'Taking over current conversation...')
      store.addLog('ready', 'Analyzing current state...')

      // Trigger first idle check to analyze current state
      // Use a short delay to let terminal output settle
      setTimeout(() => {
        handleIdle()
      }, 500)
    } else {
      // Normal mode - wait for user to get Claude ready
      waitingForReadyRef.current = true
      store.addLog('start', `Waiting for Claude to be ready... Get through any prompts, then Super Agent will take over.`)

      // Add fallback timer - if still waiting after 30 seconds, auto-start anyway
      if (waitingForReadyTimeoutRef.current) {
        clearTimeout(waitingForReadyTimeoutRef.current)
      }
      waitingForReadyTimeoutRef.current = setTimeout(() => {
        // Double-check we're still waiting (guard against race condition)
        if (waitingForReadyRef.current && getStore().isRunning) {
          console.log('[SuperAgent] Fallback: waited 30s, starting anyway')
          waitingForReadyRef.current = false
          // In fallback mode, we DO want to send the task
          const currentTask = getStore().task
          getStore().addLog('ready', 'Auto-starting after timeout...')
          getStore().addLog('input', `Sending task: ${currentTask}`)
          window.api.terminalSendText(currentTask, getStore().activeTerminalId!)
          getStore().clearOutput()
          // Then start the idle loop
          setTimeout(() => handleIdle(), 2000)
        }
      }, 30000)
    }

    return true
  }, [handleIdle])

  // Nudge Super Agent - force check terminal state
  const nudgeSuperAgent = useCallback(() => {
    const store = getStore()
    if (!store.isRunning) return

    // Skip waiting for ready - user is nudging, they know it's ready
    if (waitingForReadyRef.current) {
      waitingForReadyRef.current = false
      taskSentRef.current = true // Don't send task, just start analyzing
      store.addLog('ready', 'Nudged! Starting autonomous mode...')
    } else {
      store.addLog('decision', 'Nudged! Re-analyzing terminal...')
    }

    // Clear any pending timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (waitingForReadyTimeoutRef.current) {
      clearTimeout(waitingForReadyTimeoutRef.current)
      waitingForReadyTimeoutRef.current = null
    }

    // Reset consecutive waits
    consecutiveWaitsRef.current = 0
    waitingStartRef.current = null

    // Force immediate idle check
    handleIdle()
  }, [handleIdle])

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
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current)
      statusDebounceRef.current = null
    }
    if (waitingForReadyTimeoutRef.current) {
      clearTimeout(waitingForReadyTimeoutRef.current)
      waitingForReadyTimeoutRef.current = null
    }
    lastStatusRef.current = 'unknown'
    takeoverModeRef.current = false
    getStore().stopSession()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current)
      if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current)
      if (waitingForReadyTimeoutRef.current) clearTimeout(waitingForReadyTimeoutRef.current)
    }
  }, [])

  return {
    // State (subscribed via selectors)
    isRunning,
    isPaused,
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
    nudgeSuperAgent,
    togglePause,
    processOutput
  }
}
