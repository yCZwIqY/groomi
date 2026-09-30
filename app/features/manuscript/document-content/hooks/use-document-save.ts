import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { updateDocument } from '~/lib/electron/document-api';
import { registerPendingDocument } from '~/lib/pending-document';
import { showToast } from '~/lib/toast-manager';

type Props = {
  workspaceData: WorkspaceNode;
  draft: string;
  manuscript: string;
  draftStatus: { charsWithSpaces: number; charsWithoutSpaces: number };
  manuscriptStatus: { charsWithSpaces: number; charsWithoutSpaces: number };
  resetContent: (data?: WorkspaceNode) => void;
  onUpdated?: (data: WorkspaceNode) => void;
};

export function useDocumentSave(props: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const current = useRef(props);
  current.current = props;
  const saved = useRef({
    draft: props.workspaceData.document?.draft?.content ?? '',
    manuscript: props.workspaceData.document?.manuscript?.content ?? '',
  });
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const allowClose = useRef(false);

  const hasChanges = () =>
    initialized.current &&
    (inFlight.current !== null ||
      current.current.draft !== saved.current.draft ||
      current.current.manuscript !== saved.current.manuscript);

  const save = async (): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    if (!hasChanges()) return;
    setSaving(true);
    setSaveError(false);
    const operation = (async () => {
      let updated: WorkspaceNode | null = null;
      // Edits made while IPC is in flight are saved before navigation can proceed.
      while (
        current.current.draft !== saved.current.draft ||
        current.current.manuscript !== saved.current.manuscript
      ) {
        const snapshot = current.current;
        const now = new Date().toISOString();
        updated = await updateDocument(snapshot.workspaceData.path, {
          document: {
            draft: {
              ...snapshot.workspaceData.document?.draft,
              ...snapshot.draftStatus,
              content: snapshot.draft,
              updatedAt: now,
              createdAt: snapshot.workspaceData.document?.draft?.createdAt ?? now,
            },
            manuscript: {
              ...snapshot.workspaceData.document?.manuscript,
              ...snapshot.manuscriptStatus,
              content: snapshot.manuscript,
              updatedAt: now,
              createdAt: snapshot.workspaceData.document?.manuscript?.createdAt ?? now,
            },
          },
        });
        saved.current = { draft: snapshot.draft, manuscript: snapshot.manuscript };
      }
      if (mounted.current && updated) current.current.onUpdated?.(updated);
    })();
    inFlight.current = operation;
    try {
      await operation;
    } catch (error) {
      if (mounted.current) setSaveError(true);
      throw error;
    } finally {
      inFlight.current = null;
      if (mounted.current) setSaving(false);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  useLayoutEffect(() => {
    mounted.current = true;
    initialized.current = false;
    const data = current.current.workspaceData;
    saved.current = {
      draft: data.document?.draft?.content ?? '',
      manuscript: data.document?.manuscript?.content ?? '',
    };
    current.current.resetContent(data);
    setSaveError(false);
    return () => {
      mounted.current = false;
    };
  }, [props.workspaceData.path]);

  useLayoutEffect(() => {
    initialized.current = true;
  });

  useEffect(
    () =>
      registerPendingDocument({
        hasChanges: () => hasChangesRef.current(),
        save: () => saveRef.current(),
      }),
    [props.workspaceData.path],
  );

  const dirty =
    props.draft !== saved.current.draft || props.manuscript !== saved.current.manuscript;
  useEffect(() => {
    if (!dirty || saving || saveError) return;
    const timeout = window.setTimeout(() => {
      void saveRef.current().catch(() => {});
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [dirty, props.draft, props.manuscript, saving, saveError]);

  const blocker = useBlocker(() => hasChangesRef.current());
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    void saveRef
      .current()
      .then(() => {
        if (!cancelled) blocker.proceed();
      })
      .catch(() => {
        if (!cancelled) {
          blocker.reset();
          showToast('원고 저장에 실패하여 이동하지 않았습니다.', 'danger');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [blocker]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowClose.current || !hasChangesRef.current()) return;
      event.preventDefault();
      event.returnValue = '';
      void saveRef
        .current()
        .then(() => {
          allowClose.current = true;
          window.close();
        })
        .catch(() =>
          showToast('저장에 실패하여 창을 닫지 않았습니다. 다시 저장해주세요.', 'danger'),
        );
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  return {
    saving,
    dirty,
    saveError,
    clearSaveError: () => setSaveError(false),
    save: () => saveRef.current(),
  };
}
