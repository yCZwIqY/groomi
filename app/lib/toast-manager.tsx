import { getErrorMessage } from '~/lib/app-error';
import toast from 'react-hot-toast';

export const showToast = (
  message: string,
  type: 'default' | 'success' | 'warning' | 'danger' = 'default',
) => {
  if (message.includes('GROOMI_ERROR:')) message = getErrorMessage(message);
  if (type === 'default') {
    toast(message, {
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
  }

  if (type === 'danger') {
    toast(message, {
      style: {
        borderRadius: '10px',
        background: '#333',
        border: '1px solid #ab3d3d',
        color: '#fff',
      },
    });
  }

  if (type === 'success') {
    toast(message, {
      style: {
        borderRadius: '10px',
        background: '#333',
        border: '1px solid #4cab3d',
        color: '#fff',
      },
    });
  }
};
