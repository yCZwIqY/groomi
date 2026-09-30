// Keep disk/DB operations in order; long-running inference does not hold this queue.
let pending: Promise<unknown> = Promise.resolve();

export function serializeWorkspaceOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
}
