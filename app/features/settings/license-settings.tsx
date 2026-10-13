import DnButton from '~/components/common/buttons/dn-button';
import SettingsSection from '~/components/common/settings-section';
import { useModal } from '~/hooks/use-modal';
import LicenseNoticesModal from './license-notices-modal';

export default function LicenseSettings() {
  const { portal, setIsOpen } = useModal({
    content: <LicenseNoticesModal onClose={() => setIsOpen(false)} />,
  });

  return (
    <>
      <SettingsSection
        title='라이선스 및 출처'
        description='오픈소스 라이브러리와 아이콘·폰트의 저작권 및 이용 조건을 확인합니다.'
      >
        <DnButton
          variant='outlined'
          onClick={(event) => {
            event.currentTarget.focus();
            setIsOpen(true);
          }}
        >
          라이선스 및 출처 보기
        </DnButton>
      </SettingsSection>
      {portal}
    </>
  );
}
