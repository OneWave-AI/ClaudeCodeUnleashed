import { create } from 'zustand'
import type { AgentMemoryRecord, AgentMemoryEntry, AgentMemoryCategory } from '../../shared/types'

interface AgentMemoryState {
  // projectPath -> loaded record (in-memory cache)
  memories: Map<string, AgentMemoryRecord>
  isLoading: boolean

  // Actions
  setMemory: (projectPath: string, record: AgentMemoryRecord) => void
  removeEntry: (projectPath: string, entryId: string) => void
  clearProjectMemory: (projectPath: string) => void

  // Selector: format loaded memory as a context string for LLM injection
  getContext: (projectPath: string) => string
}

const CATEGORY_LABELS: Record<AgentMemoryCategory, string> = {
  command: 'COMMANDS',
  preference: 'PREFERENCES',
  pattern: 'PATTERNS',
  failure: 'AVOID (previously failed)',
  workflow: 'WORKFLOW'
}

export const useAgentMemoryStore = create<AgentMemoryState>((set, get) => ({
  memories: new Map(),
  isLoading: false,

  setMemory: (projectPath, record) => {
    const memories = new Map(get().memories)
    memories.set(projectPath, record)
    set({ memories })
  },

  removeEntry: (projectPath, entryId) => {
    const memories = new Map(get().memories)
    const existing = memories.get(projectPath)
    if (existing) {
      memories.set(projectPath, {
        ...existing,
        entries: existing.entries.filter((e) => e.id !== entryId)
      })
      set({ memories })
    }
  },

  clearProjectMemory: (projectPath) => {
    const memories = new Map(get().memories)
    memories.delete(projectPath)
    set({ memories })
  },

  getContext: (projectPath) => {
    const record = get().memories.get(projectPath)
    if (!record || record.entries.length === 0) return ''

    // Group by category
    const grouped = new Map<AgentMemoryCategory, AgentMemoryEntry[]>()
    for (const entry of record.entries) {
      const list = grouped.get(entry.category) ?? []
      list.push(entry)
      grouped.set(entry.category, list)
    }

    const lines: string[] = [
      '=== PROJECT MEMORY (learned from previous sessions — follow these) ==='
    ]

    for (const [category, entries] of grouped) {
      lines.push(`\n${CATEGORY_LABELS[category]}:`)
      // Sort by confidence descending, cap at 5 per category
      entries
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .forEach((e) => lines.push(`  - ${e.content}`))
    }

    lines.push('=== END PROJECT MEMORY ===\n')
    return lines.join('\n')
  }
}))
