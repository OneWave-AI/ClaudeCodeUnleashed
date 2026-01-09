import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi, ConversationExportOptions, LLMApiRequest, SuperAgentConfig } from '../shared/types'

const api: IpcApi = {
  // Terminal
  createTerminal: (cols, rows) => ipcRenderer.invoke('create-terminal', cols, rows),
  stopTerminal: (terminalId) => ipcRenderer.invoke('stop-terminal', terminalId),
  terminalInput: (data, terminalId) => ipcRenderer.invoke('terminal-input', data, terminalId),
  terminalResize: (cols, rows, terminalId) =>
    ipcRenderer.invoke('terminal-resize', cols, rows, terminalId),
  getTerminals: () => ipcRenderer.invoke('get-terminals'),
  terminalSendText: (text, terminalId) => ipcRenderer.invoke('terminal-send-text', text, terminalId),
  onTerminalData: (callback) => {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('terminal-data')
    ipcRenderer.on('terminal-data', (_, data, terminalId) => callback(data, terminalId))
  },
  onTerminalExit: (callback) => {
    ipcRenderer.removeAllListeners('terminal-exit')
    ipcRenderer.on('terminal-exit', (_, code, terminalId) => callback(code, terminalId))
  },

  // Files
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getCwd: () => ipcRenderer.invoke('get-cwd'),
  setCwd: (path) => ipcRenderer.invoke('set-cwd', path),
  listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
  listDirectoryFull: (path, showHidden) => ipcRenderer.invoke('list-directory-full', path, showHidden),
  listFiles: () => ipcRenderer.invoke('list-files'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  copyFiles: (paths) => ipcRenderer.invoke('copy-files', paths),
  openFileExternal: (path) => ipcRenderer.invoke('open-file-external', path),
  showInFinder: (path) => ipcRenderer.invoke('show-in-finder', path),
  getFileStats: (path) => ipcRenderer.invoke('get-file-stats', path),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', oldPath, newName),
  createFile: (parentPath, fileName) => ipcRenderer.invoke('create-file', parentPath, fileName),
  createFolder: (parentPath, folderName) => ipcRenderer.invoke('create-folder', parentPath, folderName),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
  moveFile: (sourcePath, targetDir) => ipcRenderer.invoke('move-file', sourcePath, targetDir),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),
  watchFile: (path) => ipcRenderer.invoke('watch-file', path),
  unwatchFile: (path) => ipcRenderer.invoke('unwatch-file', path),
  onFileChanged: (callback) => {
    ipcRenderer.removeAllListeners('file-changed')
    ipcRenderer.on('file-changed', (_, filePath) => callback(filePath))
  },

  // Skills & Agents
  listSkills: () => ipcRenderer.invoke('list-skills'),
  listAgents: () => ipcRenderer.invoke('list-agents'),
  listPlugins: () => ipcRenderer.invoke('list-plugins'),
  createSkill: (id, name, desc) => ipcRenderer.invoke('create-skill', id, name, desc),
  createAgent: (id, name, desc) => ipcRenderer.invoke('create-agent', id, name, desc),
  deleteSkill: (skillId) => ipcRenderer.invoke('delete-skill', skillId),
  deleteAgent: (agentId) => ipcRenderer.invoke('delete-agent', agentId),
  readSkillContent: (path) => ipcRenderer.invoke('read-skill-content', path),
  saveSkillContent: (path, content) => ipcRenderer.invoke('save-skill-content', path, content),
  togglePlugin: (pluginId, enabled) => ipcRenderer.invoke('toggle-plugin', pluginId, enabled),
  installStarterKit: () => ipcRenderer.invoke('install-starter-kit'),
  checkStarterKit: () => ipcRenderer.invoke('check-starter-kit'),
  duplicateSkill: (skillId) => ipcRenderer.invoke('duplicate-skill', skillId),
  duplicateAgent: (agentId) => ipcRenderer.invoke('duplicate-agent', agentId),
  importSkill: (id, content) => ipcRenderer.invoke('import-skill', id, content),
  importAgent: (id, content) => ipcRenderer.invoke('import-agent', id, content),
  exportSkillOrAgent: (sourcePath, name, type) => ipcRenderer.invoke('export-skill-or-agent', sourcePath, name, type),
  getSkillMetadata: (id) => ipcRenderer.invoke('get-skill-metadata', id),
  updateSkillMetadata: (id, updates) => ipcRenderer.invoke('update-skill-metadata', id, updates),
  getAllMetadata: () => ipcRenderer.invoke('get-all-metadata'),
  saveAllMetadata: (metadata) => ipcRenderer.invoke('save-all-metadata', metadata),
  updateLastUsed: (id) => ipcRenderer.invoke('update-last-used', id),

  // Conversations
  listConversations: () => ipcRenderer.invoke('list-conversations'),
  getConversationPreview: (id, projectFolder) =>
    ipcRenderer.invoke('get-conversation-preview', id, projectFolder),
  getConversationDetails: (id, projectFolder) =>
    ipcRenderer.invoke('get-conversation-details', id, projectFolder),
  getConversationMessages: (id, projectFolder, limit) =>
    ipcRenderer.invoke('get-conversation-messages', id, projectFolder, limit),
  deleteConversation: (id, projectFolder) =>
    ipcRenderer.invoke('delete-conversation', id, projectFolder),
  exportConversation: (id, projectFolder, options?: ConversationExportOptions) =>
    ipcRenderer.invoke('export-conversation', id, projectFolder, options),
  pinConversation: (id, projectFolder, pinned) =>
    ipcRenderer.invoke('pin-conversation', id, projectFolder, pinned),
  searchConversations: (query) => ipcRenderer.invoke('search-conversations', query),

  // Claude CLI
  checkClaudeInstalled: () => ipcRenderer.invoke('check-claude-installed'),
  installClaude: () => ipcRenderer.invoke('install-claude'),
  onInstallProgress: (callback) =>
    ipcRenderer.on('install-progress', (_, data) => callback(data)),

  // Git
  gitStatus: () => ipcRenderer.invoke('git-status'),
  gitCommit: (message) => ipcRenderer.invoke('git-commit', message),
  gitPush: () => ipcRenderer.invoke('git-push'),
  gitPull: () => ipcRenderer.invoke('git-pull'),
  gitFileStatus: () => ipcRenderer.invoke('git-file-status'),

  // System
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  openUrlExternal: (url) => ipcRenderer.invoke('open-url-external', url),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  clearAllData: () => ipcRenderer.invoke('settings:clearAllData'),
  checkForUpdates: () => ipcRenderer.invoke('settings:checkForUpdates'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('settings:setWindowOpacity', opacity),
  getAppVersion: () => ipcRenderer.invoke('settings:getAppVersion'),
  saveCustomTheme: (theme) => ipcRenderer.invoke('settings:saveCustomTheme', theme),
  deleteCustomTheme: (themeId) => ipcRenderer.invoke('settings:deleteCustomTheme', themeId),

  // MCP (Model Context Protocol)
  mcpList: () => ipcRenderer.invoke('mcp-list'),
  mcpGet: (name) => ipcRenderer.invoke('mcp-get', name),
  mcpAdd: (name, command, args, env) => ipcRenderer.invoke('mcp-add', name, command, args, env),
  mcpUpdate: (name, command, args, env) => ipcRenderer.invoke('mcp-update', name, command, args, env),
  mcpRemove: (name) => ipcRenderer.invoke('mcp-remove', name),
  mcpToggle: (name, enabled) => ipcRenderer.invoke('mcp-toggle', name, enabled),
  mcpCheckConfig: () => ipcRenderer.invoke('mcp-check-config'),
  mcpInitConfig: () => ipcRenderer.invoke('mcp-init-config'),

  // Super Agent
  callLLMApi: (request: LLMApiRequest) => ipcRenderer.invoke('call-llm-api', request),
  loadSuperAgentConfig: () => ipcRenderer.invoke('load-superagent-config'),
  saveSuperAgentConfig: (config: Partial<SuperAgentConfig>) =>
    ipcRenderer.invoke('save-superagent-config', config),

  // Window Controls
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize')
}

contextBridge.exposeInMainWorld('api', api)
