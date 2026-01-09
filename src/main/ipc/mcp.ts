import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const CLAUDE_DIR = join(homedir(), '.claude')
const MCP_CONFIG_PATH = join(CLAUDE_DIR, 'claude_desktop_config.json')

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>
}

// Internal tracking for disabled servers
const MCP_DISABLED_FILE = join(CLAUDE_DIR, 'mcp-disabled.json')

async function ensureClaudeDir(): Promise<void> {
  await fs.mkdir(CLAUDE_DIR, { recursive: true })
}

async function loadMCPConfig(): Promise<MCPConfig> {
  try {
    const data = await fs.readFile(MCP_CONFIG_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { mcpServers: {} }
  }
}

async function saveMCPConfig(config: MCPConfig): Promise<void> {
  await ensureClaudeDir()
  await fs.writeFile(MCP_CONFIG_PATH, JSON.stringify(config, null, 2))
}

async function loadDisabledServers(): Promise<string[]> {
  try {
    const data = await fs.readFile(MCP_DISABLED_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function saveDisabledServers(disabled: string[]): Promise<void> {
  await ensureClaudeDir()
  await fs.writeFile(MCP_DISABLED_FILE, JSON.stringify(disabled, null, 2))
}

export function registerMCPHandlers(): void {
  // List all MCP servers
  ipcMain.handle('mcp-list', async () => {
    const config = await loadMCPConfig()
    const disabled = await loadDisabledServers()
    const servers: Array<{
      name: string
      command: string
      args: string[]
      env: Record<string, string>
      enabled: boolean
    }> = []

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        servers.push({
          name,
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          enabled: !disabled.includes(name)
        })
      }
    }

    return servers
  })

  // Get a specific MCP server
  ipcMain.handle('mcp-get', async (_, name: string) => {
    const config = await loadMCPConfig()
    const disabled = await loadDisabledServers()

    if (!config.mcpServers || !config.mcpServers[name]) {
      return null
    }

    const serverConfig = config.mcpServers[name]
    return {
      name,
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env || {},
      enabled: !disabled.includes(name)
    }
  })

  // Add a new MCP server
  ipcMain.handle(
    'mcp-add',
    async (
      _,
      name: string,
      command: string,
      args: string[],
      env: Record<string, string>
    ) => {
      const config = await loadMCPConfig()

      if (!config.mcpServers) {
        config.mcpServers = {}
      }

      // Check if server already exists
      if (config.mcpServers[name]) {
        return { success: false, error: `Server "${name}" already exists` }
      }

      config.mcpServers[name] = {
        command,
        args: args.length > 0 ? args : undefined,
        env: Object.keys(env).length > 0 ? env : undefined
      }

      await saveMCPConfig(config)
      return { success: true }
    }
  )

  // Update an existing MCP server
  ipcMain.handle(
    'mcp-update',
    async (
      _,
      name: string,
      command: string,
      args: string[],
      env: Record<string, string>
    ) => {
      const config = await loadMCPConfig()

      if (!config.mcpServers || !config.mcpServers[name]) {
        return { success: false, error: `Server "${name}" not found` }
      }

      config.mcpServers[name] = {
        command,
        args: args.length > 0 ? args : undefined,
        env: Object.keys(env).length > 0 ? env : undefined
      }

      await saveMCPConfig(config)
      return { success: true }
    }
  )

  // Remove an MCP server
  ipcMain.handle('mcp-remove', async (_, name: string) => {
    const config = await loadMCPConfig()

    if (!config.mcpServers || !config.mcpServers[name]) {
      return { success: false, error: `Server "${name}" not found` }
    }

    delete config.mcpServers[name]
    await saveMCPConfig(config)

    // Also remove from disabled list if present
    const disabled = await loadDisabledServers()
    const filteredDisabled = disabled.filter((d) => d !== name)
    if (filteredDisabled.length !== disabled.length) {
      await saveDisabledServers(filteredDisabled)
    }

    return { success: true }
  })

  // Toggle enable/disable an MCP server
  // Note: Claude Desktop doesn't support disabling servers natively,
  // so we track this separately and can remove/re-add on toggle
  ipcMain.handle('mcp-toggle', async (_, name: string, enabled: boolean) => {
    const config = await loadMCPConfig()

    if (!config.mcpServers || !config.mcpServers[name]) {
      return { success: false, error: `Server "${name}" not found` }
    }

    const disabled = await loadDisabledServers()

    if (enabled) {
      // Remove from disabled list
      const filteredDisabled = disabled.filter((d) => d !== name)
      await saveDisabledServers(filteredDisabled)
    } else {
      // Add to disabled list
      if (!disabled.includes(name)) {
        disabled.push(name)
        await saveDisabledServers(disabled)
      }
    }

    return { success: true }
  })

  // Check if MCP config file exists
  ipcMain.handle('mcp-check-config', async () => {
    try {
      await fs.access(MCP_CONFIG_PATH)
      return { exists: true, path: MCP_CONFIG_PATH }
    } catch {
      return { exists: false, path: MCP_CONFIG_PATH }
    }
  })

  // Initialize MCP config file if it doesn't exist
  ipcMain.handle('mcp-init-config', async () => {
    try {
      await fs.access(MCP_CONFIG_PATH)
      return { success: true, created: false }
    } catch {
      await saveMCPConfig({ mcpServers: {} })
      return { success: true, created: true }
    }
  })
}
