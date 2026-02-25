import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

/**
 * Memory system that generates CLAUDE.md files compatible with Claude Code CLI
 *
 * File hierarchy (highest to lowest priority):
 * 1. Project memory: ./CLAUDE.md or ./.claude/CLAUDE.md
 * 2. Project rules: ./.claude/rules/*.md
 * 3. User memory: ~/.claude/CLAUDE.md
 * 4. Local memory: ./CLAUDE.local.md (gitignored, personal)
 */

// Memory categories that map to .claude/rules/ files
const MEMORY_CATEGORIES = {
  architecture: 'architecture.md',
  conventions: 'conventions.md',
  commands: 'commands.md',
  preferences: 'preferences.md',
  decisions: 'decisions.md',
  context: 'context.md'
} as const

type MemoryCategory = keyof typeof MEMORY_CATEGORIES

export interface MemorySection {
  category: MemoryCategory
  title: string
  items: string[]
}

export interface ProjectMemoryConfig {
  projectPath: string
  mainMemory: string // Content of CLAUDE.md
  rules: Record<MemoryCategory, string[]> // Content for each rules file
  localMemory: string // Content of CLAUDE.local.md
}

// Ensure directory exists
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch {
    // Directory may already exist
  }
}

// Get user memory path
function getUserMemoryPath(): string {
  return join(homedir(), '.claude', 'CLAUDE.md')
}

// Get project memory paths
function getProjectPaths(projectPath: string) {
  return {
    main: join(projectPath, 'CLAUDE.md'),
    altMain: join(projectPath, '.claude', 'CLAUDE.md'),
    local: join(projectPath, 'CLAUDE.local.md'),
    rulesDir: join(projectPath, '.claude', 'rules')
  }
}

// Read a file safely
async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

// Write file with directory creation
async function writeFileSafe(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath))
  await fs.writeFile(filePath, content, 'utf-8')
}

