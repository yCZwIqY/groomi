import { useTranslation } from '~/hooks/use-translation';

export default function TaskCostUsage({ usage }: { usage: AiTaskUsage }) {
  const { t, locale } = useTranslation();
  const format = (value: number) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  const amount =
    usage.costUsd === null
      ? t('tasks.cost.unavailable')
      : usage.costUsd > 0 && usage.costUsd < 0.00000001
        ? `< USD ${format(0.00000001)}`
        : `USD ${format(usage.costUsd)}`;
  return (
    <div className='mt-1 text-xs leading-5 text-stone-500'>
      <p>
        OpenRouter · {t('tasks.cost.label')} {amount}
      </p>
      {usage.requestCount > 1 && (
        <p>
          {t('tasks.cost.requests')}: {usage.requestCount.toLocaleString(locale)}
        </p>
      )}
      {!usage.costComplete && <p>{t('tasks.cost.partial')}</p>}
    </div>
  );
}
