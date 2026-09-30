import { create } from 'zustand';
import { flushPendingDocument } from '~/lib/pending-document';
import { showToast } from '~/lib/toast-manager';

interface SelectedWorkspace {
  selectedWorkspace?: WorkspaceNode;
  selectedWorkspaceId?: string;
  setSelectedWorkspace: (selectedWorkspace?: WorkspaceNode) => Promise<boolean>;
}

let selectionRequest = 0;
export const useSelectedWorkspace = create<SelectedWorkspace>((set, get) => ({
  setSelectedWorkspace: async (selectedWorkspace) => {
    if (get().selectedWorkspace?.path !== selectedWorkspace?.path) {
      const request = ++selectionRequest;
      try {
        await flushPendingDocument();
      } catch {
        showToast('원고 저장에 실패하여 이동하지 않았습니다. 다시 저장해주세요.', 'danger');
        return false;
      }
      if (request !== selectionRequest) return false;
    }
    set({
      selectedWorkspace,
      selectedWorkspaceId: selectedWorkspace?.id,
    });
    return true;
  },
}));
