import { useEffect, useRef, useState } from 'react';
import {
  getTrashItems,
  purgeDocument,
  purgeWorkspace,
  restoreDocument,
  restoreWorkspace,
} from '~/lib/electron';
import TrashList from '~/features/manuscript/workspace-data/trash-list';
import { showToast } from '~/lib/toast-manager';

const TrashNode = () => {
  const [trashItems, setTrashItems] = useState<WorkspaceNode[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    void loadTrashItems();
  }, []);
  const loadTrashItems = async () => {
    try {
      setTrashItems(await getTrashItems());
    } catch (error) {
      showToast(error instanceof Error ? error.message : '휴지통을 불러오지 못했습니다.', 'danger');
    }
  };
  const handleRestoreItems = async (items: WorkspaceNode[]) => {
    if (busyRef.current || !items.length) return;
    busyRef.current = true;
    setBusy(true);
    let failed = 0;
    let lastError = '';
    // Restore parents first, before child restoration clears their deletion batch timestamp.
    const ordered = [...items].sort(
      (a, b) => a.path.split(/[\\/]/).length - b.path.split(/[\\/]/).length,
    );
    try {
      let remaining = await getTrashItems();
      for (const item of ordered) {
        if (
          !remaining.some((candidate) => candidate.id === item.id && candidate.path === item.path)
        )
          continue;
        try {
          if (item.type === 'document') await restoreDocument(item.path);
          else await restoreWorkspace(item.path);
        } catch (error) {
          failed++;
          lastError = error instanceof Error ? error.message : '복원에 실패했습니다.';
        }
        remaining = await getTrashItems();
      }
      setTrashItems(remaining);
      if (failed) showToast(`${failed}개 항목 복원 실패: ${lastError}`, 'danger');
      else showToast('선택한 휴지통 항목을 복원했습니다.', 'success');
    } catch (error) {
      await loadTrashItems();
      showToast(error instanceof Error ? error.message : '복원에 실패했습니다.', 'danger');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const handleDeleteItems = async (items: WorkspaceNode[]) => {
    if (busyRef.current || !items.length) return;
    busyRef.current = true;
    setBusy(true);
    let failed = 0;
    let lastError = '';
    // Delete selected descendants first so selecting a group and its children never targets an already removed node.
    const ordered = [...items].sort(
      (a, b) => b.path.split(/[\\/]/).length - a.path.split(/[\\/]/).length,
    );
    try {
      for (const item of ordered) {
        try {
          if (item.type === 'document') await purgeDocument(item.path);
          else await purgeWorkspace(item.path);
        } catch (error) {
          failed++;
          lastError = error instanceof Error ? error.message : '영구 삭제에 실패했습니다.';
        }
      }
      await loadTrashItems();
      if (failed) showToast(`${failed}개 항목 삭제 실패: ${lastError}`, 'danger');
      else showToast('선택한 휴지통 항목을 영구 삭제했습니다.', 'success');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <TrashList
      items={trashItems}
      busy={busy}
      onDelete={(item) => void handleDeleteItems([item])}
      onDeleteSelected={(items) => void handleDeleteItems(items)}
      onRestore={(item) => void handleRestoreItems([item])}
      onRestoreSelected={(items) => void handleRestoreItems(items)}
    />
  );
};
export default TrashNode;
