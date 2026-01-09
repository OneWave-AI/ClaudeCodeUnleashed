import { ipcMain, dialog, shell } from 'electron'
import * as fs from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Conversation, ConversationMessage, ConversationStats, ConversationExportOptions } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PINNED_FILE = join(CLAUDE_DIR, 'pinned-conversations.json')

interface PinnedConversations {
  [key: string]: boolean // key is `${projectDir}:${id}` where projectDir is the raw directory name
}

async function loadPinnedConversations(): Promise<PinnedConversations> {
  try {
    const content = await fs.readFile(PINNED_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function savePinnedConversations(pinned: PinnedConversations): Promise<void> {
  await fs.writeFile(PINNED_FILE, JSON.stringify(pinned, null, 2), 'utf-8')
}

// Convert project folder path to Claude's directory naming convention
// /Users/gabe/project-name -> -Users-gabe-project-name
function pathToProjectDir(projectFolder: string): string {
  // If it already looks like a raw directory name (starts with -), return as-is
  if (projectFolder.startsWith('-')) {
    return projectFolder
  }
  return projectFolder.replace(/\//g, '-')
}

// Get the pinned key for a conversation
// Uses raw directory name to ensure consistency
function getPinnedKey(id: string, projectDir: string): string {
  // Normalize to raw directory format
  const normalizedDir = projectDir.startsWith('-') ? projectDir : pathToProjectDir(projectDir)
  return `${normalizedDir}:${id}`
}

async function getConversationFilePath(id: string, projectFolder: string): Promise<string> {
  const projectDir = pathToProjectDir(projectFolder)
  const directPath = join(CLAUDE_DIR, 'projects', projectDir, `${id}.jsonl`)

  // Check if the file exists at the expected path
  try {
    await fs.access(directPath)
    return directPath
  } catch {
    // If not found, search for it across all project directories
    // This handles the ambiguity when projectFolder is a cwd path
    const projectsDir = join(CLAUDE_DIR, 'projects')
    const projectDirs = await fs.readdir(projectsDir).catch(() => [])

    for (const dir of projectDirs) {
      const filePath = join(projectsDir, dir, `${id}.jsonl`)
      try {
        await fs.access(filePath)
        return filePath
      } catch {
        continue
      }
    }

    // Fall back to original path (will throw error when accessed)
    return directPath
  }
}

interface ParsedConversation {
  messages: ConversationMessage[]
  stats: ConversationStats
  preview: string
  cwd?: string // The working directory from the conversation
}

async function parseConversationFile(filePath: string): Promise<ParsedConversation> {
  const fileStat = await fs.stat(filePath)

  // Handle empty files
  if (fileStat.size === 0) {
    return {
      messages: [],
      stats: {
        messageCount: 0,
        humanMessages: 0,
        assistantMessages: 0,
        duration: 0,
        estimatedTokens: 0,
        fileSize: 0
      },
      preview: ''
    }
  }

  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n').filter((line) => line.trim())

  const messages: ConversationMessage[] = []
  let humanMessages = 0
  let assistantMessages = 0
  let firstTimestamp: number | undefined
  let lastTimestamp: number | undefined
  let preview = ''
  let summaryPreview = ''
  let estimatedTokens = 0
  let cwd: string | undefined

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      const timestamp = parsed.timestamp ? new Date(parsed.timestamp).getTime() : undefined

      if (timestamp) {
        if (!firstTimestamp) firstTimestamp = timestamp
        lastTimestamp = timestamp
      }

      // Extract cwd from the first message that has it
      if (!cwd && parsed.cwd) {
        cwd = parsed.cwd
      }

      // Handle summary lines - can be used for preview
      if (parsed.type === 'summary' && parsed.summary && !summaryPreview) {
        summaryPreview = parsed.summary.slice(0, 150)
        continue
      }

      let messageType: 'human' | 'assistant' | 'system' = 'system'
      let messageContent = ''

      // Claude Code uses 'user' type for human messages (not 'human')
      if ((parsed.type === 'user' || parsed.type === 'human') && parsed.message?.content) {
        messageType = 'human'
        messageContent = typeof parsed.message.content === 'string'
          ? parsed.message.content
          : JSON.stringify(parsed.message.content)
        humanMessages++
        if (!preview) {
          preview = messageContent.slice(0, 150)
        }
      } else if (parsed.type === 'assistant' && parsed.message?.content) {
        messageType = 'assistant'
        if (Array.isArray(parsed.message.content)) {
          // Extract text blocks, skip thinking blocks
          messageContent = parsed.message.content
            .filter((block: { type: string }) => block.type === 'text')
            .map((block: { text: string }) => block.text)
            .join('\n')
        } else {
          messageContent = String(parsed.message.content)
        }
        // Only count assistant messages that have actual text content
        if (messageContent.trim()) {
          assistantMessages++
        }
      }

      if (messageContent.trim()) {
        // Rough token estimate: ~4 chars per token
        estimatedTokens += Math.ceil(messageContent.length / 4)
        messages.push({ type: messageType, content: messageContent, timestamp })
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  const duration = firstTimestamp && lastTimestamp ? lastTimestamp - firstTimestamp : 0

  // Use summary as preview if no user message preview available
  const finalPreview = preview || summaryPreview

  return {
    messages,
    stats: {
      messageCount: messages.length,
      humanMessages,
      assistantMessages,
      duration,
      estimatedTokens,
      fileSize: fileStat.size
    },
    preview: finalPreview,
    cwd
  }
}

export function registerConversationHandlers(): void {
  ipcMain.handle('list-conversations', async (): Promise<Conversation[]> => {
    const conversations: Conversation[] = []
    const pinnedConversations = await loadPinnedConversations()

    try {
      const projectsDir = join(CLAUDE_DIR, 'projects')
      const projectDirs = await fs.readdir(projectsDir).catch(() => [])

      for (const projectDir of projectDirs) {
        const projectPath = join(projectsDir, projectDir)
        const stat = await fs.stat(projectPath).catch(() => null)

        if (stat?.isDirectory()) {
          const files = await fs.readdir(projectPath).catch(() => [])
          // Only get JSONL files that look like UUIDs (main conversation files)
          // Skip agent-*.jsonl files which are subagent logs
          const jsonlFiles = files.filter((f) =>
            f.endsWith('.jsonl') && !f.startsWith('agent-')
          )

          for (const file of jsonlFiles) {
            const filePath = join(projectPath, file)
            const fileStat = await fs.stat(filePath).catch(() => null)

            if (fileStat) {
              const id = file.replace('.jsonl', '')
              // Use raw projectDir for pinned key to ensure consistency
              const pinnedKey = `${projectDir}:${id}`

              let preview = ''
              let stats: ConversationStats | undefined
              let projectFolder = projectDir // Default to raw directory name

              try {
                const parsed = await parseConversationFile(filePath)
                preview = parsed.preview
                stats = parsed.stats
                // Use the actual cwd from the conversation if available
                if (parsed.cwd) {
                  projectFolder = parsed.cwd
                }
              } catch {
                // Ignore parse errors
              }

              conversations.push({
                id,
                projectFolder,
                timestamp: fileStat.mtimeMs,
                preview: preview || undefined,
                pinned: pinnedConversations[pinnedKey] || false,
                stats
              })
            }
          }
        }
      }

      // Sort: pinned first, then by timestamp descending
      conversations.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.timestamp - a.timestamp
      })
    } catch (err) {
      console.error('Failed to list conversations:', err)
    }

    return conversations
  })

  ipcMain.handle(
    'get-conversation-preview',
    async (_, id: string, projectFolder: string): Promise<string> => {
      try {
        const filePath = await getConversationFilePath(id, projectFolder)
        const parsed = await parseConversationFile(filePath)
        return parsed.preview
      } catch {
        return ''
      }
    }
  )

  ipcMain.handle(
    'get-conversation-details',
    async (_, id: string, projectFolder: string): Promise<Conversation | null> => {
      try {
        const filePath = await getConversationFilePath(id, projectFolder)
        const fileStat = await fs.stat(filePath)
        const parsed = await parseConversationFile(filePath)
        const pinnedConversations = await loadPinnedConversations()
        const pinnedKey = getPinnedKey(id, projectFolder)

        return {
          id,
          projectFolder: parsed.cwd || projectFolder,
          timestamp: fileStat.mtimeMs,
          preview: parsed.preview,
          pinned: pinnedConversations[pinnedKey] || false,
          stats: parsed.stats
        }
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'get-conversation-messages',
    async (_, id: string, projectFolder: string, limit?: number): Promise<ConversationMessage[]> => {
      try {
        const filePath = await getConversationFilePath(id, projectFolder)
        const parsed = await parseConversationFile(filePath)
        return limit ? parsed.messages.slice(0, limit) : parsed.messages
      } catch {
        return []
      }
    }
  )

  ipcMain.handle(
    'delete-conversation',
    async (
      _,
      id: string,
      projectFolder: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const filePath = await getConversationFilePath(id, projectFolder)
        await fs.unlink(filePath)

        // Also remove from pinned if it was pinned
        const pinnedConversations = await loadPinnedConversations()
        const pinnedKey = getPinnedKey(id, projectFolder)
        if (pinnedConversations[pinnedKey]) {
          delete pinnedConversations[pinnedKey]
          await savePinnedConversations(pinnedConversations)
        }

        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete conversation'
        }
      }
    }
  )

  ipcMain.handle(
    'export-conversation',
    async (
      _,
      id: string,
      projectFolder: string,
      options?: ConversationExportOptions
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      try {
        const filePath = await getConversationFilePath(id, projectFolder)
        const parsed = await parseConversationFile(filePath)
        const fileStat = await fs.stat(filePath)

        // Use cwd if available for better project display
        const displayProject = parsed.cwd || projectFolder

        // Build markdown content
        let markdown = `# Conversation Export\n\n`
        markdown += `**Project:** ${displayProject}\n`
        markdown += `**Date:** ${new Date(fileStat.mtimeMs).toLocaleString()}\n`
        markdown += `**Conversation ID:** ${id}\n\n`

        if (options?.includeStats && parsed.stats) {
          markdown += `## Statistics\n\n`
          markdown += `- **Total Messages:** ${parsed.stats.messageCount}\n`
          markdown += `- **Human Messages:** ${parsed.stats.humanMessages}\n`
          markdown += `- **Assistant Messages:** ${parsed.stats.assistantMessages}\n`
          markdown += `- **Duration:** ${formatDuration(parsed.stats.duration)}\n`
          if (parsed.stats.estimatedTokens) {
            markdown += `- **Estimated Tokens:** ~${parsed.stats.estimatedTokens.toLocaleString()}\n`
          }
          markdown += `- **File Size:** ${formatFileSize(parsed.stats.fileSize)}\n`
          markdown += `\n`
        }

        markdown += `---\n\n## Conversation\n\n`

        for (const message of parsed.messages) {
          const role = message.type === 'human' ? 'Human' : message.type === 'assistant' ? 'Assistant' : 'System'
          const timestamp = options?.includeTimestamps && message.timestamp
            ? ` (${new Date(message.timestamp).toLocaleString()})`
            : ''

          markdown += `### ${role}${timestamp}\n\n`
          markdown += `${message.content}\n\n`
        }

        // Show save dialog
        const result = await dialog.showSaveDialog({
          title: 'Export Conversation',
          defaultPath: join(homedir(), 'Downloads', `conversation-${id.slice(0, 8)}.md`),
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' }
        }

        await fs.writeFile(result.filePath, markdown, 'utf-8')

        // Open the folder containing the file
        shell.showItemInFolder(result.filePath)

        return { success: true, path: result.filePath }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to export conversation'
        }
      }
    }
  )

  ipcMain.handle(
    'pin-conversation',
    async (
      _,
      id: string,
      projectFolder: string,
      pinned: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const pinnedConversations = await loadPinnedConversations()
        const pinnedKey = getPinnedKey(id, projectFolder)

        if (pinned) {
          pinnedConversations[pinnedKey] = true
        } else {
          delete pinnedConversations[pinnedKey]
        }

        await savePinnedConversations(pinnedConversations)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to pin conversation'
        }
      }
    }
  )

  ipcMain.handle(
    'search-conversations',
    async (_, query: string): Promise<Conversation[]> => {
      const conversations: Conversation[] = []
      const pinnedConversations = await loadPinnedConversations()
      const searchQuery = query.toLowerCase()

      try {
        const projectsDir = join(CLAUDE_DIR, 'projects')
        const projectDirs = await fs.readdir(projectsDir).catch(() => [])

        for (const projectDir of projectDirs) {
          const projectPath = join(projectsDir, projectDir)
          const stat = await fs.stat(projectPath).catch(() => null)

          if (stat?.isDirectory()) {
            const files = await fs.readdir(projectPath).catch(() => [])
            // Only get JSONL files that look like UUIDs (main conversation files)
            // Skip agent-*.jsonl files which are subagent logs
            const jsonlFiles = files.filter((f) =>
              f.endsWith('.jsonl') && !f.startsWith('agent-')
            )

            for (const file of jsonlFiles) {
              const filePath = join(projectPath, file)
              const fileStat = await fs.stat(filePath).catch(() => null)

              if (fileStat && fileStat.size > 0) {
                const id = file.replace('.jsonl', '')
                const pinnedKey = `${projectDir}:${id}`

                try {
                  const content = await fs.readFile(filePath, 'utf-8')
                  const parsed = await parseConversationFile(filePath)

                  // Get the actual project folder from cwd or use directory name
                  const projectFolder = parsed.cwd || projectDir

                  // Check if query matches project folder, content, or summary
                  if (
                    projectFolder.toLowerCase().includes(searchQuery) ||
                    content.toLowerCase().includes(searchQuery)
                  ) {
                    conversations.push({
                      id,
                      projectFolder,
                      timestamp: fileStat.mtimeMs,
                      preview: parsed.preview || undefined,
                      pinned: pinnedConversations[pinnedKey] || false,
                      stats: parsed.stats
                    })
                  }
                } catch {
                  // Skip files that can't be read
                }
              }
            }
          }
        }

        // Sort: pinned first, then by timestamp descending
        conversations.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.timestamp - a.timestamp
        })
      } catch (err) {
        console.error('Failed to search conversations:', err)
      }

      return conversations
    }
  )
}

function formatDuration(ms: number): string {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`
  } else if (ms < 3600000) {
    return `${Math.round(ms / 60000)}m`
  } else {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.round((ms % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
