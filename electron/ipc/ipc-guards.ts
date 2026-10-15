import { AppError, serializeAppError } from '../common/app-error.js';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;

function assertTrustedSender(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL();

  try {
    const url = new URL(senderUrl);
    const isProductionRenderer = url.protocol === 'app:' && url.hostname === 'groomi';
    const isDevelopmentRenderer =
      !process.env.NODE_ENV?.startsWith('production') &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);

    if (isProductionRenderer || isDevelopmentRenderer) {
      return;
    }
  } catch {
    // Rejected below.
  }

  throw new AppError('UNTRUSTED_SENDER');
}

export function secureHandle(channel: string, handler: IpcHandler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      assertTrustedSender(event);
      return await handler(event, ...args);
    } catch (error) {
      throw new Error(serializeAppError(error));
    }
  });
}

export function requireString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a string.` });
  }

  return value;
}

export function optionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a string.` });
  }

  return value;
}

export function requireNumberArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'number')) {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName} must be a number array.` });
  }

  return value;
}
