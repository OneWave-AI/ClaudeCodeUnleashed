import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join, normalize, resolve } from 'path'
import { homedir } from 'os'
import { createHash } from 'crypto'
import { SKILL_LIBRARY } from '../../shared/skillLibrary'
import type { ProjectSkillsRecord } from '../../shared/types'

const DATA_DIR = join(homedir(), '.claudecodeui', 'project-skills')

function hashProject(projectPath: string): string {
  return createHash('sha256').update(projectPath).digest('hex').slice(0, 16)
}

function recordPath(projectPath: string): string {
  return join(DATA_DIR, `${hashProject(projectPath)}.json`)
}

/** Sanitize a skill ID so it is safe to use as a file name. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()
}

/** Path to the .claude/commands/ directory inside a project. */
function commandsDir(projectPath: string): string {
  return join(projectPath, '.claude', 'commands')
}

/** Path to the command file for a given skill inside a project. */
function commandFilePath(projectPath: string, skillId: string): string {
  return join(commandsDir(projectPath), `${sanitizeId(skillId)}.md`)
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function loadRecord(projectPath: string): Promise<ProjectSkillsRecord> {
  const file = recordPath(projectPath)
  try {
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ProjectSkillsRecord>
    return {
      projectHash: parsed.projectHash ?? hashProject(projectPath),
      projectPath: parsed.projectPath ?? projectPath,
      activeSkillIds: Array.isArray(parsed.activeSkillIds) ? parsed.activeSkillIds : [],
      lastUpdated: parsed.lastUpdated ?? Date.now()
    }
  } catch {
    return {
      projectHash: hashProject(projectPath),
      projectPath,
      activeSkillIds: [],
      lastUpdated: Date.now()
    }
  }
}

async function saveRecord(record: ProjectSkillsRecord): Promise<void> {
  await ensureDataDir()
  const file = recordPath(record.projectPath)
  await fs.writeFile(file, JSON.stringify({ ...record, lastUpdated: Date.now() }, null, 2), 'utf-8')
}

/**
 * Write the skill's prompt to {projectPath}/.claude/commands/{skillId}.md
 * This makes it a native /skill-id slash command in Claude Code.
 */
async function writeCommandFile(projectPath: string, skillId: string): Promise<string> {
  const skill = SKILL_LIBRARY.find((s) => s.id === skillId)
  if (!skill) throw new Error(`Skill not found: ${skillId}`)

  // Ensure the project path is within something reasonable (not system root)
  const normalized = normalize(resolve(projectPath))
  if (normalized === '/' || normalized.length < 3) {
    throw new Error(`Invalid project path: ${projectPath}`)
  }

  const dir = commandsDir(projectPath)
  await fs.mkdir(dir, { recursive: true })

  const filePath = commandFilePath(projectPath, skillId)
  await fs.writeFile(filePath, skill.prompt, 'utf-8')
  return filePath
}

/**
 * Delete {projectPath}/.claude/commands/{skillId}.md
 */
async function deleteCommandFile(projectPath: string, skillId: string): Promise<void> {
  const filePath = commandFilePath(projectPath, skillId)
  try {
    await fs.unlink(filePath)
  } catch (err: unknown) {
    // File already gone — not an error
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

export function registerProjectSkillsHandlers(): void {
  // Load the skill activation record for a project
  ipcMain.handle('project-skills:load', async (_, projectPath: string) => {
    if (!projectPath) return { projectHash: '', projectPath: '', activeSkillIds: [], lastUpdated: 0 }
    return loadRecord(projectPath)
  })

  // Activate a skill: write command file + record selection
  ipcMain.handle('project-skills:activate', async (_, projectPath: string, skillId: string) => {
    try {
      if (!projectPath || !skillId) throw new Error('projectPath and skillId are required')

      const commandPath = await writeCommandFile(projectPath, skillId)

      const record = await loadRecord(projectPath)
      if (!record.activeSkillIds.includes(skillId)) {
        record.activeSkillIds.push(skillId)
      }
      await saveRecord(record)

      return { success: true, commandPath }
    } catch (err) {
      console.error('[ProjectSkills] activate error:', err)
      return { success: false, commandPath: '', error: String(err) }
    }
  })

  // Deactivate a skill: delete command file + remove from record
  ipcMain.handle('project-skills:deactivate', async (_, projectPath: string, skillId: string) => {
    try {
      if (!projectPath || !skillId) throw new Error('projectPath and skillId are required')

      await deleteCommandFile(projectPath, skillId)

      const record = await loadRecord(projectPath)
      record.activeSkillIds = record.activeSkillIds.filter((id) => id !== skillId)
      await saveRecord(record)

      return { success: true }
    } catch (err) {
      console.error('[ProjectSkills] deactivate error:', err)
      return { success: false, error: String(err) }
    }
  })

  // List all projects that have skill activations
  ipcMain.handle('project-skills:list', async () => {
    try {
      await ensureDataDir()
      const files = await fs.readdir(DATA_DIR)
      const results: { projectPath: string; skillCount: number; lastUpdated: number }[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await fs.readFile(join(DATA_DIR, file), 'utf-8')
          const record = JSON.parse(raw) as ProjectSkillsRecord
          results.push({
            projectPath: record.projectPath,
            skillCount: record.activeSkillIds.length,
            lastUpdated: record.lastUpdated
          })
        } catch {
          // Skip corrupted files
        }
      }

      return results
    } catch {
      return []
    }
  })
}
