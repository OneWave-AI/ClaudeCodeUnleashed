import { ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import * as fs from 'fs/promises'
import { createHash } from 'crypto'
import type { AgentMemoryRecord, AgentMemoryEntry } from '../../shared/types'

const MEMORY_DIR = join(homedir(), '.claudecodeui', 'agent-memory')

function projectHash(projectPath: string): string {
  return createHash('sha256').update(projectPath).digest('hex').slice(0, 16)
}

function memoryFilePath(projectPath: string): string {
  return join(MEMORY_DIR, `${projectHash(projectPath)}.json`)
}

async function ensureMemoryDir(): Promise<void> {
  await fs.mkdir(MEMORY_DIR, { recursive: true })
}

async function loadMemoryRecord(projectPath: string): Promise<AgentMemoryRecord> {
  try {
    const data = await fs.readFile(memoryFilePath(projectPath), 'utf-8')
    const parsed = JSON.parse(data) as AgentMemoryRecord
    // Sanitise: ensure entries is always an array
    if (!Array.isArray(parsed.entries)) parsed.entries = []
    return parsed
  } catch {
    return {
      projectHash: projectHash(projectPath),
      projectPath,
      entries: [],
      lastUpdated: Date.now()
    }
  }
}

async function persistMemoryRecord(record: AgentMemoryRecord): Promise<void> {
  await ensureMemoryDir()
  // Cap at 200 entries — keep highest-confidence ones to prevent unbounded growth
  if (record.entries.length > 200) {
    record.entries = record.entries
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 200)
  }
  const filePath = memoryFilePath(record.projectPath)
  await fs.writeFile(filePath, JSON.stringify({ ...record, lastUpdated: Date.now() }, null, 2), 'utf-8')
}

function generateEntryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function registerAgentMemoryHandlers(): void {
  // Load full memory record for a project
  ipcMain.handle('agent-memory:load', async (_, projectPath: string): Promise<AgentMemoryRecord> => {
    if (!projectPath || typeof projectPath !== 'string') {
      return { projectHash: '', projectPath: '', entries: [], lastUpdated: 0 }
    }
    return loadMemoryRecord(projectPath)
  })

  // Save (replace) a full memory record
  ipcMain.handle(
    'agent-memory:save',
    async (_, record: AgentMemoryRecord): Promise<{ success: boolean }> => {
      try {
        if (!record?.projectPath) return { success: false }
        await persistMemoryRecord(record)
        return { success: true }
      } catch (err) {
        console.error('[AgentMemory] save error:', err)
        return { success: false }
      }
    }
  )

  // Add a single new entry
  ipcMain.handle(
    'agent-memory:addEntry',
    async (
      _,
      projectPath: string,
      entry: Omit<AgentMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<{ success: boolean }> => {
      try {
        if (!projectPath || !entry?.content) return { success: false }
        const record = await loadMemoryRecord(projectPath)
        const now = Date.now()
        record.entries.push({ ...entry, id: generateEntryId(), createdAt: now, updatedAt: now })
        await persistMemoryRecord(record)
        return { success: true }
      } catch (err) {
        console.error('[AgentMemory] addEntry error:', err)
        return { success: false }
      }
    }
  )

  // Delete a single entry by id
  ipcMain.handle(
    'agent-memory:deleteEntry',
    async (_, projectPath: string, entryId: string): Promise<{ success: boolean }> => {
      try {
        if (!projectPath || !entryId) return { success: false }
        const record = await loadMemoryRecord(projectPath)
        record.entries = record.entries.filter((e) => e.id !== entryId)
        await persistMemoryRecord(record)
        return { success: true }
      } catch (err) {
        console.error('[AgentMemory] deleteEntry error:', err)
        return { success: false }
      }
    }
  )

  // Clear all memory for a project
  ipcMain.handle(
    'agent-memory:clear',
    async (_, projectPath: string): Promise<{ success: boolean }> => {
      try {
        if (!projectPath) return { success: false }
        await fs.unlink(memoryFilePath(projectPath)).catch(() => {
          // File may not exist — that's fine
        })
        return { success: true }
      } catch (err) {
        console.error('[AgentMemory] clear error:', err)
        return { success: false }
      }
    }
  )

  // List all projects that have saved memory
  ipcMain.handle(
    'agent-memory:listProjects',
    async (): Promise<{ projectPath: string; entryCount: number; lastUpdated: number }[]> => {
      try {
        await ensureMemoryDir()
        const files = await fs.readdir(MEMORY_DIR)
        const results = await Promise.all(
          files
            .filter((f) => f.endsWith('.json'))
            .map(async (f) => {
              try {
                const raw = await fs.readFile(join(MEMORY_DIR, f), 'utf-8')
                const record: AgentMemoryRecord = JSON.parse(raw)
                return {
                  projectPath: record.projectPath,
                  entryCount: Array.isArray(record.entries) ? record.entries.length : 0,
                  lastUpdated: record.lastUpdated ?? 0
                }
              } catch {
                return null
              }
            })
        )
        return results.filter(Boolean) as { projectPath: string; entryCount: number; lastUpdated: number }[]
      } catch {
        return []
      }
    }
  )
}
