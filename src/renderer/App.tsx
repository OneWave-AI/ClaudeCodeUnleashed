import { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import HomeScreen from './components/HomeScreen'
import TerminalWrapper from './components/terminal/TerminalWrapper'
import SkillsManager from './components/skills/SkillsManager'
import HistoryBrowser from './components/history/HistoryBrowser'
import SettingsPanel from './components/settings/SettingsPanel'
import { ToastProvider } from './components/common/Toast'
import { useAppStore } from './store'
import { SuperAgentModal, SuperAgentStatusBar } from './components/superagent'
import { useSuperAgent } from './hooks/useSuperAgent'

type Screen = 'home' | 'terminal' | 'skills' | 'history'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [claudeInstalled, setClaudeInstalled] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [terminalMounted, setTerminalMounted] = useState(false)
  const [superAgentModalOpen, setSuperAgentModalOpen] = useState(false)
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const pendingSuperAgentOpen = useRef(false) // Flag to open modal when terminal is ready
  const { cwd, setCwd } = useAppStore()
  const { isRunning: superAgentRunning, stopSuperAgent, processOutput } = useSuperAgent()

  // Initialize
  useEffect(() => {
    window.api.checkClaudeInstalled().then(setClaudeInstalled)
    window.api.getCwd().then(setCwd)
  }, [setCwd])

  // Navigation
  const navigateTo = useCallback((newScreen: Screen) => {
    console.log('Navigating to:', newScreen)
    setScreen(newScreen)
    if (newScreen === 'terminal') {
      setTerminalMounted(true)
    }
  }, [])

  const handleStartSession = useCallback(() => {
    console.log('Starting session with cwd:', cwd)
    navigateTo('terminal')
  }, [navigateTo, cwd])

  const handleSelectFolder = useCallback(async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setCwd(folder)
      await window.api.setCwd(folder)
    }
  }, [setCwd])

  const handleNavigate = useCallback((screenName: string) => {
    if (['home', 'terminal', 'skills', 'history'].includes(screenName)) {
      navigateTo(screenName as Screen)
    }
  }, [navigateTo])

  return (
    <ToastProvider>
      <div className="flex h-full flex-col bg-[#0d0d0d]">
        <Header
          cwd={cwd}
          onSelectFolder={handleSelectFolder}
          onHome={() => navigateTo('home')}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCommandPalette={() => {}}
          screen={screen}
          onNavigate={handleNavigate}
          onOpenPreview={(url) => setPreviewUrl(url)}
          onOpenSuperAgent={() => setSuperAgentModalOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - only on terminal screen */}
          {screen === 'terminal' && (
            <Sidebar cwd={cwd} onSelectFolder={handleSelectFolder} />
          )}

          {/* Main content */}
          <main className={`flex-1 overflow-hidden ${screen === 'terminal' ? 'flex' : ''}`}>
            {screen === 'home' && (
              <HomeScreen
                cwd={cwd}
                claudeInstalled={claudeInstalled}
                onStartSession={handleStartSession}
                onSelectFolder={handleSelectFolder}
                onOpenSkills={() => navigateTo('skills')}
                onOpenHistory={() => navigateTo('history')}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenSuperAgent={() => {
                  // Start a terminal session first
                  navigateTo('terminal')
                  // If we already have a terminal ID, open modal now
                  if (activeTerminalId) {
                    setSuperAgentModalOpen(true)
                  } else {
                    // Otherwise, flag to open when terminal is ready
                    pendingSuperAgentOpen.current = true
                  }
                }}
              />
            )}

            {screen === 'terminal' && terminalMounted && (
              <TerminalWrapper
                onOpenSettings={() => setSettingsOpen(true)}
                onTerminalData={processOutput}
                onTerminalIdChange={(terminalId) => {
                  setActiveTerminalId(terminalId)
                  // Check if we were waiting to open Super Agent modal
                  if (terminalId && pendingSuperAgentOpen.current) {
                    pendingSuperAgentOpen.current = false
                    setSuperAgentModalOpen(true)
                  }
                }}
                previewUrl={previewUrl}
                onClosePreview={() => setPreviewUrl(null)}
                onOpenPreview={(url) => setPreviewUrl(url)}
              />
            )}

            {screen === 'skills' && (
              <SkillsManager onBack={() => navigateTo('home')} />
            )}

            {screen === 'history' && (
              <HistoryBrowser
                onBack={() => navigateTo('home')}
                onResumeSession={(conversation) => {
                  setCwd(conversation.projectFolder)
                  window.api.setCwd(conversation.projectFolder)
                  navigateTo('terminal')
                }}
              />
            )}

            {/* Super Agent Status Panel - integrated into layout */}
            {superAgentRunning && screen === 'terminal' && (
              <SuperAgentStatusBar onStop={stopSuperAgent} />
            )}
          </main>
        </div>

        {/* Settings Panel */}
        <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Super Agent Modal */}
        <SuperAgentModal
          isOpen={superAgentModalOpen}
          onClose={() => setSuperAgentModalOpen(false)}
          terminalId={activeTerminalId || ''}
          onStart={() => setSuperAgentModalOpen(false)}
        />

      </div>
    </ToastProvider>
  )
}

export default App
