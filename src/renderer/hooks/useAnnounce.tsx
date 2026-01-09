import { useCallback, useEffect, useRef } from 'react'

/**
 * Types of announcements for screen readers
 */
export type AnnouncementPoliteness = 'polite' | 'assertive'

/**
 * Creates and manages a live region for screen reader announcements.
 *
 * @returns Object with announce function and clear function
 */
export function useAnnounce() {
  const politeRegionRef = useRef<HTMLDivElement | null>(null)
  const assertiveRegionRef = useRef<HTMLDivElement | null>(null)

  // Create live regions on mount
  useEffect(() => {
    // Create polite live region
    const politeRegion = document.createElement('div')
    politeRegion.setAttribute('role', 'status')
    politeRegion.setAttribute('aria-live', 'polite')
    politeRegion.setAttribute('aria-atomic', 'true')
    politeRegion.className = 'sr-only'
    politeRegion.id = 'aria-live-polite'
    document.body.appendChild(politeRegion)
    politeRegionRef.current = politeRegion

    // Create assertive live region
    const assertiveRegion = document.createElement('div')
    assertiveRegion.setAttribute('role', 'alert')
    assertiveRegion.setAttribute('aria-live', 'assertive')
    assertiveRegion.setAttribute('aria-atomic', 'true')
    assertiveRegion.className = 'sr-only'
    assertiveRegion.id = 'aria-live-assertive'
    document.body.appendChild(assertiveRegion)
    assertiveRegionRef.current = assertiveRegion

    // Cleanup on unmount
    return () => {
      if (politeRegion.parentNode) {
        politeRegion.parentNode.removeChild(politeRegion)
      }
      if (assertiveRegion.parentNode) {
        assertiveRegion.parentNode.removeChild(assertiveRegion)
      }
    }
  }, [])

  /**
   * Announce a message to screen readers
   *
   * @param message - The message to announce
   * @param politeness - 'polite' (waits for user pause) or 'assertive' (interrupts immediately)
   */
  const announce = useCallback((message: string, politeness: AnnouncementPoliteness = 'polite') => {
    const region = politeness === 'assertive' ? assertiveRegionRef.current : politeRegionRef.current

    if (!region) return

    // Clear the region first to ensure the new message is announced
    region.textContent = ''

    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(() => {
      region.textContent = message
    })
  }, [])

  /**
   * Clear all announcements
   */
  const clearAnnouncements = useCallback(() => {
    if (politeRegionRef.current) {
      politeRegionRef.current.textContent = ''
    }
    if (assertiveRegionRef.current) {
      assertiveRegionRef.current.textContent = ''
    }
  }, [])

  return {
    announce,
    clearAnnouncements
  }
}

/**
 * Announce page/route changes to screen readers
 */
export function useRouteAnnouncer() {
  const { announce } = useAnnounce()

  const announceRouteChange = useCallback((pageName: string) => {
    announce(`Navigated to ${pageName}`, 'polite')
  }, [announce])

  return announceRouteChange
}

/**
 * Context for providing announcement capabilities throughout the app.
 * This allows any component to announce messages without creating new live regions.
 */
import { createContext, useContext, ReactNode } from 'react'

interface AnnounceContextValue {
  announce: (message: string, politeness?: AnnouncementPoliteness) => void
  clearAnnouncements: () => void
}

const AnnounceContext = createContext<AnnounceContextValue | null>(null)

export function AnnounceProvider({ children }: { children: ReactNode }) {
  const { announce, clearAnnouncements } = useAnnounce()

  return (
    <AnnounceContext.Provider value={{ announce, clearAnnouncements }}>
      {children}
    </AnnounceContext.Provider>
  )
}

export function useAnnounceContext() {
  const context = useContext(AnnounceContext)
  if (!context) {
    throw new Error('useAnnounceContext must be used within an AnnounceProvider')
  }
  return context
}

export default useAnnounce
