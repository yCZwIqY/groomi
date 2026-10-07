import ModalFrame from '~/components/common/modal/modal-frame';
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
  const { portal, setIsOpen } = useModal({
    content: (
      <ModalFrame
        title='확인'
        label='확인'
        size='small'
        onClose={() => setIsOpen(false)}
        footer={
          <>
            {' '}
            <DnButton
              variant={'outlined'}
              onClick={() => setIsOpen(false)}
            >
              닫기
            </DnButton>
            <DnButton
              variant={confirmVariant}
              onClick={() => {
                onConfirm?.();
                setIsOpen(false);
              }}
            >
              {confirmLabel ?? '확인'}
            </DnButton>
          </>
        }
      >
        <div className='text-sm leading-6 text-stone-600'>{description}</div>
      </ModalFrame>
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
      {portal}
    </>
  );
};

export default ConfirmModalWrapper;
