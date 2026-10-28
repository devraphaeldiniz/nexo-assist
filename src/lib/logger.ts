import { randomUUID } from 'crypto';

interface LogContext {
  conversationId?: number;
  turnId?: string;
  userId?: number;
  userHash?: string;
  [key: string]: unknown;
}

function hashUserId(userId: number): string {
  const str = `user-${userId}-${process.env.LOG_SALT || 'default-salt'}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function createLogger(context: LogContext = {}) {
  const baseContext = {
    ...context,
    userHash: context.userId ? hashUserId(context.userId) : undefined,
  };

  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      console.info(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...baseContext,
        ...meta,
      }));
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...baseContext,
        ...meta,
      }));
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...baseContext,
        ...meta,
      }));
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'development') {
        console.info(JSON.stringify({
          level: 'debug',
          message,
          timestamp: new Date().toISOString(),
          ...baseContext,
          ...meta,
        }));
      }
    },
    child: (childContext: LogContext) => createLogger({ ...baseContext, ...childContext }),
  };
}

export const logger = createLogger();

export function generateTurnId(): string {
  return randomUUID().slice(0, 8);
}