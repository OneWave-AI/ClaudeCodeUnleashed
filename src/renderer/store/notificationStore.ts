import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: number
  read: boolean
  autoDismiss?: boolean
  autoDismissDelay?: number
  sound?: boolean
  navigateTo?: string
  groupId?: string
}

interface NotificationState {
  notifications: Notification[]
  soundEnabled: boolean

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  clearRead: () => void
  setSoundEnabled: (enabled: boolean) => void

  // Getters
  getUnreadCount: () => number
  getNotificationsByType: (type: NotificationType) => Notification[]
  getNotificationsByGroup: (groupId: string) => Notification[]
  getRecentNotifications: (limit?: number) => Notification[]
}

// Storage key for localStorage persistence
const STORAGE_KEY = 'notification-center-data'
const SOUND_PREF_KEY = 'notification-sound-enabled'

// Load notifications from localStorage
function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Filter out expired auto-dismiss notifications and keep only last 100
      return parsed
        .filter((n: Notification) => {
          if (n.autoDismiss && n.autoDismissDelay) {
            const expiresAt = n.timestamp + n.autoDismissDelay
            return Date.now() < expiresAt
          }
          return true
        })
        .slice(0, 100)
    }
  } catch (e) {
    console.error('Failed to load notifications:', e)
  }
  return []
}

// Load sound preference
function loadSoundPreference(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_PREF_KEY)
    return stored !== null ? JSON.parse(stored) : true
  } catch {
    return true
  }
}

// Save notifications to localStorage
function saveNotifications(notifications: Notification[]) {
  try {
    // Keep only last 100 notifications
    const toSave = notifications.slice(0, 100)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save notifications:', e)
  }
}

// Play notification sound
function playNotificationSound(type: NotificationType) {
  try {
    // Create audio context for notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Different tones for different notification types
    const frequencies: Record<NotificationType, number[]> = {
      success: [880, 1100], // Happy ascending
      error: [440, 330],    // Descending warning
      warning: [660, 550],  // Slight descending
      info: [660, 660],     // Neutral
      system: [880, 880]    // Neutral high
    }

    const freqs = frequencies[type]
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(freqs[0], audioContext.currentTime)
    oscillator.frequency.setValueAtTime(freqs[1], audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (e) {
    // Audio not supported or blocked
    console.debug('Could not play notification sound:', e)
  }
}

// Generate unique ID
function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: loadNotifications(),
  soundEnabled: loadSoundPreference(),

  addNotification: (notification) => {
    const id = generateId()
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false
    }

    set((state) => {
      const updated = [newNotification, ...state.notifications].slice(0, 100)
      saveNotifications(updated)
      return { notifications: updated }
    })

    // Play sound if enabled
    if ((notification.sound !== false) && get().soundEnabled) {
      playNotificationSound(notification.type)
    }

    // Handle auto-dismiss
    if (notification.autoDismiss) {
      const delay = notification.autoDismissDelay || 5000
      setTimeout(() => {
        get().removeNotification(id)
      }, delay)
    }

    return id
  },

  removeNotification: (id) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id)
      saveNotifications(updated)
      return { notifications: updated }
    })
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      saveNotifications(updated)
      return { notifications: updated }
    })
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }))
      saveNotifications(updated)
      return { notifications: updated }
    })
  },

  clearAll: () => {
    set({ notifications: [] })
    saveNotifications([])
  },

  clearRead: () => {
    set((state) => {
      const updated = state.notifications.filter((n) => !n.read)
      saveNotifications(updated)
      return { notifications: updated }
    })
  },

  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(enabled))
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length
  },

  getNotificationsByType: (type) => {
    return get().notifications.filter((n) => n.type === type)
  },

  getNotificationsByGroup: (groupId) => {
    return get().notifications.filter((n) => n.groupId === groupId)
  },

  getRecentNotifications: (limit = 50) => {
    return get().notifications.slice(0, limit)
  }
}))

// Helper functions to send common notifications
export const notifyGitOperation = (
  operation: 'commit' | 'push' | 'pull' | 'fetch' | 'checkout',
  success: boolean,
  message: string
) => {
  const titles: Record<string, string> = {
    commit: success ? 'Commit Successful' : 'Commit Failed',
    push: success ? 'Push Successful' : 'Push Failed',
    pull: success ? 'Pull Successful' : 'Pull Failed',
    fetch: success ? 'Fetch Complete' : 'Fetch Failed',
    checkout: success ? 'Branch Changed' : 'Checkout Failed'
  }

  useNotificationStore.getState().addNotification({
    type: success ? 'success' : 'error',
    title: titles[operation],
    message,
    groupId: 'git',
    navigateTo: 'terminal',
    autoDismiss: success,
    autoDismissDelay: success ? 8000 : undefined
  })
}

export const notifySkillInstalled = (skillName: string, count?: number) => {
  useNotificationStore.getState().addNotification({
    type: 'success',
    title: 'Skill Installed',
    message: count
      ? `${count} skills installed including "${skillName}"`
      : `"${skillName}" is now available`,
    groupId: 'skills',
    navigateTo: 'skills',
    autoDismiss: true,
    autoDismissDelay: 6000
  })
}

export const notifyError = (title: string, message: string, navigateTo?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'error',
    title,
    message,
    navigateTo,
    sound: true
  })
}

export const notifySessionStarted = (projectName: string) => {
  useNotificationStore.getState().addNotification({
    type: 'info',
    title: 'Session Started',
    message: `Working in ${projectName}`,
    groupId: 'session',
    autoDismiss: true,
    autoDismissDelay: 4000
  })
}

export const notifySessionEnded = (duration?: string) => {
  useNotificationStore.getState().addNotification({
    type: 'system',
    title: 'Session Ended',
    message: duration ? `Session duration: ${duration}` : 'Your session has ended',
    groupId: 'session',
    autoDismiss: true,
    autoDismissDelay: 5000
  })
}

export const notifySystem = (title: string, message: string) => {
  useNotificationStore.getState().addNotification({
    type: 'system',
    title,
    message
  })
}
