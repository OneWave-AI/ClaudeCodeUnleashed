import { ipcMain, BrowserWindow, app } from 'electron'
import * as fs from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import * as pty from 'node-pty'
import type { BackgroundAgentTask, AppSettings } from '../../shared/types'
import { CLI_PROVIDERS } from '../../shared/providers'

const BACKGROUND_AGENTS_DIR = join(homedir(), '.claude', 'background-agents')

interface BackgroundAgentQueue {
  tasks: BackgroundAgentTask[]
  maxConcurrent: number
  isRunning: boolean
}

let queue: BackgroundAgentQueue = {
  tasks: [],
  maxConcurrent: 2,
  isRunning: false
}

const runningProcesses = new Map<string, pty.IPty>()

// Helper to broadcast to all windows
function broadcastToWindows(channel: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, ...args)
  }
}

// Ensure directory exists
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(BACKGROUND_AGENTS_DIR, { recursive: true })
  } catch {
    // Ignore
  }
}

// Save queue state
async function saveQueue(): Promise<void> {
  await ensureDir()
  const filePath = join(BACKGROUND_AGENTS_DIR, 'queue.json')
  await fs.writeFile(filePath, JSON.stringify(queue, null, 2), 'utf-8')
}

// Load queue state
async function loadQueue(): Promise<void> {
  await ensureDir()
  const filePath = join(BACKGROUND_AGENTS_DIR, 'queue.json')

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    queue = JSON.parse(content)

    // Reset any 'running' tasks to 'queued' on startup (they didn't complete)
    queue.tasks = queue.tasks.map(task =>
      task.status === 'running' ? { ...task, status: 'queued' } : task
    )
  } catch {
    // Use defaults
  }
}

// Generate task ID
function generateId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Process queue - run next tasks
async function processQueue(): Promise<void> {
  if (!queue.isRunning) return

  const runningCount = queue.tasks.filter(t => t.status === 'running').length
  const availableSlots = queue.maxConcurrent - runningCount

  if (availableSlots <= 0) return

  // Get next queued tasks, sorted by priority
  const priorityOrder = { high: 0, normal: 1, low: 2 }
  const queuedTasks = queue.tasks
    .filter(t => t.status === 'queued')
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, availableSlots)

  for (const task of queuedTasks) {
    startTask(task)
  }
}

// Start a single task
async function startTask(task: BackgroundAgentTask): Promise<void> {
  const taskIndex = queue.tasks.findIndex(t => t.id === task.id)
  if (taskIndex === -1) return

  queue.tasks[taskIndex].status = 'running'
  queue.tasks[taskIndex].startedAt = Date.now()
  await saveQueue()

  // Notify renderer
  broadcastToWindows('background-agent-update', queue.tasks[taskIndex])

  // Spawn the Claude CLI process
  const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh'

  // Strip env vars that prevent CLI tools from launching inside our terminal
  const { CLAUDECODE: _, ...cleanEnv } = process.env

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: task.projectPath,
    env: {
      ...cleanEnv,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1'
    }
  })

  runningProcesses.set(task.id, ptyProcess)

  // Collect output
  ptyProcess.onData((data) => {
    const taskIdx = queue.tasks.findIndex(t => t.id === task.id)
    if (taskIdx !== -1) {
      queue.tasks[taskIdx].output.push(data)

      // Limit output buffer to last 1000 lines
      if (queue.tasks[taskIdx].output.length > 1000) {
        queue.tasks[taskIdx].output = queue.tasks[taskIdx].output.slice(-1000)
      }

      // Notify renderer of new output
      broadcastToWindows('background-agent-output', {
        taskId: task.id,
        data
      })
    }
  })

  // Handle exit
  ptyProcess.onExit(({ exitCode }) => {
    runningProcesses.delete(task.id)

    const taskIdx = queue.tasks.findIndex(t => t.id === task.id)
    if (taskIdx !== -1) {
      queue.tasks[taskIdx].status = exitCode === 0 ? 'completed' : 'failed'
      queue.tasks[taskIdx].completedAt = Date.now()
      if (exitCode !== 0) {
        queue.tasks[taskIdx].error = `Process exited with code ${exitCode}`
      }

      broadcastToWindows('background-agent-update', queue.tasks[taskIdx])
      saveQueue()
    }

    // Process next in queue
    processQueue()
  })

  // Read provider from settings and start CLI
  setTimeout(async () => {
    let binaryName = 'claude'
    try {
      const settingsPath = join(app.getPath('userData'), 'settings.json')
      const data = await fs.readFile(settingsPath, 'utf-8')
      const settings: Partial<AppSettings> = JSON.parse(data)
      const provider = settings.cliProvider || 'claude'
      binaryName = CLI_PROVIDERS[provider].binaryName
    } catch {
      // Default to claude if settings can't be read
    }

    ptyProcess.write(`${binaryName}\r`)

    // Wait for it to initialize, then send the prompt
    setTimeout(() => {
      ptyProcess.write(task.prompt + '\r')
    }, 2000)
  }, 500)
}

// Kill a running task
function killTask(taskId: string): boolean {
  const process = runningProcesses.get(taskId)
  if (process) {
    process.kill()
    runningProcesses.delete(taskId)

    const taskIdx = queue.tasks.findIndex(t => t.id === taskId)
    if (taskIdx !== -1) {
      queue.tasks[taskIdx].status = 'cancelled'
      queue.tasks[taskIdx].completedAt = Date.now()
      broadcastToWindows('background-agent-update', queue.tasks[taskIdx])
      saveQueue()
    }

    return true
  }
  return false
}

