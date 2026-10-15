import messages from './locales/errors-ko.json' with { type: 'json' };

export type ErrorCode = keyof typeof messages;

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, options?: ErrorOptions & { diagnostic?: string }) {
    super(options?.diagnostic ?? messages[code], options);
    this.name = 'AppError';
    this.code = code;
  }
}

export const ERROR_PREFIX = 'GROOMI_ERROR:';

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(messages, value);
}

export function serializeAppError(error: unknown): string {
  // Only allow known codes over IPC. Never send arbitrary exception text, paths or AI output.
  const code = error instanceof AppError ? error.code : 'UNKNOWN';
  return `${ERROR_PREFIX}${code}`;
}
