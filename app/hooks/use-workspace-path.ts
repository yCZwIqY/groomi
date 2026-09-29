import { useEffect, useState } from 'react';

import {
  getElectronMeta,
  isElectronReady,
} from '~/lib/electron/client';
import {
  createWorkspace,
  initCurrentWorkspace,
  selectWorkspacePath,
  updateWorkspaceRootPath,
} from '~/lib/electron/workspace-api';

export function useWorkspacePath() {
  const [workspacePath, setWorkspacePath] = useState('');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (!isElectronReady()) {
      setWorkspacePath('');
      setStatusText(getElectronMeta()?.preloadReady ? 'electronAPI missing' : 'preload missing');
      return;
    }

    setStatusText('electron ready');

    initCurrentWorkspace()
      .then((result) => {
        setWorkspacePath(result.path);
        setStatusText('');
      })
      .catch((error: unknown) => {
        setStatusText(error instanceof Error ? error.message : 'workspace init failed');
      });
  }, []);

  const changeWorkspacePath = async () => {
    const result = await selectWorkspacePath();

    if (!result) {
      return null;
    }

    setWorkspacePath(result.path);
    setStatusText('');

    return result;
  };

  const updateWorkspaceRoot = async (workspaceInfo: WorkspaceInfo | null) => {
    if (workspaceInfo) {
      setWorkspacePath(workspaceInfo.path);
      setStatusText('');
      return await updateWorkspaceRootPath(workspaceInfo?.path);
    }

    return null;
  };

  const createNewWorkspace = async (
    parentPath: string,
    workspaceName: string,
    novelType?: NovelType,
  ) => {
    return await createWorkspace(`${parentPath}/${workspaceName}`, novelType);
  };

  return {
    changeWorkspacePath,
    statusText,
    workspacePath,
    updateWorkspaceRoot,
    createNewWorkspace
  };
}
