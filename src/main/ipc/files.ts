import { ipcMain, shell, clipboard, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import { watch, FSWatcher } from 'fs'
import { join, basename, dirname, resolve, normalize } from 'path'
import { getCwd } from './terminal'

// Active file watchers for live reload
const fileWatchers = new Map<string, FSWatcher>()

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modified?: number
}

interface FileStats {
  size: number
  modified: number
  created: number
  isDirectory: boolean
}

interface FileResult {
  success: boolean
  error?: string
  path?: string
  newPath?: string
}

// Invalid characters for file/folder names (cross-platform)
const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

// Track last opened file to prevent spam-opening
let lastOpenedFile: { path: string; time: number } | null = null

/**
 * Validates a file or folder name
 * Returns null if valid, error message if invalid
 */
function validateName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Name cannot be empty'
  }
  if (name !== name.trim()) {
    return 'Name cannot start or end with whitespace'
  }
  if (name === '.' || name === '..') {
    return 'Name cannot be "." or ".."'
  }
  if (INVALID_NAME_CHARS.test(name)) {
    return 'Name contains invalid characters'
  }
  if (RESERVED_NAMES.test(name.split('.')[0])) {
    return 'Name is a reserved system name'
  }
  if (name.length > 255) {
    return 'Name is too long (max 255 characters)'
  }
  return null
}

/**
 * Safely resolves a path and ensures it's within an allowed base directory
 * Returns null if path is invalid or escapes the base directory
 */
function safePath(targetPath: string, baseDir?: string): string | null {
  try {
    const resolved = resolve(normalize(targetPath))
    if (baseDir) {
      const resolvedBase = resolve(normalize(baseDir))
      // Ensure the resolved path starts with the base directory
      if (!resolved.startsWith(resolvedBase + '/') && resolved !== resolvedBase) {
        return null
      }
    }
    return resolved
  } catch {
    return null
  }
}

/**
 * Safely joins paths and validates the result is within the parent directory
 */
function safeJoin(parentPath: string, childName: string): string | null {
  const nameError = validateName(childName)
  if (nameError) {
    return null
  }
  const parent = safePath(parentPath)
  if (!parent) {
    return null
  }
  const joined = join(parent, childName)
  // Verify the joined path is actually within parent
  if (!joined.startsWith(parent + '/') && joined !== parent) {
    return null
  }
  return joined
}

