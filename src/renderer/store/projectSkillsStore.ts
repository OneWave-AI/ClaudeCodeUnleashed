import { create } from 'zustand'
import type { ProjectSkillsRecord } from '../../shared/types'
import { SKILL_LIBRARY } from '../../shared/skillLibrary'

interface ProjectSkillsState {
  // Cache: projectPath → record
  records: Map<string, ProjectSkillsRecord>

  // Setters
  setRecord: (record: ProjectSkillsRecord) => void
  removeSkill: (projectPath: string, skillId: string) => void

  // Derived helpers
  isActive: (projectPath: string, skillId: string) => boolean
  getActiveSkillIds: (projectPath: string) => string[]

  /**
   * Returns a concise context string for SuperAgent injection.
   * Lists the name + description of each active skill so the agent
   * knows which slash commands are available in this project.
   */
  getSkillContext: (projectPath: string) => string
}

export const useProjectSkillsStore = create<ProjectSkillsState>((set, get) => ({
  records: new Map(),

  setRecord: (record) =>
    set((state) => {
      const next = new Map(state.records)
      next.set(record.projectPath, record)
      return { records: next }
    }),

  removeSkill: (projectPath, skillId) =>
    set((state) => {
      const existing = state.records.get(projectPath)
      if (!existing) return state
      const next = new Map(state.records)
      next.set(projectPath, {
        ...existing,
        activeSkillIds: existing.activeSkillIds.filter((id) => id !== skillId),
        lastUpdated: Date.now()
      })
      return { records: next }
    }),

  isActive: (projectPath, skillId) => {
    const record = get().records.get(projectPath)
    return record?.activeSkillIds.includes(skillId) ?? false
  },

  getActiveSkillIds: (projectPath) => {
    return get().records.get(projectPath)?.activeSkillIds ?? []
  },

  getSkillContext: (projectPath) => {
    const record = get().records.get(projectPath)
    if (!record || record.activeSkillIds.length === 0) return ''

    const activeSkills = SKILL_LIBRARY.filter((s) => record.activeSkillIds.includes(s.id))
    if (activeSkills.length === 0) return ''

    const lines = activeSkills.map((s) => `  /${s.id} — ${s.name}: ${s.description}`)
    return [
      'AVAILABLE SKILLS (invoke with /skill-name):',
      ...lines,
      ''
    ].join('\n')
  }
}))
