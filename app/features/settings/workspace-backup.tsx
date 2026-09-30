import { useState } from 'react';
import DnButton from '~/components/common/buttons/dn-button';
import { backupWorkspace, restoreWorkspaceBackup } from '~/lib/electron-api';
import { showToast } from '~/lib/toast-manager';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import { useBackgroundTasks } from '~/stores/use-background-tasks';

export default function WorkspaceBackup() {
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState('');
  const tasks = useBackgroundTasks((state) => state.tasks);
  const hasRunningTask = Object.values(tasks).some((task) => task.status === 'running');

  const run = async (restore: boolean) => {
    setBusy(true);
    try {
      if (restore) {
        const result = await restoreWorkspaceBackup();
        if (result) {
          await useSelectedWorkspace.getState().setSelectedWorkspace(undefined);
          showToast('새 작업 폴더에 복원했습니다. 기존 작업 폴더는 보존됩니다.', 'success');
        }
      } else {
        const result = await backupWorkspace();
        if (result) {
          setLastBackup(result.path);
          showToast('작업 폴더 백업을 완료했습니다.', 'success');
        }
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '백업·복원에 실패했습니다.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className='rounded-lg bg-white p-6 shadow-md'>
      <h2 className='mb-2 font-bold text-neutral-700'>원고 백업·복원</h2>
      <p className='mb-4 text-sm text-neutral-500'>
        원고, 휴지통, 댓글, 이미지와 AI 설정을 백업합니다. 백업 폴더 전체를 별도 드라이브에도
        보관해주세요. 복원은 새 작업 폴더를 만듭니다.
      </p>
      <div className='flex gap-3'>
        <DnButton
          disabled={busy || hasRunningTask}
          onClick={() => run(false)}
        >
          작업 폴더 백업
        </DnButton>
        <DnButton
          disabled={busy || hasRunningTask}
          variant='outlined'
          onClick={() => run(true)}
        >
          백업에서 복원
        </DnButton>
      </div>
      {hasRunningTask && (
        <p className='mt-3 text-sm text-neutral-500'>AI 작업이 끝난 뒤 백업·복원할 수 있습니다.</p>
      )}
      {lastBackup && (
        <p className='mt-3 break-all text-sm text-neutral-500'>최근 백업: {lastBackup}</p>
      )}
    </section>
  );
}
