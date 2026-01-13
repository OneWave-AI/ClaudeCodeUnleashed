import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import * as fs from 'fs/promises'
import { registerTerminalHandlers } from './terminal'
import { registerFileHandlers } from './files'
import { registerSkillsHandlers } from './skills'
import { registerConversationHandlers } from './conversations'
import { registerGitHandlers } from './git'
import { registerSettingsHandlers, initializeSettings } from './settings'
import { registerMCPHandlers } from './mcp'
import { registerSuperAgentHandlers } from './superagent'
import { registerHiveHandlers } from './hives'

export function registerIpcHandlers(): void {
  // Terminal handlers
  registerTerminalHandlers()

  // File handlers
  registerFileHandlers()

  // Skills handlers
  registerSkillsHandlers()

  // Conversation handlers
  registerConversationHandlers()

  // Git handlers
  registerGitHandlers()

  // Settings handlers
  registerSettingsHandlers()

  // MCP handlers
  registerMCPHandlers()

  // Super Agent handlers
  registerSuperAgentHandlers()

  // Hive handlers
  registerHiveHandlers()

  // Initialize settings (apply window opacity, etc.)
  initializeSettings()

  // System handlers
  ipcMain.handle('get-home-dir', () => homedir())

  // Track last opened URL to prevent spam
  let lastOpenedUrl: { url: string; time: number } | null = null

  ipcMain.handle('open-url-external', async (_, url: string) => {
    // Debounce: prevent opening same URL within 1 second
    const now = Date.now()
    if (lastOpenedUrl && lastOpenedUrl.url === url && now - lastOpenedUrl.time < 1000) {
      return // Skip duplicate
    }
    lastOpenedUrl = { url, time: now }
    await shell.openExternal(url)
  })

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: homedir()
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Claude CLI check
  ipcMain.handle('check-claude-installed', async () => {
    const { exec } = await import('child_process')
    const { existsSync } = await import('fs')
    const { join } = await import('path')

    // Check common installation paths first
    const commonPaths = [
      join(homedir(), '.npm-global', 'bin', 'claude'),
      join(homedir(), '.nvm', 'versions', 'node', process.version, 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.local', 'bin', 'claude')
    ]

    for (const claudePath of commonPaths) {
      if (existsSync(claudePath)) {
        return true
      }
    }

    // Fallback to which command with user's shell
    return new Promise<boolean>((resolve) => {
      // Use login shell to get proper PATH
      exec('source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; which claude', {
        shell: '/bin/zsh',
        env: { ...process.env, PATH: `${process.env.PATH}:${homedir()}/.npm-global/bin:/usr/local/bin:/opt/homebrew/bin` }
      }, (error) => {
        resolve(!error)
      })
    })
  })

  // Claude CLI install
  ipcMain.handle('install-claude', async (event) => {
    const { spawn } = await import('child_process')
    const { BrowserWindow } = await import('electron')

    return new Promise<void>((resolve, reject) => {
      // Install using npm globally
      const install = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
        shell: true,
        env: { ...process.env }
      })

      const window = BrowserWindow.fromWebContents(event.sender)

      install.stdout?.on('data', (data) => {
        const output = data.toString()
        // Parse npm output for progress indication
        if (output.includes('added')) {
          window?.webContents.send('install-progress', { stage: 'Installing packages...', progress: 75 })
        }
      })

      install.stderr?.on('data', (data) => {
        const output = data.toString()
        // npm often writes progress to stderr
        if (output.includes('npm')) {
          window?.webContents.send('install-progress', { stage: 'Downloading...', progress: 50 })
        }
      })

      install.on('close', (code) => {
        if (code === 0) {
          window?.webContents.send('install-progress', { stage: 'Complete', progress: 100 })
          resolve()
        } else {
          reject(new Error(`Installation failed with code ${code}`))
        }
      })

      install.on('error', (err) => {
        reject(err)
      })

      // Send initial progress
      window?.webContents.send('install-progress', { stage: 'Starting installation...', progress: 10 })
    })
  })

  // Window controls
  ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
}
