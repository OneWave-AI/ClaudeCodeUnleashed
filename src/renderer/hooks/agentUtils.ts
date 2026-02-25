import { CLI_PROVIDERS } from '../../shared/providers'
import type { SafetyLevel, CLIProvider } from '../../shared/types'

// ANSI escape code regex for stripping terminal colors
export const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g

// System prompt for the Super Agent / Orchestrator LLM
export const SYSTEM_PROMPT = `You are an autonomous agent controlling a CLI coding assistant. Your job is to keep it working on the task until it's PERFECT.

MODE: {MODE}
ORIGINAL TASK: {TASK}

{TAKEOVER_CONTEXT}

=== DECISION RULES (in priority order) ===

1. CLI IS WORKING - If you see ANY of these, respond "WAIT":
   - Spinner characters
   - "..." at end of line
   - Tool names like "Read(", "Write(", "Edit(", "Bash("

2. YES/NO PROMPT - If you see "(y/n)" or "[Y/n]" or "Allow?":
   → respond: y

3. QUESTION - If the CLI asks a question (ends with ?):
   → Give a specific, helpful answer that advances the task

4. OPTIONS - If the CLI shows numbered options [1] [2] [3]:
   → Pick the best number for the task

5. CLI FINISHED OR ASKING "anything else?" - KEEP ITERATING:
   → Suggest a specific improvement, enhancement, or polish
   → NEVER say "DONE" - always find something to improve

6. WAITING FOR INPUT (prompt visible):
   → If task is just starting: guide on first steps
   → If task is in progress: suggest next feature or improvement
   → NEVER say "DONE" - keep pushing for perfection

=== CRITICAL RULES ===
- Output ONLY the EXACT text to type into the terminal - nothing else!
- NEVER say "You should type:" or "Run this command:" - just output the actual text
- NEVER say "Suggest adding..." - instead say "Add..." as a direct instruction
- If the CLI is working, respond exactly "WAIT"
- NEVER respond "DONE" - always suggest improvements until time runs out
- Never repeat the exact same message or semantically similar suggestions twice
- Be SPECIFIC with improvements - don't just say "add error handling" repeatedly
- Vary your suggestions: try different aspects like UX, performance, accessibility, animations, tests`

// Detect Claude's current status from pre-cleaned output using provider patterns
export type ClaudeStatus = 'working' | 'waiting' | 'unknown'

export function detectClaudeStatus(cleanOutput: string, cliProvider: CLIProvider): ClaudeStatus {
  const config = CLI_PROVIDERS[cliProvider]
  const lastLines = cleanOutput.split('\n').slice(-10).join('\n')

  for (const pattern of config.workingPatterns) {
    if (pattern.test(lastLines)) return 'working'
  }
  for (const pattern of config.waitingPatterns) {
    if (pattern.test(lastLines)) return 'waiting'
  }
  if (config.promptChar.test(lastLines)) return 'waiting'
  return 'unknown'
}

// Fast-path result with optional question context
export interface FastPathResult {
  response: string
  question?: string
}

// Dangerous commands to block in safe mode
export const DANGEROUS_PATTERNS = [
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

// Fast-path patterns that can be answered without an LLM call
export function fastPathResponse(
  cleanOutput: string, taskSent: boolean, task: string,
  safetyLevel: SafetyLevel, cliProvider: CLIProvider
): FastPathResult | null {
  const config = CLI_PROVIDERS[cliProvider]
  const lastLines = cleanOutput.split('\n').slice(-10).join('\n')

  // 1. Spinner/working indicators -> WAIT (no send)
  if (/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(lastLines)) return { response: 'WAIT' }

  // 2. Yes/no prompts -> check safety before auto-approving
  if (/\(y\/n\)|\[Y\/n\]|\[y\/N\]|Allow\?|Proceed\?|Continue\?/i.test(lastLines)) {
    const lines = lastLines.split('\n').filter(l => l.trim())
    const idx = lines.findIndex(l => /\(y\/n\)|Allow\?|Proceed\?|Continue\?|\[Y\/n\]|\[y\/N\]/i.test(l))
    const question = lines.slice(Math.max(0, idx - 1), idx + 1).join(' ').trim()

    if (safetyLevel === 'safe' && DANGEROUS_PATTERNS.some(p => p.test(question))) {
      return null // fall through to LLM
    }
    return { response: 'y', question }
  }

  // 3. Trust prompt
  if (/trust this project/i.test(lastLines)) return { response: 'y', question: 'Trust this project?' }

  // 4. Ready prompt + task not sent yet -> send the task
  if (config.promptChar.test(lastLines) && !taskSent) return { response: task }

  // 5. Questions that need creative answers -> fall through to LLM
  if (/anything else|how can i help|what would you like/i.test(lastLines)) return null

  return null
}

// Check if command is dangerous
export function isDangerous(command: string, level: SafetyLevel): boolean {
  if (level === 'yolo') return false
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))
}

