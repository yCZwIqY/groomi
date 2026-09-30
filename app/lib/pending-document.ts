type PendingDocument = {
  hasChanges: () => boolean;
  save: () => Promise<void>;
};

let pendingDocument: PendingDocument | null = null;

export function registerPendingDocument(document: PendingDocument) {
  pendingDocument = document;
  return () => {
    if (pendingDocument === document) pendingDocument = null;
  };
}

export function hasPendingDocumentChanges() {
  return pendingDocument?.hasChanges() ?? false;
}

export async function flushPendingDocument() {
  await pendingDocument?.save();
}
