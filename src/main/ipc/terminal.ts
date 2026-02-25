import { ipcMain, BrowserWindow, app } from 'electron'
import * as pty from 'node-pty'
import { homedir } from 'os'
import type { IDisposable } from 'node-pty'

interface Terminal {
  id: string
  pty: pty.IPty
  cols: number
  rows: number
  disposables: IDisposable[]
  webContentsId: number
}

const terminals = new Map<string, Terminal>()
const terminalOutputBuffers = new Map<string, string>()
const MAX_OUTPUT_BUFFER = 50_000 // 50KB ring buffer per terminal
let terminalCounter = 0
let currentCwd = homedir()
let handlersRegistered = false

export function registerTerminalHandlers(): void {
  // Prevent double registration
  if (handlersRegistered) {
    console.warn('Terminal handlers already registered')
    return
  }
  handlersRegistered = true

  ipcMain.handle('get-cwd', () => currentCwd)

  ipcMain.handle('set-cwd', (_, path: string) => {
    currentCwd = path
  })

  ipcMain.handle('create-terminal', (event, cols: number, rows: number) => {
    const id = `terminal-${++terminalCounter}`
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

    try {
      // Extend PATH to include common locations for npm/homebrew binaries
      const extraPaths = [
        `${homedir()}/.npm-global/bin`,
        `${homedir()}/.nvm/versions/node/${process.version}/bin`,
        '/usr/local/bin',
        '/opt/homebrew/bin',
        `${homedir()}/.local/bin`
      ].join(':')

      // Strip env vars that prevent CLI tools from launching inside our terminal
      const { CLAUDECODE, ...cleanEnv } = process.env

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: currentCwd,
        env: {
          ...cleanEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          PATH: `${extraPaths}:${process.env.PATH || ''}`
        }
      })

      const disposables: IDisposable[] = []
      const webContentsId = event.sender.id

      const terminal: Terminal = {
        id,
        pty: ptyProcess,
        cols: cols || 80,
        rows: rows || 24,
        disposables,
        webContentsId
      }

      terminals.set(id, terminal)

      // Initialize output buffer for this terminal
      terminalOutputBuffers.set(id, '')

      // Forward data to renderer and track in ring buffer
      const dataDisposable = ptyProcess.onData((data) => {
        // Append to ring buffer
        const existing = terminalOutputBuffers.get(id) || ''
        const updated = existing + data
        terminalOutputBuffers.set(
          id,
          updated.length > MAX_OUTPUT_BUFFER ? updated.slice(-MAX_OUTPUT_BUFFER) : updated
        )

        try {
          const window = BrowserWindow.fromWebContents(event.sender)
          if (window && !window.isDestroyed()) {
            window.webContents.send('terminal-data', data, id)
          }
        } catch (err) {
          // Window may have been closed, ignore
        }
      })
      disposables.push(dataDisposable)

      // Handle exit - store the disposable
      const exitDisposable = ptyProcess.onExit(({ exitCode }) => {
        try {
          const window = BrowserWindow.fromWebContents(event.sender)
          if (window && !window.isDestroyed()) {
            window.webContents.send('terminal-exit', exitCode, id)
          }
        } catch (err) {
          // Window may have been closed, ignore
        }
        cleanupTerminal(id)
      })
      disposables.push(exitDisposable)

      return id
    } catch (error) {
      console.error('Failed to create terminal:', error)
      throw new Error(`Failed to create terminal: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  ipcMain.handle('stop-terminal', (_, terminalId: string) => {
    cleanupTerminal(terminalId)
  })

  ipcMain.handle('terminal-input', (_, data: string, terminalId: string) => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      try {
        terminal.pty.write(data)
      } catch (error) {
        console.error(`Failed to write to terminal ${terminalId}:`, error)
      }
    }
  })

  ipcMain.handle('terminal-resize', (_, cols: number, rows: number, terminalId: string) => {
    const terminal = terminals.get(terminalId)
    if (terminal && cols > 0 && rows > 0) {
      try {
        terminal.pty.resize(cols, rows)
        terminal.cols = cols
        terminal.rows = rows
      } catch (error) {
        console.error(`Failed to resize terminal ${terminalId}:`, error)
      }
    }
  })

  ipcMain.handle('get-terminals', () => {
    return Array.from(terminals.values()).map((t) => ({
      id: t.id,
      name: t.id,
      cols: t.cols,
      rows: t.rows
    }))
  })

  // Send text to a specific terminal and press Enter
  // Bulk write for performance - no per-character delay needed
  ipcMain.handle('terminal-send-text', async (_, text: string, terminalId: string) => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      try {
        terminal.pty.write(text + '\r')
      } catch (error) {
        console.error(`Failed to send text to terminal ${terminalId}:`, error)
      }
    }
  })

  // Get recent output buffer from a terminal
  ipcMain.handle('terminal-get-buffer', (_, terminalId: string, lines?: number) => {
    const buffer = terminalOutputBuffers.get(terminalId)
    if (!buffer) return ''
    if (lines && lines > 0) {
      const allLines = buffer.split('\n')
      return allLines.slice(-lines).join('\n')
    }
    return buffer
  })

  // Clean up all terminals when app quits
  app.on('before-quit', () => {
    cleanupAllTerminals()
  })

  // Clean up terminals when webContents is destroyed
  app.on('web-contents-created', (_event, webContents) => {
    webContents.on('destroyed', () => {
      const webContentsId = webContents.id
      // Find and cleanup terminals associated with this webContents
      for (const [terminalId, terminal] of terminals.entries()) {
        if (terminal.webContentsId === webContentsId) {
          cleanupTerminal(terminalId)
        }
      }
    })
  })
}

/**
 * Cleanup a single terminal by ID
 */
function cleanupTerminal(terminalId: string): void {
  const terminal = terminals.get(terminalId)
  if (!terminal) return

  // Dispose all event listeners
  for (const disposable of terminal.disposables) {
    try {
      disposable.dispose()
    } catch (err) {
      // Ignore disposal errors
    }
  }

  // Kill the pty process
  try {
    terminal.pty.kill()
  } catch (err) {
    // Process may already be dead
  }

  // Remove from maps
  terminals.delete(terminalId)
  terminalOutputBuffers.delete(terminalId)
}

/**
 * Cleanup all terminals
 */
function cleanupAllTerminals(): void {
  for (const terminalId of terminals.keys()) {
    cleanupTerminal(terminalId)
  }
}

export function getCwd(): string {
  return currentCwd
}

/**
 * Get the number of active terminals (for testing/debugging)
 */
export function getActiveTerminalCount(): number {
  return terminals.size
}
