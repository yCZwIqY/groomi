import { getErrorMessage } from '~/lib/app-error';
import { useEffect, useRef, useState } from 'react';
import ModalFrame from '~/components/common/modal/modal-frame';
import { loadLicenseIndex, type LicenseNotice } from './license-notices';

export default function LicenseNoticesModal({ onClose }: { onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [entries, setEntries] = useState<LicenseNotice[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LicenseNotice | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 24000;

  useEffect(() => {
    const controller = new AbortController();
    loadLicenseIndex(controller.signal)
      .then((notices) => {
        setEntries(notices);
        setSelected(notices.find((entry) => entry.name === 'Tabler Icons') ?? notices[0] ?? null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPage(0);
    const controller = new AbortController();
    setText('라이선스 원문을 불러오는 중입니다.');
    fetch(`/licenses/${selected.file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(getErrorMessage('GROOMI_ERROR:LICENSE_LOAD_FAILED'));
        return response.text();
      })
      .then(setText)
      .catch((reason) => {
        if (!controller.signal.aborted) setText(reason.message);
      });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    container.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const controls = container.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, a[href]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, []);

  const filtered = entries.filter((entry) =>
    `${entry.name} ${entry.license}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div ref={container}>
      <ModalFrame
        title='라이선스 및 출처'
        label='라이선스 및 출처'
        description='Groomi에 포함된 라이브러리, 아이콘, 폰트와 Electron 구성요소의 고지입니다. 원문은 앱에 포함되어 오프라인에서도 확인할 수 있습니다.'
        onClose={onClose}
      >
        <p className='mb-4 text-xs leading-5 text-stone-500'>
          앱 로고는 ChatGPT로 생성했습니다. AI 모델은 아래 라이브러리와 별도 약관을 적용받으며,
          사용자가 선택한 모델 및 서비스의 이용 조건을 확인해주세요.
        </p>
        <label className='block text-sm font-medium text-stone-700'>
          라이브러리·라이선스 검색
          <input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className='mt-2 w-full rounded-lg border border-stone-300 px-3 py-2'
            placeholder='예: Tabler, SUIT, MIT'
          />
        </label>
        {loading && (
          <p
            className='mt-4'
            role='status'
          >
            목록을 불러오는 중입니다.
          </p>
        )}
        {error && (
          <p
            className='mt-4 text-red-600'
            role='alert'
          >
            {error}
          </p>
        )}
        {!loading && !error && (
          <div className='mt-4 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]'>
            <div className='max-h-80 overflow-y-auto rounded-lg border border-stone-200'>
              {filtered.map((entry) => (
                <button
                  key={`${entry.name}@${entry.version}`}
                  type='button'
                  aria-pressed={selected === entry}
                  onClick={() => setSelected(entry)}
                  className={`block w-full break-words border-b border-stone-100 px-3 py-2 text-left text-xs ${selected === entry ? 'bg-primary-50 text-primary-700' : 'hover:bg-stone-50'}`}
                >
                  <span className='block font-semibold'>{entry.name}</span>
                  <span className='mt-1 block'>
                    {entry.version} · {entry.license}
                  </span>
                </button>
              ))}
              {!filtered.length && <p className='p-3 text-xs'>검색 결과가 없습니다.</p>}
            </div>
            {selected && (
              <div className='min-w-0'>
                <h3 className='text-sm font-semibold'>
                  {selected.name} {selected.version}
                </h3>
                <p className='mt-1 text-xs text-stone-500'>{selected.license}</p>
                {selected.requiresReview && (
                  <p className='mt-2 text-xs text-amber-700'>저작권 고지 추가 확인 필요</p>
                )}
                <a
                  href={selected.source}
                  target='_blank'
                  rel='noreferrer'
                  className='mt-2 block break-all text-xs text-primary-600 underline'
                >
                  {selected.source}
                </a>
                <pre className='mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-stone-50 p-3 text-[11px] leading-5'>
                  {text.slice(page * pageSize, (page + 1) * pageSize)}
                </pre>
                {text.length > pageSize && (
                  <div className='mt-2 flex items-center justify-between gap-2 text-xs'>
                    <button
                      type='button'
                      disabled={page === 0}
                      onClick={() => setPage((value) => value - 1)}
                      className='rounded border border-stone-200 px-2 py-1 disabled:opacity-40'
                    >
                      이전
                    </button>
                    <span aria-live='polite'>
                      {page + 1} / {Math.ceil(text.length / pageSize)}
                    </span>
                    <button
                      type='button'
                      disabled={(page + 1) * pageSize >= text.length}
                      onClick={() => setPage((value) => value + 1)}
                      className='rounded border border-stone-200 px-2 py-1 disabled:opacity-40'
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ModalFrame>
    </div>
  );
}
