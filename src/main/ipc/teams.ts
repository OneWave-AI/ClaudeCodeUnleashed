import { ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import * as fs from 'fs/promises'
import type { TeamConfig, TeamTask, TeamSummary } from '../../shared/types'

const TEAMS_DIR = join(homedir(), '.claude', 'teams')
const TASKS_DIR = join(homedir(), '.claude', 'tasks')

export function registerTeamHandlers(): void {
  // List all teams with summary info
  ipcMain.handle('teams-list', async (): Promise<TeamSummary[]> => {
    let entries
    try {
      entries = await fs.readdir(TEAMS_DIR, { withFileTypes: true })
    } catch {
      return []
    }

    const summaries: TeamSummary[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      try {
        const configPath = join(TEAMS_DIR, entry.name, 'config.json')
        const configData = await fs.readFile(configPath, 'utf-8')
        const config: TeamConfig = JSON.parse(configData)

        // Read tasks for this team
        const taskStats = { total: 0, completed: 0, inProgress: 0, pending: 0 }
        try {
          const tasksDir = join(TASKS_DIR, entry.name)
          const taskFiles = await fs.readdir(tasksDir)
          for (const taskFile of taskFiles) {
            if (!taskFile.endsWith('.json')) continue
            try {
              const taskData = await fs.readFile(join(tasksDir, taskFile), 'utf-8')
              const task: TeamTask = JSON.parse(taskData)
              taskStats.total++
              if (task.status === 'completed') taskStats.completed++
              else if (task.status === 'in_progress') taskStats.inProgress++
              else taskStats.pending++
            } catch { /* skip malformed task files */ }
          }
        } catch { /* no tasks dir */ }

        summaries.push({
          name: config.name || entry.name,
          description: config.description,
          createdAt: config.createdAt || 0,
          memberCount: config.members?.length || 0,
          taskStats
        })
      } catch { /* skip malformed team configs */ }
    }

    return summaries.sort((a, b) => b.createdAt - a.createdAt)
  })

  // Get a single team's full config
  ipcMain.handle('teams-get-config', async (_, name: string): Promise<TeamConfig | null> => {
    try {
      const configPath = join(TEAMS_DIR, name, 'config.json')
      const data = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  })

  // Get all tasks for a team
  ipcMain.handle('teams-get-tasks', async (_, name: string): Promise<TeamTask[]> => {
    const tasksDir = join(TASKS_DIR, name)
    let files
    try {
      files = await fs.readdir(tasksDir)
    } catch {
      return []
    }

    const tasks: TeamTask[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const data = await fs.readFile(join(tasksDir, file), 'utf-8')
        tasks.push(JSON.parse(data))
      } catch { /* skip malformed */ }
    }

    // Sort by ID numerically
    return tasks.sort((a, b) => {
      const numA = parseInt(a.id, 10)
      const numB = parseInt(b.id, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.id.localeCompare(b.id)
    })
  })

  // Delete a team (remove team dir + task dir)
  ipcMain.handle('teams-delete', async (_, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const teamDir = join(TEAMS_DIR, name)
      const taskDir = join(TASKS_DIR, name)

      try { await fs.rm(teamDir, { recursive: true }) } catch { /* may not exist */ }
      try { await fs.rm(taskDir, { recursive: true }) } catch { /* may not exist */ }

      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
