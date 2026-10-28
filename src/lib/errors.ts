export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Não encontrado') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Muitas requisições') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export class LegacySystemError extends AppError {
  constructor(message = 'Sistema legado indisponível', public readonly retryable = true) {
    super(message, 'LEGACY_SYSTEM_ERROR', 503);
    this.name = 'LegacySystemError';
  }
}

export class StateTransitionError extends AppError {
  constructor(message = 'Transição de estado inválida') {
    super(message, 'STATE_TRANSITION_ERROR', 400);
    this.name = 'StateTransitionError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: unknown): { message: string; code: string; statusCode: number } {
  if (isAppError(error)) {
    return { message: error.message, code: error.code, statusCode: error.statusCode };
  }
  console.error('Unexpected error:', error);
  return { message: 'Erro interno do servidor', code: 'INTERNAL_ERROR', statusCode: 500 };
}