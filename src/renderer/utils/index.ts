// Utils barrel export

export {
  default as logger,
  logError,
  logIpcError,
  logComponentError,
  getErrorLog,
  clearErrorLog,
  subscribeToErrors,
  withErrorLogging,
  createSafeIpcCaller,
  AppError,
  IpcError,
  type ErrorSeverity,
  type ErrorContext,
  type LoggedError
} from './errorLogger'