// Parse markdown sections from a CLAUDE.md file
function parseMarkdownSections(content: string): MemorySection[] {
  const sections: MemorySection[] = []
  const lines = content.split('\n')

  let currentCategory: MemoryCategory = 'context'
  let currentTitle = ''
  let currentItems: string[] = []

  const categoryMap: Record<string, MemoryCategory> = {
    'architecture': 'architecture',
    'project structure': 'architecture',
    'conventions': 'conventions',
    'code style': 'conventions',
    'coding standards': 'conventions',
    'commands': 'commands',
    'common commands': 'commands',
    'scripts': 'commands',
    'preferences': 'preferences',
    'user preferences': 'preferences',
    'decisions': 'decisions',
    'architectural decisions': 'decisions',
    'context': 'context',
    'project context': 'context',
    'overview': 'context'
  }

  for (const line of lines) {
    // Check for section headers
    const headerMatch = line.match(/^##?\s+(.+)$/)
    if (headerMatch) {
      // Save previous section
      if (currentItems.length > 0) {
        sections.push({
          category: currentCategory,
          title: currentTitle,
          items: currentItems
        })
      }

      currentTitle = headerMatch[1].trim()
      const lowerTitle = currentTitle.toLowerCase()
      currentCategory = categoryMap[lowerTitle] || 'context'
      currentItems = []
    }
    // Check for list items
    else if (line.match(/^[-*]\s+.+/)) {
      const item = line.replace(/^[-*]\s+/, '').trim()
      if (item) currentItems.push(item)
    }
    // Non-list content under a header
    else if (line.trim() && currentTitle && !line.startsWith('#')) {
      currentItems.push(line.trim())
    }
  }

  // Don't forget the last section
  if (currentItems.length > 0) {
    sections.push({
      category: currentCategory,
      title: currentTitle,
      items: currentItems
    })
  }

  return sections
}

// Generate markdown content from sections
function generateMarkdown(sections: MemorySection[], title?: string): string {
  const lines: string[] = []

  if (title) {
    lines.push(`# ${title}`, '')
  }

  for (const section of sections) {
    if (section.title) {
      lines.push(`## ${section.title}`, '')
    }
    for (const item of section.items) {
      // If it's a multi-line item or paragraph, don't bullet it
      if (item.includes('\n') || item.length > 200) {
        lines.push(item, '')
      } else {
        lines.push(`- ${item}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

// Generate a rules file content
function generateRulesFile(category: MemoryCategory, items: string[]): string {
  const titles: Record<MemoryCategory, string> = {
    architecture: 'Architecture & Structure',
    conventions: 'Code Conventions',
    commands: 'Common Commands',
    preferences: 'Preferences',
    decisions: 'Architectural Decisions',
    context: 'Project Context'
  }

  if (items.length === 0) return ''

  const lines = [
    `# ${titles[category]}`,
    '',
    ...items.map(item => `- ${item}`),
    ''
  ]

  return lines.join('\n')
}

export function registerMemoryHandlers(): void {

  // Get all memory for a project (reads CLAUDE.md files)
  ipcMain.handle('memory-list', async (_, projectPath: string): Promise<{
    main: MemorySection[]
    rules: Record<MemoryCategory, string[]>
    local: MemorySection[]
    user: MemorySection[]
  }> => {
    const paths = getProjectPaths(projectPath)

    // Read main project memory
    let mainContent = await readFileSafe(paths.main)
    if (!mainContent) {
      mainContent = await readFileSafe(paths.altMain)
    }

    // Read local memory
    const localContent = await readFileSafe(paths.local)

    // Read user memory
    const userContent = await readFileSafe(getUserMemoryPath())

    // Read rules files
    const rules: Record<MemoryCategory, string[]> = {
      architecture: [],
      conventions: [],
      commands: [],
      preferences: [],
      decisions: [],
      context: []
    }

    try {
      const rulesDir = paths.rulesDir
      if (existsSync(rulesDir)) {
        const files = await fs.readdir(rulesDir)
        for (const file of files) {
          if (!file.endsWith('.md')) continue
          const content = await readFileSafe(join(rulesDir, file))
          const sections = parseMarkdownSections(content)

          // Determine category from filename
          const baseName = file.replace('.md', '').toLowerCase()
          const category = (Object.keys(MEMORY_CATEGORIES) as MemoryCategory[])
            .find(c => MEMORY_CATEGORIES[c].replace('.md', '') === baseName)

          if (category) {
            for (const section of sections) {
              rules[category].push(...section.items)
            }
          }
        }
      }
    } catch {
      // Rules directory may not exist
    }

    return {
      main: parseMarkdownSections(mainContent),
      rules,
      local: parseMarkdownSections(localContent),
      user: parseMarkdownSections(userContent)
    }
  })

  // Get raw CLAUDE.md content
  ipcMain.handle('memory-get-raw', async (_, projectPath: string, type: 'main' | 'local' | 'user'): Promise<string> => {
    const paths = getProjectPaths(projectPath)

    switch (type) {
      case 'main': {
        let content = await readFileSafe(paths.main)
        if (!content) content = await readFileSafe(paths.altMain)
        return content
      }
      case 'local':
        return await readFileSafe(paths.local)
      case 'user':
        return await readFileSafe(getUserMemoryPath())
      default:
        return ''
    }
  })

  // Save raw CLAUDE.md content
  ipcMain.handle('memory-save-raw', async (_, projectPath: string, type: 'main' | 'local' | 'user', content: string): Promise<{ success: boolean }> => {
    const paths = getProjectPaths(projectPath)

    try {
      switch (type) {
        case 'main':
          // Prefer .claude/CLAUDE.md for new files
          await writeFileSafe(paths.altMain, content)
          break
        case 'local':
          await writeFileSafe(paths.local, content)
          // Add to .gitignore if not already there
          await ensureGitignore(projectPath, 'CLAUDE.local.md')
          break
        case 'user':
          await writeFileSafe(getUserMemoryPath(), content)
          break
      }
      return { success: true }
    } catch (err) {
      console.error('Failed to save memory:', err)
      return { success: false }
    }
  })

  // Add a memory item (appends to appropriate file)
  ipcMain.handle('memory-add', async (_, projectPath: string, item: {
    category: MemoryCategory
    content: string
    target: 'main' | 'local' | 'user' | 'rules'
  }): Promise<{ success: boolean }> => {
    const paths = getProjectPaths(projectPath)

    try {
      if (item.target === 'rules') {
        // Add to rules file
        const rulesFile = join(paths.rulesDir, MEMORY_CATEGORIES[item.category])
        let content = await readFileSafe(rulesFile)

        if (!content) {
          content = generateRulesFile(item.category, [item.content])
        } else {
          // Append to existing file
          content = content.trim() + '\n- ' + item.content + '\n'
        }

        await writeFileSafe(rulesFile, content)
      } else {
        // Add to CLAUDE.md file
        let filePath: string
        switch (item.target) {
          case 'main':
            filePath = existsSync(paths.main) ? paths.main : paths.altMain
            break
          case 'local':
            filePath = paths.local
            break
          case 'user':
            filePath = getUserMemoryPath()
            break
          default:
            return { success: false }
        }

        let content = await readFileSafe(filePath)

        // Find or create the appropriate section
        const sectionHeaders: Record<MemoryCategory, string> = {
          architecture: '## Architecture',
          conventions: '## Conventions',
          commands: '## Commands',
          preferences: '## Preferences',
          decisions: '## Decisions',
          context: '## Context'
        }

        const header = sectionHeaders[item.category]

        if (content.includes(header)) {
          // Append to existing section
          const headerIndex = content.indexOf(header)
          const nextHeaderIndex = content.indexOf('\n## ', headerIndex + 1)

          if (nextHeaderIndex === -1) {
            // Last section, append at end
            content = content.trim() + '\n- ' + item.content + '\n'
          } else {
            // Insert before next section
            content = content.slice(0, nextHeaderIndex) + '- ' + item.content + '\n\n' + content.slice(nextHeaderIndex)
          }
        } else {
          // Create new section
          content = content.trim() + '\n\n' + header + '\n\n- ' + item.content + '\n'
        }

        await writeFileSafe(filePath, content)

        if (item.target === 'local') {
          await ensureGitignore(projectPath, 'CLAUDE.local.md')
        }
      }

      return { success: true }
    } catch (err) {
      console.error('Failed to add memory:', err)
      return { success: false }
    }
  })

  // Initialize CLAUDE.md with common sections
  ipcMain.handle('memory-init', async (_, projectPath: string): Promise<{ success: boolean; path: string }> => {
    const paths = getProjectPaths(projectPath)

    // Check if already exists
    if (existsSync(paths.main) || existsSync(paths.altMain)) {
      return { success: true, path: existsSync(paths.main) ? paths.main : paths.altMain }
    }

    const template = `# Project Memory

## Context

- [Describe your project briefly]
- [Main technologies used]

## Architecture

- [Key architectural patterns]
- [Important directories/files]

## Conventions

- [Code style preferences]
- [Naming conventions]

## Commands

- [Common build/test commands]
- [Development workflow commands]

## Decisions

- [Key architectural decisions and why]
`

    await writeFileSafe(paths.altMain, template)

    return { success: true, path: paths.altMain }
  })

  // Check if memory files exist
  ipcMain.handle('memory-check', async (_, projectPath: string): Promise<{
    hasMain: boolean
    hasLocal: boolean
    hasUser: boolean
    hasRules: boolean
    mainPath: string | null
  }> => {
    const paths = getProjectPaths(projectPath)

    const hasMainDirect = existsSync(paths.main)
    const hasMainAlt = existsSync(paths.altMain)

    return {
      hasMain: hasMainDirect || hasMainAlt,
      hasLocal: existsSync(paths.local),
      hasUser: existsSync(getUserMemoryPath()),
      hasRules: existsSync(paths.rulesDir),
      mainPath: hasMainDirect ? paths.main : (hasMainAlt ? paths.altMain : null)
    }
  })

  // Open memory file in system editor
  ipcMain.handle('memory-open-editor', async (_, projectPath: string, type: 'main' | 'local' | 'user'): Promise<{ success: boolean; path: string }> => {
    const paths = getProjectPaths(projectPath)
    const { shell } = await import('electron')

    let filePath: string
    switch (type) {
      case 'main':
        filePath = existsSync(paths.main) ? paths.main : paths.altMain
        // Create if doesn't exist
        if (!existsSync(filePath)) {
          await writeFileSafe(paths.altMain, '# Project Memory\n\n')
          filePath = paths.altMain
        }
        break
      case 'local':
        filePath = paths.local
        if (!existsSync(filePath)) {
          await writeFileSafe(filePath, '# Local Memory (Personal, Not Committed)\n\n')
          await ensureGitignore(projectPath, 'CLAUDE.local.md')
        }
        break
      case 'user':
        filePath = getUserMemoryPath()
        if (!existsSync(filePath)) {
          await writeFileSafe(filePath, '# User Memory (All Projects)\n\n')
        }
        break
      default:
        return { success: false, path: '' }
    }

    shell.openPath(filePath)
    return { success: true, path: filePath }
  })

  // Get memory stats
  ipcMain.handle('memory-stats', async (_, projectPath: string): Promise<{
    hasMemory: boolean
    mainSize: number
    localSize: number
    userSize: number
    rulesCount: number
  }> => {
    const paths = getProjectPaths(projectPath)

    const getSize = async (path: string): Promise<number> => {
      try {
        const stat = await fs.stat(path)
        return stat.size
      } catch {
        return 0
      }
    }

    const mainSize = Math.max(
      await getSize(paths.main),
      await getSize(paths.altMain)
    )

    let rulesCount = 0
    try {
      if (existsSync(paths.rulesDir)) {
        const files = await fs.readdir(paths.rulesDir)
        rulesCount = files.filter(f => f.endsWith('.md')).length
      }
    } catch {
      // Rules dir may not exist
    }

    return {
      hasMemory: mainSize > 0 || existsSync(paths.local) || existsSync(getUserMemoryPath()),
      mainSize,
      localSize: await getSize(paths.local),
      userSize: await getSize(getUserMemoryPath()),
      rulesCount
    }
  })

  // Delete a memory file
  ipcMain.handle('memory-delete', async (_, projectPath: string, type: 'main' | 'local' | 'rules'): Promise<{ success: boolean }> => {
    const paths = getProjectPaths(projectPath)

    try {
      switch (type) {
        case 'main':
          if (existsSync(paths.main)) await fs.unlink(paths.main)
          if (existsSync(paths.altMain)) await fs.unlink(paths.altMain)
          break
        case 'local':
          if (existsSync(paths.local)) await fs.unlink(paths.local)
          break
        case 'rules':
          if (existsSync(paths.rulesDir)) {
            await fs.rm(paths.rulesDir, { recursive: true })
          }
          break
      }
      return { success: true }
    } catch (err) {
      console.error('Failed to delete memory:', err)
      return { success: false }
    }
  })

  // Legacy handlers for backward compatibility (map to new system)
  ipcMain.handle('memory-get-context', async (_, projectPath: string): Promise<string> => {
    const paths = getProjectPaths(projectPath)
    let content = await readFileSafe(paths.main)
    if (!content) content = await readFileSafe(paths.altMain)
    return content
  })

  ipcMain.handle('memory-set-global-context', async (_, projectPath: string, context: string): Promise<{ success: boolean }> => {
    const paths = getProjectPaths(projectPath)
    await writeFileSafe(paths.altMain, context)
    return { success: true }
  })

  ipcMain.handle('memory-get-global-context', async (_, projectPath: string): Promise<string> => {
    const paths = getProjectPaths(projectPath)
    let content = await readFileSafe(paths.main)
    if (!content) content = await readFileSafe(paths.altMain)
    return content
  })

  ipcMain.handle('memory-clear', async (_, projectPath: string): Promise<{ success: boolean }> => {
    const paths = getProjectPaths(projectPath)
    try {
      if (existsSync(paths.main)) await fs.unlink(paths.main)
      if (existsSync(paths.altMain)) await fs.unlink(paths.altMain)
      if (existsSync(paths.local)) await fs.unlink(paths.local)
      if (existsSync(paths.rulesDir)) {
        await fs.rm(paths.rulesDir, { recursive: true })
      }
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('memory-list-projects', async (): Promise<{ projectPath: string; hasMemory: boolean }[]> => {
    // This is harder to implement without a central registry
    // For now, return empty - UI can track recently opened projects
    return []
  })

  // Write session context to .claude/rules/session-context.md
  ipcMain.handle('write-session-context', async (_, projectPath: string, content: string): Promise<{ success: boolean }> => {
    try {
      const rulesDir = join(projectPath, '.claude', 'rules')
      await ensureDir(rulesDir)
      const filePath = join(rulesDir, 'session-context.md')
      await fs.writeFile(filePath, content, 'utf-8')

      // Ensure session-context.md is gitignored (check if a broader rule already covers it)
      const gitignorePath = join(projectPath, '.gitignore')
      try {
        let gitContent = ''
        if (existsSync(gitignorePath)) {
          gitContent = await fs.readFile(gitignorePath, 'utf-8')
        }
        const ignoreTarget = '.claude/rules/session-context.md'
        // Check for exact match or broader rules that already cover this file
        const gitLines = gitContent.split('\n').map(l => l.trim())
        const alreadyCovered = gitLines.some(line =>
          !line.startsWith('#') && line.length > 0 && (
            line === ignoreTarget ||
            line === '.claude/' ||
            line === '.claude/rules/' ||
            line === '.claude/rules/*'
          )
        )
        if (!alreadyCovered) {
          const newContent = gitContent.trim() + '\n\n# Claude Code session context\n' + ignoreTarget + '\n'
          await fs.writeFile(gitignorePath, newContent, 'utf-8')
        }
      } catch {
        // Ignore errors with .gitignore
      }

      return { success: true }
    } catch (err) {
      console.error('Failed to write session context:', err)
      return { success: false }
    }
  })

  // Keep legacy handlers that aren't used anymore as no-ops
  ipcMain.handle('memory-update', async (): Promise<null> => null)
  ipcMain.handle('memory-search', async (): Promise<[]> => [])
  ipcMain.handle('memory-import-from-conversation', async (): Promise<[]> => [])
}

// Helper to ensure CLAUDE.local.md is in .gitignore
async function ensureGitignore(projectPath: string, filename: string): Promise<void> {
  const gitignorePath = join(projectPath, '.gitignore')

  try {
    let content = ''
    if (existsSync(gitignorePath)) {
      content = await fs.readFile(gitignorePath, 'utf-8')
    }

    if (!content.includes(filename)) {
      const newContent = content.trim() + '\n\n# Claude Code local memory\n' + filename + '\n'
      await fs.writeFile(gitignorePath, newContent, 'utf-8')
    }
  } catch {
    // Ignore errors with .gitignore
  }
}
