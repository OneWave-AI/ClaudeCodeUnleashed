# ClaudeCodeUI V2

A premium native desktop GUI for [Claude Code CLI](https://github.com/anthropics/claude-code) with integrated file browser, conversation history, skills manager, and more.

![ClaudeCodeUI](https://img.shields.io/badge/version-2.0.0-red)

## What's New in V2

- **Complete Rebuild**: Modern React + TypeScript architecture
- **Faster Performance**: Vite bundler with hot module replacement
- **Better State Management**: Zustand stores for predictable state
- **Type Safety**: Full TypeScript coverage
- **Tailwind CSS**: Utility-first styling

## Features

### Super Agent
Autonomous AI-powered task execution that lets Claude work independently:
- **LLM-Driven**: An outer LLM monitors Claude's terminal output and decides what to do next
- **Auto-Approve**: Automatically approves tool calls and continues until the task is done
- **Time Limits**: Set execution time limits (5-60 minutes)
- **Smart Waiting**: Detects when Claude is waiting for input and prompts it to continue
- **Activity Log**: Real-time visibility into the agent's thought process
- **Side Panel**: Collapsible status bar shows progress without blocking the terminal

### Zero-Config Discovery
Automatically detects everything already on your machine:
- **Skills** in `~/.claude/skills/`
- **Custom Agents** in `~/.claude/agents/`
- **MCP Servers** from your Claude config
- **Recent Projects** from conversation history

No manual import needed - if you've created skills or agents with Claude Code CLI, they appear automatically.

### Skills & Agents Manager
- **Starter Kit**: One-click install of 25 curated skills + 5 agents for new users
- **Browse Skills**: View and search all available Claude skills
- **Manage Agents**: View, create, and edit custom agents
- **Grid/List View**: Toggle between card and list layouts
- **Drag & Drop Reorder**: Organize your tools by dragging
- **Category Filters**: Filter by Development, Writing, Security, etc.
- **Import/Export**: Share skills and agents as files
- **In-App Editor**: Modify skill/agent files with syntax highlighting
- **Duplicate**: Clone existing skills or agents

#### Included Starter Kit
For new users, install a curated collection with one click:

**25 Skills**: Code Review Pro, API Documentation Writer, Git PR Reviewer, Database Schema Designer, Docker Debugger, Dependency Auditor, React Component Generator, CSS Animation Creator, Landing Page Optimizer, Accessibility Auditor, Test Coverage Improver, Performance Profiler, and more.

**5 Agents**: Code Reviewer, Backend Developer, Frontend Developer, Test Engineer, Security Auditor.

### MCP Server Management
- **Quick Install**: One-click installation for popular MCP servers
- **Status Indicator**: See connected server count in toolbar
- **Visual Manager**: Card-style buttons show installed status
- **Toggle Enable/Disable**: Turn servers on/off without removing
- **Supported Servers**:
  - **Filesystem**: Let Claude read/write local files
  - **GitHub**: Interact with repos, issues, and PRs
  - **Puppeteer**: Browser automation and web scraping
  - **Fetch**: HTTP requests and web content
  - **Slack**: Workspace integration
  - **Memory**: Persistent storage across sessions
- **Custom Servers**: Add any MCP server with custom commands and env vars

### Conversation History
- **Browse Past Sessions**: View all previous Claude conversations
- **Search Conversations**: Filter by project or content
- **Message Preview**: Split view shows conversation messages
- **Resume Anytime**: Continue any conversation with one click
- **Project Organization**: Conversations grouped by project folder
- **Pin Favorites**: Pin important conversations for quick access

### Developer Tools
- **Localhost Preview**: Auto-detects dev servers (localhost:3000, etc.) and offers preview
- **Multiple Terminal Tabs**: Create and switch between terminal sessions
- **Toolbelt**: Quick access dropdown for agents and skills insertion
- **Quick Open (Cmd+O)**: Fuzzy file search across your project
- **Terminal Size Display**: Status bar shows current cols x rows
- **Deploy Menu**: Vercel, GitHub Pages, and PR shortcuts

### File Explorer
- **Breadcrumb Navigation**: Click any path segment to jump
- **Right-Click Context Menus**: Open in tab, add to context, show in Finder
- **Recent Files**: Quick access to recently opened files
- **File Search**: Search files with highlighting
- **Expand/Collapse All**: Alt+Cmd+arrow keys to expand or collapse tree
- **Drag & Drop**: Drop folders to set working directory
- **Git Status**: File tree shows modified/staged/untracked indicators

### Document Viewer
View documents directly in the app:
- PDF, Word (.docx), Excel (.xlsx), CSV
- Images (PNG, JPG, GIF, SVG)
- Code/text files with syntax highlighting and line numbers

### Premium UI
- **Modern Home Screen**: Beautiful action grid with glass morphism
- **Toast Notifications**: In-app alerts for success, error, and info
- **8 Terminal Themes**:
  - Default, Pro, Homebrew, Ocean, Dracula, Solarized
  - **Neon**: Cyan/blue with immersive effects
  - **Aurora**: Orange/gold theme
- **Split View**: Terminal and files side by side
- **Smooth Transitions**: Page transitions with animations
- **Reduced Motion**: Respects accessibility preferences
- **Notification Center**: Centralized alerts and activity feed

### Git Integration
- **One-Click Commit**: Stage and commit changes instantly
- **Push to Remote**: Push commits with a single click
- **Create Pull Requests**: Generate PRs directly from the app
- **Git Status**: File indicators for modified/staged files

### Deploy
- **Vercel Integration**: Deploy projects to Vercel with one click
- **GitHub Pages**: Deploy static sites
- **Create PR**: Quick PR creation workflow
- **Live Preview**: Open localhost previews

### Productivity
- **Toolbelt**: Quick access dropdown for agents and skills
- **Project Switcher**: Quick switch between recent projects
- **Command Palette (Cmd+P)**: Fuzzy search over commands
- **Settings Panel**: Configure themes, font size, and more
- **Error Boundaries**: Graceful error handling with recovery

### System
- **One-Click Setup**: Auto-install Claude Code CLI if not present
- **Cross-Platform**: macOS, Windows, and Linux

## Prerequisites

- macOS, Windows, or Linux
- [Claude Code CLI](https://github.com/anthropics/claude-code) (auto-installs if missing)

## Installation

### From Release (Recommended)

1. Go to [Releases](https://github.com/OneWave-AI/ClaudeCodeArena/releases)
2. Download the appropriate installer for your platform:
   - macOS: `.dmg` (universal - works on Intel and Apple Silicon)
   - Windows: `.exe` installer
   - Linux: `.AppImage` or `.deb`

#### macOS Installation

Since the app is not signed with an Apple Developer certificate:

1. **Download** the `.dmg` file from Releases
2. **Open** the DMG and drag "ClaudeCodeUI" to Applications
3. **First launch** - Right-click the app and select "Open"
4. **Allow the app** in System Settings > Privacy & Security > "Open Anyway"
5. The app will now launch normally

### From Source

```bash
# Clone the repository
git clone https://github.com/OneWave-AI/ClaudeCodeArena.git
cd ClaudeCodeArena

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build
```

## Usage

1. **Launch**: Open ClaudeCodeUI - it will check for Claude CLI and offer to install
2. **Select Project**: Click "Open Project" or drag a folder
3. **Start Session**: Click "Start Session" or press Cmd+Enter
4. **Browse History**: Click "History" to view past conversations
5. **Manage Skills**: Click "Skills & Agents" to browse and create extensions
6. **Use Toolbelt**: Click the toolbelt icon to quickly insert agents/skills
7. **Git Actions**: Use the Git dropdown for commits, push, and PRs
8. **Deploy**: Click the deploy button for Vercel/GitHub Pages

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+P` | Command Palette |
| `Cmd+O` | Quick Open File |
| `Cmd+F` | Search Files |
| `Cmd+Shift+P` | Switch Project |
| `Cmd+Enter` | Start Session (from home) |
| `Cmd+\` | Toggle Split View |
| `Cmd+Shift+T` | New Terminal Tab |
| `Cmd+Shift+C` | Git Commit |
| `Cmd+R` | Refresh Files |
| `Cmd+Up` | Go to Parent Directory |
| `Alt+Cmd+Right` | Expand All Directories |
| `Alt+Cmd+Left` | Collapse All Directories |

## Development

```bash
# Start in development mode with hot reload
npm run dev

# Build for current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux

# Type check
npx tsc --noEmit
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 28+ |
| Bundler | electron-vite |
| UI | React 18 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| State | Zustand |
| Terminal | xterm.js + node-pty |
| Icons | Lucide React |
| Docs | mammoth, xlsx, papaparse |

## Project Structure

```
ClaudeCodeUI-V2/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Main entry
│   │   └── ipc/           # IPC handlers (modular)
│   │       ├── terminal.ts
│   │       ├── files.ts
│   │       ├── skills.ts
│   │       ├── mcp.ts
│   │       └── ...
│   │
│   ├── preload/           # Context bridge
│   │   └── index.ts
│   │
│   ├── renderer/          # React app
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── layout/    # Header, Sidebar
│   │   │   ├── terminal/  # Terminal, PreviewBar
│   │   │   ├── files/     # DocumentViewer
│   │   │   ├── skills/    # SkillsManager, MCPManager
│   │   │   ├── history/   # HistoryBrowser
│   │   │   ├── settings/  # SettingsPanel
│   │   │   └── common/    # Toast, Modal, Toolbelt, etc.
│   │   ├── hooks/         # Custom React hooks
│   │   ├── store/         # Zustand stores
│   │   └── styles/
│   │
│   └── shared/
│       └── types.ts       # Shared types
│
├── assets/
│   ├── starter-skills/
│   └── starter-agents/
│
├── electron.vite.config.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## V1 vs V2 Comparison

| V1 Problem | V2 Solution |
|------------|-------------|
| 4000+ line renderer.js | Modular React components |
| Global variables everywhere | Zustand stores |
| No types | Full TypeScript |
| No build system | Vite with HMR |
| 3000+ line CSS file | Tailwind utilities |
| Manual DOM manipulation | React declarative UI |

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with Claude Code
