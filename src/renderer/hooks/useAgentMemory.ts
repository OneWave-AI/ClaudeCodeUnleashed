import { useCallback } from 'react'
import { useAgentMemoryStore } from '../store/agentMemoryStore'
import type { AgentMemoryEntry, AgentMemoryCategory, ActivityLogEntry, SuperAgentConfig, LLMProvider } from '../../shared/types'

// Extraction prompt — compact so it fits within low token budgets
const EXTRACT_SYSTEM = `You analyse AI agent session logs and extract reusable project-specific knowledge.
Categories:
  command   – specific commands or scripts that worked/failed
  preference – codebase style choices (e.g. "uses TypeScript strict mode", "tabs not spaces")
  pattern   – recurring file/code structures discovered
  failure   – approaches that failed and should be avoided
  workflow  – step sequences that reliably work

Respond ONLY with a JSON array (no markdown):
[{"category":"command|preference|pattern|failure|workflow","content":"...","confidence":0.0-1.0}]

Rules:
- Max 8 entries, each content <= 120 chars
- Only include confidence >= 0.6
- Skip generic or obvious learnings
- Skip anything already well-known (e.g. "npm install installs packages")`

interface ExtractionConfig {
  provider: LLMProvider
  groqApiKey: string
  openaiApiKey: string
  groqModel: string
  openaiModel: string
}

/**
 * Load memory for a project path from disk and cache it in the store.
 * Called at session start so context is available immediately.
 */
async function loadAndCache(projectPath: string): Promise<void> {
  if (!projectPath) return
  try {
    const record = await window.api.agentMemoryLoad(projectPath)
    useAgentMemoryStore.getState().setMemory(projectPath, record)
  } catch (err) {
    console.error('[AgentMemory] load error:', err)
  }
}

/**
 * Extract learnings from an activity log and persist them.
 * Runs asynchronously after a session ends — never blocks.
 */
async function extractAndPersist(
  projectPath: string,
  activityLog: ActivityLogEntry[],
  cfg: ExtractionConfig
): Promise<void> {
  if (!projectPath || activityLog.length < 5) return

  const apiKey = cfg.provider === 'openai' ? cfg.openaiApiKey : cfg.groqApiKey
  const model = cfg.provider === 'openai' ? cfg.openaiModel : cfg.groqModel
  if (!apiKey) return

  // Use last 60 actionable entries to keep the prompt small
  const relevant = activityLog
    .filter((e) => ['input', 'decision', 'fast-path', 'error', 'permission', 'ready'].includes(e.type))
    .slice(-60)
    .map((e) => `[${e.type}] ${e.message}${e.detail ? ` | ${e.detail}` : ''}`)
    .join('\n')

  if (relevant.length < 50) return

  try {
    const response = await window.api.callLLMApi({
      provider: cfg.provider,
      apiKey,
      model,
      systemPrompt: EXTRACT_SYSTEM,
      userPrompt: `SESSION LOG:\n${relevant}\n\nExtract learnings as JSON:`,
      temperature: 0.1
    })

    if (!response.success || !response.content) return

    // Robustly extract a JSON array from the response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return

    let entries: { category: string; content: string; confidence: number }[]
    try {
      entries = JSON.parse(jsonMatch[0])
    } catch {
      return
    }

    for (const e of entries) {
      const category = e.category as AgentMemoryCategory
      const validCategories: AgentMemoryCategory[] = ['command', 'preference', 'pattern', 'failure', 'workflow']
      if (!validCategories.includes(category)) continue
      if (!e.content || typeof e.content !== 'string') continue
      if (typeof e.confidence !== 'number' || e.confidence < 0.6) continue

      await window.api.agentMemoryAddEntry(projectPath, {
        category,
        content: e.content.trim().slice(0, 200),
        confidence: Math.min(1, Math.max(0, e.confidence)),
        sessionCount: 1,
        source: 'auto'
      })
    }

    // Refresh the in-memory cache so the UI reflects new entries
    await loadAndCache(projectPath)
  } catch (err) {
    console.error('[AgentMemory] extraction error:', err)
  }
}

export function useAgentMemory() {
  const store = useAgentMemoryStore()

  const loadForProject = useCallback(async (projectPath: string) => {
    await loadAndCache(projectPath)
  }, [])

  /** Returns the formatted context string to inject into LLM prompts */
  const getInjectionContext = useCallback(
    (projectPath: string): string => {
      return store.getContext(projectPath)
    },
    [store]
  )

  /** Fire-and-forget: extract learnings after a session and persist them */
  const extractLearnings = useCallback(
    (projectPath: string, activityLog: ActivityLogEntry[], cfg: SuperAgentConfig) => {
      extractAndPersist(projectPath, activityLog, {
        provider: cfg.defaultProvider,
        groqApiKey: cfg.groqApiKey,
        openaiApiKey: cfg.openaiApiKey,
        groqModel: cfg.groqModel,
        openaiModel: cfg.openaiModel
      }).catch((err) => console.error('[AgentMemory] bg extraction failed:', err))
    },
    []
  )

  const addManualEntry = useCallback(
    async (projectPath: string, entry: Omit<AgentMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      await window.api.agentMemoryAddEntry(projectPath, entry)
      await loadAndCache(projectPath)
    },
    []
  )

  const deleteEntry = useCallback(async (projectPath: string, entryId: string) => {
    await window.api.agentMemoryDeleteEntry(projectPath, entryId)
    store.removeEntry(projectPath, entryId)
  }, [store])

  const clearProjectMemory = useCallback(async (projectPath: string) => {
    await window.api.agentMemoryClear(projectPath)
    store.clearProjectMemory(projectPath)
  }, [store])

  return {
    memories: store.memories,
    loadForProject,
    getInjectionContext,
    extractLearnings,
    addManualEntry,
    deleteEntry,
    clearProjectMemory
  }
}

// Re-export standalone helpers for use inside non-hook contexts (e.g. inside useCallback chains)
export { loadAndCache as loadMemoryForProject, extractAndPersist as extractMemoryLearnings }
