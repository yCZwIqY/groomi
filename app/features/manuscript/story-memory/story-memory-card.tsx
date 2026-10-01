import type { HTMLAttributes } from 'react';
import { storyMemoryCardClass } from './story-memory-styles';

export const StoryMemoryCard = ({
  as: Component = 'div',
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'article' | 'li' }) => (
  <Component
    {...props}
    className={storyMemoryCardClass + ' ' + className}
  />
);
