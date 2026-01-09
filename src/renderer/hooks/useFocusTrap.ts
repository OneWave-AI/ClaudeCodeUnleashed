import { useEffect, useRef, useCallback } from 'react'

/**
 * A hook that traps focus within a container element.
 * Useful for modals, dialogs, and other overlay components.
 *
 * @param isActive - Whether the focus trap should be active
 * @param options - Configuration options
 * @returns A ref to attach to the container element
 */

interface FocusTrapOptions {
  /** Whether to restore focus to the previously focused element when deactivated */
  restoreFocus?: boolean
  /** Whether to automatically focus the first focusable element when activated */
  autoFocus?: boolean
  /** Initial element to focus (selector or element) */
  initialFocus?: string | HTMLElement | null
  /** Element to focus when trap is deactivated (overrides restoreFocus) */
  returnFocus?: HTMLElement | null
}

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ')

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isActive: boolean,
  options: FocusTrapOptions = {}
) {
  const {
    restoreFocus = true,
    autoFocus = true,
    initialFocus = null,
    returnFocus = null
  } = options

  const containerRef = useRef<T>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []

    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    return Array.from(elements).filter(el => {
      // Check if element is visible
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
    })
  }, [])

  // Handle Tab key to trap focus
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement as HTMLElement

    if (event.shiftKey) {
      // Shift + Tab: Move focus backwards
      if (activeElement === firstElement || !containerRef.current?.contains(activeElement)) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: Move focus forwards
      if (activeElement === lastElement || !containerRef.current?.contains(activeElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }, [getFocusableElements])

  // Activate focus trap
  useEffect(() => {
    if (!isActive) return

    // Store the currently focused element for restoration
    if (restoreFocus || returnFocus) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement
    }

    // Auto focus the first element or initial focus
    if (autoFocus) {
      const focusInitial = () => {
        if (initialFocus) {
          const element = typeof initialFocus === 'string'
            ? containerRef.current?.querySelector<HTMLElement>(initialFocus)
            : initialFocus
          if (element) {
            element.focus()
            return
          }
        }

        // Focus the first focusable element
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        } else if (containerRef.current) {
          // If no focusable elements, focus the container itself
          containerRef.current.tabIndex = -1
          containerRef.current.focus()
        }
      }

      // Slight delay to ensure the modal is rendered
      requestAnimationFrame(focusInitial)
    }

    // Add event listener for Tab key
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Restore focus on deactivation
      if (returnFocus) {
        returnFocus.focus()
      } else if (restoreFocus && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus()
      }
    }
  }, [isActive, autoFocus, initialFocus, restoreFocus, returnFocus, handleKeyDown, getFocusableElements])

  return containerRef
}

/**
 * Returns whether prefers-reduced-motion is enabled
 */
export function usePrefersReducedMotion(): boolean {
  const mediaQuery = useRef<MediaQueryList | null>(null)
  const getInitialState = () => {
    if (typeof window === 'undefined') return false
    mediaQuery.current = window.matchMedia('(prefers-reduced-motion: reduce)')
    return mediaQuery.current.matches
  }

  const prefersReducedMotion = useRef(getInitialState())

  useEffect(() => {
    if (!mediaQuery.current) return

    const handleChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion.current = event.matches
    }

    mediaQuery.current.addEventListener('change', handleChange)
    return () => mediaQuery.current?.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion.current
}

export default useFocusTrap
