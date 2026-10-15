import SettingsSection from '~/components/common/settings-section';
import { useTranslation } from '~/hooks/use-translation';
import LanguageSetting from './language-setting';
import AiOutputLanguageSetting from './ai-output-language-setting';

export default function LanguageSettings() {
  const { t } = useTranslation();
  return (
    <SettingsSection
      title={t('settings.language')}
      description={t('settings.languagesDescription')}
    >
      <div className='divide-y divide-stone-200'>
        <div className='pb-5'>
          <LanguageSetting />
        </div>
        <div className='pt-5'>
          <AiOutputLanguageSetting />
        </div>
      </div>
    </SettingsSection>
  );
}
