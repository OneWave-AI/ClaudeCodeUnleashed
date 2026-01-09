import { create } from 'zustand'
import type { AppSettings, CustomTheme } from '../../shared/types'

// Debounce helper
let saveTimeout: NodeJS.Timeout | null = null
const debouncedSave = (saveFn: () => Promise<void>) => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveFn()
  }, 500) // Wait 500ms after last change before saving
}

interface AppState {
  // Current working directory
  cwd: string
  setCwd: (cwd: string) => void

  // Theme
  theme: string
  setTheme: (theme: string) => void

  // Terminal tabs
  activeTerminalId: string | null
  setActiveTerminalId: (id: string | null) => void

  // All settings
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void

  // Settings loading state
  settingsLoaded: boolean
  setSettingsLoaded: (loaded: boolean) => void

  // Convenience getters/setters for common settings
  fontSize: number
  setFontSize: (size: number) => void
  fontFamily: string
  setFontFamily: (family: string) => void
  lineHeight: number
  setLineHeight: (height: number) => void
  cursorStyle: 'block' | 'underline' | 'bar'
  setCursorStyle: (style: 'block' | 'underline' | 'bar') => void
  cursorBlink: boolean
  setCursorBlink: (blink: boolean) => void
  bellSound: boolean
  setBellSound: (sound: boolean) => void
  scrollbackBuffer: number
  setScrollbackBuffer: (size: number) => void
  windowOpacity: number
  setWindowOpacity: (opacity: number) => void
  confirmBeforeClose: boolean
  setConfirmBeforeClose: (confirm: boolean) => void
  autoUpdate: boolean
  setAutoUpdate: (auto: boolean) => void
  claudeApiKey: string
  setClaudeApiKey: (key: string) => void

  // Custom themes
  customThemes: CustomTheme[]
  setCustomThemes: (themes: CustomTheme[]) => void
  addCustomTheme: (theme: CustomTheme) => void
  removeCustomTheme: (themeId: string) => void

  // Initialize settings from storage
  initializeSettings: () => Promise<void>
  saveAllSettings: () => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'default',
  customThemes: [],
  windowOpacity: 1.0,
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  lineHeight: 1.4,
  cursorStyle: 'block',
  cursorBlink: true,
  bellSound: false,
  scrollbackBuffer: 10000,
  confirmBeforeClose: true,
  showTabCloseButton: true,
  autoUpdate: true,
  claudeApiKey: ''
}

export const useAppStore = create<AppState>((set, get) => ({
  cwd: '',
  setCwd: (cwd) => set({ cwd }),

  theme: 'default',
  setTheme: (theme) => {
    set({ theme })
    const settings = { ...get().settings, theme }
    set({ settings })
    get().saveAllSettings()
  },

  activeTerminalId: null,
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),

  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => {
    set({
      settings,
      theme: settings.theme,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      lineHeight: settings.lineHeight,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      bellSound: settings.bellSound,
      scrollbackBuffer: settings.scrollbackBuffer,
      windowOpacity: settings.windowOpacity,
      confirmBeforeClose: settings.confirmBeforeClose,
      autoUpdate: settings.autoUpdate,
      claudeApiKey: settings.claudeApiKey,
      customThemes: settings.customThemes
    })
  },

  updateSetting: (key, value) => {
    const settings = { ...get().settings, [key]: value }
    set({ settings, [key]: value })
    get().saveAllSettings()
  },

  settingsLoaded: false,
  setSettingsLoaded: (loaded) => set({ settingsLoaded: loaded }),

  // Individual settings with auto-save
  fontSize: 14,
  setFontSize: (fontSize) => {
    set({ fontSize })
    const settings = { ...get().settings, fontSize }
    set({ settings })
    get().saveAllSettings()
  },

  fontFamily: 'JetBrains Mono',
  setFontFamily: (fontFamily) => {
    set({ fontFamily })
    const settings = { ...get().settings, fontFamily }
    set({ settings })
    get().saveAllSettings()
  },

  lineHeight: 1.4,
  setLineHeight: (lineHeight) => {
    set({ lineHeight })
    const settings = { ...get().settings, lineHeight }
    set({ settings })
    get().saveAllSettings()
  },

  cursorStyle: 'block',
  setCursorStyle: (cursorStyle) => {
    set({ cursorStyle })
    const settings = { ...get().settings, cursorStyle }
    set({ settings })
    get().saveAllSettings()
  },

  cursorBlink: true,
  setCursorBlink: (cursorBlink) => {
    set({ cursorBlink })
    const settings = { ...get().settings, cursorBlink }
    set({ settings })
    get().saveAllSettings()
  },

  bellSound: false,
  setBellSound: (bellSound) => {
    set({ bellSound })
    const settings = { ...get().settings, bellSound }
    set({ settings })
    get().saveAllSettings()
  },

  scrollbackBuffer: 10000,
  setScrollbackBuffer: (scrollbackBuffer) => {
    set({ scrollbackBuffer })
    const settings = { ...get().settings, scrollbackBuffer }
    set({ settings })
    get().saveAllSettings()
  },

  windowOpacity: 1.0,
  setWindowOpacity: (windowOpacity) => {
    set({ windowOpacity })
    const settings = { ...get().settings, windowOpacity }
    set({ settings })
    window.api?.setWindowOpacity(windowOpacity)
    get().saveAllSettings()
  },

  confirmBeforeClose: true,
  setConfirmBeforeClose: (confirmBeforeClose) => {
    set({ confirmBeforeClose })
    const settings = { ...get().settings, confirmBeforeClose }
    set({ settings })
    get().saveAllSettings()
  },

  autoUpdate: true,
  setAutoUpdate: (autoUpdate) => {
    set({ autoUpdate })
    const settings = { ...get().settings, autoUpdate }
    set({ settings })
    get().saveAllSettings()
  },

  claudeApiKey: '',
  setClaudeApiKey: (claudeApiKey) => {
    set({ claudeApiKey })
    const settings = { ...get().settings, claudeApiKey }
    set({ settings })
    get().saveAllSettings()
  },

  customThemes: [],
  setCustomThemes: (customThemes) => {
    set({ customThemes })
    const settings = { ...get().settings, customThemes }
    set({ settings })
  },

  addCustomTheme: (theme) => {
    const customThemes = [...get().customThemes, theme]
    set({ customThemes })
    const settings = { ...get().settings, customThemes }
    set({ settings })
    get().saveAllSettings()
  },

  removeCustomTheme: (themeId) => {
    const customThemes = get().customThemes.filter(t => t.id !== themeId)
    set({ customThemes })
    const settings = { ...get().settings, customThemes }
    set({ settings })
    get().saveAllSettings()
  },

  initializeSettings: async () => {
    try {
      const settings = await window.api?.loadSettings()
      if (settings) {
        get().setSettings(settings)
        // Apply window opacity
        if (settings.windowOpacity !== 1.0) {
          window.api?.setWindowOpacity(settings.windowOpacity)
        }
      }
      set({ settingsLoaded: true })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ settingsLoaded: true })
    }
  },

  saveAllSettings: async () => {
    debouncedSave(async () => {
      try {
        const settings = get().settings
        await window.api?.saveSettings(settings)
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    })
  }
}))
