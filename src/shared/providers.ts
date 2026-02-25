import type { CLIProvider, CLIProviderConfig } from './types'

export const CLI_PROVIDERS: Record<CLIProvider, CLIProviderConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    binaryName: 'claude',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    installPackage: '@anthropic-ai/claude-code',
    checkPaths: (home) => [
      `${home}/.npm-global/bin/claude`,
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      `${home}/.local/bin/claude`
    ],
    models: [
      { id: 'opus', name: 'Opus 4.6', desc: 'Most intelligent', color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { id: 'sonnet', name: 'Sonnet 4.6', desc: 'Speed + intelligence', color: 'text-[#cc785c]', bg: 'bg-[#cc785c]/10' },
      { id: 'haiku', name: 'Haiku 4.5', desc: 'Fastest', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    ],
    defaultModel: 'sonnet',
    modelCommand: '/model',
    hasPlanMode: true,
    configDir: '.claude',
    promptChar: /❯\s*$/m,
    workingPatterns: [
      /\.\.\.\s*$/m,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/m,
      /^\s*(?:thinking|analyzing|searching|reading|writing|running|executing|loading|processing|building|compiling|installing|fetching|creating|updating|downloading)\b/im,
      /\[(?:thinking|analyzing|searching|reading|writing|running|executing|loading|processing|building|compiling|installing|fetching|creating|updating|downloading)\]/i,
      /Tool:|Read\(|Write\(|Edit\(|Bash\(|Task\(|Glob\(|Grep\(|WebFetch\(|WebSearch\(/i,
      /npm|yarn|pnpm|pip|cargo|go build|make/i,
      /✓.*modules? transformed/i,
      /Compiling|Bundling|Generating/i
    ],
    waitingPatterns: [
      /❯\s*$/m,
      />\s*$/m,
      /\(y\/n\)\s*$/im,
      /\[Y\/n\]\s*$/im,
      /\[y\/N\]\s*$/im,
      /What would you like|How can I help|anything else|Do you want to/i,
      /Press Enter to continue/i,
      /\? \(Y\/n\)/i,
      /✓ built in \d+/i
    ]
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    binaryName: 'codex',
    installCommand: 'npm install -g @openai/codex',
    installPackage: '@openai/codex',
    checkPaths: (home) => [
      `${home}/.npm-global/bin/codex`,
      '/usr/local/bin/codex',
      '/opt/homebrew/bin/codex',
      `${home}/.local/bin/codex`
    ],
    models: [
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', desc: 'Most capable', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Spark', desc: 'Fast real-time', color: 'text-[#cc785c]', bg: 'bg-[#cc785c]/10' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', desc: 'Previous gen', color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Max', desc: 'Long-horizon', color: 'text-blue-400', bg: 'bg-blue-500/10' }
    ],
    defaultModel: 'gpt-5.3-codex',
    modelCommand: '/model',
    hasPlanMode: false,
    configDir: '.codex',
    promptChar: />\s*$/m,
    workingPatterns: [
      /\.\.\.\s*$/m,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/m,
      /^\s*(?:thinking|analyzing|searching|reading|writing|running|executing|loading|processing|building|compiling|installing|fetching|creating|updating|downloading)\b/im,
      /\[(?:thinking|analyzing|searching|reading|writing|running|executing|loading|processing|building|compiling|installing|fetching|creating|updating|downloading)\]/i,
      /npm|yarn|pnpm|pip|cargo|go build|make/i,
      /Compiling|Bundling|Generating/i
    ],
    waitingPatterns: [
      />\s*$/m,
      /\(y\/n\)\s*$/im,
      /\[Y\/n\]\s*$/im,
      /\[y\/N\]\s*$/im,
      /What would you like|How can I help|anything else|Do you want to/i,
      /Press Enter to continue/i
    ]
  }
}

export function getProviderConfig(provider: CLIProvider): CLIProviderConfig {
  return CLI_PROVIDERS[provider]
}
