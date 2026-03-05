import * as Sentry from '@sentry/react-native'

export function initReporter(): void {
  Sentry.init({
    dsn: 'https://91c2e230421350a8e1d5fbaac4b21895@o4509884634300416.ingest.de.sentry.io/4510993768448080',
    sendDefaultPii: true,
    enableLogs: false,
    environment: __DEV__ ? 'development' : 'production',
  })
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(err)
  })
}

export function captureMessage(msg: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(msg, level)
}

export function setUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null)
}

/** Wrap the root component to catch unhandled JS errors in the render tree. */
export const wrapApp = Sentry.wrap
