import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const CLAUDE_DIR = join(homedir(), '.claude')

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

// Parse claude mcp list output to get server info
async function parseClaudeMCPList(): Promise<Array<{
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  status: string
}>> {
  try {
    const { stdout } = await execAsync('claude mcp list', {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
    })

    const servers: Array<{
      name: string
      command: string
      args: string[]
      env: Record<string, string>
      enabled: boolean
      status: string
    }> = []

    // Parse the output - format is:
    // name: command args - status
    const lines = stdout.split('\n')
    for (const line of lines) {
      // Match lines like: filesystem: npx -y @modelcontextprotocol/server-filesystem /Users/gabe - ✓ Connected
      const match = line.match(/^(\S+):\s+(.+?)\s+-\s+(.+)$/)
      if (match) {
        const [, name, commandWithArgs, statusPart] = match
        const parts = commandWithArgs.trim().split(/\s+/)
        const command = parts[0] || ''
        const args = parts.slice(1)
        const isConnected = statusPart.includes('✓') || statusPart.includes('Connected')

        servers.push({
          name,
          command,
          args,
          env: {},
          enabled: true, // All listed servers are enabled
          status: isConnected ? 'connected' : 'failed'
        })
      }
    }

    return servers
  } catch (error) {
    console.error('Failed to list MCP servers:', error)
    return []
  }
}

// Get details for a specific server
async function getMCPServerDetails(name: string): Promise<{
  command: string
  args: string[]
  env: Record<string, string>
} | null> {
  try {
    const { stdout } = await execAsync(`claude mcp get "${name}"`, {
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
    })

    // Parse output - format is:
    // name:
    //   Scope: User config
    //   Status: ✓ Connected
    //   Type: stdio
    //   Command: npx
    //   Args: -y @modelcontextprotocol/server-filesystem /Users/gabe
    //   Environment:

    const commandMatch = stdout.match(/Command:\s*(.+)/i)
    const argsMatch = stdout.match(/Args:\s*(.+)/i)

    if (commandMatch) {
      return {
        command: commandMatch[1].trim(),
        args: argsMatch ? argsMatch[1].trim().split(/\s+/) : [],
        env: {}
      }
    }

    return null
  } catch {
    return null
  }
}

export function registerMCPHandlers(): void {
  // List all MCP servers using claude mcp list command
  ipcMain.handle('mcp-list', async () => {
    return parseClaudeMCPList()
  })

  // Get a specific MCP server using claude mcp get
  ipcMain.handle('mcp-get', async (_, name: string) => {
    const details = await getMCPServerDetails(name)
    if (!details) return null

    return {
      name,
      command: details.command,
      args: details.args,
      env: details.env,
      enabled: true
    }
  })

  // Add a new MCP server using claude mcp add
  ipcMain.handle(
    'mcp-add',
    async (
      _,
      name: string,
      command: string,
      args: string[],
      env: Record<string, string>
    ) => {
      try {
        // Build the command: claude mcp add "name" "command" [args...] [-e KEY=VALUE...]
        let cmd = `claude mcp add "${name}" "${command}"`
        if (args.length > 0) {
          cmd += ' ' + args.map(a => `"${a}"`).join(' ')
        }
        for (const [key, value] of Object.entries(env)) {
          cmd += ` -e "${key}=${value}"`
        }

        await execAsync(cmd, {
          env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
        })
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add server'
        return { success: false, error: message }
      }
    }
  )

  // Update an existing MCP server - remove and re-add
  ipcMain.handle(
    'mcp-update',
    async (
      _,
      name: string,
      command: string,
      args: string[],
      env: Record<string, string>
    ) => {
      try {
        // First remove the existing server
        await execAsync(`claude mcp remove "${name}" -s user`, {
          env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
        })

        // Then add with new config
        let cmd = `claude mcp add "${name}" "${command}"`
        if (args.length > 0) {
          cmd += ' ' + args.map(a => `"${a}"`).join(' ')
        }
        for (const [key, value] of Object.entries(env)) {
          cmd += ` -e "${key}=${value}"`
        }

        await execAsync(cmd, {
          env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
        })
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update server'
        return { success: false, error: message }
      }
    }
  )

  // Remove an MCP server using claude mcp remove
  ipcMain.handle('mcp-remove', async (_, name: string) => {
    try {
      await execAsync(`claude mcp remove "${name}" -s user`, {
        env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
      })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove server'
      return { success: false, error: message }
    }
  })

  // Toggle enable/disable - Claude CLI doesn't support this, so just return success
  ipcMain.handle('mcp-toggle', async (_, _name: string, _enabled: boolean) => {
    // Claude CLI doesn't have a disable feature - servers are either added or removed
    return { success: true, note: 'Claude CLI does not support disabling servers' }
  })

  // Check if claude mcp is available
  ipcMain.handle('mcp-check-config', async () => {
    try {
      await execAsync('claude mcp list', {
        env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.npm-global/bin` }
      })
      return { exists: true, path: 'claude mcp' }
    } catch {
      return { exists: false, path: 'claude mcp' }
    }
  })

  // Initialize - no-op for Claude CLI
  ipcMain.handle('mcp-init-config', async () => {
    return { success: true, created: false }
  })
}
