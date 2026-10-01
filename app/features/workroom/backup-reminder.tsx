import { Link } from 'react-router';
import { AiOutlineSafety } from 'react-icons/ai';
import useBackupStatus from '~/hooks/use-backup-status';

export default function BackupReminder() {
  const { status, error } = useBackupStatus();
  if (!error && !status?.overdue) return null;
  return (
    <section
      className='ui-card flex flex-wrap items-center gap-4 border-primary-200 bg-primary-50 p-4'
      aria-label='원고 백업 안내'
    >
      <AiOutlineSafety
        size={24}
        className='shrink-0 text-primary-500'
        aria-hidden='true'
      />
      <div className='min-w-0 flex-1'>
        <h2 className='text-sm font-bold text-stone-800'>
          {error ? '백업 기록을 확인해주세요' : '소중한 원고를 백업해주세요'}
        </h2>
        <p className='mt-1 text-sm text-stone-600'>
          {error ||
            (status?.lastBackupAt
              ? '마지막 백업 이후 일주일 이상 지났습니다. 최근 작업을 별도 위치에 보관해주세요.'
              : '이 작업 폴더의 백업 기록이 없습니다. 첫 백업으로 원고를 안전하게 보관해주세요.')}
        </p>
        {status?.lastBackupAt && (
          <p className='mt-1 text-xs text-stone-500'>
            마지막 백업: {new Date(status.lastBackupAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
      <Link
        to='/setting'
        className='rounded-lg bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600'
      >
        백업 설정으로 이동
      </Link>
    </section>
  );
}
