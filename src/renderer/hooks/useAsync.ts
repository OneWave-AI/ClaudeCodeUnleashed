import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Async operation state
 */
export interface AsyncState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  isIdle: boolean
}

/**
 * Async operation result with control methods
 */
export interface UseAsyncResult<T, Args extends unknown[]> extends AsyncState<T> {
  /** Execute the async function */
  execute: (...args: Args) => Promise<T | null>
  /** Retry the last execution with same arguments */
  retry: () => Promise<T | null>
  /** Reset state to initial values */
  reset: () => void
  /** Set data manually */
  setData: (data: T | null) => void
  /** Set error manually */
  setError: (error: Error | null) => void
}

/**
 * Options for useAsync hook
 */
export interface UseAsyncOptions<T> {
  /** Initial data value */
  initialData?: T | null
  /** Execute immediately on mount */
  immediate?: boolean
  /** Arguments for immediate execution */
  immediateArgs?: unknown[]
  /** Callback on success */
  onSuccess?: (data: T) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Number of retries on failure */
  retries?: number
  /** Delay between retries in ms */
  retryDelay?: number
  /** Whether to reset error on new execution */
  resetErrorOnExecute?: boolean
}

/**
 * Creates initial async state
 */
function createInitialState<T>(initialData?: T | null): AsyncState<T> {
  return {
    data: initialData ?? null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    isIdle: true
  }
}

/**
 * Hook for handling async operations with loading, error, and data states
 *
 * @param asyncFn - The async function to wrap
 * @param options - Configuration options
 * @returns Async state and control methods
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, execute, retry } = useAsync(
 *   async (userId: string) => {
 *     return await window.api.getUser(userId)
 *   },
 *   { onError: (err) => showToast('error', err.message) }
 * )
 *
 * // Execute manually
 * await execute('user-123')
 *
 * // Or retry with same args
 * await retry()
 * ```
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncResult<T, Args> {
  const {
    initialData = null,
    immediate = false,
    immediateArgs = [],
    onSuccess,
    onError,
    retries = 0,
    retryDelay = 1000,
    resetErrorOnExecute = true
  } = options

  const [state, setState] = useState<AsyncState<T>>(() => createInitialState(initialData))

  // Track mounted state to prevent updates after unmount
  const mountedRef = useRef(true)
  // Store last arguments for retry
  const lastArgsRef = useRef<Args | null>(null)
  // Track current retry count
  const retryCountRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /**
   * Execute the async function with retry logic
   */
  const executeWithRetry = useCallback(async (
    args: Args,
    currentRetry = 0
  ): Promise<T | null> => {
    if (!mountedRef.current) return null

    try {
      const result = await asyncFn(...args)

      if (!mountedRef.current) return null

      setState({
        data: result,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
        isIdle: false
      })

      retryCountRef.current = 0
      onSuccess?.(result)
      return result
    } catch (error) {
      if (!mountedRef.current) return null

      const err = error instanceof Error ? error : new Error(String(error))

      // Retry logic
      if (currentRetry < retries) {
        retryCountRef.current = currentRetry + 1
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return executeWithRetry(args, currentRetry + 1)
      }

      setState({
        data: null,
        error: err,
        isLoading: false,
        isSuccess: false,
        isError: true,
        isIdle: false
      })

      retryCountRef.current = 0
      onError?.(err)
      return null
    }
  }, [asyncFn, onSuccess, onError, retries, retryDelay])

  /**
   * Main execute function
   */
  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    if (!mountedRef.current) return null

    lastArgsRef.current = args

    setState(prev => ({
      ...prev,
      isLoading: true,
      isIdle: false,
      ...(resetErrorOnExecute ? { error: null, isError: false } : {})
    }))

    return executeWithRetry(args)
  }, [executeWithRetry, resetErrorOnExecute])

  /**
   * Retry with last arguments
   */
  const retry = useCallback(async (): Promise<T | null> => {
    if (!lastArgsRef.current) {
      console.warn('[useAsync] No previous execution to retry')
      return null
    }
    return execute(...lastArgsRef.current)
  }, [execute])

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    if (!mountedRef.current) return
    setState(createInitialState(initialData))
    lastArgsRef.current = null
    retryCountRef.current = 0
  }, [initialData])

  /**
   * Set data manually
   */
  const setData = useCallback((data: T | null) => {
    if (!mountedRef.current) return
    setState(prev => ({
      ...prev,
      data,
      isSuccess: data !== null,
      isError: false,
      error: null
    }))
  }, [])

  /**
   * Set error manually
   */
  const setError = useCallback((error: Error | null) => {
    if (!mountedRef.current) return
    setState(prev => ({
      ...prev,
      error,
      isError: error !== null,
      isSuccess: false
    }))
  }, [])

  // Execute immediately on mount if specified
  useEffect(() => {
    if (immediate) {
      execute(...(immediateArgs as Args))
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...state,
    execute,
    retry,
    reset,
    setData,
    setError
  }
}

/**
 * Simplified hook for IPC calls with built-in error handling
 */
export function useIpc<T, Args extends unknown[] = []>(
  ipcFn: (...args: Args) => Promise<T>,
  options: Omit<UseAsyncOptions<T>, 'retries' | 'retryDelay'> & {
    /** Show toast on error */
    showToastOnError?: boolean
    /** Custom error message */
    errorMessage?: string
  } = {}
): UseAsyncResult<T, Args> {
  const { showToastOnError = true, errorMessage, ...asyncOptions } = options

  return useAsync(ipcFn, {
    ...asyncOptions,
    retries: 2,
    retryDelay: 500,
    onError: (error) => {
      if (showToastOnError) {
        // Use console.error in development as a placeholder
        // In production, this would integrate with the toast system
        console.error('[IPC Error]', errorMessage || error.message)
      }
      asyncOptions.onError?.(error)
    }
  })
}

/**
 * Hook for polling async operations
 */
export function useAsyncPolling<T>(
  asyncFn: () => Promise<T>,
  interval: number,
  options: UseAsyncOptions<T> & {
    /** Whether polling is enabled */
    enabled?: boolean
  } = {}
): UseAsyncResult<T, []> {
  const { enabled = true, ...asyncOptions } = options
  const result = useAsync(asyncFn, asyncOptions)

  useEffect(() => {
    if (!enabled) return

    // Initial execution
    result.execute()

    // Set up polling
    const pollInterval = setInterval(() => {
      result.execute()
    }, interval)

    return () => clearInterval(pollInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval])

  return result
}

export default useAsync
