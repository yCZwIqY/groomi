import { useCallback, useEffect, useRef, useState } from 'react';
import DnButton from '~/components/common/buttons/dn-button';
import { getOpenRouterUsage } from '~/lib/electron/setting-api';
import { useBackgroundTasks } from '~/stores/use-background-tasks';

const amount = (value: number | null | undefined) => value == null ? '조회 불가' : `$${value.toFixed(4)}`;
const count = (value: number | null | undefined) => value == null ? '조회 불가' : value.toLocaleString('ko-KR');

const OpenRouterUsagePanel = ({ hasKey }: { hasKey: boolean }) => {
  const [usage, setUsage] = useState<OpenRouterUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const finishedAt = useBackgroundTasks((state) => state.tasks.reduce((latest, task) => Math.max(latest, task.finishedAt ?? 0), 0));
  const refresh = useCallback(async () => {
    if (!hasKey) return;
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const next = await getOpenRouterUsage();
      if (request === revision.current) setUsage(next);
    } catch {
      if (request === revision.current) setError('사용량을 조회하지 못했습니다. 연결 상태를 확인한 뒤 새로고침해주세요.');
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [hasKey]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      revision.current++;
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, finishedAt]);

  return (
    <section aria-label={'OpenRouter 사용량'} className={'rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3'}>
      <div className={'flex items-center justify-between gap-3'}>
        <h4 className={'font-semibold text-stone-900'}>OpenRouter 사용량</h4>
        <DnButton variant={'outlined'} disabled={!hasKey || loading} loading={loading} onClick={() => void refresh()}>사용량 새로고침</DnButton>
      </div>
      {!hasKey ? <p className={'text-sm text-stone-500'}>API 키를 등록하면 사용량을 확인할 수 있습니다.</p> : <>
        {(error || usage?.remoteError || usage?.localError) && <p role={'status'} className={'text-sm text-amber-700'}>{error || [usage?.remoteError, usage?.localError].filter(Boolean).join(' ')}</p>}
        {loading && !usage && <p className={'text-sm text-stone-500'}>사용량 조회 중…</p>}
        <dl className={'grid grid-cols-2 gap-3 text-sm lg:grid-cols-4'}>
          <div><dt className={'text-stone-500'}>키 누적 사용 금액</dt><dd className={'mt-1 font-semibold'}>{amount(usage?.key?.usedCredits)}</dd></div>
          <div><dt className={'text-stone-500'}>키 남은 사용 한도</dt><dd className={'mt-1 font-semibold'}>{usage?.key?.unlimited ? '키 한도 없음' : amount(usage?.key?.remainingCredits)}</dd></div>
          <div><dt className={'text-stone-500'}>오늘 사용 금액 (UTC)</dt><dd className={'mt-1 font-semibold'}>{amount(usage?.key?.dailyCredits)}</dd></div>
          <div><dt className={'text-stone-500'}>이번 달 사용 금액 (UTC)</dt><dd className={'mt-1 font-semibold'}>{amount(usage?.key?.monthlyCredits)}</dd></div>
          <div><dt className={'text-stone-500'}>Groomi 입력 토큰</dt><dd className={'mt-1 font-semibold'}>{count(usage?.local?.inputTokens)}</dd></div>
          <div><dt className={'text-stone-500'}>Groomi 출력 토큰</dt><dd className={'mt-1 font-semibold'}>{count(usage?.local?.outputTokens)}</dd></div>
          <div><dt className={'text-stone-500'}>Groomi 생성 요청</dt><dd className={'mt-1 font-semibold'}>{count(usage?.local?.requests)}회</dd></div>
          <div><dt className={'text-stone-500'}>실패한 API 요청</dt><dd className={'mt-1 font-semibold'}>{count(usage?.local?.failedRequests)}회</dd></div>
        </dl>
        {usage?.key?.freeRequests && <p className={'text-sm text-stone-600'}>무료 모델 오늘 요청 (UTC) · 사용 {count(usage.key.freeRequests.used)}회 / 남은 횟수 {count(usage.key.freeRequests.remaining)}회</p>}
        <p className={'text-xs text-stone-500'}>키 한도는 계정 전체 잔액과 다릅니다. Groomi 사용량은 이 기기에서 등록된 키로 보낸 생성 요청을 기록한 값이며, 재요청·실패를 포함합니다. 토큰은 응답에서 확인된 값만 합산합니다.</p>
        {!!usage?.local?.missingTokenResponses && <p className={'text-xs text-amber-700'}>토큰 정보가 없는 응답 {count(usage.local.missingTokenResponses)}건은 토큰 합계에 포함되지 않았습니다.</p>}
        {usage?.local?.startedAt && <p className={'text-xs text-stone-500'}>기록 시작 · {new Date(usage.local.startedAt).toLocaleString('ko-KR')}</p>}
        {usage?.updatedAt && <p className={'text-xs text-stone-500'}>마지막 조회 · {new Date(usage.updatedAt).toLocaleString('ko-KR')}{loading ? ' · 갱신 중…' : ''}</p>}
      </>}
    </section>
  );
};

export default OpenRouterUsagePanel;
