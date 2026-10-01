import { useModal } from '~/hooks/use-modal';
import type { ReactNode } from 'react';
import DnButton from '~/components/common/buttons/dn-button';
import type { Variants } from '~/components';

interface Props {
  children?: ReactNode;
  description?: ReactNode;
  onConfirm?: () => void;
  confirmVariant?: Variants | 'red' | 'red-outline';
  confirmLabel?: ReactNode;
  triggerLabel?: string;
  disabled?: boolean;
}
const ConfirmModalWrapper = ({
  children,
  description,
  onConfirm,
  confirmVariant = 'primary',
  confirmLabel,
  triggerLabel,
  disabled = false,
}: Props) => {
  const { portal, isOpen, setIsOpen } = useModal({
    content: (
      <div className={'ui-modal w-[320px] flex flex-col gap-2'}>
        <div className={'text-lg font-bold text-center'}>확인</div>
        <div className={'py-2'}>{description}</div>
        <div className={'flex flex-col gap-2 justify-center'}>
          <DnButton
            variant={confirmVariant}
            onClick={() => {
              onConfirm?.();
              setIsOpen(false);
            }}
          >
            {confirmLabel ?? '확인'}
          </DnButton>
          <DnButton
            variant={'outlined'}
            onClick={() => setIsOpen(false)}
          >
            닫기
          </DnButton>
        </div>
      </div>
    ),
  });
  return (
    <>
      <button
        type={'button'}
        aria-label={triggerLabel}
        disabled={disabled}
        className={'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        {children}
      </button>
      {isOpen && portal}
    </>
  );
};

export default ConfirmModalWrapper;
