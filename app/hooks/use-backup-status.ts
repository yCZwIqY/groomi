import { getErrorMessage } from '~/lib/app-error';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspacePath } from '~/hooks';
import { getWorkspaceBackupStatus } from '~/lib/electron/workspace-api';

export default function useBackupStatus() {
  const { workspacePath } = useWorkspacePath();
  const [status, setStatus] = useState<WorkspaceBackupStatus | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!workspacePath) return;
    try {
      setStatus(await getWorkspaceBackupStatus());
      setError('');
    } catch {
      setError(getErrorMessage('GROOMI_ERROR:BACKUP_STATUS_FAILED'));
    }
  }, [workspacePath]);
  useEffect(() => {
    let active = true;
    setError('');
    const load = async () => {
      if (!workspacePath) return;
      try {
        const next = await getWorkspaceBackupStatus();
        if (active) {
          setStatus(next);
          setError('');
        }
      } catch {
        if (active) setError(getErrorMessage('GROOMI_ERROR:BACKUP_STATUS_FAILED'));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    window.addEventListener('workspace-backup-completed', load);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('workspace-backup-completed', load);
      window.removeEventListener('focus', load);
    };
  }, [workspacePath]);
  return { status: status?.workspacePath === workspacePath ? status : null, error, refresh };
}
