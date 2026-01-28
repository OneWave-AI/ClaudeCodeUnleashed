import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join, extname, relative } from 'path'
import { existsSync } from 'fs'

// File type categories
const FILE_CATEGORIES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.json': 'JSON',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.html': 'HTML',
  '.md': 'Markdown',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++ Header',
  '.swift': 'Swift',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.svg': 'SVG',
  '.vue': 'Vue',
  '.svelte': 'Svelte'
}

// Directories to ignore
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '.cache', '.vscode', '.idea', '__pycache__', 'venv',
  '.env', 'target', 'vendor', 'bower_components'
])

// Files to ignore
const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.gitignore', '.npmignore', 'package-lock.json',
  'yarn.lock', 'pnpm-lock.yaml'
])

export interface FileNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  size: number
  extension?: string
  category?: string
  children?: FileNode[]
  lineCount?: number
}

export interface RepoStats {
  totalFiles: number
  totalDirectories: number
  totalSize: number
  totalLines: number
  filesByType: Record<string, { count: number; size: number; lines: number }>
  largestFiles: { path: string; size: number; lines: number }[]
  deepestPath: string
  maxDepth: number
}

export interface RepoAnalysis {
  tree: FileNode
  stats: RepoStats
  dependencies: {
    name: string
    version: string
    type: 'dependency' | 'devDependency'
  }[]
  structure: {
    hasPackageJson: boolean
    hasTsConfig: boolean
    hasGitIgnore: boolean
    hasReadme: boolean
    hasSrc: boolean
    hasTests: boolean
    framework?: string
  }
}

// Only count lines for smaller files to avoid hanging on large codebases
const MAX_FILE_SIZE_FOR_LINE_COUNT = 100 * 1024 // 100KB
const MAX_FILES_TO_ANALYZE = 5000 // Stop after this many files to prevent hanging

async function countLines(filePath: string, fileSize: number): Promise<number> {
  // Skip line counting for large files
  if (fileSize > MAX_FILE_SIZE_FOR_LINE_COUNT) {
    return 0
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

// Context object to track state across recursive calls
interface AnalysisContext {
  fileCount: number
  stopped: boolean
}

async function analyzeDirectory(
  dirPath: string,
  basePath: string,
  depth: number = 0,
  maxDepth: number = 10,
  context: AnalysisContext = { fileCount: 0, stopped: false }
): Promise<{ node: FileNode; stats: Partial<RepoStats> }> {
  const name = dirPath === basePath ? basePath.split('/').pop()! : dirPath.split('/').pop()!
  const relativePath = relative(basePath, dirPath) || '.'

  const node: FileNode = {
    name,
    path: dirPath,
    relativePath,
    type: 'directory',
    size: 0,
    children: []
  }

  const stats: Partial<RepoStats> = {
    totalFiles: 0,
    totalDirectories: 1,
    totalSize: 0,
    totalLines: 0,
    filesByType: {},
    largestFiles: [],
    deepestPath: relativePath,
    maxDepth: depth
  }

  if (depth >= maxDepth || context.stopped) {
    return { node, stats }
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      // Early exit if we've hit limits
      if (context.stopped) break

      const entryPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue
        // Skip symlinks to prevent infinite loops
        if (entry.isSymbolicLink()) continue

        const result = await analyzeDirectory(entryPath, basePath, depth + 1, maxDepth, context)
        node.children!.push(result.node)
        node.size += result.node.size

        stats.totalFiles! += result.stats.totalFiles || 0
        stats.totalDirectories! += result.stats.totalDirectories || 0
        stats.totalSize! += result.stats.totalSize || 0
        stats.totalLines! += result.stats.totalLines || 0

        // Merge file types
        for (const [type, data] of Object.entries(result.stats.filesByType || {})) {
          if (!stats.filesByType![type]) {
            stats.filesByType![type] = { count: 0, size: 0, lines: 0 }
          }
          stats.filesByType![type].count += data.count
          stats.filesByType![type].size += data.size
          stats.filesByType![type].lines += data.lines
        }

        // Merge largest files
        stats.largestFiles = [...stats.largestFiles!, ...(result.stats.largestFiles || [])]
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)

        if ((result.stats.maxDepth || 0) > stats.maxDepth!) {
          stats.maxDepth = result.stats.maxDepth
          stats.deepestPath = result.stats.deepestPath
        }
      } else if (entry.isFile()) {
        if (IGNORE_FILES.has(entry.name)) continue
        // Skip symlinks to prevent infinite loops
        if (entry.isSymbolicLink()) continue
        // Stop if we've hit the file limit
        if (context.fileCount >= MAX_FILES_TO_ANALYZE) {
          context.stopped = true
          break
        }
        context.fileCount++

        try {
          const fileStat = await fs.stat(entryPath)
          const ext = extname(entry.name).toLowerCase()
          const category = FILE_CATEGORIES[ext] || 'Other'
          const fileRelativePath = relative(basePath, entryPath)

          // Count lines for text files (only small files to avoid hanging)
          let lineCount = 0
          if (FILE_CATEGORIES[ext]) {
            lineCount = await countLines(entryPath, fileStat.size)
          }

          const fileNode: FileNode = {
            name: entry.name,
            path: entryPath,
            relativePath: fileRelativePath,
            type: 'file',
            size: fileStat.size,
            extension: ext,
            category,
            lineCount
          }

          node.children!.push(fileNode)
          node.size += fileStat.size

          stats.totalFiles! += 1
          stats.totalSize! += fileStat.size
          stats.totalLines! += lineCount

          if (!stats.filesByType![category]) {
            stats.filesByType![category] = { count: 0, size: 0, lines: 0 }
          }
          stats.filesByType![category].count += 1
          stats.filesByType![category].size += fileStat.size
          stats.filesByType![category].lines += lineCount

          stats.largestFiles!.push({
            path: fileRelativePath,
            size: fileStat.size,
            lines: lineCount
          })
          stats.largestFiles = stats.largestFiles!
            .sort((a, b) => b.size - a.size)
            .slice(0, 10)
        } catch {
          // Skip files we can't read
        }
      }
    }

    // Sort children: directories first, then by name
    node.children!.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  } catch {
    // Directory read failed
  }

  return { node, stats }
}