export function registerBackgroundAgentHandlers(): void {
  // Load queue on startup
  loadQueue()

  // List all tasks
  ipcMain.handle('background-agent-list', (): BackgroundAgentTask[] => {
    return queue.tasks
  })

  // Add a task to the queue
  ipcMain.handle('background-agent-add', async (_, task: {
    name: string
    prompt: string
    projectPath: string
    priority?: 'low' | 'normal' | 'high'
  }): Promise<BackgroundAgentTask> => {
    const newTask: BackgroundAgentTask = {
      id: generateId(),
      name: task.name,
      prompt: task.prompt,
      projectPath: task.projectPath,
      status: 'queued',
      createdAt: Date.now(),
      output: [],
      priority: task.priority || 'normal'
    }

    queue.tasks.push(newTask)
    await saveQueue()

    // Notify renderer
    broadcastToWindows('background-agent-update', newTask)

    // Process queue if running
    if (queue.isRunning) {
      processQueue()
    }

    return newTask
  })

  // Remove a task
  ipcMain.handle('background-agent-remove', async (_, taskId: string): Promise<{ success: boolean }> => {
    // Kill if running
    killTask(taskId)

    queue.tasks = queue.tasks.filter(t => t.id !== taskId)
    await saveQueue()

    return { success: true }
  })

  // Cancel a running task
  ipcMain.handle('background-agent-cancel', async (_, taskId: string): Promise<{ success: boolean }> => {
    const success = killTask(taskId)
    return { success }
  })

  // Start the queue
  ipcMain.handle('background-agent-start-queue', async (): Promise<{ success: boolean }> => {
    queue.isRunning = true
    await saveQueue()
    processQueue()
    return { success: true }
  })

  // Pause the queue
  ipcMain.handle('background-agent-pause-queue', async (): Promise<{ success: boolean }> => {
    queue.isRunning = false
    await saveQueue()
    return { success: true }
  })

  // Get queue status
  ipcMain.handle('background-agent-queue-status', (): {
    isRunning: boolean
    maxConcurrent: number
    totalTasks: number
    queuedTasks: number
    runningTasks: number
    completedTasks: number
    failedTasks: number
  } => {
    return {
      isRunning: queue.isRunning,
      maxConcurrent: queue.maxConcurrent,
      totalTasks: queue.tasks.length,
      queuedTasks: queue.tasks.filter(t => t.status === 'queued').length,
      runningTasks: queue.tasks.filter(t => t.status === 'running').length,
      completedTasks: queue.tasks.filter(t => t.status === 'completed').length,
      failedTasks: queue.tasks.filter(t => t.status === 'failed').length
    }
  })

  // Set max concurrent
  ipcMain.handle('background-agent-set-max-concurrent', async (_, max: number): Promise<{ success: boolean }> => {
    queue.maxConcurrent = Math.max(1, Math.min(max, 5))
    await saveQueue()
    return { success: true }
  })

  // Get task output
  ipcMain.handle('background-agent-get-output', (_, taskId: string): string[] => {
    const task = queue.tasks.find(t => t.id === taskId)
    return task?.output || []
  })

  // Clear completed tasks
  ipcMain.handle('background-agent-clear-completed', async (): Promise<{ success: boolean }> => {
    queue.tasks = queue.tasks.filter(t =>
      t.status === 'queued' || t.status === 'running'
    )
    await saveQueue()
    return { success: true }
  })

  // Retry a failed task
  ipcMain.handle('background-agent-retry', async (_, taskId: string): Promise<{ success: boolean }> => {
    const taskIdx = queue.tasks.findIndex(t => t.id === taskId)
    if (taskIdx === -1) return { success: false }

    const task = queue.tasks[taskIdx]
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      return { success: false }
    }

    queue.tasks[taskIdx] = {
      ...task,
      status: 'queued',
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
      output: []
    }

    await saveQueue()
    broadcastToWindows('background-agent-update', queue.tasks[taskIdx])

    if (queue.isRunning) {
      processQueue()
    }

    return { success: true }
  })

  // Reorder tasks
  ipcMain.handle('background-agent-reorder', async (_, taskId: string, newIndex: number): Promise<{ success: boolean }> => {
    const currentIndex = queue.tasks.findIndex(t => t.id === taskId)
    if (currentIndex === -1) return { success: false }

    const task = queue.tasks[currentIndex]
    if (task.status !== 'queued') return { success: false }

    queue.tasks.splice(currentIndex, 1)
    queue.tasks.splice(newIndex, 0, task)

    await saveQueue()
    return { success: true }
  })

  // Update task priority
  ipcMain.handle('background-agent-set-priority', async (_, taskId: string, priority: 'low' | 'normal' | 'high'): Promise<{ success: boolean }> => {
    const taskIdx = queue.tasks.findIndex(t => t.id === taskId)
    if (taskIdx === -1) return { success: false }

    queue.tasks[taskIdx].priority = priority
    await saveQueue()
    broadcastToWindows('background-agent-update', queue.tasks[taskIdx])

    return { success: true }
  })
}
