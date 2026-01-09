// Common components barrel export
export { default as CommandPalette, useCommandPalette } from './CommandPalette'
export type { Command } from './CommandPalette'

export { default as QuickOpen } from './QuickOpen'

export { default as GlobalSearch, useGlobalSearch } from './GlobalSearch'

export { default as ContextMenu, useContextMenu } from './ContextMenu'
export type { ContextMenuItem, ContextMenuProps } from './ContextMenu'

export { default as Modal } from './Modal'

export { default as GitActions } from './GitActions'

export { default as GitActionsCompact } from './GitActionsCompact'

export { default as WelcomeTour, useShouldShowTour, resetWelcomeTour } from './WelcomeTour'

export { ToastProvider, useToast } from './Toast'

export { default as NotificationCenter } from './NotificationCenter'

export { default as Toolbelt } from './Toolbelt'

// Error handling components
export { default as ErrorBoundary, useErrorBoundary } from './ErrorBoundary'

export {
  default as EmptyState,
  NoFilesEmptyState,
  NoSearchResultsEmptyState,
  NoConversationsEmptyState,
  NoSkillsEmptyState
} from './EmptyState'

export {
  default as ErrorState,
  ApiError,
  IpcError,
  LoadingError,
  PermissionError
} from './ErrorState'

export {
  default as NotFound,
  FileNotFound,
  ConversationNotFound,
  SkillNotFound
} from './NotFound'

export {
  default as ConnectionError,
  NetworkOffline,
  ServerDown,
  IpcDisconnected,
  RequestTimeout
} from './ConnectionError'

// Skeleton loading components
export {
  default as Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonList,
  SkeletonGrid,
  SkeletonTable,
  SkeletonButton
} from './Skeleton'

// Animation components
export {
  PageTransition,
  AnimatedList,
  ScrollReveal,
  AnimatedPanel,
  AnimatedButton,
  SuccessCheckmark,
  FeedbackIndicator,
  AnimatedCard,
  LoadingSpinner,
  PulseDot
} from './AnimatedComponents'

// Page transition wrapper
export {
  PageTransitionWrapper,
  PersistentScreen,
  usePageTransitionContext
} from './PageTransitionWrapper'
export type {
  Screen,
  TransitionDirection,
  TransitionState,
  ScrollPosition,
  NavigationHistoryEntry,
  PageTransitionContextValue
} from './PageTransitionWrapper'
