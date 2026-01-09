import { useEffect, useCallback, useRef } from 'react'

/**
 * Keyboard shortcut string format: modifier+key
 * Examples: 'cmd+p', 'cmd+shift+t', 'cmd+1'
 */
export type ShortcutKey =
  | 'cmd+p'
  | 'cmd+o'
  | 'cmd+k'
  | 'cmd+,'
  | 'cmd+enter'
  | 'cmd+\\'
  | 'cmd+shift+t'
  | 'cmd+w'
  | 'cmd+1'
  | 'cmd+2'
  | 'cmd+3'
  | 'cmd+4'
  | 'cmd+5'
  | 'cmd+6'
  | 'cmd+7'
  | 'cmd+8'
  | 'cmd+9'
  | (string & {}) // Allow custom shortcuts while maintaining autocomplete

export type ShortcutCallback = (event: KeyboardEvent) => void

export type ShortcutMap = Partial<Record<ShortcutKey, ShortcutCallback>>

interface ParsedShortcut {
  cmd: boolean
  shift: boolean
  alt: boolean
  ctrl: boolean
  key: string
}

/**
 * Parses a shortcut string into its component parts
 * @param shortcut - The shortcut string (e.g., 'cmd+shift+t')
 * @returns ParsedShortcut object
 */
function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+')
  const key = parts[parts.length - 1]

  return {
    cmd: parts.includes('cmd') || parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    key,
  }
}

/**
 * Normalizes a keyboard event key to match shortcut format
 * @param event - The keyboard event
 * @returns Normalized key string
 */
function normalizeKey(event: KeyboardEvent): string {
  const key = event.key.toLowerCase()

  // Map special keys to consistent names
  const keyMap: Record<string, string> = {
    enter: 'enter',
    escape: 'escape',
    backspace: 'backspace',
    tab: 'tab',
    ' ': 'space',
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    '\\': '\\',
    '/': '/',
    ',': ',',
    '.': '.',
    ';': ';',
    "'": "'",
    '[': '[',
    ']': ']',
    '-': '-',
    '=': '=',
    '`': '`',
  }

  return keyMap[key] ?? key
}

/**
 * Checks if a keyboard event matches a parsed shortcut
 * @param event - The keyboard event
 * @param shortcut - The parsed shortcut
 * @returns boolean indicating match
 */
function matchesShortcut(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  const key = normalizeKey(event)

  // On Mac, metaKey is the Cmd key
  const cmdPressed = event.metaKey
  const shiftPressed = event.shiftKey
  const altPressed = event.altKey
  const ctrlPressed = event.ctrlKey

  return (
    shortcut.cmd === cmdPressed &&
    shortcut.shift === shiftPressed &&
    shortcut.alt === altPressed &&
    shortcut.ctrl === ctrlPressed &&
    shortcut.key === key
  )
}

/**
 * Custom hook for registering global keyboard shortcuts
 *
 * @param shortcuts - Map of shortcut keys to callback functions
 * @param enabled - Whether shortcuts should be active (default: true)
 *
 * @example
 * ```typescript
 * useKeyboardShortcuts({
 *   'cmd+p': () => openCommandPalette(),
 *   'cmd+,': () => openSettings(),
 *   'cmd+shift+t': () => newTerminalTab(),
 * })
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled: boolean = true
): void {
  // Use ref to avoid stale closure issues with the callback
  const shortcutsRef = useRef<ShortcutMap>(shortcuts)

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Skip if user is typing in an input field (unless it's a global shortcut)
      const target = event.target as HTMLElement
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Get current shortcuts from ref
      const currentShortcuts = shortcutsRef.current

      for (const [shortcutStr, callback] of Object.entries(currentShortcuts)) {
        if (!callback) continue

        const parsedShortcut = parseShortcut(shortcutStr)

        if (matchesShortcut(event, parsedShortcut)) {
          // For input fields, only allow certain shortcuts to pass through
          // (e.g., Cmd+Enter should still work in inputs)
          const allowInInput = ['cmd+enter', 'cmd+k', 'cmd+p', 'cmd+,'].includes(
            shortcutStr.toLowerCase()
          )

          if (isInputField && !allowInInput) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          callback(event)
          return
        }
      }
    },
    [enabled]
  )

  useEffect(() => {
    if (!enabled) return

    // Use capture phase to intercept events before they reach other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleKeyDown, enabled])
}

/**
 * Predefined shortcut descriptions for documentation/UI display
 */
export const SHORTCUT_DESCRIPTIONS: Record<ShortcutKey, string> = {
  'cmd+p': 'Open command palette',
  'cmd+o': 'Open quick file dialog',
  'cmd+k': 'Clear terminal',
  'cmd+,': 'Open settings',
  'cmd+enter': 'Start new session',
  'cmd+\\': 'Toggle sidebar',
  'cmd+shift+t': 'New terminal tab',
  'cmd+w': 'Close current terminal tab',
  'cmd+1': 'Switch to terminal tab 1',
  'cmd+2': 'Switch to terminal tab 2',
  'cmd+3': 'Switch to terminal tab 3',
  'cmd+4': 'Switch to terminal tab 4',
  'cmd+5': 'Switch to terminal tab 5',
  'cmd+6': 'Switch to terminal tab 6',
  'cmd+7': 'Switch to terminal tab 7',
  'cmd+8': 'Switch to terminal tab 8',
  'cmd+9': 'Switch to terminal tab 9',
}

/**
 * Formats a shortcut key for display (e.g., 'cmd+shift+t' -> 'Cmd+Shift+T')
 */
export function formatShortcutForDisplay(shortcut: ShortcutKey): string {
  return shortcut
    .split('+')
    .map((part) => {
      switch (part.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return '\u2318' // Command symbol
        case 'shift':
          return '\u21E7' // Shift symbol
        case 'alt':
        case 'option':
          return '\u2325' // Option symbol
        case 'ctrl':
        case 'control':
          return '\u2303' // Control symbol
        case 'enter':
          return '\u21A9' // Return symbol
        case 'backspace':
          return '\u232B' // Delete symbol
        case 'escape':
          return 'Esc'
        case '\\':
          return '\\'
        default:
          return part.toUpperCase()
      }
    })
    .join('')
}

export default useKeyboardShortcuts
