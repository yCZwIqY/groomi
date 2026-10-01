export const StoryMemoryHeading = ({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count?: number;
}) => (
  <div>
    <h3 className={'flex items-center gap-2 text-sm font-semibold text-stone-900'}>
      {title}
      {count !== undefined && (
        <span
          className={'rounded-full bg-stone-200/70 px-2 py-0.5 text-xs font-medium text-stone-600'}
        >
          {count}
        </span>
      )}
    </h3>
    {description && <p className={'mt-1 text-xs leading-5 text-stone-500'}>{description}</p>}
  </div>
);
