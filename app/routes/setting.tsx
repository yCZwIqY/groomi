import LanguageSettings from '~/features/settings/language-settings';
import { useTranslation } from '~/hooks/use-translation';
import TrashNode from '~/features/settings/trash-node/trash-node';
import AiSetting from '~/features/settings/ai-setting/ai-setting';
import CommentStyleExampleSetting from '~/features/settings/ai-setting/comment-style-example-setting';
import WorkspaceBackup from '~/features/settings/workspace-backup';
import LicenseSettings from '~/features/settings/license-settings';

const Setting = () => {
  const { t } = useTranslation();
  return (
    <div className={'mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-10'}>
      <div className={'pb-2'}>
        <h1 className={'text-xl font-bold text-neutral-800'}>{t('settings.title')}</h1>
        <p className={'mt-1 text-sm text-neutral-400'}>{t('settings.description')}</p>
      </div>
      <LanguageSettings />
      <AiSetting />
      <TrashNode />
      <CommentStyleExampleSetting />
      <WorkspaceBackup />
      <LicenseSettings />
    </div>
  );
};

export default Setting;
