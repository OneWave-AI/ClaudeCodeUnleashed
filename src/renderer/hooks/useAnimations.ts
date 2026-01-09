import { useEffect, useRef, useState, useCallback, RefObject } from 'react'

/**
 * Hook to detect if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook for scroll-triggered animations using Intersection Observer
 */
interface UseScrollAnimationOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
  delay?: number
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {}
): [RefObject<T | null>, boolean] {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true, delay = 0 } = options
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setIsVisible(true), delay)
          } else {
            setIsVisible(true)
          }
          if (triggerOnce) {
            observer.unobserve(element)
          }
        } else if (!triggerOnce) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, triggerOnce, delay, prefersReducedMotion])

  return [ref, isVisible]
}

/**
 * Hook for staggered list animations
 */
interface UseStaggeredListOptions {
  staggerDelay?: number
  baseDelay?: number
  threshold?: number
}

export function useStaggeredList<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  options: UseStaggeredListOptions = {}
): [RefObject<T | null>, boolean[]] {
  const { staggerDelay = 50, baseDelay = 0, threshold = 0.1 } = options
  const containerRef = useRef<T>(null)
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    new Array(itemCount).fill(false)
  )
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleItems(new Array(itemCount).fill(true))
      return
    }

    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger the visibility of each item
          for (let i = 0; i < itemCount; i++) {
            setTimeout(() => {
              setVisibleItems((prev) => {
                const next = [...prev]
                next[i] = true
                return next
              })
            }, baseDelay + i * staggerDelay)
          }
          observer.unobserve(container)
        }
      },
      { threshold }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [itemCount, staggerDelay, baseDelay, threshold, prefersReducedMotion])

  return [containerRef, visibleItems]
}

/**
 * Hook for animated mount/unmount
 */
interface UseAnimatedMountOptions {
  duration?: number
  onExited?: () => void
}

export function useAnimatedMount(
  isOpen: boolean,
  options: UseAnimatedMountOptions = {}
): { shouldRender: boolean; isAnimating: boolean; isVisible: boolean } {
  const { duration = 200, onExited } = options
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Trigger animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true)
        })
      })
    } else {
      setIsVisible(false)
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false)
        onExited?.()
      }, prefersReducedMotion ? 0 : duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onExited, prefersReducedMotion])

  return {
    shouldRender,
    isAnimating: shouldRender && !isVisible,
    isVisible
  }
}

/**
 * Hook for page transitions
 */
type PageTransitionState = 'entering' | 'entered' | 'exiting' | 'exited'

interface UsePageTransitionOptions {
  enterDuration?: number
  exitDuration?: number
}

export function usePageTransition(
  isActive: boolean,
  options: UsePageTransitionOptions = {}
): PageTransitionState {
  const { enterDuration = 300, exitDuration = 200 } = options
  const [state, setState] = useState<PageTransitionState>(
    isActive ? 'entered' : 'exited'
  )
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (isActive) {
      setState('entering')
      const timer = setTimeout(
        () => setState('entered'),
        prefersReducedMotion ? 0 : enterDuration
      )
      return () => clearTimeout(timer)
    } else {
      setState('exiting')
      const timer = setTimeout(
        () => setState('exited'),
        prefersReducedMotion ? 0 : exitDuration
      )
      return () => clearTimeout(timer)
    }
  }, [isActive, enterDuration, exitDuration, prefersReducedMotion])

  return state
}

/**
 * Hook for success/error feedback animations
 */
type FeedbackType = 'success' | 'error' | 'warning' | 'none'

interface UseFeedbackAnimationReturn {
  feedbackType: FeedbackType
  triggerSuccess: () => void
  triggerError: () => void
  triggerWarning: () => void
  reset: () => void
}

export function useFeedbackAnimation(
  duration: number = 500
): UseFeedbackAnimationReturn {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('none')
  const timeoutRef = useRef<NodeJS.Timeout>()

  const trigger = useCallback(
    (type: FeedbackType) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      setFeedbackType(type)
      timeoutRef.current = setTimeout(() => {
        setFeedbackType('none')
      }, duration)
    },
    [duration]
  )

  const triggerSuccess = useCallback(() => trigger('success'), [trigger])
  const triggerError = useCallback(() => trigger('error'), [trigger])
  const triggerWarning = useCallback(() => trigger('warning'), [trigger])
  const reset = useCallback(() => setFeedbackType('none'), [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    feedbackType,
    triggerSuccess,
    triggerError,
    triggerWarning,
    reset
  }
}

/**
 * Hook for ripple effect on click
 */
interface Ripple {
  x: number
  y: number
  id: number
}

export function useRipple(): [
  Ripple[],
  (event: React.MouseEvent<HTMLElement>) => void,
  () => void
] {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const prefersReducedMotion = usePrefersReducedMotion()

  const addRipple = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (prefersReducedMotion) return

      const element = event.currentTarget
      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const id = Date.now()

      setRipples((prev) => [...prev, { x, y, id }])

      // Clean up ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id))
      }, 600)
    },
    [prefersReducedMotion]
  )

  const clearRipples = useCallback(() => setRipples([]), [])

  return [ripples, addRipple, clearRipples]
}

/**
 * Hook for typewriter animation
 */
interface UseTypewriterOptions {
  speed?: number
  delay?: number
}

export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
): string {
  const { speed = 50, delay = 0 } = options
  const [displayText, setDisplayText] = useState('')
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayText(text)
      return
    }

    setDisplayText('')
    let currentIndex = 0

    const startTyping = () => {
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, speed)
      return interval
    }

    const delayTimeout = setTimeout(startTyping, delay)
    return () => clearTimeout(delayTimeout)
  }, [text, speed, delay, prefersReducedMotion])

  return displayText
}
