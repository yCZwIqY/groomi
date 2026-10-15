import { translate } from './translations';
import { useLanguage } from '~/stores/use-language';
import errors from '../../electron/common/locales/errors-ko.json';

type ErrorCode = keyof typeof errors;
const ERROR_PREFIX = 'GROOMI_ERROR:';
function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(errors, value);
}

export class LocalizedAppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'LocalizedAppError';
    Object.defineProperty(this, 'message', {
      configurable: true,
      get: () => translate(useLanguage.getState().language, `errors.${this.code}`),
    });
  }
}

export function decodeError(error: unknown): LocalizedAppError {
  if (error instanceof LocalizedAppError) return error;
  const message = error instanceof Error ? error.message : '';
  const code = message.slice(message.lastIndexOf(ERROR_PREFIX) + ERROR_PREFIX.length);
  return new LocalizedAppError(
    message.includes(ERROR_PREFIX) && isErrorCode(code) ? code : 'UNKNOWN',
  );
}

export function errorToken(error: unknown): string {
  return `${ERROR_PREFIX}${decodeError(error).code}`;
}

export function getErrorMessage(error: unknown): string {
  return decodeError(typeof error === 'string' ? new Error(error) : error).message;
}
