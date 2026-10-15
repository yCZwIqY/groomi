import { useTranslation } from '~/hooks/use-translation';
import { TbShieldCheck } from 'react-icons/tb';
import { Link } from 'react-router';

import useBackupStatus from '~/hooks/use-backup-status';

export default function BackupReminder() {
  const { t, locale } = useTranslation();
  const { status, error } = useBackupStatus();
  if (!error && !status?.overdue) return null;
  return (
    <section
      className='ui-card flex flex-wrap items-center gap-4 border-primary-200 bg-primary-50 p-4'
      aria-label={t('backup.reminder.label')}
    >
      <TbShieldCheck
        size={24}
        className='shrink-0 text-primary-500'
        aria-hidden='true'
      />
      <div className='min-w-0 flex-1'>
        <h2 className='text-sm font-bold text-stone-800'>
          {error ? t('backup.reminder.error') : t('backup.reminder.title')}
        </h2>
        <p className='mt-1 text-sm text-stone-600'>
          {error ||
            (status?.lastBackupAt ? t('backup.reminder.overdue') : t('backup.reminder.first'))}
        </p>
        {status?.lastBackupAt && (
          <p className='mt-1 text-xs text-stone-500'>
            {t('backup.lastBackup')}: {new Date(status.lastBackupAt).toLocaleString(locale)}
          </p>
        )}
      </div>
      <Link
        to='/setting'
        className='rounded-lg bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600'
      >
        {t('backup.openSettings')}
      </Link>
    </section>
  );
}