// Lightweight stats parser - returns partial stats object
export function parseStats(cleanOutput: string): Record<string, number> {
  const stats: Record<string, number> = {}
  const writes = cleanOutput.match(/(?:Write|Edit)\([^)]+\)/gi)
  if (writes) stats.filesWritten = writes.length
  const reads = cleanOutput.match(/Read\([^)]+\)/gi)
  if (reads) stats.filesRead = reads.length
  const passed = cleanOutput.match(/(\d+)\s+(?:tests?\s+)?passed/i)
  if (passed) stats.testsPassed = parseInt(passed[1])
  const failed = cleanOutput.match(/(\d+)\s+(?:tests?\s+)?failed/i)
  if (failed) stats.testsFailed = parseInt(failed[1])
  const errors = cleanOutput.match(/(?:Error|error|ERROR):/g)
  if (errors) stats.errorsEncountered = errors.length
  return stats
}

// Parse LLM decision text, extracting actual command from meta-patterns
export function parseLLMDecision(rawDecision: string): string {
  let trimmed = rawDecision.trim()

  // Try parsing as JSON structured output first
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.action === 'string') {
      if (parsed.action === 'wait') return 'WAIT'
      if (parsed.action === 'done') return 'DONE'
      if (parsed.action === 'send' && typeof parsed.text === 'string') return parsed.text
    }
  } catch {
    // Not JSON - fall back to raw text parsing
    const metaPatterns = [
      /^You should (?:type|say|respond|enter|input):\s*["']?(.+?)["']?$/is,
      /^(?:Type|Say|Respond|Enter|Send):\s*["']?(.+?)["']?$/is,
      /^Run (?:this )?(?:command|script)?:?\s*["']?(.+?)["']?$/is,
      /^Suggest(?:ion)?:?\s*["']?(.+?)["']?$/is,
    ]
    for (const pattern of metaPatterns) {
      const match = trimmed.match(pattern)
      if (match && match[1]) {
        trimmed = match[1].trim()
        break
      }
    }
    if (trimmed.toLowerCase().startsWith('suggest adding ')) {
      trimmed = 'Add ' + trimmed.slice(15)
    } else if (trimmed.toLowerCase().startsWith('suggest ')) {
      trimmed = trimmed.slice(8)
    }
  }

  return trimmed
}

// Detect when a task is actually complete (Claude asking "anything else?" after doing work)
export function detectTaskCompletion(cleanOutput: string, cliProvider: CLIProvider): boolean {
  const lastLines = cleanOutput.split('\n').slice(-20).join('\n')
  // Claude says task is complete
  if (/(?:anything else|is there anything|how can i help|what.*would you like)/i.test(lastLines)) {
    // Only if there are signs of actual work done
    if (/(?:created|wrote|updated|fixed|implemented|added|built|completed)/i.test(cleanOutput.slice(-3000))) {
      return true
    }
  }
  return false
}

// Smart output summarization - keeps head, important middle, and tail
export function summarizeTerminalOutput(cleanOutput: string, maxChars: number = 4000): string {
  if (cleanOutput.length <= maxChars) return cleanOutput

  const lines = cleanOutput.split('\n')

  // Always keep: first 10 lines (task context), last 30 lines (current state)
  const head = lines.slice(0, 10).join('\n')
  const tail = lines.slice(-30).join('\n')

  // From the middle, extract only important lines
  const middleLines = lines.slice(10, -30)
  const importantPatterns = /(?:error|warning|created|wrote|updated|failed|success|test|passed|TODO|FIXME)/i
  const importantMiddle = middleLines
    .filter(l => importantPatterns.test(l))
    .slice(-20) // Cap at 20 important lines
    .join('\n')

  const budget = maxChars - head.length - tail.length - 100 // 100 for separators
  const middleTruncated = importantMiddle.slice(0, Math.max(0, budget))

  return `${head}\n\n--- [${middleLines.length} lines summarized, showing errors/key events] ---\n${middleTruncated}\n\n--- [Recent output] ---\n${tail}`
}

// Semantic duplicate detection
export function isSemanticallyDuplicate(newResponse: string, recentSuggestions: string[]): boolean {
  if (newResponse.length <= 5) return false
  const newWords = new Set(newResponse.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  for (const prev of recentSuggestions) {
    const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const overlap = [...newWords].filter(w => prevWords.has(w)).length
    const similarity = overlap / Math.max(newWords.size, prevWords.size)
    if (similarity > 0.7) return true
  }
  return false
}