export function registerFileHandlers(): void {
  ipcMain.handle('list-directory', async (_, dirPath: string): Promise<FileNode[]> => {
    const resolvedPath = safePath(dirPath)
    if (!resolvedPath) {
      console.error('Invalid directory path:', dirPath)
      return []
    }

    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
      const files: FileNode[] = []

      for (const entry of entries) {
        // Skip hidden files
        if (entry.name.startsWith('.')) continue

        const fullPath = join(resolvedPath, entry.name)
        const isDirectory = entry.isDirectory()

        try {
          const stats = await fs.stat(fullPath)
          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory,
            size: stats.size,
            modified: stats.mtimeMs
          })
        } catch {
          // Skip files we can't stat (permission issues, broken symlinks, etc.)
        }
      }

      // Sort: directories first, then alphabetically
      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error('Error listing directory:', error)
      return []
    }
  })

  ipcMain.handle('read-file', async (_, filePath: string): Promise<string> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      throw new Error('Invalid file path')
    }

    try {
      // Verify it's a file, not a directory
      const stats = await fs.stat(resolvedPath)
      if (stats.isDirectory()) {
        throw new Error('Cannot read a directory as a file')
      }
      return await fs.readFile(resolvedPath, 'utf-8')
    } catch (error) {
      console.error('Error reading file:', error)
      throw error
    }
  })

  ipcMain.handle('copy-files', async (_, paths: string[]): Promise<string[]> => {
    const contents: string[] = []
    const validPaths: string[] = []

    for (const filePath of paths) {
      const resolvedPath = safePath(filePath)
      if (!resolvedPath) continue

      try {
        const stats = await fs.stat(resolvedPath)
        if (stats.isDirectory()) continue

        const content = await fs.readFile(resolvedPath, 'utf-8')
        contents.push(`// ${basename(resolvedPath)}\n${content}`)
        validPaths.push(resolvedPath)
      } catch {
        // Skip unreadable files
      }
    }

    const combined = contents.join('\n\n')
    clipboard.writeText(combined)
    return validPaths
  })

  ipcMain.handle('open-file-external', async (_, filePath: string): Promise<FileResult> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      return { success: false, error: 'Invalid file path' }
    }

    // Debounce: prevent opening same file within 1 second
    const now = Date.now()
    if (lastOpenedFile && lastOpenedFile.path === resolvedPath && now - lastOpenedFile.time < 1000) {
      return { success: true, path: resolvedPath } // Skip duplicate but return success
    }
    lastOpenedFile = { path: resolvedPath, time: now }

    try {
      // Verify the file exists
      await fs.access(resolvedPath)
      const errorMessage = await shell.openPath(resolvedPath)
      if (errorMessage) {
        return { success: false, error: errorMessage }
      }
      return { success: true, path: resolvedPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('show-in-finder', async (_, filePath: string): Promise<FileResult> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      return { success: false, error: 'Invalid file path' }
    }

    try {
      // Verify the file exists
      await fs.access(resolvedPath)
      shell.showItemInFolder(resolvedPath)
      return { success: true, path: resolvedPath }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('list-files', async () => {
    const cwd = getCwd()
    return listDirectoryRecursive(cwd, 3)
  })

  // List directory with option to show hidden files
  ipcMain.handle(
    'list-directory-full',
    async (_, dirPath: string, showHidden: boolean): Promise<FileNode[]> => {
      const resolvedPath = safePath(dirPath)
      if (!resolvedPath) {
        console.error('Invalid directory path:', dirPath)
        return []
      }

      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
        const files: FileNode[] = []

        for (const entry of entries) {
          // Skip hidden files unless showHidden is true
          if (!showHidden && entry.name.startsWith('.')) continue

          const fullPath = join(resolvedPath, entry.name)
          const isDirectory = entry.isDirectory()

          try {
            const stats = await fs.stat(fullPath)
            files.push({
              name: entry.name,
              path: fullPath,
              isDirectory,
              size: stats.size,
              modified: stats.mtimeMs
            })
          } catch {
            // Skip files we can't stat (permission issues, broken symlinks, etc.)
          }
        }

        // Sort: directories first, then alphabetically
        return files.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
      } catch (error) {
        console.error('Error listing directory:', error)
        return []
      }
    }
  )

  // Get file/folder stats
  ipcMain.handle('get-file-stats', async (_, filePath: string): Promise<FileStats | null> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      console.error('Invalid file path:', filePath)
      return null
    }

    try {
      const stats = await fs.stat(resolvedPath)
      return {
        size: stats.size,
        modified: stats.mtimeMs,
        created: stats.birthtimeMs,
        isDirectory: stats.isDirectory()
      }
    } catch (error) {
      console.error('Error getting file stats:', error)
      return null
    }
  })

  // Rename file/folder
  ipcMain.handle(
    'rename-file',
    async (_, oldPath: string, newName: string): Promise<FileResult> => {
      // Validate the new name
      const nameError = validateName(newName)
      if (nameError) {
        return { success: false, error: nameError }
      }

      // Validate and resolve the old path
      const resolvedOldPath = safePath(oldPath)
      if (!resolvedOldPath) {
        return { success: false, error: 'Invalid source path' }
      }

      // Create and validate the new path
      const dir = dirname(resolvedOldPath)
      const newPath = safeJoin(dir, newName)
      if (!newPath) {
        return { success: false, error: 'Invalid target name' }
      }

      try {
        // Verify source exists
        await fs.access(resolvedOldPath)

        // Check if target already exists
        try {
          await fs.access(newPath)
          return { success: false, error: 'A file or folder with that name already exists' }
        } catch {
          // Target doesn't exist, we can proceed
        }

        await fs.rename(resolvedOldPath, newPath)
        return { success: true, newPath }
      } catch (error) {
        console.error('Error renaming file:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // Create new file
  ipcMain.handle(
    'create-file',
    async (_, parentPath: string, fileName: string): Promise<FileResult> => {
      // Validate the file name
      const nameError = validateName(fileName)
      if (nameError) {
        return { success: false, error: nameError }
      }

      // Validate and resolve the parent path
      const resolvedParent = safePath(parentPath)
      if (!resolvedParent) {
        return { success: false, error: 'Invalid parent directory path' }
      }

      // Create and validate the full file path
      const filePath = safeJoin(resolvedParent, fileName)
      if (!filePath) {
        return { success: false, error: 'Invalid file name' }
      }

      try {
        // Verify parent directory exists and is a directory
        const parentStats = await fs.stat(resolvedParent)
        if (!parentStats.isDirectory()) {
          return { success: false, error: 'Parent path is not a directory' }
        }

        // Check if file already exists
        try {
          await fs.access(filePath)
          return { success: false, error: 'A file with that name already exists' }
        } catch {
          // File doesn't exist, we can proceed
        }

        // Use exclusive flag to ensure atomic creation
        await fs.writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
        return { success: true, path: filePath }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code === 'EEXIST') {
          return { success: false, error: 'A file with that name already exists' }
        }
        console.error('Error creating file:', error)
        return { success: false, error: err.message }
      }
    }
  )

  // Create new folder
  ipcMain.handle(
    'create-folder',
    async (_, parentPath: string, folderName: string): Promise<FileResult> => {
      // Validate the folder name
      const nameError = validateName(folderName)
      if (nameError) {
        return { success: false, error: nameError }
      }

      // Validate and resolve the parent path
      const resolvedParent = safePath(parentPath)
      if (!resolvedParent) {
        return { success: false, error: 'Invalid parent directory path' }
      }

      // Create and validate the full folder path
      const folderPath = safeJoin(resolvedParent, folderName)
      if (!folderPath) {
        return { success: false, error: 'Invalid folder name' }
      }

      try {
        // Verify parent directory exists and is a directory
        const parentStats = await fs.stat(resolvedParent)
        if (!parentStats.isDirectory()) {
          return { success: false, error: 'Parent path is not a directory' }
        }

        // Check if folder already exists
        try {
          await fs.access(folderPath)
          return { success: false, error: 'A folder with that name already exists' }
        } catch {
          // Folder doesn't exist, we can proceed
        }

        // Don't use recursive: true to prevent creating unintended directories
        await fs.mkdir(folderPath, { recursive: false })
        return { success: true, path: folderPath }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code === 'EEXIST') {
          return { success: false, error: 'A folder with that name already exists' }
        }
        console.error('Error creating folder:', error)
        return { success: false, error: err.message }
      }
    }
  )

  // Delete file/folder
  ipcMain.handle(
    'delete-file',
    async (_, filePath: string): Promise<FileResult> => {
      // Validate and resolve the path
      const resolvedPath = safePath(filePath)
      if (!resolvedPath) {
        return { success: false, error: 'Invalid file path' }
      }

      // Prevent deletion of root or system-critical paths
      const criticalPaths = ['/', '/usr', '/bin', '/etc', '/var', '/System', '/Applications']
      if (criticalPaths.includes(resolvedPath)) {
        return { success: false, error: 'Cannot delete system-critical paths' }
      }

      try {
        // Use lstat to get info without following symlinks
        const stats = await fs.lstat(resolvedPath)

        if (stats.isSymbolicLink()) {
          // For symlinks, just remove the link itself
          await fs.unlink(resolvedPath)
        } else if (stats.isDirectory()) {
          await fs.rm(resolvedPath, { recursive: true })
        } else {
          await fs.unlink(resolvedPath)
        }
        return { success: true, path: resolvedPath }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code === 'ENOENT') {
          return { success: false, error: 'File or folder does not exist' }
        }
        if (err.code === 'EACCES' || err.code === 'EPERM') {
          return { success: false, error: 'Permission denied' }
        }
        console.error('Error deleting file:', error)
        return { success: false, error: err.message }
      }
    }
  )

  // Move file/folder (for drag and drop)
  ipcMain.handle(
    'move-file',
    async (_, sourcePath: string, targetDir: string): Promise<FileResult> => {
      // Validate and resolve the source path
      const resolvedSource = safePath(sourcePath)
      if (!resolvedSource) {
        return { success: false, error: 'Invalid source path' }
      }

      // Validate and resolve the target directory
      const resolvedTarget = safePath(targetDir)
      if (!resolvedTarget) {
        return { success: false, error: 'Invalid target directory path' }
      }

      // Get the file name and create the new path
      const fileName = basename(resolvedSource)
      const newPath = safeJoin(resolvedTarget, fileName)
      if (!newPath) {
        return { success: false, error: 'Invalid target path' }
      }

      // Prevent moving a directory into itself
      if (resolvedTarget.startsWith(resolvedSource + '/')) {
        return { success: false, error: 'Cannot move a folder into itself' }
      }

      try {
        // Verify source exists
        await fs.access(resolvedSource)

        // Verify target is a directory
        const targetStats = await fs.stat(resolvedTarget)
        if (!targetStats.isDirectory()) {
          return { success: false, error: 'Target path is not a directory' }
        }

        // Check if target already exists
        try {
          await fs.access(newPath)
          return { success: false, error: 'A file or folder with that name already exists in the target directory' }
        } catch {
          // Target doesn't exist, we can proceed
        }

        await fs.rename(resolvedSource, newPath)
        return { success: true, newPath }
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code === 'EXDEV') {
          // Cross-device move - would need copy + delete, not supported for now
          return { success: false, error: 'Cannot move across different drives' }
        }
        console.error('Error moving file:', error)
        return { success: false, error: err.message }
      }
    }
  )

  // Watch file for changes (live reload)
  ipcMain.handle('watch-file', async (event, filePath: string): Promise<boolean> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      return false
    }

    // Clean up existing watcher for this file
    const existingWatcher = fileWatchers.get(resolvedPath)
    if (existingWatcher) {
      existingWatcher.close()
      fileWatchers.delete(resolvedPath)
    }

    try {
      // Verify file exists
      await fs.access(resolvedPath)

      const watcher = watch(resolvedPath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          const window = BrowserWindow.fromWebContents(event.sender)
          window?.webContents.send('file-changed', resolvedPath)
        }
      })

      watcher.on('error', () => {
        watcher.close()
        fileWatchers.delete(resolvedPath)
      })

      fileWatchers.set(resolvedPath, watcher)
      return true
    } catch {
      return false
    }
  })

  // Stop watching a file
  ipcMain.handle('unwatch-file', async (_, filePath: string): Promise<boolean> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      return false
    }

    const watcher = fileWatchers.get(resolvedPath)
    if (watcher) {
      watcher.close()
      fileWatchers.delete(resolvedPath)
      return true
    }
    return false
  })

  // Check if file exists
  ipcMain.handle('file-exists', async (_, filePath: string): Promise<boolean> => {
    const resolvedPath = safePath(filePath)
    if (!resolvedPath) {
      return false
    }

    try {
      await fs.access(resolvedPath)
      return true
    } catch {
      return false
    }
  })
}

async function listDirectoryRecursive(
  dir: string,
  maxDepth: number,
  currentDepth = 0
): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return []

  // Only validate at root level - child paths are already validated through join
  const resolvedDir = currentDepth === 0 ? safePath(dir) : dir
  if (!resolvedDir) return []

  try {
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true })
    const files: FileNode[] = []

    // Directories to skip for performance and safety
    const skipDirs = new Set(['node_modules', 'dist', 'build', 'out', '.git', '__pycache__', 'venv'])

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (skipDirs.has(entry.name)) continue

      const fullPath = join(resolvedDir, entry.name)
      const isDirectory = entry.isDirectory()

      files.push({
        name: entry.name,
        path: fullPath,
        isDirectory
      })

      // Recursively get files from subdirectories
      if (isDirectory) {
        const subFiles = await listDirectoryRecursive(fullPath, maxDepth, currentDepth + 1)
        files.push(...subFiles)
      }
    }

    return files
  } catch {
    return []
  }
}