async function detectFramework(basePath: string): Promise<string | undefined> {
  const packageJsonPath = join(basePath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return undefined
  }

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }

    if (deps['next']) return 'Next.js'
    if (deps['nuxt']) return 'Nuxt'
    if (deps['@angular/core']) return 'Angular'
    if (deps['vue']) return 'Vue'
    if (deps['svelte']) return 'Svelte'
    if (deps['react']) return 'React'
    if (deps['electron']) return 'Electron'
    if (deps['express']) return 'Express'
    if (deps['fastify']) return 'Fastify'
    if (deps['koa']) return 'Koa'
    if (deps['nest']) return 'NestJS'

    return undefined
  } catch {
    return undefined
  }
}

async function getDependencies(basePath: string): Promise<RepoAnalysis['dependencies']> {
  const packageJsonPath = join(basePath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return []
  }

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    const dependencies: RepoAnalysis['dependencies'] = []

    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: 'dependency'
      })
    }

    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: 'devDependency'
      })
    }

    return dependencies.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function analyzeStructure(basePath: string): Promise<RepoAnalysis['structure']> {
  const structure: RepoAnalysis['structure'] = {
    hasPackageJson: existsSync(join(basePath, 'package.json')),
    hasTsConfig: existsSync(join(basePath, 'tsconfig.json')),
    hasGitIgnore: existsSync(join(basePath, '.gitignore')),
    hasReadme: existsSync(join(basePath, 'README.md')) || existsSync(join(basePath, 'readme.md')),
    hasSrc: existsSync(join(basePath, 'src')),
    hasTests: existsSync(join(basePath, 'tests')) || existsSync(join(basePath, '__tests__')) || existsSync(join(basePath, 'test')),
    framework: await detectFramework(basePath)
  }

  return structure
}

export function registerRepoAnalyzerHandlers(): void {
  ipcMain.handle('repo-analyze', async (_, basePath: string): Promise<RepoAnalysis> => {
    const { node, stats } = await analyzeDirectory(basePath, basePath)
    const dependencies = await getDependencies(basePath)
    const structure = await analyzeStructure(basePath)

    return {
      tree: node,
      stats: stats as RepoStats,
      dependencies,
      structure
    }
  })

  ipcMain.handle('repo-get-file-content', async (_, filePath: string): Promise<string> => {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return ''
    }
  })
}
