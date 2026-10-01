const status = document.querySelector('#copy-status');

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const command = document.getElementById(button.dataset.copy);
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command.textContent.trim());
      button.textContent = '복사됨';
      status.textContent = '모델 다운로드 명령어를 복사했습니다.';
      window.setTimeout(() => {
        button.textContent = '복사';
      }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(command);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = '명령어를 선택했습니다. Ctrl+C 또는 복사 메뉴로 복사해주세요.';
      button.textContent = '직접 복사';
    }
  });
}
