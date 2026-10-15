import { decodeError, LocalizedAppError } from '~/lib/app-error';
export function getElectronMeta() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.electronMeta ?? null;
}

export function getElectronApi() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.electronAPI ?? null;
}

export function isElectronReady() {
  return Boolean(getElectronApi());
}

export function requireElectronApi() {
  const electronApi = getElectronApi();

  if (!electronApi) {
    throw new LocalizedAppError('ELECTRON_UNAVAILABLE');
  }

  return new Proxy(
    { ...electronApi },
    {
      get(target, key) {
        const method = Reflect.get(target, key);
        if (typeof method !== 'function') return method;
        return (...args: unknown[]) => {
          try {
            const result = method.apply(target, args);
            return result instanceof Promise
              ? result.catch((error: unknown) => {
                  throw decodeError(error);
                })
              : result;
          } catch (error) {
            throw decodeError(error);
          }
        };
      },
    },
  );
}
