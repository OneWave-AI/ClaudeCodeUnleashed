import { useCallback } from 'react'
import { useProjectSkillsStore } from '../store/projectSkillsStore'

/**
 * Hook for managing project skill activations.
 * Provides load, activate, and deactivate operations that
 * eagerly write/delete .claude/commands/{skill}.md files.
 */
export function useProjectSkills(projectPath: string) {
  const store = useProjectSkillsStore()

  const load = useCallback(async () => {
    if (!projectPath) return
    const record = await window.api.projectSkillsLoad(projectPath)
    store.setRecord(record)
  }, [projectPath, store])

  const activate = useCallback(
    async (skillId: string) => {
      if (!projectPath || !skillId) return false

      // Optimistic update
      const existing = store.records.get(projectPath) ?? {
        projectHash: '',
        projectPath,
        activeSkillIds: [],
        lastUpdated: Date.now()
      }
      store.setRecord({
        ...existing,
        activeSkillIds: existing.activeSkillIds.includes(skillId)
          ? existing.activeSkillIds
          : [...existing.activeSkillIds, skillId],
        lastUpdated: Date.now()
      })

      // Persist + write command file
      const result = await window.api.projectSkillsActivate(projectPath, skillId)
      if (!result.success) {
        // Rollback
        store.setRecord(existing)
        console.error('[ProjectSkills] activate failed:', skillId)
      }
      return result.success
    },
    [projectPath, store]
  )

  const deactivate = useCallback(
    async (skillId: string) => {
      if (!projectPath || !skillId) return false

      // Optimistic update
      store.removeSkill(projectPath, skillId)

      // Persist + delete command file
      const result = await window.api.projectSkillsDeactivate(projectPath, skillId)
      if (!result.success) {
        // Reload to reconcile
        await load()
        console.error('[ProjectSkills] deactivate failed:', skillId)
      }
      return result.success
    },
    [projectPath, store, load]
  )

  const toggle = useCallback(
    async (skillId: string) => {
      const isCurrentlyActive = store.isActive(projectPath, skillId)
      if (isCurrentlyActive) {
        return deactivate(skillId)
      } else {
        return activate(skillId)
      }
    },
    [projectPath, store, activate, deactivate]
  )

  return {
    activeSkillIds: store.getActiveSkillIds(projectPath),
    isActive: (skillId: string) => store.isActive(projectPath, skillId),
    load,
    activate,
    deactivate,
    toggle
  }
}

/**
 * Standalone function for non-hook contexts (e.g. SuperAgent before session).
 * Returns the skill context string for injection into system prompts.
 */
export function getProjectSkillContext(projectPath: string): string {
  return useProjectSkillsStore.getState().getSkillContext(projectPath)
}
