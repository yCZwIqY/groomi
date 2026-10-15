const messages = {
  ko: {
    copy: '복사',
    copied: '복사됨',
    copySuccess: '모델 다운로드 명령어를 복사했습니다.',
    copyFallback: '명령어를 선택했습니다. Ctrl+C 또는 복사 메뉴로 복사해주세요.',
    copyManually: '직접 복사',
  },
  en: {
    copy: 'Copy',
    copied: 'Copied',
    copySuccess: 'Model download command copied.',
    copyFallback: 'Command selected. Press Ctrl+C or use the copy menu.',
    copyManually: 'Copy manually',
  },
};
const text = messages[document.documentElement.lang] ?? messages.ko;

const status = document.querySelector('#copy-status');

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const command = document.getElementById(button.dataset.copy);
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command.textContent.trim());
      button.textContent = text.copied;
      status.textContent = text.copySuccess;
      window.setTimeout(() => {
        button.textContent = text.copy;
      }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(command);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = text.copyFallback;
      button.textContent = text.copyManually;
    }
  });
}
